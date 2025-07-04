import os from 'node:os'
import path from 'node:path'

import { createInMemoryMCPServer } from '@main/mcpServers/factory'
import { makeSureDirExists } from '@main/utils'
import { buildFunctionCallToolName } from '@main/utils/mcp'
import { getBinaryName, getBinaryPath } from '@main/utils/process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport, SSEClientTransportOptions } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions
} from '@modelcontextprotocol/sdk/client/streamableHttp'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory'
import { nanoid } from '@reduxjs/toolkit'
import {
  GetMCPPromptResponse,
  GetResourceResponse,
  MCPCallToolResponse,
  MCPPrompt,
  MCPResource,
  MCPServer,
  MCPTool
} from '@types'
import { app } from 'electron'
import Logger from 'electron-log'
import { EventEmitter } from 'events'
import { memoize } from 'lodash'
import { z } from 'zod'

import { CacheService } from './CacheService'
import { createAuthProvider, isJwtProvider, isOAuthProvider } from './mcp/auth/factory'
import { CallBackServer } from './mcp/oauth/callback'
import getLoginShellEnvironment from './mcp/shell-env'
import { windowService } from './WindowService'

// Generic type for caching wrapped functions
type CachedFunction<T extends unknown[], R> = (...args: T) => Promise<R>

/**
 * Higher-order function to add caching capability to any async function
 * @param fn The original function to be wrapped with caching
 * @param getCacheKey Function to generate a cache key from the function arguments
 * @param ttl Time to live for the cache entry in milliseconds
 * @param logPrefix Prefix for log messages
 * @returns The wrapped function with caching capability
 */
function withCache<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  getCacheKey: (...args: T) => string,
  ttl: number,
  logPrefix: string
): CachedFunction<T, R> {
  return async (...args: T): Promise<R> => {
    const cacheKey = getCacheKey(...args)

    if (CacheService.has(cacheKey)) {
      Logger.info(`${logPrefix} loaded from cache`)
      const cachedData = CacheService.get<R>(cacheKey)
      if (cachedData) {
        return cachedData
      }
    }

    const result = await fn(...args)
    CacheService.set(cacheKey, result, ttl)
    return result
  }
}

class McpService {
  private clients: Map<string, Client> = new Map()
  private pendingClients: Map<string, Promise<Client>> = new Map()

  constructor() {
    this.initClient = this.initClient.bind(this)
    this.listTools = this.listTools.bind(this)
    this.callTool = this.callTool.bind(this)
    this.listPrompts = this.listPrompts.bind(this)
    this.getPrompt = this.getPrompt.bind(this)
    this.listResources = this.listResources.bind(this)
    this.getResource = this.getResource.bind(this)
    this.closeClient = this.closeClient.bind(this)
    this.removeServer = this.removeServer.bind(this)
    this.restartServer = this.restartServer.bind(this)
    this.stopServer = this.stopServer.bind(this)
    this.cleanup = this.cleanup.bind(this)
  }

  private getServerKey(server: MCPServer): string {
    return JSON.stringify({
      baseUrl: server.baseUrl,
      command: server.command,
      args: Array.isArray(server.args) ? server.args : [],
      registryUrl: server.registryUrl,
      env: server.env,
      id: server.id
    })
  }

