import { hydrate, readPayload } from '@arrow-js/hydrate'
import { createPage } from './app'
import highlight from './highlight'

const payload = readPayload()
const root = document.getElementById('app')

if (!root) {
  throw new Error('Unable to find hydration root "app".')
}

await hydrate(root, createPage(window.location.pathname).view, payload)
await highlight()

const hero = document.getElementById('hero')
if (hero) {
  const { initCharacterRain } = await import('./character-rain')
  initCharacterRain(hero)
}
