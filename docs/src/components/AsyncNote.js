import { html } from '@src/index'
import { asyncComponent } from '@arrow-js/framework'

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

const AsyncNote = asyncComponent(
  async () => {
    await sleep(20)

    return html`
      <p id="async-flush" class="manifesto">
        Async child components flushed before this page was sent to the browser.
      </p>
    `
  },
  {
    fallback: html`<p id="async-flush" hidden>Loading async content…</p>`,
    idPrefix: 'async-note',
  }
)

export default function createAsyncNote() {
  return AsyncNote()
}
