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
  private baseUrl = 'https://use.symbiotelabs.ai'
  private tokenKey = 'symbiote_bearer_token'
  private userKey = 'symbiote_user'

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
      console.error('Failed to get CSRF token:', error)
    }
    return null
  }

  private generateBearerToken(email: string): string {
    const timestamp = Date.now()
    return btoa(`${email}:${timestamp}`)
  }

  async login(request: LoginRequest): Promise<AuthResponse> {
    try {
      const csrfToken = await this.getCsrfToken()
      if (!csrfToken) {
        return { success: false, error: 'Failed to get CSRF token' }
      }

      const response = await fetch(`${this.baseUrl}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(request)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const bearerToken = this.generateBearerToken(request.email)
        localStorage.setItem(this.tokenKey, bearerToken)

        if (data.user) {
          localStorage.setItem(this.userKey, JSON.stringify(data.user))
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
      const csrfToken = await this.getCsrfToken()
      if (!csrfToken) {
        return { success: false, error: 'Failed to get CSRF token' }
      }

      const response = await fetch(`${this.baseUrl}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
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

      const response = await fetch(`${this.baseUrl}/api/user/status`, {
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
        await fetch(`${this.baseUrl}/api/logout`, {
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
    return !!(token && user)
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
    localStorage.removeItem(this.userKey)
  }
}

export default new AuthService()
