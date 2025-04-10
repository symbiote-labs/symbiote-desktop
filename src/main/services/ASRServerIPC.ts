import fs from 'node:fs'
import { spawn, ChildProcess } from 'node:child_process'
import path from 'node:path'
import { IpcMain, App } from 'electron'
import { IpcChannel } from '@shared/IpcChannel'

// 存储ASR服务器进程
let asrServerProcess: ChildProcess | null = null

/**
 * 注册ASR服务器相关的IPC处理程序
 * @param ipcMain IPC主进程对象
 * @param app Electron应用对象
 */
export function registerASRServerIPC(ipcMain: IpcMain, app: App): void {
  // 启动ASR服务器
  ipcMain.handle(IpcChannel.ASR_StartServer, async () => {
    try {
      if (asrServerProcess) {
        return { success: true, pid: asrServerProcess.pid }
      }

      // 获取服务器文件路径
      console.log('App path:', app.getAppPath())
      // 在开发环境和生产环境中使用不同的路径
      let serverPath = ''
      let isExeFile = false

      // 首先检查是否有打包后的exe文件
      const exePath = path.join(app.getAppPath(), 'resources', 'cherry-asr-server.exe')
      if (fs.existsSync(exePath)) {
        serverPath = exePath
        isExeFile = true
        console.log('检测到打包后的exe文件:', serverPath)
      } else if (process.env.NODE_ENV === 'development') {
        // 开发环境
        serverPath = path.join(app.getAppPath(), 'src', 'renderer', 'src', 'assets', 'asr-server', 'server.js')
      } else {
        // 生产环境
        serverPath = path.join(app.getAppPath(), 'public', 'asr-server', 'server.js')
      }
      console.log('ASR服务器路径:', serverPath)

      // 检查文件是否存在
      if (!fs.existsSync(serverPath)) {
        return { success: false, error: '服务器文件不存在' }
      }

      // 启动服务器进程
      if (isExeFile) {
        // 如果是exe文件，直接启动
        asrServerProcess = spawn(serverPath, [], {
          stdio: 'pipe',
          detached: false
        })
      } else {
        // 如果是js文件，使用node启动
        asrServerProcess = spawn('node', [serverPath], {
          stdio: 'pipe',
          detached: false
        })
      }

      // 处理服务器输出
      asrServerProcess.stdout?.on('data', (data) => {
        console.log(`[ASR Server] ${data.toString()}`)
      })

      asrServerProcess.stderr?.on('data', (data) => {
        console.error(`[ASR Server Error] ${data.toString()}`)
      })

      // 处理服务器退出
      asrServerProcess.on('close', (code) => {
        console.log(`[ASR Server] 进程退出，退出码: ${code}`)
        asrServerProcess = null
      })

      // 等待一段时间确保服务器启动
      await new Promise(resolve => setTimeout(resolve, 1000))

      return { success: true, pid: asrServerProcess.pid }
    } catch (error) {
      console.error('启动ASR服务器失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 停止ASR服务器
  ipcMain.handle(IpcChannel.ASR_StopServer, async (_event, pid) => {
    try {
      if (!asrServerProcess) {
        return { success: true }
      }

      // 检查PID是否匹配
      if (asrServerProcess.pid !== pid) {
        console.warn(`请求停止的PID (${pid}) 与当前运行的ASR服务器PID (${asrServerProcess.pid}) 不匹配`)
      }

      // 杀死进程
      asrServerProcess.kill()

      // 等待一段时间确保进程已经退出
      await new Promise(resolve => setTimeout(resolve, 500))

      asrServerProcess = null
      return { success: true }
    } catch (error) {
      console.error('停止ASR服务器失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
