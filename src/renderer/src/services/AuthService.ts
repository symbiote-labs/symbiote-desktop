import store from '@renderer/store'

export interface User {
  id: string
  email: string
  display_name?: string
  roles?: string[]
}

interface LoginRequest {
  email: string
  password: string
  remember?: boolean
}

interface RegisterRequest {
  email: string
  password: string
}

interface AuthResponse {
  success: boolean
  user?: User
  error?: string
  message?: string
}

interface UserStatusResponse {
  authenticated: boolean
  user?: User
}

class AuthService {
  private tokenKey = 'symbiote_bearer_token'
  private jwtTokenKey = 'symbiote_jwt_token'
  private userKey = 'symbiote_user'

  private getBaseUrl(): string {
    const state = store.getState()
    const configuredUrl = state.settings.symbioteBaseUrl

    // Use configured URL if available, otherwise fall back to default
    return configuredUrl || 'https://use.symbiotelabs.ai'
  }

  private generateBearerToken(email: string): string {
    const timestamp = Date.now()
    return btoa(`${email}:${timestamp}`)
  }

  async getJwtToken(): Promise<string | null> {
    try {
      console.log('[AuthService] Requesting JWT token from:', `${this.getBaseUrl()}/api/jwt/token`)

      // Check if we have existing authentication
      const bearerToken = localStorage.getItem(this.tokenKey)
      console.log('[AuthService] Existing bearer token available:', !!bearerToken)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      console.log('[AuthService] JWT request headers:', Object.keys(headers))

      const response = await fetch(`${this.getBaseUrl()}/api/jwt/token`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({})
      })

      console.log('[AuthService] JWT token response status:', response.status)
      console.log('[AuthService] JWT token response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        const data = await response.json()
        console.log('[AuthService] JWT token response data:', data)

        if (data.access_token) {
          localStorage.setItem(this.jwtTokenKey, data.access_token)
          console.log('[AuthService] JWT token stored successfully in localStorage')
          return data.access_token
        } else {
          console.warn('[AuthService] No access_token in response data')
        }
      } else {
        const errorText = await response.text()
        console.error('[AuthService] JWT token request failed:', response.status, response.statusText)
        console.error('[AuthService] JWT token error response:', errorText)

        // If we get 401, it means Flask-Security doesn't recognize the session
        if (response.status === 401) {
          console.error('[AuthService] 401 Unauthorized - Flask-Security session not recognized')
          console.error('[AuthService] This might be a session cookie issue')
        }
      }
    } catch (error) {
      console.error('[AuthService] Exception during JWT token request:', error)
    }
    return null
  }

  getStoredJwtToken(): string | null {
    const token = localStorage.getItem(this.jwtTokenKey)
    console.log('[AuthService] getStoredJwtToken called, token found:', !!token)
    return token
  }

  isJwtTokenValid(): boolean {
    const token = this.getStoredJwtToken()
    if (!token) return false

    try {
      // Simple JWT expiration check without verification
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      return payload.exp && payload.exp > now
    } catch (error) {
      console.error('Failed to validate JWT token:', error)
      return false
    }
  }

  async refreshJwtToken(): Promise<string | null> {
    try {
      const currentToken = this.getStoredJwtToken()
      if (!currentToken) {
        console.log('[AuthService] No current token, getting new JWT token')
        return await this.getJwtToken()
      }

      console.log('[AuthService] Refreshing JWT token')
      const response = await fetch(`${this.getBaseUrl()}/api/jwt/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        credentials: 'include'
      })

      console.log('[AuthService] JWT refresh response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        if (data.access_token) {
          localStorage.setItem(this.jwtTokenKey, data.access_token)
          console.log('[AuthService] JWT token refreshed successfully')
          return data.access_token
        }
      } else {
        const errorText = await response.text()
        console.warn('[AuthService] JWT refresh failed:', response.status, errorText)
        // If refresh fails, try to get a new token
        return await this.getJwtToken()
      }
    } catch (error) {
      console.error('Failed to refresh JWT token:', error)
      // Fall back to getting a new token
      return await this.getJwtToken()
    }
    return null
  }

  async login(request: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(request)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Always generate and store a bearer token for API calls
        const bearerToken = this.generateBearerToken(request.email)
        localStorage.setItem(this.tokenKey, bearerToken)

        if (data.user) {
          localStorage.setItem(this.userKey, JSON.stringify(data.user))
        }

        // Get JWT token after successful login (with session verification)
        try {
          console.log('[AuthService] Login successful, verifying session status...')

          // Verify the session is established by checking user status
          const statusResponse = await this.getUserStatus()
          if (statusResponse.authenticated) {
            console.log('[AuthService] Session verified, attempting to get JWT token...')
            const jwtToken = await this.getJwtToken()
            if (jwtToken) {
              console.log('[AuthService] Successfully obtained JWT token after login')
            } else {
              console.warn('[AuthService] Failed to obtain JWT token after login')
            }
          } else {
            console.warn('[AuthService] Session not established properly after login')
          }
        } catch (error) {
          console.warn('Failed to get JWT token after login:', error)
          // Don't fail the login if JWT token fails
        }

        // If remember me is not checked, we can set a shorter expiration
        // But we still store the token to enable API access during this session
        if (!request.remember) {
          // For non-persistent sessions, we could add a timestamp check later
          // For now, we'll rely on server-side session validation
        }

        return {
          success: true,
          user: data.user
        }
      } else {
        return {
          success: false,
          error: data.error || 'Login failed'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }
    }
  }

  async register(request: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(request)
      })

      const data = await response.json()

      if (response.ok) {
        return {
          success: true,
          message: data.message || 'Registration successful'
        }
      } else {
        return {
          success: false,
          error: data.error || 'Registration failed'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      }
    }
  }

  async getUserStatus(): Promise<UserStatusResponse> {
    try {
      const bearerToken = localStorage.getItem(this.tokenKey)
      if (!bearerToken) {
        return { authenticated: false }
      }

      const response = await fetch(`${this.getBaseUrl()}/api/user/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`
        },
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()

        if (data.authenticated && data.user) {
          localStorage.setItem(this.userKey, JSON.stringify(data.user))
        }

        return data
      } else {
        this.clearStoredData()
        return { authenticated: false }
      }
    } catch (error) {
      console.error('Failed to check user status:', error)
      return { authenticated: false }
    }
  }

  async logout(): Promise<void> {
    try {
      const bearerToken = localStorage.getItem(this.tokenKey)

      if (bearerToken) {
        await fetch(`${this.getBaseUrl()}/api/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${bearerToken}`
          },
          credentials: 'include'
        })
      }
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      this.clearStoredData()
    }
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem(this.tokenKey)
    const user = localStorage.getItem(this.userKey)
    const hasBasicAuth = !!(token && user)

    // For backward compatibility, we consider user authenticated if they have session auth
    // JWT token is an additional enhancement for MCP server access
    return hasBasicAuth
  }

  getStoredUser(): User | null {
    try {
      const userData = localStorage.getItem(this.userKey)
      return userData ? JSON.parse(userData) : null
    } catch (error) {
      console.error('Failed to parse stored user data:', error)
      return null
    }
  }

  private clearStoredData(): void {
    localStorage.removeItem(this.tokenKey)
    localStorage.removeItem(this.jwtTokenKey)
    localStorage.removeItem(this.userKey)
  }
}

export default new AuthService()
