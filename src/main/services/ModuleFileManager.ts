import { IpcChannel } from '@shared/IpcChannel'
import axios from 'axios'
import { app, ipcMain } from 'electron'
import Logger from 'electron-log'
import { createWriteStream } from 'fs'
import fs from 'fs-extra'
import path from 'path'
import { pipeline } from 'stream/promises'

export class ModuleFileManager {
  private static instance: ModuleFileManager | null = null
  private modulesDir: string

  private constructor() {
    this.modulesDir = path.join(app.getPath('userData'), 'npm-modules')
    this.initModulesDir()
    this.registerIpcHandlers()
  }

  public static getInstance(): ModuleFileManager {
    if (!ModuleFileManager.instance) {
      ModuleFileManager.instance = new ModuleFileManager()
    }
    return ModuleFileManager.instance
  }

  private initModulesDir(): void {
    if (!fs.existsSync(this.modulesDir)) {
      fs.mkdirSync(this.modulesDir, { recursive: true })
      Logger.info(`Created npm-modules directory at ${this.modulesDir}`)
    }
  }

  private registerIpcHandlers(): void {
    Logger.info('Registering ModuleFileManager IPC handlers')
    ipcMain.handle(IpcChannel.Module_Download, this.downloadModule.bind(this))
    ipcMain.handle(IpcChannel.Module_Delete, this.deleteModule.bind(this))
    ipcMain.handle(IpcChannel.Module_List, this.listModules.bind(this))
    ipcMain.handle(IpcChannel.Module_Exists, this.moduleExists.bind(this))
    Logger.info('ModuleFileManager IPC handlers registered successfully')
  }

