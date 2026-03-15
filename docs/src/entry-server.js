import { renderToString, serializePayload } from '@arrow-js/ssr'
import { createPage } from './app'

function renderHead(page) {
  return [
    `<title>${page.title}</title>`,
    `<meta name="description" content="${page.description}" />`,
  ].join('')
}

export async function renderPage(url) {
  const page = createPage(url)
  const result = await renderToString(page.view)

  return {
    html: result.html,
    head: renderHead(page),
    payloadScript: serializePayload({
      ...result.payload,
      path: url,
    }),
    status: 200,
  }
}
