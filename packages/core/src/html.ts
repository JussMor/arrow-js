import { watch } from './reactive'
import { isChunk, isTpl, queue, swapCleanupCollector } from './common'
import { setAttr } from './dom'
import {
  adoptCapturedChunk,
  getHydrationCapture,
  registerHydrationHook,
} from './hydration'
import type { HydrationCapture, NodeMap } from './hydration'
import {
  createPropsProxy,
  isCmp,
} from './component'
import type { ComponentCall } from './component'
import {
  expressionPool,
  onExpressionUpdate,
  releaseExpressions,
  storeExpressions,
  updateExpressions,
} from './expressions'

export interface ArrowTemplate {
  (parent: ParentNode): ParentNode
  (): DocumentFragment
  isT: boolean
  key: (key: ArrowTemplateKey) => ArrowTemplate
  _c: () => Chunk
  _e: number
  _k: ArrowTemplateKey
}

type ArrowTemplateKey = string | number | undefined

export type ArrowRenderable =
  | string
  | number
  | boolean
  | null
  | undefined
  | ComponentCall
  | ArrowTemplate
  | Array<string | number | boolean | ComponentCall | ArrowTemplate>

export interface ReactiveFunction {
  (el?: Node): ArrowRenderable
  $on: (observer: ArrowFunction | null) => ArrowFunction | null
  _up: (newExpression: ReactiveFunction) => void
  e: ArrowExpression
  s: boolean
}

export type ReactiveExpressions = {
  i: number
  e: ReactiveFunction[]
}

export interface ArrowFragment {
  <T extends ParentNode>(parent?: T): T extends undefined ? DocumentFragment : T
}

export type ParentNode = Node | DocumentFragment

export type RenderGroup =
  | ArrowTemplate
  | ArrowTemplate[]
  | Node
  | Node[]
  | string[]

export type ArrowFunction = (...args: unknown[]) => ArrowRenderable

export type ArrowExpression =
  | ArrowRenderable
  | ArrowFunction
  | EventListener
  | ((evt: InputEvent) => void)

export interface Chunk {
  readonly paths: [number[], string[]]
  dom: DocumentFragment
  ref: DOMRef
  _t: ArrowTemplate
  k?: ArrowTemplateKey
  u?: Array<() => void> | null
  s?: ReturnType<typeof createPropsProxy>[1]
}

interface ChunkProto {
  readonly template: HTMLTemplateElement
  readonly paths: Chunk['paths']
}

interface DOMRef {
  f: ChildNode | null
  l: ChildNode | null
}

type Rendered = Chunk | Text
type RenderController = ((
  renderable: ArrowRenderable
) => DocumentFragment | Text | void) & {
  adopt: (map: NodeMap, visited: WeakSet<Chunk>) => void
}
type InternalTemplate = ArrowTemplate & {
  d?: () => void
  x?: () => void
  _a?: ArrowExpression[]
  _h?: Chunk
  _m?: boolean
  _s?: TemplateStringsArray | string[]
}

let bindingStackPos = -1
const bindingStack: Array<Node | number> = []
const nodeStack: Node[] = []

const delimiter = '¤'
const delimiterComment = `<!--${delimiter}-->`

const chunkMemo: Record<string, ChunkProto> = {}
const chunkMemoByRef = new WeakMap<ReadonlyArray<string>, ChunkProto>()

function moveDOMRef(
  ref: DOMRef,
  parent: Node | null,
  before?: ChildNode | null
) {
  let node = ref.f
  if (!parent || !node) return
  const last = ref.l
  if (node === last) {
    parent.insertBefore(node, before || null)
    return
  }
  while (node) {
    const next: ChildNode | null =
      node === last ? null : (node.nextSibling as ChildNode | null)
    parent.insertBefore(node, before || null)
    if (!next) break
    node = next
  }
}