  async initClient(server: MCPServer): Promise<Client> {
    const serverKey = this.getServerKey(server)
    Logger.info(`[MCP] Initializing client for server: ${server.name} (${server.type})`)

    // If there's a pending initialization, wait for it
    const pendingClient = this.pendingClients.get(serverKey)
    if (pendingClient) {
      Logger.info(`[MCP] Using pending client initialization for ${server.name}`)
      return pendingClient
    }

    // Check if we already have a client for this server configuration
    const existingClient = this.clients.get(serverKey)
    if (existingClient) {
      try {
        Logger.info(`[MCP] Testing existing client connection for ${server.name}`)
        // Check if the existing client is still connected
        const pingResult = await existingClient.ping()
        Logger.info(`[MCP] Ping result for ${server.name}:`, pingResult)
        // If the ping fails, remove the client from the cache
        // and create a new one
        if (!pingResult) {
          Logger.warn(`[MCP] Ping failed, removing cached client for ${server.name}`)
          this.clients.delete(serverKey)
        } else {
          Logger.info(`[MCP] Reusing existing client for ${server.name}`)
          return existingClient
        }
      } catch (error: any) {
        Logger.error(`[MCP] Error pinging server ${server.name}:`, error?.message)
        this.clients.delete(serverKey)
      }
    }

    // Create a promise for the initialization process
    const initPromise = (async () => {
      try {
        // Create new client instance for each connection
        const client = new Client({ name: 'Symbiote Desktop', version: app.getVersion() }, { capabilities: {} })

        const args = [...(server.args || [])]

        // let transport: StdioClientTransport | SSEClientTransport | InMemoryTransport | StreamableHTTPClientTransport
        // Create appropriate auth provider based on server configuration
        const authProvider = createAuthProvider(server)

        const initTransport = async (): Promise<
          StdioClientTransport | SSEClientTransport | InMemoryTransport | StreamableHTTPClientTransport
        > => {
          // Create appropriate transport based on configuration
          if (server.type === 'inMemory') {
            Logger.info(`[MCP] Using in-memory transport for server: ${server.name}`)
            const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
            // start the in-memory server with the given name and environment variables
            const inMemoryServer = createInMemoryMCPServer(server.name, args, server.env || {})
            try {
              await inMemoryServer.connect(serverTransport)
              Logger.info(`[MCP] In-memory server started: ${server.name}`)
            } catch (error: Error | any) {
              Logger.error(`[MCP] Error starting in-memory server: ${error}`)
              throw new Error(`Failed to start in-memory server: ${error.message}`)
            }
            // set the client transport to the client
            return clientTransport
          } else if (server.baseUrl) {
            if (server.type === 'streamableHttp') {
              Logger.info(`[MCP] Creating StreamableHTTP transport for ${server.name} with URL: ${server.baseUrl}`)
              
              // Get initial headers
              const initialHeaders = { ...(server.headers || {}) }
              
              // Add JWT token for JWT providers
              if (isJwtProvider(authProvider)) {
                try {
                  const tokens = await authProvider.tokens()
                  if (tokens && tokens.access_token) {
                    initialHeaders['Authorization'] = `Bearer ${tokens.access_token}`
                    Logger.info(`[MCP] Added JWT Bearer token to StreamableHTTP headers for ${server.name}`)
                  } else {
                    Logger.warn(`[MCP] No JWT token available for ${server.name}`)
                  }
                } catch (error) {
                  Logger.error(`[MCP] Failed to get JWT token for ${server.name}:`, error)
                }
              }
              
              const options: StreamableHTTPClientTransportOptions = {
                requestInit: {
                  headers: initialHeaders
                },
                ...(isOAuthProvider(authProvider) && { authProvider })
              }
              Logger.info(`[MCP] StreamableHTTP options:`, JSON.stringify(options, null, 2))
              const transport = new StreamableHTTPClientTransport(new URL(server.baseUrl!), options)
              Logger.info(`[MCP] StreamableHTTP transport created successfully for ${server.name}`)
              return transport
            } else if (server.type === 'sse') {
              const options: SSEClientTransportOptions = {
                eventSourceInit: {
                  fetch: async (url, init) => {
                    const headers = { ...(server.headers || {}), ...(init?.headers || {}) }

                    // Get tokens from authProvider to make sure using the latest tokens
                    if (authProvider && typeof authProvider.tokens === 'function') {
                      try {
                        const tokens = await authProvider.tokens()
                        if (tokens && tokens.access_token) {
                          headers['Authorization'] = `Bearer ${tokens.access_token}`
                        }
                      } catch (error) {
                        Logger.error('Failed to fetch tokens:', error)
                      }
                    }

                    return fetch(url, { ...init, headers })
                  }
                },
                requestInit: {
                  headers: server.headers || {}
                },
                ...(isOAuthProvider(authProvider) && { authProvider })
              }
              return new SSEClientTransport(new URL(server.baseUrl!), options)
            } else {
              throw new Error('Invalid server type')
            }
          } else if (server.command) {
            let cmd = server.command

            if (server.command === 'npx') {
              cmd = await getBinaryPath('bun')
              Logger.info(`[MCP] Using command: ${cmd}`)

              // add -x to args if args exist
              if (args && args.length > 0) {
                if (!args.includes('-y')) {
                  args.unshift('-y')
                }
                if (!args.includes('x')) {
                  args.unshift('x')
                }
              }
              if (server.registryUrl) {
                server.env = {
                  ...server.env,
                  NPM_CONFIG_REGISTRY: server.registryUrl
                }

                // if the server name is mcp-auto-install, use the mcp-registry.json file in the bin directory
                if (server.name.includes('mcp-auto-install')) {
                  const binPath = await getBinaryPath()
                  makeSureDirExists(binPath)
                  server.env.MCP_REGISTRY_PATH = path.join(binPath, '..', 'config', 'mcp-registry.json')
                }
              }
            } else if (server.command === 'uvx' || server.command === 'uv') {
              cmd = await getBinaryPath(server.command)
              if (server.registryUrl) {
                server.env = {
                  ...server.env,
                  UV_DEFAULT_INDEX: server.registryUrl,
                  PIP_INDEX_URL: server.registryUrl
                }
              }
            }

            Logger.info(`[MCP] Starting server with command: ${cmd} ${args ? args.join(' ') : ''}`)
            // Logger.info(`[MCP] Environment variables for server:`, server.env)
            const loginShellEnv = await this.getLoginShellEnv()

            // Bun not support proxy https://github.com/oven-sh/bun/issues/16812
            if (cmd.includes('bun')) {
              this.removeProxyEnv(loginShellEnv)
            }

            const stdioTransport = new StdioClientTransport({
              command: cmd,
              args,
              env: {
                ...loginShellEnv,
                ...server.env
              },
              stderr: 'pipe'
            })
            stdioTransport.stderr?.on('data', (data) =>
              Logger.info(`[MCP] Stdio stderr for server: ${server.name} `, data.toString())
            )
            return stdioTransport
          } else {
            throw new Error('Either baseUrl or command must be provided')
          }
        }

        const handleAuth = async (client: Client, transport: SSEClientTransport | StreamableHTTPClientTransport) => {
          // Check if this is a JWT provider (no OAuth flow needed)
          if (isJwtProvider(authProvider)) {
            Logger.info(`[MCP] JWT authentication handled automatically: ${server.name}`)
            return
          }

          // Handle OAuth flow for OAuth providers
          if (isOAuthProvider(authProvider)) {
            Logger.info(`[MCP] Starting OAuth flow for server: ${server.name}`)
            // Create an event emitter for the OAuth callback
            const events = new EventEmitter()

            // Create a callback server (only for OAuth providers)
            const oauthProvider = authProvider
            const callbackServer = new CallBackServer({
              port: oauthProvider.config.callbackPort,
              path: oauthProvider.config.callbackPath || '/oauth/callback',
              events
            })

            // Set a timeout to close the callback server
            const timeoutId = setTimeout(() => {
              Logger.warn(`[MCP] OAuth flow timed out for server: ${server.name}`)
              callbackServer.close()
            }, 300000) // 5 minutes timeout

            try {
              // Wait for the authorization code
              const authCode = await callbackServer.waitForAuthCode()
              Logger.info(`[MCP] Received auth code: ${authCode}`)

              // Complete the OAuth flow
              await transport.finishAuth(authCode)

              Logger.info(`[MCP] OAuth flow completed for server: ${server.name}`)

              const newTransport = await initTransport()
              // Try to connect again
              await client.connect(newTransport)

              Logger.info(`[MCP] Successfully authenticated with server: ${server.name}`)
            } catch (oauthError) {
              Logger.error(`[MCP] OAuth authentication failed for server ${server.name}:`, oauthError)
              throw new Error(
                `OAuth authentication failed: ${oauthError instanceof Error ? oauthError.message : String(oauthError)}`
              )
            } finally {
              // Clear the timeout and close the callback server
              clearTimeout(timeoutId)
              callbackServer.close()
            }
          } else {
            Logger.warn(`[MCP] Unknown auth provider type for server: ${server.name}`)
            throw new Error('Unsupported authentication provider type')
          }
        }

        try {
          const transport = await initTransport()
          Logger.info(`[MCP] Transport initialized for ${server.name}, attempting connection...`)

          try {
            await client.connect(transport)
            Logger.info(`[MCP] Successfully connected to server: ${server.name}`)
          } catch (error: Error | any) {
            if (
              error instanceof Error &&
              (error.name === 'UnauthorizedError' || error.message.includes('Unauthorized'))
            ) {
              Logger.info(`[MCP] Authentication required for server: ${server.name}`)
              await handleAuth(client, transport as SSEClientTransport | StreamableHTTPClientTransport)
            } else {
              Logger.error(`[MCP] Connection failed for server: ${server.name}`, error)
              throw error
            }
          }

          // Store the new client in the cache
          this.clients.set(serverKey, client)

          Logger.info(`[MCP] Activated server: ${server.name}`)
          return client
        } catch (error: any) {
          Logger.error(`[MCP] Error activating server ${server.name}:`, error?.message)
          throw new Error(`[MCP] Error activating server ${server.name}: ${error.message}`)
        }
      } finally {
        // Clean up the pending promise when done
        this.pendingClients.delete(serverKey)
      }
    })()

    // Store the pending promise
    this.pendingClients.set(serverKey, initPromise)

    return initPromise
  }

