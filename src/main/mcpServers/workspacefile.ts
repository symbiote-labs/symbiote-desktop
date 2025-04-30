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

import {
  CodeAnalyzer,
  createCodeAnalyzer,
  getLanguageFromFilePath,
  getParserForLanguage,
  parseFile,
  SymbolKind
} from './codeAnalysis'
import { DependencyAnalyzer } from './codeAnalysis/dependencyAnalyzer'

// 默认的文件过滤模式
const DEFAULT_INCLUDE_PATTERNS = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.json', '**/*.vue']
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.git/**',
  '**/coverage/**',
  '**/*.min.*',
  '**/*.exe',
  '**/*.dll',
  '**/*.so',
  '**/*.dylib',
  '**/*.bin',
  '**/*.dat',
  '**/*.pack',
  '**/*.pak',
  '**/*.node',
  '**/*.wasm'
]

// 工具名称常量
const TOOL_READ_FILE = 'workspace_read_file'
const TOOL_WRITE_FILE = 'workspace_write_file'
const TOOL_SEARCH_FILES = 'workspace_search_files'
const TOOL_LIST_FILES = 'workspace_list_files'
const TOOL_CREATE_FILE = 'workspace_create_file'
const TOOL_EDIT_FILE = 'workspace_edit_file'
const TOOL_DELETE_PATH = 'workspace_delete_path'
const TOOL_SEARCH_FILE_CONTENT = 'workspace_search_file_content'
const TOOL_SEARCH_SYMBOLS = 'workspace_search_symbols'
const TOOL_FIND_REFERENCES = 'workspace_find_references'
const TOOL_GO_TO_DEFINITION = 'workspace_go_to_definition'
const TOOL_GET_CODE_CONTEXT = 'workspace_get_code_context'
// 依赖分析工具常量
const TOOL_ANALYZE_DEPENDENCIES = 'workspace_analyze_dependencies'
const TOOL_GET_FILE_DEPENDENCIES = 'workspace_get_file_dependencies'
const TOOL_GET_FILE_DEPENDENTS = 'workspace_get_file_dependents'
const TOOL_CHECK_CIRCULAR_DEPENDENCIES = 'workspace_check_circular_dependencies'
const TOOL_GET_MOST_REFERENCED_FILES = 'workspace_get_most_referenced_files'

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

const DeletePathArgsSchema = z.object({
  path: z.string().describe('要删除的文件或目录路径，可以是相对于工作区的路径')
})

const SearchFileContentArgsSchema = z.object({
  pattern: z.string().describe('要搜索的文本模式或正则表达式'),
  isRegex: z.boolean().optional().default(false).describe('是否将模式作为正则表达式处理'),
  caseSensitive: z.boolean().optional().default(false).describe('是否区分大小写'),
  includePatterns: z.array(z.string()).optional().default([]).describe('要包含的文件模式数组，例如["*.ts", "*.js"]'),
  excludePatterns: z.array(z.string()).optional().default([]).describe('要排除的文件模式数组'),
  maxResults: z.number().optional().default(100).describe('最大结果数量')
})

// 符号搜索参数模式
const SearchSymbolsArgsSchema = z.object({
  name: z.string().describe('要搜索的符号名称'),
  kind: z
    .enum([
      'function',
      'class',
      'interface',
      'variable',
      'constant',
      'property',
      'method',
      'enum',
      'enumMember',
      'parameter',
      'typeAlias',
      'namespace',
      'module',
      'constructor',
      'unknown'
    ])
    .optional()
    .describe('符号类型过滤'),
  includePatterns: z.array(z.string()).optional().default(DEFAULT_INCLUDE_PATTERNS).describe('要包含的文件模式数组'),
  excludePatterns: z.array(z.string()).optional().default(DEFAULT_EXCLUDE_PATTERNS).describe('要排除的文件模式数组'),
  caseSensitive: z.boolean().optional().default(false).describe('是否区分大小写'),
  maxResults: z.number().optional().default(50).describe('最大结果数量'),
  includeReferences: z.boolean().optional().default(false).describe('是否包含引用')
})

