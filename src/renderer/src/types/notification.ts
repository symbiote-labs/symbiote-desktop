export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'action'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  /** 是否静音 */
  silent?: boolean
  /** 点击回调函数，仅在 type 为 'action' 时有效 */
  onClick?: () => void
  /** 自定义图标 */
  icon?: string
  /** 自动关闭时间(ms)，为0时不自动关闭 */
  duration?: number
  /** 是否在通知中心显示 */
  showInCenter?: boolean
}
