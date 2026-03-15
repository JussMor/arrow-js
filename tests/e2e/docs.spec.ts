import { expect, test } from '@playwright/test'

test('home page is server rendered without javascript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
  })
  const page = await context.newPage()

  await page.goto('/')

  await expect(page.locator('h1')).toHaveText('Reactivity without the Framework')
  await expect(page.locator('#async-flush')).toContainText(
    'Async child components flushed before this page was sent to the browser.'
  )

  await context.close()
})

test('docs page is server rendered without javascript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
  })
  const page = await context.newPage()

  await page.goto('/docs/')

  await expect(page.locator('#getting-started')).toHaveText('Getting Started')
  await expect(page.locator('nav.navigation')).toBeVisible()

  await context.close()
})

test('home page hydrates component state without remounting the app root', async ({
  page,
}) => {
  await trackAppRootReplacements(page)
  await page.goto('/')

  const probe = page.locator('#hydration-probe')
  const shell = page.locator('#hydration-probe-shell')

  await expect
    .poll(() => page.evaluate(() => window.__arrowAppReplaceChildrenCalls))
    .toBe(0)
  await expect(probe).toHaveText('Clicks: 0')
  await probe.click()
  await expect(probe).toHaveText('Clicks: 1')
  await shell.click()
  await expect(probe).toHaveText('Clicks: 1')
})

test('home page repairs a tampered async subtree without remounting the app root', async ({
  page,
}) => {
  await trackAppRootReplacements(page)
  await tamperDocument(page, '/', (html) =>
    html.replace(
      '<script type="module" src="/src/entry-client.js"></script>',
      '<script>document.getElementById("async-flush")?.remove()</script><script type="module" src="/src/entry-client.js"></script>'
    )
  )
  await page.goto('/')

  const probe = page.locator('#hydration-probe')

  await expect
    .poll(() => page.evaluate(() => window.__arrowAppReplaceChildrenCalls))
    .toBe(0)
  await expect(page.locator('#async-flush')).toContainText(
    'Async child components flushed before this page was sent to the browser.'
  )
  await probe.click()
  await expect(probe).toHaveText('Clicks: 1')
})

test('docs page hydrates navigation without remounting the app root', async ({
  page,
}) => {
  await trackAppRootReplacements(page)
  await page.goto('/docs/')

  const selection = page.locator('nav.navigation .selection')

  await expect
    .poll(() => page.evaluate(() => window.__arrowAppReplaceChildrenCalls))
    .toBe(0)
  await selection.click()
  await expect(selection).toHaveAttribute('data-is-open', 'true')
  await page.locator('article').click()
  await expect(selection).not.toHaveAttribute('data-is-open', 'true')
})

test('shared header shows icon controls and theme toggle works', async ({ page }) => {
  await page.goto('/docs/')

  await expect(page.locator('a[aria-label="GitHub"]')).toBeVisible()
  await expect(page.locator('a[aria-label="Follow on X"]')).toBeVisible()
  await expect(page.locator('.social-links li')).toHaveCount(4)

  const html = page.locator('html')
  const toggle = page.locator('#theme-toggle')

  await expect(html).toHaveAttribute('data-theme', 'light')
  await toggle.click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
})

async function trackAppRootReplacements(page) {
  await page.addInitScript(() => {
    const original = Element.prototype.replaceChildren
    window.__arrowAppReplaceChildrenCalls = 0

    Element.prototype.replaceChildren = function (...args) {
      if (this instanceof Element && this.id === 'app') {
        window.__arrowAppReplaceChildrenCalls += 1
      }

      return original.apply(this, args)
    }
  })
}

async function tamperDocument(page, pathname, mutate) {
  await page.route('**/*', async (route) => {
    const request = route.request()

    if (request.resourceType() !== 'document') {
      await route.fallback()
      return
    }

    const url = new URL(request.url())
    if (url.pathname !== pathname) {
      await route.fallback()
      return
    }

    const response = await route.fetch()
    const body = await response.text()

    await route.fulfill({
      response,
      body: mutate(body),
      headers: {
        ...response.headers(),
        'content-type': 'text/html; charset=utf-8',
      },
    })
  })
}
