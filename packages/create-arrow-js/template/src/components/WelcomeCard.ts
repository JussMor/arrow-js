import { component, html } from '@arrow-js/core'
import { loadWelcomeCard } from '../data/loadWelcomeCard'

export const WelcomeCard = component(async () => {
  const note = await loadWelcomeCard()

  return html`<section class="card card--accent">
    <p class="eyebrow eyebrow--muted">${note.eyebrow}</p>
    <h2>${note.title}</h2>
    <p class="card__copy">${note.copy}</p>
  </section>`
})
