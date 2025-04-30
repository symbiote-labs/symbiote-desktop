// src/main/mcpServers/codeAnalysis/parser.ts
// 代码解析器：用于解析不同编程语言的代码结构

import Logger from 'electron-log'
import * as fs from 'fs/promises'
import * as path from 'path'

import { CodeContext, CodeSymbol, SymbolKind } from './types'

// 支持的语言类型
export enum LanguageType {
  TypeScript = 'typescript',
  JavaScript = 'javascript',
  JSON = 'json',
  HTML = 'html',
  CSS = 'css',
  Python = 'python',
  Java = 'java',
  CSharp = 'csharp',
  Go = 'go',
  Rust = 'rust',
  Unknown = 'unknown'
}

// 语言文件扩展名映射
const fileExtensionMap: Record<string, LanguageType> = {
  '.ts': LanguageType.TypeScript,
  '.tsx': LanguageType.TypeScript,
  '.js': LanguageType.JavaScript,
  '.jsx': LanguageType.JavaScript,
  '.json': LanguageType.JSON,
  '.html': LanguageType.HTML,
  '.htm': LanguageType.HTML,
  '.css': LanguageType.CSS,
  '.py': LanguageType.Python,
  '.java': LanguageType.Java,
  '.cs': LanguageType.CSharp,
  '.go': LanguageType.Go,
  '.rs': LanguageType.Rust
}

// 从文件扩展名获取语言类型
export function getLanguageFromFilePath(filePath: string): LanguageType {
  const ext = path.extname(filePath).toLowerCase()
  return fileExtensionMap[ext] || LanguageType.Unknown
}

// 简易代码解析器基类
export abstract class CodeParser {
  // 解析文件内容，提取代码符号
  abstract parseSymbols(filePath: string, content: string): Promise<CodeSymbol[]>

  // 创建代码上下文
  async getCodeContext(filePath: string, line: number, contextSize: number = 5): Promise<CodeContext | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const startLine = Math.max(1, line - contextSize)
      const endLine = Math.min(lines.length, line + contextSize)

      // 将上下文分为前置、当前和后置行
      const beforeLines = lines.slice(startLine - 1, line - 1)
      const currentLine = lines[line - 1] || ''
      const afterLines = lines.slice(line, endLine)

      return {
        symbol: undefined, // 相关符号（可选）
        lineNumber: line,
        line: currentLine,
        beforeLines: beforeLines,
        afterLines: afterLines
      }
    } catch (error) {
      Logger.error(`获取代码上下文失败: ${filePath}:${line}`, error)
      return null
    }
  }

  // 查找包含特定行的符号
  async findSymbolAtLine(symbols: CodeSymbol[], line: number): Promise<CodeSymbol | null> {
    for (const symbol of symbols) {
      if (line >= symbol.location.startLine && line <= symbol.location.endLine) {
        return symbol
      }
    }
    return null
  }
}

