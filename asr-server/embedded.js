/**
 * 内置的ASR服务器模块
 * 这个文件可以直接在Electron中运行，不需要外部依赖
 */

// 使用Electron内置的Node.js模块
const http = require('http')
const path = require('path')
const fs = require('fs')
const net = require('net')
const crypto = require('crypto')

// 输出环境信息
console.log('ASR Server (Embedded) starting...')
console.log('Node.js version:', process.version)
console.log('Current directory:', __dirname)
console.log('Current working directory:', process.cwd())
console.log('Command line arguments:', process.argv)

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  try {
    if (req.url === '/' || req.url === '/index.html') {
      // 尝试多个可能的路径
      const possiblePaths = [
        // 当前目录
        path.join(__dirname, 'index.html'),
        // 上级目录
        path.join(__dirname, '..', 'index.html'),
        // 应用根目录
        path.join(process.cwd(), 'index.html')
      ]

      console.log('Possible index.html paths:', possiblePaths)

      // 查找第一个存在的文件
      let indexPath = null
      for (const p of possiblePaths) {
        try {
          if (fs.existsSync(p)) {
            indexPath = p
            console.log(`Found index.html at: ${p}`)
            break
          }
        } catch (e) {
          console.error(`Error checking existence of ${p}:`, e)
        }
      }

      if (indexPath) {
        // 读取文件内容并发送
        fs.readFile(indexPath, (err, data) => {
          if (err) {
            console.error('Error reading index.html:', err)
            res.writeHead(500)
            res.end('Error reading index.html')
            return
          }

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(data)
        })
      } else {
        // 如果找不到文件，返回一个简单的HTML页面
        console.error('Could not find index.html, serving fallback page')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>ASR Server</title>
            <style>
              body { font-family: sans-serif; padding: 2em; }
              h1 { color: #333; }
            </style>
          </head>
          <body>
            <h1>ASR Server is running</h1>
            <p>This is a fallback page because the index.html file could not be found.</p>
            <p>Server is running at: http://localhost:34515</p>
            <p>Current directory: ${__dirname}</p>
            <p>Working directory: ${process.cwd()}</p>
          </body>
          </html>
        `)
      }
    } else {
      // 处理其他请求
      res.writeHead(404)
      res.end('Not found')
    }
  } catch (error) {
    console.error('Error handling request:', error)
    res.writeHead(500)
    res.end('Server error')
  }
})

// 添加进程错误处理
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught exception:', error)
  // 不立即退出，给日志输出的时间
  setTimeout(() => process.exit(1), 1000)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason)
})

// WebSocket客户端管理
const clients = {
  browser: null,
  electron: null
}

// 处理WebSocket连接
server.on('upgrade', (request, socket, head) => {
  try {
    console.log('[WebSocket] Connection upgrade request received')

    // 解析WebSocket密钥
    const key = request.headers['sec-websocket-key']
    const acceptKey = crypto.createHash('sha1')
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

    console.log('[WebSocket] Handshake successful')

    // 处理WebSocket数据
    handleWebSocketConnection(socket)
  } catch (error) {
    console.error('[WebSocket] Error handling upgrade:', error)
    socket.destroy()
  }
})

// 处理WebSocket连接
function handleWebSocketConnection(socket) {
  let buffer = Buffer.alloc(0)
  let role = null

  socket.on('data', (data) => {
    try {
      buffer = Buffer.concat([buffer, data])

      // 处理数据帧
      while (buffer.length > 2) {
        // 检查是否有完整的帧
        const firstByte = buffer[0]
        const secondByte = buffer[1]
        const isFinalFrame = Boolean((firstByte >>> 7) & 0x1)
        const [opCode, maskFlag, payloadLength] = [
          firstByte & 0xF, (secondByte >>> 7) & 0x1, secondByte & 0x7F
        ]

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
        let maskingKey
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
        let payload = buffer.slice(payloadStartIndex, frameEnd)

        // 如果有掩码，解码负载
        if (maskFlag && maskingKey) {
          for (let i = 0; i < payload.length; i++) {
            payload[i] = payload[i] ^ maskingKey[i % 4]
          }
        }

        // 处理不同的操作码
        if (opCode === 0x8) {
          // 关闭帧
          console.log('[WebSocket] Received close frame')
          socket.end()
          return
        } else if (opCode === 0x9) {
          // Ping
          sendPong(socket)
        } else if (opCode === 0x1 || opCode === 0x2) {
          // 文本或二进制数据
          const message = opCode === 0x1 ? payload.toString('utf8') : payload
          handleMessage(socket, message, role)
        }

        // 移除已处理的帧
        buffer = buffer.slice(frameEnd)
      }
    } catch (error) {
      console.error('[WebSocket] Error processing data:', error)
    }
  })

  socket.on('close', () => {
    console.log(`[WebSocket] Connection closed${role ? ` (${role})` : ''}`)
    if (role === 'browser') {
      clients.browser = null
    } else if (role === 'electron') {
      clients.electron = null
    }
  })

  socket.on('error', (error) => {
    console.error(`[WebSocket] Socket error${role ? ` (${role})` : ''}:`, error)
  })
}

// 发送WebSocket数据
function sendWebSocketFrame(socket, data, opCode = 0x1) {
  try {
    const payload = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data))
    const payloadLength = payload.length

    let header
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
    console.error('[WebSocket] Error sending data:', error)
  }
}

// 发送Pong响应
function sendPong(socket) {
  const pongFrame = Buffer.from([0x8A, 0x00])
  socket.write(pongFrame)
}

// 处理消息
function handleMessage(socket, message, currentRole) {
  try {
    if (typeof message === 'string') {
      const data = JSON.parse(message)

      // 处理身份识别
      if (data.type === 'identify') {
        const role = data.role
        if (role === 'browser' || role === 'electron') {
          console.log(`[WebSocket] Client identified as: ${role}`)

          // 存储客户端连接
          clients[role] = socket
          // 设置当前连接的角色
          socket._role = role
          return
        }
      }

      // 获取当前连接的角色
      const role = currentRole || socket._role

      // 转发消息
      if (role === 'browser') {
        // 浏览器发送的消息转发给Electron
        if (clients.electron) {
          console.log(`[WebSocket] Browser -> Electron: ${JSON.stringify(data)}`)
          sendWebSocketFrame(clients.electron, message)
        } else {
          console.log('[WebSocket] Cannot forward message: Electron client not connected')
        }
      } else if (role === 'electron') {
        // Electron发送的消息转发给浏览器
        if (clients.browser) {
          console.log(`[WebSocket] Electron -> Browser: ${JSON.stringify(data)}`)
          sendWebSocketFrame(clients.browser, message)
        } else {
          console.log('[WebSocket] Cannot forward message: Browser client not connected')
        }
      } else {
        console.log(`[WebSocket] Received message from unknown role: ${message}`)
      }
    }
  } catch (error) {
    console.error('[WebSocket] Error handling message:', error, message)
  }
}

// 检查端口是否被占用
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const testServer = require('net').createServer()
    testServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[Server] Port ${port} is in use, trying another port...`)
        resolve(false)
      } else {
        console.error(`[Server] Error checking port ${port}:`, err)
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

// 找到可用的端口
async function findAvailablePort(startPort) {
  let port = startPort
  const maxPort = startPort + 10 // 尝试最多10个端口

  while (port < maxPort) {
    if (await isPortAvailable(port)) {
      return port
    }
    port++
  }

  throw new Error(`Could not find an available port between ${startPort} and ${maxPort-1}`)
}

// 尝试启动服务器
(async () => {
  try {
    // 默认端口
    const defaultPort = 34515
    // 找到可用的端口
    const port = await findAvailablePort(defaultPort)

    // 将端口号写入文件，便于主进程读取
    const portFilePath = path.join(__dirname, 'port.txt')
    fs.writeFileSync(portFilePath, port.toString(), 'utf8')
    console.log(`[Server] Port ${port} is available, saved to ${portFilePath}`)

    // 启动服务器
    server.listen(port, () => {
      console.log(`[Server] Server running at http://localhost:${port}`)
      // 写入成功标记
      fs.writeFileSync(path.join(__dirname, 'server-ready.txt'), 'ready', 'utf8')
    })

    // 处理服务器错误
    server.on('error', (error) => {
      console.error(`[Server] Failed to start server:`, error)
      process.exit(1) // Exit if server fails to start
    })

    // 保持进程运行
    // 使用定时器保持进程运行
    const keepAliveInterval = setInterval(() => {
      console.log('[Server] Keep alive ping...')
    }, 10000) // 每10秒发送一次日志，保持进程运行

    // 添加信号处理程序
    process.on('SIGINT', () => {
      console.log('[Server] Received SIGINT signal, shutting down...')
      clearInterval(keepAliveInterval)
      server.close()
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      console.log('[Server] Received SIGTERM signal, shutting down...')
      clearInterval(keepAliveInterval)
      server.close()
      process.exit(0)
    })

    // 处理进程退出
    process.on('exit', () => {
      console.log('[Server] Process is exiting, cleaning up resources...')
      try {
        // 清除定时器
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval)
        }

        // 关闭服务器
        if (server) {
          try {
            server.close()
          } catch (err) {
            console.error('[Server] Error closing server:', err)
          }
        }

        // 删除端口文件
        if (fs.existsSync(portFilePath)) {
          fs.unlinkSync(portFilePath)
          console.log('[Server] Removed port file:', portFilePath)
        }

        // 删除就绪标记
        const readyFilePath = path.join(__dirname, 'server-ready.txt')
        if (fs.existsSync(readyFilePath)) {
          fs.unlinkSync(readyFilePath)
          console.log('[Server] Removed ready file:', readyFilePath)
        }

        console.log('[Server] Cleanup completed')
      } catch (e) {
        console.error('[Server] Error cleaning up files:', e)
      }
    })

    // 添加未捕获异常处理
    process.on('uncaughtException', (error) => {
      console.error('[Server] Uncaught exception:', error)
      // 尝试清理资源
      try {
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval)
        }

        if (fs.existsSync(portFilePath)) {
          fs.unlinkSync(portFilePath)
        }

        const readyFilePath = path.join(__dirname, 'server-ready.txt')
        if (fs.existsSync(readyFilePath)) {
          fs.unlinkSync(readyFilePath)
        }
      } catch (e) {
        console.error('[Server] Error cleaning up after uncaught exception:', e)
      }

      // 给日志输出的时间
      setTimeout(() => process.exit(1), 1000)
    })
  } catch (error) {
    console.error('[Server] Critical error starting server:', error)
    process.exit(1)
  }
})()
