import { component } from '@arrow-js/core'
import type { ArrowTemplate } from '@arrow-js/core'
import { rawHtml } from '../raw-html'

export function highlightedSection(section: () => ArrowTemplate, idPrefix: string) {
  const HighlightedSection = component<
    Record<string, never>,
    string | ArrowTemplate,
    string | undefined
  >(
    async () => {
      if (!import.meta.env.SSR) {
        return section()
      }

      const { renderHighlightedSection } = await import('../server-code-highlight')
      return renderHighlightedSection(section)
    },
    {
      idPrefix,
      serialize: (value) => typeof value === 'string' ? value : undefined,
      deserialize: (snapshot) => snapshot ?? '',
      render: (value) => typeof value === 'string' ? rawHtml(value) : value,
    }
  )

  return () => HighlightedSection({})
}
