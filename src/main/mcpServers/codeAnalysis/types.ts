// src/main/mcpServers/codeAnalysis/types.ts
// 代码分析功能的类型定义

// 符号类型枚举
export enum SymbolKind {
  Unknown = 0,
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
  Parameter = 26,
  TypeAlias = 27
}

// 符号位置信息
export interface SymbolLocation {
  filePath: string // 文件路径
  startLine: number // 起始行号 (1-based)
  endLine: number // 结束行号 (1-based)
  startColumn?: number // 起始列号 (1-based, 可选)
  endColumn?: number // 结束列号 (1-based, 可选)
}

// 为了兼容性，提供 Location 类型别名
export type Location = SymbolLocation

// 代码符号接口
export interface CodeSymbol {
  name: string // 符号名称
  kind: SymbolKind // 符号类型
  location: SymbolLocation // 符号位置
  containerName?: string // 父级容器名称 (如类、命名空间等)
  modifiers?: string[] // 修饰符 (如 public, static, export 等)
  children?: CodeSymbol[] // 子符号
  details?: string // 附加详情 (如函数签名、类型信息等)
  documentation?: string // 文档注释
  isDefinition?: boolean // 是否为定义 (而非声明)
}

// 符号引用接口
export interface Reference {
  symbol: CodeSymbol // 被引用的符号
  location: SymbolLocation // 引用位置
  isDefinition: boolean // 是否为定义引用
  context: string // 引用上下文 (代码行)
}

// 代码上下文接口
export interface CodeContext {
  symbol?: CodeSymbol // 相关符号 (可选)
  beforeLines: string[] // 前置代码行
  line: string // 当前代码行
  afterLines: string[] // 后置代码行
  lineNumber: number // 代码行号 (1-based)
}

// 搜索结果
export interface SearchResult {
  symbols: CodeSymbol[] // 符号列表
  references: Reference[] // 引用列表
  contexts: CodeContext[] // 上下文列表
}

// 代码语言类型
export enum CodeLanguage {
  Unknown = 'unknown',
  TypeScript = 'typescript',
  JavaScript = 'javascript',
  HTML = 'html',
  CSS = 'css',
  JSON = 'json',
  Markdown = 'markdown',
  Python = 'python',
  Java = 'java',
  CSharp = 'csharp',
  CPlusPlus = 'cpp',
  C = 'c',
  Go = 'go',
  Rust = 'rust',
  Ruby = 'ruby',
  PHP = 'php',
  Swift = 'swift',
  Kotlin = 'kotlin',
  Dart = 'dart',
  YAML = 'yaml'
}

// 代码解析器接口
export interface CodeParser {
  // 解析文件中的所有符号
  parseSymbols(filePath: string, content?: string): Promise<CodeSymbol[]>

  // 查找特定行上的符号
  findSymbolAtLine(symbols: CodeSymbol[], line: number): Promise<CodeSymbol | null>

  // 获取代码上下文
  getCodeContext(filePath: string, line: number, contextLines?: number): Promise<CodeContext | null>
}

// 语法错误信息
export interface SyntaxError {
  message: string // 错误消息
  location: SymbolLocation // 错误位置
  severity: ErrorSeverity // 错误严重性
  code?: string // 错误代码 (可选)
  source?: string // 错误来源 (如 eslint, tsc 等)
}

// 错误严重性枚举
export enum ErrorSeverity {
  Error = 'error',
  Warning = 'warning',
  Information = 'information',
  Hint = 'hint'
}

// 代码指标
export interface CodeMetrics {
  lineCount: number // 代码行数
  commentLineCount: number // 注释行数
  functionCount: number // 函数数量
  classCount: number // 类数量
  complexity: number // 复杂度指标
  dependencies: number // 依赖数量
}

// 代码补全项
export interface CodeCompletionItem {
  label: string // 显示标签
  detail?: string // 详细说明
  kind: CompletionItemKind // 补全项类型
  documentation?: string // 文档说明
  insertText: string // 插入文本
  sortText?: string // 排序文本
}

// 补全项类型枚举
export enum CompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
  Folder = 19,
  EnumMember = 20,
  Constant = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25
}