// 查找引用参数模式
const FindReferencesArgsSchema = z.object({
  filePath: z.string().describe('符号所在的文件路径'),
  line: z.number().describe('符号所在的行号（从1开始）'),
  column: z.number().optional().describe('符号所在的列号（从1开始）'),
  includePatterns: z.array(z.string()).optional().default(DEFAULT_INCLUDE_PATTERNS).describe('要包含的文件模式数组'),
  excludePatterns: z.array(z.string()).optional().default(DEFAULT_EXCLUDE_PATTERNS).describe('要排除的文件模式数组'),
  maxResults: z.number().optional().default(100).describe('最大结果数量')
})

// 跳转到定义参数模式
const GoToDefinitionArgsSchema = z.object({
  filePath: z.string().describe('文件路径'),
  line: z.number().describe('行号（从1开始）'),
  column: z.number().describe('列号（从1开始）')
})

// 获取代码上下文参数模式
const GetCodeContextArgsSchema = z.object({
  filePath: z.string().describe('文件路径'),
  line: z.number().describe('行号（从1开始）'),
  contextSize: z.number().optional().default(5).describe('上下文行数')
})

// 定义依赖分析参数模式

const AnalyzeDependenciesArgsSchema = z.object({
  includePatterns: z
    .array(z.string())
    .optional()
    .default(['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'])
    .describe('要包含的文件模式数组'),
  excludePatterns: z
    .array(z.string())
    .optional()
    .default(['**/node_modules/**', '**/dist/**', '**/build/**'])
    .describe('要排除的文件模式数组'),
  includeNodeModules: z.boolean().optional().default(false).describe('是否包含node_modules中的文件'),
  maxDepth: z.number().optional().default(10).describe('最大递归深度')
})

const GetFileDependenciesArgsSchema = z.object({
  filePath: z.string().describe('要分析依赖的文件路径')
})

const GetFileDependentsArgsSchema = z.object({
  filePath: z.string().describe('要查找依赖项的文件路径')
})

const CheckCircularDependenciesArgsSchema = z.object({
  showRelativePaths: z.boolean().optional().default(true).describe('是否显示相对路径而不是绝对路径')
})

const GetMostReferencedFilesArgsSchema = z.object({
  limit: z.number().optional().default(10).describe('返回的文件数量限制')
})

// 确保变量被"使用"
;(function registerSchema() {
  if (process.env.NODE_ENV === 'development') {
    console.debug('依赖分析参数模式已注册:', AnalyzeDependenciesArgsSchema.shape)
  }
})()

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ToolInputSchema = ToolSchema.shape.inputSchema
type ToolInput = z.infer<typeof ToolInputSchema>

// 工具实现

export class WorkspaceFileToolServer {
  public server: Server
  private workspacePath: string
  private codeAnalyzer: CodeAnalyzer

