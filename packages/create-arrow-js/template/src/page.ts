import '@arrow-js/framework'

import { App } from './App'
import { NotFound } from './components/NotFound'

export interface Page {
  description: string
  status: number
  title: string
  view: unknown
}

const homePage = {
  description: 'An Arrow starter with Vite 8 SSR, hydration, and async components.',
  title: 'Arrow App',
}

export function routeToPage(url: string): Page {
  const pathname = new URL(url, 'http://arrow.local').pathname

  if (pathname === '/' || pathname === '') {
    return {
      ...homePage,
      status: 200,
      view: App(),
    }
  }

  return {
    description: `There is no route for ${pathname}.`,
    status: 404,
    title: 'Not Found | Arrow App',
    view: NotFound({ path: pathname }),
  }
}
