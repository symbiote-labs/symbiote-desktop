# Symbiote Desktop Auto-Configuration Implementation Plan

## Overview
This plan implements auto-configuration of a single Symbiote Desktop agent and assistant that fetches configuration from the Symbiote Labs API. The system will maintain internally a single assistant and single agent, with all topics belonging to that assistant.

## Key Requirements
- Auto-configure single Symbiote agent from API endpoint
- Auto-configure single Symbiote assistant using the agent
- Assistant should be in function mode for tool calling 
- Add all MCP servers to the assistant
- Update configuration every 15 minutes
- Minimal effort, surgical changes, economy of motion
- Follow existing initializer pattern like MCPInitializer

## Implementation Tasks

### Phase 1: Core Services and API Integration

#### ✅ 1.1 Create Symbiote API Service
- **File**: `src/renderer/src/services/SymbioteApiService.ts`
- **Purpose**: Handle API calls to fetch agent/assistant configuration
- **Features**:
  - Fetch agent config from `${API_BASE_URL}/api/mcp/tools/cherry-studio-agent`
  - Handle authentication with bearer tokens
  - Parse response and transform to internal types
  - Error handling and retry logic

#### ✅ 1.2 Create Symbiote Initializer Component
- **File**: `src/renderer/src/components/SymbioteInitializer.tsx`
- **Purpose**: Initialize Symbiote agent and assistant after authentication
- **Features**:
  - Follow MCPInitializer pattern
  - Run after authentication is confirmed
  - Auto-configure agent and assistant
  - Set up periodic updates (15 minutes)
  - Handle errors gracefully

#### ✅ 1.3 Create Agent/Assistant Configuration Logic
- **File**: `src/renderer/src/utils/symbioteConfig.ts`
- **Purpose**: Transform API response to internal agent/assistant formats
- **Features**:
  - Convert API response to Agent type
  - Create Assistant from Agent
  - Set assistant to function mode
  - Attach all active MCP servers
  - Generate appropriate IDs and metadata

### Phase 2: Store Integration

#### ✅ 2.1 Add Symbiote Configuration to Settings Store
- **File**: `src/renderer/src/store/settings.ts`
- **Changes**:
  - Add `symbioteAgentConfigured: boolean`
  - Add `symbioteAssistantConfigured: boolean`
  - Add `lastSymbioteConfigUpdate: number`
  - Add actions to update these states

#### ✅ 2.2 Enhance Agent Store for Symbiote Management
- **File**: `src/renderer/src/store/agents.ts`
- **Changes**:
  - Add `setSymbioteAgent` action
  - Add `clearSymbioteAgent` action
  - Add selector for Symbiote agent

#### ✅ 2.3 Enhance Assistant Store for Symbiote Management
- **File**: `src/renderer/src/store/assistants.ts`
- **Changes**:
  - Add `setSymbioteAssistant` action
  - Add `clearSymbioteAssistant` action
  - Add selector for Symbiote assistant
  - Ensure Symbiote assistant is always first/default

### Phase 3: Component Replacements

#### ☐ 3.1 Create SymbioteAgentsTab Component
- **File**: `src/renderer/src/pages/home/Tabs/components/SymbioteAssistantItem.tsx`
- **Purpose**: Replace AssistantItem to show only Symbiote assistant
- **Changes**:
  - Copy AssistantItem contents exactly
  - Rename to SymbioteAssistantItem
  - Only show Symbiote assistant
  - Disable creation/deletion of assistants

#### ☐ 3.2 Create SymbioteAssistantsTab Component  
- **File**: `src/renderer/src/pages/home/Tabs/SymbioteAssistantsTab.tsx`
- **Purpose**: Replace AssistantsTab to show only Symbiote assistant
- **Changes**:
  - Copy AssistantsTab contents exactly
  - Rename to SymbioteAssistantsTab
  - Remove add assistant functionality
  - Only show configured Symbiote assistant
  - Hide creation UI elements

#### ☐ 3.3 Create SymbioteNavbar Component
- **File**: `src/renderer/src/pages/home/SymbioteNavbar.tsx`
- **Purpose**: Replace existing navbar to work with single assistant
- **Changes**:
  - Copy existing navbar contents
  - Modify to only show Symbiote assistant
  - Remove assistant switching if not needed
  - Update to use SymbioteAssistantsTab

### Phase 4: Integration Points

