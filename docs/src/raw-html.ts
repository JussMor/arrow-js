import { html } from '@arrow-js/core'

export function rawHtml(markup: string) {
  return html([markup])
}
