import { component, html, reactive } from '@arrow-js/core'
import type { Props } from '@arrow-js/core'

export const CounterCard = component((props: Props<Record<string, unknown>>) => {
  const local = reactive({
    clicks: 0,
  })

  return html`<section class="card card--contrast">
    <div class="card__header">
      <p class="eyebrow eyebrow--muted">Hydrated component</p>
      <strong class="counter-value">${() => props.count as number}</strong>
    </div>

    <p class="card__copy">
      Shared state updates this card immediately, while the local click count
      stays attached to this component instance.
    </p>

    <div class="button-row">
      <button class="button" @click="${() => { props.count = (props.count as number) - 1 }}">
        Decrement
      </button>
      <button class="button" @click="${() => { props.count = (props.count as number) + 1 }}">
        Increment
      </button>
      <button class="button button--ghost" @click="${() => local.clicks++}">
        Local clicks ${() => local.clicks}
      </button>
    </div>
  </section>`
})