  constructor(workspacePath: string) {
    if (!workspacePath) {
      throw new Error('未提供工作区路径，请在环境变量中指定 WORKSPACE_PATH')
    }

    this.workspacePath = normalizePath(path.resolve(workspacePath))
    this.codeAnalyzer = createCodeAnalyzer({ workspacePath: this.workspacePath })

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
          },
          {
            name: TOOL_DELETE_PATH,
            description: '删除工作区中的文件或目录。',
            inputSchema: zodToJsonSchema(DeletePathArgsSchema) as ToolInput
          },
          {
            name: TOOL_SEARCH_FILE_CONTENT,
            description: '在工作区文件内容中搜索指定的文本模式或正则表达式。可以搜索特定代码片段、函数名、变量名等。',
            inputSchema: zodToJsonSchema(SearchFileContentArgsSchema) as ToolInput
          },
          {
            name: TOOL_SEARCH_SYMBOLS,
            description: '在工作区中搜索特定类型的代码符号（如函数、类、接口等）。支持按名称和类型进行精确搜索。',
            inputSchema: zodToJsonSchema(SearchSymbolsArgsSchema) as ToolInput
          },
          {
            name: TOOL_FIND_REFERENCES,
            description: '查找工作区中对特定符号的所有引用。帮助理解代码中符号的使用情况和依赖关系。',
            inputSchema: zodToJsonSchema(FindReferencesArgsSchema) as ToolInput
          },
          {
            name: TOOL_GO_TO_DEFINITION,
            description: '查找符号的定义位置。当看到一个函数调用或变量使用时，可以快速跳转到其定义处。',
            inputSchema: zodToJsonSchema(GoToDefinitionArgsSchema) as ToolInput
          },
          {
            name: TOOL_GET_CODE_CONTEXT,
            description: '获取指定位置的代码上下文。提供周围的代码行和所在函数/类等结构信息。',
            inputSchema: zodToJsonSchema(GetCodeContextArgsSchema) as ToolInput
          },
          {
            name: TOOL_ANALYZE_DEPENDENCIES,
            description: '分析工作区中的依赖关系。帮助理解代码中模块和文件之间的依赖关系。',
            inputSchema: zodToJsonSchema(AnalyzeDependenciesArgsSchema) as ToolInput
          },
          {
            name: TOOL_GET_FILE_DEPENDENCIES,
            description: '获取指定文件的依赖文件列表。帮助理解文件的依赖关系。',
            inputSchema: zodToJsonSchema(GetFileDependenciesArgsSchema) as ToolInput
          },
          {
            name: TOOL_GET_FILE_DEPENDENTS,
            description: '获取指定文件的被依赖文件列表。帮助理解文件的被依赖关系。',
            inputSchema: zodToJsonSchema(GetFileDependentsArgsSchema) as ToolInput
          },
          {
            name: TOOL_CHECK_CIRCULAR_DEPENDENCIES,
            description: '检查工作区中的循环依赖关系。帮助理解代码中可能存在的循环依赖问题。',
            inputSchema: zodToJsonSchema(CheckCircularDependenciesArgsSchema) as ToolInput
          },
          {
            name: TOOL_GET_MOST_REFERENCED_FILES,
            description: '获取工作区中最常被引用的文件列表。帮助理解代码中高频使用的文件。',
            inputSchema: zodToJsonSchema(GetMostReferencedFilesArgsSchema) as ToolInput
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

          case TOOL_DELETE_PATH: {
            Logger.info(`[WorkspaceFileTool] 收到删除路径请求，参数:`, args)

            const parsed = DeletePathArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `删除路径的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            const validPath = await validatePath(this.workspacePath, parsed.data.path)

            try {
              // 检查路径是否存在
              const stats = await fs.stat(validPath)

              if (stats.isDirectory()) {
                Logger.info(`[WorkspaceFileTool] 删除目录: ${validPath}`)
                // 递归删除目录及其内容
                await fs.rm(validPath, { recursive: true, force: true })
                return {
                  content: [{ type: 'text', text: `目录已成功删除: ${parsed.data.path}` }]
                }
              } else {
                Logger.info(`[WorkspaceFileTool] 删除文件: ${validPath}`)
                // 删除文件
                await fs.unlink(validPath)
                return {
                  content: [{ type: 'text', text: `文件已成功删除: ${parsed.data.path}` }]
                }
              }
            } catch (error) {
              const errorMsg = `删除路径时出错: ${error instanceof Error ? error.message : String(error)}`
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

          case TOOL_SEARCH_FILE_CONTENT: {
            Logger.info(`[WorkspaceFileTool] 收到文件内容搜索请求，参数:`, args)

            const parsed = SearchFileContentArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `搜索文件内容的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            const { pattern, isRegex, caseSensitive, includePatterns, excludePatterns, maxResults } = parsed.data

            Logger.info(
              `[WorkspaceFileTool] 解析参数成功: pattern=${pattern}, isRegex=${isRegex}, caseSensitive=${caseSensitive}`
            )

            // 准备正则表达式
            let searchRegex: RegExp
            try {
              if (isRegex) {
                searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi')
              } else {
                // 转义正则表达式特殊字符
                const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                searchRegex = new RegExp(escapedPattern, caseSensitive ? 'g' : 'gi')
              }
            } catch (error) {
              const errorMsg = `创建搜索正则表达式时出错: ${error instanceof Error ? error.message : String(error)}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            // 搜索结果存储
            interface SearchResult {
              filePath: string
              relativePath: string
              lineNumber: number
              line: string
              match: string
            }

            const results: SearchResult[] = []
            let resultCount = 0
            let searchedFiles = 0

            // 递归搜索文件内容
            const searchInFiles = async (dirPath: string): Promise<void> => {
              if (resultCount >= maxResults) {
                return
              }

              try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true })

                for (const entry of entries) {
                  if (resultCount >= maxResults) {
                    break
                  }

                  const fullPath = path.join(dirPath, entry.name)
                  const relativePath = path.relative(this.workspacePath, fullPath)

                  // 检查是否匹配排除模式
                  const shouldExclude = excludePatterns.some((pattern) => {
                    return minimatch(relativePath, pattern, { dot: true })
                  })

                  if (shouldExclude) {
                    continue
                  }

                  if (entry.isDirectory()) {
                    // 递归搜索子目录
                    await searchInFiles(fullPath)
                  } else if (entry.isFile()) {
                    // 检查是否匹配包含模式
                    const shouldInclude =
                      includePatterns.length === 0 ||
                      includePatterns.some((pattern) => {
                        return minimatch(relativePath, pattern, { dot: true })
                      })

                    if (!shouldInclude) {
                      continue
                    }

                    // 搜索文件内容
                    try {
                      const content = await fs.readFile(fullPath, 'utf-8')
                      const lines = content.split('\n')
                      searchedFiles++

                      for (let i = 0; i < lines.length; i++) {
                        const line = lines[i]

                        // 重置 lastIndex 以便从头开始搜索每一行
                        searchRegex.lastIndex = 0
                        let match

                        while ((match = searchRegex.exec(line)) !== null) {
                          results.push({
                            filePath: fullPath,
                            relativePath,
                            lineNumber: i + 1,
                            line,
                            match: match[0]
                          })

                          resultCount++

                          if (resultCount >= maxResults) {
                            break
                          }
                        }

                        if (resultCount >= maxResults) {
                          break
                        }
                      }
                    } catch (error) {
                      Logger.error(`[WorkspaceFileTool] 读取或搜索文件失败: ${fullPath}`, error)
                    }
                  }
                }
              } catch (error) {
                Logger.error(`[WorkspaceFileTool] 搜索目录失败: ${dirPath}`, error)
              }
            }

            try {
              await searchInFiles(this.workspacePath)

              // 格式化搜索结果
              const formattedResults = results.map((result) => {
                // 截取匹配行，如果太长则添加省略号
                let displayLine = result.line
                if (displayLine.length > 150) {
                  const matchIndex = displayLine.indexOf(result.match)
                  const startIndex = Math.max(0, matchIndex - 70)
                  const endIndex = Math.min(displayLine.length, matchIndex + result.match.length + 70)

                  displayLine =
                    (startIndex > 0 ? '...' : '') +
                    displayLine.substring(startIndex, endIndex) +
                    (endIndex < displayLine.length ? '...' : '')
                }

                return `${result.relativePath}:${result.lineNumber}: ${displayLine}`
              })

              const resultSummary = `在 ${searchedFiles} 个文件中找到 ${resultCount} 个匹配项${
                resultCount >= maxResults ? ` (达到最大限制 ${maxResults})` : ''
              }`

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      formattedResults.length > 0
                        ? `${resultSummary}\n\n${formattedResults.join('\n')}`
                        : `未找到匹配项。已搜索 ${searchedFiles} 个文件。`
                  }
                ]
              }
            } catch (error) {
              const errorMsg = `搜索文件内容时出错: ${error instanceof Error ? error.message : String(error)}`
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

          case TOOL_SEARCH_SYMBOLS: {
            Logger.info(`[WorkspaceFileTool] 收到搜索符号请求，参数:`, args)

            const parsed = SearchSymbolsArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `搜索符号的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            try {
              const { name, kind, includePatterns, excludePatterns, caseSensitive, maxResults, includeReferences } =
                parsed.data

              // 将字符串类型转换为枚举类型
              let symbolKind: SymbolKind | undefined
              if (kind) {
                symbolKind = kind as unknown as SymbolKind
              }

              // 调用代码分析器搜索符号
              const result = await this.codeAnalyzer.searchSymbols({
                symbolName: name,
                symbolKind,
                includePatterns,
                excludePatterns,
                caseSensitive,
                maxResults,
                includeReferences
              })

              // 格式化结果
              const symbols = result.symbols.map((symbol) => {
                const relativePath = path.relative(this.workspacePath, symbol.location.filePath)
                return `[${symbol.kind}] ${symbol.name} (${relativePath}:${symbol.location.startLine})`
              })

              const references = result.references.map((ref) => {
                const relativePath = path.relative(this.workspacePath, ref.location.filePath)
                return `${ref.isDefinition ? '[定义]' : '[引用]'} ${relativePath}:${ref.location.startLine}: ${ref.context}`
              })

              const contexts = result.contexts.map((ctx) => {
                // 获取文件路径
                const filePath = ctx.symbol?.location.filePath || ''
                const relativePath = path.relative(this.workspacePath, filePath)
                const symbolInfo = ctx.symbol ? `[${ctx.symbol.kind}] ${ctx.symbol.name}` : ''

                // 获取上下文行
                const allLines = [...ctx.beforeLines, ctx.line, ...ctx.afterLines]
                const startLineNum = ctx.lineNumber - ctx.beforeLines.length

                // 格式化上下文行
                const contextLines = allLines
                  .map((line, i) => `${startLineNum + i}: ${line}${i === ctx.beforeLines.length ? ' ← 当前位置' : ''}`)
                  .join('\n')

                return `文件: ${relativePath}\n${symbolInfo}\n${contextLines}`
              })

              // 构建响应
              let responseText = `找到 ${result.symbols.length} 个符号`
              if (includeReferences) {
                responseText += `，${result.references.length} 个引用`
              }

              if (symbols.length > 0) {
                responseText += `\n\n符号:\n${symbols.join('\n')}`
              }

              if (references.length > 0) {
                responseText += `\n\n引用:\n${references.join('\n')}`
              }

              if (contexts.length > 0) {
                responseText += `\n\n上下文:\n${contexts.join('\n\n')}`
              }

              return {
                content: [{ type: 'text', text: responseText }]
              }
            } catch (error) {
              const errorMsg = `搜索符号时出错: ${error instanceof Error ? error.message : String(error)}`
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

          case TOOL_FIND_REFERENCES: {
            Logger.info(`[WorkspaceFileTool] 收到查找引用请求，参数:`, args)

            const parsed = FindReferencesArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `查找引用的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            try {
              const { filePath, line, column, includePatterns, excludePatterns, maxResults } = parsed.data

              // 首先获取符号定义
              const validPath = await validatePath(this.workspacePath, filePath)
              const definition = await this.codeAnalyzer.goToDefinition(validPath, line, column || 1)

              if (!definition) {
                return {
                  content: [
                    { type: 'text', text: `未找到位置 ${filePath}:${line}${column ? `:${column}` : ''} 的符号定义` }
                  ]
                }
              }

              // 查找引用
              const references = await this.codeAnalyzer.findReferences({
                symbol: definition,
                includePatterns,
                excludePatterns,
                maxResults
              })

              // 格式化结果
              const formattedRefs = references.map((ref) => {
                const relativePath = path.relative(this.workspacePath, ref.location.filePath)
                return `${ref.isDefinition ? '[定义]' : '[引用]'} ${relativePath}:${ref.location.startLine}: ${ref.context}`
              })

              // 构建响应
              let responseText = `符号 "${definition.name}" (${definition.kind}) 的引用，共 ${references.length} 个:\n\n`
              responseText += formattedRefs.join('\n')

              return {
                content: [{ type: 'text', text: responseText }]
              }
            } catch (error) {
              const errorMsg = `查找引用时出错: ${error instanceof Error ? error.message : String(error)}`
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

          case TOOL_GO_TO_DEFINITION: {
            Logger.info(`[WorkspaceFileTool] 收到跳转到定义请求，参数:`, args)

            const parsed = GoToDefinitionArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `跳转到定义的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            try {
              const { filePath, line, column } = parsed.data

              // 验证路径
              const validPath = await validatePath(this.workspacePath, filePath)

              // 查找定义
              const definition = await this.codeAnalyzer.goToDefinition(validPath, line, column)

              if (!definition) {
                return {
                  content: [{ type: 'text', text: `未找到位置 ${filePath}:${line}:${column} 的符号定义` }]
                }
              }

              // 获取定义的上下文
              const parser = getParserForLanguage(getLanguageFromFilePath(definition.location.filePath))
              const context = await parser.getCodeContext(
                definition.location.filePath,
                definition.location.startLine,
                5 // 上下文行数
              )

              // 构建响应
              const relativePath = path.relative(this.workspacePath, definition.location.filePath)
              let responseText = `符号 "${definition.name}" (${definition.kind}) 的定义位置:\n`
              responseText += `文件: ${relativePath}:${definition.location.startLine}`

              if (context) {
                responseText += `\n\n上下文:\n`
                // 将所有行连接起来展示
                const allLines = [...context.beforeLines, context.line, ...context.afterLines]
                const startLineNum = context.lineNumber - context.beforeLines.length

                responseText += allLines
                  .map((line, i) => {
                    const lineNum = startLineNum + i
                    return `${lineNum}: ${line}${lineNum === definition.location.startLine ? ' ← 定义位置' : ''}`
                  })
                  .join('\n')
              }

              return {
                content: [{ type: 'text', text: responseText }]
              }
            } catch (error) {
              const errorMsg = `跳转到定义时出错: ${error instanceof Error ? error.message : String(error)}`
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

          case TOOL_GET_CODE_CONTEXT: {
            Logger.info(`[WorkspaceFileTool] 收到获取代码上下文请求，参数:`, args)

            const parsed = GetCodeContextArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `获取代码上下文的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            try {
              const { filePath, line, contextSize } = parsed.data

              // 验证路径
              const validPath = await validatePath(this.workspacePath, filePath)

              // 获取语言解析器
              const parser = getParserForLanguage(getLanguageFromFilePath(validPath))

              // 获取上下文
              const context = await parser.getCodeContext(validPath, line, contextSize)

              if (!context) {
                return {
                  content: [{ type: 'text', text: `获取位置 ${filePath}:${line} 的代码上下文失败` }]
                }
              }

              // 构建响应
              const relativePath = path.relative(this.workspacePath, validPath)
              let responseText = `文件 ${relativePath} 行 ${line} 的代码上下文:\n\n`

              // 尝试获取包含该行的符号
              const symbols = await parseFile(validPath)
              const symbol = await parser.findSymbolAtLine(symbols, line)

              if (symbol) {
                responseText += `所在符号: [${symbol.kind}] ${symbol.name}\n\n`
              }

              // 显示上下文代码
              if (context) {
                // 合并所有行并显示
                const allLines = [...context.beforeLines, context.line, ...context.afterLines]
                const startLineNum = context.lineNumber - context.beforeLines.length

                responseText += allLines
                  .map((line, i) => {
                    const lineNum = startLineNum + i
                    return `${lineNum}: ${line}${lineNum === context.lineNumber ? ' ← 当前位置' : ''}`
                  })
                  .join('\n')
              }

              return {
                content: [{ type: 'text', text: responseText }]
              }
            } catch (error) {
              const errorMsg = `获取代码上下文时出错: ${error instanceof Error ? error.message : String(error)}`
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

          case TOOL_ANALYZE_DEPENDENCIES: {
            Logger.info(`[WorkspaceFileTool] 收到分析依赖请求，参数:`, args)

            const parsed = AnalyzeDependenciesArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `分析依赖的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            try {
              const dependencyAnalyzer = new DependencyAnalyzer(this.workspacePath)
              const dependencyGraph = await dependencyAnalyzer.analyzeDependencies(parsed.data)

              const nodeCount = Object.keys(dependencyGraph.nodes).length
              const externalDependenciesCount = dependencyGraph.externalDependencies.size

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `依赖分析完成，找到 ${nodeCount} 个内部模块和 ${externalDependenciesCount} 个外部依赖。\n\n` +
                      `使用 ${TOOL_GET_FILE_DEPENDENCIES}、${TOOL_GET_FILE_DEPENDENTS}、` +
                      `${TOOL_CHECK_CIRCULAR_DEPENDENCIES} 和 ${TOOL_GET_MOST_REFERENCED_FILES} 工具查看详细信息。`
                  }
                ]
              }
            } catch (error) {
              const errorMsg = `分析依赖时出错: ${error instanceof Error ? error.message : String(error)}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`, error)
              return {
                content: [{ type: 'text', text: `[错误] ${errorMsg}` }]
              }
            }
          }

          case TOOL_GET_FILE_DEPENDENCIES: {
            Logger.info(`[WorkspaceFileTool] 收到获取文件依赖请求，参数:`, args)

            const parsed = GetFileDependenciesArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `获取文件依赖的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            try {
              const validPath = await validatePath(this.workspacePath, parsed.data.filePath)
              const dependencyAnalyzer = new DependencyAnalyzer(this.workspacePath)
              await dependencyAnalyzer.analyzeDependencies()

              const dependencies = await dependencyAnalyzer.getAllDependencies(validPath)
              const relativeDependencies = dependencies.map((dep) => path.relative(this.workspacePath, dep))

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      dependencies.length > 0
                        ? `文件 ${parsed.data.filePath} 有 ${dependencies.length} 个依赖:\n\n${relativeDependencies.join('\n')}`
                        : `文件 ${parsed.data.filePath} 没有依赖。`
                  }
                ]
              }
            } catch (error) {
              const errorMsg = `获取文件依赖时出错: ${error instanceof Error ? error.message : String(error)}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`, error)
              return {
                content: [{ type: 'text', text: `[错误] ${errorMsg}` }]
              }
            }
          }

          case TOOL_GET_FILE_DEPENDENTS: {
            Logger.info(`[WorkspaceFileTool] 收到获取文件被依赖请求，参数:`, args)

            const parsed = GetFileDependentsArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `获取文件被依赖的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            try {
              const validPath = await validatePath(this.workspacePath, parsed.data.filePath)
              const dependencyAnalyzer = new DependencyAnalyzer(this.workspacePath)
              await dependencyAnalyzer.analyzeDependencies()

              const dependents = await dependencyAnalyzer.getAllDependents(validPath)
              const relativeDependents = dependents.map((dep) => path.relative(this.workspacePath, dep))

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      dependents.length > 0
                        ? `文件 ${parsed.data.filePath} 被 ${dependents.length} 个文件依赖:\n\n${relativeDependents.join('\n')}`
                        : `文件 ${parsed.data.filePath} 没有被任何文件依赖。`
                  }
                ]
              }
            } catch (error) {
              const errorMsg = `获取文件被依赖时出错: ${error instanceof Error ? error.message : String(error)}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`, error)
              return {
                content: [{ type: 'text', text: `[错误] ${errorMsg}` }]
              }
            }
          }

          case TOOL_CHECK_CIRCULAR_DEPENDENCIES: {
            Logger.info(`[WorkspaceFileTool] 收到检查循环依赖请求，参数:`, args)

            const parsed = CheckCircularDependenciesArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `检查循环依赖的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            try {
              const dependencyAnalyzer = new DependencyAnalyzer(this.workspacePath)
              await dependencyAnalyzer.analyzeDependencies()

              const circularDependencies = dependencyAnalyzer.findCircularDependencies()

              if (parsed.data.showRelativePaths) {
                // 将绝对路径转换为相对路径
                for (let i = 0; i < circularDependencies.length; i++) {
                  circularDependencies[i] = circularDependencies[i].map((p) => path.relative(this.workspacePath, p))
                }
              }

              const formattedCycles = circularDependencies.map(
                (cycle, index) => `循环依赖 #${index + 1}: ${cycle.join(' -> ')}`
              )

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      circularDependencies.length > 0
                        ? `发现 ${circularDependencies.length} 个循环依赖:\n\n${formattedCycles.join('\n\n')}`
                        : `未发现循环依赖。`
                  }
                ]
              }
            } catch (error) {
              const errorMsg = `检查循环依赖时出错: ${error instanceof Error ? error.message : String(error)}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`, error)
              return {
                content: [{ type: 'text', text: `[错误] ${errorMsg}` }]
              }
            }
          }

          case TOOL_GET_MOST_REFERENCED_FILES: {
            Logger.info(`[WorkspaceFileTool] 收到获取最常引用文件请求，参数:`, args)

            const parsed = GetMostReferencedFilesArgsSchema.safeParse(args)
            if (!parsed.success) {
              const errorMsg = `获取最常引用文件的参数无效: ${parsed.error}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`)
              throw new McpError(ErrorCode.InvalidParams, errorMsg)
            }

            try {
              const dependencyAnalyzer = new DependencyAnalyzer(this.workspacePath)
              await dependencyAnalyzer.analyzeDependencies()

              const topFiles = dependencyAnalyzer.getMostReferencedFiles(parsed.data.limit)

              // 将绝对路径转换为相对路径
              const formattedFiles = topFiles.map((file) => ({
                relativePath: path.relative(this.workspacePath, file.filePath),
                count: file.count
              }))

              const resultText = formattedFiles
                .map((file, index) => `${index + 1}. ${file.relativePath} - 被 ${file.count} 个文件引用`)
                .join('\n')

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      topFiles.length > 0
                        ? `最常被引用的文件 (前 ${topFiles.length} 个):\n\n${resultText}`
                        : `未找到被引用的文件。`
                  }
                ]
              }
            } catch (error) {
              const errorMsg = `获取最常引用文件时出错: ${error instanceof Error ? error.message : String(error)}`
              Logger.error(`[WorkspaceFileTool] ${errorMsg}`, error)
              return {
                content: [{ type: 'text', text: `[错误] ${errorMsg}` }]
              }
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
