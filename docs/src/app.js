import { html } from '@src/index'
import { boundary } from '@arrow-js/framework'
import createDocsStore from '../store'
import footer from '../components/Footer'
import navigation from '../components/Navigation'
import gettingStarted from '../components/GettingStarted'
import changelog from '../components/Changelog'
import homeHero from '../components/home/hero'
import whyArrow from '../components/home/why'
import events from '../js/events'
import highlight from '../js/highlight'
import layout from './layout'
import createAsyncNote from './components/AsyncNote'
import HydrationProbe from './components/HydrationProbe'

function normalizePath(url) {
  const pathname =
    typeof url === 'string'
      ? new URL(url, 'http://arrow.local').pathname
      : url.pathname

  return pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
}

function createHomePage() {
  const asyncNote = createAsyncNote()

  return {
    title: 'ArrowJS - Reactive interfaces with no build tools & native JavaScript.',
    description:
      'ArrowJS is a tool for programming reactive interfaces using native JavaScript.',
    view: layout(
      html`
        <div class="container">
          ${homeHero()}
          ${boundary(asyncNote, { idPrefix: 'home-async' })}
          ${whyArrow()}
          ${boundary(HydrationProbe(), { idPrefix: 'home-probe' })}
        </div>
        ${footer()}
      `
    ),
    async enhance() {
      await highlight()
    },
  }
}

function createDocsPage() {
  const store = createDocsStore()

  return {
    title: 'ArrowJS • Docs',
    description:
      'Docs for ArrowJS, including reactive primitives, templates, and components.',
    view: layout(
      html`
        <div class="container">
          <div class="body-wrapper">
            ${boundary(navigation(store), { idPrefix: 'docs-nav' })}
            <article>
              ${gettingStarted()}
              ${boundary(HydrationProbe(), { idPrefix: 'docs-probe' })}
              ${changelog()}
            </article>
          </div>
        </div>
        ${footer()}
      `,
      true
    ),
    async enhance() {
      events(store)
      await highlight()
    },
  }
}

export function createPage(url) {
  const pathname = normalizePath(url)

  if (pathname === '/docs') {
    return createDocsPage()
  }

  return createHomePage()
}
