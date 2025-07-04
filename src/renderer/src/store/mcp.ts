import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import Logger from '@renderer/config/logger'
import type { MCPConfig, MCPServer } from '@renderer/types'

export const initialState: MCPConfig = {
  servers: [],
  isUvInstalled: true,
  isBunInstalled: true
}

const mcpSlice = createSlice({
  name: 'mcp',
  initialState,
  reducers: {
    setMCPServers: (state, action: PayloadAction<MCPServer[]>) => {
      state.servers = action.payload
    },
    addMCPServer: (state, action: PayloadAction<MCPServer>) => {
      state.servers.unshift(action.payload)
    },
    updateMCPServer: (state, action: PayloadAction<MCPServer>) => {
      const index = state.servers.findIndex((server) => server.id === action.payload.id)
      if (index !== -1) {
        state.servers[index] = action.payload
      }
    },
    deleteMCPServer: (state, action: PayloadAction<string>) => {
      state.servers = state.servers.filter((server) => server.id !== action.payload)
    },
    setMCPServerActive: (state, action: PayloadAction<{ id: string; isActive: boolean }>) => {
      const index = state.servers.findIndex((server) => server.id === action.payload.id)
      if (index !== -1) {
        state.servers[index].isActive = action.payload.isActive
      }
    },
    setIsUvInstalled: (state, action: PayloadAction<boolean>) => {
      state.isUvInstalled = action.payload
    },
    setIsBunInstalled: (state, action: PayloadAction<boolean>) => {
      state.isBunInstalled = action.payload
    },
    updateSymbioteMCPServer: (state, action: PayloadAction<{ mcpServerUrl: string; jwtToken: string | null }>) => {
      const { mcpServerUrl, jwtToken } = action.payload
      const symbioteMCPServerName = 'symbiote-mcp'

      // Remove existing symbiote-mcp server if it exists
      state.servers = state.servers.filter(server => server.name !== symbioteMCPServerName)

      // Only add the server if we have a JWT token (authenticated)
      if (jwtToken && mcpServerUrl) {
        const symbioteMCPServer: MCPServer = {
          id: nanoid(),
          name: symbioteMCPServerName,
          type: 'streamableHttp',
          description: 'MCP server for communicating with Symbiote Labs infrastructure (authenticated)',
          baseUrl: mcpServerUrl.endsWith('/mcp/') ? mcpServerUrl : `${mcpServerUrl.replace(/\/$/, '')}/mcp/`,
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          },
          isActive: true,
          provider: 'Symbiote'
        }

        // Add to the beginning of the servers array
        state.servers.unshift(symbioteMCPServer)
      }
    },
    removeSymbioteMCPServer: (state) => {
      state.servers = state.servers.filter(server => server.name !== 'symbiote-mcp')
    }
  },
  selectors: {
    getActiveServers: (state) => {
      return state.servers.filter((server) => server.isActive)
    },
    getAllServers: (state) => state.servers
  }
})

export const {
  setMCPServers,
  addMCPServer,
  updateMCPServer,
  deleteMCPServer,
  setMCPServerActive,
  setIsBunInstalled,
  setIsUvInstalled,
  updateSymbioteMCPServer,
  removeSymbioteMCPServer
} = mcpSlice.actions

// Export the generated selectors from the slice
export const { getActiveServers, getAllServers } = mcpSlice.selectors

// Type-safe selector for accessing this slice from the root state
export const selectMCP = (state: { mcp: MCPConfig }) => state.mcp

export { mcpSlice }
// Export the reducer as default export
export default mcpSlice.reducer

export const builtinMCPServers: MCPServer[] = [
  {
    id: nanoid(),
    name: '@cherry/mcp-auto-install',
    description: 'Automatic MCP service installer (Beta) - https://docs.cherry-ai.com/advanced-basic/mcp/auto-install',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@mcpmarket/mcp-auto-install', 'connect', '--json'],
    isActive: false,
    provider: 'CherryAI'
  },
  {
    id: nanoid(),
    name: '@cherry/memory',
    type: 'inMemory',
    description:
      'Persistent memory implementation based on local knowledge graphs. Enables the model to remember relevant user information across different conversations. Memory is stored in the app config directory.',
    isActive: true,
    env: {},
    provider: 'CherryAI'
  },
  {
    id: nanoid(),
    name: '@cherry/sequentialthinking',
    type: 'inMemory',
    description:
      'An MCP server implementation that provides tools for dynamic and reflective problem-solving through structured thinking processes',
    isActive: true,
    provider: 'CherryAI'
  },
  {
    id: nanoid(),
    name: '@cherry/brave-search',
    type: 'inMemory',
    description:
      'An MCP server implementation integrating Brave Search API, providing both web and local search functionality. Requires BRAVE_API_KEY environment variable.',
    isActive: false,
    env: {
      BRAVE_API_KEY: 'YOUR_API_KEY'
    },
    provider: 'CherryAI'
  },
  {
    id: nanoid(),
    name: '@cherry/fetch',
    type: 'inMemory',
    description: 'MCP server for fetching URL web page content',
    isActive: true,
    provider: 'CherryAI'
  },
  {
    id: nanoid(),
    name: '@cherry/filesystem',
    type: 'inMemory',
    description: 'Node.js server implementing Model Context Protocol (MCP) for file system operations',
    isActive: false,
    provider: 'CherryAI'
  },
  {
    id: nanoid(),
    name: '@cherry/dify-knowledge',
    type: 'inMemory',
    description: 'Dify MCP server implementation providing a simple API for interacting with Dify knowledge bases',
    isActive: false,
    env: {
      DIFY_KEY: 'YOUR_DIFY_KEY'
    },
    provider: 'CherryAI'
  },
  // Symbiote-specific MCP servers
  {
    id: nanoid(),
    name: 'blender-mcp',
    type: 'stdio',
    description: 'MCP server for controlling Blender 3D software',
    command: 'uvx',
    args: ['blender-mcp'],
    isActive: true,
    provider: 'Symbiote'
  },
  {
    id: nanoid(),
    name: 'symbiote-unreal-mcp',
    type: 'stdio',
    description: 'MCP server for controlling Unreal Engine',
    command: 'uvx',
    args: ['symbiote-unreal-mcp'],
    isActive: true,
    provider: 'Symbiote'
  }
]

/**
 * Utility function to add servers to the MCP store during app initialization
 * @param servers Array of MCP servers to add
 * @param dispatch Redux dispatch function
 */
export const initializeMCPServers = (existingServers: MCPServer[], dispatch: (action: any) => void): void => {
  // Check if the existing servers already contain the built-in servers
  const serverIds = new Set(existingServers.map((server) => server.name))

  // Filter out any built-in servers that are already present
  const newServers = builtinMCPServers.filter((server) => !serverIds.has(server.name))

  Logger.log('[initializeMCPServers] Adding new servers:', newServers)
  // Add the new built-in servers to the existing servers
  newServers.forEach((server) => {
    dispatch(addMCPServer(server))
  })
}
