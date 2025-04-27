import { WebviewTag } from 'electron'
import { useCallback, useMemo } from 'react'

import { setupWebviewBooleanAttributes } from '../utils/webviewUtils'
import { userAgent } from './useWebviewEvents'

/**
 * 管理webview属性的自定义Hook
 * 负责处理webview的属性设置和配置
 */
export function useWebviewAttributes() {
  /**
   * 获取标准webview属性
   */
  const standardAttributes = useMemo(() => {
    return {
      partition: 'persist:browser',
      useragent: userAgent,
      webpreferences:
        'contextIsolation=no, javascript=yes, webgl=yes, webaudio=yes, allowRunningInsecureContent=yes, nodeIntegration=yes',
      'data-allowpopups': 'true',
      'data-disablewebsecurity': 'true',
      'data-plugins': 'true'
    }
  }, [])

  /**
   * 设置webview的布尔属性
   * 在React中，布尔属性需要作为字符串传递，而不是布尔值
   */
  const setupBooleanAttributes = useCallback((webview: WebviewTag) => {
    setupWebviewBooleanAttributes(webview)
  }, [])

  /**
   * 检测webview是否需要重新设置
   * @param existingWebview 现有的webview引用
   * @param newWebview 新的webview元素
   */
  const shouldResetup = useCallback((existingWebview: WebviewTag | null, newWebview: WebviewTag): boolean => {
    return !existingWebview || existingWebview !== newWebview
  }, [])

  return {
    standardAttributes,
    setupBooleanAttributes,
    shouldResetup
  }
}
