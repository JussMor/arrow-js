import type { ArrowTemplate } from '@arrow-js/core'
import type {
  LanguageRegistration,
  ShikiTransformer,
} from 'shiki'
import arrowTypes from '../play/arrow-types.d.ts?raw'
import arrowHtmlInjectionGrammar from '../../packages/vscode-arrow-html/syntaxes/arrowjs-html.injection.tmLanguage.json'
import arrowHtmlGrammar from '../../packages/vscode-arrow-html/syntaxes/arrowjs-html.tmLanguage.json'
import FrameworkExamples from './framework-examples'
import { normalizeLanguage } from './code-language'
import type { SupportedLanguage } from './code-language'

const TWOSLASH_TYPES_PATH = '/arrow-docs.d.ts'
const TWOSLASH_REFERENCE = `/// <reference path="${TWOSLASH_TYPES_PATH}" />\n`
const TYPESCRIPT_CDN_PREFIX = 'https://playgroundcdn.typescriptlang.org/cdn/'
const SHIKI_THEMES = {
  light: 'one-light',
  dark: 'one-dark-pro',
} as const
const TYPESCRIPT_OPTIONAL_LIBS = new Set([
  'lib.core.d.ts',
  'lib.core.es6.d.ts',
  'lib.core.es7.d.ts',
  'lib.es7.d.ts',
  'lib.es2022.sharedmemory.d.ts',
])
const TWOSLASH_COMPILER_OPTIONS = {
  lib: ['es2022', 'dom', 'dom.iterable'],
  strict: false,
  noImplicitAny: false,
  skipLibCheck: true,
}
const ARROW_HTML_LANGUAGE = {
  ...arrowHtmlInjectionGrammar,
  name: 'inline.arrowjs.html',
  embeddedLanguages: ['html', 'typescript'],
  injectTo: ['source.js', 'source.js.jsx', 'source.ts', 'source.tsx'],
  repository: {},
} satisfies LanguageRegistration
const ARROW_HTML_GRAMMAR = {
  ...arrowHtmlGrammar,
  name: 'text.html.arrowjs',
  embeddedLanguages: ['html', 'typescript'],
} satisfies LanguageRegistration
const ARROW_TEMPLATE_PUNCTUATION_SCOPES = [
  'punctuation.definition.template-expression',
  'punctuation.section.embedded',
]

interface HighlightBlockOptions {
  code: string
  lang: SupportedLanguage
  wrapperClass?: string
  enableTwoslash?: boolean
}

let highlighterLoader: ReturnType<typeof initHighlighter> | undefined

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function createCodeWrapper(html: string) {
  const template = document.createElement('template')
  template.innerHTML = html.trim()
  const wrapper = template.content.firstElementChild

  if (wrapper instanceof HTMLElement) {
    trimCodeWhitespace(wrapper)
  }

  return wrapper
}

function trimCodeWhitespace(wrapper: HTMLElement) {
  const code = wrapper.querySelector('code')

  if (!(code instanceof HTMLElement)) {
    return
  }

  while (
    code.firstChild?.nodeType === Node.TEXT_NODE &&
    !(code.firstChild.textContent || '').trim()
  ) {
    code.removeChild(code.firstChild)
  }

  while (
    code.lastChild?.nodeType === Node.TEXT_NODE &&
    !(code.lastChild.textContent || '').trim()
  ) {
    code.removeChild(code.lastChild)
  }

  trimRenderedCodeLines(code)
}

function trimRenderedCodeLines(code: HTMLElement) {
  while (isBlankCodeLine(code.firstElementChild)) {
    const nextSibling = code.firstElementChild?.nextSibling
    code.firstElementChild?.remove()
    if (nextSibling?.nodeType === Node.TEXT_NODE && nextSibling.textContent === '\n') {
      nextSibling.remove()
    }
  }

  while (isBlankCodeLine(code.lastElementChild)) {
    const previousSibling = code.lastElementChild?.previousSibling
    code.lastElementChild?.remove()
    if (previousSibling?.nodeType === Node.TEXT_NODE && previousSibling.textContent === '\n') {
      previousSibling.remove()
    }
  }
}

function isBlankCodeLine(node: Element | null) {
  return !!node?.classList.contains('line') && !(node.textContent || '').trim()
}

function stripTwoslashReferenceLine(html: string) {
  const wrapper = createCodeWrapper(html)

  if (!(wrapper instanceof HTMLElement)) {
    return html
  }

  const firstLine = wrapper.querySelector('.line')
  if (firstLine?.textContent?.includes(TWOSLASH_TYPES_PATH)) {
    firstLine.remove()
  }

  return wrapper.outerHTML
}

function hasArrowTemplatePunctuationScope(token: {
  explanation?: Array<{
    scopes: Array<{
      scopeName: string
    }>
  }>
}) {
  return token.explanation?.some((explanation) =>
    explanation.scopes.some((scope) =>
      ARROW_TEMPLATE_PUNCTUATION_SCOPES.some((pattern) =>
        scope.scopeName.includes(pattern)
      )
    )
  )
}

