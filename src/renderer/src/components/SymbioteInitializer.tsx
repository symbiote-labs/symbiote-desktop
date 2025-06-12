import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setSymbioteAgent } from '@renderer/store/agents'
import { setSymbioteAssistant, updateAssistants } from '@renderer/store/assistants'
import { setMCPServers } from '@renderer/store/mcp'
import { updateProviders } from '@renderer/store/llm'
import {
  setSymbioteAgentConfigured,
  setSymbioteAssistantConfigured,
  setLastSymbioteConfigUpdate,
  setLastSymbioteConfigFetch,
  setSymbioteConfigSections,
  setSymbioteConfigErrors,
  clearSymbioteConfigErrors
} from '@renderer/store/settings'
import { useAuth } from '@renderer/context/AuthProvider'
import SymbioteApiService from '@renderer/services/SymbioteApiService'
import {
  createSymbioteAgent,
  createSymbioteAssistant,
  hasAgentConfigChanged,
  needsMcpServerUpdate,
  SYMBIOTE_AGENT_ID,
  SYMBIOTE_ASSISTANT_ID
} from '@renderer/utils/symbioteConfig'
import Logger from '@renderer/config/logger'

export const SymbioteInitializer: React.FC = () => {
  const dispatch = useAppDispatch()
  const { isAuthenticated, isLoading, loginSuccessTimestamp } = useAuth()

  // State selectors
  const existingAgent = useAppSelector((state) =>
    state.agents.agents.find(agent => agent.id === SYMBIOTE_AGENT_ID)
  )
  const existingAssistant = useAppSelector((state) =>
    state.assistants.assistants.find(assistant => assistant.id === SYMBIOTE_ASSISTANT_ID)
  )
  const mcpServers = useAppSelector((state) => state.mcp.servers)
  const assistants = useAppSelector((state) => state.assistants.assistants)
  const providers = useAppSelector((state) => state.llm.providers)
  const {
    symbioteAgentConfigured,
    symbioteAssistantConfigured
  } = useAppSelector((state) => state.settings)

  // Track intervals to prevent duplicates
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastLoginProcessedRef = useRef<number | null>(null)

  const initializeSymbioteConfiguration = async () => {
    if (!isAuthenticated) {
      Logger.log('[SymbioteInitializer] Not authenticated, skipping initialization')
      return
    }

    try {
      Logger.log('[SymbioteInitializer] Starting Symbiote configuration...')

      // Fetch agent configuration from API
      const agentConfig = await SymbioteApiService.fetchAgentConfigWithRetry()

      if (!agentConfig) {
        Logger.warn('[SymbioteInitializer] Failed to fetch agent configuration')
        return
      }

      // Check if agent configuration has changed
      const agentChanged = hasAgentConfigChanged(existingAgent, agentConfig)

      let agent = existingAgent
      if (agentChanged) {
        Logger.log('[SymbioteInitializer] Agent configuration changed, updating...')
        agent = createSymbioteAgent(agentConfig)
        dispatch(setSymbioteAgent(agent))
        dispatch(setSymbioteAgentConfigured(true))
      }

      // Check if assistant needs to be created or updated
      const mcpChanged = needsMcpServerUpdate(existingAssistant, mcpServers)

      if (!existingAssistant || agentChanged || mcpChanged) {
        Logger.log('[SymbioteInitializer] Creating/updating Symbiote assistant...')

        if (!agent) {
          Logger.error('[SymbioteInitializer] No agent available for assistant creation')
          return
        }

        const assistant = createSymbioteAssistant(agent, mcpServers)
        dispatch(setSymbioteAssistant(assistant))
        dispatch(setSymbioteAssistantConfigured(true))

        Logger.log('[SymbioteInitializer] Assistant configured with MCP servers:', assistant.mcpServers?.length || 0)
      }

      // Update last configuration timestamp
      dispatch(setLastSymbioteConfigUpdate(Date.now()))

      Logger.log('[SymbioteInitializer] Symbiote configuration completed successfully')

    } catch (error) {
      Logger.error('[SymbioteInitializer] Error during Symbiote configuration:', error)
    }
  }

  const processSymbioteConfig = async () => {
    if (!isAuthenticated) {
      Logger.log('[SymbioteInitializer] Not authenticated, skipping config fetch')
      return
    }

    try {
      Logger.log('[SymbioteInitializer] Fetching comprehensive Symbiote config...')
      dispatch(clearSymbioteConfigErrors())

      // Fetch comprehensive config from API
      const config = await SymbioteApiService.fetchSymbioteConfigWithRetry()

      if (!config) {
        Logger.warn('[SymbioteInitializer] Failed to fetch Symbiote config')
        dispatch(setSymbioteConfigErrors({ general: 'Failed to fetch configuration' }))
        return
      }

      const sections: string[] = []
      const errors: Record<string, string> = {}

      // Process MCP servers (extracted from assistant config)
      if (config.mcp_servers && Array.isArray(config.mcp_servers) && config.mcp_servers.length > 0) {
        try {
          Logger.log(`[SymbioteInitializer] Processing ${config.mcp_servers.length} MCP servers`)

          // Merge with existing servers, avoiding duplicates by name
          const existingServerNames = mcpServers.map(server => server.name)
          const newServers = config.mcp_servers.filter(
            server => !existingServerNames.includes(server.name)
          )

          if (newServers.length > 0) {
            const allServers = [...mcpServers, ...newServers]
            dispatch(setMCPServers(allServers))
            Logger.log(`[SymbioteInitializer] Added ${newServers.length} new MCP servers`)
          }

          sections.push('mcp_servers')
        } catch (error) {
          Logger.error('[SymbioteInitializer] Error processing MCP servers:', error)
          errors.mcp_servers = 'Failed to process MCP servers'
        }
      }

      // Process assistants (single assistant from cherry-studio-assistant endpoint)
      if (config.assistants && Array.isArray(config.assistants) && config.assistants.length > 0) {
        try {
          Logger.log(`[SymbioteInitializer] Processing ${config.assistants.length} assistants`)

          // Merge with existing assistants, avoiding duplicates by id
          const existingAssistantIds = assistants.map(assistant => assistant.id)
          const newAssistants = config.assistants.filter(
            assistant => !existingAssistantIds.includes(assistant.id)
          )

          if (newAssistants.length > 0) {
            const allAssistants = [...assistants, ...newAssistants]
            dispatch(updateAssistants(allAssistants))
            Logger.log(`[SymbioteInitializer] Added ${newAssistants.length} new assistants`)
          }

          sections.push('assistants')
        } catch (error) {
          Logger.error('[SymbioteInitializer] Error processing assistants:', error)
          errors.assistants = 'Failed to process assistants'
        }
      }

      // Process model providers (if included - currently not in the response)
      if (config.model_providers && Array.isArray(config.model_providers) && config.model_providers.length > 0) {
        try {
          Logger.log(`[SymbioteInitializer] Processing ${config.model_providers.length} model providers`)

          // Merge with existing providers, avoiding duplicates by id
          const existingProviderIds = providers.map(provider => provider.id)
          const newProviders = config.model_providers.filter(
            provider => !existingProviderIds.includes(provider.id)
          )

          if (newProviders.length > 0) {
            const allProviders = [...providers, ...newProviders]
            dispatch(updateProviders(allProviders))
            Logger.log(`[SymbioteInitializer] Added ${newProviders.length} new providers`)
          }

          sections.push('model_providers')
        } catch (error) {
          Logger.error('[SymbioteInitializer] Error processing model providers:', error)
          errors.model_providers = 'Failed to process model providers'
        }
      }

      // Update state
      dispatch(setLastSymbioteConfigFetch(Date.now()))
      dispatch(setSymbioteConfigSections(sections))

      if (Object.keys(errors || {}).length > 0) {
        dispatch(setSymbioteConfigErrors(errors))
      }

      Logger.log(`[SymbioteInitializer] Symbiote config processing completed. Sections: ${sections.join(', ')}`)

    } catch (error) {
      Logger.error('[SymbioteInitializer] Error during Symbiote config processing:', error)
      dispatch(setSymbioteConfigErrors({ general: 'Configuration processing failed' }))
    }
  }

  // Initialize on authentication or fresh login
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      // Check if this is a fresh login
      const isFreshLogin = loginSuccessTimestamp &&
        lastLoginProcessedRef.current !== loginSuccessTimestamp

      // Only initialize if not already configured or if it's a fresh login
      const shouldInitialize = !symbioteAgentConfigured ||
                              !symbioteAssistantConfigured ||
                              isFreshLogin

      if (shouldInitialize) {
        if (isFreshLogin) {
          Logger.log('[SymbioteInitializer] Fresh login detected, initializing...')
          lastLoginProcessedRef.current = loginSuccessTimestamp
        } else {
          Logger.log('[SymbioteInitializer] Authentication confirmed, initializing...')
        }

        // Add a small delay to ensure auth state is fully settled
        setTimeout(async () => {
          await initializeSymbioteConfiguration()
          // Also fetch comprehensive config
          await processSymbioteConfig()
        }, 500)
      }
    }
  }, [isAuthenticated, isLoading, loginSuccessTimestamp, symbioteAgentConfigured, symbioteAssistantConfigured])

  // Set up periodic updates (every 15 minutes)
  useEffect(() => {
    if (isAuthenticated && !isLoading && symbioteAgentConfigured) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      // Set up new interval for periodic updates
      intervalRef.current = setInterval(async () => {
        Logger.log('[SymbioteInitializer] Periodic configuration update check...')
        await initializeSymbioteConfiguration()
        await processSymbioteConfig()
      }, 15 * 60 * 1000) // 15 minutes

      Logger.log('[SymbioteInitializer] Periodic update timer set for 15 minutes')
    }

    // Cleanup interval on unmount or when auth changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isAuthenticated, isLoading, symbioteAgentConfigured])

  // Update assistant when MCP servers change
  useEffect(() => {
    if (isAuthenticated && existingAgent && existingAssistant) {
      const mcpChanged = needsMcpServerUpdate(existingAssistant, mcpServers)

      if (mcpChanged) {
        Logger.log('[SymbioteInitializer] MCP servers changed, updating assistant...')
        const updatedAssistant = createSymbioteAssistant(existingAgent, mcpServers)
        dispatch(setSymbioteAssistant(updatedAssistant))
      }
    }
  }, [mcpServers, isAuthenticated, existingAgent, existingAssistant, dispatch])

  return null
}