  async closeClient(serverKey: string) {
    const client = this.clients.get(serverKey)
    if (client) {
      // Remove the client from the cache
      await client.close()
      Logger.info(`[MCP] Closed server: ${serverKey}`)
      this.clients.delete(serverKey)
      CacheService.remove(`mcp:list_tool:${serverKey}`)
      Logger.info(`[MCP] Cleared cache for server: ${serverKey}`)
    } else {
      Logger.warn(`[MCP] No client found for server: ${serverKey}`)
    }
  }

  async stopServer(_: Electron.IpcMainInvokeEvent, server: MCPServer) {
    const serverKey = this.getServerKey(server)
    Logger.info(`[MCP] Stopping server: ${server.name}`)
    await this.closeClient(serverKey)
  }

  async removeServer(_: Electron.IpcMainInvokeEvent, server: MCPServer) {
    const serverKey = this.getServerKey(server)
    const existingClient = this.clients.get(serverKey)
    if (existingClient) {
      await this.closeClient(serverKey)
    }
  }

  async restartServer(_: Electron.IpcMainInvokeEvent, server: MCPServer) {
    Logger.info(`[MCP] Restarting server: ${server.name}`)
    const serverKey = this.getServerKey(server)
    await this.closeClient(serverKey)
    await this.initClient(server)
  }

