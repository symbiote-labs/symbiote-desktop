import { WebviewErrorType } from '../components/WebviewError'

/**
 * 标签页类型
 */
export interface Tab {
  id: string
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean

  // 错误相关
  hasError?: boolean
  errorType?: WebviewErrorType | null
  errorData?: any
}

/**
 * 标签页更新类型
 */
export type TabUpdate = Partial<Tab>

/**
 * 拖拽方向类型
 */
export type DragDirection = 'left' | 'right' | null
