import '../js/colorMode.js'
import { hydrate, readPayload } from '@arrow-js/hydrate'
import { createPage } from './app'

const payload = readPayload()
const page = createPage(window.location.pathname)
const rootId = payload.rootId ?? 'app'
const root = document.getElementById(rootId)

if (!root) {
  throw new Error(`Unable to find hydration root "${rootId}".`)
}

await hydrate(root, page.view, payload, {
  onMismatch(details) {
    console.warn('Arrow hydration mismatch detected, falling back to client render.', details)
  },
})

await page.enhance?.()
