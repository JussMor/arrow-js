import { html } from '@arrow-js/core'
import { CopyPageMenu } from '../../components/CopyPageMenu'
import { Hero } from './Hero'
import { ScrollSpyNav } from '../../components/ScrollSpyNav'
import type { NavGroup } from '../../components/ScrollSpyNav'
import {
  docsExampleMeta,
  playgroundExampleHref,
} from '../../../play/example-meta.js'
import {
  WhyArrow,
  Quickstart,
  Components,
  HighlightedComponents,
  ReactiveData,
  HighlightedReactiveData,
  WatchingData,
  HighlightedWatchingData,
  Templates,
  Routing,
  HighlightedTemplates,
  Examples,
  HighlightedExamples,
} from '../docs/content'

const homeNavGroups: NavGroup[] = [
  {
    title: 'Getting Started',
    items: [
      { id: 'why-arrow', label: 'Why Arrow' },
      { id: 'quick-start', label: 'Quickstart' },
    ],
  },
  {
    title: 'Essentials',
    items: [
      { id: 'reactive-data', label: 'Reactive Data' },
      { id: 'templates', label: 'Templates' },
      { id: 'components', label: 'Components' },
      { id: 'watching-data', label: 'Watching Data' },
      { id: 'routing', label: 'Routing' },
    ],
  },
  {
    title: 'Examples',
    items: [
      { id: 'examples', label: 'Overview' },
      ...docsExampleMeta.map((example) => ({
        label: example.title,
        href: playgroundExampleHref(example.id),
      })),
    ],
  },
]

export function HomePage(options: { highlightCode?: boolean } = {}) {
  const highlightCode = options.highlightCode !== false
  const nav = ScrollSpyNav(homeNavGroups)
  const ComponentsSection = highlightCode ? HighlightedComponents : Components
  const ReactiveDataSection = highlightCode ? HighlightedReactiveData : ReactiveData
  const WatchingDataSection = highlightCode ? HighlightedWatchingData : WatchingData
  const TemplatesSection = highlightCode ? HighlightedTemplates : Templates
  const ExamplesSection = highlightCode ? HighlightedExamples : Examples

  return html`
    <div>
      ${Hero({ highlightCode })} ${nav.mobile()}

      <div class="max-w-7xl mx-auto px-6 pt-20 pb-12">
        <div class="flex gap-12">
          ${nav.sidebar()}
          <article class="min-w-0 max-w-3xl flex-1">
            <div class="flex justify-end mb-4">
              ${CopyPageMenu({ markdownPath: '/docs.md' })}
            </div>
            ${WhyArrow()} ${Quickstart({ highlightCode })}
            ${ComponentsSection()} ${ReactiveDataSection()}
            ${WatchingDataSection()} ${TemplatesSection()}
            ${Routing()} ${ExamplesSection()}
          </article>
        </div>
      </div>
    </div>
  `
}
