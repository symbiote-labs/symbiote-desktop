import { nanoid } from '@reduxjs/toolkit'
import type { MCPServer } from '@renderer/types'
import i18next from 'i18next'

// Token storage constants and utilities
const TOKEN_STORAGE_KEY = 'cherrycloud_token'
// const HOST = 'http://localhost:1323'
export const HOST = 'https://cherry-ai.cloud'

export const saveCherryCloudToken = (token: string): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export const getCherryCloudToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export const clearCherryCloudToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export const hasCherryCloudToken = (): boolean => {
  return !!getCherryCloudToken()
}

interface CherryCloudServer {
  name: string
  display_name?: string
  description?: string
  version: string
  categories?: string[]
  logo?: string
}

interface CherryCloudSyncResult {
  success: boolean
  message: string
  addedServers: MCPServer[]
  errorDetails?: string
}

// Function to fetch and process CherryCloud servers
export const syncCherryCloudServers = async (
  token: string,
  existingServers: MCPServer[]
): Promise<CherryCloudSyncResult> => {
  const t = i18next.t

  try {
    const response = await fetch(`${HOST}/v1/mcps`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      clearCherryCloudToken()
      return {
        success: false,
        message: t('settings.mcp.sync.unauthorized', 'Sync Unauthorized'),
        addedServers: []
      }
    }

    // Handle server errors
    if (response.status === 500 || !response.ok) {
      return {
        success: false,
        message: t('settings.mcp.sync.error'),
        addedServers: [],
        errorDetails: `Status: ${response.status}`
      }
    }

    // Process successful response
    const data = await response.json()
    const servers: CherryCloudServer[] = data.data || []

    if (servers.length === 0) {
      return {
        success: true,
        message: t('settings.mcp.sync.noServersAvailable', 'No MCP servers available'),
        addedServers: []
      }
    }

    // Transform CherryCloud servers to MCP servers format
    const addedServers: MCPServer[] = []

    for (const server of servers) {
      try {
        // Skip if server already exists
        if (existingServers.some((s) => s.id === `@cherrycloud/${server.name}`)) continue

        const mcpServer: MCPServer = {
          id: `@cherrycloud/${server.name}`,
          name: server.display_name || server.name || `CherryCloud Server ${nanoid()}`,
          description: server.description || '',
          type: 'streamableHttp',
          baseUrl: `${HOST}/v1/mcps/${server.name}`,
          isActive: true,
          provider: 'CherryCloud',
          providerUrl: `${HOST}/mcps/${server.name}`,
          logoUrl: server.logo || '',
          tags: server.categories || []
        }

        addedServers.push(mcpServer)
      } catch (err) {
        console.error('Error processing CherryCloud server:', err)
      }
    }

    return {
      success: true,
      message: t('settings.mcp.sync.success', { count: addedServers.length }),
      addedServers
    }
  } catch (error) {
    console.error('CherryCloud sync error:', error)
    return {
      success: false,
      message: t('settings.mcp.sync.error'),
      addedServers: [],
      errorDetails: String(error)
    }
  }
}
