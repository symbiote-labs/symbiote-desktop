// src/main/mcpServers/codeAnalysis/astParser.ts
// 代码AST解析器：使用TypeScript编译器API进行更准确的代码结构分析

import Logger from 'electron-log'
import * as ts from 'typescript'

import { CodeParser } from './parser'
import { CodeSymbol, Location, SymbolKind } from './types'

// TypeScript AST解析器 - 使用TS编译器API
export class TypeScriptAstParser extends CodeParser {
  private compilerOptions: ts.CompilerOptions

  constructor() {
    super()
    // 配置编译器选项
    this.compilerOptions = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      allowJs: true,
      checkJs: true,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React
    }
  }

  async parseSymbols(filePath: string, content: string): Promise<CodeSymbol[]> {
    try {
      Logger.info(`[TypeScriptAstParser] 开始解析文件: ${filePath}`)

      const symbols: CodeSymbol[] = []

      // 创建源文件
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        this.compilerOptions.target || ts.ScriptTarget.Latest,
        true
      )

      // 解析AST
      this.visitNode(sourceFile, sourceFile, symbols, undefined)

      Logger.info(`[TypeScriptAstParser] 完成解析，找到 ${symbols.length} 个符号`)
      return symbols
    } catch (error) {
      Logger.error(`[TypeScriptAstParser] 解析文件失败: ${filePath}`, error)
      return []
    }
  }

  private visitNode(node: ts.Node, sourceFile: ts.SourceFile, symbols: CodeSymbol[], containerName?: string): void {
    // 解析不同类型的节点
    switch (node.kind) {
      // 类声明
      case ts.SyntaxKind.ClassDeclaration:
        this.visitClassDeclaration(node as ts.ClassDeclaration, sourceFile, symbols, containerName)
        break

      // 接口声明
      case ts.SyntaxKind.InterfaceDeclaration:
        this.visitInterfaceDeclaration(node as ts.InterfaceDeclaration, sourceFile, symbols, containerName)
        break

      // 函数声明
      case ts.SyntaxKind.FunctionDeclaration:
        this.visitFunctionDeclaration(node as ts.FunctionDeclaration, sourceFile, symbols, containerName)
        break

      // 变量声明
      case ts.SyntaxKind.VariableStatement:
        this.visitVariableStatement(node as ts.VariableStatement, sourceFile, symbols, containerName)
        break

      // 类型别名
      case ts.SyntaxKind.TypeAliasDeclaration:
        this.visitTypeAliasDeclaration(node as ts.TypeAliasDeclaration, sourceFile, symbols, containerName)
        break

      // 枚举声明
      case ts.SyntaxKind.EnumDeclaration:
        this.visitEnumDeclaration(node as ts.EnumDeclaration, sourceFile, symbols, containerName)
        break

      // 模块/命名空间声明
      case ts.SyntaxKind.ModuleDeclaration:
        this.visitModuleDeclaration(node as ts.ModuleDeclaration, sourceFile, symbols, containerName)
        break

      // 导出声明
      case ts.SyntaxKind.ExportDeclaration:
        this.visitExportDeclaration(node as ts.ExportDeclaration, sourceFile, symbols, containerName)
        break
    }

    // 递归访问子节点
    ts.forEachChild(node, (child) => this.visitNode(child, sourceFile, symbols, containerName))
  }

  // 访问类声明
  private visitClassDeclaration(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    symbols: CodeSymbol[],
    containerName?: string
  ): void {
    if (!node.name) return

    const className = node.name.text
    const location = this.getNodeLocation(node, sourceFile)
    const modifiers = this.getNodeModifiers(node)

    // 添加类符号
    symbols.push({
      name: className,
      kind: SymbolKind.Class,
      location,
      containerName,
      modifiers
    })

    // 处理类成员
    node.members.forEach((member) => {
      if (ts.isMethodDeclaration(member) && member.name) {
        // 方法
        const methodName = member.name.getText(sourceFile)
        const methodLocation = this.getNodeLocation(member, sourceFile)
        const methodModifiers = this.getNodeModifiers(member)

        symbols.push({
          name: methodName,
          kind: SymbolKind.Method,
          location: methodLocation,
          containerName: className,
          modifiers: methodModifiers
        })
      } else if (ts.isPropertyDeclaration(member) && member.name) {
        // 属性
        const propertyName = member.name.getText(sourceFile)
        const propertyLocation = this.getNodeLocation(member, sourceFile)
        const propertyModifiers = this.getNodeModifiers(member)

        symbols.push({
          name: propertyName,
          kind: SymbolKind.Property,
          location: propertyLocation,
          containerName: className,
          modifiers: propertyModifiers
        })
      } else if (ts.isConstructorDeclaration(member)) {
        // 构造函数
        const constructorLocation = this.getNodeLocation(member, sourceFile)

        symbols.push({
          name: 'constructor',
          kind: SymbolKind.Constructor,
          location: constructorLocation,
          containerName: className
        })

        // 处理构造函数参数
        member.parameters.forEach((param) => {
          if (param.name) {
            const paramName = param.name.getText(sourceFile)
            const paramLocation = this.getNodeLocation(param, sourceFile)

            symbols.push({
              name: paramName,
              kind: SymbolKind.Parameter,
              location: paramLocation,
              containerName: `${className}.constructor`
            })
          }
        })
      }
    })
  }

  // 访问接口声明
  private visitInterfaceDeclaration(
    node: ts.InterfaceDeclaration,
    sourceFile: ts.SourceFile,
    symbols: CodeSymbol[],
    containerName?: string
  ): void {
    const interfaceName = node.name.text
    const location = this.getNodeLocation(node, sourceFile)
    const modifiers = this.getNodeModifiers(node)

    symbols.push({
      name: interfaceName,
      kind: SymbolKind.Interface,
      location,
      containerName,
      modifiers
    })

    // 处理接口成员
    node.members.forEach((member) => {
      if (ts.isPropertySignature(member) && member.name) {
        const propertyName = member.name.getText(sourceFile)
        const propertyLocation = this.getNodeLocation(member, sourceFile)

        symbols.push({
          name: propertyName,
          kind: SymbolKind.Property,
          location: propertyLocation,
          containerName: interfaceName
        })
      } else if (ts.isMethodSignature(member) && member.name) {
        const methodName = member.name.getText(sourceFile)
        const methodLocation = this.getNodeLocation(member, sourceFile)

        symbols.push({
          name: methodName,
          kind: SymbolKind.Method,
          location: methodLocation,
          containerName: interfaceName
        })
      }
    })
  }

  // 访问函数声明
  private visitFunctionDeclaration(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile,
    symbols: CodeSymbol[],
    containerName?: string
  ): void {
    if (!node.name) return

    const functionName = node.name.text
    const location = this.getNodeLocation(node, sourceFile)
    const modifiers = this.getNodeModifiers(node)

    // 获取函数参数和返回类型信息
    const parameters = node.parameters.map((p) => p.name.getText(sourceFile)).join(', ')
    const returnType = node.type ? node.type.getText(sourceFile) : 'any'
    const details = `(${parameters}) => ${returnType}`

    symbols.push({
      name: functionName,
      kind: SymbolKind.Function,
      location,
      containerName,
      details,
      modifiers
    })

    // 处理函数参数
    node.parameters.forEach((param) => {
      const paramName = param.name.getText(sourceFile)
      const paramLocation = this.getNodeLocation(param, sourceFile)

      symbols.push({
        name: paramName,
        kind: SymbolKind.Parameter,
        location: paramLocation,
        containerName: functionName
      })
    })
  }

  // 访问变量声明
  private visitVariableStatement(
    node: ts.VariableStatement,
    sourceFile: ts.SourceFile,
    symbols: CodeSymbol[],
    containerName?: string
  ): void {
    const modifiers = this.getNodeModifiers(node)

    node.declarationList.declarations.forEach((declaration) => {
      const name = declaration.name.getText(sourceFile)
      const location = this.getNodeLocation(declaration, sourceFile)

      // 确定变量类型（常量还是变量）
      const isConst = node.declarationList.flags & ts.NodeFlags.Const
      const kind = isConst ? SymbolKind.Constant : SymbolKind.Variable

      // 检查是否是函数表达式
      let details: string | undefined = undefined
      if (
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
      ) {
        // 这是一个函数表达式或箭头函数
        const params = declaration.initializer.parameters.map((p) => p.name.getText(sourceFile)).join(', ')

        details = `(${params}) => ...`

        symbols.push({
          name,
          kind: SymbolKind.Function, // 将函数表达式标记为函数，而不是变量
          location,
          containerName,
          details,
          modifiers
        })

        // 处理函数参数
        declaration.initializer.parameters.forEach((param) => {
          const paramName = param.name.getText(sourceFile)
          const paramLocation = this.getNodeLocation(param, sourceFile)

          symbols.push({
            name: paramName,
            kind: SymbolKind.Parameter,
            location: paramLocation,
            containerName: name
          })
        })
      } else {
        // 普通变量
        symbols.push({
          name,
          kind,
          location,
          containerName,
          modifiers
        })
      }
    })
  }

  // 访问类型别名
  private visitTypeAliasDeclaration(
    node: ts.TypeAliasDeclaration,
    sourceFile: ts.SourceFile,
    symbols: CodeSymbol[],
    containerName?: string
  ): void {
    const name = node.name.text
    const location = this.getNodeLocation(node, sourceFile)
    const modifiers = this.getNodeModifiers(node)

    symbols.push({
      name,
      kind: SymbolKind.TypeAlias,
      location,
      containerName,
      modifiers
    })
  }

  // 访问枚举声明
  private visitEnumDeclaration(
    node: ts.EnumDeclaration,
    sourceFile: ts.SourceFile,
    symbols: CodeSymbol[],
    containerName?: string
  ): void {
    const name = node.name.text
    const location = this.getNodeLocation(node, sourceFile)
    const modifiers = this.getNodeModifiers(node)

    symbols.push({
      name,
      kind: SymbolKind.Enum,
      location,
      containerName,
      modifiers
    })

    // 处理枚举成员
    node.members.forEach((member) => {
      const memberName = member.name.getText(sourceFile)
      const memberLocation = this.getNodeLocation(member, sourceFile)

      symbols.push({
        name: memberName,
        kind: SymbolKind.EnumMember,
        location: memberLocation,
        containerName: name
      })
    })
  }

  // 访问模块/命名空间声明
  private visitModuleDeclaration(
    node: ts.ModuleDeclaration,
    sourceFile: ts.SourceFile,
    symbols: CodeSymbol[],
    containerName?: string
  ): void {
    const name = node.name.getText(sourceFile)
    const location = this.getNodeLocation(node, sourceFile)
    const modifiers = this.getNodeModifiers(node)
    const kind = node.flags & ts.NodeFlags.Namespace ? SymbolKind.Namespace : SymbolKind.Module

    symbols.push({
      name,
      kind,
      location,
      containerName,
      modifiers
    })

    // 处理模块内的声明
    if (node.body && ts.isModuleBlock(node.body)) {
      node.body.statements.forEach((statement) => {
        this.visitNode(statement, sourceFile, symbols, name)
      })
    }
  }

  // 访问导出声明
  private visitExportDeclaration(
    node: ts.ExportDeclaration,
    sourceFile: ts.SourceFile,
    symbols: CodeSymbol[],
    containerName?: string
  ): void {
    // 这里我们只记录有命名导出的情况
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      node.exportClause.elements.forEach((element) => {
        const name = element.name.text
        const location = this.getNodeLocation(element, sourceFile)

        // 记录导出的符号
        symbols.push({
          name,
          kind: SymbolKind.Variable, // 默认作为变量，实际类型需要通过解析导出的实际引用来确定
          location,
          containerName,
          modifiers: ['export']
        })
      })
    }
  }

  // 获取节点的位置信息
  private getNodeLocation(node: ts.Node, sourceFile: ts.SourceFile): Location {
    const start = node.getStart(sourceFile)
    const end = node.getEnd()

    const startLineCol = ts.getLineAndCharacterOfPosition(sourceFile, start)
    const endLineCol = ts.getLineAndCharacterOfPosition(sourceFile, end)

    return {
      filePath: sourceFile.fileName,
      startLine: startLineCol.line + 1, // 转为1-based
      endLine: endLineCol.line + 1,
      startColumn: startLineCol.character + 1,
      endColumn: endLineCol.character + 1
    }
  }

  // 获取节点的修饰符
  private getNodeModifiers(node: ts.Node): string[] | undefined {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
    if (!modifiers || modifiers.length === 0) return undefined

    return modifiers.map((modifier) => {
      switch (modifier.kind) {
        case ts.SyntaxKind.ExportKeyword:
          return 'export'
        case ts.SyntaxKind.DefaultKeyword:
          return 'default'
        case ts.SyntaxKind.ConstKeyword:
          return 'const'
        case ts.SyntaxKind.AsyncKeyword:
          return 'async'
        case ts.SyntaxKind.PublicKeyword:
          return 'public'
        case ts.SyntaxKind.PrivateKeyword:
          return 'private'
        case ts.SyntaxKind.ProtectedKeyword:
          return 'protected'
        case ts.SyntaxKind.ReadonlyKeyword:
          return 'readonly'
        case ts.SyntaxKind.StaticKeyword:
          return 'static'
        case ts.SyntaxKind.AbstractKeyword:
          return 'abstract'
        default:
          return 'unknown'
      }
    })
  }
}
