import { html } from '@arrow-js/core'
import { CopyPageMenu } from '../../components/CopyPageMenu'
import { Navigation } from './Navigation'
import {
  WhyArrow,
  Quickstart,
  Components,
  ReactiveData,
  WatchingData,
  Templates,
  ServerRendering,
  Routing,
  Examples,
} from './content'

export function DocsPage() {
  return html`
    <div class="max-w-7xl mx-auto px-6 py-12">
      <div class="flex gap-12">
        ${Navigation()}
        <article class="min-w-0 max-w-3xl flex-1">
          <div class="flex items-start justify-between gap-4 mb-8">
            <h1
              class="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white"
            >
              Documentation
            </h1>
            ${CopyPageMenu({ markdownPath: '/docs.md' })}
          </div>

          ${WhyArrow()} ${Quickstart()}

          <div
            class="border-t border-zinc-200 dark:border-zinc-800 my-12 pt-12"
          >
            <h1
              class="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-8"
            >
              Essentials
            </h1>
          </div>

          ${ReactiveData()} ${Templates()} ${Components()} ${WatchingData()}
          ${ServerRendering()} ${Routing()} ${Examples()}
        </article>
      </div>
    </div>
  `
}
