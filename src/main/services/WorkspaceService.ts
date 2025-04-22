import { BrowserWindow, dialog, IpcMainInvokeEvent } from 'electron'
import fs from 'fs/promises'
import { glob } from 'glob'
import path from 'path'
import { promisify } from 'util'

import { Logger } from '../utils/logger'

// 定义文件夹结构接口
export interface FileNode {
  name: string
  type: 'file'
  extension: string
  path: string
}

export interface DirectoryNode {
  name: string
  type: 'directory'
  path: string
  hasChildren: boolean
  children: (FileNode | DirectoryNode)[]
}

export default class WorkspaceService {
  /**
   * 选择工作区文件夹
   */
  public async selectWorkspaceFolder(event: IpcMainInvokeEvent) {
    try {
      const browserWindow = BrowserWindow.fromWebContents(event.sender)
      if (!browserWindow) {
        throw new Error('No browser window found')
      }

      const { canceled, filePaths } = await dialog.showOpenDialog(browserWindow, {
        properties: ['openDirectory']
      })

      if (canceled || filePaths.length === 0) {
        return null
      }

      return filePaths[0]
    } catch (error) {
      Logger.error('[WorkspaceService] Error selecting workspace folder:', error)
      throw error
    }
  }

  /**
   * 获取工作区文件列表
   */
  public async getWorkspaceFiles(
    _: IpcMainInvokeEvent,
    workspacePath: string,
    options: {
      extensions?: string[]
      excludePatterns?: string[]
      maxDepth?: number
      maxFiles?: number
    } = {}
  ) {
    try {
      const {
        extensions = [],
        excludePatterns = ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        maxDepth = 5,
        maxFiles = 1000
      } = options

      // 检查路径是否存在
      await fs.access(workspacePath)

      // 构建glob模式
      let pattern = '**/*'
      if (extensions.length > 0) {
        pattern = `**/*.{${extensions.join(',')}}`
      }

      // 使用glob查找文件
      const files = (await promisify(glob)(pattern, {
        cwd: workspacePath,
        ignore: excludePatterns,
        nodir: true,
        dot: false,
        maxDepth: maxDepth
      })) as string[]

      // 限制文件数量
      const limitedFiles = files.slice(0, maxFiles)

      // 获取文件信息
      const fileInfoPromises = limitedFiles.map(async (file) => {
        const fullPath = path.join(workspacePath, file)
        const stats = await fs.stat(fullPath)
        return {
          path: file,
          fullPath,
          name: path.basename(file),
          size: stats.size,
          isDirectory: stats.isDirectory(),
          extension: path.extname(file),
          modifiedTime: stats.mtime.getTime()
        }
      })

      return await Promise.all(fileInfoPromises)
    } catch (error) {
      Logger.error('[WorkspaceService] Error getting workspace files:', error)
      throw error
    }
  }

  /**
   * 读取工作区文件内容
   */
  public async readWorkspaceFile(_: IpcMainInvokeEvent, filePath: string) {
    try {
      // 检查文件是否存在
      await fs.access(filePath)

      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch (error) {
      Logger.error('[WorkspaceService] Error reading workspace file:', error)
      throw error
    }
  }

  /**
   * 获取工作区文件夹结构
   */
  public async getWorkspaceFolderStructure(
    _: IpcMainInvokeEvent,
    workspacePath: string,
    options: {
      maxDepth?: number
      excludePatterns?: string[]
      directoryPath?: string // 新增参数，指定要加载的目录路径，相对于工作区路径
      lazyLoad?: boolean // 新增参数，指定是否懒加载
    } = {}
  ): Promise<DirectoryNode> {
    try {
      const {
        maxDepth = 3,
        excludePatterns = ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        directoryPath = '', // 默认为空，表示工作区根目录
        lazyLoad = false // 默认为 false，兼容原有行为
      } = options

      // 计算要加载的目录的完整路径
      const targetPath = directoryPath ? path.join(workspacePath, directoryPath) : workspacePath

      // 检查路径是否存在
      await fs.access(targetPath)

      // 递归获取文件夹结构
      const getFolderStructure = async (currentPath: string, depth: number = 0): Promise<DirectoryNode> => {
        if (depth > maxDepth) {
          // 如果是懒加载模式且超过最大深度，标记该目录可以被展开
          if (lazyLoad) {
            return {
              name: path.basename(currentPath),
              type: 'directory',
              path: path.relative(workspacePath, currentPath),
              hasChildren: true, // 标记该目录有子项，但尚未加载
              children: [] // 空数组表示未加载
            }
          }
          return {
            name: path.basename(currentPath),
            type: 'directory',
            path: path.relative(workspacePath, currentPath),
            hasChildren: false,
            children: []
          }
        }

        const entries = await fs.readdir(currentPath, { withFileTypes: true })
        const children: (FileNode | DirectoryNode)[] = []

        // 检查目录是否为空
        const hasChildren = entries.length > 0

        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name)

          // 检查是否应该排除
          const relativePath = path.relative(workspacePath, entryPath)
          const shouldExclude = excludePatterns.some((pattern) => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'))
            return regex.test(relativePath)
          })

          if (shouldExclude) {
            continue
          }

          if (entry.isDirectory()) {
            if (lazyLoad && depth > 0) {
              // 在懒加载模式下，对于非根目录，只添加目录节点，不加载其子项
              // 检查目录是否有子项
              let dirHasChildren = false
              try {
                const subEntries = await fs.readdir(entryPath)
                dirHasChildren = subEntries.length > 0
              } catch (err) {
                Logger.error(`[WorkspaceService] Error checking directory contents: ${entryPath}`, err)
              }

              children.push({
                name: entry.name,
                type: 'directory',
                path: relativePath,
                hasChildren: dirHasChildren, // 标记该目录是否有子项
                children: [] // 空数组表示未加载
              })
            } else {
              // 非懒加载模式或根目录，递归加载子目录
              const subDir = await getFolderStructure(entryPath, depth + 1)
              children.push(subDir)
            }
          } else {
            children.push({
              name: entry.name,
              type: 'file',
              extension: path.extname(entry.name),
              path: relativePath
            })
          }
        }

        return {
          name: path.basename(currentPath),
          type: 'directory',
          path: path.relative(workspacePath, currentPath),
          hasChildren, // 添加该属性标记目录是否有子项
          children
        }
      }

      return await getFolderStructure(targetPath)
    } catch (error) {
      Logger.error('[WorkspaceService] Error getting workspace folder structure:', error)
      throw error
    }
  }
}
