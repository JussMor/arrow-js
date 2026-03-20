export type SupportedLanguage =
  | 'js'
  | 'ts'
  | 'html'
  | 'shell'
  | 'json'
  | 'markdown'

export function normalizeLanguage(language: string | undefined): SupportedLanguage {
  const lang = (language ?? 'ts').replace('language-', '')

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
