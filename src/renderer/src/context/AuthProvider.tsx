import AuthService, { User } from '@renderer/services/AuthService'
import React, { createContext, useContext, useEffect, useState } from 'react'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>
  logout: () => Promise<void>
  checkAuthStatus: () => Promise<void>
  onLoginSuccess?: () => void // Callback for successful login
  loginSuccessTimestamp: number | null
  getJwtToken: () => string | null
  refreshJwtToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loginSuccessTimestamp, setLoginSuccessTimestamp] = useState<number | null>(null)

  const checkAuthStatus = async () => {
    setIsLoading(true)
    try {
      const storedUser = AuthService.getStoredUser()
      const hasToken = AuthService.isAuthenticated()

      if (storedUser && hasToken) {
        // Use stored user data if available
        setUser(storedUser)
        setIsAuthenticated(true)

        // Ensure we have a valid JWT token for MCP server access
        if (!AuthService.isJwtTokenValid()) {
          try {
            console.log('[AuthProvider] Attempting to refresh JWT token for stored authenticated user')
            await AuthService.refreshJwtToken()
          } catch (error) {
            console.warn('Failed to refresh JWT token:', error)
          }
        }

        // Note: Skip server verification on startup to avoid bearer token issues
        // Server verification will happen during actual login flow
        console.log('[AuthProvider] Using stored authentication data, skipping server verification')
      } else {
        // No stored authentication data - user needs to log in
        console.log('[AuthProvider] No stored authentication data found, user needs to log in')
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error('Auth status check failed:', error)
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string, remember = false) => {
    try {
      const response = await AuthService.login({ email, password, remember })

      if (response.success && response.user) {
        setUser(response.user)
        setIsAuthenticated(true)
        setLoginSuccessTimestamp(Date.now())
        return { success: true }
      } else {
        return { success: false, error: response.error || 'Login failed' }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }
    }
  }

  const register = async (email: string, password: string) => {
    try {
      const response = await AuthService.register({ email, password })
      return {
        success: response.success,
        error: response.error,
        message: response.message
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      }
    }
  }

  const logout = async () => {
    try {
      await AuthService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      setIsAuthenticated(false)
      setLoginSuccessTimestamp(null)
    }
  }

  useEffect(() => {
    checkAuthStatus()
  }, [])

  // Auto-refresh JWT token every 15 minutes when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('[AuthProvider] Skip auto-refresh: not authenticated')
      return
    }

    console.log('[AuthProvider] Setting up JWT auto-refresh (15-minute interval)')

    // Initial check - refresh if token is expired or will expire soon
    const checkAndRefreshToken = async () => {
      try {
        const token = AuthService.getStoredJwtToken()
        if (!token) {
          console.log('[AuthProvider] No JWT token found, attempting to get one')
          await AuthService.getJwtToken()
          return
        }

        // Check if token is valid and not expiring soon (within 5 minutes)
        if (!AuthService.isJwtTokenValid()) {
          console.log('[AuthProvider] JWT token invalid or expiring soon, refreshing...')
          const newToken = await AuthService.refreshJwtToken()
          if (!newToken) {
            throw new Error('JWT token refresh failed - no token returned')
          }
          console.log('[AuthProvider] JWT token refreshed successfully')
        }
      } catch (error) {
        console.error('[AuthProvider] JWT auto-refresh error:', error)
        // FAIL HARD: Critical auth failure should not be silent
        throw new Error(`Critical JWT refresh failure: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Run initial check
    checkAndRefreshToken()

    // Set up interval for auto-refresh every 15 minutes
    const refreshInterval = setInterval(async () => {
      console.log('[AuthProvider] Running scheduled JWT token refresh')
      await checkAndRefreshToken()
    }, 15 * 60 * 1000) // 15 minutes

    // Cleanup interval on unmount or when authentication changes
    return () => {
      console.log('[AuthProvider] Clearing JWT auto-refresh interval')
      clearInterval(refreshInterval)
    }
  }, [isAuthenticated, user])

  const getJwtToken = () => {
    return AuthService.getStoredJwtToken()
  }

  const refreshJwtToken = async () => {
    return await AuthService.refreshJwtToken()
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    checkAuthStatus,
    loginSuccessTimestamp,
    getJwtToken,
    refreshJwtToken
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
