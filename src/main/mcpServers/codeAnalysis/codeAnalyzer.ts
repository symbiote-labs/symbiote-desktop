// src/main/mcpServers/codeAnalysis/codeAnalyzer.ts
// 综合代码分析器：整合代码结构分析、依赖分析等功能

import Logger from 'electron-log'
import * as fs from 'fs/promises'
import { minimatch } from 'minimatch'
import * as path from 'path'

import { TypeScriptAstParser } from './astParser'
import { DependencyAnalyzer } from './dependencyAnalyzer'
import { getLanguageFromFilePath, getParserForLanguage, parseFile } from './parser'
import { CodeSymbol, Reference, SearchResult, SymbolKind } from './types'

// 未使用代码的信息
export interface UnusedCodeInfo {
  symbol: CodeSymbol
  fileRelativePath: string
  reason: string
}

// 代码覆盖率信息
export interface CodeCoverageInfo {
  usedSymbols: number
  totalSymbols: number
  unusedSymbols: UnusedCodeInfo[]
  coveragePercentage: number
}

// 代码导航信息
export interface CodeNavigationInfo {
  implementations?: CodeSymbol[] // 实现列表
  overrides?: CodeSymbol[] // 重写列表
  interfaces?: CodeSymbol[] // 相关接口
  baseClasses?: CodeSymbol[] // 基类
  derivedClasses?: CodeSymbol[] // 派生类
}

// 语义分析信息
export interface SemanticInfo {
  symbol: CodeSymbol
  type?: string
  inferred?: boolean
  parameters?: {
    name: string
    type?: string
  }[]
  returnType?: string
}

// 代码分析器类
export class CodeAnalyzer {
  private workspacePath: string
  private astParser: TypeScriptAstParser
  private dependencyAnalyzer: DependencyAnalyzer
  private symbolsCache: Map<string, CodeSymbol[]> = new Map()
  private fileContentsCache: Map<string, string> = new Map()

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.astParser = new TypeScriptAstParser()
    this.dependencyAnalyzer = new DependencyAnalyzer(workspacePath)

