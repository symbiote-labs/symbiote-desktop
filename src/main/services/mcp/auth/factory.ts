import crypto from 'node:crypto'

import Logger from 'electron-log'

import { JwtMcpAuthProvider } from '../jwt/provider'
import { McpOAuthClientProvider } from '../oauth/provider'
import { AuthProvider, MCPServerConfig, AuthMethod } from './types'

/**
 * Creates the appropriate authentication provider based on server configuration
 *
 * @param serverConfig MCP server configuration
 * @returns Authentication provider (JWT or OAuth)
 */
export function createAuthProvider(serverConfig: MCPServerConfig): AuthProvider {
  const authMethod = detectAuthMethod(serverConfig)
  const serverUrlHash = createServerHash(serverConfig.baseUrl || serverConfig.name)

  Logger.info(`[AuthFactory] Creating ${authMethod.type} auth provider for server: ${serverConfig.name} (${authMethod.reason})`)

  if (authMethod.type === 'jwt') {
    return new JwtMcpAuthProvider({
      serverUrlHash,
      tokenCacheDuration: 5 * 60 * 1000 // 5 minutes
    })
  } else {
    return new McpOAuthClientProvider({
      serverUrlHash,
      callbackPort: 12346,
      callbackPath: '/oauth/callback',
      clientName: 'Symbiote Desktop',
      clientUri: 'https://github.com/CherryHQ/cherry-studio'
    })
  }
}

/**
 * Type guard to check if a provider is a JWT provider
 *
 * @param provider Authentication provider to check
 * @returns True if provider is JWT-based
 */
export function isJwtProvider(provider: AuthProvider): provider is JwtMcpAuthProvider {
  return 'clearCache' in provider && !('redirectToAuthorization' in provider)
}

/**
 * Type guard to check if a provider is an OAuth provider
 *
 * @param provider Authentication provider to check
 * @returns True if provider is OAuth-based
 */
export function isOAuthProvider(provider: AuthProvider): provider is McpOAuthClientProvider {
  return 'redirectToAuthorization' in provider && 'clientMetadata' in provider
}

/**
 * Detects the appropriate authentication method for a server
 *
 * @param serverConfig Server configuration
 * @returns Authentication method with reasoning
 */
function detectAuthMethod(serverConfig: MCPServerConfig): AuthMethod {
  // Check explicit provider setting
  if (serverConfig.provider === 'Symbiote') {
    return { type: 'jwt', reason: 'explicit Symbiote provider' }
  }

  // Check server name patterns
  if (serverConfig.name.toLowerCase().includes('symbiote')) {
    return { type: 'jwt', reason: 'server name contains "symbiote"' }
  }

  // Check base URL patterns
  if (serverConfig.baseUrl) {
    if (serverConfig.baseUrl.includes('symbiotelabs.ai') ||
        serverConfig.baseUrl.includes('symbiote.') ||
        serverConfig.baseUrl.includes('localhost:4500') ||
        serverConfig.baseUrl.includes('127.0.0.1:4500')) {
      return { type: 'jwt', reason: 'baseUrl matches Symbiote patterns' }
    }
  }

  // Default to OAuth for third-party servers
  return { type: 'oauth', reason: 'default for third-party servers' }
}

/**
 * Creates a consistent hash for server identification
 *
 * @param input Server URL or name
 * @returns MD5 hash string
 */
function createServerHash(input: string): string {
  return crypto
    .createHash('md5')
    .update(input)
    .digest('hex')
}