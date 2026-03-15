import { describe, expect, it } from 'vitest'
import { nextTick } from '@arrow-js/core'
import { hydrate } from '@arrow-js/hydrate'
import { renderToString } from '@arrow-js/ssr'
import { createPage } from '../docs/src/app'

describe('docs hydration', () => {
  it('renders the shared header controls in SSR output', async () => {
    const page = createPage('/docs/')
    const ssr = await renderToString(page.view)

    expect(ssr.html).toContain('aria-label="GitHub"')
    expect(ssr.html).toContain('aria-label="Follow on X"')
    expect(ssr.html).toContain('class="github-button"')
    expect(ssr.html).toContain('id="theme-toggle"')
  })

  it('adopts the home page without replacing the root', async () => {
    const { result, existing, root } = await hydratePage('/')

    expect(result.adopted).toBe(true)
    expect(root.firstElementChild).toBe(existing)
  })

  it('adopts the docs page without replacing the root', async () => {
    const { result, existing, root } = await hydratePage('/docs/')

    expect(result.adopted).toBe(true)
    expect(root.firstElementChild).toBe(existing)
  })

  it('repairs a missing async note on the home page without replacing intact siblings', async () => {
    const root = document.createElement('div')
    const serverPage = createPage('/')
    const ssr = await renderToString(serverPage.view)
    root.innerHTML = ssr.html

    const existingHero = root.querySelector('.the-home-hero')
    root.querySelector('#async-flush')?.remove()

    const clientPage = createPage('/')
    const result = await hydrate(root, clientPage.view, ssr.payload)

    expect(result.adopted).toBe(true)
    expect(result.mismatches).toBeGreaterThan(0)
    expect(root.querySelector('.the-home-hero')).toBe(existingHero)
    expect(root.querySelector('#async-flush')?.textContent).toContain(
      'Async child components flushed before this page was sent to the browser.'
    )

    ;(root.querySelector('#hydration-probe') as HTMLButtonElement).click()
    await nextTick()

    expect(root.querySelector('#hydration-probe')?.textContent).toContain('Clicks: 1')
  })
})

async function hydratePage(path: string) {
  const root = document.createElement('div')
  const serverPage = createPage(path)
  const ssr = await renderToString(serverPage.view)
  root.innerHTML = ssr.html

  const existing = root.firstElementChild
  const clientPage = createPage(path)
  const result = await hydrate(root, clientPage.view, ssr.payload)

  return {
    root,
    existing,
    result,
  }
}
