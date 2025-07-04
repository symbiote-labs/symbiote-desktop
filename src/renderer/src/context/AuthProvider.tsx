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
        const statusResponse = await AuthService.getUserStatus()
        if (statusResponse.authenticated && statusResponse.user) {
          setUser(statusResponse.user)
          setIsAuthenticated(true)

          // Ensure we have a valid JWT token for MCP server access
          if (!AuthService.isJwtTokenValid()) {
            try {
              await AuthService.refreshJwtToken()
            } catch (error) {
              console.warn('Failed to refresh JWT token:', error)
            }
          }
        } else {
          await AuthService.logout()
          setUser(null)
          setIsAuthenticated(false)
        }
      } else {
        const statusResponse = await AuthService.getUserStatus()
        if (statusResponse.authenticated && statusResponse.user) {
          setUser(statusResponse.user)
          setIsAuthenticated(true)

          // Get JWT token if we don't have one
          if (!AuthService.getStoredJwtToken()) {
            try {
              console.log('[AuthProvider] No stored JWT token found, attempting to get one...')
              const jwtToken = await AuthService.getJwtToken()
              if (jwtToken) {
                console.log('[AuthProvider] Successfully obtained JWT token')
              } else {
                console.warn('[AuthProvider] Failed to obtain JWT token')
              }
            } catch (error) {
              console.warn('Failed to get JWT token:', error)
            }
          } else {
            console.log('[AuthProvider] JWT token already exists in storage')
          }
        } else {
          setUser(null)
          setIsAuthenticated(false)
        }
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

  const getJwtToken = () => {
    return AuthService.getStoredJwtToken()
  }

  const refreshJwtToken = async () => {
    return await AuthService.refreshJwtToken()
  }

  // Expose JWT token to window object for main process access
  useEffect(() => {
    const exposeJwtTokenToWindow = () => {
      const token = AuthService.getStoredJwtToken()
      if (token && isAuthenticated) {
        // Expose to window for main process access
        ;(window as any).__AUTH_CONTEXT__ = {
          jwtToken: token,
          user: user,
          isAuthenticated: isAuthenticated
        }
        console.log('[AuthProvider] JWT token exposed to window.__AUTH_CONTEXT__')
      } else {
        // Clear when no token or not authenticated
        delete (window as any).__AUTH_CONTEXT__
      }
    }

    exposeJwtTokenToWindow()
  }, [isAuthenticated, user]) // Re-run when auth state changes

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
