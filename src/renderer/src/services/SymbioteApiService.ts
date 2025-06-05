import Logger from '@renderer/config/logger'

interface SymbioteAgentConfig {
  emoji: string
  name: string
  prompt: string
  type: string
}

class SymbioteApiService {
  private baseUrl = 'http://100.85.215.64:4500'
  //private baseUrl = 'https://use.symbiotelabs.ai' // Match AuthService URL
  private tokenKey = 'symbiote_bearer_token' // Match AuthService token key

  private async getCsrfToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const html = await response.text()
        // Extract CSRF token from meta tag
        const match = html.match(/<meta name="csrf-token" content="([^"]+)"/)
        return match ? match[1] : null
      }
    } catch (error) {
      Logger.error('[SymbioteApiService] Failed to get CSRF token:', error)
    }
    return null
  }

  async fetchAgentConfig(): Promise<SymbioteAgentConfig | null> {
    try {
      // Check for bearer token first (when "remember me" was used)
      const bearerToken = localStorage.getItem(this.tokenKey)

      // Build headers - include credentials for cookie-based auth
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      // Add Authorization header if we have a bearer token
      if (bearerToken) {
        headers['Authorization'] = `Bearer ${bearerToken}`
        Logger.log('[SymbioteApiService] Using bearer token authentication')
      } else {
        Logger.log('[SymbioteApiService] Using cookie-based authentication')

        // For cookie-based requests, we might need CSRF token
        const csrfToken = await this.getCsrfToken()
        if (csrfToken) {
          headers['X-CSRFToken'] = csrfToken
        }
      }

      const response = await fetch(`${this.baseUrl}/api/mcp/tools/cherry-studio-agent`, {
        method: 'GET',
        headers,
        credentials: 'include' // Always include cookies
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
}

export default new SymbioteApiService()
export type { SymbioteAgentConfig }