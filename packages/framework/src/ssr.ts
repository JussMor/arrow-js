import { JSDOM } from 'jsdom'
import { render } from './render'
import { withDomWindow } from './dom'

export interface HydrationPayload {
  html?: string
  rootId?: string
  async?: Record<string, unknown>
  boundaries?: string[]
}

export interface SsrRenderOptions {
  rootId?: string
}

export interface SsrRenderResult {
  html: string
  payload: HydrationPayload
}

export async function renderToString(
  view: unknown,
  options: SsrRenderOptions = {}
): Promise<SsrRenderResult> {
  const rootId = options.rootId ?? 'app'
  const dom = new JSDOM(`<!doctype html><div id="${rootId}"></div>`, {
    url: 'http://arrow.local/',
  })
  const root = dom.window.document.getElementById(rootId)

  if (!root) {
    throw new Error(`SSR root "${rootId}" was not created.`)
  }

  const result = await withDomWindow(dom.window, async () => render(root, view))
  const html = root.innerHTML

  return {
    html,
    payload: {
      rootId,
      html,
      async: result.payload.async,
      boundaries: result.payload.boundaries,
    },
  }
}

export function serializePayload(payload: unknown, id = 'arrow-ssr-payload') {
  return `<script id="${id}" type="application/json">${escapeJson(
    JSON.stringify(payload)
  )}</script>`
}

function escapeJson(value: string) {
  return value.replace(/</g, '\\u003c')
}