  /**
   * 下载模块到本地
   */
  private async downloadModule(
    _: Electron.IpcMainInvokeEvent,
    packageName: string,
    version: string
  ): Promise<{ success: boolean; error?: string; modulePath?: string }> {
    // 确保 version 参数有值
    const moduleVersion = version || 'latest'
    Logger.info(`downloadModule called with packageName=${packageName}, version=${moduleVersion}`)
    try {
      Logger.info(`Downloading module: ${packageName}@${moduleVersion}`)

      // 创建模块目录
      const moduleDir = path.join(this.modulesDir, packageName)
      if (!fs.existsSync(moduleDir)) {
        fs.mkdirSync(moduleDir, { recursive: true })
      }

      // 创建版本目录
      const versionDir = path.join(moduleDir, version)
      if (!fs.existsSync(versionDir)) {
        fs.mkdirSync(versionDir, { recursive: true })
      } else {
        // 如果目录已存在，先清空
        fs.emptyDirSync(versionDir)
      }

      // 下载 package.json
      const packageJsonUrl = `https://unpkg.com/${packageName}@${version}/package.json`
      const packageJsonResponse = await axios.get(packageJsonUrl)
      const packageJson = packageJsonResponse.data

      // 保存 package.json
      fs.writeFileSync(path.join(versionDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // 获取入口文件
      const entryPoint = packageJson.main || 'index.js'

      // 下载入口文件
      const entryFileUrl = `https://unpkg.com/${packageName}@${version}/${entryPoint}`
      const entryFilePath = path.join(versionDir, entryPoint)

      // 确保入口文件的目录存在
      const entryFileDir = path.dirname(entryFilePath)
      if (!fs.existsSync(entryFileDir)) {
        fs.mkdirSync(entryFileDir, { recursive: true })
      }

      // 使用流式下载
      const response = await axios({
        method: 'get',
        url: entryFileUrl,
        responseType: 'stream'
      })

      await pipeline(response.data, createWriteStream(entryFilePath))

      // 下载依赖文件（简化版，只下载直接引用的文件）
      // 实际应用中可能需要更复杂的依赖解析
      await this.downloadDependencies(packageName, version, versionDir, entryPoint)

      Logger.info(`Module downloaded successfully: ${packageName}@${version}`)
      return {
        success: true,
        modulePath: versionDir
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logger.error(`Failed to download module ${packageName}@${version}:`, error)
      return {
        success: false,
        error: `下载模块失败: ${errorMessage}`
      }
    }
  }

  /**
   * 下载模块依赖
   */
  private async downloadDependencies(
    packageName: string,
    version: string,
    versionDir: string,
    entryPoint: string
  ): Promise<void> {
    Logger.info(`Downloading dependencies for ${packageName}@${version}, entryPoint: ${entryPoint}`)
    try {
      // 读取入口文件内容
      const entryFilePath = path.join(versionDir, entryPoint)
      const entryFileContent = fs.readFileSync(entryFilePath, 'utf-8')

      // 简单解析 import 和 require 语句（这是一个简化版，实际应用中需要更复杂的解析）
      const importRegex = /(?:import|require)\s*\(?['"](.+?)['"]\)?/g
      let match: RegExpExecArray | null
      const dependencies = new Set<string>()

      while ((match = importRegex.exec(entryFileContent)) !== null) {
        const dependency = match[1]
        if (!dependency.startsWith('.') && !dependency.startsWith('/')) {
          // 跳过外部模块
          continue
        }
        dependencies.add(dependency)
      }

      // 下载每个依赖
      for (const dependency of dependencies) {
        // 解析相对路径
        const dependencyPath = dependency.startsWith('.') ? path.join(path.dirname(entryPoint), dependency) : dependency

        // 构建 URL
        let dependencyUrl = `https://unpkg.com/${packageName}@${version}/${dependencyPath}`

        // 如果没有扩展名，尝试添加 .js
        if (!path.extname(dependencyPath)) {
          dependencyUrl += '.js'
        }

        // 构建本地路径
        let localPath = path.join(versionDir, dependencyPath)
        if (!path.extname(localPath)) {
          localPath += '.js'
        }

        // 确保目录存在
        const dependencyDir = path.dirname(localPath)
        if (!fs.existsSync(dependencyDir)) {
          fs.mkdirSync(dependencyDir, { recursive: true })
        }

        try {
          // 下载依赖文件
          const response = await axios({
            method: 'get',
            url: dependencyUrl,
            responseType: 'stream'
          })

          await pipeline(response.data, createWriteStream(localPath))
          Logger.info(`Downloaded dependency: ${dependencyPath}`)

          // 递归下载子依赖（可选，可能导致过多请求）
          // await this.downloadDependencies(packageName, version, versionDir, dependencyPath)
        } catch (error) {
          Logger.warn(`Failed to download dependency ${dependencyPath}:`, error)
          // 继续下载其他依赖
        }
      }
    } catch (error) {
      Logger.error(`Failed to download dependencies for ${packageName}@${version}:`, error)
      throw error
    }
  }

  /**
   * 删除模块
   */
  private async deleteModule(
    _: Electron.IpcMainInvokeEvent,
    packageName: string,
    version: string | null
  ): Promise<{ success: boolean; error?: string }> {
    Logger.info(`deleteModule called with packageName=${packageName}, version=${version}`)
    try {
      const moduleDir = path.join(this.modulesDir, packageName)

      if (!fs.existsSync(moduleDir)) {
        return { success: true } // 模块不存在，视为删除成功
      }

      if (version) {
        // 删除特定版本
        const versionDir = path.join(moduleDir, version)
        if (fs.existsSync(versionDir)) {
          fs.removeSync(versionDir)

          // 检查是否还有其他版本
          const versions = fs.readdirSync(moduleDir)
          if (versions.length === 0) {
            // 没有其他版本，删除整个模块目录
            fs.removeSync(moduleDir)
          }
        }
      } else {
        // 删除整个模块
        fs.removeSync(moduleDir)
      }

      Logger.info(`Module deleted: ${packageName}${version ? `@${version}` : ''}`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logger.error(`Failed to delete module ${packageName}:`, error)
      return { success: false, error: `删除模块失败: ${errorMessage}` }
    }
  }

  /**
   * 列出已安装的模块
   */
  private async listModules(): Promise<{ packageName: string; versions: string[] }[]> {
    try {
      const modules: { packageName: string; versions: string[] }[] = []

      if (!fs.existsSync(this.modulesDir)) {
        return modules
      }

      const packageNames = fs.readdirSync(this.modulesDir)

      for (const packageName of packageNames) {
        const moduleDir = path.join(this.modulesDir, packageName)
        if (fs.statSync(moduleDir).isDirectory()) {
          const versions = fs
            .readdirSync(moduleDir)
            .filter((version) => fs.statSync(path.join(moduleDir, version)).isDirectory())

          modules.push({
            packageName,
            versions
          })
        }
      }

      return modules
    } catch (error) {
      Logger.error('Failed to list modules:', error)
      return []
    }
  }

  /**
   * 检查模块是否存在
   */
  private async moduleExists(_: Electron.IpcMainInvokeEvent, packageName: string, version: string): Promise<boolean> {
    // 确保 version 参数有值
    const moduleVersion = version || 'latest'
    Logger.info(`moduleExists called with packageName=${packageName}, version=${moduleVersion}`)
    try {
      const versionDir = path.join(this.modulesDir, packageName, moduleVersion)
      const exists = fs.existsSync(versionDir)
      Logger.info(`Module ${packageName}@${moduleVersion} exists: ${exists}`)
      return exists
    } catch (error) {
      Logger.error(`Failed to check if module exists: ${packageName}@${moduleVersion}`, error)
      return false
    }
  }

  /**
   * 获取模块路径
   */
  public getModulePath(packageName: string, version?: string): string {
    const moduleVersion = version || 'latest'
    return path.join(this.modulesDir, packageName, moduleVersion)
  }
}

export default ModuleFileManager.getInstance()
