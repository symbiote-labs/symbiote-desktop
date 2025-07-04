import { useAuth } from '@renderer/context/AuthProvider'
import { useTheme } from '@renderer/context/ThemeProvider'
import SymbioteApiService from '@renderer/services/SymbioteApiService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { updateAssistants } from '@renderer/store/assistants'
import { updateProviders } from '@renderer/store/llm'
import { setMCPServers } from '@renderer/store/mcp'
import { setMinApps } from '@renderer/store/minapps'
import {
  clearSymbioteConfigErrors,
  setLastSymbioteConfigFetch,
  setSymbioteBaseUrl,
  setSymbioteConfigErrors,
  setSymbioteConfigSections,
  setSymbioteAutoRefreshEnabled
} from '@renderer/store/settings'
import { MCPServer } from '@renderer/types'
import { loadCustomMiniApp, updateDefaultMinApps } from '@renderer/config/minapps'
import { SYMBIOTE_AGENT_ID, SYMBIOTE_ASSISTANT_ID } from '@renderer/utils/symbioteConfig'
import { Alert, Badge, Button, Input, message, Modal, Space, Switch, Typography, Spin } from 'antd'
import { Bot, CheckCircle, Clock, Copy, Eye, EyeOff, Link, Settings2, User, Wifi, WifiOff, XCircle, ShieldCheck, RefreshCw } from 'lucide-react'
import React, { useState } from 'react'
import styled from 'styled-components'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '../settings'

const { Text } = Typography
const { TextArea } = Input

const PROD_MCP_SERVER_URL = "https://symbiotico-prod-mcp-server.icypebble-05af120f.canadacentral.azurecontainerapps.io"

