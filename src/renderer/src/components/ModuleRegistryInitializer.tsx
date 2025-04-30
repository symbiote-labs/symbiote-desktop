import { useModuleRegistry } from '@renderer/services/ModuleRegistryManager'
import { useEffect } from 'react'

/**
 * ModuleRegistryInitializer组件
 * 用于在应用启动时初始化模块注册表
 */
const ModuleRegistryInitializer = () => {
  const { initializeModuleRegistry, isInitialized } = useModuleRegistry()

  useEffect(() => {
    if (!isInitialized) {
      initializeModuleRegistry()
    }
  }, [initializeModuleRegistry, isInitialized])

  // 这是一个初始化组件，不需要渲染任何UI
  return null
}

export default ModuleRegistryInitializer
