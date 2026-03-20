import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const docsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const clientDistDir = path.resolve(docsDir, 'dist/client')
const serverEntryPath = path.resolve(docsDir, 'dist/server/entry-server.js')
const staticDistDir = path.resolve(docsDir, 'dist/static')

const htmlRoutes = [
  ['/', 'index.html'],
  ['/api', 'api/index.html'],
]

const textRoutes = [
  ['docs.md', () => renderMarkdown('/')],
  ['api.md', () => renderMarkdown('/api')],
  ['play.md', () => renderPlayground()],
  ['llms.txt', () => renderLlms()],
]

const { renderLlms, renderMarkdown, renderPage, renderPlayground } = await import(
  pathToFileURL(serverEntryPath).href
)

const prerenderBaseUrl = resolvePrerenderBaseUrl()

await fs.rm(staticDistDir, { force: true, recursive: true })
await fs.cp(clientDistDir, staticDistDir, { recursive: true })

const template = await fs.readFile(path.resolve(clientDistDir, 'index.html'), 'utf8')

for (const [url, outputPath] of htmlRoutes) {
  const page = await renderPage(
    url,
    prerenderBaseUrl ? { baseUrl: prerenderBaseUrl } : undefined,
  )
  const html = template
    .replace('<!--app-head-->', page.head ?? '')
    .replace('<!--app-html-->', page.html)
    .replace('<!--app-payload-->', page.payloadScript ?? '')

  await writeOutput(outputPath, html)
}

for (const [outputPath, render] of textRoutes) {
  await writeOutput(outputPath, await render())
}

async function writeOutput(relativePath, content) {
  const outputPath = path.resolve(staticDistDir, relativePath)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, content)
}

function resolvePrerenderBaseUrl() {
  const candidates = [
    process.env.DOCS_SITE_URL,
    process.env.SITE_URL,
    process.env.CF_PAGES_URL,
    process.env.DEPLOY_URL,
    process.env.URL,
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      return new URL(candidate).origin
    } catch {
      try {
        return new URL(`https://${candidate}`).origin
      } catch {}
    }
  }

  return undefined
}
