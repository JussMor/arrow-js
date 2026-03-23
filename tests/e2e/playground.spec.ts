import { expect, test, type Page } from '@playwright/test'
import {
  playgroundExampleHref,
  playgroundExampleMeta,
  starterExampleId,
} from '../../docs/play/example-meta.js'

const PLAYGROUND_RENDER_TIMEOUT = 15_000

async function emulateIosShareEnvironment(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      get: () => 'iPhone',
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      get: () => 5,
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => undefined,
    })

    ;(window as any).__copiedText = ''
    ;(window as any).__openCalls = []
    ;(window as any).__popupUrl = ''
    ;(window as any).__popupClosed = false

    document.execCommand = (command) => {
      const textarea = document.querySelector('textarea[readonly]')
      ;(window as any).__copiedText =
        textarea instanceof HTMLTextAreaElement ? textarea.value : ''
      return command === 'copy'
    }

    window.open = ((...args) => {
      ;(window as any).__openCalls.push(args.map((value) => String(value ?? '')))
      return {
        close() {
          ;(window as any).__popupClosed = true
        },
        location: {
          replace(url: string) {
            ;(window as any).__popupUrl = String(url)
          },
        },
      }
    }) as typeof window.open
  })
}

test('playground loads the starter multi-file example', async ({ page }) => {
  const messages: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      messages.push(msg.text())
    }
  })

  await page.goto(playgroundExampleHref(starterExampleId))

  await expect(page.locator('.play-file-name')).toHaveText([
    'main.ts',
    'App.ts',
    'CounterPanel.ts',
    'styles.css',
  ])

  const preview = page.frameLocator('#play-preview')

  await expect
    .poll(() => preview.locator('#runtime-error').getAttribute('data-active'), {
      timeout: PLAYGROUND_RENDER_TIMEOUT,
    })
    .toBe('false')
  await expect
    .poll(() =>
      preview
        .locator('#app')
        .evaluate((node) => node.childNodes.length > 0),
      {
        timeout: PLAYGROUND_RENDER_TIMEOUT,
      }
    )
    .toBe(true)

  expect(messages).toEqual([])
})

test('playground loads every registered example by direct url', async ({ page }) => {
  const preview = page.frameLocator('#play-preview')

  expect(playgroundExampleMeta.length).toBeGreaterThan(6)

  for (const example of playgroundExampleMeta) {
    await page.goto(playgroundExampleHref(example.id))

    await expect(page.locator('.play-file-name')).not.toHaveCount(0)
    await expect
      .poll(() => preview.locator('#runtime-error').getAttribute('data-active'), {
        timeout: PLAYGROUND_RENDER_TIMEOUT,
      })
      .toBe('false')
    await expect
      .poll(() =>
        preview
          .locator('#app')
          .evaluate((node) => node.childNodes.length > 0),
        {
          timeout: PLAYGROUND_RENDER_TIMEOUT,
        }
      )
      .toBe(true)
  }
})

test('playground makes @arrow-js/sandbox available by import', async ({ page }) => {
  await page.goto(playgroundExampleHref(starterExampleId))

  const preview = page.frameLocator('#play-preview')
  await expect
    .poll(() => Boolean(page.frame({ url: /\/play\/preview\.html/ })))
    .toBe(true)

  await expect
    .poll(() => preview.locator('#runtime-error').getAttribute('data-active'))
    .toBe('false')

  await expect(preview.locator('#sandbox-counter')).toHaveCount(0)

  await page.waitForFunction(() => Boolean((window as any).monaco?.editor))
  await page.evaluate(() => {
    const model = (window as any).monaco.editor
      .getModels()
      .find((entry: { uri: { path: string } }) => entry.uri.path.endsWith('/main.ts'))

    if (!model) {
      throw new Error('main.ts model was not found.')
    }

    model.setValue(
      [
        "import { html } from '@arrow-js/core'",
        "import { sandbox } from '@arrow-js/sandbox'",
        '',
        "const root = document.getElementById('app')",
        '',
        "if (!root) {",
        "  throw new Error('Missing #app root')",
        '}',
        '',
        'const source = {',
        "  'main.ts': `const state = reactive({ count: 0 })",
        '',
        'export default html\\`<button id="sandbox-counter" @click="\\${() => state.count++}">',
        '  Count \\${() => state.count}',
        '</button>\\``,',
        '}',
        '',
        'html`<section>${sandbox({ source, shadowDOM: false })}</section>`(root)',
      ].join('\n')
    )
  })

  await expect
    .poll(() => preview.locator('#runtime-error').getAttribute('data-active'), {
      timeout: PLAYGROUND_RENDER_TIMEOUT,
    })
    .toBe('false')
  await expect(preview.locator('#sandbox-counter')).toHaveText('Count 0', {
    timeout: PLAYGROUND_RENDER_TIMEOUT,
  })

  await preview.locator('#sandbox-counter').click()
  await expect(preview.locator('#sandbox-counter')).toHaveText('Count 1', {
    timeout: PLAYGROUND_RENDER_TIMEOUT,
  })
})

test('playground copy url falls back to synchronous copy on iOS browsers', async ({ page }) => {
  await emulateIosShareEnvironment(page)
  await page.goto(playgroundExampleHref(starterExampleId))

  const copyButton = page.getByRole('button', { name: 'Copy URL' }).first()
  await copyButton.click()

  await expect
    .poll(() =>
      page.evaluate(() => ({
        copiedText: (window as any).__copiedText,
        href: window.location.href,
      }))
    )
    .toEqual({
      copiedText: page.url(),
      href: page.url(),
    })
})

test('playground github issue opens a popup before navigating on iOS browsers', async ({
  page,
}) => {
  await emulateIosShareEnvironment(page)
  await page.goto(playgroundExampleHref(starterExampleId))

  await page.locator('.play-copy-toggle').click()
  await page.getByRole('button', { name: /Open GitHub Issue/ }).click()

  await expect
    .poll(() =>
      page.evaluate(() => ({
        openCall: (window as any).__openCalls[0] ?? null,
        popupUrl: (window as any).__popupUrl,
      }))
    )
    .toEqual({
      openCall: ['about:blank', '_blank'],
      popupUrl:
        `https://github.com/standardagents/arrow-js/issues/new?labels=playground&body=${encodeURIComponent(`Describe the issue…\n\nPlayground: ${page.url()}`)}`,
    })
})