export function html(
  strings: TemplateStringsArray | string[],
  ...expSlots: ArrowExpression[]
): ArrowTemplate
export function html(
  strings: TemplateStringsArray | string[],
  ...expSlots: ArrowExpression[]
): ArrowTemplate {
  const template = ((el?: ParentNode) =>
    renderTemplate(template as InternalTemplate, el)) as InternalTemplate
  template.isT = true
  template._a = expSlots
  template._c = ensureChunk
  template._e = storeExpressions(expSlots)
  template._m = false
  template._s = strings
  template.key = setTemplateKey
  template.x = releaseTemplateExpressions
  template.d = resetTemplate
  return template
}

function ensureExpressionPointer(template: InternalTemplate) {
  return template._e < 0
    ? (template._e = storeExpressions(template._a!))
    : template._e
}

function ensureChunk(this: InternalTemplate) {
  let chunk = this._h
  if (!chunk) {
    chunk = createChunk(this._s as string[]) as Chunk
    chunk._t = this
    chunk.k = this._k
    this._h = chunk
  }
  return chunk
}

function setTemplateKey(this: InternalTemplate, key: ArrowTemplateKey) {
  this._k = key
  if (this._h) this._h.k = key
  return this
}

function releaseTemplateExpressions(this: InternalTemplate) {
  if (this._e + 1) {
    releaseExpressions(this._e)
    this._e = -1
  }
}

function resetTemplate(this: InternalTemplate) {
  this._m = false
  this._h = undefined
  this.x?.()
}

function renderTemplate(template: InternalTemplate, el?: ParentNode) {
  if (!template._m) {
    template._m = true
    return createBindings(
      template._c(),
      ensureExpressionPointer(template),
      el
    )
  }
  const liveChunk = template._c()
  moveDOMRef(liveChunk.ref, liveChunk.dom)
  return el ? el.appendChild(liveChunk.dom) : liveChunk.dom
}

function createBindings(
  chunk: Chunk,
  expressionPointer: number,
  el?: ParentNode
): ParentNode | DocumentFragment {
  const totalPaths = expressionPool[expressionPointer] as number
  const [pathTape, attrNames] = chunk.paths
  const stackStart = bindingStackPos + 1
  let tapePos = 0
  nodeStack[0] = chunk.dom
  for (let i = 0; i < totalPaths; i++) {
    const sharedDepth = pathTape[tapePos++]
    let remaining = pathTape[tapePos++]
    let depth = sharedDepth
    let node = nodeStack[depth] as Node
    while (remaining--) {
      node = node.childNodes[pathTape[tapePos++]] as Node
      nodeStack[++depth] = node
    }
    bindingStack[++bindingStackPos] = node
    bindingStack[++bindingStackPos] = pathTape[tapePos++]
  }
  const stackEnd = bindingStackPos
  for (let s = stackStart, e = expressionPointer + 1; s < stackEnd; s++, e++) {
    const node = bindingStack[s] as ChildNode
    const segment = bindingStack[++s] as number
    if (segment) createAttrBinding(node, attrNames[segment - 1], e, chunk)
    else createNodeBinding(node, e, chunk)
  }
  bindingStack.length = stackStart
  bindingStackPos = stackStart - 1
  return el ? el.appendChild(chunk.dom) && el : chunk.dom
}

