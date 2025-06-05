import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { DEFAULT_CONTEXTCOUNT, DEFAULT_TEMPERATURE } from '@renderer/config/constant'
import { Agent, AssistantSettings } from '@renderer/types'

export interface AgentsState {
  agents: Agent[]
}

const initialState: AgentsState = {
  agents: []
}

const assistantsSlice = createSlice({
  name: 'agents',
  initialState,
  reducers: {
    updateAgents: (state, action: PayloadAction<Agent[]>) => {
      state.agents = action.payload
    },
    addAgent: (state, action: PayloadAction<Agent>) => {
      state.agents.push(action.payload)
    },
    removeAgent: (state, action: PayloadAction<{ id: string }>) => {
      state.agents = state.agents.filter((c) => c.id !== action.payload.id)
    },
    updateAgent: (state, action: PayloadAction<Agent>) => {
      state.agents = state.agents.map((c) => (c.id === action.payload.id ? action.payload : c))
    },
    updateAgentSettings: (
      state,
      action: PayloadAction<{ assistantId: string; settings: Partial<AssistantSettings> }>
    ) => {
      for (const agent of state.agents) {
        const settings = action.payload.settings
        if (agent.id === action.payload.assistantId) {
          for (const key in settings) {
            if (!agent.settings) {
              agent.settings = {
                temperature: DEFAULT_TEMPERATURE,
                contextCount: DEFAULT_CONTEXTCOUNT,
                enableMaxTokens: false,
                maxTokens: 0,
                streamOutput: true,
                hideMessages: false
              }
            }
            agent.settings[key] = settings[key]
          }
        }
      }
    },
    setSymbioteAgent: (state, action: PayloadAction<Agent>) => {
      // Replace or add the Symbiote agent
      const symbioteIndex = state.agents.findIndex(agent => agent.id === action.payload.id)
      if (symbioteIndex >= 0) {
        state.agents[symbioteIndex] = action.payload
      } else {
        state.agents.unshift(action.payload) // Add at beginning
      }
    },
    clearSymbioteAgent: (state) => {
      state.agents = state.agents.filter(agent => agent.id !== 'symbiote-desktop-agent')
    }
  }
})

export const { updateAgents, addAgent, removeAgent, updateAgent, updateAgentSettings, setSymbioteAgent, clearSymbioteAgent } = assistantsSlice.actions

// Selectors
export const selectSymbioteAgent = (state: { agents: AgentsState }) =>
  state.agents.agents.find(agent => agent.id === 'symbiote-desktop-agent')

export default assistantsSlice.reducer
