import { component } from '@arrow-js/core'
import type { ArrowTemplate } from '@arrow-js/core'
import { decodeCodeEntities } from '../code-entities'
import { rawHtml } from '../raw-html'
import { normalizeLanguage } from '../code-language'

export type CodeBlockProps = Record<PropertyKey, unknown> & {
  code: string
  lang: string
  wrapperClass?: string
  enableTwoslash?: boolean
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function PlainCodeBlock({
  code,
  lang,
  wrapperClass = 'code-block',
  enableTwoslash = true,
}: CodeBlockProps) {
  const decodedCode = decodeCodeEntities(code)
  const normalizedLanguage = normalizeLanguage(lang)
  const attrs = [
    `class="${escapeHtml(wrapperClass)}"`,
    `data-code-source="${encodeURIComponent(decodedCode)}"`,
    `data-code-lang="${normalizedLanguage}"`,
  ]

  if (!enableTwoslash) {
    attrs.push('data-disable-twoslash="true"')
  }

  return rawHtml(
    `<div ${attrs.join(' ')}><pre><code class="language-${normalizedLanguage}" data-code-source="${encodeURIComponent(decodedCode)}">${escapeHtml(decodedCode)}</code></pre></div>`
  )
}

const HighlightedCodeBlockComponent = component<
  CodeBlockProps,
  string | ArrowTemplate,
  string | undefined
>(
  async (props: CodeBlockProps) => {
    const decodedCode = decodeCodeEntities(props.code)

    if (!import.meta.env.SSR) {
      return PlainCodeBlock({ ...props, code: decodedCode })
    }

    const { renderHighlightedCodeBlock } = await import('../server-code-highlight')
    return renderHighlightedCodeBlock({
      code: decodedCode,
      lang: normalizeLanguage(props.lang),
      wrapperClass: props.wrapperClass,
      enableTwoslash: props.enableTwoslash,
    })
  },
  {
    idPrefix: 'code',
    serialize: (value) => typeof value === 'string' ? value : undefined,
    deserialize: (snapshot) => snapshot ?? '',
    render: (value) => typeof value === 'string' ? rawHtml(value) : value,
  }
)

export function CodeBlock(props: CodeBlockProps, highlighted = true) {
  return highlighted ? HighlightedCodeBlockComponent(props) : PlainCodeBlock(props)
}
