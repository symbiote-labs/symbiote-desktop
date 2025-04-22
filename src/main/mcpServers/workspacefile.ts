// src/main/mcpServers/workspacefile.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  ToolSchema
} from '@modelcontextprotocol/sdk/types.js'
import { createTwoFilesPatch } from 'diff'
import Logger from 'electron-log'
import fs from 'fs/promises'
import { minimatch } from 'minimatch'
import path from 'path'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

// 工具名称常量
const TOOL_READ_FILE = 'workspace_read_file'
const TOOL_WRITE_FILE = 'workspace_write_file'
const TOOL_SEARCH_FILES = 'workspace_search_files'
const TOOL_LIST_FILES = 'workspace_list_files'
const TOOL_CREATE_FILE = 'workspace_create_file'
const TOOL_EDIT_FILE = 'workspace_edit_file'

// 规范化路径
function normalizePath(p: string): string {
  return path.normalize(p)
}

// 验证路径是否在允许的工作区内
async function validatePath(workspacePath: string, requestedPath: string): Promise<string> {
  // 增加日志输出，便于调试
  Logger.info(`[WorkspaceFileTool] 验证路径: workspacePath=${workspacePath}, requestedPath=${requestedPath}`)

  // 如果请求的路径为空，直接返回工作区路径
  if (!requestedPath || requestedPath === '.') {
    Logger.info(`[WorkspaceFileTool] 请求的路径为空或为'.'，返回工作区路径: ${workspacePath}`)
    return workspacePath
  }

  // 检查请求的路径是否已经包含工作区路径
  // 例如，如果工作区是 "测试"，而请求的路径是 "测试/文件.txt"，则应该处理为 "文件.txt"
  const workspaceName = path.basename(workspacePath)

  try {
    // 使用更安全的方式检测路径前缀
    const workspacePattern = new RegExp(`^${workspaceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\/]`)

    // 如果路径以工作区名称开头，则移除工作区名称部分
    if (workspacePattern.test(requestedPath)) {
      Logger.info(`[WorkspaceFileTool] 检测到路径包含工作区名称，原路径: ${requestedPath}`)
      requestedPath = requestedPath.replace(workspacePattern, '')
      Logger.info(`[WorkspaceFileTool] 处理后的路径: ${requestedPath}`)
    }
  } catch (error) {
    Logger.error(`[WorkspaceFileTool] 处理路径前缀时出错:`, error)
    // 出错时不做处理，继续使用原始路径
  }

  // 如果请求的路径是相对路径，则相对于工作区路径
  const absolute = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(workspacePath, requestedPath)

  const normalizedRequested = normalizePath(absolute)
  const normalizedWorkspace = normalizePath(workspacePath)

  // 检查路径是否在工作区内
  if (!normalizedRequested.startsWith(normalizedWorkspace)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `访问被拒绝 - 路径超出工作区范围: ${requestedPath} 不在 ${workspacePath} 内`
    )
  }

  // 处理符号链接
  try {
    const realPath = await fs.realpath(absolute)
    const normalizedReal = normalizePath(realPath)

    if (!normalizedReal.startsWith(normalizedWorkspace)) {
      throw new McpError(ErrorCode.InvalidParams, '访问被拒绝 - 符号链接目标超出工作区范围')
    }

    return realPath
  } catch (error) {
    // 对于尚不存在的新文件，验证父目录
    const parentDir = path.dirname(absolute)
    try {
      const realParentPath = await fs.realpath(parentDir)
      const normalizedParent = normalizePath(realParentPath)

      if (!normalizedParent.startsWith(normalizedWorkspace)) {
        throw new McpError(ErrorCode.InvalidParams, '访问被拒绝 - 父目录超出工作区范围')
      }

      return absolute
    } catch {
      throw new McpError(ErrorCode.InvalidParams, `父目录不存在: ${parentDir}`)
    }
  }
}

// 参数模式定义
const ReadFileArgsSchema = z.object({
  path: z.string().describe('要读取的文件路径，可以是相对于工作区的路径')
})

const WriteFileArgsSchema = z.object({
  path: z.string().describe('要写入的文件路径，可以是相对于工作区的路径'),
  content: z.string().describe('要写入文件的内容')
})

