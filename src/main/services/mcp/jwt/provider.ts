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
   * Fetches JWT token from the renderer process via direct JavaScript execution and IPC
   */
  private async getJwtTokenFromRenderer(): Promise<string | null> {
    // Method 1: Try IPC first (most reliable)
    try {
      const { BrowserWindow } = require('electron')
      const mainWindow = BrowserWindow.getAllWindows()[0]

      if (mainWindow && mainWindow.webContents) {
        const token = await mainWindow.webContents.executeJavaScript(`
          (function() {
            try {
              // Try localStorage first with the correct key
              const token = localStorage.getItem('symbiote_jwt_token');
              if (token && token.includes('.')) { // Basic JWT check
                console.log('[JWT] Found token in localStorage');
                return token;
              }
              
              // Try window context if available
              if (window.__AUTH_CONTEXT__ && window.__AUTH_CONTEXT__.jwtToken) {
                console.log('[JWT] Found token in window.__AUTH_CONTEXT__');
                return window.__AUTH_CONTEXT__.jwtToken;
              }
              
              return null;
            } catch (error) {
              console.error('Failed to get JWT token:', error);
              return null;
            }
          })()
        `)

        if (token) {
          Logger.info('[JwtMcpAuthProvider] Successfully retrieved JWT token from renderer via direct JS')
          return token
        }
      }
    } catch (error) {
      Logger.error('[JwtMcpAuthProvider] Failed to get JWT token via direct JS:', error)
    }

    // Method 2: Try direct window execution with multiple fallbacks (legacy method)
    try {
      const { BrowserWindow } = require('electron')
      const mainWindow = BrowserWindow.getAllWindows()[0]

      if (!mainWindow || !mainWindow.webContents) {
        Logger.warn('[JwtMcpAuthProvider] No main window available')
        return null
      }

      // Execute JavaScript directly in the renderer to get the JWT token
      // Try multiple methods to get the token
      const token = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            // Method 1: Try to get token from localStorage with common keys
            const possibleKeys = ['${this.tokenStorageKey}', 'jwt_token', 'access_token', 'auth_token'];
            for (const key of possibleKeys) {
              const token = localStorage.getItem(key);
              if (token && token.includes('.')) { // Basic JWT check (contains dots)
                console.log('[JWT] Found token in localStorage with key:', key);
                return token;
              }
            }

            // Method 2: Try to access the auth context from window
            if (window.__AUTH_CONTEXT__ && window.__AUTH_CONTEXT__.jwtToken) {
              console.log('[JWT] Found token in window.__AUTH_CONTEXT__');
              return window.__AUTH_CONTEXT__.jwtToken;
            }

            // Method 3: Try to get token from Redux store if available
            if (window.__REDUX_STORE__ && window.__REDUX_STORE__.getState) {
              const state = window.__REDUX_STORE__.getState();
              if (state.auth && state.auth.jwtToken) {
                console.log('[JWT] Found token in Redux store');
                return state.auth.jwtToken;
              }
            }

            // Method 4: Try sessionStorage
            const sessionToken = sessionStorage.getItem('${this.tokenStorageKey}') || sessionStorage.getItem('jwt_token');
            if (sessionToken && sessionToken.includes('.')) {
              console.log('[JWT] Found token in sessionStorage');
              return sessionToken;
            }

            console.warn('[JWT] No token found in any storage method');
            return null;
          } catch (error) {
            console.error('Failed to get JWT token from renderer:', error);
            return null;
          }
        })()
      `)

      if (token) {
        Logger.info('[JwtMcpAuthProvider] Successfully retrieved JWT token from renderer via fallback methods')
        return token
      } else {
        Logger.warn('[JwtMcpAuthProvider] No JWT token found in renderer via any method')
      }

      return token
    } catch (error) {
      Logger.error('[JwtMcpAuthProvider] Failed to get JWT token from renderer:', error)
      return null
    }
  }
}