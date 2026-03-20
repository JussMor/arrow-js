import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProduction = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT ?? 5173)

const templatePath = path.resolve(__dirname, 'index.html')
const clientDistPath = path.resolve(__dirname, 'dist/client')
const serverEntryPath = path.resolve(__dirname, 'dist/server/entry-server.js')

let vite = null

const server = http.createServer(async (request, response) => {
  const url = request.url ?? '/'

  try {
    if (vite) {
      await new Promise((resolve, reject) => {
        vite.middlewares(request, response, (error) => {
          if (error) reject(error)
          else resolve(undefined)
        })
      })

      if (response.writableEnded || response.headersSent) {
        return
      }
    }

    const staticFile = await resolveStaticFile(url)

    if (staticFile) {
      await serveStaticFile(staticFile, response)
      return
    }

    if (!isDocumentRequest(request)) {
      response.writeHead(404, {
        'Content-Type': 'text/plain',
      })
      response.end('Not found')
      return
    }

    let template
    let renderPage

    if (isProduction) {
      template = await fs.readFile(path.resolve(clientDistPath, 'index.html'), 'utf8')
      ;({ renderPage } = await import(pathToFileURL(serverEntryPath).href))
    } else {
      template = await fs.readFile(templatePath, 'utf8')
      template = await vite.transformIndexHtml(url, template)
      ;({ renderPage } = await vite.ssrLoadModule('/src/entry-server.ts'))
    }

    const page = await renderPage(url)
    const html = template
      .replace('<!--app-head-->', page.head ?? '')
      .replace('<!--app-html-->', page.html)
      .replace('<!--app-payload-->', page.payloadScript ?? '')

    response.writeHead(page.status, {
      'Content-Type': 'text/html',
    })
    response.end(html)
  } catch (error) {
    if (vite && error instanceof Error) {
      vite.ssrFixStacktrace(error)
    }

    response.writeHead(500, {
      'Content-Type': 'text/plain',
    })
    response.end(error instanceof Error ? error.stack ?? error.message : String(error))
  }
})

if (!isProduction) {
  vite = await createViteServer({
    root: __dirname,
    appType: 'custom',
    server: {
      middlewareMode: true,
      hmr: {
        server,
        clientPort: port,
      },
    },
  })
}

server.listen(port, '127.0.0.1', () => {
  console.log(`Arrow app running at http://127.0.0.1:${port}`)
})

async function resolveStaticFile(url) {
  const pathname = new URL(url, 'http://arrow.local').pathname

  if (pathname === '/' || !/\.[a-z0-9]+$/i.test(pathname)) {
    return null
  }

  const candidates = [
    path.resolve(clientDistPath, `.${pathname}`),
    path.resolve(clientDistPath, `.${pathname}/index.html`),
  ]

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate)
      if (stats.isFile()) {
        return candidate
      }
    } catch {}
  }

  return null
}

async function serveStaticFile(filePath, response) {
  const body = await fs.readFile(filePath)

  response.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
  })
  response.end(body)
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.css')) return 'text/css'
  if (filePath.endsWith('.js')) return 'application/javascript'
  if (filePath.endsWith('.mjs')) return 'application/javascript'
  if (filePath.endsWith('.html')) return 'text/html'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

function isDocumentRequest(request) {
  const method = request.method ?? 'GET'

  if (method !== 'GET' && method !== 'HEAD') {
    return false
  }

  const pathname = new URL(request.url ?? '/', 'http://arrow.local').pathname
  if (
    pathname.startsWith('/@') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/') ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return false
  }

  const destination = request.headers['sec-fetch-dest']
  if (destination && destination !== 'document' && destination !== 'empty') {
    return false
  }

  const accept = request.headers.accept ?? ''
  return !accept || accept.includes('text/html') || accept.includes('*/*')
}
