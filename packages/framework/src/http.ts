export interface DocumentRenderParts {
  head?: string
  html: string
  payloadScript?: string
}

export function renderDocument(template: string, parts: DocumentRenderParts) {
  return template
    .replace('<!--app-head-->', parts.head ?? '')
    .replace('<!--app-html-->', parts.html)
    .replace('<!--app-payload-->', parts.payloadScript ?? '')
}
