// src/main/mcpServers/codeAnalysis/searcher.ts
// 代码搜索器：实现符号搜索、查找引用和上下文分析功能

import Logger from 'electron-log'
import * as fs from 'fs/promises'
import { minimatch } from 'minimatch'
import * as path from 'path'

import { getLanguageFromFilePath, getParserForLanguage, parseFile } from './parser'
import { CodeSymbol, Reference, SearchResult, SymbolKind } from './types'

// 用于符号搜索的选项
export interface SymbolSearchOptions {
  symbolName: string // 要搜索的符号名称
  symbolKind?: SymbolKind // 符号类型过滤
  includePatterns?: string[] // 要包含的文件模式
  excludePatterns?: string[] // 要排除的文件模式
  caseSensitive?: boolean // 是否区分大小写
  maxResults?: number // 最大结果数量
  includeReferences?: boolean // 是否包含引用
}

// 用于查找引用的选项
export interface ReferenceSearchOptions {
  symbol: CodeSymbol // 要查找引用的符号
  includePatterns?: string[] // 要包含的文件模式
  excludePatterns?: string[] // 要排除的文件模式
  maxResults?: number // 最大结果数量
}

// 代码搜索类
export class CodeSearcher {
  private workspacePath: string
  private symbolCache: Map<string, CodeSymbol[]> = new Map()

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
  }

  // 搜索符号
  async searchSymbols(options: SymbolSearchOptions): Promise<SearchResult> {
    const {
      symbolName,
      symbolKind,
      includePatterns = [],
      excludePatterns = [],
      caseSensitive = false,
      maxResults = 100,
      includeReferences = false
    } = options

    Logger.info(`[CodeSearcher] 开始搜索符号: ${symbolName}`)

    const result: SearchResult = {
      symbols: [],
      references: [],
      contexts: []
    }

    // 判断文件是否应该被处理
    const shouldProcessFile = (filePath: string): boolean => {
      const relativePath = path.relative(this.workspacePath, filePath)

      // 检查排除模式
      if (excludePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))) {
        return false
      }

      // 检查包含模式
      if (
        includePatterns.length > 0 &&
        !includePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))
      ) {
        return false
      }

      return true
    }

    // 递归搜索符号
    const searchDirectory = async (dirPath: string): Promise<void> => {
      if (result.symbols.length >= maxResults) {
        return
      }

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          if (result.symbols.length >= maxResults) {
            break
          }

          const fullPath = path.join(dirPath, entry.name)

          if (entry.isDirectory()) {
            // 递归处理子目录
            await searchDirectory(fullPath)
          } else if (entry.isFile() && shouldProcessFile(fullPath)) {
            // 处理文件
            await this.searchSymbolsInFile(fullPath, {
              symbolName,
              symbolKind,
              caseSensitive,
              maxResults: maxResults - result.symbols.length,
              result
            })
          }
        }
      } catch (error) {
        Logger.error(`[CodeSearcher] 搜索目录失败: ${dirPath}`, error)
      }
    }

    // 开始搜索
    await searchDirectory(this.workspacePath)

    // 如果需要，查找引用
    if (includeReferences && result.symbols.length > 0) {
      for (const symbol of result.symbols) {
        if (result.references.length >= maxResults) {
          break
        }

        const refOptions: ReferenceSearchOptions = {
          symbol,
          includePatterns,
          excludePatterns,
          maxResults: maxResults - result.references.length
        }

        const references = await this.findReferences(refOptions)
        result.references.push(...references)
      }
    }

    // 获取代码上下文
    for (const symbol of result.symbols) {
      try {
        const parser = getParserForLanguage(getLanguageFromFilePath(symbol.location.filePath))
        const context = await parser.getCodeContext(
          symbol.location.filePath,
          symbol.location.startLine,
          5 // 上下文行数
        )

        if (context) {
          context.symbol = symbol
          result.contexts.push(context)
        }
      } catch (error) {
        Logger.error(`[CodeSearcher] 获取符号上下文失败: ${symbol.name}`, error)
      }
    }

    Logger.info(`[CodeSearcher] 符号搜索完成，找到 ${result.symbols.length} 个符号，${result.references.length} 个引用`)
    return result
  }

  // 在单个文件中搜索符号
  private async searchSymbolsInFile(
    filePath: string,
    options: {
      symbolName: string
      symbolKind?: SymbolKind
      caseSensitive: boolean
      maxResults: number
      result: SearchResult
    }
  ): Promise<void> {
    try {
      // 获取或解析文件中的符号
      let symbols = this.symbolCache.get(filePath)
      if (!symbols) {
        symbols = await parseFile(filePath)
        this.symbolCache.set(filePath, symbols)
      }

      // 过滤符号
      const { symbolName, symbolKind, caseSensitive, result } = options
      const regex = new RegExp(`^${symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, caseSensitive ? '' : 'i')

      for (const symbol of symbols) {
        if (regex.test(symbol.name) && (!symbolKind || symbol.kind === symbolKind)) {
          result.symbols.push(symbol)

          if (result.symbols.length >= options.maxResults) {
            break
          }
        }
      }
    } catch (error) {
      Logger.error(`[CodeSearcher] 搜索文件中的符号失败: ${filePath}`, error)
    }
  }

  // 查找符号的引用
  async findReferences(options: ReferenceSearchOptions): Promise<Reference[]> {
    const { symbol, includePatterns = [], excludePatterns = [], maxResults = 100 } = options

    Logger.info(`[CodeSearcher] 开始查找符号的引用: ${symbol.name}`)

    const references: Reference[] = []

    // 将定义添加为第一个引用
    references.push({
      symbol,
      location: symbol.location,
      isDefinition: true,
      context: await this.getLineContent(symbol.location.filePath, symbol.location.startLine)
    })

    // 判断文件是否应该被处理
    const shouldProcessFile = (filePath: string): boolean => {
      const relativePath = path.relative(this.workspacePath, filePath)

      // 检查排除模式
      if (excludePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))) {
        return false
      }

      // 检查包含模式
      if (
        includePatterns.length > 0 &&
        !includePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))
      ) {
        return false
      }

      return true
    }

    // 搜索引用
    const searchReferencesInFiles = async (dirPath: string): Promise<void> => {
      if (references.length >= maxResults) {
        return
      }

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          if (references.length >= maxResults) {
            break
          }

          const fullPath = path.join(dirPath, entry.name)

          if (entry.isDirectory()) {
            // 递归处理子目录
            await searchReferencesInFiles(fullPath)
          } else if (entry.isFile() && shouldProcessFile(fullPath)) {
            // 处理文件，搜索符号的引用
            await this.searchReferencesInFile(fullPath, {
              symbol,
              maxResults: maxResults - references.length,
              references
            })
          }
        }
      } catch (error) {
        Logger.error(`[CodeSearcher] 搜索目录引用失败: ${dirPath}`, error)
      }
    }

    // 开始搜索
    await searchReferencesInFiles(this.workspacePath)

    Logger.info(`[CodeSearcher] 引用搜索完成，找到 ${references.length} 个引用`)
    return references
  }

  // 在单个文件中搜索引用
  private async searchReferencesInFile(
    filePath: string,
    options: {
      symbol: CodeSymbol
      maxResults: number
      references: Reference[]
    }
  ): Promise<void> {
    try {
      const { symbol, references } = options

      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      // 创建针对符号的正则表达式
      // 注意：这是一个简单的文本匹配，实际上应该使用更复杂的语法分析
      const regex = new RegExp(`\\b${symbol.name}\\b`, 'g')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineNumber = i + 1

        // 重置正则表达式的lastIndex
        regex.lastIndex = 0

        // 查找引用
        let match
        while ((match = regex.exec(line)) !== null) {
          // 排除自身定义
          if (filePath === symbol.location.filePath && lineNumber === symbol.location.startLine) {
            continue
          }

          // 创建引用
          references.push({
            symbol,
            location: {
              filePath,
              startLine: lineNumber,
              endLine: lineNumber,
              startColumn: match.index + 1,
              endColumn: match.index + match[0].length + 1
            },
            isDefinition: false,
            context: line
          })

          if (references.length >= options.maxResults) {
            return
          }
        }
      }
    } catch (error) {
      Logger.error(`[CodeSearcher] 搜索文件中的引用失败: ${filePath}`, error)
    }
  }

  // 获取特定行的内容
  private async getLineContent(filePath: string, lineNumber: number): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      if (lineNumber >= 1 && lineNumber <= lines.length) {
        return lines[lineNumber - 1]
      }

      return ''
    } catch (error) {
      Logger.error(`[CodeSearcher] 获取行内容失败: ${filePath}:${lineNumber}`, error)
      return ''
    }
  }

  // 跳转到定义
  async goToDefinition(filePath: string, lineNumber: number, column: number): Promise<CodeSymbol | null> {
    try {
      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      if (lineNumber < 1 || lineNumber > lines.length) {
        return null
      }

      const line = lines[lineNumber - 1]

      // 尝试获取光标位置的符号名称
      const symbolName = this.getSymbolNameAtPosition(line, column)
      if (!symbolName) {
        return null
      }

      // 搜索符号定义
      const result = await this.searchSymbols({
        symbolName,
        caseSensitive: true,
        maxResults: 1
      })

      return result.symbols.length > 0 ? result.symbols[0] : null
    } catch (error) {
      Logger.error(`[CodeSearcher] 跳转到定义失败: ${filePath}:${lineNumber}:${column}`, error)
      return null
    }
  }

  // 获取光标位置的符号名称
  private getSymbolNameAtPosition(line: string, column: number): string | null {
    if (column < 1 || column > line.length) {
      return null
    }

    // 调整为0-based索引
    const pos = column - 1

    // 向左查找符号开始位置
    let start = pos
    while (start > 0 && this.isIdentifierChar(line.charAt(start - 1))) {
      start--
    }

    // 向右查找符号结束位置
    let end = pos
    while (end < line.length && this.isIdentifierChar(line.charAt(end))) {
      end++
    }

    // 提取符号名称
    if (start < end) {
      return line.substring(start, end)
    }

    return null
  }

  // 判断字符是否为标识符字符
  private isIdentifierChar(char: string): boolean {
    return /[a-zA-Z0-9_$]/.test(char)
  }

  // 清除符号缓存
  clearCache(): void {
    this.symbolCache.clear()
  }
}
