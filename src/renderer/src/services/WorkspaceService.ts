import { Workspace } from '@renderer/store/workspace'

/**
 * 工作区服务 - 前端
 */
class WorkspaceService {
  /**
   * 选择工作区文件夹
   */
  public async selectWorkspaceFolder(): Promise<string | null> {
    try {
      // 尝试使用工作区专用的选择器
      try {
        console.log('尝试使用 workspace.selectFolder...')
        const folderPath = await window.api.workspace.selectFolder()
        console.log('工作区选择器结果:', folderPath)
        return folderPath
      } catch (workspaceError) {
        console.error('工作区选择器失败，尝试使用文件选择器:', workspaceError)

        // 如果工作区选择器失败，则使用文件选择器
        const result = await window.api.file.selectFolder()
        console.log('文件选择器结果:', result)
        if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
          return result.filePaths[0]
        }
      }
      return null
    } catch (error) {
      console.error('选择工作区文件夹失败:', error)
      return null
    }
  }

  /**
   * 获取工作区文件列表
   */
  public async getWorkspaceFiles(
    workspacePath: string,
    options: {
      extensions?: string[]
      excludePatterns?: string[]
      maxDepth?: number
      maxFiles?: number
    } = {}
  ): Promise<
    Array<{
      path: string
      fullPath: string
      name: string
      size: number
      isDirectory: boolean
      extension: string
      modifiedTime: number
    }>
  > {
    try {
      console.log('获取工作区文件列表:', workspacePath, options)
      // 使用 workspace API 获取文件列表
      const result = await window.api.workspace.getFiles(workspacePath, options)
      console.log('工作区文件列表结果:', result)
      return result
    } catch (error) {
      console.error('获取工作区文件列表失败:', error)
      return []
    }
  }

  /**
   * 读取工作区文件内容
   */
  public async readWorkspaceFile(filePath: string): Promise<string> {
    try {
      // 使用现有的文件读取API
      return await window.api.fs.read(filePath, 'utf-8')
    } catch (error) {
      console.error('读取工作区文件失败:', error)
      return ''
    }
  }

  /**
   * 获取工作区文件夹结构
   */
  public async getWorkspaceFolderStructure(
    workspacePath: string,
    options: {
      maxDepth?: number
      excludePatterns?: string[]
      directoryPath?: string // 新增参数，指定要加载的目录路径
      lazyLoad?: boolean // 新增参数，指定是否懒加载
    } = {}
  ): Promise<any> {
    try {
      console.log('获取工作区文件夹结构:', workspacePath, options)
      // 使用 workspace API 获取文件夹结构
      const result = await window.api.workspace.getFolderStructure(workspacePath, options)
      console.log('工作区文件夹结构结果:', result)
      return result
    } catch (error) {
      console.error('获取工作区文件夹结构失败:', error)
      // 如果失败，返回一个空的结构
      return {
        name: workspacePath.split(/[\\/]/).pop() || 'Workspace',
        type: 'directory',
        children: [],
        path: ''
      }
    }
  }

  /**
   * 创建工作区
   */
  public async createWorkspace(name: string, path: string): Promise<Workspace> {
    console.log('WorkspaceService.createWorkspace: 创建工作区', name, path)
    const workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      path
    }

    // 使用Redux action创建工作区
    window.store.dispatch({ type: 'workspace/addWorkspace', payload: workspace })

    // 获取新创建的工作区
    const workspaces = window.store.getState().workspace.workspaces
    const newWorkspace = workspaces[workspaces.length - 1]
    console.log('WorkspaceService.createWorkspace: 工作区创建成功', newWorkspace)
    return newWorkspace
  }

  /**
   * 设置当前工作区
   */
  public setCurrentWorkspace(workspaceId: string | null): void {
    console.log('WorkspaceService.setCurrentWorkspace: 设置当前工作区', workspaceId)
    window.store.dispatch({ type: 'workspace/setCurrentWorkspace', payload: workspaceId })

    // 验证设置是否成功
    const currentId = window.store.getState().workspace.currentWorkspaceId
    console.log('WorkspaceService.setCurrentWorkspace: 设置后的当前工作区ID', currentId)
  }

  /**
   * 获取当前工作区
   */
  public getCurrentWorkspace(): Workspace | null {
    const state = window.store.getState()
    const { currentWorkspaceId, workspaces } = state.workspace
    return currentWorkspaceId ? workspaces.find((w: Workspace) => w.id === currentWorkspaceId) || null : null
  }

  /**
   * 获取所有工作区
   */
  public getWorkspaces(): Workspace[] {
    return window.store.getState().workspace.workspaces
  }

  /**
   * 删除工作区
   */
  public deleteWorkspace(workspaceId: string): void {
    window.store.dispatch({ type: 'workspace/removeWorkspace', payload: workspaceId })
  }

  /**
   * 更新工作区
   */
  public updateWorkspace(workspaceId: string, workspace: Partial<Workspace>): void {
    window.store.dispatch({
      type: 'workspace/updateWorkspace',
      payload: { id: workspaceId, workspace }
    })
  }

  /**
   * 初始化工作区
   */
  public initWorkspaces(): void {
    window.store.dispatch({ type: 'workspace/initWorkspaces' })
  }
}

export default new WorkspaceService()
