import { component, html } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

type NotFoundProps = Record<PropertyKey, unknown> & {
  path: string
}

export const NotFound = component((props: Props<NotFoundProps>) =>
  html`<main class="not-found">
    <p class="eyebrow">404</p>
    <h1>Nothing lives at ${() => props.path}</h1>
    <p class="lede">
      Edit <code>src/app.ts</code> to add routes or wire this template into a
      larger app.
    </p>
    <a class="button" href="/">Back home</a>
  </main>`
)
