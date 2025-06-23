import { useTheme } from '@renderer/context/ThemeProvider'
import { ThemeMode } from '@renderer/types'
import { useEffect, useState } from 'react'

// 跟踪 mermaid 模块状态，单例模式
let mermaidModule: any = null
let mermaidLoading = false
let mermaidLoadPromise: Promise<any> | null = null

/**
 * 导入 mermaid 库
 */
const loadMermaidModule = async () => {
  if (mermaidModule) return mermaidModule
  if (mermaidLoading && mermaidLoadPromise) return mermaidLoadPromise

  mermaidLoading = true
  mermaidLoadPromise = import('mermaid')
    .then((module) => {
      mermaidModule = module.default || module
      mermaidLoading = false
      return mermaidModule
    })
    .catch((error) => {
      mermaidLoading = false
      throw error
    })

  return mermaidLoadPromise
}

export const useMermaid = () => {
  const { theme } = useTheme()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 初始化 mermaid 并监听主题变化
  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        setIsLoading(true)

        const mermaid = await loadMermaidModule()

        if (!mounted) return

        // Custom theme variables to override the yellow colors
        const customThemeVariables = {
          primaryColor: '#799CE5',        // Lighter blue (40% lighter than #3B78D7)
          primaryBorderColor: '#3B78D7',  // Original blue for borders
          primaryTextColor: '#000000',    // Black text for contrast
          noteBkgColor: '#B7C0F3',       // Very light blue (80% lighter) for notes
          noteBorderColor: '#5A8ADE',     // Medium light blue for note borders
          tertiaryColor: '#E8F2FF',      // Very light blue for cluster backgrounds
          secondaryColor: '#F68e32',     // Light orange (80% lighter than #E67E22)
          secondaryBorderColor: '#E67E22', // Original orange for secondary borders
          fontSize: '16px',              // Larger font size
          fontWeight: 'bold',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }

        mermaid.initialize({
          startOnLoad: false, // 禁用自动启动
          theme: theme === ThemeMode.dark ? 'dark' : 'base', // Use 'base' theme for customization
          themeVariables: theme === ThemeMode.dark ? {} : customThemeVariables, // Apply custom colors in light mode
          flowchart: {
            defaultDirection: 'TD', // Top-Down (vertical) by default - can be overridden per diagram
            htmlLabels: true,
            curve: 'basis'
          },
          fontSize: 16, // Global font size
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        })

        setError(null)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to initialize Mermaid')
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [theme])

  return {
    mermaid: mermaidModule,
    isLoading,
    error
  }
}