    Logger.info(`[CodeAnalyzer] 初始化代码分析器，工作区: ${workspacePath}`)
  }

  // 初始化，预加载和分析项目
  async initialize(
    options: {
      includePatterns?: string[]
      excludePatterns?: string[]
      analyze?: {
        dependencies?: boolean
        coverage?: boolean
      }
    } = {}
  ): Promise<void> {
    const {
      includePatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      excludePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**'],
      analyze = { dependencies: true, coverage: true }
    } = options

    Logger.info(`[CodeAnalyzer] 开始初始化，分析项目：${this.workspacePath}`)

    if (analyze.dependencies) {
      await this.dependencyAnalyzer.analyzeDependencies({
        includePatterns,
        excludePatterns
      })
    }
  }

  // ------ 符号搜索功能 ------

  // 使用AST解析器搜索符号
  async searchSymbols(
    name: string,
    options: {
      kind?: SymbolKind
      includePatterns?: string[]
      excludePatterns?: string[]
      caseSensitive?: boolean
      maxResults?: number
      includeReferences?: boolean
    } = {}
  ): Promise<SearchResult> {
    const {
      kind,
      includePatterns = [],
      excludePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**'],
      caseSensitive = false,
      maxResults = 50,
      includeReferences = false
    } = options

    Logger.info(`[CodeAnalyzer] 搜索符号: ${name}, 类型: ${kind || '任意'}`)

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

    // 递归处理目录
    const processDirectory = async (dirPath: string): Promise<void> => {
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
            const relativePath = path.relative(this.workspacePath, fullPath)
            if (!excludePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))) {
              await processDirectory(fullPath)
            }
          } else if (entry.isFile() && shouldProcessFile(fullPath)) {
            await this.searchSymbolsInFile(fullPath, name, {
              kind,
              caseSensitive,
              maxResults: maxResults - result.symbols.length,
              result
            })
          }
        }
      } catch (error) {
        Logger.error(`[CodeAnalyzer] 处理目录失败: ${dirPath}`, error)
      }
    }

    await processDirectory(this.workspacePath)

    // 如果需要，查找引用
    if (includeReferences && result.symbols.length > 0) {
      for (const symbol of result.symbols) {
        if (result.references.length >= maxResults) {
          break
        }

        const references = await this.findReferences(
          symbol.location.filePath,
          symbol.location.startLine,
          symbol.location.startColumn || 1,
          {
            maxResults: maxResults - result.references.length,
            includePatterns,
            excludePatterns
          }
        )

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
        Logger.error(`[CodeAnalyzer] 获取符号上下文失败: ${symbol.name}`, error)
      }
    }

    return result
  }

  // 在单个文件中搜索符号
  private async searchSymbolsInFile(
    filePath: string,
    symbolName: string,
    options: {
      kind?: SymbolKind
      caseSensitive: boolean
      maxResults: number
      result: SearchResult
    }
  ): Promise<void> {
    try {
      // 获取缓存或解析文件中的符号
      let symbols = this.symbolsCache.get(filePath)

      if (!symbols) {
        // 优先尝试AST解析
        const content = await this.getFileContent(filePath)
        symbols = await this.astParser.parseSymbols(filePath, content)

        // 如果AST解析失败或结果为空，则使用基础解析器
        if (!symbols || symbols.length === 0) {
          symbols = await parseFile(filePath)
        }

        this.symbolsCache.set(filePath, symbols)
      }

      // 过滤符号
      const { kind, caseSensitive, result } = options
      const regex = new RegExp(symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? '' : 'i')

      for (const symbol of symbols) {
        if (regex.test(symbol.name) && (!kind || symbol.kind === kind)) {
          result.symbols.push(symbol)

          if (result.symbols.length >= options.maxResults) {
            break
          }
        }
      }
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 在文件中搜索符号失败: ${filePath}`, error)
    }
  }

  // 查找引用
  async findReferences(
    filePath: string,
    line: number,
    column: number,
    options: {
      includePatterns?: string[]
      excludePatterns?: string[]
      maxResults?: number
    } = {}
  ): Promise<Reference[]> {
    const {
      includePatterns = [],
      excludePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**'],
      maxResults = 100
    } = options

    Logger.info(`[CodeAnalyzer] 查找引用: ${filePath}:${line}:${column}`)

    // 首先获取符号定义
    const symbol = await this.findSymbolAtPosition(filePath, line, column)

    if (!symbol) {
      Logger.warn(`[CodeAnalyzer] 未在位置 ${filePath}:${line}:${column} 找到符号`)
      return []
    }

    // 以符号名称为基础搜索引用
    const references: Reference[] = []

    // 添加定义位置作为第一个引用
    const definitionContent = await this.getLineContent(filePath, line)
    references.push({
      symbol,
      location: {
        filePath,
        startLine: line,
        endLine: line,
        startColumn: column,
        endColumn: column + symbol.name.length
      },
      isDefinition: true,
      context: definitionContent
    })

    // 遍历工作区文件查找引用
    const processDirectory = async (dirPath: string): Promise<void> => {
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
          const relativePath = path.relative(this.workspacePath, fullPath)

          // 排除模式检查
          if (excludePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))) {
            continue
          }

          // 包含模式检查
          if (
            includePatterns.length > 0 &&
            !includePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))
          ) {
            continue
          }

          if (entry.isDirectory()) {
            await processDirectory(fullPath)
          } else if (entry.isFile()) {
            await this.findReferencesInFile(fullPath, symbol, references, maxResults - references.length)
          }
        }
      } catch (error) {
        Logger.error(`[CodeAnalyzer] 查找引用处理目录失败: ${dirPath}`, error)
      }
    }

    await processDirectory(this.workspacePath)

    return references
  }

  // 在单个文件中查找引用
  private async findReferencesInFile(
    filePath: string,
    symbol: CodeSymbol,
    references: Reference[],
    maxCount: number
  ): Promise<void> {
    if (references.length >= maxCount) {
      return
    }

    try {
      const content = await this.getFileContent(filePath)
      const lines = content.split('\n')

      // 创建正则表达式，匹配符号
      // 需要确保匹配的是完整的标识符，而不是部分匹配
      const regex = new RegExp(`\\b${symbol.name}\\b`, 'g')

      for (let i = 0; i < lines.length; i++) {
        if (references.length >= maxCount) {
          break
        }

        const line = lines[i]
        const lineNumber = i + 1

        // 重置正则以便从头开始匹配
        regex.lastIndex = 0

        // 查找匹配项
        let match
        while ((match = regex.exec(line)) !== null) {
          // 排除自身位置（如果是同一文件中的定义位置）
          if (
            filePath === symbol.location.filePath &&
            lineNumber === symbol.location.startLine &&
            match.index + 1 === symbol.location.startColumn
          ) {
            continue
          }

          // 添加引用
          references.push({
            symbol: symbol,
            location: {
              filePath,
              startLine: lineNumber,
              endLine: lineNumber,
              startColumn: match.index + 1,
              endColumn: match.index + symbol.name.length + 1
            },
            isDefinition: false,
            context: line
          })

          if (references.length >= maxCount) {
            break
          }
        }
      }
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 在文件中查找引用失败: ${filePath}`, error)
    }
  }

  // ------ 代码导航功能 ------

  // 查找指定位置的符号
  async findSymbolAtPosition(filePath: string, line: number, column: number): Promise<CodeSymbol | null> {
    try {
      // 获取文件中的所有符号
      let symbols = this.symbolsCache.get(filePath)

      if (!symbols) {
        const content = await this.getFileContent(filePath)
        symbols = await this.astParser.parseSymbols(filePath, content)
        this.symbolsCache.set(filePath, symbols)
      }

      // 首先检查精确位置匹配
      for (const symbol of symbols) {
        const loc = symbol.location
        if (
          loc.startLine === line &&
          loc.startColumn &&
          loc.endColumn &&
          column >= loc.startColumn &&
          column <= loc.endColumn
        ) {
          return symbol
        }
      }

      // 如果没有精确位置匹配，查找该行上的符号
      const parser = getParserForLanguage(getLanguageFromFilePath(filePath))
      return await parser.findSymbolAtLine(symbols, line)
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 查找位置符号失败: ${filePath}:${line}:${column}`, error)
      return null
    }
  }

  // 跳转到定义
  async goToDefinition(filePath: string, line: number, column: number): Promise<CodeSymbol | null> {
    try {
      const content = await this.getFileContent(filePath)
      const lines = content.split('\n')

      if (line < 1 || line > lines.length) {
        return null
      }

      const lineContent = lines[line - 1]

      // 尝试获取光标位置的符号名称
      const symbolName = this.getSymbolNameAtPosition(lineContent, column)
      if (!symbolName) {
        return null
      }

      // 搜索符号定义
      const result = await this.searchSymbols(symbolName, {
        caseSensitive: true,
        maxResults: 20
      })

      // 如果有多个结果，尝试根据导入信息选择最准确的匹配
      if (result.symbols.length > 1) {
        // 检查当前文件是否导入了这个符号，如果是，优先选择导入的定义
        const dependencyGraph = await this.dependencyAnalyzer.analyzeDependencies()
        const node = dependencyGraph.nodes[filePath]

        if (node) {
          // 查找导入的模块中是否包含该符号
          for (const dep of node.dependencies) {
            const depNode = dependencyGraph.nodes[dep]
            if (depNode) {
              // 在依赖的导出中查找符号
              for (const sym of result.symbols) {
                if (sym.location.filePath === dep) {
                  return sym
                }
              }
            }
          }
        }
      }

      return result.symbols.length > 0 ? result.symbols[0] : null
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 跳转到定义失败: ${filePath}:${line}:${column}`, error)
      return null
    }
  }

  // 查找实现
  async findImplementations(filePath: string, line: number, column: number): Promise<CodeSymbol[]> {
    try {
      Logger.info(`[CodeAnalyzer] 查找实现: ${filePath}:${line}:${column}`)

      // 获取当前位置的符号
      const symbol = await this.findSymbolAtPosition(filePath, line, column)
      if (!symbol) {
        Logger.warn(`[CodeAnalyzer] 未在位置 ${filePath}:${line}:${column} 找到符号`)
        return []
      }

      // 只有接口和抽象方法才需要查找实现
      if (symbol.kind !== SymbolKind.Interface && symbol.kind !== SymbolKind.Method) {
        return []
      }

      const implementations: CodeSymbol[] = []

      // 遍历工作区查找实现
      const processDirectory = async (dirPath: string): Promise<void> => {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name)
            const relativePath = path.relative(this.workspacePath, fullPath)

            // 排除node_modules等目录
            if (
              relativePath.includes('node_modules') ||
              relativePath.includes('dist') ||
              relativePath.includes('build')
            ) {
              continue
            }

            if (entry.isDirectory()) {
              await processDirectory(fullPath)
            } else if (entry.isFile() && this.isTypeScriptOrJavaScriptFile(entry.name)) {
              // 检查文件内容中是否有实现
              await this.findImplementationsInFile(fullPath, symbol, implementations)
            }
          }
        } catch (error) {
          Logger.error(`[CodeAnalyzer] 查找实现处理目录失败: ${dirPath}`, error)
        }
      }

      await processDirectory(this.workspacePath)

      return implementations
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 查找实现失败: ${filePath}:${line}:${column}`, error)
      return []
    }
  }

  // 在文件中查找实现
  private async findImplementationsInFile(
    filePath: string,
    targetSymbol: CodeSymbol,
    implementations: CodeSymbol[]
  ): Promise<void> {
    try {
      // 获取文件内容
      const content = await this.getFileContent(filePath)

      // 如果是接口，查找实现该接口的类
      if (targetSymbol.kind === SymbolKind.Interface) {
        const interfaceName = targetSymbol.name

        // 查找 "implements 接口名" 模式
        const implementsRegex = new RegExp(
          `class\\s+([A-Za-z0-9_$]+)(?:[\\s\\n]*)(?:extends[^{]+)?(?:[\\s\\n]*)implements(?:[^{]*,)?\\s*${interfaceName}\\b`,
          'g'
        )
        let match

        while ((match = implementsRegex.exec(content)) !== null) {
          const className = match[1]

          // 计算行号（简化处理，可能不准确）
          const lineNumber = this.getLineNumberFromOffset(content, match.index)

          implementations.push({
            name: className,
            kind: SymbolKind.Class,
            location: {
              filePath,
              startLine: lineNumber,
              endLine: lineNumber,
              startColumn: match.index + 1,
              endColumn: match.index + match[0].length + 1
            },
            modifiers: []
          })
        }
      }
      // 如果是方法，查找重写该方法的方法
      else if (targetSymbol.kind === SymbolKind.Method) {
        const methodName = targetSymbol.name

        // 查找方法实现（简化处理，可能会有误匹配）
        const methodRegex = new RegExp(`\\b${methodName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\s*\\{`, 'g')
        let match

        while ((match = methodRegex.exec(content)) !== null) {
          // 计算行号
          const lineNumber = this.getLineNumberFromOffset(content, match.index)

          implementations.push({
            name: methodName,
            kind: SymbolKind.Method,
            location: {
              filePath,
              startLine: lineNumber,
              endLine: lineNumber,
              startColumn: match.index + 1,
              endColumn: match.index + match[0].length + 1
            },
            modifiers: []
          })
        }
      }
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 在文件中查找实现失败: ${filePath}`, error)
    }
  }

  // 查找所有派生类
  async findDerivedClasses(filePath: string, line: number, column: number): Promise<CodeSymbol[]> {
    try {
      Logger.info(`[CodeAnalyzer] 查找派生类: ${filePath}:${line}:${column}`)

      // 获取当前位置的符号
      const symbol = await this.findSymbolAtPosition(filePath, line, column)
      if (!symbol || symbol.kind !== SymbolKind.Class) {
        return []
      }

      const className = symbol.name
      const derivedClasses: CodeSymbol[] = []

      // 遍历工作区查找派生类
      const processDirectory = async (dirPath: string): Promise<void> => {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name)
            const relativePath = path.relative(this.workspacePath, fullPath)

            // 排除node_modules等目录
            if (
              relativePath.includes('node_modules') ||
              relativePath.includes('dist') ||
              relativePath.includes('build')
            ) {
              continue
            }

            if (entry.isDirectory()) {
              await processDirectory(fullPath)
            } else if (entry.isFile() && this.isTypeScriptOrJavaScriptFile(entry.name)) {
              // 查找派生类
              await this.findDerivedClassesInFile(fullPath, className, derivedClasses)
            }
          }
        } catch (error) {
          Logger.error(`[CodeAnalyzer] 查找派生类处理目录失败: ${dirPath}`, error)
        }
      }

      await processDirectory(this.workspacePath)

      return derivedClasses
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 查找派生类失败: ${filePath}:${line}:${column}`, error)
      return []
    }
  }

  // 在文件中查找派生类
  private async findDerivedClassesInFile(
    filePath: string,
    baseClassName: string,
    derivedClasses: CodeSymbol[]
  ): Promise<void> {
    try {
      // 获取文件内容
      const content = await this.getFileContent(filePath)

      // 查找 "extends 基类名" 模式
      const extendsRegex = new RegExp(`class\\s+([A-Za-z0-9_$]+)(?:[\\s\\n]*)extends\\s+${baseClassName}\\b`, 'g')
      let match

      while ((match = extendsRegex.exec(content)) !== null) {
        const className = match[1]

        // 计算行号
        const lineNumber = this.getLineNumberFromOffset(content, match.index)

        derivedClasses.push({
          name: className,
          kind: SymbolKind.Class,
          location: {
            filePath,
            startLine: lineNumber,
            endLine: lineNumber,
            startColumn: match.index + 1,
            endColumn: match.index + match[0].length + 1
          },
          modifiers: []
        })
      }
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 在文件中查找派生类失败: ${filePath}`, error)
    }
  }

  // 辅助方法：判断是否是TypeScript或JavaScript文件
  private isTypeScriptOrJavaScriptFile(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase()
    return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx'
  }

  // 辅助方法：从文本偏移量计算行号
  private getLineNumberFromOffset(content: string, offset: number): number {
    const lines = content.substring(0, offset).split('\n')
    return lines.length
  }

  // 获取完整的代码导航信息
  async getCodeNavigationInfo(filePath: string, line: number, column: number): Promise<CodeNavigationInfo> {
    const navigationInfo: CodeNavigationInfo = {}

    // 查找当前位置的符号
    const symbol = await this.findSymbolAtPosition(filePath, line, column)
    if (!symbol) {
      return navigationInfo
    }

    // 根据符号类型提供不同的导航信息
    if (symbol.kind === SymbolKind.Interface) {
      // 对于接口，查找实现该接口的类
      navigationInfo.implementations = await this.findImplementations(filePath, line, column)
    } else if (symbol.kind === SymbolKind.Class) {
      // 对于类，查找派生类
      navigationInfo.derivedClasses = await this.findDerivedClasses(filePath, line, column)

      // 查找基类（待实现）
      navigationInfo.baseClasses = []

      // 查找实现的接口（待实现）
      navigationInfo.interfaces = []
    }

    return navigationInfo
  }

  // ------ 代码覆盖和分析功能 ------

  // 分析未使用的代码
  async analyzeUnusedCode(
    options: {
      includePatterns?: string[]
      excludePatterns?: string[]
    } = {}
  ): Promise<CodeCoverageInfo> {
    const {
      includePatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      excludePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.d.ts', '**/test/**', '**/*.test.*']
    } = options

    Logger.info(`[CodeAnalyzer] 开始分析未使用代码`)

    // 分析依赖关系
    const dependencyGraph = await this.dependencyAnalyzer.analyzeDependencies({
      includePatterns,
      excludePatterns
    })

    // 查找所有导出的符号
    const exportedSymbols: Map<string, CodeSymbol[]> = new Map()
    const allSymbols: CodeSymbol[] = []
    const unusedSymbols: UnusedCodeInfo[] = []

    // 遍历所有文件，收集导出的符号
    for (const [filePath, node] of Object.entries(dependencyGraph.nodes)) {
      try {
        // 获取文件中的所有符号
        let symbols = this.symbolsCache.get(filePath)

        if (!symbols) {
          const content = await this.getFileContent(filePath)
          symbols = await this.astParser.parseSymbols(filePath, content)
          this.symbolsCache.set(filePath, symbols)
        }

        allSymbols.push(...symbols)

        // 收集标记为导出的符号
        const exported = symbols.filter(
          (sym) => sym.modifiers?.includes('export') || node.exports.some((exp) => exp.name === sym.name)
        )

        if (exported.length > 0) {
          exportedSymbols.set(filePath, exported)
        }
      } catch (error) {
        Logger.error(`[CodeAnalyzer] 分析文件符号失败: ${filePath}`, error)
      }
    }

    // 检查每个导出的符号是否被使用
    for (const [filePath, symbols] of exportedSymbols.entries()) {
      const node = dependencyGraph.nodes[filePath]

      if (node.dependents.length === 0) {
        // 没有被其他文件引用的文件中的导出符号可能未使用
        for (const symbol of symbols) {
          // 排除顶层入口文件
          const isEntryPoint = this.isEntryPoint(filePath)

          if (!isEntryPoint) {
            unusedSymbols.push({
              symbol,
              fileRelativePath: path.relative(this.workspacePath, filePath),
              reason: '文件未被其他模块导入'
            })
          }
        }
      } else {
        // 检查每个导出的符号是否在其他文件中被引用
        // 这部分需要更复杂的分析，此处使用简化版本
      }
    }

    return {
      usedSymbols: allSymbols.length - unusedSymbols.length,
      totalSymbols: allSymbols.length,
      unusedSymbols,
      coveragePercentage: Math.round(((allSymbols.length - unusedSymbols.length) / allSymbols.length) * 100)
    }
  }

  // 判断文件是否为入口文件
  private isEntryPoint(filePath: string): boolean {
    const relativePath = path.relative(this.workspacePath, filePath)
    const filename = path.basename(relativePath)

    // 常见的入口文件命名
    return (
      filename === 'index.ts' ||
      filename === 'index.js' ||
      filename === 'main.ts' ||
      filename === 'main.js' ||
      filename === 'app.ts' ||
      filename === 'app.js'
    )
  }

  // ------ 语义理解功能 ------

  // 获取符号的语义信息
  async getSymbolSemanticInfo(filePath: string, line: number, column: number): Promise<SemanticInfo | null> {
    // 找到对应位置的符号
    const symbol = await this.findSymbolAtPosition(filePath, line, column)
    if (!symbol) {
      return null
    }

    // 基本语义信息
    const semanticInfo: SemanticInfo = {
      symbol,
      inferred: false
    }

    try {
      const content = await this.getFileContent(filePath)
      const lines = content.split('\n')

      // 函数相关信息
      if (symbol.kind === SymbolKind.Function || symbol.kind === SymbolKind.Method) {
        // 获取函数声明所在行
        const declarationLine = lines[symbol.location.startLine - 1] || ''

        // 尝试分析函数签名
        const signatureInfo = this.analyzeFunctionSignature(declarationLine, symbol.name)
        if (signatureInfo) {
          semanticInfo.parameters = signatureInfo.parameters
          semanticInfo.returnType = signatureInfo.returnType
          semanticInfo.inferred = signatureInfo.inferred
        }

        // 如果没有从签名中获取到类型信息，尝试分析函数体
        if (!semanticInfo.returnType) {
          // 尝试从函数体中推断返回类型
          const functionBody = this.extractFunctionBody(lines, symbol.location.startLine)
          if (functionBody) {
            semanticInfo.returnType = this.inferReturnTypeFromBody(functionBody)
            semanticInfo.inferred = true
          }
        }
      }
      // 变量相关信息
      else if (symbol.kind === SymbolKind.Variable || symbol.kind === SymbolKind.Constant) {
        const declarationLine = lines[symbol.location.startLine - 1] || ''
        semanticInfo.type = this.inferVariableType(declarationLine, symbol.name)
        semanticInfo.inferred = !declarationLine.includes(': ') // 如果没有显式类型声明，则为推断
      }
      // 接口或类型相关信息
      else if (symbol.kind === SymbolKind.Interface || symbol.kind === SymbolKind.TypeParameter) {
        const typeDefinition = this.extractTypeDefinition(lines, symbol.location.startLine)
        if (typeDefinition) {
          // 提取类型的成员和继承关系
          const members = this.extractTypeMembers(typeDefinition)
          semanticInfo.type = `${symbol.kind === SymbolKind.Interface ? 'interface' : 'type'} with ${members.length} members`
          // 可以添加更多信息，如成员列表等
        }
      }
      // 类相关信息
      else if (symbol.kind === SymbolKind.Class) {
        // 提取类的继承和实现关系
        const classDefinition = this.extractClassDefinition(lines, symbol.location.startLine)
        if (classDefinition) {
          const inheritance = this.analyzeClassInheritance(classDefinition)
          if (inheritance.extends) {
            semanticInfo.type = `class extends ${inheritance.extends}`
          } else if (inheritance.implements.length > 0) {
            semanticInfo.type = `class implements ${inheritance.implements.join(', ')}`
          } else {
            semanticInfo.type = 'class'
          }
        }
      }
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 获取语义信息失败: ${filePath}:${line}:${column}`, error)
    }

    return semanticInfo
  }

  // 分析函数签名
  private analyzeFunctionSignature(
    line: string,
    functionName: string
  ): {
    parameters: { name: string; type?: string }[]
    returnType?: string
    inferred: boolean
  } | null {
    try {
      // 尝试匹配函数声明模式: function name(param1: type1, param2: type2): returnType
      const functionDeclRegex = new RegExp(`function\\s+${functionName}\\s*\\(([^)]*)\\)\\s*(?::\\s*([^{]*))?`)

      // 尝试匹配箭头函数模式: const name = (param1: type1, param2: type2): returnType =>
      const arrowFuncRegex = new RegExp(
        `(?:const|let|var)\\s+${functionName}\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)(?:\\s*:\\s*([^=]*))?\\s*=>`
      )

      // 尝试匹配类/接口方法模式: name(param1: type1, param2: type2): returnType
      const methodRegex = new RegExp(`${functionName}\\s*\\(([^)]*)\\)\\s*(?::\\s*([^{]*))?`)

      const match = functionDeclRegex.exec(line) || arrowFuncRegex.exec(line) || methodRegex.exec(line)

      if (match) {
        const paramsStr = match[1] || ''
        const returnTypeStr = match[2] ? match[2].trim() : undefined

        // 解析参数
        const parameters = paramsStr
          .split(',')
          .filter((param) => param.trim() !== '')
          .map((param) => {
            const [name, type] = param
              .trim()
              .split(':')
              .map((p) => p.trim())
            return { name, type }
          })

        return {
          parameters,
          returnType: returnTypeStr,
          inferred: !returnTypeStr // 如果没有返回类型声明，则为推断
        }
      }
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 分析函数签名失败`, error)
    }

    return null
  }

  // 提取函数体
  private extractFunctionBody(lines: string[], startLine: number): string[] | null {
    try {
      const bodyLines: string[] = []
      let braceCount = 0
      let inBody = false

      // 从声明行开始向下扫描
      for (let i = startLine - 1; i < lines.length; i++) {
        const line = lines[i]

        // 查找函数体开始的大括号
        if (!inBody) {
          if (line.includes('{')) {
            inBody = true
            braceCount = 1
            bodyLines.push(line.substring(line.indexOf('{')))
          } else if (line.includes('=>')) {
            // 箭头函数可能没有大括号
            inBody = true
            if (!line.includes('{')) {
              // 单行箭头函数
              bodyLines.push(line.substring(line.indexOf('=>') + 2))
              break
            } else {
              braceCount = 1
              bodyLines.push(line.substring(line.indexOf('{')))
            }
          }
        } else {
          bodyLines.push(line)

          // 计算大括号平衡
          for (const char of line) {
            if (char === '{') braceCount++
            else if (char === '}') braceCount--
          }

          // 函数体结束
          if (braceCount === 0) {
            break
          }
        }
      }

      return bodyLines.length > 0 ? bodyLines : null
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 提取函数体失败`, error)
      return null
    }
  }

  // 从函数体推断返回类型
  private inferReturnTypeFromBody(bodyLines: string[]): string | undefined {
    try {
      const returnStatements: string[] = []

      // 提取所有return语句
      for (const line of bodyLines) {
        const trimmedLine = line.trim()
        if (trimmedLine.startsWith('return ')) {
          returnStatements.push(trimmedLine.substring(7).trim())
        }
      }

      if (returnStatements.length === 0) {
        return 'void'
      }

      // 简单的类型推断
      const inferredTypes = new Set<string>()

      for (const stmt of returnStatements) {
        if (stmt === 'null' || stmt === 'undefined') {
          inferredTypes.add(stmt)
        } else if (stmt.startsWith('"') || stmt.startsWith("'") || stmt.startsWith('`')) {
          inferredTypes.add('string')
        } else if (/^-?\d+(\.\d+)?$/.test(stmt)) {
          inferredTypes.add('number')
        } else if (stmt === 'true' || stmt === 'false') {
          inferredTypes.add('boolean')
        } else if (stmt.startsWith('[')) {
          inferredTypes.add('array')
        } else if (stmt.startsWith('{')) {
          inferredTypes.add('object')
        } else if (stmt.includes('new ')) {
          const match = /new\s+([A-Za-z0-9_$]+)/.exec(stmt)
          if (match) {
            inferredTypes.add(match[1])
          } else {
            inferredTypes.add('object')
          }
        } else {
          inferredTypes.add('unknown')
        }
      }

      // 合并推断的类型
      if (inferredTypes.size === 1) {
        return inferredTypes.values().next().value
      } else if (inferredTypes.has('null') || inferredTypes.has('undefined')) {
        const nonNullTypes = Array.from(inferredTypes).filter((type) => type !== 'null' && type !== 'undefined')
        if (nonNullTypes.length === 1) {
          return `${nonNullTypes[0]} | null`
        } else {
          return Array.from(inferredTypes).join(' | ')
        }
      } else {
        return Array.from(inferredTypes).join(' | ')
      }
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 推断返回类型失败`, error)
      return undefined
    }
  }

  // 推断变量类型
  private inferVariableType(line: string, varName: string): string | undefined {
    try {
      // 检查显式类型声明
      const typeAnnotationRegex = new RegExp(`${varName}\\s*:\\s*([A-Za-z0-9_$<>\\[\\]|&{}]+)`)
      const typeAnnotationMatch = typeAnnotationRegex.exec(line)

      if (typeAnnotationMatch) {
        return typeAnnotationMatch[1].trim()
      }

      // 从初始化推断类型
      const initializationRegex = new RegExp(`${varName}\\s*=\\s*(.+?)(;|$)`)
      const initializationMatch = initializationRegex.exec(line)

      if (initializationMatch) {
        const value = initializationMatch[1].trim()

        // 简单的值类型推断
        if (value === 'null' || value === 'undefined') {
          return value
        } else if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`')) {
          return 'string'
        } else if (/^-?\d+(\.\d+)?$/.test(value)) {
          return 'number'
        } else if (value === 'true' || value === 'false') {
          return 'boolean'
        } else if (value.startsWith('[')) {
          // 尝试推断数组内元素类型
          const arrayContentMatch = /\[\s*(.+?)\s*\]/.exec(value)
          if (arrayContentMatch) {
            const content = arrayContentMatch[1].trim()
            if (!content) return 'any[]'

            const firstElement = content.split(',')[0].trim()
            if (firstElement.startsWith('"') || firstElement.startsWith("'")) {
              return 'string[]'
            } else if (/^-?\d+(\.\d+)?$/.test(firstElement)) {
              return 'number[]'
            } else if (firstElement === 'true' || firstElement === 'false') {
              return 'boolean[]'
            } else {
              return 'any[]'
            }
          }
          return 'any[]'
        } else if (value.startsWith('{')) {
          return 'object'
        } else if (value.includes('new ')) {
          const match = /new\s+([A-Za-z0-9_$]+)/.exec(value)
          return match ? match[1] : 'object'
        } else if (value.includes('=>')) {
          return 'function'
        } else {
          return 'unknown'
        }
      }

      return undefined
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 推断变量类型失败`, error)
      return undefined
    }
  }

  // 提取类型定义
  private extractTypeDefinition(lines: string[], startLine: number): string[] | null {
    try {
      const typeLines: string[] = []
      let braceCount = 0
      let inDefinition = false

      // 从声明行开始向下扫描
      for (let i = startLine - 1; i < lines.length; i++) {
        const line = lines[i]
        typeLines.push(line)

        // 查找定义开始的大括号
        if (!inDefinition) {
          if (line.includes('{')) {
            inDefinition = true
            braceCount = 1
          }
        } else {
          // 计算大括号平衡
          for (const char of line) {
            if (char === '{') braceCount++
            else if (char === '}') braceCount--
          }

          // 定义结束
          if (braceCount === 0) {
            break
          }
        }
      }

      return typeLines.length > 0 ? typeLines : null
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 提取类型定义失败`, error)
      return null
    }
  }

  // 提取类型成员
  private extractTypeMembers(typeLines: string[]): { name: string; type?: string }[] {
    const members: { name: string; type?: string }[] = []

    try {
      // 跳过第一行（类型声明行）
      for (let i = 1; i < typeLines.length; i++) {
        const line = typeLines[i].trim()

        // 忽略空行和大括号行
        if (!line || line === '{' || line === '}') continue

        // 匹配成员定义：name: type 或 name?: type
        const memberRegex = /([A-Za-z0-9_$]+)(\?)?:\s*([^;]+)/
        const match = memberRegex.exec(line)

        if (match) {
          members.push({
            name: match[1] + (match[2] || ''),
            type: match[3].trim()
          })
        }

        // 匹配方法定义：name(params): returnType
        const methodRegex = /([A-Za-z0-9_$]+)(\?)?(\(.*\)):\s*([^;{]+)/
        const methodMatch = methodRegex.exec(line)

        if (methodMatch) {
          members.push({
            name: methodMatch[1] + (methodMatch[2] || '') + methodMatch[3],
            type: `=> ${methodMatch[4].trim()}`
          })
        }
      }
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 提取类型成员失败`, error)
    }

    return members
  }

  // 提取类定义
  private extractClassDefinition(lines: string[], startLine: number): string | null {
    try {
      // 获取类定义行
      const classLine = lines[startLine - 1]
      if (classLine && classLine.includes('class ')) {
        return classLine
      }
      return null
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 提取类定义失败`, error)
      return null
    }
  }

  // 分析类的继承关系
  private analyzeClassInheritance(classDefinition: string): { extends?: string; implements: string[] } {
    const result = { extends: undefined as string | undefined, implements: [] as string[] }

    try {
      // 检查extends
      const extendsMatch = /extends\s+([A-Za-z0-9_$]+)/.exec(classDefinition)
      if (extendsMatch) {
        result.extends = extendsMatch[1]
      }

      // 检查implements
      const implementsMatch = /implements\s+([A-Za-z0-9_$,\s]+)/.exec(classDefinition)
      if (implementsMatch) {
        result.implements = implementsMatch[1].split(',').map((name) => name.trim())
      }
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 分析类继承关系失败`, error)
    }

    return result
  }

  // ------ 辅助方法 ------

  // 从文件中读取内容
  private async getFileContent(filePath: string): Promise<string> {
    if (this.fileContentsCache.has(filePath)) {
      return this.fileContentsCache.get(filePath)!
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      this.fileContentsCache.set(filePath, content)
      return content
    } catch (error) {
      Logger.error(`[CodeAnalyzer] 读取文件失败: ${filePath}`, error)
      throw error
    }
  }

  // 获取特定行的内容
  private async getLineContent(filePath: string, lineNumber: number): Promise<string> {
    const content = await this.getFileContent(filePath)
    const lines = content.split('\n')

    if (lineNumber >= 1 && lineNumber <= lines.length) {
      return lines[lineNumber - 1]
    }

    return ''
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

  // 清除缓存
  clearCache(): void {
    this.symbolsCache.clear()
    this.fileContentsCache.clear()
  }
}
