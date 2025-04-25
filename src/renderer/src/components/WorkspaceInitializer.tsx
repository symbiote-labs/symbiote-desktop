import WorkspaceService from '@renderer/services/WorkspaceService'
import React, { useEffect } from 'react'

/**
 * 工作区初始化组件
 * 用于在应用启动时初始化工作区
 */
const WorkspaceInitializer: React.FC = () => {
  useEffect(() => {
    // 初始化工作区
    WorkspaceService.initWorkspaces()
    console.log('[WorkspaceInitializer] 工作区初始化完成')
  }, [])

  return null
}

export default WorkspaceInitializer