  async cleanup() {
    for (const [key] of this.clients) {
      try {
        await this.closeClient(key)
      } catch (error: any) {
        Logger.error(`[MCP] Failed to close client: ${error?.message}`)
      }
    }
  }

  /**
   * Check connectivity for an MCP server
   */
  public async checkMcpConnectivity(_: Electron.IpcMainInvokeEvent, server: MCPServer): Promise<boolean> {
    Logger.info(`[MCP] Checking connectivity for server: ${server.name}`)
    try {
      const client = await this.initClient(server)
      // Attempt to list tools as a way to check connectivity
      await client.listTools()
      Logger.info(`[MCP] Connectivity check successful for server: ${server.name}`)
      return true
    } catch (error) {
      Logger.error(`[MCP] Connectivity check failed for server: ${server.name}`, error)
      // Close the client if connectivity check fails to ensure a clean state for the next attempt
      const serverKey = this.getServerKey(server)
      await this.closeClient(serverKey)
      return false
    }
  }

  private async listToolsImpl(server: MCPServer): Promise<MCPTool[]> {
    Logger.info(`[MCP] Listing tools for server: ${server.name}`)
    const client = await this.initClient(server)
    try {
      const { tools } = await client.listTools()
      const serverTools: MCPTool[] = []
      tools.map((tool: any) => {
        const serverTool: MCPTool = {
          ...tool,
          id: buildFunctionCallToolName(server.name, tool.name),
          serverId: server.id,
          serverName: server.name
        }
        serverTools.push(serverTool)
      })
      return serverTools
    } catch (error: any) {
      Logger.error(`[MCP] Failed to list tools for server: ${server.name}`, error?.message)
      return []
    }
  }

