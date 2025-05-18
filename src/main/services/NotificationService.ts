import { Notification as CherryNotification } from '@types'
import { BrowserWindow } from 'electron'
import notifier from 'node-notifier'

class NotificationService {
  private window: BrowserWindow
  private clickHandler: ((...args: any[]) => void) | null = null

  constructor(window: BrowserWindow) {
    // Initialize the service
    this.window = window
  }

  public async sendNotification(notification: CherryNotification) {
    // 清理之前的点击处理程序
    if (this.clickHandler) {
      notifier.off('click', this.clickHandler)
      this.clickHandler = null
    }

    // 创建新的点击处理程序
    this.clickHandler = () => {
      this.window.show()
      this.window.webContents.send('notification-click', notification)
    }

    notifier.notify({
      title: notification.title,
      message: notification.message,
      wait: true,
      sound: !notification.silent
    })

    notifier.on('click', this.clickHandler)
  }
}

export default NotificationService
