// src/main/mcpServers/codeAnalysis/index.ts
// 代码分析模块入口文件

// 导出所有需要的类型和功能
export * from './searcher'
export * from './types'
// 显式导出以解决歧义
import { CodeParser } from './parser'
export { CodeParser }
export * from './parser'

// 统一导出 CodeAnalyzer 类，使用工厂函数创建实例
import Logger from 'electron-log'

import { CodeSearcher, SymbolSearchOptions } from './searcher'
import { SearchResult } from './types'

// 代码分析器配置选项
export interface CodeAnalyzerOptions {
  workspacePath: string
  maxCacheSize?: number
  searchTimeout?: number
}

// 代码分析器类 - 统一封装所有代码分析功能
export class CodeAnalyzer {
  private searcher: CodeSearcher
  private workspacePath: string
  private searchTimeout: number

  constructor(options: CodeAnalyzerOptions) {
    this.workspacePath = options.workspacePath
    this.searchTimeout = options.searchTimeout || 60000 // 默认超时时间：60秒
    this.searcher = new CodeSearcher(options.workspacePath)

    Logger.info(`[CodeAnalyzer] 初始化代码分析器，工作区: ${this.workspacePath}`)
  }

  // 符号搜索
  async searchSymbols(options: SymbolSearchOptions | string): Promise<SearchResult> {
    if (typeof options === 'string') {
      options = { symbolName: options }
    }

    const {
      symbolName,
      symbolKind,
      includePatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      excludePatterns = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
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
      ],
      caseSensitive = false,
      maxResults = 50,
      includeReferences = false
    } = options

    Logger.info(
      `[CodeAnalyzer] 搜索符号: ${symbolName}${symbolKind ? `, 类型: ${symbolKind}` : ''}, caseSensitive: ${caseSensitive}`
    )

    try {
      // 文件过滤逻辑直接内联到代码中，不再使用单独的函数
      const searchOptions = {
        symbolName,
        symbolKind,
        includePatterns,
        excludePatterns,
        caseSensitive,
        maxResults,
        includeReferences
      }

      // 查询符号
      const result = await this.searcher.searchSymbols(searchOptions)

      return result
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 搜索符号失败: ${symbolName}`, error)
      return { symbols: [], references: [], contexts: [] }
    }
  }

  // 查找引用
  async findReferences(options: import('./searcher').ReferenceSearchOptions) {
    return this.withTimeout(
      this.searcher.findReferences(options),
      this.searchTimeout,
      `查找引用超时: ${options.symbol.name}`
    )
  }

  // 跳转到定义
  async goToDefinition(filePath: string, lineNumber: number, column: number) {
    return this.withTimeout(
      this.searcher.goToDefinition(filePath, lineNumber, column),
      this.searchTimeout,
      `跳转到定义超时: ${filePath}:${lineNumber}:${column}`
    )
  }

  // 清除缓存
  clearCache() {
    this.searcher.clearCache()
    Logger.info('[CodeAnalyzer] 已清除代码分析器缓存')
  }

  // 带超时的Promise包装
  private async withTimeout<T>(promise: Promise<T>, timeout: number, timeoutMessage: string): Promise<T> {
    let timeoutId: NodeJS.Timeout

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage))
      }, timeout)
    })

    try {
      // 使用 Promise.race 实现超时控制
      return await Promise.race([promise, timeoutPromise])
    } finally {
      clearTimeout(timeoutId!)
    }
  }
}

// 工厂函数 - 创建代码分析器实例
export function createCodeAnalyzer(options: CodeAnalyzerOptions): CodeAnalyzer {
  return new CodeAnalyzer(options)
}
