/**
 * ModuleRegistryManager
 * 负责与 unpkg.com 交互，获取和管理 npm 包
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import axios from 'axios'
import { useCallback, useState } from 'react'

// NPM 模块接口定义
export interface NpmModule {
  id: string // 模块唯一标识符
  name: string // 模块显示名称
  packageName: string // npm 包名
  version: string // 版本号
  description: string // 描述
  category: string // 分类
  size: string // 大小
  dependencies: string[] // 依赖的其他模块
  isInstalled: boolean // 是否已安装
  isActive: boolean // 是否已激活
  entryPoint: string // 入口文件路径
  cdn: string // CDN URL，默认为 unpkg.com
}

// 模块注册表状态
export interface ModuleRegistryState {
  modules: NpmModule[]
  isInitialized: boolean
  isLoading: boolean
  error: string | null
}

// 初始状态
const initialState: ModuleRegistryState = {
  modules: [],
  isInitialized: false,
  isLoading: false,
  error: null
}

// 创建 Redux 切片
const moduleRegistrySlice = createSlice({
  name: 'moduleRegistry',
  initialState,
  reducers: {
    setModules: (state, action: PayloadAction<NpmModule[]>) => {
      state.modules = action.payload
    },
    addModule: (state, action: PayloadAction<NpmModule>) => {
      state.modules.push(action.payload)
    },
    updateModule: (state, action: PayloadAction<NpmModule>) => {
      const index = state.modules.findIndex((m) => m.id === action.payload.id)
      if (index !== -1) {
        state.modules[index] = action.payload
      }
    },
    removeModule: (state, action: PayloadAction<string>) => {
      state.modules = state.modules.filter((m) => m.id !== action.payload)
    },
    setModuleInstalled: (state, action: PayloadAction<{ id: string; isInstalled: boolean }>) => {
      const { id, isInstalled } = action.payload
      const module = state.modules.find((m) => m.id === id)
      if (module) {
        module.isInstalled = isInstalled
      }
    },
    setModuleActive: (state, action: PayloadAction<{ id: string; isActive: boolean }>) => {
      const { id, isActive } = action.payload
      const module = state.modules.find((m) => m.id === id)
      if (module) {
        module.isActive = isActive
      }
    },
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    }
  }
})

// 导出 actions
export const {
  setModules,
  addModule,
  updateModule,
  removeModule,
  setModuleInstalled,
  setModuleActive,
  setInitialized,
  setLoading,
  setError
} = moduleRegistrySlice.actions

// 导出 reducer
export const moduleRegistryReducer = moduleRegistrySlice.reducer

// 创建 Hook 用于访问模块注册表
export const useModuleRegistry = () => {
  const dispatch = useAppDispatch()
  const modules = useAppSelector((state) => state.moduleRegistry?.modules || [])
  const isInitialized = useAppSelector((state) => state.moduleRegistry?.isInitialized || false)
  const isLoading = useAppSelector((state) => state.moduleRegistry?.isLoading || false)
  const error = useAppSelector((state) => state.moduleRegistry?.error || null)
  const [localCache, setLocalCache] = useState<Record<string, any>>({})

  // 初始化模块注册表
  const initializeModuleRegistry = useCallback(async () => {
    if (isInitialized) return

    try {
      dispatch(setLoading(true))
      dispatch(setError(null))

      // 从本地存储加载已安装的模块
      const installedModules = localStorage.getItem('installedModules')
      if (installedModules) {
        const parsedModules = JSON.parse(installedModules) as NpmModule[]
        dispatch(setModules(parsedModules))
      } else {
        dispatch(setModules([]))
      }

      dispatch(setInitialized(true))
    } catch (error) {
      console.error('Failed to initialize module registry:', error)
      dispatch(setError('初始化模块注册表失败'))
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch, isInitialized])

  // 搜索 npm 包
  const searchNpmPackages = useCallback(
    async (query: string) => {
      try {
        dispatch(setLoading(true))
        dispatch(setError(null))

        // 使用 npm registry API 搜索包
        const response = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${query}&size=20`)

        // 转换为模块格式
        const searchResults = response.data.objects.map((obj: any) => ({
          id: obj.package.name,
          name: obj.package.name,
          packageName: obj.package.name,
          version: obj.package.version,
          description: obj.package.description,
          category: 'npm',
          size: 'Unknown',
          dependencies: [],
          isInstalled: false,
          isActive: false,
          entryPoint: '',
          cdn: 'https://unpkg.com'
        }))

        return searchResults
      } catch (error) {
        console.error('Failed to search npm packages:', error)
        dispatch(setError('搜索 npm 包失败'))
        return []
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch]
  )

  // 获取包信息
  const getPackageInfo = useCallback(
    async (packageName: string, version: string = 'latest') => {
      try {
        // 检查缓存
        const cacheKey = `${packageName}@${version}`
        if (localCache[cacheKey]) {
          return localCache[cacheKey]
        }

        // 从 npm registry 获取包信息
        const response = await axios.get(`https://registry.npmjs.org/${packageName}/${version}`)

        // 缓存结果
        setLocalCache((prev) => ({
          ...prev,
          [cacheKey]: response.data
        }))

        return response.data
      } catch (error) {
        console.error(`Failed to get package info for ${packageName}@${version}:`, error)
        throw new Error(`获取包信息失败: ${packageName}@${version}`)
      }
    },
    [localCache]
  )

  // 安装模块
  const installModule = useCallback(
    async (moduleId: string, version: string = 'latest') => {
      try {
        dispatch(setLoading(true))
        dispatch(setError(null))

        // 获取包信息
        const packageInfo = await getPackageInfo(moduleId, version)

        // 通过IPC调用下载模块
        console.log(`开始下载模块: ${moduleId}@${version}`)
        try {
          // 确保 version 参数不是 undefined
          const moduleVersion = version || 'latest'
          console.log(`调用 downloadModule 参数: moduleId=${moduleId}, version=${moduleVersion}`)

          const result = await window.api.moduleManager.downloadModule(moduleId, moduleVersion)
          console.log(`下载模块结果:`, result)

          if (!result.success) {
            throw new Error(result.error || `下载模块失败: ${moduleId}`)
          }
        } catch (downloadError) {
          console.error(`下载模块时发生错误:`, downloadError)
          throw downloadError
        }

        // 创建模块对象
        const newModule: NpmModule = {
          id: moduleId,
          name: packageInfo.name || moduleId,
          packageName: moduleId,
          version: packageInfo.version || version,
          description: packageInfo.description || '',
          category: 'npm',
          size: 'Unknown',
          dependencies: Object.keys(packageInfo.dependencies || {}),
          isInstalled: true,
          isActive: false,
          entryPoint: packageInfo.main || 'index.js',
          cdn: 'https://unpkg.com'
        }

        // 添加到模块列表
        dispatch(addModule(newModule))

        // 保存到本地存储
        const installedModules = localStorage.getItem('installedModules')
        let modules: NpmModule[] = []
        if (installedModules) {
          modules = JSON.parse(installedModules)
        }
        modules.push(newModule)
        localStorage.setItem('installedModules', JSON.stringify(modules))

        return true
      } catch (error) {
        console.error(`Failed to install module ${moduleId}:`, error)
        dispatch(setError(`安装模块失败: ${moduleId}`))
        return false
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch, getPackageInfo]
  )

  // 卸载模块
  const uninstallModule = useCallback(
    async (moduleId: string) => {
      try {
        dispatch(setLoading(true))
        dispatch(setError(null))

        // 通过IPC调用删除模块文件
        const result = await window.api.moduleManager.deleteModule(moduleId)

        if (!result.success) {
          throw new Error(result.error || `删除模块文件失败: ${moduleId}`)
        }

        // 从Redux状态中完全移除模块
        dispatch(removeModule(moduleId))

        // 从本地存储中移除
        const installedModules = localStorage.getItem('installedModules')
        if (installedModules) {
          let modules = JSON.parse(installedModules) as NpmModule[]
          modules = modules.filter((m) => m.id !== moduleId)
          localStorage.setItem('installedModules', JSON.stringify(modules))
        }

        return true
      } catch (error) {
        console.error(`Failed to uninstall module ${moduleId}:`, error)
        dispatch(setError(`卸载模块失败: ${moduleId}`))
        return false
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch]
  )

  // 激活模块
  const activateModule = useCallback(
    async (moduleId: string) => {
      try {
        dispatch(setLoading(true))
        dispatch(setError(null))

        // 获取模块
        const module = modules.find((m) => m.id === moduleId)
        if (!module) {
          throw new Error(`Module ${moduleId} not found`)
        }

        if (!module.isInstalled) {
          throw new Error(`Module ${moduleId} is not installed`)
        }

        // 激活模块
        dispatch(setModuleActive({ id: moduleId, isActive: true }))

        // 更新本地存储
        const installedModules = localStorage.getItem('installedModules')
        if (installedModules) {
          const modules = JSON.parse(installedModules) as NpmModule[]
          const index = modules.findIndex((m) => m.id === moduleId)
          if (index !== -1) {
            modules[index].isActive = true
            localStorage.setItem('installedModules', JSON.stringify(modules))
          }
        }

        return true
      } catch (error) {
        console.error(`Failed to activate module ${moduleId}:`, error)
        dispatch(setError(`激活模块失败: ${moduleId}`))
        return false
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch, modules]
  )

  // 停用模块
  const deactivateModule = useCallback(
    async (moduleId: string) => {
      try {
        dispatch(setLoading(true))
        dispatch(setError(null))

        // 停用模块
        dispatch(setModuleActive({ id: moduleId, isActive: false }))

        // 更新本地存储
        const installedModules = localStorage.getItem('installedModules')
        if (installedModules) {
          const modules = JSON.parse(installedModules) as NpmModule[]
          const index = modules.findIndex((m) => m.id === moduleId)
          if (index !== -1) {
            modules[index].isActive = false
            localStorage.setItem('installedModules', JSON.stringify(modules))
          }
        }

        return true
      } catch (error) {
        console.error(`Failed to deactivate module ${moduleId}:`, error)
        dispatch(setError(`停用模块失败: ${moduleId}`))
        return false
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch]
  )

  // 加载模块
  const loadModule = useCallback(
    async (moduleId: string) => {
      try {
        // 获取模块
        const module = modules.find((m) => m.id === moduleId)
        if (!module) {
          throw new Error(`Module ${moduleId} not found`)
        }

        if (!module.isInstalled || !module.isActive) {
          throw new Error(`Module ${moduleId} is not installed or not active`)
        }

        // 检查模块是否存在于本地文件系统
        const moduleVersion = module.version || 'latest'
        console.log(`检查模块是否存在: moduleId=${moduleId}, version=${moduleVersion}`)
        const moduleExists = await window.api.moduleManager.moduleExists(moduleId, moduleVersion)
        console.log(`模块存在检查结果: ${moduleExists}`)

        if (!moduleExists) {
          // 如果本地不存在，尝试下载
          console.log(`Module ${moduleId} not found locally, downloading...`)
          const downloadResult = await window.api.moduleManager.downloadModule(moduleId, moduleVersion)
          console.log(`下载模块结果:`, downloadResult)

          if (!downloadResult.success) {
            throw new Error(downloadResult.error || `Failed to download module ${moduleId}`)
          }
        }

        // 构建本地文件URL
        // 注意：这里我们需要使用特殊的协议来访问本地文件
        // 例如：file:///path/to/module/file.js
        // 但这可能会受到浏览器安全策略的限制
        // 作为替代方案，我们可以使用 Electron 的 file: 协议

        // 获取应用信息以构建路径
        console.log('获取应用信息...')
        const appInfo = await window.api.getAppInfo()
        console.log('应用信息:', appInfo)

        // 使用前面已经定义的 moduleVersion
        const modulePath = `${appInfo.appDataPath}/npm-modules/${moduleId}/${moduleVersion}/${module.entryPoint}`
        console.log('模块路径:', modulePath)

        const moduleUrl = `file://${modulePath.replace(/\\/g, '/')}`
        console.log('模块URL:', moduleUrl)

        // 动态导入模块
        const script = document.createElement('script')
        script.src = moduleUrl
        script.type = 'module'

        // 返回一个 Promise，在脚本加载完成后解析
        return new Promise((resolve, reject) => {
          script.onload = () => resolve(true)
          script.onerror = (e) => {
            console.error('Script load error:', e)
            reject(new Error(`Failed to load module ${moduleId} from ${moduleUrl}`))
          }
          document.head.appendChild(script)
        })
      } catch (error) {
        console.error(`Failed to load module ${moduleId}:`, error)
        throw error
      }
    },
    [modules]
  )

  return {
    modules,
    isInitialized,
    isLoading,
    error,
    initializeModuleRegistry,
    searchNpmPackages,
    getPackageInfo,
    installModule,
    uninstallModule,
    activateModule,
    deactivateModule,
    loadModule
  }
}
