import { WebviewTag } from 'electron'
import { useCallback } from 'react'

/**
 * 管理webview导航的自定义Hook
 * 负责处理webview的导航操作（前进、后退、刷新等）
 */
export function useWebviewNavigation(webviewRef: React.MutableRefObject<WebviewTag | null>) {
  /**
   * 导航到指定URL
   * @param url 目标URL
   */
  const navigateTo = useCallback(
    (url: string) => {
      const webview = webviewRef.current
      if (webview) {
        console.log(`[useWebviewNavigation] Navigating to: ${url}`)
        webview.loadURL(url)
      }
    },
    [webviewRef]
  )

  /**
   * 导航后退
   */
  const goBack = useCallback(() => {
    const webview = webviewRef.current
    if (webview && webview.canGoBack()) {
      console.log('[useWebviewNavigation] Going back')
      webview.goBack()
    }
  }, [webviewRef])

  /**
   * 导航前进
   */
  const goForward = useCallback(() => {
    const webview = webviewRef.current
    if (webview && webview.canGoForward()) {
      console.log('[useWebviewNavigation] Going forward')
      webview.goForward()
    }
  }, [webviewRef])

  /**
   * 刷新页面
   */
  const refresh = useCallback(() => {
    const webview = webviewRef.current
    if (webview) {
      console.log('[useWebviewNavigation] Refreshing page')
      webview.reload()
    }
  }, [webviewRef])

  /**
   * 停止加载
   */
  const stopLoading = useCallback(() => {
    const webview = webviewRef.current
    if (webview) {
      console.log('[useWebviewNavigation] Stopping loading')
      webview.stop()
    }
  }, [webviewRef])

  return {
    navigateTo,
    goBack,
    goForward,
    refresh,
    stopLoading
  }
}
