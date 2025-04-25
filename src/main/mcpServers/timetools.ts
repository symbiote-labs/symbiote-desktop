// src/main/mcpServers/timetools.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'
import Logger from 'electron-log'

// 定义时间工具
const GET_CURRENT_TIME_TOOL = {
  name: 'get_current_time',
  description: '获取当前系统时间，返回格式化的日期和时间信息',
  inputSchema: {
    type: 'object',
    title: 'GetCurrentTimeInput',
    description: '获取当前时间的输入参数',
    properties: {
      format: {
        type: 'string',
        description: '时间格式，可选值：full(完整格式)、date(仅日期)、time(仅时间)、iso(ISO格式)，默认为full',
        enum: ['full', 'date', 'time', 'iso']
      },
      timezone: {
        type: 'string',
        description: '时区，例如：Asia/Shanghai，默认为系统本地时区'
      }
    }
  }
}

// 时间工具服务器类
class TimeToolsServer {
  public server: Server

  constructor() {
    Logger.info('[TimeTools] Creating server')

    // 初始化服务器
    this.server = new Server(
      {
        name: 'time-tools-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {
            // 按照MCP规范声明工具能力
            listChanged: true
          }
        }
      }
    )

    Logger.info('[TimeTools] Server initialized with tools capability')
    this.setupRequestHandlers()
    Logger.info('[TimeTools] Server initialization complete')
  }

  // 设置请求处理程序
  setupRequestHandlers() {
    // 列出工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      Logger.info('[TimeTools] Listing tools request received')
      return {
        tools: [GET_CURRENT_TIME_TOOL]
      }
    })

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      Logger.info(`[TimeTools] Tool call received: ${name}`, args)

      try {
        if (name === 'get_current_time') {
          return this.handleGetCurrentTime(args)
        }

        Logger.error(`[TimeTools] Unknown tool: ${name}`)
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
      } catch (error) {
        Logger.error(`[TimeTools] Error handling tool call ${name}:`, error)
        return {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : String(error)
            }
          ],
          isError: true
        }
      }
    })
  }

  // 处理获取当前时间的工具调用
  private handleGetCurrentTime(args: any) {
    Logger.info('[TimeTools] Handling get_current_time', args)

    const format = args?.format || 'full'
    const timezone = args?.timezone || undefined

    const now = new Date()
    let formattedTime = ''

    try {
      // 根据请求的格式返回时间
      switch (format) {
        case 'date':
          formattedTime = this.formatDate(now, timezone)
          break
        case 'time':
          formattedTime = this.formatTime(now, timezone)
          break
        case 'iso':
          formattedTime = now.toISOString()
          break
        case 'full':
        default:
          formattedTime = this.formatFull(now, timezone)
          break
      }

      // 构建完整的响应对象
      const response = {
        currentTime: formattedTime,
        timestamp: now.getTime(),
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        format: format
      }

      Logger.info('[TimeTools] Current time response:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[TimeTools] Error formatting time:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error formatting time: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 格式化完整日期和时间
  private formatFull(date: Date, timezone?: string): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZoneName: 'short'
    }

    if (timezone) {
      options.timeZone = timezone
    }

    return new Intl.DateTimeFormat('zh-CN', options).format(date)
  }

  // 仅格式化日期
  private formatDate(date: Date, timezone?: string): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }

    if (timezone) {
      options.timeZone = timezone
    }

    return new Intl.DateTimeFormat('zh-CN', options).format(date)
  }

  // 仅格式化时间
  private formatTime(date: Date, timezone?: string): string {
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZoneName: 'short'
    }

    if (timezone) {
      options.timeZone = timezone
    }

    return new Intl.DateTimeFormat('zh-CN', options).format(date)
  }
}

export default TimeToolsServer
