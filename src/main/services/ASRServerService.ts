import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'

import { IpcChannel } from '@shared/IpcChannel'
import { app, ipcMain } from 'electron'
import log from 'electron-log'

import { getResourcePath } from '../utils'

/**
 * ASR服务器服务，用于管理ASR服务器进程
 */
export class ASRServerService {
  // HTML内容
  private INDEX_HTML_CONTENT: string = ''

  // 服务器相关属性
  private httpServer: http.Server | null = null
  private wsClients: { browser: any | null; electron: any | null } = { browser: null, electron: null }
  private serverPort: number = 34515 // 默认端口
  private isServerRunning: boolean = false

  /**
   * 构造函数
   */
  constructor() {
    this.loadIndexHtml()
  }

  /**
   * 加载index.html文件
   */
  private loadIndexHtml(): void {
    try {
      // 在开发环境和生产环境中使用不同的路径
      let htmlPath = ''

      if (app.isPackaged) {
        // 生产环境
        const resourcePath = getResourcePath()
        htmlPath = path.join(resourcePath, 'app', 'asr-server', 'index.html')
      } else {
        // 开发环境
        htmlPath = path.join(app.getAppPath(), 'asr-server', 'index.html')
      }

      log.info(`加载index.html文件: ${htmlPath}`)

      if (fs.existsSync(htmlPath)) {
        this.INDEX_HTML_CONTENT = fs.readFileSync(htmlPath, 'utf8')
        log.info(`成功加载index.html文件`)
      } else {
        log.error(`index.html文件不存在: ${htmlPath}`)
        // 使用默认的HTML内容
        this.INDEX_HTML_CONTENT = `<!DOCTYPE html>
<html>
<head>
  <title>ASR Server Error</title>
</head>
<body>
  <h1>Error: index.html file not found</h1>
  <p>Please make sure the ASR server files are properly installed.</p>
</body>
</html>`
      }
    } catch (error) {
      log.error(`加载index.html文件时出错:`, error)
      // 使用默认的HTML内容
      this.INDEX_HTML_CONTENT = `<!DOCTYPE html>
<html>
<head>
  <title>ASR Server Error</title>
</head>
<body>
  <h1>Error loading index.html</h1>
  <p>An error occurred while loading the ASR server files.</p>
</body>
</html>`
    }
  }

  /**
   * 注册IPC处理程序
   */
  public registerIpcHandlers(): void {
    // 启动ASR服务器
    ipcMain.handle(IpcChannel.Asr_StartServer, this.startServer.bind(this))

    // 停止ASR服务器
    ipcMain.handle(IpcChannel.Asr_StopServer, this.stopServer.bind(this))
  }