const SymbioteSettings: React.FC = () => {
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated, isLoading, getJwtToken, refreshJwtToken } = useAuth()

  // Get settings from store
  const {
    symbioteBaseUrl,
    symbioteAgentConfigured,
    symbioteAssistantConfigured,
    lastSymbioteConfigUpdate,
    lastSymbioteConfigFetch,
    symbioteConfigSections = [],
    symbioteConfigErrors = {},
    symbioteAutoRefreshEnabled
  } = useAppSelector((state) => state.settings)

  // Get agent and assistant from store
  const symbioteAgent = useAppSelector((state) => state.agents.agents.find((agent) => agent.id === SYMBIOTE_AGENT_ID))
  const symbioteAssistant = useAppSelector((state) =>
    state.assistants.assistants.find((assistant) => assistant.id === SYMBIOTE_ASSISTANT_ID)
  )

  // Get current store data for config processing
  const mcpServers = useAppSelector((state) => state.mcp.servers)
  const assistants = useAppSelector((state) => state.assistants.assistants)
  const providers = useAppSelector((state) => state.llm.providers)
  const filesPath = useAppSelector((state) => state.runtime.filesPath)

  const [localBaseUrl, setLocalBaseUrl] = useState(symbioteBaseUrl)
  const [isSaving, setIsSaving] = useState(false)
  const [showAgentJson, setShowAgentJson] = useState(false)
  const [showAssistantJson, setShowAssistantJson] = useState(false)
  const [isFetchingConfig, setIsFetchingConfig] = useState(false)
  const [isRefreshingJwt, setIsRefreshingJwt] = useState(false)
  const [showJwtToken, setShowJwtToken] = useState(false)
  const [isTestingAuthDebug, setIsTestingAuthDebug] = useState(false)
  const [authDebugResult, setAuthDebugResult] = useState<any>(null)
  const [authDebugError, setAuthDebugError] = useState<string | null>(null)
  const [showAuthDebugModal, setShowAuthDebugModal] = useState(false)
  const [mcpServerUrl, setMcpServerUrl] = useState<string>(PROD_MCP_SERVER_URL)
  const [localMcpServerUrl, setLocalMcpServerUrl] = useState<string>(mcpServerUrl)
  const [isSavingMcpUrl, setIsSavingMcpUrl] = useState(false)

  const handleSaveBaseUrl = async () => {
    setIsSaving(true)
    try {
      // Update the store
      dispatch(setSymbioteBaseUrl(localBaseUrl))

      // Note: The services will need to be updated to read from the store
      // This will require updating AuthService and SymbioteApiService

      setTimeout(() => {
        setIsSaving(false)
      }, 500)
    } catch (error) {
      console.error('Failed to save base URL:', error)
      setIsSaving(false)
    }
  }

  const handleSaveMcpServerUrl = async () => {
    setIsSavingMcpUrl(true)
    try {
      setMcpServerUrl(localMcpServerUrl)
      setTimeout(() => {
        setIsSavingMcpUrl(false)
      }, 500)
    } catch (error) {
      console.error('Failed to save MCP server URL:', error)
      setIsSavingMcpUrl(false)
    }
  }

  const handleCopyJson = (jsonData: string) => {
    navigator.clipboard
      .writeText(jsonData)
      .then(() => {
        message.success('JSON copied to clipboard!')
      })
      .catch(() => {
        message.error('Failed to copy JSON')
      })
  }

  const handleCopyJwtToken = () => {
    const token = getJwtToken()
    if (token) {
      navigator.clipboard
        .writeText(token)
        .then(() => {
          message.success('JWT token copied to clipboard!')
        })
        .catch(() => {
          message.error('Failed to copy JWT token')
        })
    }
  }

  const decodeJwtToken = (token: string) => {
    try {
      // Decode JWT payload (second part) without verification for display purposes only
      const payload = token.split('.')[1]
      if (!payload) return null

      // Add padding if needed for base64 decoding
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4)
      const decoded = atob(paddedPayload)
      return JSON.parse(decoded)
    } catch (error) {
      console.error('Error decoding JWT token:', error)
      return null
    }
  }

  const formatJwtTokenDisplay = (token: string) => {
    if (!showJwtToken) {
      return `${token.substring(0, 20)}...${token.substring(token.length - 20)}`
    }
    return token
  }

  const getJwtTokenInfo = () => {
    const token = getJwtToken()
    if (!token) return null

    const decoded = decodeJwtToken(token)
    if (!decoded) return { token, valid: false }

    // Calculate time until expiration
    const now = Math.floor(Date.now() / 1000)
    const expiresIn = decoded.exp ? decoded.exp - now : null
    const isExpired = expiresIn !== null && expiresIn <= 0
    const expiresInMinutes = expiresIn ? Math.floor(expiresIn / 60) : null

    return {
      token,
      valid: true,
      decoded,
      expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null,
      issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
      issuer: decoded.iss || 'Unknown',
      audience: decoded.aud || 'Unknown',
      subject: decoded.sub || 'Unknown',
      isExpired,
      expiresInMinutes,
      // Extract additional fields that might be present
      userId: decoded.user_id || decoded.uid || null,
      email: decoded.email || null,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      sessionId: decoded.session_id || decoded.sid || null,
      tokenType: decoded.token_type || 'access',
      scope: decoded.scope || null,
      // Custom claims
      customClaims: Object.keys(decoded).filter(key =>
        !['exp', 'iat', 'iss', 'aud', 'sub', 'user_id', 'uid', 'email',
         'roles', 'permissions', 'session_id', 'sid', 'token_type', 'scope'].includes(key)
      ).reduce((acc, key) => ({ ...acc, [key]: decoded[key] }), {})
    }
  }

  // Utility function to process MCP servers and replace DATA_DIRECTORY_PATH_NAME
  const processMCPServers = (servers: MCPServer[]): MCPServer[] => {
    if (!filesPath) {
      console.warn('Files path not available, DATA_DIRECTORY_PATH_NAME will not be replaced')
      return servers
    }

    let totalReplacements = 0
    const processedServers = servers.map((server) => {
      let serverReplacements = 0

      const processedArgs =
        server.args?.map((arg) => {
          if (arg === 'DATA_DIRECTORY_PATH_NAME') {
            serverReplacements++
            totalReplacements++
            return filesPath
          }
          return arg
        }) || []

      if (serverReplacements > 0) {
        console.log(
          `✓ Replaced ${serverReplacements} DATA_DIRECTORY_PATH_NAME placeholder(s) in MCP server "${server.name}" with: ${filesPath}`
        )
      }

      return {
        ...server,
        args: processedArgs
      }
    })

    if (totalReplacements > 0) {
      console.log(
        `MCP server processing summary: ${totalReplacements} total DATA_DIRECTORY_PATH_NAME replacements across ${servers.length} servers`
      )
    } else {
      console.log(`MCP server processing: No DATA_DIRECTORY_PATH_NAME placeholders found in ${servers.length} servers`)
    }

    return processedServers
  }

  const handleFetchConfig = async () => {
    if (!isAuthenticated) {
      message.error('Please sign in first to fetch configuration')
      return
    }

    setIsFetchingConfig(true)
    dispatch(clearSymbioteConfigErrors())

    try {
      // Fetch comprehensive config from API
      const config = await SymbioteApiService.fetchSymbioteConfigWithRetry()

      if (!config) {
        message.error('Failed to fetch configuration from server')
        dispatch(setSymbioteConfigErrors({ general: 'Failed to fetch configuration' }))
        return
      }

      const sections: string[] = []
      const errors: Record<string, string> = {}
      let totalItemsAdded = 0

      // Process MCP servers (extracted from assistant config)
      if (config.mcp_servers && Array.isArray(config.mcp_servers) && config.mcp_servers.length > 0) {
        try {
          // Process servers to replace DATA_DIRECTORY_PATH_NAME placeholders
          const processedServers = processMCPServers(config.mcp_servers)

          // Merge with existing servers, avoiding duplicates by name
          const existingServerNames = mcpServers.map((server) => server.name)
          const newServers = processedServers.filter((server) => !existingServerNames.includes(server.name))

          if (newServers.length > 0) {
            const allServers = [...mcpServers, ...newServers]
            dispatch(setMCPServers(allServers))
            totalItemsAdded += newServers.length
          }

          sections.push(`mcp_servers (${config.mcp_servers.length} total, ${newServers.length} new)`)
        } catch (error) {
          console.error('Error processing MCP servers:', error)
          errors.mcp_servers = 'Failed to process MCP servers'
        }
      }

      // Process miniApps by saving to file and reloading using existing infrastructure
      if (config.assistants && Array.isArray(config.assistants) && config.assistants.length > 0) {
        const firstAssistant = config.assistants[0]
        if (
          firstAssistant &&
          firstAssistant.miniApps &&
          Array.isArray(firstAssistant.miniApps) &&
          firstAssistant.miniApps.length > 0
        ) {
          try {
            console.log(`Saving ${firstAssistant.miniApps.length} miniApps from assistant config to custom-minapps.json`)

            // Save miniApps to the custom file
            await window.api.file.writeWithId('custom-minapps.json', JSON.stringify(firstAssistant.miniApps, null, 2))

                        // Reload miniapps using existing infrastructure (replace all existing with server-provided apps)
            const customApps = await loadCustomMiniApp()

            // Update the current miniapp list and store with ONLY the server-provided apps
            updateDefaultMinApps(customApps)
            dispatch(setMinApps(customApps))

            totalItemsAdded += firstAssistant.miniApps.length
            sections.push(`miniApps (${firstAssistant.miniApps.length} apps saved to file)`)

            console.log(
              'Successfully saved and loaded miniApps:',
              firstAssistant.miniApps.map((app) => ({ name: app.name, url: app.url }))
            )
          } catch (error) {
            console.error('Error processing miniApps:', error)
            errors.miniApps = 'Failed to save or load miniApps'
          }
        }
      }

      // Process assistants (single assistant from cherry-studio-assistant endpoint)
      if (config.assistants && Array.isArray(config.assistants) && config.assistants.length > 0) {
        try {
          // Merge with existing assistants, avoiding duplicates by id
          const existingAssistantIds = assistants.map((assistant) => assistant.id)
          const newAssistants = config.assistants.filter((assistant) => !existingAssistantIds.includes(assistant.id))

          if (newAssistants.length > 0) {
            const allAssistants = [...assistants, ...newAssistants]
            dispatch(updateAssistants(allAssistants))
            totalItemsAdded += newAssistants.length
          }

          sections.push(`assistants (${config.assistants.length} total, ${newAssistants.length} new)`)
        } catch (error) {
          console.error('Error processing assistants:', error)
          errors.assistants = 'Failed to process assistants'
        }
      }

      // Process model providers (if included - currently not in the response)
      if (config.model_providers && Array.isArray(config.model_providers) && config.model_providers.length > 0) {
        try {
          // Merge with existing providers, avoiding duplicates by id
          const existingProviderIds = providers.map((provider) => provider.id)
          const newProviders = config.model_providers.filter((provider) => !existingProviderIds.includes(provider.id))

          if (newProviders.length > 0) {
            const allProviders = [...providers, ...newProviders]
            dispatch(updateProviders(allProviders))
            totalItemsAdded += newProviders.length
          }

          sections.push(`model_providers (${config.model_providers.length} total, ${newProviders.length} new)`)
        } catch (error) {
          console.error('Error processing model providers:', error)
          errors.model_providers = 'Failed to process model providers'
        }
      }

      // Update state
      dispatch(setLastSymbioteConfigFetch(Date.now()))
      dispatch(setSymbioteConfigSections(sections))

      if (Object.keys(errors || {}).length > 0) {
        dispatch(setSymbioteConfigErrors(errors))
        message.warning(`Configuration fetched with some errors. Check details below.`)
      } else if (totalItemsAdded > 0) {
        message.success(`Configuration updated successfully! Added ${totalItemsAdded} new items.`)
      } else {
        message.info('Configuration is up to date. No new items to add.')
      }
    } catch (error) {
      console.error('Error during config fetch:', error)
      message.error('Failed to fetch configuration')
      dispatch(setSymbioteConfigErrors({ general: 'Configuration fetch failed' }))
    } finally {
      setIsFetchingConfig(false)
    }
  }

  const getStatusIcon = (configured: boolean) => {
    return configured ? (
      <CheckCircle size={16} style={{ color: '#52c41a' }} />
    ) : (
      <XCircle size={16} style={{ color: '#ff4d4f' }} />
    )
  }

  const getAuthStatusIcon = () => {
    if (isLoading) return <Clock size={16} style={{ color: '#1890ff' }} />
    return isAuthenticated ? (
      <Wifi size={16} style={{ color: '#52c41a' }} />
    ) : (
      <WifiOff size={16} style={{ color: '#ff4d4f' }} />
    )
  }

  const getJwtStatusIcon = () => {
    const hasJwtToken = getJwtToken()
    return hasJwtToken ? (
      <CheckCircle size={14} style={{ color: '#52c41a' }} />
    ) : (
      <XCircle size={14} style={{ color: '#ff4d4f' }} />
    )
  }

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleString()
  }

  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2)
  }

  const getMcpServerUrl = () => {
    if (localMcpServerUrl) return localMcpServerUrl
    // Derive from frontend base URL if possible
    let url = localBaseUrl || symbioteBaseUrl
    if (!url) return PROD_MCP_SERVER_URL
    try {
      const parsed = new URL(url)
      if (parsed.hostname.includes('frontend')) {
        parsed.hostname = parsed.hostname.replace('frontend', 'mcp-server')
        return parsed.origin
      }
    } catch {
      if (url.includes('frontend')) {
        return url.replace('frontend', 'mcp-server')
      }
    }
    return PROD_MCP_SERVER_URL
  }

  const handleTestAuthDebug = async () => {
    setIsTestingAuthDebug(true)
    setAuthDebugError(null)
    setAuthDebugResult(null)
    try {
      const token = getJwtToken()
      if (!token) {
        setAuthDebugError('No JWT token available. Please sign in first.')
        setIsTestingAuthDebug(false)
        return
      }
      const mcpUrl = getMcpServerUrl()
      const endpoint = `${mcpUrl.replace(/\/$/, '')}/auth/debug`
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (!response.ok) {
        const errorText = await response.text()
        setAuthDebugError(`Error: ${response.status} ${response.statusText}\n${errorText}`)
      } else {
        const data = await response.json()
        setAuthDebugResult({ ...data, _endpoint: endpoint })
        setShowAuthDebugModal(true)
      }
    } catch (err: any) {
      setAuthDebugError(`Request failed: ${err.message}`)
    } finally {
      setIsTestingAuthDebug(false)
    }
  }

  return (
    <Container>
      <SettingContainer theme={theme}>
        {/* Authentication Status */}
        <SettingGroup theme={theme}>
          <SettingTitle>
            <User size={18} style={{ marginRight: 8 }} />
            Authentication Status
          </SettingTitle>
          <SettingDivider />
          <StatusCard>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space align="center">
                {getAuthStatusIcon()}
                <Text strong={isAuthenticated}>
                  {isLoading ? 'Checking...' : isAuthenticated ? 'Connected' : 'Not Connected'}
                </Text>
              </Space>
              {isAuthenticated && user && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Logged in as: {user.display_name || user.email}
                </Text>
              )}
              {isAuthenticated && (
                <Space direction="vertical" size="small" style={{ marginTop: 8, width: '100%' }}>
                  <Space align="center">
                    {getJwtStatusIcon()}
                    <Text style={{ fontSize: 12 }}>
                      JWT Token: {getJwtToken() ? 'Available' : 'Not Available (Cross-origin limitation)'}
                    </Text>
                    {getJwtToken() && (
                      <Space>
                        <Button
                          size="small"
                          type="text"
                          icon={showJwtToken ? <EyeOff size={12} /> : <Eye size={12} />}
                          onClick={() => setShowJwtToken(!showJwtToken)}
                        >
                          {showJwtToken ? 'Hide' : 'Show'}
                        </Button>
                        <Button
                          size="small"
                          type="text"
                          icon={<Copy size={12} />}
                          onClick={handleCopyJwtToken}
                        >
                          Copy
                        </Button>
                      </Space>
                    )}
                  </Space>

                  {getJwtToken() && (() => {
                    const tokenInfo = getJwtTokenInfo()
                    if (!tokenInfo) return null

                    return (
                      <div style={{ marginLeft: 20 }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div style={{
                            fontFamily: 'monospace',
                            fontSize: 10,
                            wordBreak: 'break-all',
                            background: 'var(--color-background-soft)',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            maxHeight: showJwtToken ? 'none' : '40px',
                            overflow: showJwtToken ? 'visible' : 'hidden'
                          }}>
                            {formatJwtTokenDisplay(tokenInfo.token)}
                          </div>

                          {tokenInfo.valid && (
                            <Space direction="vertical" size="small" style={{ fontSize: 11 }}>
                              {/* Basic JWT Claims */}
                              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginBottom: 4 }}>
                                <Text strong style={{ fontSize: 11 }}>Basic Claims:</Text>
                              </div>
                              <Space wrap>
                                <Text type="secondary">Issuer: {tokenInfo.issuer}</Text>
                                <Text type="secondary">Audience: {tokenInfo.audience}</Text>
                                <Text type="secondary">Subject: {tokenInfo.subject}</Text>
                                {tokenInfo.tokenType && <Text type="secondary">Type: {tokenInfo.tokenType}</Text>}
                              </Space>

                              {/* Timing Information */}
                              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginBottom: 4, marginTop: 8 }}>
                                <Text strong style={{ fontSize: 11 }}>Timing:</Text>
                              </div>
                              {tokenInfo.issuedAt && (
                                <Text type="secondary" style={{ fontSize: 10 }}>
                                  Issued: {tokenInfo.issuedAt.toLocaleString()}
                                </Text>
                              )}
                              {tokenInfo.expiresAt && (
                                <>
                                  <Text
                                    type={tokenInfo.isExpired ? "danger" : "secondary"}
                                    style={{ fontSize: 10 }}
                                  >
                                    Expires: {tokenInfo.expiresAt.toLocaleString()}
                                    {tokenInfo.isExpired && ' (EXPIRED)'}
                                  </Text>
                                  {!tokenInfo.isExpired && tokenInfo.expiresInMinutes !== null && (
                                    <Text
                                      type={tokenInfo.expiresInMinutes < 5 ? "warning" : "secondary"}
                                      style={{ fontSize: 10 }}
                                    >
                                      Time remaining: {tokenInfo.expiresInMinutes} minutes
                                    </Text>
                                  )}
                                </>
                              )}

                              {/* User Information */}
                              {(tokenInfo.userId || tokenInfo.email || tokenInfo.sessionId) && (
                                <>
                                  <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginBottom: 4, marginTop: 8 }}>
                                    <Text strong style={{ fontSize: 11 }}>User Info:</Text>
                                  </div>
                                  <Space direction="vertical" size={2}>
                                    {tokenInfo.userId && <Text type="secondary" style={{ fontSize: 10 }}>User ID: {tokenInfo.userId}</Text>}
                                    {tokenInfo.email && <Text type="secondary" style={{ fontSize: 10 }}>Email: {tokenInfo.email}</Text>}
                                    {tokenInfo.sessionId && <Text type="secondary" style={{ fontSize: 10 }}>Session: {tokenInfo.sessionId}</Text>}
                                  </Space>
                                </>
                              )}

                              {/* Roles and Permissions */}
                              {(tokenInfo.roles.length > 0 || tokenInfo.permissions.length > 0 || tokenInfo.scope) && (
                                <>
                                  <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginBottom: 4, marginTop: 8 }}>
                                    <Text strong style={{ fontSize: 11 }}>Authorization:</Text>
                                  </div>
                                  <Space direction="vertical" size={2}>
                                    {tokenInfo.roles.length > 0 && (
                                      <Text type="secondary" style={{ fontSize: 10 }}>
                                        Roles: {tokenInfo.roles.join(', ')}
                                      </Text>
                                    )}
                                    {tokenInfo.permissions.length > 0 && (
                                      <Text type="secondary" style={{ fontSize: 10 }}>
                                        Permissions: {tokenInfo.permissions.join(', ')}
                                      </Text>
                                    )}
                                    {tokenInfo.scope && (
                                      <Text type="secondary" style={{ fontSize: 10 }}>
                                        Scope: {tokenInfo.scope}
                                      </Text>
                                    )}
                                  </Space>
                                </>
                              )}

                              {/* Custom Claims */}
                              {Object.keys(tokenInfo.customClaims || {}).length > 0 && (
                                <>
                                  <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginBottom: 4, marginTop: 8 }}>
                                    <Text strong style={{ fontSize: 11 }}>Custom Claims:</Text>
                                  </div>
                                  <Space direction="vertical" size={2}>
                                    {Object.entries(tokenInfo.customClaims || {}).map(([key, value]) => (
                                      <Text key={key} type="secondary" style={{ fontSize: 10 }}>
                                        {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                      </Text>
                                    ))}
                                  </Space>
                                </>
                              )}

                              {/* Full Decoded Payload (collapsible) */}
                              <details style={{ marginTop: 8 }}>
                                <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--color-primary)' }}>
                                  View Full Decoded Payload
                                </summary>
                                <pre style={{
                                  fontSize: 10,
                                  background: 'var(--color-background-soft)',
                                  padding: '8px',
                                  borderRadius: '4px',
                                  marginTop: 4,
                                  overflow: 'auto',
                                  maxHeight: '200px'
                                }}>
                                  {JSON.stringify(tokenInfo.decoded, null, 2)}
                                </pre>
                              </details>
                            </Space>
                          )}

                          {!tokenInfo.valid && (
                            <Text type="danger" style={{ fontSize: 11 }}>
                              Invalid token format - unable to decode
                            </Text>
                          )}

                          {/* Manual Refresh Button for Valid Tokens */}
                          <Button
                            size="small"
                            type="primary"
                            icon={<RefreshCw size={12} />}
                            loading={isRefreshingJwt}
                            onClick={async () => {
                              setIsRefreshingJwt(true)
                              try {
                                const newToken = await refreshJwtToken()
                                if (!newToken) {
                                  throw new Error('JWT token refresh failed - no token returned')
                                }
                                message.success('JWT token refreshed successfully')
                                // Force component update to show new token
                                const currentShowState = showJwtToken
                                setShowJwtToken(!currentShowState)
                                setTimeout(() => setShowJwtToken(currentShowState), 50)
                              } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                                message.error(`JWT refresh failed: ${errorMessage}`)
                                console.error('[SymbioteSettings] JWT refresh error:', error)
                                // FAIL HARD on critical errors
                                if (errorMessage.includes('critical') || errorMessage.includes('authentication')) {
                                  throw error
                                }
                              } finally {
                                setIsRefreshingJwt(false)
                              }
                            }}
                            style={{ marginTop: 8 }}
                          >
                            Refresh JWT Token
                          </Button>
                        </Space>
                      </div>
                    )
                  })()}

                  {!getJwtToken() && (
                    <>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                        Note: JWT tokens may not work in development due to cross-origin restrictions
                      </Text>
                      <Button
                        size="small"
                        type="link"
                        loading={isRefreshingJwt}
                        onClick={async () => {
                          setIsRefreshingJwt(true)
                          try {
                            const newToken = await refreshJwtToken()
                            if (!newToken) {
                              // FAIL HARD: No token returned is a critical failure
                              throw new Error('JWT token refresh failed - no token returned')
                            }
                            message.success('JWT token refreshed successfully')
                            // Force re-render to show updated token info
                            setShowJwtToken(false)
                            setTimeout(() => setShowJwtToken(true), 100)
                          } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                            message.error(`JWT refresh failed: ${errorMessage}`)
                            console.error('[SymbioteSettings] JWT refresh error:', error)
                            // FAIL HARD: Re-throw critical errors
                            if (errorMessage.includes('critical') || errorMessage.includes('authentication')) {
                              throw error
                            }
                          } finally {
                            setIsRefreshingJwt(false)
                          }
                        }}
                        style={{ padding: 0, height: 'auto', marginTop: 4 }}
                      >
                        Try to refresh JWT token
                      </Button>
                    </>
                  )}
                </Space>
              )}
              {!isAuthenticated && (
                <Alert
                  message="Not authenticated"
                  description="Click your avatar in the sidebar to sign in and enable auto-configuration."
                  type="warning"
                  showIcon
                />
              )}
            </Space>
          </StatusCard>
        </SettingGroup>

        {/* Base URL Configuration */}
        <SettingGroup theme={theme}>
          <SettingTitle>
            <Link size={18} style={{ marginRight: 8 }} />
            Server Configuration
          </SettingTitle>
          <SettingDivider />
          <SettingRow>
            <SettingRowTitle>Base URL</SettingRowTitle>
            <Space.Compact style={{ width: 300 }}>
              <Input
                value={localBaseUrl}
                onChange={(e) => setLocalBaseUrl(e.target.value)}
                placeholder="https://use.symbiotelabs.ai"
                style={{ width: 240 }}
              />
              <Button
                type="primary"
                onClick={handleSaveBaseUrl}
                loading={isSaving}
                disabled={localBaseUrl === symbioteBaseUrl}>
                Save
              </Button>
            </Space.Compact>
          </SettingRow>
          <SettingRow>
            <SettingRowTitle>MCP Server URL</SettingRowTitle>
            <Space.Compact style={{ width: 300 }}>
              <Input
                value={localMcpServerUrl}
                onChange={(e) => setLocalMcpServerUrl(e.target.value)}
                placeholder={PROD_MCP_SERVER_URL}
                style={{ width: 240 }}
              />
              <Button
                type="primary"
                onClick={handleSaveMcpServerUrl}
                loading={isSavingMcpUrl}
                disabled={localMcpServerUrl === mcpServerUrl}>
                Save
              </Button>
            </Space.Compact>
          </SettingRow>
          <SettingRow>
            <div style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                This URL is used for MCP server authentication and debug requests. If left blank, it will be derived from the base URL by replacing 'frontend' with 'mcp-server'.
              </Text>
            </div>
          </SettingRow>
          <SettingRow>
            <div style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                This URL is used for both authentication and API calls. Changes require a restart to take full effect.
              </Text>
            </div>
          </SettingRow>
        </SettingGroup>

        {/* Agent Configuration Status */}
        <SettingGroup theme={theme}>
          <SettingTitle>
            <Bot size={18} style={{ marginRight: 8 }} />
            Auto-Configuration Status
          </SettingTitle>
          <SettingDivider />
          <StatusGrid>
            <StatusCard>
              <Space align="center" style={{ marginBottom: 8 }}>
                {getStatusIcon(symbioteAgentConfigured)}
                <Text strong>Symbiote Agent</Text>
                {symbioteAgent && (
                  <Button
                    type="text"
                    size="small"
                    icon={<Eye size={14} />}
                    onClick={() => setShowAgentJson(true)}
                    style={{ marginLeft: 'auto' }}>
                    View JSON
                  </Button>
                )}
              </Space>
              {symbioteAgent ? (
                <Space direction="vertical" size="small">
                  <Text style={{ fontSize: 12 }}>
                    <strong>Name:</strong> {symbioteAgent.name}
                  </Text>
                  <Text style={{ fontSize: 12 }}>
                    <strong>Type:</strong> {symbioteAgent.type || 'Custom'}
                  </Text>
                  <Text style={{ fontSize: 12 }}>
                    <strong>Emoji:</strong> {symbioteAgent.emoji}
                  </Text>
                </Space>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Not configured
                </Text>
              )}
            </StatusCard>

            <StatusCard>
              <Space align="center" style={{ marginBottom: 8 }}>
                {getStatusIcon(symbioteAssistantConfigured)}
                <Text strong>Symbiote Assistant</Text>
                {symbioteAssistant && (
                  <Button
                    type="text"
                    size="small"
                    icon={<Eye size={14} />}
                    onClick={() => setShowAssistantJson(true)}
                    style={{ marginLeft: 'auto' }}>
                    View JSON
                  </Button>
                )}
              </Space>
              {symbioteAssistant ? (
                <Space direction="vertical" size="small">
                  <Text style={{ fontSize: 12 }}>
                    <strong>Name:</strong> {symbioteAssistant.name}
                  </Text>
                  <Text style={{ fontSize: 12 }}>
                    <strong>Model:</strong> {symbioteAssistant.model?.name || 'Default'}
                  </Text>
                  <Text style={{ fontSize: 12 }}>
                    <strong>MCP Servers:</strong> {symbioteAssistant.mcpServers?.length || 0}
                  </Text>
                </Space>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Not configured
                </Text>
              )}
            </StatusCard>
          </StatusGrid>

          <SettingRow>
            <SettingRowTitle>Last Update</SettingRowTitle>
            <Text style={{ fontSize: 12 }}>{formatTimestamp(lastSymbioteConfigUpdate)}</Text>
          </SettingRow>

          {(!symbioteAgentConfigured || !symbioteAssistantConfigured) && isAuthenticated && (
            <Alert
              message="Auto-configuration incomplete"
              description="Some components are not configured. This will be attempted automatically when you sign in or can be triggered by restarting the application."
              type="info"
              showIcon
            />
          )}
        </SettingGroup>

        {/* Comprehensive Configuration */}
        <SettingGroup theme={theme}>
          <SettingTitle>
            <Settings2 size={18} style={{ marginRight: 8 }} />
            Comprehensive Configuration
          </SettingTitle>
          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Auto-Refresh Configuration</SettingRowTitle>
            <Space align="center">
              <Switch
                checked={symbioteAutoRefreshEnabled}
                onChange={(checked) => dispatch(setSymbioteAutoRefreshEnabled(checked))}
                disabled={!isAuthenticated}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {symbioteAutoRefreshEnabled ? 'Enabled (every 15 minutes)' : 'Disabled'}
              </Text>
            </Space>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>Fetch Updated Config</SettingRowTitle>
            <Button type="primary" onClick={handleFetchConfig} loading={isFetchingConfig} disabled={!isAuthenticated}>
              Fetch Symbiote Assistant Config
            </Button>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>Last Config Fetch</SettingRowTitle>
            <Text style={{ fontSize: 12 }}>{formatTimestamp(lastSymbioteConfigFetch)}</Text>
          </SettingRow>

          {symbioteConfigSections && symbioteConfigSections.length > 0 && (
            <SettingRow>
              <SettingRowTitle>Config Sections Loaded</SettingRowTitle>
              <Space direction="vertical" size="small">
                {symbioteConfigSections.map((section, index) => (
                  <Badge key={index} status="success" text={section} />
                ))}
              </Space>
            </SettingRow>
          )}

          {symbioteConfigErrors && Object.keys(symbioteConfigErrors).length > 0 && (
            <SettingRow>
              <div style={{ width: '100%' }}>
                <Alert
                  message="Configuration Errors"
                  description={
                    <Space direction="vertical" size="small">
                      {Object.entries(symbioteConfigErrors || {}).map(([section, error]) => (
                        <Text key={section} style={{ fontSize: 12 }}>
                          <strong>{section}:</strong> {error}
                        </Text>
                      ))}
                    </Space>
                  }
                  type="error"
                  showIcon
                />
              </div>
            </SettingRow>
          )}

          <SettingRow>
            <div style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <strong>Comprehensive Config:</strong> Fetches a complete assistant configuration from your Symbiote
                Labs server, including embedded MCP servers and settings. This supplements the basic agent
                auto-configuration with a full-featured assistant.
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                <strong>Auto-Refresh:</strong> When enabled, the configuration will be automatically updated every 15 minutes
                while you're authenticated. You can disable this and use the manual "Fetch Config" button instead.
              </Text>
            </div>
          </SettingRow>
        </SettingGroup>

        {/* MCP Auth Debug Section */}
        <SettingGroup theme={theme}>
          <SettingTitle>
            <ShieldCheck size={18} style={{ marginRight: 8 }} />
            MCP Auth Debug
          </SettingTitle>
          <SettingDivider />
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Button
              type="primary"
              icon={<RefreshCw size={14} />}
              loading={isTestingAuthDebug}
              onClick={handleTestAuthDebug}
              disabled={!isAuthenticated}
            >
              Test MCP /auth/debug Endpoint
            </Button>
            {authDebugError && (
              <Alert
                message="Auth Debug Error"
                description={authDebugError}
                type="error"
                showIcon
              />
            )}
          </Space>
          <Modal
            title="MCP /auth/debug Result"
            open={showAuthDebugModal}
            onCancel={() => setShowAuthDebugModal(false)}
            footer={[
              <Button key="close" onClick={() => setShowAuthDebugModal(false)}>
                Close
              </Button>
            ]}
            width={700}
          >
            {authDebugResult ? (
              <>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  <b>Endpoint:</b> {authDebugResult._endpoint}
                </div>
                <pre style={{ fontSize: 12, background: '#f6f8fa', padding: 12, borderRadius: 4 }}>
                  {JSON.stringify({ ...authDebugResult, _endpoint: undefined }, null, 2)}
                </pre>
              </>
            ) : (
              <Spin />
            )}
          </Modal>
        </SettingGroup>

        {/* Help & Information */}
        <SettingGroup theme={theme}>
          <SettingTitle>
            <Settings2 size={18} style={{ marginRight: 8 }} />
            Information
          </SettingTitle>
          <SettingDivider />
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text style={{ fontSize: 12 }}>
              <strong>Auto-configuration:</strong> When authenticated, the system automatically fetches and configures a
              Symbiote agent and assistant based on your server settings.
            </Text>
            <Text style={{ fontSize: 12 }}>
              <strong>Base URL:</strong> This should point to your Symbiote Labs server instance. Both authentication
              and API calls use this URL.
            </Text>
            <Text style={{ fontSize: 12 }}>
              <strong>MCP Integration:</strong> The auto-configured assistant includes all available MCP servers for
              enhanced functionality.
            </Text>
          </Space>
        </SettingGroup>
      </SettingContainer>

      {/* Agent JSON Modal */}
      <Modal
        title="Symbiote Agent Configuration"
        open={showAgentJson}
        onCancel={() => setShowAgentJson(false)}
        footer={[
          <Button
            key="copy"
            type="primary"
            icon={<Copy size={14} />}
            onClick={() => symbioteAgent && handleCopyJson(formatJson(symbioteAgent))}>
            Copy JSON
          </Button>,
          <Button key="close" onClick={() => setShowAgentJson(false)}>
            Close
          </Button>
        ]}
        width={800}>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            This is the complete configuration for the auto-configured Symbiote agent. You can copy this JSON to use
            elsewhere or for debugging purposes.
          </Text>
        </div>
        <TextArea
          value={symbioteAgent ? formatJson(symbioteAgent) : ''}
          readOnly
          rows={20}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>

      {/* Assistant JSON Modal */}
      <Modal
        title="Symbiote Assistant Configuration"
        open={showAssistantJson}
        onCancel={() => setShowAssistantJson(false)}
        footer={[
          <Button
            key="copy"
            type="primary"
            icon={<Copy size={14} />}
            onClick={() => symbioteAssistant && handleCopyJson(formatJson(symbioteAssistant))}>
            Copy JSON
          </Button>,
          <Button key="close" onClick={() => setShowAssistantJson(false)}>
            Close
          </Button>
        ]}
        width={800}>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            This is the complete configuration for the auto-configured Symbiote assistant. You can copy this JSON to use
            elsewhere or for debugging purposes.
          </Text>
        </div>
        <TextArea
          value={symbioteAssistant ? formatJson(symbioteAssistant) : ''}
          readOnly
          rows={20}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>
    </Container>
  )
}

const Container = styled.div`
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
`

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
`

const StatusCard = styled.div`
  padding: 16px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
`

export default SymbioteSettings
