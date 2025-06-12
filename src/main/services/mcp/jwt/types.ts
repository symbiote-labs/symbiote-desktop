/**
 * JWT Authentication Provider Types
 *
 * These types define the interface for JWT-based authentication with MCP servers.
 * Unlike OAuth providers, JWT providers don't require complex flows - they simply
 * provide bearer tokens for API authentication.
 */

/**
 * JWT Authentication Provider Interface
 *
 * This interface provides JWT tokens for MCP authentication without the complexity
 * of OAuth flows. JWT providers are responsible for token caching, validation,
 * and renewal.
 */
export interface JwtAuthProvider {
  /**
   * Get current JWT tokens for authentication
   * @returns Promise resolving to JWT tokens or undefined if not available
   */
  tokens(): Promise<JwtTokens | undefined>

  /**
   * Clear cached tokens (useful for logout or token expiration)
   */
  clearCache(): void

  /**
   * Validate if a token is still valid (not expired)
   * @param token JWT token string to validate
   * @returns boolean indicating if token is valid
   */
  isTokenValid(token: string): boolean
}

/**
 * JWT Token Response Format
 *
 * Simplified token format for JWT authentication, compatible with
 * OAuth token format but focused on Bearer token usage.
 */
export interface JwtTokens {
  /** The JWT access token */
  access_token: string
  /** Token type - always "Bearer" for JWT */
  token_type: 'Bearer'
  /** Optional expiration time in seconds */
  expires_in?: number
}

/**
 * Configuration options for JWT providers
 */
export interface JwtProviderOptions {
  /** Unique hash identifying the server (used for caching) */
  serverUrlHash: string
  /** How long to cache tokens in milliseconds (default: 5 minutes) */
  tokenCacheDuration?: number
  /** Optional custom token storage key */
  tokenStorageKey?: string
}