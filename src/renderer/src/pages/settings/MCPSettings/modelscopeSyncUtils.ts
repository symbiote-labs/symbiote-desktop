import i18n from '@renderer/i18n'
import { MCPServer } from '@renderer/types'
import { nanoid } from 'nanoid'

interface SyncResult {
  success: boolean
  servers?: MCPServer[]
  error?: string
}

/**
 * 从ModelScope同步MCP服务器
 * @param token ModelScope API令牌
 * @param existingServers 已有的MCP服务器列表
 * @returns 同步结果
 */
export async function syncModelScopeServers(token: string, existingServers: MCPServer[]): Promise<SyncResult> {
  try {
    // ModelScope API端点
    const apiUrl = 'https://modelscope.cn/api/v1/models'

    // 设置请求头
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // 发送请求
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      // 处理未授权的情况
      if (response.status === 401) {
        return {
          success: false,
          error: i18n.t('assistants.settings.mcp.sync.unauthorized', 'Sync Unauthorized')
        }
      }

      throw new Error(`API错误: ${response.status}`)
    }

    const data = await response.json()

    // 检查是否有可用服务器
    if (!data.data || !Array.isArray(data.data.models) || data.data.models.length === 0) {
      return {
        success: false,
        error: i18n.t('assistants.settings.mcp.sync.noServersAvailable', 'No MCP servers available')
      }
    }

    // 将模型数据转换为MCP服务器配置
    const modelServers: MCPServer[] = data.data.models
      .filter((model: any) => {
        // 仅筛选支持MCP协议的模型
        return model.inferences?.some((inference: any) => inference.protocol === 'mcp')
      })
      .map((model: any) => {
        // 寻找模型的MCP推理配置
        const mcpInference = model.inferences.find((inference: any) => inference.protocol === 'mcp')

        if (!mcpInference) {
          return null
        }

        // 生成唯一ID（避免与现有服务器冲突）
        const id = nanoid()

        // 提取API端点
        const baseUrl = mcpInference.url || ''

        // 构造MCP服务器对象
        return {
          id,
          name: model.name || `ModelScope-${id.substring(0, 6)}`,
          description: model.description || '',
          logoUrl: model.iconUrl || '',
          provider: 'ModelScope',
          tags: model.tags || [],
          baseUrl,
          headers: {
            Authorization: `Bearer ${token}`
          },
          isActive: false,
          type: 'streamableHttp'
        }
      })
      .filter(Boolean) // 移除null项

    // 在同步之前检查是否存在重复服务器
    const mergedServers = mergeServers(existingServers, modelServers)

    return {
      success: true,
      servers: mergedServers
    }
  } catch (error) {
    console.error('ModelScope同步错误:', error)
    return {
      success: false,
      error: i18n.t('assistants.settings.mcp.sync.error', 'Sync MCP Servers error')
    }
  }
}

/**
 * 合并现有服务器和新同步的服务器，避免重复
 * @param existingServers 已有的服务器列表
 * @param newServers 新同步的服务器列表
 * @returns 合并后的服务器列表
 */
function mergeServers(existingServers: MCPServer[], newServers: MCPServer[]): MCPServer[] {
  // 创建现有服务器的副本
  const result = [...existingServers]

  // 对于每个新服务器，检查是否已存在
  newServers.forEach((newServer) => {
    // 检查是否已存在相同URL的服务器
    const existingServerIndex = result.findIndex((server) => server.baseUrl === newServer.baseUrl)

    if (existingServerIndex !== -1) {
      // 如果存在，更新现有服务器的信息
      result[existingServerIndex] = {
        ...result[existingServerIndex],
        name: newServer.name,
        description: newServer.description,
        logoUrl: newServer.logoUrl,
        provider: newServer.provider,
        tags: newServer.tags,
        headers: newServer.headers
      }
    } else {
      // 如果不存在，添加新服务器
      result.push(newServer)
    }
  })

  return result
}
