import { html } from '@arrow-js/core'
import { layout } from './layout'
import { HomePage } from './pages/home/index'

function createHomePage() {
  return {
    title: 'Arrow — Reactive UI in Pure JavaScript',
    description:
      'A < 3KB runtime with zero dependencies. Observable data, declarative DOM, and SSR built on platform primitives.',
    view: layout(HomePage()),
  }
}

export function createPage(url: string) {
  return createHomePage()
}
