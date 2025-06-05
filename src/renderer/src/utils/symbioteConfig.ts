import { getDefaultTopic } from '@renderer/services/AssistantService'
import type { Agent, Assistant, MCPServer } from '@renderer/types'
import type { SymbioteAgentConfig } from '@renderer/services/SymbioteApiService'
import Logger from '@renderer/config/logger'

export const SYMBIOTE_AGENT_ID = 'symbiote-desktop-agent'
export const SYMBIOTE_ASSISTANT_ID = 'symbiote-desktop-assistant'

/**
 * Transform API agent configuration to internal Agent type
 */
export function createSymbioteAgent(config: SymbioteAgentConfig): Agent {
  const agent: Agent = {
    id: SYMBIOTE_AGENT_ID,
    name: config.name,
    emoji: config.emoji || '🤖',
    prompt: config.prompt,
    description: 'Auto-configured Symbiote Desktop agent',
    topics: [],
    messages: [
      {
        role: 'assistant',
        content: "Hey! I'm your Symbiote assistant. I can help you with Blender, Unreal Engine, and connecting to Symbiote Labs services. What would you like to work on today?"
      }
    ],
    type: 'agent',
    regularPhrases: []
  }

  Logger.log('[SymbioteConfig] Created Symbiote agent:', agent.name)
  return agent
}

/**
 * Create Symbiote assistant from agent configuration
 */
export function createSymbioteAssistant(
  agent: Agent,
  mcpServers: MCPServer[] = []
): Assistant {
  const assistantId = SYMBIOTE_ASSISTANT_ID
  const defaultTopic = getDefaultTopic(assistantId)

  const assistant: Assistant = {
    id: assistantId,
    name: agent.name,
    emoji: agent.emoji,
    prompt: agent.prompt,
    description: 'Auto-configured Symbiote Desktop assistant',
    topics: [defaultTopic],
    messages: agent.messages || [
      {
        role: 'assistant',
        content: "Hey! I'm your Symbiote assistant. I can help you with Blender, Unreal Engine, and connecting to Symbiote Labs services. What would you like to work on today?"
      }
    ],
    type: 'assistant',
    regularPhrases: agent.regularPhrases || [],
    // Set to function mode for tool calling
    settings: {
      contextCount: 10,
      temperature: 0.7,
      topP: 1,
      maxTokens: 4096,
      enableMaxTokens: false,
      streamOutput: true,
      hideMessages: false,
      toolUseMode: 'function'
    },
    // Add all active MCP servers
    mcpServers: mcpServers.filter(server => server.isActive)
  }

  Logger.log('[SymbioteConfig] Created Symbiote assistant:', assistant.name)
  Logger.log('[SymbioteConfig] Added MCP servers:', assistant.mcpServers?.length || 0)

  return assistant
}

/**
 * Check if agent configuration has changed
 */
export function hasAgentConfigChanged(
  existingAgent: Agent | undefined,
  newConfig: SymbioteAgentConfig
): boolean {
  if (!existingAgent) {
    return true
  }

  return (
    existingAgent.name !== newConfig.name ||
    existingAgent.emoji !== (newConfig.emoji || '🤖') ||
    existingAgent.prompt !== newConfig.prompt
  )
}

/**
 * Check if assistant needs MCP server updates
 */
export function needsMcpServerUpdate(
  assistant: Assistant | undefined,
  currentMcpServers: MCPServer[]
): boolean {
  if (!assistant || !assistant.mcpServers) {
    return true
  }

  const activeMcpServers = currentMcpServers.filter(server => server.isActive)
  const assistantServerIds = new Set(assistant.mcpServers.map(s => s.id))
  const activeServerIds = new Set(activeMcpServers.map(s => s.id))

  // Check if sets are different
  if (assistantServerIds.size !== activeServerIds.size) {
    return true
  }

  for (const id of assistantServerIds) {
    if (!activeServerIds.has(id)) {
      return true
    }
  }

  return false
}