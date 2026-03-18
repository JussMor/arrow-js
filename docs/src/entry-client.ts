import '@shikijs/twoslash/style-rich.css'
import { hydrate, readPayload } from '@arrow-js/hydrate'
import { createPage } from './app'

const payload = readPayload()
const root = document.getElementById('app')

if (!root) {
  throw new Error('Unable to find hydration root "app".')
}

const page = await createPage(window.location.pathname)

await hydrate(root, page.view, payload)

// Fix twoslash popups: use position:fixed so they escape overflow:auto parents
document.addEventListener('mouseenter', (e) => {
  const hover = (e.target as Element).closest?.('.twoslash-hover')
  if (!hover) return
  const popup = hover.querySelector('.twoslash-popup-container') as HTMLElement
  if (!popup) return
  const rect = hover.getBoundingClientRect()
  const maxLeft = window.innerWidth - Math.min(popup.offsetWidth, 540) - 16
  popup.style.position = 'fixed'
  popup.style.left = `${Math.max(8, Math.min(rect.left, maxLeft))}px`
  popup.style.top = `${rect.bottom + 4}px`
  popup.style.transform = 'none'
}, true)

const hero = document.getElementById('hero')
if (hero) {
  const canLoadCharacterRain =
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    navigator.connection?.saveData !== true

  if (canLoadCharacterRain) {
    const loadCharacterRain = async () => {
      const { initCharacterRain } = await import('./character-rain')
      initCharacterRain(hero)
    }

    const scheduleCharacterRain = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          void loadCharacterRain()
        }, { timeout: 1500 })
        return
      }

      window.setTimeout(() => {
        void loadCharacterRain()
      }, 500)
    }

    if (document.readyState === 'complete') {
      scheduleCharacterRain()
    } else {
      window.addEventListener('load', scheduleCharacterRain, { once: true })
    }
  }
}
