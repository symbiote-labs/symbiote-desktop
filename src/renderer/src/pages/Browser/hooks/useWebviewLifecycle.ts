import { WebviewTag } from 'electron'
import { useEffect, useRef } from 'react'

/**
 * 管理webview生命周期的自定义Hook
 * 负责处理webview的引用、初始化和清理
 */
export function useWebviewLifecycle(
  tabId: string,
  onInit: (tabId: string, initialized: boolean) => void,
  onCleanup: (tabId: string) => void
) {
  // 使用ref跟踪是否已经初始化
  const isInitializedRef = useRef(false)

  // 当组件卸载时执行清理
  useEffect(() => {
    return () => {
      if (isInitializedRef.current) {
        console.log(`[useWebviewLifecycle] Cleaning up webview for tab: ${tabId}`)
        onCleanup(tabId)
        isInitializedRef.current = false
      }
    }
  }, [tabId, onCleanup])

  /**
   * 处理webview引用设置
   * @param webview webview元素
   */
  const handleWebviewRef = (webview: WebviewTag | null) => {
    if (webview) {
      if (!isInitializedRef.current) {
        console.log(`[useWebviewLifecycle] Initializing webview for tab: ${tabId}`)
        onInit(tabId, true)
        isInitializedRef.current = true
      }
    } else {
      if (isInitializedRef.current) {
        console.log(`[useWebviewLifecycle] Webview removed for tab: ${tabId}`)
        onCleanup(tabId)
        isInitializedRef.current = false
      }
    }
  }

  return {
    handleWebviewRef,
    isInitialized: isInitializedRef.current
  }
}
