import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { isMac } from '@main/constant'

class SearchService {
  private searchWindows: Map<string, BrowserWindow> = new Map()

  /**
   * 打开搜索窗口
   * @param uid 窗口唯一标识符
   */
  public async openSearchWindow(uid: string): Promise<void> {
    // 如果窗口已经存在，则激活它
    if (this.searchWindows.has(uid)) {
      const existingWindow = this.searchWindows.get(uid)
      if (existingWindow && !existingWindow.isDestroyed()) {
        if (existingWindow.isMinimized()) {
          existingWindow.restore()
        }
        existingWindow.focus()
        return
      }
      // 如果窗口已销毁，则从Map中移除
      this.searchWindows.delete(uid)
    }

    // 创建新窗口
    const searchWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      autoHideMenuBar: true,
      ...(isMac ? { titleBarStyle: 'hidden' } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        webSecurity: false
      }
    })

    // 设置窗口标题
    searchWindow.setTitle(`搜索窗口 - ${uid}`)

    // 加载搜索页面
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      searchWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/search?uid=${uid}`)
    } else {
      searchWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: `/search?uid=${uid}`
      })
    }

    // 窗口准备好后显示
    searchWindow.once('ready-to-show', () => {
      searchWindow.show()
    })

    // 窗口关闭时从Map中移除
    searchWindow.on('closed', () => {
      this.searchWindows.delete(uid)
    })

    // 存储窗口引用
    this.searchWindows.set(uid, searchWindow)
  }

  /**
   * 关闭搜索窗口
   * @param uid 窗口唯一标识符
   */
  public async closeSearchWindow(uid: string): Promise<void> {
    const window = this.searchWindows.get(uid)
    if (window && !window.isDestroyed()) {
      window.close()
    }
    this.searchWindows.delete(uid)
  }

  /**
   * 在搜索窗口中打开URL
   * @param uid 窗口唯一标识符
   * @param url 要打开的URL
   */
  public async openUrlInSearchWindow(uid: string, url: string): Promise<boolean> {
    const window = this.searchWindows.get(uid)
    if (window && !window.isDestroyed()) {
      try {
        await window.loadURL(url)
        return true
      } catch (error) {
        console.error(`Failed to load URL in search window: ${error}`)
        return false
      }
    }
    return false
  }
}

export const searchService = new SearchService()
