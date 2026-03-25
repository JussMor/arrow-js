import '@arrow-js/framework/internal'

import type { ArrowTemplate, ParentNode } from '@arrow-js/core'
import { createHydrationCapture } from '@arrow-js/core/internal'
import type {
  ArrowTemplate as InternalArrowTemplate,
  ParentNode as InternalParentNode,
} from '@arrow-js/core/internal'
import type { RenderPayload } from '@arrow-js/framework/internal'
import { toTemplate, withRenderContext } from '@arrow-js/framework/internal'
import { hydrateTemplate } from './reconcile'

export interface HydrationPayload {
  html?: string
  rootId?: string
  async?: Record<string, unknown>
  boundaries?: string[]
}

export interface HydrationMismatchDetails {
  actual: string
  expected: string
  mismatches: number
  repaired: boolean
  boundaryFallbacks: number
}

export interface HydrationOptions {
  onMismatch?: (details: HydrationMismatchDetails) => void
}

export interface HydrationResult {
  root: ParentNode
  template: ArrowTemplate
  payload: RenderPayload
  adopted: boolean
  mismatches: number
  boundaryFallbacks: number
}

export async function hydrate(
  root: ParentNode,
  view: unknown,
  payload: HydrationPayload = {},
  options: HydrationOptions = {}
): Promise<HydrationResult> {
  return withRenderContext(
    async (context) => {
      const template = toTemplate(view)
      const actual = getInnerHtml(root)
      const expected = payload.html ?? actual
      const stage = document.createDocumentFragment()
      const capture = createHydrationCapture()

      context.hydrationCapture = capture
      try {
        template(stage)
        await context.flush()
      } finally {
        context.hydrationCapture = null
      }

      const hydration = {
        mismatches: 0,
      }

      if (
        hydrateTemplate(
          capture,
          template as InternalArrowTemplate,
          root as InternalParentNode,
          stage as InternalParentNode,
          hydration
        )
      ) {
        if (hydration.mismatches) {
          options.onMismatch?.({
            actual,
            expected,
            mismatches: hydration.mismatches,
            repaired: true,
            boundaryFallbacks: 0,
          })
        }

        return {
          root,
          template,
          payload: {
            async: { ...context.asyncSnapshots },
            boundaries: [...context.boundaries],
          },
          adopted: true,
          mismatches: hydration.mismatches,
          boundaryFallbacks: 0,
        }
      }

      const boundaryFallbacks = replaceMarkedBoundaries(root, stage, payload.boundaries ?? [])
      if (boundaryFallbacks) {
        options.onMismatch?.({
          actual,
          expected,
          mismatches: boundaryFallbacks,
          repaired: true,
          boundaryFallbacks,
        })

        return {
          root,
          template,
          payload: {
            async: { ...context.asyncSnapshots },
            boundaries: [...context.boundaries],
          },
          adopted: false,
          mismatches: 0,
          boundaryFallbacks,
        }
      }

      options.onMismatch?.({
        actual,
        expected,
        mismatches: 0,
        repaired: false,
        boundaryFallbacks: 0,
      })

      replaceChildren(root, stage)

      return {
        root,
        template,
        payload: {
          async: { ...context.asyncSnapshots },
          boundaries: [...context.boundaries],
        },
        adopted: false,
        mismatches: 0,
        boundaryFallbacks: 0,
      }
    },
    {
      hydrationSnapshots: payload.async,
    }
  )
}

export function readPayload(
  doc: Document = document,
  id = 'arrow-ssr-payload'
): HydrationPayload {
  const element = doc.getElementById(id)

  if (!element?.textContent) {
    return {}
  }

  return JSON.parse(element.textContent) as HydrationPayload
}

export function replaceMarkedBoundaries(
  root: ParentNode,
  stage: DocumentFragment,
  boundaryIds: string[]
): number {
  if (!boundaryIds.length) {
    return 0
  }

  const liveRanges = collectBoundaryRanges(root)
  const stageRanges = collectBoundaryRanges(stage)
  let replaced = 0

  for (const id of boundaryIds) {
    const live = liveRanges.get(id)
    const staged = stageRanges.get(id)

    if (!live || !staged) {
      continue
    }

    const fragment = extractRange(staged.start, staged.end)
    replaceRange(live.start, live.end, fragment)
    replaced += 1
  }

  return replaced
}

function getInnerHtml(root: ParentNode): string {
  return 'innerHTML' in root ? (root as { innerHTML: string }).innerHTML : ''
}

function replaceChildren(root: ParentNode, stage: DocumentFragment) {
  if ('replaceChildren' in root) {
    const target = root as Node & {
      replaceChildren: (...nodes: Node[]) => void
      appendChild: (node: Node) => Node
    }
    target.replaceChildren()
    target.appendChild(stage)
    return
  }

  const target = root as Node & ParentNode

  while (target.firstChild) {
    target.removeChild(target.firstChild)
  }
  target.appendChild(stage)
}

function collectBoundaryRanges(root: ParentNode) {
  const ranges = new Map<string, { start: Element; end: Element }>()
  const starts = new Map<string, Element>()
  const doc = root.ownerDocument ?? document
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let current = walker.nextNode()

  while (current) {
    const element = current as Element
    const start = element.getAttribute('data-arrow-boundary-start')
    const end = element.getAttribute('data-arrow-boundary-end')

    if (start) {
      starts.set(start, element)
    } else if (end) {
      const id = end
      const start = starts.get(id)

      if (start) {
        ranges.set(id, { start, end: element })
      }
    }

    current = walker.nextNode()
  }

  return ranges
}

function extractRange(start: Node, end: Node) {
  const fragment = document.createDocumentFragment()
  let current: Node | null = start

  while (current) {
    const next: Node | null = current === end ? null : current.nextSibling
    fragment.appendChild(current)
    if (current === end) break
    current = next
  }

  return fragment
}

function replaceRange(start: Node, end: Node, fragment: DocumentFragment) {
  const parent = start.parentNode
  if (!parent) {
    return
  }

  parent.insertBefore(fragment, start)

  let current: Node | null = start
  while (current) {
    const next: Node | null = current === end ? null : current.nextSibling
    parent.removeChild(current)
    if (current === end) break
    current = next
  }
}