function createNodeBinding(
  node: ChildNode,
  expressionPointer: number,
  parentChunk: Chunk
) {
  let fragment: DocumentFragment | Text
  const expression = expressionPool[expressionPointer]
  const capture = getHydrationCapture()

  if (isCmp(expression) || isTpl(expression) || Array.isArray(expression)) {
    const render = createRenderFn(capture)
    fragment = render(expression)!
    if (capture) {
      registerHydrationHook(parentChunk, (map, visited) => {
        render.adopt(map, visited)
      })
    }
  } else if (typeof expression === 'function') {
    let target: Text | null = null
    let render: RenderController | null = null
    const [frag, stop] = watch(expressionPointer, (value) => {
      if (!render) {
        if (isCmp(value) || isTpl(value) || Array.isArray(value)) {
          render = createRenderFn(capture)
          const next = render(value)!
          if (target) {
            target.parentNode?.replaceChild(next, target)
            target = null
          }
          return next
        }
        if (!target) {
          target = document.createTextNode(renderText(value))
          return target
        }
        const next = renderText(value)
        if (target.nodeValue !== next) target.nodeValue = next
        return target
      }
      return render(value)
    })
    ;(parentChunk.u ??= []).push(stop)
    fragment = frag!
    if (capture) {
      registerHydrationHook(parentChunk, (map, visited) => {
        if (target) {
          const adopted = map.get(target)
          if (adopted) target = adopted as Text
        }
        render?.adopt(map, visited)
      })
    }
  } else {
    let target = document.createTextNode(renderText(expression))
    fragment = target
    onExpressionUpdate(
      expressionPointer,
      (value: string) => (target.nodeValue = renderText(value))
    )
    if (capture) {
      registerHydrationHook(parentChunk, (map) => {
        const adopted = map.get(target)
        if (adopted) target = adopted as Text
      })
    }
  }

  if (node === parentChunk.ref.f || node === parentChunk.ref.l) {
    const last =
      fragment.nodeType === 11
        ? (fragment.lastChild as ChildNode | null)
        : (fragment as ChildNode)
    if (node === parentChunk.ref.f) {
      parentChunk.ref.f =
        fragment.nodeType === 11
          ? (fragment.firstChild as ChildNode | null)
          : (fragment as ChildNode)
    }
    if (node === parentChunk.ref.l) parentChunk.ref.l = last
  }

  node.parentNode?.replaceChild(fragment, node)
}

function createAttrBinding(
  node: ChildNode,
  attrName: string,
  expressionPointer: number,
  parentChunk: Chunk
) {
  if (node.nodeType !== 1) return
  let target = node as Element
  const expression = expressionPool[expressionPointer]
  const capture = getHydrationCapture()

  if (attrName[0] === '@') {
    const event = attrName.slice(1)
    const listener = (evt: Event) =>
      (expressionPool[expressionPointer] as CallableFunction)?.(evt)
    target.addEventListener(event, listener)
    target.removeAttribute(attrName)
    ;(parentChunk.u ??= []).push(() => target.removeEventListener(event, listener))
    if (capture) {
      registerHydrationHook(parentChunk, (map) => {
        const adopted = map.get(target)
        if (!adopted) return
        target.removeEventListener(event, listener)
        target = adopted as Element
        target.addEventListener(event, listener)
        target.removeAttribute(attrName)
      })
    }
  } else if (typeof expression === 'function' && !isTpl(expression)) {
    const [, stop] = watch(expressionPointer, (value) =>
      setAttr(target, attrName, value as string)
    )
    ;(parentChunk.u ??= []).push(stop)
    if (capture) {
      registerHydrationHook(parentChunk, (map) => {
        const adopted = map.get(target)
        if (adopted) target = adopted as Element
      })
    }
  } else {
    setAttr(target, attrName, expression as string | number | boolean | null)
    onExpressionUpdate(expressionPointer, (value: string) =>
      setAttr(target, attrName, value)
    )
  }
}

