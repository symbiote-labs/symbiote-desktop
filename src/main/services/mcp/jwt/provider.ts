import Logger from 'electron-log'

import { JwtAuthProvider, JwtTokens, JwtProviderOptions } from './types'

/**
 * JWT MCP Authentication Provider
 *
 * This provider handles JWT-based authentication for MCP servers without
 * implementing OAuth interfaces. It focuses purely on JWT token management,
 * caching, and validation.
 */
export class JwtMcpAuthProvider implements JwtAuthProvider {
  private jwtToken: string | null = null
  private lastTokenFetch: number = 0
  private readonly tokenCacheDuration: number
  private readonly serverUrlHash: string
  private readonly tokenStorageKey: string

  constructor(options: JwtProviderOptions) {
    this.serverUrlHash = options.serverUrlHash
    this.tokenCacheDuration = options.tokenCacheDuration || 5 * 60 * 1000 // 5 minutes default
    this.tokenStorageKey = options.tokenStorageKey || 'symbiote_jwt_token'

    Logger.info(`[JwtMcpAuthProvider] Initializing JWT auth provider for server: ${this.serverUrlHash}`)
  }

  async tokens(): Promise<JwtTokens | undefined> {
    // Check if we have a cached token that's still valid
    const now = Date.now()
    if (this.jwtToken && (now - this.lastTokenFetch) < this.tokenCacheDuration) {
      // Validate token expiration
      if (this.isTokenValid(this.jwtToken)) {
        Logger.debug('[JwtMcpAuthProvider] Returning cached JWT token')
        return {
          access_token: this.jwtToken,
          token_type: 'Bearer'
        }
      } else {
        Logger.debug('[JwtMcpAuthProvider] Cached token is expired, fetching fresh token')
        this.jwtToken = null // Clear expired token
      }
    }

    // Fetch fresh JWT token from renderer
    try {
      Logger.debug('[JwtMcpAuthProvider] Fetching fresh JWT token from renderer')

      const token = await this.getJwtTokenFromRenderer()
      if (token && this.isTokenValid(token)) {
        this.jwtToken = token
        this.lastTokenFetch = now

        Logger.info('[JwtMcpAuthProvider] Successfully obtained JWT token')
        return {
          access_token: token,
          token_type: 'Bearer'
        }
      } else {
        Logger.warn('[JwtMcpAuthProvider] No valid JWT token available from renderer')
        return undefined
      }
    } catch (error) {
      Logger.error('[JwtMcpAuthProvider] Failed to get JWT token:', error)
      return undefined
    }
  }

  /**
   * Validate JWT token expiration
   */
  isTokenValid(token: string): boolean {
    try {
      // JWT tokens have three parts separated by dots
      const parts = token.split('.')
      if (parts.length !== 3) {
        Logger.debug('[JwtMcpAuthProvider] Invalid JWT format - not 3 parts')
        return false
      }

      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1]))
      const now = Math.floor(Date.now() / 1000)

      // Check expiration
      if (payload.exp && payload.exp <= now) {
        Logger.debug('[JwtMcpAuthProvider] Token is expired')
        return false
      }

      return true
    } catch (error) {
      Logger.error('[JwtMcpAuthProvider] Failed to validate token:', error)
      return false
    }
  }

  /**
   * Clear cached token (useful for logout)
   */
  clearCache(): void {
    Logger.info('[JwtMcpAuthProvider] Clearing JWT token cache')
    this.jwtToken = null
    this.lastTokenFetch = 0
  }

  /**
   * Fetches JWT token from the renderer process via direct JavaScript execution
   */
  private async getJwtTokenFromRenderer(): Promise<string | null> {
    try {
      const { BrowserWindow } = require('electron')
      const mainWindow = BrowserWindow.getAllWindows()[0]

      if (!mainWindow || !mainWindow.webContents) {
        Logger.warn('[JwtMcpAuthProvider] No main window available')
        return null
      }

      // Execute JavaScript directly in the renderer to get the JWT token
      const token = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            // Try to get token from localStorage directly
            return localStorage.getItem('${this.tokenStorageKey}');
          } catch (error) {
            console.error('Failed to get JWT token from localStorage:', error);
            return null;
          }
        })()
      `)

      return token
    } catch (error) {
      Logger.error('[JwtMcpAuthProvider] Failed to get JWT token from renderer:', error)
      return null
    }
  }
}