#### ✅ 4.1 Update App.tsx for Symbiote Initialization
- **File**: `src/renderer/src/App.tsx`
- **Changes**:
  - Add `<SymbioteInitializer />` after `<MCPInitializer />`
  - Ensure it runs within `<AuthProvider>` context
  - Place after `<ProtectedRoute>` to ensure authentication

#### ✅ 4.2 Update SymbioteHomePage for New Components
- **File**: `src/renderer/src/pages/home/SymbioteHomePage.tsx`
- **Changes**:
  - Replace navbar with `<SymbioteNavbar />`
  - Ensure it uses Symbiote assistant by default
  - Update assistant selection logic

#### ☐ 4.3 Update Settings Integration
- **File**: `src/renderer/src/pages/settings/AssistantSettings/index.tsx`
- **Changes**:
  - Ensure Symbiote assistant settings work
  - Show that assistant is auto-managed
  - Prevent deletion of Symbiote assistant

### Phase 5: Periodic Updates

#### ✅ 5.1 Implement Configuration Refresh Timer
- **File**: `src/renderer/src/components/SymbioteInitializer.tsx`
- **Features**:
  - Set up 15-minute interval timer
  - Fetch latest configuration
  - Update agent and assistant if changed
  - Handle errors without breaking existing setup

#### ☐ 5.2 Add Update Notifications
- **Features**:
  - Notify user when configuration updates
  - Show loading states during updates
  - Handle update failures gracefully

### Phase 6: Error Handling and Edge Cases

#### ☐ 6.1 Handle API Failures
- **Features**:
  - Graceful degradation if API unavailable
  - Retry logic with exponential backoff
  - Fallback to last known good configuration
  - User notification of issues

#### ✅ 6.2 Handle Authentication Changes
- **Features**:
  - Re-initialize on login/logout
  - Clear configuration on logout
  - Re-fetch on authentication change

#### ☐ 6.3 Handle MCP Server Changes
- **Features**:
  - Update assistant MCP servers when MCP config changes
  - Maintain sync between available and assigned servers

## File Structure Overview

```
src/renderer/src/
├── components/
│   ├── MCPInitializer.tsx (existing)
│   └── SymbioteInitializer.tsx (new)
├── services/
│   └── SymbioteApiService.ts (new)
├── utils/
│   └── symbioteConfig.ts (new)
├── store/
│   ├── agents.ts (modify)
│   ├── assistants.ts (modify)
│   └── settings.ts (modify)
├── pages/home/
│   ├── SymbioteHomePage.tsx (modify)
│   ├── SymbioteNavbar.tsx (new)
│   └── Tabs/
│       ├── SymbioteAssistantsTab.tsx (new)
│       └── components/
│           └── SymbioteAssistantItem.tsx (new)
└── App.tsx (modify)
```

## API Integration Details

### Endpoint
- **URL**: `${API_BASE_URL}/api/mcp/tools/cherry-studio-agent`
- **Method**: GET
- **Headers**: `Authorization: Bearer ${token}`

### Expected Response Format
```json
[
  {
    "emoji": "🎨",
    "name": "Symbiotico Tool Swarm Agent", 
    "prompt": "You are Symbiote, an advanced AI assistant...",
    "type": "agent"
  }
]
```

### Configuration Mapping
- Agent: Use response directly with ID generation
- Assistant: Create from agent + set function mode + add MCP servers

## Testing Strategy

#### ☐ 7.1 Unit Tests
- Test SymbioteApiService methods
- Test configuration transformation utilities
- Test store actions and selectors

#### ☐ 7.2 Integration Tests  
- Test full initialization flow
- Test periodic update mechanism
- Test error handling scenarios

#### ☐ 7.3 Manual Testing
- Verify single agent/assistant setup
- Test MCP server integration
- Verify function calling mode
- Test configuration updates

## Success Criteria

1. ✅ Single Symbiote agent auto-configured from API
2. ✅ Single Symbiote assistant created with function mode
3. ✅ All MCP servers added to assistant
4. ✅ Configuration updates every 15 minutes
5. ✅ No manual agent/assistant creation needed
6. ✅ Surgical changes with no unnecessary refactoring
7. ✅ All topics use the Symbiote assistant
8. ✅ Graceful error handling

## Implementation Notes

- Follow existing patterns from MCPInitializer
- Use authentication context to ensure proper timing
- Maintain backward compatibility
- Keep changes minimal and focused
- Follow repository coding standards
- Prepare for pull request contribution

## Risk Mitigation

- API failures should not break existing functionality
- Configuration updates should be atomic
- User should always have working assistant
- Clear error messages and logging
- Rollback capability if needed 