import { useModuleManager } from '@renderer/services/ModuleManager'
import { useEffect } from 'react'

/**
 * ModuleManagerInitializer组件
 * 用于在应用启动时初始化模块管理器
 */
const ModuleManagerInitializer = () => {
  const { initializeModuleManager, isInitialized } = useModuleManager()

  useEffect(() => {
    if (!isInitialized) {
      initializeModuleManager()
    }
  }, [initializeModuleManager, isInitialized])

  // 这是一个初始化组件，不需要渲染任何UI
  return null
}

export default ModuleManagerInitializer
