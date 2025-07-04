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

  private getCSRFToken(): string | null {
    // Try to get CSRF token from meta tag (common Flask-Security pattern)
    const metaTag = document.querySelector('meta[name="csrf-token"]')
    if (metaTag) {
      return metaTag.getAttribute('content')
    }

    // Try to get from cookie (alternative pattern)
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === 'csrf_token' || name === 'CSRF-TOKEN') {
        return decodeURIComponent(value)
      }
    }

    return null
  }

  async getJwtToken(): Promise<string | null> {
    try {
      console.log('[AuthService] Requesting JWT token from:', `${this.getBaseUrl()}/api/jwt/token`)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      // Add CSRF token if available (Flask-Security might require it)
      const csrfToken = this.getCSRFToken() || localStorage.getItem('csrf_token')
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken
        console.log('[AuthService] Including CSRF token in JWT request')
      }

      // Add session token if cookies aren't working (fallback)
      const sessionToken = localStorage.getItem('flask_session_token')
      if (sessionToken) {
        headers['X-Session-Token'] = sessionToken
        console.log('[AuthService] Including session token in JWT request (cookie fallback)')
      }

      // If no cookies are available, include the bearer token for fallback authentication
      if (!document.cookie) {
        const bearerToken = localStorage.getItem(this.tokenKey)
        if (bearerToken) {
          headers['Authorization'] = `Bearer ${bearerToken}`
          console.log('[AuthService] No cookies available, using bearer token fallback')
        }
      }

      console.log('[AuthService] JWT request headers:', Object.keys(headers))

      const response = await fetch(`${this.getBaseUrl()}/api/jwt/token`, {
        method: 'POST',
        headers,
        credentials: 'include', // This should include session cookies
        body: JSON.stringify({})
      })

      console.log('[AuthService] JWT token response status:', response.status)
      console.log('[AuthService] JWT token response headers:', Object.fromEntries(response.headers.entries()))

      // Log cookies for debugging
      console.log('[AuthService] Current cookies:', document.cookie)
      console.log('[AuthService] Cookie count:', document.cookie.split(';').filter(c => c.trim()).length)
      console.log('[AuthService] Document domain:', document.domain)
      console.log('[AuthService] Window location:', window.location.href)

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
          console.error('[AuthService] This might be a session cookie issue in Electron environment')
          console.error('[AuthService] Possible causes:')
          console.error('[AuthService] 1. Cross-origin cookie restrictions (Electron <-> production server)')
          console.error('[AuthService] 2. SameSite cookie policy blocking cookies')
          console.error('[AuthService] 3. Secure cookie requirements not met')
          console.error('[AuthService] 4. Session cookies not being sent by server')

          if (!document.cookie) {
            console.error('[AuthService] CONFIRMED: No cookies stored in browser - this is the root cause')
          }
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
        console.log('[AuthService] No current token found')

        // Only try to get a new JWT token if we have an authenticated session
        if (this.isAuthenticated()) {
          console.log('[AuthService] Authenticated session found, attempting to get JWT token')
          return await this.getJwtToken()
        } else {
          console.log('[AuthService] No authenticated session, cannot get JWT token')
          return null
        }
      }

            console.log('[AuthService] Refreshing existing JWT token')
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

        // If refresh fails and we have an authenticated session, try to get a new token
        if (this.isAuthenticated()) {
          console.log('[AuthService] Refresh failed but session exists, trying to get new token')
          return await this.getJwtToken()
        } else {
          console.log('[AuthService] Refresh failed and no session, cannot get new token')
          return null
        }
      }
    } catch (error) {
      console.error('Failed to refresh JWT token:', error)

      // Only fall back to getting a new token if we have an authenticated session
      if (this.isAuthenticated()) {
        console.log('[AuthService] Error occurred but session exists, trying to get new token')
        return await this.getJwtToken()
      } else {
        console.log('[AuthService] Error occurred and no session, cannot get new token')
        return null
      }
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

      console.log('[AuthService] Login response status:', response.status)
      console.log('[AuthService] Login response headers:', Object.fromEntries(response.headers.entries()))
      console.log('[AuthService] Set-Cookie header:', response.headers.get('set-cookie'))
      console.log('[AuthService] All Set-Cookie headers:', response.headers.getSetCookie?.() || 'getSetCookie not available')

      // Note: response.headers.raw is not available in browser Fetch API
      // Log available headers instead
      const headerEntries = Array.from(response.headers.entries())
      console.log('[AuthService] Available headers:', headerEntries)

      console.log('[AuthService] Cookies after login:', document.cookie)

      if (response.ok && data.success) {
        // Store authentication token for bearer auth
        const token = this.generateBearerToken(data.user.email)
        localStorage.setItem(this.tokenKey, token)

        if (data.user) {
          localStorage.setItem(this.userKey, JSON.stringify(data.user))
        }

        // Check if we have any session information in the response
        if (data.session_token || data.csrf_token) {
          console.log('[AuthService] Found session tokens in response:', {
            session_token: !!data.session_token,
            csrf_token: !!data.csrf_token
          })

          // Store any session tokens provided by the server
          if (data.session_token) {
            localStorage.setItem('flask_session_token', data.session_token)
          }
          if (data.csrf_token) {
            localStorage.setItem('csrf_token', data.csrf_token)
          }
        }

        // Check if JWT token is included in the login response
        if (data.access_token) {
          console.log('[AuthService] JWT token included in login response!')
          localStorage.setItem(this.jwtTokenKey, data.access_token)
          console.log('[AuthService] JWT token stored successfully')
        } else {
          console.log('[AuthService] No JWT token in login response, will need separate request')

          // Get JWT token after successful login using session cookies
          try {
            console.log('[AuthService] Login successful, attempting to get JWT token...')

            // Small delay to ensure session is fully established
            await new Promise(resolve => setTimeout(resolve, 100))

            const jwtToken = await this.getJwtToken()
            if (jwtToken) {
              console.log('[AuthService] Successfully obtained JWT token after login')
            } else {
              console.warn('[AuthService] Failed to obtain JWT token after login')
            }
          } catch (error) {
            console.warn('Failed to get JWT token after login:', error)
            // Don't fail the login if JWT token fails
          }
        }

        return data
      } else {
        throw new Error(data.error || 'Login failed')
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
      const authToken = this.getJwtAuthToken()

      const response = await fetch(`${this.getBaseUrl()}/api/user/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
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
        console.warn('[AuthService] getUserStatus failed with status:', response.status)
        return { authenticated: false }
      }
    } catch (error) {
      console.error('Failed to check user status:', error)
      // If JWT token is not available, user is not authenticated
      return { authenticated: false }
    }
  }

  async logout(): Promise<void> {
    try {
      const authToken = this.getJwtAuthToken()

      await fetch(`${this.getBaseUrl()}/api/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        credentials: 'include'
      })
    } catch (error) {
      console.error('Logout request failed:', error)
      // Even if JWT token is not available or logout fails, we still clear local data
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

  /**
   * Get JWT token for API requests. FAILS HARD if not available.
   * No fallbacks - JWT token is required for proper authentication.
   */
  private getJwtAuthToken(): string {
    const jwtToken = this.getStoredJwtToken()
    if (jwtToken) {
      console.log('[AuthService] Using JWT token for authentication')
      return jwtToken
    }

    // FAIL HARD - no fallbacks allowed
    const error = 'JWT token not available - authentication failed. Client must use JWT tokens from login response.'
    console.error(`[AuthService] ${error}`)
    throw new Error(error)
  }
}

export default new AuthService()
