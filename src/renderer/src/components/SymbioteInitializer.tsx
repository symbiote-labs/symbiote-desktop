import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setSymbioteAgent } from '@renderer/store/agents'
import { setSymbioteAssistant } from '@renderer/store/assistants'
import { setSymbioteAgentConfigured, setSymbioteAssistantConfigured, setLastSymbioteConfigUpdate } from '@renderer/store/settings'
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
    const {
    symbioteAgentConfigured,
    symbioteAssistantConfigured,
    lastSymbioteConfigUpdate
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
        setTimeout(() => {
          initializeSymbioteConfiguration()
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
      intervalRef.current = setInterval(() => {
        Logger.log('[SymbioteInitializer] Periodic configuration update check...')
        initializeSymbioteConfiguration()
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