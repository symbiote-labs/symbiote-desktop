// src/main/mcpServers/codeAnalysis/dependencyAnalyzer.ts
// 项目依赖分析器：分析代码中的模块依赖和引用关系

import Logger from 'electron-log'
import * as fs from 'fs/promises'
import { minimatch } from 'minimatch'
import * as path from 'path'
import * as ts from 'typescript'

// 依赖节点类型
export interface DependencyNode {
  filePath: string // 文件路径
  relativePath: string // 相对于工作区的路径
  imports: ImportInfo[] // 导入信息
  exports: ExportInfo[] // 导出信息
  dependencies: string[] // 依赖的模块路径
  dependents: string[] // 依赖于本模块的其他模块路径
}

// 导入信息
export interface ImportInfo {
  name: string // 导入的名称
  source: string // 导入源
  isDefault: boolean // 是否是默认导入
  isNamespace: boolean // 是否是命名空间导入
  localName?: string // 本地名称（如果有重命名）
}

// 导出信息
export interface ExportInfo {
  name: string // 导出的名称
  isDefault: boolean // 是否是默认导出
  isReExport: boolean // 是否是重新导出
  source?: string // 重新导出的源
}

// 依赖图类型
export interface DependencyGraph {
  nodes: { [filePath: string]: DependencyNode }
  externalDependencies: Set<string>
}

// 依赖分析选项
export interface DependencyAnalysisOptions {
  includePatterns?: string[] // 要包含的文件模式
  excludePatterns?: string[] // 要排除的文件模式
  includeNodeModules?: boolean // 是否包含node_modules
  maxDepth?: number // 最大递归深度
}