async function initHighlighter() {
  const [
    { createHighlighter },
    { createTransformerFactory, rendererRich },
    { createTwoslashFromCDN },
  ] = await Promise.all([
    import('shiki'),
    import('@shikijs/twoslash'),
    import('twoslash-cdn'),
  ])

  const highlighter = await createHighlighter({
    themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
    langs: [
      'js',
      'ts',
      'html',
      'shell',
      'json',
      'markdown',
      ARROW_HTML_LANGUAGE,
      ARROW_HTML_GRAMMAR,
    ],
  })

  const twoslashFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getRequestUrl(input)
    const fileName = url.slice(url.lastIndexOf('/') + 1)

    if (
      url.startsWith(TYPESCRIPT_CDN_PREFIX) &&
      TYPESCRIPT_OPTIONAL_LIBS.has(fileName)
    ) {
      return new Response('', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    const response = await fetch(input, init)

    if (response.ok || !url.startsWith(TYPESCRIPT_CDN_PREFIX) || response.status !== 404) {
      return response
    }

    return new Response('', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const twoslash = createTwoslashFromCDN({
    compilerOptions: TWOSLASH_COMPILER_OPTIONS,
    twoSlashOptionsOverrides: {
      compilerOptions: TWOSLASH_COMPILER_OPTIONS,
    },
    fetcher: twoslashFetch,
    fsMap: new Map([
      [TWOSLASH_TYPES_PATH, arrowTypes],
      ['/App.ts', FrameworkExamples.app],
      ['/app.ts', FrameworkExamples.app],
      ['/entry-server.ts', FrameworkExamples.server],
      ['/entry-client.ts', FrameworkExamples.client],
    ]),
  })

  await twoslash.init()

  const arrowTemplatePunctuationTransformer = {
    name: 'arrow-template-punctuation',
    span(
      hast,
      _line: number,
      _col: number,
      _lineElement,
      token
    ) {
      if (!hasArrowTemplatePunctuationScope(token)) {
        return
      }

      return this.addClassToHast(hast, 'arrow-template-punctuation')
    },
  } satisfies ShikiTransformer

  return {
    highlighter,
    arrowTemplatePunctuationTransformer,
    twoslashTransformer: createTransformerFactory(twoslash.runSync, rendererRich()),
  }
}

async function loadHighlighter() {
  if (!highlighterLoader) {
    highlighterLoader = initHighlighter()
  }
  return highlighterLoader
}

function renderCodeBlock(
  highlighter: Awaited<ReturnType<typeof initHighlighter>>['highlighter'],
  arrowTemplatePunctuationTransformer: Awaited<
    ReturnType<typeof initHighlighter>
  >['arrowTemplatePunctuationTransformer'],
  twoslashTransformer: Awaited<ReturnType<typeof initHighlighter>>['twoslashTransformer'],
  code: string,
  lang: SupportedLanguage,
  enableTwoslash: boolean
) {
  const options = {
    lang,
    themes: SHIKI_THEMES,
    defaultColor: false as const,
    includeExplanation: 'scopeName' as const,
    transformers: [arrowTemplatePunctuationTransformer],
  }

  if (lang !== 'ts' || !enableTwoslash) {
    return highlighter.codeToHtml(code, options)
  }

  try {
    const html = highlighter.codeToHtml(`${TWOSLASH_REFERENCE}${code}`, {
      ...options,
      transformers: [
        arrowTemplatePunctuationTransformer,
        twoslashTransformer({
          throws: true,
        }),
      ],
    })

    return stripTwoslashReferenceLine(html)
  } catch {
    return highlighter.codeToHtml(code, options)
  }
}

function decorateHighlightedWrapper(
  wrapper: Element | null | undefined,
  {
    code,
    lang,
    wrapperClass = 'code-block',
    enableTwoslash = true,
  }: HighlightBlockOptions
) {
  if (!(wrapper instanceof HTMLElement)) {
    return ''
  }

  const container = document.createElement('div')
  container.className = wrapperClass
  container.dataset.codeSource = encodeURIComponent(code)
  container.dataset.codeLang = lang
  if (!enableTwoslash) {
    container.dataset.disableTwoslash = 'true'
  }
  if (wrapper.classList.contains('twoslash')) {
    container.dataset.hasTwoslash = 'true'
  }
  container.append(wrapper)
  return container.outerHTML
}

export async function renderHighlightedCodeBlock(options: HighlightBlockOptions) {
  const { highlighter, arrowTemplatePunctuationTransformer, twoslashTransformer } =
    await loadHighlighter()
  const html = renderCodeBlock(
    highlighter,
    arrowTemplatePunctuationTransformer,
    twoslashTransformer,
    options.code,
    options.lang,
    options.enableTwoslash ?? true
  )

  return decorateHighlightedWrapper(createCodeWrapper(html), options)
}

export async function highlightCodeBlocks(root: ParentNode) {
  const { highlighter, arrowTemplatePunctuationTransformer, twoslashTransformer } =
    await loadHighlighter()
  const codeBlocks = root.querySelectorAll('pre code[class*="language-"]')

  codeBlocks.forEach((block) => {
    const lang = normalizeLanguage(block.className)
    const pre = block.parentElement
    const container = pre?.closest('.code-block, .hero-code')
    const encodedSource = block.getAttribute('data-code-source')
    const code = encodedSource ? decodeURIComponent(encodedSource) : block.textContent || ''
    const enableTwoslash = !block.closest('[data-disable-twoslash="true"]')
    const html = renderCodeBlock(
      highlighter,
      arrowTemplatePunctuationTransformer,
      twoslashTransformer,
      code,
      lang,
      enableTwoslash
    )
    const wrapper = createCodeWrapper(html)

    if (!(wrapper instanceof HTMLElement)) {
      return
    }

    if (container instanceof HTMLElement) {
      container.dataset.codeSource = encodeURIComponent(code)
      container.dataset.codeLang = lang
      if (wrapper.classList.contains('twoslash')) {
        container.dataset.hasTwoslash = 'true'
      }
    }

    pre?.replaceWith(wrapper)
  })
}

export async function renderHighlightedSection(section: () => ArrowTemplate) {
  const container = document.createElement('div')
  section()(container)
  await highlightCodeBlocks(container)
  return container.innerHTML
}
