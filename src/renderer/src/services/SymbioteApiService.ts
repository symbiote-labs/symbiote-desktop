import Logger from '@renderer/config/logger'
import store from '@renderer/store'
import { MCPServer, Assistant, Provider } from '@renderer/types'
import AuthService from './AuthService'

interface SymbioteAgentConfig {
  emoji: string
  name: string
  prompt: string
  type: string
}

interface SymbioteConfigResponse {
  mcp_servers?: MCPServer[]
  assistants?: Assistant[]
  model_providers?: Provider[]
  // Future extensibility
  [key: string]: any
}

class SymbioteApiService {
  private getBaseUrl(): string {
    const state = store.getState()
    const configuredUrl = state.settings.symbioteBaseUrl

    // Use configured URL if available, otherwise fall back to default
    return configuredUrl || 'https://use.symbiotelabs.ai'
  }

  /**
   * Get JWT token for API requests. FAILS HARD if not available.
   * No fallbacks - JWT token is required for proper authentication.
   */
  private getJwtAuthToken(): string {
    const jwtToken = AuthService.getStoredJwtToken()
    if (jwtToken) {
      Logger.log('[SymbioteApiService] Using JWT token for authentication')
      return jwtToken
    }

    // FAIL HARD - no fallbacks allowed
    const error = 'JWT token not available - SymbioteApiService authentication failed. User must login and obtain JWT token.'
    Logger.error(`[SymbioteApiService] ${error}`)
    throw new Error(error)
  }

  async fetchAgentConfig(): Promise<SymbioteAgentConfig | null> {
    try {
      // Get JWT token - this will throw if not available (FAIL HARD)
      const jwtToken = this.getJwtAuthToken()

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }

      const response = await fetch(`${this.getBaseUrl()}/api/mcp/tools/cherry-studio-agent`, {
        method: 'GET',
        headers,
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 401) {
          Logger.warn('[SymbioteApiService] Authentication failed - user may need to log in again')
        } else {
          Logger.error(`[SymbioteApiService] API request failed with status: ${response.status}`)
        }
        return null
      }

      const data = await response.json()

      if (!Array.isArray(data) || data.length === 0) {
        Logger.warn('[SymbioteApiService] No agent configuration found in response')
        return null
      }

      const agentConfig = data[0]

      // Validate required fields
      if (!agentConfig.name || !agentConfig.prompt) {
        Logger.error('[SymbioteApiService] Invalid agent configuration: missing required fields')
        return null
      }

      Logger.log('[SymbioteApiService] Successfully fetched agent configuration:', agentConfig.name)
      return agentConfig

    } catch (error) {
      Logger.error('[SymbioteApiService] Error fetching agent configuration:', error)
      return null
    }
  }

  async fetchAgentConfigWithRetry(maxRetries = 3, delayMs = 1000): Promise<SymbioteAgentConfig | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.fetchAgentConfig()

      if (result !== null) {
        return result
      }

      if (attempt < maxRetries) {
        Logger.log(`[SymbioteApiService] Retry attempt ${attempt}/${maxRetries} in ${delayMs}ms`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        // Exponential backoff
        delayMs *= 2
      }
    }

    Logger.error('[SymbioteApiService] Failed to fetch agent configuration after all retries')
    return null
  }

  async fetchSymbioteConfig(): Promise<SymbioteConfigResponse | null> {
    try {
      // Get JWT token - this will throw if not available (FAIL HARD)
      const jwtToken = this.getJwtAuthToken()

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }

      const response = await fetch(`${this.getBaseUrl()}/api/mcp/tools/cherry-studio-assistant`, {
        method: 'GET',
        headers,
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 401) {
          Logger.warn('[SymbioteApiService] Authentication failed during config fetch - user may need to log in again')
        } else {
          Logger.error(`[SymbioteApiService] Config API request failed with status: ${response.status}`)
        }
        return null
      }

      const data = await response.json()

      // Validate that we have a valid assistant object
      if (!data || typeof data !== 'object' || !data.id || !data.name) {
        Logger.error('[SymbioteApiService] Invalid config response: not a valid assistant object')
        return null
      }

      Logger.log('[SymbioteApiService] Successfully fetched Symbiote assistant config')

      // Transform the single assistant response into the expected format
      const config: SymbioteConfigResponse = {
        assistants: [data]
      }

      // Extract MCP servers from the assistant if they exist
      if (data.mcpServers && Array.isArray(data.mcpServers)) {
        config.mcp_servers = data.mcpServers
        Logger.log(`[SymbioteApiService] Extracted ${data.mcpServers.length} MCP servers from assistant config`)
      }

      Logger.log('[SymbioteApiService] Successfully processed Symbiote config')

      return config

    } catch (error) {
      Logger.error('[SymbioteApiService] Error fetching Symbiote config:', error)
      return null
    }
  }

  async fetchSymbioteConfigWithRetry(maxRetries = 3, delayMs = 1000): Promise<SymbioteConfigResponse | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.fetchSymbioteConfig()

      if (result !== null) {
        return result
      }

      if (attempt < maxRetries) {
        Logger.log(`[SymbioteApiService] Config retry attempt ${attempt}/${maxRetries} in ${delayMs}ms`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        // Exponential backoff
        delayMs *= 2
      }
    }

    Logger.error('[SymbioteApiService] Failed to fetch Symbiote config after all retries')
    return null
  }
}

export default new SymbioteApiService()
export type { SymbioteAgentConfig, SymbioteConfigResponse }