// 项目依赖分析器类
export class DependencyAnalyzer {
  private workspacePath: string
  private compilerOptions: ts.CompilerOptions
  private dependencyGraph: DependencyGraph
  private fileToModule: Map<string, string> = new Map()
  private moduleToFile: Map<string, string> = new Map()

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.compilerOptions = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      allowJs: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      baseUrl: workspacePath
    }

    this.dependencyGraph = {
      nodes: {},
      externalDependencies: new Set<string>()
    }
  }

  // 分析项目依赖
  async analyzeDependencies(options: DependencyAnalysisOptions = {}): Promise<DependencyGraph> {
    const {
      includePatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      excludePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**'],
      includeNodeModules = false,
      maxDepth = 10
    } = options

    Logger.info(`[DependencyAnalyzer] 开始分析项目依赖: ${this.workspacePath}`)

    // 重置依赖图
    this.dependencyGraph = {
      nodes: {},
      externalDependencies: new Set<string>()
    }

    // 判断文件是否应该被处理
    const shouldProcessFile = (filePath: string): boolean => {
      const relativePath = path.relative(this.workspacePath, filePath)

      // 检查排除模式
      if (!includeNodeModules && relativePath.includes('node_modules')) {
        return false
      }

      if (excludePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))) {
        return false
      }

      // 检查包含模式
      return includePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))
    }

    // 查找所有符合条件的文件
    const fileQueue: { filePath: string; depth: number }[] = []

    // 递归查找文件
    const findFiles = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name)

          if (entry.isDirectory()) {
            // 如果是目录并且不是被排除的，则递归处理
            const relativePath = path.relative(this.workspacePath, fullPath)
            if (!excludePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))) {
              await findFiles(fullPath)
            }
          } else if (entry.isFile() && shouldProcessFile(fullPath)) {
            // 加入队列
            fileQueue.push({ filePath: fullPath, depth: 0 })
          }
        }
      } catch (error) {
        Logger.error(`[DependencyAnalyzer] 查找文件失败: ${dirPath}`, error)
      }
    }

    await findFiles(this.workspacePath)

    // 创建一个解析器主机
    const compilerHost = ts.createCompilerHost(this.compilerOptions)

    // 处理文件队列
    while (fileQueue.length > 0) {
      const { filePath, depth } = fileQueue.shift()!

      if (depth > maxDepth) {
        Logger.warn(`[DependencyAnalyzer] 达到最大递归深度 (${maxDepth}): ${filePath}`)
        continue
      }

      // 跳过已处理的文件
      if (this.dependencyGraph.nodes[filePath]) {
        continue
      }

      try {
        // 解析文件依赖
        const fileContent = await fs.readFile(filePath, 'utf-8')
        const sourceFile = ts.createSourceFile(
          filePath,
          fileContent,
          this.compilerOptions.target || ts.ScriptTarget.Latest,
          true
        )

        // 创建依赖节点
        const relativePath = path.relative(this.workspacePath, filePath)
        const node: DependencyNode = {
          filePath,
          relativePath,
          imports: [],
          exports: [],
          dependencies: [],
          dependents: []
        }

        // 分析导入和导出
        this.analyzeImportsAndExports(sourceFile, node)

        // 解析模块说明符为实际文件路径
        for (const importInfo of node.imports) {
          const resolvedModule = ts.resolveModuleName(importInfo.source, filePath, this.compilerOptions, compilerHost)

          if (resolvedModule.resolvedModule) {
            const resolvedFilePath = resolvedModule.resolvedModule.resolvedFileName

            // 判断是内部依赖还是外部依赖
            if (resolvedFilePath.startsWith(this.workspacePath)) {
              // 内部依赖
              node.dependencies.push(resolvedFilePath)

              // 将依赖文件加入队列
              if (!this.dependencyGraph.nodes[resolvedFilePath] && shouldProcessFile(resolvedFilePath)) {
                fileQueue.push({ filePath: resolvedFilePath, depth: depth + 1 })
              }
            } else {
              // 外部依赖
              this.dependencyGraph.externalDependencies.add(importInfo.source)
            }
          } else {
            // 无法解析的模块，可能是外部依赖
            this.dependencyGraph.externalDependencies.add(importInfo.source)
          }
        }

        // 添加到依赖图
        this.dependencyGraph.nodes[filePath] = node

        // 映射文件路径和模块名称
        const moduleName = this.getModuleNameFromFile(filePath)
        this.fileToModule.set(filePath, moduleName)
        this.moduleToFile.set(moduleName, filePath)
      } catch (error) {
        Logger.error(`[DependencyAnalyzer] 分析文件依赖失败: ${filePath}`, error)
      }
    }

    // 构建依赖关系（添加dependents）
    for (const [filePath, node] of Object.entries(this.dependencyGraph.nodes)) {
      for (const dependency of node.dependencies) {
        if (this.dependencyGraph.nodes[dependency]) {
          this.dependencyGraph.nodes[dependency].dependents.push(filePath)
        }
      }
    }

    Logger.info(
      `[DependencyAnalyzer] 依赖分析完成，找到 ${Object.keys(this.dependencyGraph.nodes).length} 个模块，${
        this.dependencyGraph.externalDependencies.size
      } 个外部依赖`
    )

    return this.dependencyGraph
  }

  // 分析文件中的导入和导出
  private analyzeImportsAndExports(sourceFile: ts.SourceFile, node: DependencyNode): void {
    // 遍历AST
    ts.forEachChild(sourceFile, (child) => {
      // 导入声明
      if (ts.isImportDeclaration(child)) {
        if (child.importClause && ts.isStringLiteral(child.moduleSpecifier)) {
          const source = child.moduleSpecifier.text

          // 默认导入
          if (child.importClause.name) {
            node.imports.push({
              name: child.importClause.name.text,
              source,
              isDefault: true,
              isNamespace: false
            })
          }

          // 命名导入
          if (child.importClause.namedBindings) {
            if (ts.isNamedImports(child.importClause.namedBindings)) {
              // import { x, y as z } from 'module'
              child.importClause.namedBindings.elements.forEach((element) => {
                const importName = element.propertyName ? element.propertyName.text : element.name.text
                const localName = element.name.text

                node.imports.push({
                  name: importName,
                  source,
                  isDefault: false,
                  isNamespace: false,
                  localName: importName !== localName ? localName : undefined
                })
              })
            } else if (ts.isNamespaceImport(child.importClause.namedBindings)) {
              // import * as ns from 'module'
              node.imports.push({
                name: '*',
                source,
                isDefault: false,
                isNamespace: true,
                localName: child.importClause.namedBindings.name.text
              })
            }
          }
        }
      }
      // 导出声明
      else if (ts.isExportDeclaration(child)) {
        if (!child.moduleSpecifier) {
          // export { x, y }
          if (child.exportClause && ts.isNamedExports(child.exportClause)) {
            child.exportClause.elements.forEach((element) => {
              node.exports.push({
                name: element.name.text,
                isDefault: false,
                isReExport: false
              })
            })
          }
        } else if (ts.isStringLiteral(child.moduleSpecifier)) {
          // export { x, y } from 'module'
          const source = child.moduleSpecifier.text

          if (child.exportClause && ts.isNamedExports(child.exportClause)) {
            child.exportClause.elements.forEach((element) => {
              node.exports.push({
                name: element.name.text,
                isDefault: false,
                isReExport: true,
                source
              })
            })
          } else {
            // export * from 'module'
            node.exports.push({
              name: '*',
              isDefault: false,
              isReExport: true,
              source
            })
          }
        }
      }
      // 导出变量/函数/类声明
      else if (
        (ts.isVariableStatement(child) ||
          ts.isFunctionDeclaration(child) ||
          ts.isClassDeclaration(child) ||
          ts.isInterfaceDeclaration(child) ||
          ts.isTypeAliasDeclaration(child) ||
          ts.isEnumDeclaration(child)) &&
        child.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        // export const x = 1; 或 export function f() {} 或 export class C {}
        if (ts.isVariableStatement(child)) {
          child.declarationList.declarations.forEach((decl) => {
            if (ts.isIdentifier(decl.name)) {
              node.exports.push({
                name: decl.name.text,
                isDefault: false,
                isReExport: false
              })
            }
          })
        } else if (
          (ts.isFunctionDeclaration(child) ||
            ts.isClassDeclaration(child) ||
            ts.isInterfaceDeclaration(child) ||
            ts.isTypeAliasDeclaration(child) ||
            ts.isEnumDeclaration(child)) &&
          child.name
        ) {
          const isDefault = child.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)

          node.exports.push({
            name: child.name.text,
            isDefault,
            isReExport: false
          })
        }
      }
      // 默认导出表达式
      else if (ts.isExportAssignment(child) && !child.isExportEquals) {
        // export default ...
        node.exports.push({
          name: 'default',
          isDefault: true,
          isReExport: false
        })
      }
    })
  }

  // 从文件路径获取模块名称
  private getModuleNameFromFile(filePath: string): string {
    const relativePath = path.relative(this.workspacePath, filePath)
    // 去除扩展名
    return relativePath.replace(/\.(js|jsx|ts|tsx)$/, '')
  }

  // 获取文件的所有依赖
  async getAllDependencies(filePath: string): Promise<string[]> {
    const node = this.dependencyGraph.nodes[filePath]
    if (!node) {
      return []
    }

    const dependencies: string[] = []
    const visited = new Set<string>()

    const traverse = (currentPath: string) => {
      if (visited.has(currentPath)) {
        return
      }

      visited.add(currentPath)
      const currentNode = this.dependencyGraph.nodes[currentPath]

      if (!currentNode) {
        return
      }

      for (const dependency of currentNode.dependencies) {
        dependencies.push(dependency)
        traverse(dependency)
      }
    }

    traverse(filePath)

    return dependencies
  }

  // 获取依赖于指定文件的所有文件
  async getAllDependents(filePath: string): Promise<string[]> {
    const node = this.dependencyGraph.nodes[filePath]
    if (!node) {
      return []
    }

    const dependents: string[] = []
    const visited = new Set<string>()

    const traverse = (currentPath: string) => {
      if (visited.has(currentPath)) {
        return
      }

      visited.add(currentPath)
      const currentNode = this.dependencyGraph.nodes[currentPath]

      if (!currentNode) {
        return
      }

      for (const dependent of currentNode.dependents) {
        dependents.push(dependent)
        traverse(dependent)
      }
    }

    traverse(filePath)

    return dependents
  }

  // 检查循环依赖
  findCircularDependencies(): string[][] {
    const circularDependencies: string[][] = []
    const visited = new Set<string>()
    const stack: string[] = []

    const visit = (filePath: string) => {
      if (stack.includes(filePath)) {
        // 找到循环依赖
        const start = stack.indexOf(filePath)
        const cycle = stack.slice(start).concat(filePath)
        circularDependencies.push(cycle)
        return
      }

      if (visited.has(filePath)) {
        return
      }

      visited.add(filePath)
      stack.push(filePath)

      const node = this.dependencyGraph.nodes[filePath]
      if (node) {
        for (const dependency of node.dependencies) {
          visit(dependency)
        }
      }

      stack.pop()
    }

    // 对每个文件检查循环依赖
    for (const filePath of Object.keys(this.dependencyGraph.nodes)) {
      visit(filePath)
    }

    return circularDependencies
  }

  // 计算文件的直接依赖数
  countDirectDependencies(filePath: string): number {
    const node = this.dependencyGraph.nodes[filePath]
    return node ? node.dependencies.length : 0
  }

  // 计算依赖于文件的数量
  countDirectDependents(filePath: string): number {
    const node = this.dependencyGraph.nodes[filePath]
    return node ? node.dependents.length : 0
  }

  // 获取引用最多的文件
  getMostReferencedFiles(limit: number = 10): { filePath: string; count: number }[] {
    const files = Object.keys(this.dependencyGraph.nodes)
      .map((filePath) => ({
        filePath,
        count: this.countDirectDependents(filePath)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return files
  }

  // 生成可视化的依赖图数据（用于前端展示）
  generateVisualizationData() {
    const nodes = Object.values(this.dependencyGraph.nodes).map((node) => ({
      id: node.filePath,
      label: path.basename(node.filePath),
      group: this.getFileGroup(node.filePath),
      dependencies: node.dependencies.length,
      dependents: node.dependents.length
    }))

    const edges: Array<{ from: string; to: string }> = []

    for (const node of Object.values(this.dependencyGraph.nodes)) {
      for (const dependency of node.dependencies) {
        edges.push({
          from: node.filePath,
          to: dependency
        })
      }
    }

    return { nodes, edges }
  }

  // 根据文件类型获取分组
  private getFileGroup(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()

    if (ext === '.ts' || ext === '.tsx') {
      return 'typescript'
    } else if (ext === '.js' || ext === '.jsx') {
      return 'javascript'
    } else if (ext === '.css' || ext === '.scss' || ext === '.less') {
      return 'style'
    } else if (ext === '.json') {
      return 'json'
    } else {
      return 'other'
    }
  }
}