// TypeScript/JavaScript 代码解析器
export class TypeScriptParser extends CodeParser {
  async parseSymbols(filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = []
    const lines = content.split('\n')

    // 使用正则表达式查找常见的TypeScript/JavaScript定义

    // 查找类定义: class ClassName
    const classRegex = /class\s+([A-Za-z0-9_$]+)/g
    // 查找函数定义: function functionName() 或 const functionName = () =>
    const functionRegex =
      /(?:function\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(?.*\)?\s*=>)/g
    // 查找接口定义: interface InterfaceName
    const interfaceRegex = /interface\s+([A-Za-z0-9_$]+)(?:\s*extends\s+[A-Za-z0-9_$,\s]+)?(?:\s*\{|$)/g
    // 查找导出变量: export const/let/var varName
    const exportVarRegex = /export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)(?:\s*=|\s*:)/g
    // 查找方法定义: methodName() { 或 methodName = () => 或 methodName: () =>
    const methodRegex =
      /([A-Za-z0-9_$]+)\s*(?:\((?:[^)]*)\))(?:\s*:\s*[A-Za-z0-9_$<>[\]|,\s.]+)?\s*(?:\{|=>)|([A-Za-z0-9_$]+)\s*:\s*(?:async\s*)?(?:\([^)]*\))\s*(?:=>|\{)|([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g
    // 查找枚举定义: enum EnumName
    const enumRegex = /enum\s+([A-Za-z0-9_$]+)/g
    // 查找类型定义: type TypeName
    const typeRegex = /type\s+([A-Za-z0-9_$]+)(?:\s*=|\s*<)/g
    // 查找命名空间: namespace NamespaceName
    const namespaceRegex = /namespace\s+([A-Za-z0-9_$]+)/g

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 查找类定义
      let match
      while ((match = classRegex.exec(line)) !== null) {
        symbols.push({
          name: match[1],
          kind: SymbolKind.Class,
          location: {
            filePath,
            startLine: i + 1,
            endLine: i + 1,
            startColumn: match.index + 1,
            endColumn: match.index + match[0].length + 1
          }
        })
      }

      // 重置lastIndex以便重新搜索
      classRegex.lastIndex = 0

      // 查找函数定义
      while ((match = functionRegex.exec(line)) !== null) {
        const functionName = match[1] || match[2]
        if (functionName) {
          symbols.push({
            name: functionName,
            kind: SymbolKind.Function,
            location: {
              filePath,
              startLine: i + 1,
              endLine: i + 1,
              startColumn: match.index + 1,
              endColumn: match.index + match[0].length + 1
            }
          })
        }
      }

      // 重置正则表达式的lastIndex
      functionRegex.lastIndex = 0

      // 查找接口定义
      while ((match = interfaceRegex.exec(line)) !== null) {
        symbols.push({
          name: match[1],
          kind: SymbolKind.Interface,
          location: {
            filePath,
            startLine: i + 1,
            endLine: i + 1,
            startColumn: match.index + 1,
            endColumn: match.index + match[0].length + 1
          }
        })
      }

      // 重置正则表达式的lastIndex
      interfaceRegex.lastIndex = 0

      // 查找导出变量
      while ((match = exportVarRegex.exec(line)) !== null) {
        symbols.push({
          name: match[1],
          kind: match[0].includes('const') ? SymbolKind.Constant : SymbolKind.Variable,
          location: {
            filePath,
            startLine: i + 1,
            endLine: i + 1,
            startColumn: match.index + 1,
            endColumn: match.index + match[0].length + 1
          },
          modifiers: ['export']
        })
      }

      // 重置正则表达式的lastIndex
      exportVarRegex.lastIndex = 0

      // 查找方法定义
      while ((match = methodRegex.exec(line)) !== null) {
        const methodName = match[1] || match[2] || match[3]
        if (methodName && !methodName.match(/^(if|for|while|switch|catch)$/)) {
          // 排除控制结构关键字
          symbols.push({
            name: methodName,
            kind: SymbolKind.Method,
            location: {
              filePath,
              startLine: i + 1,
              endLine: i + 1,
              startColumn: match.index + 1,
              endColumn: match.index + match[0].length + 1
            }
          })
        }
      }

      // 重置正则表达式的lastIndex
      methodRegex.lastIndex = 0

      // 查找枚举定义
      while ((match = enumRegex.exec(line)) !== null) {
        symbols.push({
          name: match[1],
          kind: SymbolKind.Enum,
          location: {
            filePath,
            startLine: i + 1,
            endLine: i + 1,
            startColumn: match.index + 1,
            endColumn: match.index + match[0].length + 1
          }
        })
      }

      // 重置正则表达式的lastIndex
      enumRegex.lastIndex = 0

      // 查找类型定义
      while ((match = typeRegex.exec(line)) !== null) {
        symbols.push({
          name: match[1],
          kind: SymbolKind.TypeParameter,
          location: {
            filePath,
            startLine: i + 1,
            endLine: i + 1,
            startColumn: match.index + 1,
            endColumn: match.index + match[0].length + 1
          }
        })
      }

      // 重置正则表达式的lastIndex
      typeRegex.lastIndex = 0

      // 查找命名空间
      while ((match = namespaceRegex.exec(line)) !== null) {
        symbols.push({
          name: match[1],
          kind: SymbolKind.Namespace,
          location: {
            filePath,
            startLine: i + 1,
            endLine: i + 1,
            startColumn: match.index + 1,
            endColumn: match.index + match[0].length + 1
          }
        })
      }

      // 重置正则表达式的lastIndex
      namespaceRegex.lastIndex = 0
    }

    return symbols
  }
}

// 根据语言类型获取相应的解析器实例
export function getParserForLanguage(language: LanguageType): CodeParser {
  switch (language) {
    case LanguageType.TypeScript:
    case LanguageType.JavaScript:
      return new TypeScriptParser()
    // 可以添加其他语言的解析器
    default:
      // 默认使用TypeScript解析器
      return new TypeScriptParser()
  }
}

// 用于解析文件的帮助函数
export async function parseFile(filePath: string): Promise<CodeSymbol[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const language = getLanguageFromFilePath(filePath)
    const parser = getParserForLanguage(language)
    return await parser.parseSymbols(filePath, content)
  } catch (error) {
    Logger.error(`解析文件失败: ${filePath}`, error)
    return []
  }
}
