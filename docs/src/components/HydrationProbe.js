import { component, html, reactive } from '@src/index'

const StableCounter = component(() => {
  const state = reactive({
    clicks: 0,
  })

  return html`
    <button
      id="hydration-probe"
      class="button"
      @click="${() => {
        state.clicks += 1
      }}"
    >
      Clicks: ${() => state.clicks}
    </button>
  `
})

const ProbeFrame = component(() => {
  const shell = reactive({
    emphasized: false,
  })

  return html`
    <section
      class="key-commitments"
      data-shell-state="${() => (shell.emphasized ? 'expanded' : 'steady')}"
    >
      <h2 id="hydration-probe-heading">Hydration Probe</h2>
      <p>
        This uses Arrow components with stable slots. The counter should stay
        mounted and keep its local state when the parent rerenders after hydration.
      </p>
      <div class="actions">
        ${StableCounter()}
        <button
          id="hydration-probe-shell"
          class="button button--hollow"
          @click="${() => {
            shell.emphasized = !shell.emphasized
          }}"
        >
          Toggle shell
        </button>
      </div>
    </section>
  `
})

export default function HydrationProbe() {
  return ProbeFrame()
}