function createRenderFn(capture: HydrationCapture | null): RenderController {
  let previous: Chunk | Text | Rendered[]
  const keyedChunks: Record<Exclude<ArrowTemplateKey, undefined>, Chunk> = {}
  let updaterFrag: DocumentFragment | null = null

  const render = function render(
    renderable: ArrowRenderable
  ): DocumentFragment | Text | void {
    if (!previous) {
      if (isCmp(renderable)) {
        const [fragment, chunk] = renderComponent(renderable)
        previous = chunk
        return fragment
      }
      if (isTpl(renderable)) {
        const fragment = renderable()
        previous = renderable._c()
        return fragment
      }
      if (Array.isArray(renderable)) {
        const [fragment, rendered] = renderList(renderable)
        previous = rendered
        return fragment
      }
      return (previous = document.createTextNode(renderText(renderable)))
    }

    if (Array.isArray(renderable)) {
      if (!Array.isArray(previous)) {
        const [fragment, nextList] = renderList(renderable)
        getNode(previous).after(fragment)
        forgetChunk(previous)
        unmount(previous)
        previous = nextList
      } else {
        let i = 0
        const renderableLength = renderable.length
        const previousLength = previous.length
        let anchor: ChildNode | undefined
        const renderedList: Rendered[] = []
        const previousToRemove = new Set(previous)
        if (renderableLength > previousLength) updaterFrag ??= document.createDocumentFragment()
        for (; i < renderableLength; i++) {
          let item:
            | string
            | number
            | boolean
            | ComponentCall
            | ArrowTemplate = renderable[i] as ArrowTemplate
          const prev = previous[i]
          let key: ArrowTemplateKey
          if (
            isTpl(item) &&
            (key = item._k) !== undefined &&
            key in keyedChunks
          ) {
            const keyedChunk = keyedChunks[key]
            updateExpressions(item._e, keyedChunk._t._e)
            if (keyedChunk._t !== item) (item as InternalTemplate).x?.()
            item = keyedChunk._t
          }
          if (i > previousLength - 1) {
            renderedList[i] = mountItem(item, updaterFrag!)
            continue
          }
          const used = patch(item, prev, anchor) as Rendered
          anchor = getNode(used)
          renderedList[i] = used
          previousToRemove.delete(used)
        }
        if (!renderableLength) {
          getNode(previous[0]).after(
            (renderedList[0] = document.createTextNode(''))
          )
        } else if (renderableLength > previousLength) {
          anchor?.after(updaterFrag!)
        }
        previousToRemove.forEach((stale) => {
          forgetChunk(stale)
          unmount(stale)
        })
        previous = renderedList
      }
    } else {
      previous = patch(renderable, previous)
    }
  } as RenderController

  render.adopt = (map: NodeMap, visited: WeakSet<Chunk>) => {
    if (!capture) return
    previous = adoptRenderedValue(previous, capture, map, visited) as
      | Chunk
      | Text
      | Rendered[]
  }

  function renderList(
    renderable: Array<string | number | boolean | ComponentCall | ArrowTemplate>,
  ): [DocumentFragment, Rendered[]] {
    const fragment = document.createDocumentFragment()
    if (!renderable.length) {
      const placeholder = document.createTextNode('')
      fragment.appendChild(placeholder)
      return [fragment, [placeholder]]
    }
    const renderedItems: Rendered[] = new Array(renderable.length)
    for (let i = 0; i < renderable.length; i++) {
      renderedItems[i] = mountItem(renderable[i], fragment)
    }
    return [fragment, renderedItems]
  }

  function patch(
    renderable: Exclude<
      ArrowRenderable,
      Array<string | number | boolean | ComponentCall | ArrowTemplate>
    >,
    prev: Chunk | Text | Rendered[],
    anchor?: ChildNode
  ): Chunk | Text | Rendered[] {
    const nodeType = (prev as Node).nodeType ?? 0
    if (isCmp(renderable)) {
      const key = renderable.k
      if (key !== undefined && key in keyedChunks) {
        const keyedChunk = keyedChunks[key]
        if (keyedChunk.s?.[1] === renderable.h) {
          if (keyedChunk.s[0] !== renderable.p) keyedChunk.s[0] = renderable.p
          if (keyedChunk === prev) return prev
          if (anchor) {
            moveDOMRef(keyedChunk.ref, anchor.parentNode, anchor.nextSibling)
          } else {
            const target = getNode(prev, undefined, true)
            moveDOMRef(keyedChunk.ref, target.parentNode, target)
          }
          return keyedChunk
        }
      } else if (isChunk(prev) && prev.s?.[1] === renderable.h) {
        if (prev.s[0] !== renderable.p) prev.s[0] = renderable.p
        if (prev.k !== renderable.k) {
          forgetChunk(prev)
          prev.k = renderable.k
          if (prev.k !== undefined) keyedChunks[prev.k] = prev
        }
        return prev
      }
      const [fragment, chunk] = renderComponent(renderable)
      getNode(prev, anchor).after(fragment)
      forgetChunk(prev)
      unmount(prev)
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return chunk
    }
    if (!isTpl(renderable) && nodeType === 3) {
      const value = renderText(renderable)
      if ((prev as Text).data !== value) (prev as Text).data = value
      return prev
    }
    if (isTpl(renderable)) {
      const chunk = renderable._c()
      if (chunk.k !== undefined && chunk.k in keyedChunks) {
        const keyedChunk = keyedChunks[chunk.k]
        if (keyedChunk === prev) return prev
        if (anchor) {
          moveDOMRef(keyedChunk.ref, anchor.parentNode, anchor.nextSibling)
        } else {
          const target = getNode(prev, undefined, true)
          moveDOMRef(keyedChunk.ref, target.parentNode, target)
        }
        return keyedChunk
      } else if (isChunk(prev) && prev.paths === chunk.paths) {
        updateExpressions(chunk._t._e, prev._t._e)
        if (chunk._t !== prev._t) (chunk._t as InternalTemplate).x?.()
        return prev
      }
      getNode(prev, anchor).after(renderable())
      forgetChunk(prev)
      unmount(prev)
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return chunk
    }
    const text = document.createTextNode(renderText(renderable))
    getNode(prev, anchor).after(text)
    forgetChunk(prev)
    unmount(prev)
    return text
  }

  function mountItem(
    item: string | number | boolean | ComponentCall | ArrowTemplate,
    fragment: DocumentFragment
  ): Rendered {
    if (isCmp(item)) {
      const [inner, chunk] = renderComponent(item)
      fragment.appendChild(inner)
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return chunk
    }
    if (isTpl(item)) {
      fragment.appendChild(item())
      const chunk = item._c()
      if (chunk.k !== undefined) keyedChunks[chunk.k] = chunk
      return chunk
    }
    const node = document.createTextNode(renderText(item))
    fragment.appendChild(node)
    return node
  }

  function forgetChunk(item: Chunk | Text | Rendered[] | undefined) {
    if (isChunk(item) && item.k !== undefined && keyedChunks[item.k] === item) {
      delete keyedChunks[item.k]
    }
  }

  function renderComponent(renderable: ComponentCall): [DocumentFragment, Chunk] {
    const [props, box] = createPropsProxy(renderable.p, renderable.h)
    const cleanups: Array<() => void> = []
    const previousCollector = swapCleanupCollector(cleanups)
    let template: InternalTemplate
    let fragment: DocumentFragment

    try {
      template = renderable.h(props) as InternalTemplate
      fragment = template() as DocumentFragment
    } finally {
      swapCleanupCollector(previousCollector)
    }

    const chunk = template._c()
    if (cleanups.length) {
      ;(chunk.u ??= []).push(...cleanups)
    }
    chunk.s = box
    chunk.k = renderable.k
    return [fragment, chunk]
  }

  return render
}

