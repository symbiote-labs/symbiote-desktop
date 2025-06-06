import { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth'
import {
  OAuthClientMetadata,
  OAuthClientInformation,
  OAuthTokens,
  OAuthClientInformationFull
} from '@modelcontextprotocol/sdk/shared/auth'
import { ipcMain } from 'electron'
import Logger from 'electron-log'

/**
 * Symbiote MCP Authentication Provider
 *
 * This provider integrates with the renderer's AuthService to provide JWT tokens
 * for authenticating with Symbiote MCP servers. It implements the OAuthClientProvider
 * interface but uses JWT tokens instead of a full OAuth flow.
 */
export class SymbioteMcpAuthProvider implements OAuthClientProvider {
  private jwtToken: string | null = null
  private lastTokenFetch: number = 0
  private readonly tokenCacheDuration = 5 * 60 * 1000 // 5 minutes

  constructor() {
    Logger.info('[SymbioteMcpAuthProvider] Initializing Symbiote MCP auth provider')
  }

  get redirectUrl(): string {
    // Not used for JWT auth, but required by interface
    return 'http://localhost:3000/auth/callback'
  }

  get clientMetadata(): OAuthClientMetadata {
    // Basic metadata - not used for JWT auth but required by interface
    return {
      client_name: 'Cherry Studio Symbiote Client',
      client_uri: 'https://github.com/CherryHQ/cherry-studio',
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code']
    }
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    // Return basic client info - not used for JWT auth but required by interface
    return {
      client_id: 'symbiote-cherry-studio',
      client_secret: undefined // JWT tokens don't use client secrets
    }
  }

  async saveClientInformation(clientInformation: OAuthClientInformationFull): Promise<void> {
    // Not needed for JWT auth - no-op
    Logger.debug('[SymbioteMcpAuthProvider] saveClientInformation called (no-op for JWT auth)')
  }

    async tokens(): Promise<OAuthTokens | undefined> {
    // Check if we have a cached token that's still valid
    const now = Date.now()
    if (this.jwtToken && (now - this.lastTokenFetch) < this.tokenCacheDuration) {
      // Validate token expiration
      if (this.isTokenValid(this.jwtToken)) {
        Logger.debug('[SymbioteMcpAuthProvider] Returning cached JWT token')
        return {
          access_token: this.jwtToken,
          token_type: 'Bearer'
        }
      } else {
        Logger.debug('[SymbioteMcpAuthProvider] Cached token is expired, fetching fresh token')
        this.jwtToken = null // Clear expired token
      }
    }

    // Fetch fresh JWT token from renderer
    try {
      Logger.debug('[SymbioteMcpAuthProvider] Fetching fresh JWT token from renderer')

      const token = await this.getJwtTokenFromRenderer()
      if (token && this.isTokenValid(token)) {
        this.jwtToken = token
        this.lastTokenFetch = now

        Logger.info('[SymbioteMcpAuthProvider] Successfully obtained JWT token')
        return {
          access_token: token,
          token_type: 'Bearer'
        }
      } else {
        Logger.warn('[SymbioteMcpAuthProvider] No valid JWT token available from renderer')
        return undefined
      }
    } catch (error) {
      Logger.error('[SymbioteMcpAuthProvider] Failed to get JWT token:', error)
      return undefined
    }
  }

  /**
   * Validate JWT token expiration
   */
  private isTokenValid(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      return payload.exp && payload.exp > now
    } catch (error) {
      Logger.error('[SymbioteMcpAuthProvider] Failed to validate token:', error)
      return false
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    // For JWT auth, we don't save tokens locally - they're managed by the AuthService
    Logger.debug('[SymbioteMcpAuthProvider] saveTokens called (no-op for JWT auth)')
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    // Not used for JWT auth - authentication happens in the main app
    Logger.warn('[SymbioteMcpAuthProvider] redirectToAuthorization called - JWT auth does not use OAuth flow')
    throw new Error('JWT authentication does not require OAuth flow')
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    // Not used for JWT auth - no-op
    Logger.debug('[SymbioteMcpAuthProvider] saveCodeVerifier called (no-op for JWT auth)')
  }

  async codeVerifier(): Promise<string> {
    // Not used for JWT auth - return empty string
    Logger.debug('[SymbioteMcpAuthProvider] codeVerifier called (no-op for JWT auth)')
    return ''
  }

    /**
   * Fetches JWT token from the renderer process via direct JavaScript execution
   */
  private async getJwtTokenFromRenderer(): Promise<string | null> {
    try {
      const { BrowserWindow } = require('electron')
      const mainWindow = BrowserWindow.getAllWindows()[0]

      if (!mainWindow || !mainWindow.webContents) {
        Logger.warn('[SymbioteMcpAuthProvider] No main window available')
        return null
      }

      // Execute JavaScript directly in the renderer to get the JWT token
      const token = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            // Try to get token from localStorage directly
            return localStorage.getItem('symbiote_jwt_token');
          } catch (error) {
            console.error('Failed to get JWT token from localStorage:', error);
            return null;
          }
        })()
      `)

      return token
    } catch (error) {
      Logger.error('[SymbioteMcpAuthProvider] Failed to get JWT token from renderer:', error)
      return null
    }
  }

  /**
   * Clear cached token (useful for logout)
   */
  public clearCache(): void {
    Logger.info('[SymbioteMcpAuthProvider] Clearing JWT token cache')
    this.jwtToken = null
    this.lastTokenFetch = 0
  }
}