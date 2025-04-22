import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import Logger from 'electron-log'

import BraveSearchServer from './brave-search'
import FetchServer from './fetch'
import FileSystemServer from './filesystem'
import MemoryServer from './memory'
import ThinkingServer from './sequentialthinking'
import SimpleRememberServer from './simpleremember'
import { WorkspaceFileToolServer } from './workspacefile'

export async function createInMemoryMCPServer(
  name: string,
  args: string[] = [],
  envs: Record<string, string> = {}
): Promise<Server> {
  Logger.info(`[MCP] Creating in-memory MCP server: ${name} with args: ${args} and envs: ${JSON.stringify(envs)}`)
  switch (name) {
    case '@cherry/memory': {
      const envPath = envs.MEMORY_FILE_PATH
      return new MemoryServer(envPath).server
    }
    case '@cherry/sequentialthinking': {
      return new ThinkingServer().server
    }
    case '@cherry/brave-search': {
      return new BraveSearchServer(envs.BRAVE_API_KEY).server
    }
    case '@cherry/fetch': {
      return new FetchServer().server
    }
    case '@cherry/filesystem': {
      return new FileSystemServer(args).server
    }
    case '@cherry/simpleremember': {
      const envPath = envs.SIMPLEREMEMBER_FILE_PATH
      return new SimpleRememberServer(envPath).server
    }
    case '@cherry/workspacefile': {
      const workspacePath = envs.WORKSPACE_PATH
      if (!workspacePath) {
        throw new Error('WORKSPACE_PATH environment variable is required for WorkspaceFileTool server')
      }

      // 验证工作区路径是否存在
      try {
        const fs = require('fs/promises')
        const stats = await fs.stat(workspacePath)
        if (!stats.isDirectory()) {
          throw new Error(`工作区路径不是一个目录: ${workspacePath}`)
        }
      } catch (error) {
        Logger.error(`[WorkspaceFileTool] 工作区路径无效:`, error)
        // 添加类型检查，确保 error 是 Error 实例
        if (error instanceof Error) {
          throw new Error(`工作区路径无效: ${error.message}`)
        } else {
          // 如果不是 Error 实例，抛出通用错误
          throw new Error(`工作区路径无效: 未知错误`)
        }
      }

      return new WorkspaceFileToolServer(workspacePath).server
    }
    default:
      throw new Error(`Unknown in-memory MCP server: ${name}`)
  }
}