let unmountStack: Array<
  | Chunk
  | Text
  | ChildNode
  | Array<Chunk | Text | ChildNode>
> = []

const queueUnmount = queue(() => {
  const removeItems = (
    chunk:
      | Chunk
      | Text
      | ChildNode
      | Array<Chunk | Text | ChildNode>
  ) => {
    if (isChunk(chunk)) {
      if (chunk.u) {
        for (let i = 0; i < chunk.u.length; i++) chunk.u[i]()
        chunk.u = null
      }
      let node = chunk.ref.f
      if (node) {
        const last = chunk.ref.l
        if (node === last) node.remove()
        else {
          while (node) {
            const next: ChildNode | null =
              node === last ? null : (node.nextSibling as ChildNode | null)
            node.remove()
            if (!next) break
            node = next
          }
        }
      }
      ;(chunk._t as InternalTemplate).d?.()
    } else if (Array.isArray(chunk)) {
      for (let i = 0; i < chunk.length; i++) removeItems(chunk[i])
    } else {
      chunk.remove()
    }
  }
  const stack = unmountStack
  unmountStack = []
  for (let i = 0; i < stack.length; i++) removeItems(stack[i])
})

function unmount(
  chunk:
    | Chunk
    | Text
    | ChildNode
    | Array<Chunk | Text | ChildNode>
    | undefined
) {
  if (!chunk) return
  unmountStack.push(chunk)
  queueUnmount()
}