  async listTools(_: Electron.IpcMainInvokeEvent, server: MCPServer) {
    const cachedListTools = withCache<[MCPServer], MCPTool[]>(
      this.listToolsImpl.bind(this),
      (server) => {
        const serverKey = this.getServerKey(server)
        return `mcp:list_tool:${serverKey}`
      },
      5 * 60 * 1000, // 5 minutes TTL
      `[MCP] Tools from ${server.name}`
    )

    return cachedListTools(server)
  }

  /**
   * Internal method to call a tool on an MCP server with optional progress forwarding
   */
  private async callToolInternal(
    server: MCPServer,
    name: string,
    args: any,
    toolCallId?: string
  ): Promise<MCPCallToolResponse> {
    const startTime = Date.now()
    try {
      Logger.info(`[MCP] Calling tool: ${name} on server: ${server.name}`)
      Logger.info(`[MCP] Tool args:`, typeof args === 'object' ? JSON.stringify(args, null, 2) : args)
      Logger.info(
        `[MCP] Using progress-aware timeout: ${server.timeout ? server.timeout * 1000 : 300000}ms (resets on progress)`
      )

      if (typeof args === 'string') {
        try {
          args = JSON.parse(args)
        } catch (e) {
          Logger.error('[MCP] args parse error', args)
        }
      }

      const client = await this.initClient(server)
      Logger.info(`[MCP] Client initialized for ${server.name}, calling tool...`)

      // Get the main window for sending progress updates if toolCallId is provided
      const mainWindow = toolCallId ? windowService.getMainWindow() : null

      // Implement progress-aware timeout to work around MCP SDK bug
      // The MCP SDK doesn't reset timeout on progress, so we implement our own timeout management
      const baseTimeout = server.timeout ? server.timeout * 1000 : 300000 // 5 minutes default
      let timeoutId: NodeJS.Timeout | null = null
      let isCompleted = false

      const createProgressAwareRequest = (): Promise<any> => {
        return new Promise((resolve, reject) => {
          // Set up our own timeout that gets reset on progress
          const resetTimeout = () => {
            if (timeoutId) clearTimeout(timeoutId)
            if (isCompleted) return

            timeoutId = setTimeout(() => {
              if (!isCompleted) {
                isCompleted = true
                const timeoutError = new Error(`MCP request timeout after ${baseTimeout}ms with no progress updates`)
                timeoutError.name = 'McpTimeoutError'
                reject(timeoutError)
              }
            }, baseTimeout)
          }

          // Start initial timeout
          resetTimeout()

          // Make the actual MCP request
          client
            .request(
              {
                method: 'tools/call',
                params: {
                  name,
                  arguments: args
                }
              },
              z.any(),
              {
                timeout: baseTimeout * 2, // Set SDK timeout higher than our custom timeout
                onprogress: (progress) => {
                  if (isCompleted) return

                  Logger.debug(`[MCP] Progress update for ${name} on ${server.name}:`, progress)
                  Logger.info(
                    `[MCP] ⏰ Resetting timeout for ${name} due to progress update (${progress.progress || 0}${progress.total ? `/${progress.total}` : ''})`
                  )

                  // Reset our custom timeout on each progress update
                  resetTimeout()

                  // Forward progress to renderer only if toolCallId is provided and we have a main window
                  if (toolCallId && mainWindow && !mainWindow.isDestroyed()) {
                    try {
                      const progressData = {
                        type: 'mcp_tool_progress',
                        toolCallId,
                        progressToken: progress.progressToken || '',
                        progress: progress.progress || 0,
                        total: progress.total,
                        message: progress.message
                      }
                      Logger.info(`[MCP] 🚀 SENDING progress to renderer for ${name}:`, progressData)
                      mainWindow.webContents.send('mcp:tool-call-progress', progressData)
                      Logger.info(`[MCP] ✅ Progress event sent successfully for ${name}`)
                    } catch (error) {
                      Logger.error(`[MCP] ❌ Failed to send progress update:`, error)
                    }
                  } else {
                    Logger.info(
                      `[MCP] 🔍 Progress NOT forwarded - toolCallId: ${toolCallId}, hasMainWindow: ${!!mainWindow}, isDestroyed: ${mainWindow?.isDestroyed()}`
                    )
                  }
                }
              }
            )
            .then((result) => {
              if (!isCompleted) {
                isCompleted = true
                if (timeoutId) clearTimeout(timeoutId)
                resolve(result)
              }
            })
            .catch((error) => {
              if (!isCompleted) {
                isCompleted = true
                if (timeoutId) clearTimeout(timeoutId)
                reject(error)
              }
            })
        })
      }

      const result = await createProgressAwareRequest()

      const duration = Date.now() - startTime
      Logger.info(`[MCP] Tool call completed successfully in ${duration}ms for ${name} on ${server.name}`)
      return result as MCPCallToolResponse
    } catch (error) {
      const duration = Date.now() - startTime
      Logger.error(`[MCP] Error calling tool ${name} on ${server.name} after ${duration}ms:`, error)
      Logger.error(`[MCP] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        serverType: server.type,
        serverUrl: server.baseUrl
      })
      throw error
    }
  }

  /**
   * Call a tool on an MCP server with optional progress forwarding
   */
  public async callTool(
    _: Electron.IpcMainInvokeEvent,
    { server, name, args, toolCallId }: { server: MCPServer; name: string; args: any; toolCallId?: string }
  ): Promise<MCPCallToolResponse> {
    return this.callToolInternal(server, name, args, toolCallId)
  }

  /**
   * @deprecated Use callTool with toolCallId parameter instead
   * Call a tool on an MCP server with progress forwarding
   */
  public async callToolWithProgress(
    _: Electron.IpcMainInvokeEvent,
    { server, name, args, toolCallId }: { server: MCPServer; name: string; args: any; toolCallId: string }
  ): Promise<MCPCallToolResponse> {
    return this.callToolInternal(server, name, args, toolCallId)
  }

  public async getInstallInfo() {
    const dir = path.join(os.homedir(), '.symbiote', 'bin')
    const uvName = await getBinaryName('uv')
    const bunName = await getBinaryName('bun')
    const uvPath = path.join(dir, uvName)
    const bunPath = path.join(dir, bunName)
    return { dir, uvPath, bunPath }
  }

  /**
   * List prompts available on an MCP server
   */
  private async listPromptsImpl(server: MCPServer): Promise<MCPPrompt[]> {
    const client = await this.initClient(server)
    Logger.info(`[MCP] Listing prompts for server: ${server.name}`)
    try {
      const { prompts } = await client.listPrompts()
      return prompts.map((prompt: any) => ({
        ...prompt,
        id: `p${nanoid()}`,
        serverId: server.id,
        serverName: server.name
      }))
    } catch (error: any) {
      // -32601 is the code for the method not found
      if (error?.code !== -32601) {
        Logger.error(`[MCP] Failed to list prompts for server: ${server.name}`, error?.message)
      }
      return []
    }
  }

  /**
   * List prompts available on an MCP server with caching
   */
  public async listPrompts(_: Electron.IpcMainInvokeEvent, server: MCPServer): Promise<MCPPrompt[]> {
    const cachedListPrompts = withCache<[MCPServer], MCPPrompt[]>(
      this.listPromptsImpl.bind(this),
      (server) => {
        const serverKey = this.getServerKey(server)
        return `mcp:list_prompts:${serverKey}`
      },
      60 * 60 * 1000, // 60 minutes TTL
      `[MCP] Prompts from ${server.name}`
    )
    return cachedListPrompts(server)
  }

  /**
   * Get a specific prompt from an MCP server (implementation)
   */
  private async getPromptImpl(
    server: MCPServer,
    name: string,
    args?: Record<string, any>
  ): Promise<GetMCPPromptResponse> {
    Logger.info(`[MCP] Getting prompt ${name} from server: ${server.name}`)
    const client = await this.initClient(server)
    return await client.getPrompt({ name, arguments: args })
  }

  /**
   * Get a specific prompt from an MCP server with caching
   */
  public async getPrompt(
    _: Electron.IpcMainInvokeEvent,
    { server, name, args }: { server: MCPServer; name: string; args?: Record<string, any> }
  ): Promise<GetMCPPromptResponse> {
    const cachedGetPrompt = withCache<[MCPServer, string, Record<string, any> | undefined], GetMCPPromptResponse>(
      this.getPromptImpl.bind(this),
      (server, name, args) => {
        const serverKey = this.getServerKey(server)
        const argsKey = args ? JSON.stringify(args) : 'no-args'
        return `mcp:get_prompt:${serverKey}:${name}:${argsKey}`
      },
      30 * 60 * 1000, // 30 minutes TTL
      `[MCP] Prompt ${name} from ${server.name}`
    )
    return await cachedGetPrompt(server, name, args)
  }

  /**
   * List resources available on an MCP server (implementation)
   */
  private async listResourcesImpl(server: MCPServer): Promise<MCPResource[]> {
    const client = await this.initClient(server)
    Logger.info(`[MCP] Listing resources for server: ${server.name}`)
    try {
      const result = await client.listResources()
      const resources = result.resources || []
      return (Array.isArray(resources) ? resources : []).map((resource: any) => ({
        ...resource,
        serverId: server.id,
        serverName: server.name
      }))
    } catch (error: any) {
      // -32601 is the code for the method not found
      if (error?.code !== -32601) {
        Logger.error(`[MCP] Failed to list resources for server: ${server.name}`, error?.message)
      }
      return []
    }
  }

  /**
   * List resources available on an MCP server with caching
   */
  public async listResources(_: Electron.IpcMainInvokeEvent, server: MCPServer): Promise<MCPResource[]> {
    const cachedListResources = withCache<[MCPServer], MCPResource[]>(
      this.listResourcesImpl.bind(this),
      (server) => {
        const serverKey = this.getServerKey(server)
        return `mcp:list_resources:${serverKey}`
      },
      60 * 60 * 1000, // 60 minutes TTL
      `[MCP] Resources from ${server.name}`
    )
    return cachedListResources(server)
  }

  /**
   * Get a specific resource from an MCP server (implementation)
   */
  private async getResourceImpl(server: MCPServer, uri: string): Promise<GetResourceResponse> {
    Logger.info(`[MCP] Getting resource ${uri} from server: ${server.name}`)
    const client = await this.initClient(server)
    try {
      const result = await client.readResource({ uri: uri })
      const contents: MCPResource[] = []
      if (result.contents && result.contents.length > 0) {
        result.contents.forEach((content: any) => {
          contents.push({
            ...content,
            serverId: server.id,
            serverName: server.name
          })
        })
      }
      return {
        contents: contents
      }
    } catch (error: Error | any) {
      Logger.error(`[MCP] Failed to get resource ${uri} from server: ${server.name}`, error.message)
      throw new Error(`Failed to get resource ${uri} from server: ${server.name}: ${error.message}`)
    }
  }

  /**
   * Get a specific resource from an MCP server with caching
   */
  public async getResource(
    _: Electron.IpcMainInvokeEvent,
    { server, uri }: { server: MCPServer; uri: string }
  ): Promise<GetResourceResponse> {
    const cachedGetResource = withCache<[MCPServer, string], GetResourceResponse>(
      this.getResourceImpl.bind(this),
      (server, uri) => {
        const serverKey = this.getServerKey(server)
        return `mcp:get_resource:${serverKey}:${uri}`
      },
      30 * 60 * 1000, // 30 minutes TTL
      `[MCP] Resource ${uri} from ${server.name}`
    )
    return await cachedGetResource(server, uri)
  }

  private getLoginShellEnv = memoize(async (): Promise<Record<string, string>> => {
    try {
      const loginEnv = await getLoginShellEnvironment()
      const pathSeparator = process.platform === 'win32' ? ';' : ':'
      const cherryBinPath = path.join(os.homedir(), '.symbiote', 'bin')
      loginEnv.PATH = `${loginEnv.PATH}${pathSeparator}${cherryBinPath}`
      Logger.info('[MCP] Successfully fetched login shell environment variables:')
      return loginEnv
    } catch (error) {
      Logger.error('[MCP] Failed to fetch login shell environment variables:', error)
      return {}
    }
  })

  private removeProxyEnv(env: Record<string, string>) {
    delete env.HTTPS_PROXY
    delete env.HTTP_PROXY
    delete env.grpc_proxy
    delete env.http_proxy
    delete env.https_proxy
  }
}

export default new McpService()
