/**
 * Cloudflare Worker for Arrow playground URL shortening.
 *
 * POST /api/play  { snapshot: string }  → { id: string }
 * GET  /api/play/:id                    → { snapshot: string }
 *
 * Snapshots are content-addressed: SHA-256 hash truncated to 32 hex chars.
 * Duplicate content always produces the same ID with no extra KV writes.
 */

export interface Env {
  PLAY_KV: PlayKvNamespace
  ASSETS?: AssetBinding
}

interface PlayKvNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

interface AssetBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface HtmlRewriterElement {
  setAttribute(name: string, value: string): void
}

interface HtmlRewriter {
  on(
    selector: string,
    handlers: { element(element: HtmlRewriterElement): void }
  ): HtmlRewriter
  transform(response: Response): Response
}

declare const HTMLRewriter: {
  new (): HtmlRewriter
}

const HASH_LENGTH = 32
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const HTML_ENTRY_REDIRECTS = new Map([
  ['/docs', '/'],
  ['/docs/', '/'],
  ['/play', '/play/'],
  ['/play/preview', '/play/preview.html'],
  ['/play/preview/', '/play/preview.html'],
])

async function contentHash(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex.slice(0, HASH_LENGTH)
}

async function handleSave(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await request.json() as { snapshot?: unknown }
  if (!body?.snapshot || typeof body.snapshot !== 'string') {
    return Response.json(
      { error: 'Missing snapshot field' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const id = await contentHash(body.snapshot)
  const existing = await env.PLAY_KV.get(id)

  if (!existing) {
    await env.PLAY_KV.put(id, body.snapshot)
  }

  return Response.json({ id }, { headers: CORS_HEADERS })
}

async function handleLoad(
  id: string,
  env: Env,
): Promise<Response> {
  const snapshot = await env.PLAY_KV.get(id)
  if (!snapshot) {
    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: CORS_HEADERS },
    )
  }

  return Response.json({ snapshot }, { headers: CORS_HEADERS })
}

function redirectHtmlEntry(request: Request): Response | null {
  if (!isDocumentRequest(request)) {
    return null
  }

  const url = new URL(request.url)
  const targetPath = HTML_ENTRY_REDIRECTS.get(url.pathname)
  if (!targetPath) {
    return null
  }

  url.pathname = targetPath
  return Response.redirect(url.toString(), 302)
}

function isDocumentRequest(request: Request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return false
  }

  const destination = request.headers.get('sec-fetch-dest')
  if (destination && destination !== 'document' && destination !== 'empty') {
    return false
  }

  const accept = request.headers.get('accept') ?? ''
  return !accept || accept.includes('text/html') || accept.includes('*/*')
}

function normalizeMetadataPath(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/'
}

function rewriteMetadata(request: Request, response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) {
    return response
  }

  const url = new URL(request.url)
  const canonicalUrl = `${url.origin}${normalizeMetadataPath(url.pathname)}`

  return new HTMLRewriter()
    .on('link[rel="canonical"]', {
      element(element) {
        element.setAttribute('href', canonicalUrl)
      },
    })
    .on('meta[property="og:url"]', {
      element(element) {
        element.setAttribute('content', canonicalUrl)
      },
    })
    .transform(response)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const redirect = redirectHtmlEntry(request)

    if (redirect) {
      return redirect
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method === 'POST' && url.pathname === '/api/play') {
      return handleSave(request, env)
    }

    const loadMatch = url.pathname.match(/^\/api\/play\/([a-f0-9]+)$/)
    if (request.method === 'GET' && loadMatch) {
      return handleLoad(loadMatch[1], env)
    }

    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request)

      if (isDocumentRequest(request)) {
        return rewriteMetadata(request, response)
      }

      return response
    }

    return new Response('Not found', { status: 404 })
  },
}