  /**
   * 检查端口是否可用
   * @param port 要检查的端口
   * @returns 如果端口可用则返回true，否则返回false
   */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const testServer = net.createServer()
      testServer.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          log.info(`端口 ${port} 已被占用，尝试其他端口...`)
          resolve(false)
        } else {
          log.error(`检查端口 ${port} 时出错:`, err)
          resolve(false)
        }
      })
      testServer.once('listening', () => {
        testServer.close()
        resolve(true)
      })
      testServer.listen(port)
    })
  }

  /**
   * 找到可用的端口
   * @param startPort 起始端口
   * @returns 可用的端口
   */
  private async findAvailablePort(startPort: number): Promise<number> {
    let port = startPort
    const maxPort = startPort + 10 // 尝试最多10个端口

    while (port < maxPort) {
      if (await this.isPortAvailable(port)) {
        return port
      }
      port++
    }

    throw new Error(`在 ${startPort} 和 ${maxPort - 1} 之间找不到可用的端口`)
  }

  /**
   * 处理HTTP请求
   * @param req HTTP请求
   * @param res HTTP响应
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // 只处理根路径请求，返回index.html
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(this.INDEX_HTML_CONTENT)
      log.info(`返回index.html到客户端`)
    } else {
      // 其他路径返回404
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
      log.info(`请求的路径不存在: ${req.url}`)
    }
  }

  /**
   * 启动ASR服务器
   * @returns Promise<{success: boolean, pid?: number, port?: number, error?: string}>
   */
  private async startServer(): Promise<{ success: boolean; pid?: number; port?: number; error?: string }> {
    try {
      // 如果服务器已经运行，直接返回成功
      if (this.isServerRunning && this.httpServer) {
        return { success: true, port: this.serverPort }
      }

      // 尝试找到可用的端口
      try {
        this.serverPort = await this.findAvailablePort(this.serverPort)
      } catch (error) {
        log.error('找不到可用的端口:', error)
        return { success: false, error: '找不到可用的端口' }
      }

      log.info(`使用端口: ${this.serverPort}`)

      // 创建HTTP服务器
      this.httpServer = http.createServer(this.handleHttpRequest.bind(this))

      // 启动HTTP服务器
      try {
        await new Promise<void>((resolve, reject) => {
          if (!this.httpServer) {
            reject(new Error('HTTP服务器创建失败'))
            return
          }

          this.httpServer.on('error', (err) => {
            log.error(`HTTP服务器错误:`, err)
            reject(err)
          })

          this.httpServer.listen(this.serverPort, () => {
            log.info(`HTTP服务器已启动，监听端口: ${this.serverPort}`)
            resolve()
          })
        })

        // 设置WebSocket处理
        this.setupWebSocketServer()

        // 标记服务器已启动
        this.isServerRunning = true

        log.info(`ASR服务器启动成功，端口: ${this.serverPort}`)
        return { success: true, port: this.serverPort }
      } catch (error) {
        log.error('启动HTTP服务器失败:', error)
        // 关闭HTTP服务器
        if (this.httpServer) {
          this.httpServer.close()
          this.httpServer = null
        }
        return { success: false, error: `启动HTTP服务器失败: ${(error as Error).message}` }
      }
    } catch (error) {
      log.error('启动ASR服务器失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 设置WebSocket服务器
   */
  private setupWebSocketServer(): void {
    if (!this.httpServer) {
      log.error('HTTP服务器不存在，无法设置WebSocket')
      return
    }

    // 处理WebSocket连接升级
    this.httpServer.on('upgrade', (request, socket) => {
      try {
        log.info('[WebSocket] 收到连接升级请求')

        // 解析WebSocket密钥
        const key = request.headers['sec-websocket-key'] as string
        const acceptKey = crypto
          .createHash('sha1')
          .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
          .digest('base64')

        // 发送WebSocket握手响应
        socket.write(
          'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
            '\r\n'
        )

        log.info('[WebSocket] 握手成功')

        // 处理WebSocket数据
        this.handleWebSocketConnection(socket)
      } catch (error) {
        log.error('[WebSocket] 处理升级错误:', error)
        socket.destroy()
      }
    })
  }

  /**
   * 处理WebSocket连接
   * @param socket 套接字
   */
  private handleWebSocketConnection(socket: any): void {
    let buffer = Buffer.alloc(0)
    const role: 'browser' | 'electron' | null = null

    socket.on('data', (data: Buffer) => {
      try {
        buffer = Buffer.concat([buffer, data])

        // 处理数据帧
        while (buffer.length > 2) {
          // 检查是否有完整的帧
          const firstByte = buffer[0]
          const secondByte = buffer[1]
          // const isFinalFrame = Boolean((firstByte >>> 7) & 0x1); // 暂时不使用
          const [opCode, maskFlag, payloadLength] = [firstByte & 0xf, (secondByte >>> 7) & 0x1, secondByte & 0x7f]

          // 处理不同的负载长度
          let payloadStartIndex = 2
          let payloadLen = payloadLength

          if (payloadLength === 126) {
            payloadLen = buffer.readUInt16BE(2)
            payloadStartIndex = 4
          } else if (payloadLength === 127) {
            // 处理大于16位的长度
            payloadLen = Number(buffer.readBigUInt64BE(2))
            payloadStartIndex = 10
          }

          // 处理掩码
          let maskingKey: Buffer | undefined
          if (maskFlag) {
            maskingKey = buffer.slice(payloadStartIndex, payloadStartIndex + 4)
            payloadStartIndex += 4
          }

          // 检查是否有足够的数据
          const frameEnd = payloadStartIndex + payloadLen
          if (buffer.length < frameEnd) {
            // 需要更多数据
            break
          }

          // 提取负载
          const payload = buffer.slice(payloadStartIndex, frameEnd)

          // 如果有掩码，解码负载
          if (maskFlag && maskingKey) {
            for (let i = 0; i < payload.length; i++) {
              payload[i] = payload[i] ^ maskingKey[i % 4]
            }
          }

          // 处理不同的操作码
          if (opCode === 0x8) {
            // 关闭帧
            log.info('[WebSocket] 收到关闭帧')
            socket.end()
            return
          } else if (opCode === 0x9) {
            // Ping
            this.sendPong(socket)
          } else if (opCode === 0x1 || opCode === 0x2) {
            // 文本或二进制数据
            const message = opCode === 0x1 ? payload.toString('utf8') : payload
            this.handleMessage(socket, message, role)
          }

          // 移除已处理的帧
          buffer = buffer.slice(frameEnd)
        }
      } catch (error) {
        log.error('[WebSocket] 处理数据错误:', error)
      }
    })

    socket.on('close', () => {
      const socketRole = (socket as any)._role || role
      log.info(`[WebSocket] 连接关闭${socketRole ? ` (${socketRole})` : ''}`)

      if (socketRole === 'browser') {
        this.wsClients.browser = null

        // 如果浏览器断开连接，通知Electron客户端
        if (this.wsClients.electron) {
          this.sendWebSocketFrame(
            this.wsClients.electron,
            JSON.stringify({
              type: 'status',
              message: 'Browser disconnected'
            })
          )
          log.info('[WebSocket] 已向Electron发送Browser disconnected状态')
        }
      } else if (socketRole === 'electron') {
        this.wsClients.electron = null
      }
    })

    socket.on('error', (error: Error) => {
      log.error(`[WebSocket] 套接字错误${role ? ` (${role})` : ''}:`, error)
    })
  }

  /**
   * 发送WebSocket数据
   * @param socket 套接字
   * @param data 数据
   * @param opCode 操作码
   */
  private sendWebSocketFrame(socket: any, data: string | object, opCode = 0x1): void {
    try {
      const payload = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data))
      const payloadLength = payload.length

      let header: Buffer
      if (payloadLength < 126) {
        header = Buffer.from([0x80 | opCode, payloadLength])
      } else if (payloadLength < 65536) {
        header = Buffer.alloc(4)
        header[0] = 0x80 | opCode
        header[1] = 126
        header.writeUInt16BE(payloadLength, 2)
      } else {
        header = Buffer.alloc(10)
        header[0] = 0x80 | opCode
        header[1] = 127
        header.writeBigUInt64BE(BigInt(payloadLength), 2)
      }

      socket.write(Buffer.concat([header, payload]))
    } catch (error) {
      log.error('[WebSocket] 发送数据错误:', error)
    }
  }

  /**
   * 发送Pong响应
   * @param socket 套接字
   */
  private sendPong(socket: any): void {
    const pongFrame = Buffer.from([0x8a, 0x00])
    socket.write(pongFrame)
  }

  /**
   * 处理消息
   * @param socket 套接字
   * @param message 消息
   * @param currentRole 当前角色
   */
  private handleMessage(socket: any, message: string | Buffer, currentRole: string | null): void {
    try {
      if (typeof message === 'string') {
        const data = JSON.parse(message)

        // 处理身份识别
        if (data.type === 'identify') {
          const role = data.role
          if (role === 'browser' || role === 'electron') {
            log.info(`[WebSocket] 客户端识别为: ${role}`)

            // 存储客户端连接
            this.wsClients[role] = socket
            // 设置当前连接的角色
            ;(socket as any)._role = role

            // 如果是浏览器连接，通知Electron客户端
            if (role === 'browser' && this.wsClients.electron) {
              // 发送browser_ready消息
              this.sendWebSocketFrame(
                this.wsClients.electron,
                JSON.stringify({
                  type: 'status',
                  message: 'browser_ready'
                })
              )
              log.info('[WebSocket] 已向Electron发送browser_ready状态')

              // 发送Browser connected消息
              this.sendWebSocketFrame(
                this.wsClients.electron,
                JSON.stringify({
                  type: 'status',
                  message: 'Browser connected'
                })
              )
              log.info('[WebSocket] 已向Electron发送Browser connected状态')
            }
            return
          }
        }

        // 获取当前连接的角色
        const role = currentRole || (socket as any)._role

        // 转发消息
        if (role === 'browser') {
          // 浏览器发送的消息转发给Electron
          if (this.wsClients.electron) {
            log.info(`[WebSocket] Browser -> Electron: ${JSON.stringify(data)}`)
            this.sendWebSocketFrame(this.wsClients.electron, message)
          } else {
            log.info('[WebSocket] 无法转发消息: Electron客户端未连接')
          }
        } else if (role === 'electron') {
          // Electron发送的消息转发给浏览器
          if (this.wsClients.browser) {
            log.info(`[WebSocket] Electron -> Browser: ${JSON.stringify(data)}`)
            this.sendWebSocketFrame(this.wsClients.browser, message)
          } else {
            log.info('[WebSocket] 无法转发消息: 浏览器客户端未连接')
          }
        } else {
          log.info(`[WebSocket] 收到来自未知角色的消息: ${message}`)
        }
      }
    } catch (error) {
      log.error('[WebSocket] 处理消息错误:', error, message)
    }
  }

  /**
   * 停止ASR服务器
   * @param _event IPC事件
   * @param pid 进程ID
   * @returns Promise<{success: boolean, error?: string}>
   */
  private async stopServer(): Promise<{ success: boolean; error?: string }> {
    try {
      // 关闭HTTP服务器
      if (this.httpServer) {
        this.httpServer.close()
        this.httpServer = null
      }

      // 重置客户端连接
      this.wsClients = { browser: null, electron: null }

      // 重置服务器状态
      this.isServerRunning = false

      log.info('ASR服务器已停止')
      return { success: true }
    } catch (error) {
      log.error('停止ASR服务器失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }
}

// 创建并导出单例
export const asrServerService = new ASRServerService()