function isEmpty(value: unknown): value is null | undefined | '' | false {
  return !value && value !== 0
}

function renderText(value: unknown) {
  return isEmpty(value) ? '' : (value as string)
}

function getNode(
  chunk: Chunk | Text | Array<Chunk | Text> | undefined,
  anchor?: ChildNode,
  first?: boolean
): ChildNode {
  if (!chunk && anchor) return anchor
  if (isChunk(chunk)) {
    return first ? chunk.ref.f || chunk.ref.l! : chunk.ref.l || chunk.ref.f || anchor!
  }
  if (Array.isArray(chunk)) {
    return getNode(chunk[first ? 0 : chunk.length - 1], anchor, first)
  }
  return chunk!
}

function adoptRenderedValue(
  value: Chunk | Text | Rendered[] | undefined,
  capture: HydrationCapture,
  map: NodeMap,
  visited: WeakSet<Chunk>
): Chunk | Text | Rendered[] | undefined {
  if (!value) return value
  if (isChunk(value)) {
    adoptCapturedChunk(capture, value, map, visited)
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      adoptRenderedValue(item, capture, map, visited)
    ) as Rendered[]
  }
  return (map.get(value) as Text | undefined) ?? value
}

export function createChunk(
  rawStrings: TemplateStringsArray | string[]
): Omit<Chunk, 'ref'> & { ref: DOMRef } {
  const cachedByRef = chunkMemoByRef.get(rawStrings)
  const memoized: ChunkProto =
    cachedByRef ??
    (() => {
      const memoKey = rawStrings.join(delimiterComment)
      const cached = chunkMemo[memoKey]
      if (cached) {
        chunkMemoByRef.set(rawStrings, cached)
        return cached
      }
      const template = document.createElement('template')
      template.innerHTML = memoKey
      const created = {
        template,
        paths: createPaths(template.content),
      }
      chunkMemoByRef.set(rawStrings, created)
      return (chunkMemo[memoKey] = created)
    })()
  const dom = memoized.template.content.cloneNode(true) as DocumentFragment
  const instance = Object.create(memoized) as Omit<Chunk, 'ref'> & { ref: DOMRef }
  instance.dom = dom
  instance.ref = {
    f: dom.firstChild as ChildNode | null,
    l: dom.lastChild as ChildNode | null,
  }
  return instance
}

export function createPaths(dom: DocumentFragment): Chunk['paths'] {
  const pathTape: number[] = []
  const attrNames: string[] = []
  const path: number[] = []
  const previous: number[] = []
  const pushPath = (attrName?: string) => {
    const pathLen = path.length
    const previousLen = previous.length
    const limit = pathLen < previousLen ? pathLen : previousLen
    let sharedDepth = 0
    while (sharedDepth < limit && previous[sharedDepth] === path[sharedDepth]) {
      sharedDepth++
    }
    pathTape.push(sharedDepth, pathLen - sharedDepth)
    for (let i = sharedDepth; i < pathLen; i++) pathTape.push(path[i])
    pathTape.push(attrName ? attrNames.push(attrName) : 0)
    previous.length = pathLen
    for (let i = 0; i < pathLen; i++) previous[i] = path[i]
  }
  const walk = (node: Node) => {
    if (node.nodeType === 1) {
      const attrs = (node as Element).attributes
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i]
        if (attr.value === delimiterComment) pushPath(attr.name)
      }
    } else if (node.nodeType === 8) {
      pushPath()
    }
    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      path.push(i)
      walk(children[i])
      path.pop()
    }
  }
  const children = dom.childNodes
  for (let i = 0; i < children.length; i++) {
    path.push(i)
    walk(children[i])
    path.pop()
  }
  return [pathTape, attrNames]
}

export function getPath(node: Node): number[] {
  const path: number[] = []
  while (node.parentNode) {
    const children = node.parentNode.childNodes
    for (let i = 0; i < children.length; i++) {
      if (children[i] === node) {
        path.unshift(i)
        break
      }
    }
    node = node.parentNode
  }
  return path
}
