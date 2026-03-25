import '@shikijs/twoslash/style-rich.css'
import type {
  LanguageRegistration,
  ShikiTransformer,
} from 'shiki'
import arrowTypes from '../play/arrow-types.d.ts?raw'
import arrowHtmlInjectionGrammar from '../../packages/vscode-arrow-html/syntaxes/arrowjs-html.injection.tmLanguage.json'
import arrowHtmlGrammar from '../../packages/vscode-arrow-html/syntaxes/arrowjs-html.tmLanguage.json'
import FrameworkExamples from './framework-examples'

const TWOSLASH_TYPES_PATH = '/arrow-docs.d.ts'
const TWOSLASH_REFERENCE = `/// <reference path="${TWOSLASH_TYPES_PATH}" />\n`
const TYPESCRIPT_CDN_PREFIX = 'https://playgroundcdn.typescriptlang.org/cdn/'
const SHIKI_THEMES = {
  light: 'github-light-high-contrast',
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

let highlighterLoader: ReturnType<typeof initHighlighter> | undefined
const ARROW_TEMPLATE_PUNCTUATION_SCOPES = [
  'punctuation.definition.template-expression',
  'punctuation.section.embedded',
]
const CUT_BEFORE = /^\/\/\s?---cut(?:-before)?---$/
const CUT_AFTER = /^\/\/\s?---cut-after---$/
const CUT_START = /^\/\/\s?---cut-start---$/
const CUT_END = /^\/\/\s?---cut-end---$/
type SupportedLanguage =
  | 'js'
  | 'ts'
  | 'html'
  | 'shell'
  | 'json'
  | 'markdown'

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

function getVisibleCodeLineFlags(source: string) {
  const lines = source.split('\n')
  const visible = new Array(lines.length).fill(true)
  let skipping = false
  let cutBeforeIndex = -1
  let cutAfterIndex = -1

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    if (CUT_BEFORE.test(trimmed)) {
      cutBeforeIndex = index
      visible[index] = false
      return
    }

    if (CUT_AFTER.test(trimmed)) {
      cutAfterIndex = index
      visible[index] = false
      return
    }

    if (CUT_START.test(trimmed)) {
      skipping = true
      visible[index] = false
      return
    }

    if (CUT_END.test(trimmed)) {
      skipping = false
      visible[index] = false
      return
    }

    if (skipping) {
      visible[index] = false
    }
  })

  if (cutBeforeIndex !== -1) {
    visible.fill(false, 0, cutBeforeIndex + 1)
  }

  if (cutAfterIndex !== -1) {
    visible.fill(false, cutAfterIndex)
  }

  return visible
}

function stripHiddenCodeLinesFromHtml(html: string, source: string) {
  if (!source.includes('---cut')) {
    return html
  }

  const wrapper = createCodeWrapper(html)

  if (!(wrapper instanceof HTMLElement)) {
    return html
  }

  const code = wrapper.querySelector('code')

  if (!(code instanceof HTMLElement)) {
    return html
  }

  const visibleLines = getVisibleCodeLineFlags(source)
  const renderedLines = Array.from(code.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.classList.contains('line')
  )

  renderedLines.forEach((line, index) => {
    if ((visibleLines[index] ?? true) && !line.textContent?.includes('---cut-')) {
      return
    }

    const nextSibling = line.nextSibling
    const previousSibling = line.previousSibling
    line.remove()

    if (nextSibling?.nodeType === Node.TEXT_NODE && nextSibling.textContent === '\n') {
      nextSibling.remove()
    } else if (
      previousSibling?.nodeType === Node.TEXT_NODE &&
      previousSibling.textContent === '\n'
    ) {
      previousSibling.remove()
    }
  })

  trimCodeWhitespace(wrapper)

  return wrapper.outerHTML
}

function normalizeLanguage(language: string): SupportedLanguage {
  const lang = language.replace('language-', '')

  switch (lang) {
    case 'javascript':
      return 'js'
    case 'typescript':
      return 'ts'
    case 'json':
      return 'json'
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'shell':
    case 'bash':
      return 'shell'
    default:
      return lang as SupportedLanguage
  }
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
    return stripHiddenCodeLinesFromHtml(highlighter.codeToHtml(code, options), code)
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

    return stripHiddenCodeLinesFromHtml(stripTwoslashReferenceLine(html), code)
  } catch (error) {
    return stripHiddenCodeLinesFromHtml(highlighter.codeToHtml(code, options), code)
  }
}

export default async function highlight() {
  const { highlighter, arrowTemplatePunctuationTransformer, twoslashTransformer } =
    await loadHighlighter()
  const codeBlocks = document.querySelectorAll('pre code[class*="language-"]')

  codeBlocks.forEach((block) => {
    const lang = normalizeLanguage(block.className)
    const pre = block.parentElement
    const codeBlock = pre?.closest('.code-block')
    const encodedSource = block.getAttribute('data-code-source')
    const code = encodedSource ? decodeURIComponent(encodedSource) : block.textContent || ''
    const enableTwoslash =
      !block.closest('[data-disable-twoslash="true"]')
    const html = renderCodeBlock(
      highlighter,
      arrowTemplatePunctuationTransformer,
      twoslashTransformer,
      code,
      lang,
      enableTwoslash
    )
    const wrapper = createCodeWrapper(html)

    if (wrapper) {
      pre?.replaceWith(wrapper)
    }

    if (codeBlock instanceof HTMLElement && wrapper?.classList.contains('twoslash')) {
      codeBlock.dataset.hasTwoslash = 'true'
    }
  })
}
