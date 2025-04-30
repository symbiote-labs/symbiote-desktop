import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { useCallback } from 'react'

// 模块接口定义
export interface Module {
  id: string
  name: string
  description: string
  category: string
  version: string
  downloadUrl: string
  size: string
  dependencies: string[]
  entryPoint: string
  isActive: boolean
  isInstalled: boolean
}

// 模块管理器状态
export interface ModuleManagerState {
  modules: Module[]
  isInitialized: boolean
}

// 初始状态
const initialState: ModuleManagerState = {
  modules: [],
  isInitialized: false
}

// 创建Redux切片
const moduleManagerSlice = createSlice({
  name: 'moduleManager',
  initialState,
  reducers: {
    setModules: (state, action: PayloadAction<Module[]>) => {
      state.modules = action.payload
    },
    addModule: (state, action: PayloadAction<Module>) => {
      state.modules.push(action.payload)
    },
    updateModule: (state, action: PayloadAction<Module>) => {
      const index = state.modules.findIndex((m) => m.id === action.payload.id)
      if (index !== -1) {
        state.modules[index] = action.payload
      }
    },
    setModuleActive: (state, action: PayloadAction<{ id: string; isActive: boolean }>) => {
      const { id, isActive } = action.payload
      const module = state.modules.find((m) => m.id === id)
      if (module) {
        module.isActive = isActive
      }
    },
    setModuleInstalled: (state, action: PayloadAction<{ id: string; isInstalled: boolean }>) => {
      const { id, isInstalled } = action.payload
      const module = state.modules.find((m) => m.id === id)
      if (module) {
        module.isInstalled = isInstalled
      }
    },
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload
    }
  }
})

// 导出actions
export const { setModules, addModule, updateModule, setModuleActive, setModuleInstalled, setInitialized } =
  moduleManagerSlice.actions

// 导出reducer
export const moduleManagerReducer = moduleManagerSlice.reducer

// 创建Hook用于访问模块管理器
export const useModuleManager = () => {
  const dispatch = useAppDispatch()
  const modules = useAppSelector((state) => state.moduleManager?.modules || [])
  const isInitialized = useAppSelector((state) => state.moduleManager?.isInitialized || false)

  // 初始化模块管理器
  const initializeModuleManager = useCallback(async () => {
    if (isInitialized) return

    try {
      // 这里可以从本地存储或API加载模块列表
      // 暂时使用空数组
      dispatch(setModules([]))
      dispatch(setInitialized(true))
    } catch (error) {
      console.error('Failed to initialize module manager:', error)
    }
  }, [dispatch, isInitialized])

  // 获取所有模块
  const getAllModules = useCallback(() => {
    return modules
  }, [modules])

  // 获取已安装的模块
  const getInstalledModules = useCallback(() => {
    return modules.filter((m) => m.isInstalled)
  }, [modules])

  // 获取已激活的模块
  const getActiveModules = useCallback(() => {
    return modules.filter((m) => m.isActive && m.isInstalled)
  }, [modules])

  // 安装模块
  const installModule = useCallback(
    async (moduleId: string) => {
      try {
        // 这里实现模块下载和安装逻辑
        // 暂时只更新状态
        dispatch(setModuleInstalled({ id: moduleId, isInstalled: true }))
        return true
      } catch (error) {
        console.error(`Failed to install module ${moduleId}:`, error)
        return false
      }
    },
    [dispatch]
  )

  // 卸载模块
  const uninstallModule = useCallback(
    async (moduleId: string) => {
      try {
        // 这里实现模块卸载逻辑
        // 暂时只更新状态
        dispatch(setModuleInstalled({ id: moduleId, isInstalled: false }))
        // 同时停用模块
        dispatch(setModuleActive({ id: moduleId, isActive: false }))
        return true
      } catch (error) {
        console.error(`Failed to uninstall module ${moduleId}:`, error)
        return false
      }
    },
    [dispatch]
  )

  // 激活模块
  const activateModule = useCallback(
    async (moduleId: string) => {
      try {
        const module = modules.find((m) => m.id === moduleId)
        if (!module) throw new Error(`Module ${moduleId} not found`)
        if (!module.isInstalled) throw new Error(`Module ${moduleId} is not installed`)

        // 检查依赖
        const missingDependencies = module.dependencies.filter((depId) => {
          const dep = modules.find((m) => m.id === depId)
          return !dep || !dep.isInstalled || !dep.isActive
        })

        if (missingDependencies.length > 0) {
          throw new Error(`Missing dependencies: ${missingDependencies.join(', ')}`)
        }

        // 激活模块
        dispatch(setModuleActive({ id: moduleId, isActive: true }))
        return true
      } catch (error) {
        console.error(`Failed to activate module ${moduleId}:`, error)
        return false
      }
    },
    [dispatch, modules]
  )

  // 停用模块
  const deactivateModule = useCallback(
    async (moduleId: string) => {
      try {
        // 检查是否有其他模块依赖此模块
        const dependentModules = modules.filter((m) => m.isActive && m.dependencies.includes(moduleId))

        if (dependentModules.length > 0) {
          throw new Error(
            `Cannot deactivate: other modules depend on it: ${dependentModules.map((m) => m.name).join(', ')}`
          )
        }

        // 停用模块
        dispatch(setModuleActive({ id: moduleId, isActive: false }))
        return true
      } catch (error) {
        console.error(`Failed to deactivate module ${moduleId}:`, error)
        return false
      }
    },
    [dispatch, modules]
  )

  // 添加新模块
  const registerModule = useCallback(
    (module: Omit<Module, 'isInstalled' | 'isActive'>) => {
      const newModule: Module = {
        ...module,
        isInstalled: false,
        isActive: false
      }
      dispatch(addModule(newModule))
    },
    [dispatch]
  )

  return {
    modules,
    isInitialized,
    initializeModuleManager,
    getAllModules,
    getInstalledModules,
    getActiveModules,
    installModule,
    uninstallModule,
    activateModule,
    deactivateModule,
    registerModule
  }
}
