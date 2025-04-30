import { createSlice, PayloadAction } from '@reduxjs/toolkit'

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
interface ModuleManagerState {
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
export default moduleManagerSlice.reducer
