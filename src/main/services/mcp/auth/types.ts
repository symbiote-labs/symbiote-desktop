import { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth'

import { JwtAuthProvider } from '../jwt/types'

/**
 * Union type for all supported authentication providers
 */
export type AuthProvider = OAuthClientProvider | JwtAuthProvider

/**
 * Server configuration interface for auth provider selection
 */
export interface MCPServerConfig {
  name: string
  provider?: string
  baseUrl?: string
  type?: 'sse' | 'streamableHttp' | 'stdio' | 'inMemory'
  [key: string]: any
}

/**
 * Authentication method detection result
 */
export interface AuthMethod {
  type: 'jwt' | 'oauth'
  reason: string
}