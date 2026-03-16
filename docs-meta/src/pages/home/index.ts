import { html } from '@arrow-js/core'
import { Hero } from './Hero'
import { Navigation } from '../docs/Navigation'
import {
  WhatIsArrow,
  Quickstart,
  Components,
  ReactiveData,
  WatchingData,
  Templates,
  ServerRendering,
  Examples,
} from '../docs/content'

export function HomePage() {
  return html`
    <div>
      ${Hero()}

      <div class="max-w-7xl mx-auto px-6 pt-20 pb-12">
        <div class="flex gap-12">
          ${Navigation()}
          <article class="min-w-0 max-w-3xl flex-1">
            ${WhatIsArrow()} ${Quickstart()} ${Components()}

            <div
              class="border-t border-zinc-200 dark:border-zinc-800 my-12 pt-12"
            >
              <h2
                class="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-8"
              >
                API Reference
              </h2>
            </div>

            ${ReactiveData()} ${WatchingData()} ${Templates()}
            ${ServerRendering()} ${Examples()}
          </article>
        </div>
      </div>
    </div>
  `
}
