import { component, html } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

interface FeatureItem {
  id: number
  label: string
}

type FeatureListProps = Record<PropertyKey, unknown> & {
  items: FeatureItem[]
}

export const FeatureList = component((props: Props<FeatureListProps>) =>
  html`<section class="card">
    <p class="eyebrow">Starter shape</p>
    <h2>What is already wired up</h2>
    <ul class="feature-list">
      ${() =>
        props.items.map((item) => html`<li>${item.label}</li>`.key(item.id))}
    </ul>
  </section>`
)
