import { type HighlighterGeneric, SpecialLanguage } from 'shiki/core'

import { AsyncInitializer } from './asyncInitializer'

export const DEFAULT_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'markdown']
export const DEFAULT_THEMES = ['one-light', 'material-theme-darker']

const shikiInitializer = new AsyncInitializer(async () => {
  const shiki = await import('shiki')
  return shiki
})

const highlighterInitializer = new AsyncInitializer(async () => {
  const shiki = await shikiInitializer.get()
  return shiki.createHighlighter({
    langs: DEFAULT_LANGUAGES,
    themes: DEFAULT_THEMES
  })
})

export async function getShiki() {
  return shikiInitializer.get()
}

export async function getHighlighter() {
  return highlighterInitializer.get()
}

export async function loadLanguageIfNeeded(
  highlighter: HighlighterGeneric<any, any>,
  language: string
): Promise<string> {
  const shiki = await getShiki()

  let loadedLanguage = language
  if (!highlighter.getLoadedLanguages().includes(language)) {
    try {
      if (['text', 'ansi'].includes(language)) {
        await highlighter.loadLanguage(language as SpecialLanguage)
      } else {
        const languageImportFn = shiki.bundledLanguages[language]
        const langData = await languageImportFn()
        await highlighter.loadLanguage(langData)
      }
    } catch (error) {
      await highlighter.loadLanguage('text')
      loadedLanguage = 'text'
    }
  }

  return loadedLanguage
}

export async function loadThemeIfNeeded(highlighter: HighlighterGeneric<any, any>, theme: string): Promise<string> {
  const shiki = await getShiki()

  let loadedTheme = theme
  if (!highlighter.getLoadedThemes().includes(theme)) {
    try {
      const themeImportFn = shiki.bundledThemes[theme]
      const themeData = await themeImportFn()
      await highlighter.loadTheme(themeData)
    } catch (error) {
      // 回退到 one-light
      console.debug(`Failed to load theme '${theme}', falling back to 'one-light':`, error)
      const oneLightTheme = await shiki.bundledThemes['one-light']()
      await highlighter.loadTheme(oneLightTheme)
      loadedTheme = 'one-light'
    }
  }

  return loadedTheme
}
