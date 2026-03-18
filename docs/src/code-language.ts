export type SupportedLanguage = 'js' | 'ts' | 'html' | 'shell'

export function normalizeLanguage(language: string): SupportedLanguage {
  const lang = language.replace('language-', '')

  switch (lang) {
    case 'javascript':
      return 'js'
    case 'typescript':
      return 'ts'
    case 'shell':
    case 'bash':
      return 'shell'
    default:
      return lang as SupportedLanguage
  }
}
