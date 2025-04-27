import { WebviewTag } from 'electron'

// 定义选项卡接口
export interface Tab {
  id: string
  title: string
  url: string
  favicon?: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

// 定义Webview引用接口
export interface WebviewRefs {
  [key: string]: WebviewTag | null
}

// 定义Webview会话状态接口
export interface WebviewSessions {
  [key: string]: boolean
}

// 定义清理函数接口
export interface CleanupFunctions {
  [key: string]: () => void
}

// 全局变量，控制是否禁用安全限制
export const DISABLE_SECURITY = true // 设置为true表示禁用安全限制，false表示启用安全限制
