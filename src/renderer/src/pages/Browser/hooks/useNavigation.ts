import { WebviewTag } from 'electron'
import { useCallback, useEffect, useState } from 'react'

import { formatUrl } from '../utils/urlUtils'

/**
 * 浏览器导航钩子
 * 提供浏览器导航相关的状态和方法
 */
export const useNavigation = (
  activeTab: any,
  webviewRef: React.RefObject<WebviewTag>,
  updateTabInfo: (tabId: string, updates: any) => void
) => {
  // 状态
  const [currentUrl, setCurrentUrl] = useState('')
  const [displayUrl, setDisplayUrl] = useState('') // 用于显示在地址栏的URL
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [navigationError, setNavigationError] = useState<string | null>(null)

  // 当活动标签页变化时，更新URL显示
  useEffect(() => {
    if (activeTab && activeTab.url) {
      setCurrentUrl(activeTab.url)
      setDisplayUrl(activeTab.url)

      // 从标签页状态中获取导航状态，而不是直接调用webview方法
      if (activeTab.canGoBack !== undefined) {
        setCanGoBack(activeTab.canGoBack)
      }

      if (activeTab.canGoForward !== undefined) {
        setCanGoForward(activeTab.canGoForward)
      }
    }
  }, [activeTab])

  // URL 输入处理
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayUrl(e.target.value)
  }, [])

  /**
   * 处理URL提交
   * 支持:
   * 1. 完整URL (https://example.com)
   * 2. 域名 (example.com) - 自动添加https://
   * 3. 搜索查询 - 重定向到搜索引擎
   */
  const handleUrlSubmit = useCallback(() => {
    // 清除之前的错误
    setNavigationError(null)

    const input = displayUrl.trim()

    try {
      // 处理URL
      const processedUrl = formatUrl(input)

      // 更新当前URL和显示URL
      setCurrentUrl(processedUrl)

      // 更新标签页信息并导航
      updateTabInfo(activeTab.id, {
        url: processedUrl,
        isLoading: true
      })

      // 记录导航操作
      console.log(`Navigating to: ${processedUrl}`)
    } catch (error) {
      console.error('URL处理错误:', error)
      setNavigationError('无效的URL格式')
    }
  }, [displayUrl, activeTab, updateTabInfo])

  /**
   * 后退导航
   * 使用webview的goBack方法并更新状态
   */
  const handleGoBack = useCallback(() => {
    if (!canGoBack || !webviewRef.current) return

    try {
      webviewRef.current.goBack()

      // 更新标签页状态为加载中
      updateTabInfo(activeTab.id, { isLoading: true })

      // 记录导航操作
      console.log('Navigating back')
    } catch (error) {
      console.error('后退导航错误:', error)
      setNavigationError('无法返回上一页')
    }
  }, [canGoBack, webviewRef, activeTab, updateTabInfo])

  /**
   * 前进导航
   * 使用webview的goForward方法并更新状态
   */
  const handleGoForward = useCallback(() => {
    if (!canGoForward || !webviewRef.current) return

    try {
      webviewRef.current.goForward()

      // 更新标签页状态为加载中
      updateTabInfo(activeTab.id, { isLoading: true })

      // 记录导航操作
      console.log('Navigating forward')
    } catch (error) {
      console.error('前进导航错误:', error)
      setNavigationError('无法前进到下一页')
    }
  }, [canGoForward, webviewRef, activeTab, updateTabInfo])

  /**
   * 刷新页面
   * 支持普通刷新和强制刷新(忽略缓存)
   */
  const handleReload = useCallback(
    (ignoreCache: boolean = false) => {
      if (!webviewRef.current) return

      try {
        if (ignoreCache) {
          webviewRef.current.reloadIgnoringCache()
        } else {
          webviewRef.current.reload()
        }

        // 更新标签页状态为加载中
        updateTabInfo(activeTab.id, { isLoading: true })

        // 记录刷新操作
        console.log(`Reloading page${ignoreCache ? ' (ignoring cache)' : ''}`)
      } catch (error) {
        console.error('刷新页面错误:', error)
        setNavigationError('无法刷新页面')
      }
    },
    [webviewRef, activeTab, updateTabInfo]
  )

  /**
   * 导航到首页
   */
  const handleHome = useCallback(() => {
    const homeUrl = 'https://www.google.com'

    try {
      // 更新标签页信息并导航
      updateTabInfo(activeTab.id, {
        url: homeUrl,
        isLoading: true
      })

      // 更新当前URL和显示URL
      setCurrentUrl(homeUrl)
      setDisplayUrl(homeUrl)

      // 记录导航操作
      console.log('Navigating to home page')
    } catch (error) {
      console.error('首页导航错误:', error)
      setNavigationError('无法导航到首页')
    }
  }, [activeTab, updateTabInfo])

  /**
   * 打开开发者工具
   */
  const handleOpenDevTools = useCallback(() => {
    const webview = webviewRef.current
    if (webview) {
      webview.openDevTools()
      console.log('Opened developer tools')
    }
  }, [webviewRef])

  /**
   * 在外部浏览器中打开当前页面
   */
  const handleOpenExternal = useCallback(() => {
    if (currentUrl && window.api && window.api.shell) {
      window.api.shell.openExternal(currentUrl)
      console.log(`Opening in external browser: ${currentUrl}`)
    }
  }, [currentUrl])

  /**
   * 清除浏览器数据
   */
  const handleClearData = useCallback(() => {
    if (window.api && window.api.ipcRenderer) {
      // 通过IPC调用主进程清除浏览器数据
      window.api.ipcRenderer
        .invoke('browser:clear-data')
        .then(() => {
          // 重新加载当前页面
          if (webviewRef.current) {
            webviewRef.current.reload()
            console.log('Browser data cleared')
          }
        })
        .catch((error: any) => {
          console.error('Failed to clear browser data:', error)
          setNavigationError('无法清除浏览器数据')
        })
    }
  }, [webviewRef])

  /**
   * 停止加载当前页面
   */
  const handleStopLoading = useCallback(() => {
    if (!webviewRef.current) return

    try {
      webviewRef.current.stop()

      // 更新标签页状态为非加载中
      updateTabInfo(activeTab.id, { isLoading: false })

      console.log('Stopped loading page')
    } catch (error) {
      console.error('停止加载错误:', error)
    }
  }, [webviewRef, activeTab, updateTabInfo])

  return {
    // 状态
    currentUrl,
    setCurrentUrl,
    displayUrl,
    setDisplayUrl,
    canGoBack,
    setCanGoBack,
    canGoForward,
    setCanGoForward,
    isLoading,
    setIsLoading,
    navigationError,

    // 方法
    handleUrlChange,
    handleUrlSubmit,
    handleGoBack,
    handleGoForward,
    handleReload,
    handleHome,
    handleOpenDevTools,
    handleOpenExternal,
    handleClearData,
    handleStopLoading
  }
}
