// 导入 AgentTask 类型从 types/index.ts
import { AgentTask, MCPCallToolResponse, MCPTool } from '@renderer/types'
import { callMCPTool } from '@renderer/utils/mcp-tools'
import { v4 as uuidv4 } from 'uuid'

export interface AgentState {
  isRunning: boolean
  tasks: AgentTask[]
  currentTaskIndex: number
  maxApiRequests: number
  apiRequestCount: number
}

class AgentService {
  private state: AgentState = {
    isRunning: false,
    tasks: [],
    currentTaskIndex: -1,
    maxApiRequests: 20,
    apiRequestCount: 0
  }

  private listeners: ((state: AgentState) => void)[] = []

  constructor() {
    this.resetState()
  }

  public resetState() {
    this.state = {
      isRunning: false,
      tasks: [],
      currentTaskIndex: -1,
      maxApiRequests: 20,
      apiRequestCount: 0
    }
    this.notifyListeners()
  }

  public getState(): AgentState {
    return { ...this.state }
  }

  public startAgent(maxApiRequests: number) {
    this.state.isRunning = true
    this.state.maxApiRequests = maxApiRequests
    this.state.apiRequestCount = 0
    this.state.tasks = []
    this.state.currentTaskIndex = -1
    this.notifyListeners()
  }

  public stopAgent() {
    this.state.isRunning = false
    this.notifyListeners()
  }

  public addTask(title: string, description: string, messageId: string): string {
    const taskId = uuidv4()
    const task: AgentTask = {
      id: taskId,
      title,
      description,
      status: 'pending',
      messageId: messageId, // 添加关联的消息ID
      // 初始化其他可选字段
      toolName: undefined,
      toolArgs: undefined,
      toolResponse: undefined
    }
    this.state.tasks.push(task)
    this.notifyListeners()
    return taskId
  }

  public updateTask(taskId: string, updates: Partial<AgentTask>) {
    const taskIndex = this.state.tasks.findIndex((task) => task.id === taskId)
    if (taskIndex !== -1) {
      this.state.tasks[taskIndex] = {
        ...this.state.tasks[taskIndex],
        ...updates
      }
      this.notifyListeners()
    }
  }

  public async executeTask(taskId: string, tool: MCPTool): Promise<MCPCallToolResponse> {
    const taskIndex = this.state.tasks.findIndex((task) => task.id === taskId)
    if (taskIndex === -1) {
      throw new Error(`Task with ID ${taskId} not found`)
    }

    // Update task status to running
    this.updateTask(taskId, {
      status: 'running',
      toolName: tool.name,
      toolArgs: tool.inputSchema
    })

    try {
      // Increment API request count
      this.state.apiRequestCount++
      this.notifyListeners()

      // Call the tool
      const response = await callMCPTool(tool)

      // Format the result for display
      let resultText = ''
      if (response.content) {
        for (const content of response.content) {
          if (content.type === 'text') {
            resultText += content.text
          }
        }
      }

      // Update task with result
      this.updateTask(taskId, {
        status: 'completed',
        result: resultText,
        toolResponse: response
      })

      return response
    } catch (error) {
      // Update task with error
      this.updateTask(taskId, {
        status: 'error',
        result: `Error: ${error instanceof Error ? error.message : String(error)}`
      })
      throw error
    }
  }

  public setCurrentTask(taskIndex: number) {
    if (taskIndex >= -1 && taskIndex < this.state.tasks.length) {
      this.state.currentTaskIndex = taskIndex
      this.notifyListeners()
    }
  }

  public canContinue(): boolean {
    return this.state.isRunning && this.state.apiRequestCount < this.state.maxApiRequests
  }

  public clearTasks() {
    this.state.tasks = []
    this.state.currentTaskIndex = -1
    this.notifyListeners()
  }

  public addListener(listener: (state: AgentState) => void) {
    this.listeners.push(listener)
  }

  public removeListener(listener: (state: AgentState) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener)
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener({ ...this.state })
    }
  }
}

// Export a singleton instance
export const agentService = new AgentService()
export default agentService
