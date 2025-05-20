import { getStoreSetting } from '@renderer/hooks/useSettings'
import type { Notification } from '@renderer/types/notification'
import { isFocused } from '@renderer/utils/window'
import { notification as appNotification } from 'antd'
import PQueue from 'p-queue'

const typeMap: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
  error: 'error',
  success: 'success',
  warning: 'warning',
  info: 'info',
  progress: 'info',
  action: 'info'
}

export class NotificationQueue {
  private static instance: NotificationQueue
  private queue = new PQueue({ concurrency: 1 })

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): NotificationQueue {
    if (!NotificationQueue.instance) {
      NotificationQueue.instance = new NotificationQueue()
    }
    return NotificationQueue.instance
  }

  /**
   * 将通知添加到队列中
   * @param notification 要发送的通知
   */
  public async add(notification: Notification): Promise<void> {
    const notificationSettings = getStoreSetting('notification')
    if (notification.source && !notificationSettings![notification.source]) return
    await this.queue.add(async () => {
      try {
        if (isFocused()) {
          appNotification.open({
            message: notification.title,
            description: notification.message,
            duration: 3,
            placement: 'topRight',
            type: typeMap[notification.type] || 'info',
            key: notification.id
          })
        } else {
          await window.api.notification.send({ ...notification, channel: 'system' })
        }
      } catch (error) {
        console.error('Failed to send notification:', error)
      }
    })
  }

  /**
   * 清空通知队列
   */
  public clear(): void {
    this.queue.clear()
  }

  /**
   * 获取队列中等待的任务数量
   */
  public get pending(): number {
    return this.queue.pending
  }

  /**
   * 获取队列的大小（包括正在进行和等待的任务）
   */
  public get size(): number {
    return this.queue.size
  }
}