const SearchFilesArgsSchema = z.object({
  pattern: z.string().describe('搜索模式，可以是文件名的一部分或通配符'),
  excludePatterns: z.array(z.string()).optional().default([]).describe('要排除的文件模式数组')
})

const ListFilesArgsSchema = z.object({
  path: z.string().optional().default('').describe('要列出文件的目录路径，默认为工作区根目录'),
  recursive: z.boolean().optional().default(false).describe('是否递归列出子目录中的文件')
})

const CreateFileArgsSchema = z.object({
  path: z.string().describe('要创建的文件路径，可以是相对于工作区的路径'),
  content: z.string().describe('文件的初始内容')
})

const EditFileArgsSchema = z.object({
  path: z.string().describe('要编辑的文件路径，可以是相对于工作区的路径'),
  changes: z
    .array(
      z.object({
        start: z.number().describe('开始行号（从1开始）'),
        end: z.number().describe('结束行号（从1开始）'),
        content: z.string().describe('要替换的新内容')
      })
    )
    .describe('要应用的更改数组')
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ToolInputSchema = ToolSchema.shape.inputSchema
type ToolInput = z.infer<typeof ToolInputSchema>

// 工具实现

export class WorkspaceFileToolServer {
  public server: Server
  private workspacePath: string

  constructor(workspacePath: string) {
    if (!workspacePath) {
      throw new Error('未提供工作区路径，请在环境变量中指定 WORKSPACE_PATH')
    }

    this.workspacePath = normalizePath(path.resolve(workspacePath))

    // 验证工作区目录存在且可访问
    this.validateWorkspace().catch((error) => {
      Logger.error('验证工作区目录时出错:', error)
      throw new Error(`验证工作区目录时出错: ${error}`)
    })

    this.server = new Server(
      {
        name: 'workspace-file-tool-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )
    this.initialize()
  }

  async validateWorkspace() {
    try {
      const stats = await fs.stat(this.workspacePath)
      if (!stats.isDirectory()) {
        Logger.error(`错误: ${this.workspacePath} 不是一个目录`)
        throw new Error(`错误: ${this.workspacePath} 不是一个目录`)
      }
    } catch (error: any) {
      Logger.error(`访问工作区目录 ${this.workspacePath} 时出错:`, error)
      throw new Error(`访问工作区目录 ${this.workspacePath} 时出错:`, error)
    }
  }

  initialize() {
    // 工具处理程序
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: TOOL_READ_FILE,
            description: '读取工作区中的文件内容。提供文件的完整内容，适用于查看单个文件的内容。',
            inputSchema: zodToJsonSchema(ReadFileArgsSchema) as ToolInput
          },
          {
            name: TOOL_WRITE_FILE,
            description: '将内容写入工作区中的文件。如果文件不存在，将创建新文件；如果文件已存在，将覆盖其内容。',
            inputSchema: zodToJsonSchema(WriteFileArgsSchema) as ToolInput
          },
          {
            name: TOOL_SEARCH_FILES,
            description: '在工作区中搜索匹配指定模式的文件。可以使用文件名的一部分或通配符进行搜索。',
            inputSchema: zodToJsonSchema(SearchFilesArgsSchema) as ToolInput
          },
          {
            name: TOOL_LIST_FILES,
            description: '列出工作区中指定目录下的所有文件和子目录。可以选择是否递归列出子目录中的文件。',
            inputSchema: zodToJsonSchema(ListFilesArgsSchema) as ToolInput
          },
          {
            name: TOOL_CREATE_FILE,
            description: '在工作区中创建新文件。如果文件已存在，将返回错误。',
            inputSchema: zodToJsonSchema(CreateFileArgsSchema) as ToolInput
          },
          {
            name: TOOL_EDIT_FILE,
            description: '编辑工作区中的文件，可以替换指定行范围的内容。适用于对文件进行部分修改。',
            inputSchema: zodToJsonSchema(EditFileArgsSchema) as ToolInput
          }
        ]
      }
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        if (!args) {
          throw new McpError(ErrorCode.InvalidParams, `未提供参数: ${name}`)
        }

        switch (name) {
          case TOOL_READ_FILE: {
            const parsed = ReadFileArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new McpError(ErrorCode.InvalidParams, `读取文件的参数无效: ${parsed.error}`)
            }
            const validPath = await validatePath(this.workspacePath, parsed.data.path)
            const content = await fs.readFile(validPath, 'utf-8')
            return {
              content: [{ type: 'text', text: content }]
            }
          }

          case TOOL_WRITE_FILE: {
            const parsed = WriteFileArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new McpError(ErrorCode.InvalidParams, `写入文件的参数无效: ${parsed.error}`)
            }
            const validPath = await validatePath(this.workspacePath, parsed.data.path)
            await fs.writeFile(validPath, parsed.data.content, 'utf-8')
            return {
              content: [{ type: 'text', text: `文件已成功写入: ${parsed.data.path}` }]
            }
          }

          case TOOL_SEARCH_FILES: {
            const parsed = SearchFilesArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new McpError(ErrorCode.InvalidParams, `搜索文件的参数无效: ${parsed.error}`)
            }

            async function searchFiles(
              rootPath: string,
              pattern: string,
              excludePatterns: string[] = []
            ): Promise<string[]> {
              const results: string[] = []

              async function search(currentPath: string, relativePath: string = '') {
                const entries = await fs.readdir(currentPath, { withFileTypes: true })

                for (const entry of entries) {
                  const fullPath = path.join(currentPath, entry.name)
                  const entryRelativePath = path.join(relativePath, entry.name)

                  // 检查是否匹配排除模式
                  const shouldExclude = excludePatterns.some((pattern) => {
                    const globPattern = pattern.includes('*') ? pattern : `**/${pattern}/**`
                    return minimatch(entryRelativePath, globPattern, { dot: true })
                  })

                  if (shouldExclude) {
                    continue
                  }

                  if (
                    entry.name.toLowerCase().includes(pattern.toLowerCase()) ||
                    minimatch(entry.name, pattern, { nocase: true })
                  ) {
                    results.push(entryRelativePath)
                  }

                  if (entry.isDirectory()) {
                    await search(fullPath, entryRelativePath)
                  }
                }
              }

              await search(rootPath)
              return results
            }

            const results = await searchFiles(this.workspacePath, parsed.data.pattern, parsed.data.excludePatterns)

            return {
              content: [
                {
                  type: 'text',
                  text: results.length > 0 ? `找到 ${results.length} 个匹配项:\n${results.join('\n')}` : '未找到匹配项'
                }
              ]
            }
          }

          case TOOL_LIST_FILES: {
            Logger.info(`[WorkspaceFileTool] 收到列出文件请求，参数:`, args)

            const parsed = ListFilesArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `列出文件的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            Logger.info(
              `[WorkspaceFileTool] 解析参数成功: path=${parsed.data.path}, recursive=${parsed.data.recursive}`
            )

            const dirPath = parsed.data.path
              ? await validatePath(this.workspacePath, parsed.data.path)
              : this.workspacePath

            async function listFiles(dirPath: string, recursive: boolean): Promise<string[]> {
              try {
                Logger.info(`[WorkspaceFileTool] 列出目录内容: dirPath=${dirPath}, recursive=${recursive}`)

                // 检查目录是否存在
                try {
                  const stats = await fs.stat(dirPath)
                  if (!stats.isDirectory()) {
                    Logger.error(`[WorkspaceFileTool] 路径不是目录: ${dirPath}`)
                    return [`[错误] 路径不是目录: ${dirPath}`]
                  }
                } catch (error) {
                  Logger.error(`[WorkspaceFileTool] 目录不存在: ${dirPath}`, error)
                  return [`[错误] 目录不存在: ${dirPath}`]
                }

                const results: string[] = []
                const entries = await fs.readdir(dirPath, { withFileTypes: true })

                Logger.info(`[WorkspaceFileTool] 读取到 ${entries.length} 个条目`)

                for (const entry of entries) {
                  try {
                    const fullPath = path.join(dirPath, entry.name)
                    const isDir = entry.isDirectory()

                    results.push(`${isDir ? '[目录]' : '[文件]'} ${entry.name}`)

                    if (isDir && recursive) {
                      try {
                        const subResults = await listFiles(fullPath, recursive)
                        results.push(...subResults.map((item) => `  ${item}`))
                      } catch (subError) {
                        Logger.error(`[WorkspaceFileTool] 读取子目录失败: ${fullPath}`, subError)
                        results.push(`  [错误] 无法读取子目录: ${entry.name}`)
                      }
                    }
                  } catch (entryError) {
                    Logger.error(`[WorkspaceFileTool] 处理目录条目失败: ${entry.name}`, entryError)
                    results.push(`[错误] 无法处理条目: ${entry.name}`)
                  }
                }

                return results
              } catch (error) {
                Logger.error(`[WorkspaceFileTool] 列出文件时出错:`, error)
                return [`[错误] 列出文件时出错: ${error instanceof Error ? error.message : String(error)}`]
              }
            }

            try {
              Logger.info(`[WorkspaceFileTool] 开始列出目录: ${dirPath}`)
              const files = await listFiles(dirPath, parsed.data.recursive)
              const relativeDirPath = path.relative(this.workspacePath, dirPath) || '.'

              Logger.info(`[WorkspaceFileTool] 成功列出目录，找到 ${files.length} 个条目`)

              const resultText = `目录 "${relativeDirPath}" 的内容:\n${files.join('\n')}`
              Logger.info(
                `[WorkspaceFileTool] 返回结果: ${resultText.substring(0, 100)}${resultText.length > 100 ? '...' : ''}`
              )

              return {
                content: [
                  {
                    type: 'text',
                    text: resultText
                  }
                ]
              }
            } catch (error) {
              const errorMsg = `列出目录内容时出错: ${error instanceof Error ? error.message : String(error)}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`, error)

              return {
                content: [
                  {
                    type: 'text',
                    text: `[错误] ${errorMsg}`
                  }
                ]
              }
            }
          }

          case TOOL_CREATE_FILE: {
            const parsed = CreateFileArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new McpError(ErrorCode.InvalidParams, `创建文件的参数无效: ${parsed.error}`)
            }

            const validPath = await validatePath(this.workspacePath, parsed.data.path)

            // 检查文件是否已存在
            try {
              await fs.access(validPath)
              throw new McpError(ErrorCode.InvalidParams, `文件已存在: ${parsed.data.path}`)
            } catch (error: any) {
              // 如果文件不存在，则继续创建
              if (error instanceof McpError) {
                throw error
              }
            }

            // 确保父目录存在
            const parentDir = path.dirname(validPath)
            await fs.mkdir(parentDir, { recursive: true })

            // 创建文件
            await fs.writeFile(validPath, parsed.data.content, 'utf-8')

            return {
              content: [{ type: 'text', text: `文件已成功创建: ${parsed.data.path}` }]
            }
          }

          case TOOL_EDIT_FILE: {
            const parsed = EditFileArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new McpError(ErrorCode.InvalidParams, `编辑文件的参数无效: ${parsed.error}`)
            }

            const validPath = await validatePath(this.workspacePath, parsed.data.path)

            // 读取原始文件内容
            const originalContent = await fs.readFile(validPath, 'utf-8')
            const lines = originalContent.split('\n')

            // 应用更改（从后向前应用，以避免行号变化）
            const sortedChanges = [...parsed.data.changes].sort((a, b) => b.start - a.start)

            for (const change of sortedChanges) {
              if (change.start < 1 || change.end > lines.length || change.start > change.end) {
                throw new McpError(
                  ErrorCode.InvalidParams,
                  `无效的行范围: ${change.start}-${change.end}，文件共有 ${lines.length} 行`
                )
              }

              // 替换指定行范围的内容
              const beforeLines = lines.slice(0, change.start - 1)
              const afterLines = lines.slice(change.end)
              const newLines = change.content.split('\n')

              lines.splice(0, lines.length, ...beforeLines, ...newLines, ...afterLines)
            }

            // 写入修改后的内容
            const newContent = lines.join('\n')
            await fs.writeFile(validPath, newContent, 'utf-8')

            // 生成差异信息
            const diff = createTwoFilesPatch(parsed.data.path, parsed.data.path, originalContent, newContent)

            return {
              content: [
                {
                  type: 'text',
                  text: `文件已成功编辑: ${parsed.data.path}\n\n差异信息:\n${diff}`
                }
              ]
            }
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `未知工具: ${name}`)
        }
      } catch (error) {
        Logger.error(`[WorkspaceFileTool] 调用工具时出错:`, error)

        if (error instanceof McpError) {
          throw error
        }

        throw new McpError(
          ErrorCode.InternalError,
          `调用工具时出错: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    })
  }
}
