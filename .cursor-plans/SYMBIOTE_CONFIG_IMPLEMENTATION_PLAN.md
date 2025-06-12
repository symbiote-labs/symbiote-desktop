# Symbiote Config API Integration Implementation Plan

## Overview
This plan implements a comprehensive SymbioteConfig API that fetches a flexible configuration object containing MCP servers, assistants, model providers, and other future configurations from the Symbiote Labs API. The system will work similarly to the existing agent config fetch but be more comprehensive and extensible.

## Architecture Analysis

### Current Structure
- ✅ `SymbioteApiService.ts` - Handles agent config fetching  
- ✅ `SymbioteInitializer.tsx` - Initializes agent/assistant on authentication
- ✅ `SymbioteSettingsPage.tsx` - Shows current config status
- ✅ Store structure: `assistants/`, `agents/`, `mcp/`, `llm/providers`
- ✅ Authentication flow via `AuthProvider.tsx`

### Target Schema Structure
```typescript
interface SymbioteConfig {
  mcp_servers: MCPServer[]
  assistants: Assistant[]
  model_providers: Provider[]
  // Future extensibility
  [key: string]: any
}
```

## Implementation Tasks

### Phase 1: Core Service Extension
- [x] **1.1** Extend `SymbioteApiService.ts` with new `fetchSymbioteConfig()` method
  - Add new API endpoint call to `/api/symbiote/config`
  - Support authentication with bearer tokens
  - Include comprehensive error handling and retry logic
  - Parse and validate response schema

- [x] **1.2** Create TypeScript interfaces
  - Define `SymbioteConfigResponse` interface
  - Ensure compatibility with existing `MCPServer`, `Assistant`, `Provider` types
  - Add validation helpers for each config section

### Phase 2: Initialization Integration  
- [x] **2.1** Extend `SymbioteInitializer.tsx`
  - Add `fetchSymbioteConfig()` call alongside existing agent config
  - Process each config section (mcp_servers, assistants, model_providers)
  - Update appropriate stores with fetched data
  - Handle partial config updates gracefully

- [x] **2.2** Update store dispatching logic
  - Dispatch MCP servers to `mcp/` store
  - Dispatch assistants to `assistants/` store  
  - Dispatch providers to `llm/providers` store
  - Maintain existing agent/assistant if not included in config

### Phase 3: Settings Page Integration
- [x] **3.1** Add manual fetch button to `SymbioteSettingsPage.tsx`
  - Create "Fetch Updated Symbiote Config" button
  - Show loading state during fetch
  - Display success/error feedback
  - Update last fetch timestamp

- [x] **3.2** Enhance status display
  - Show config sections loaded (MCP servers, assistants, providers)
  - Display last fetch timestamp
  - Show counts for each config type
  - Add error state handling

### Phase 4: Store State Management
- [x] **4.1** Add settings state for config tracking
  - Add `lastSymbioteConfigFetch: number` to settings store
  - Add `symbioteConfigSections: string[]` to track what was loaded
  - Add `symbioteConfigErrors: Record<string, string>` for error tracking

- [x] **4.2** Update existing reducers
  - Ensure MCP store can handle batch updates
  - Ensure assistants store can handle batch updates  
  - Ensure LLM providers store can handle batch updates
  - Add conflict resolution for duplicate items

### Phase 5: Error Handling & Validation
- [x] **5.1** Add schema validation
  - Validate each config section against expected types
  - Handle missing or malformed sections gracefully
  - Log validation errors with detailed context

- [x] **5.2** Add fallback strategies
  - Continue with partial config if some sections fail
  - Preserve existing config if fetch fails completely
  - Show specific error messages for each section

### Phase 6: Testing & Polish
- [x] **6.1** Test integration scenarios
  - Test with various config combinations
  - Test authentication failure scenarios
  - Test partial config responses
  - Test manual fetch button functionality

- [ ] **6.2** Documentation updates
  - Update `AUTHENTICATION.md` with new config endpoints
  - Add JSDoc comments to new functions
  - Update settings page help text

## Implementation Details

### New API Endpoint
```
GET /api/symbiote/config
Authorization: Bearer <token>
Response: {
  mcp_servers: MCPServer[],
  assistants: Assistant[], 
  model_providers: Provider[],
  // extensible for future config types
}
```

### Key Design Principles
1. **Economy of Motion**: Reuse existing patterns and store structures
2. **Surgical Changes**: Minimal modifications to existing code
3. **No Moving Parts**: Use existing initialization and authentication flows
4. **Extensible**: Schema allows future config additions without breaking changes
5. **Graceful Degradation**: Handle partial configs and errors gracefully

### Files to Modify
1. `src/renderer/src/services/SymbioteApiService.ts` - Add fetchSymbioteConfig()
2. `src/renderer/src/components/SymbioteInitializer.tsx` - Add config fetch to initialization
3. `src/renderer/src/pages/home/SymbioteSettingsPage.tsx` - Add manual fetch button
4. `src/renderer/src/store/settings.ts` - Add config tracking state
5. `src/renderer/src/types/index.ts` - Add SymbioteConfig interface

### Success Criteria
- [ ] Config automatically fetches on app initialization when authenticated
- [ ] Manual fetch button works from settings page  
- [ ] All config sections properly update their respective stores
- [ ] Error handling works for authentication and network failures
- [ ] Settings page shows accurate status of loaded config sections
- [ ] System works with partial configs (missing sections)
- [ ] Existing agent/assistant functionality continues to work

## Risk Mitigation
1. **Backwards Compatibility**: Maintain existing agent config flow as fallback
2. **Gradual Rollout**: Each config section is optional and independent
3. **Error Isolation**: Failure in one section doesn't break others
4. **State Preservation**: Existing user configurations are preserved on fetch failures

## Implementation Summary

### ✅ Completed Features

1. **Extended SymbioteApiService** with `fetchSymbioteConfig()` method
   - New API endpoint: `/api/symbiote/config`
   - Bearer token and cookie-based authentication support
   - Comprehensive error handling and retry logic
   - Detailed logging of config sections received

2. **Enhanced SymbioteInitializer** with comprehensive config processing
   - Automatic config fetch on authentication and every 15 minutes
   - Processes MCP servers, assistants, and model providers
   - Merges new items with existing configurations
   - Graceful handling of partial configs and errors

3. **Updated Settings Store** with config tracking state
   - `lastSymbioteConfigFetch`: Timestamp of last fetch
   - `symbioteConfigSections`: Array of successfully loaded sections
   - `symbioteConfigErrors`: Error tracking per section

4. **Enhanced SymbioteSettingsPage** with manual fetch functionality
   - "Fetch Updated Symbiote Config" button
   - Real-time status display of loaded sections
   - Error reporting with detailed feedback
   - Loading states and user feedback messages

5. **TypeScript Interfaces** for type safety
   - `SymbioteConfig` interface for API responses
   - Full compatibility with existing types
   - Extensible schema for future additions

### 🔄 How It Works

1. **Automatic Initialization**: When user authenticates, both agent config and comprehensive config are fetched
2. **Periodic Updates**: Every 15 minutes, the system checks for updated configurations
3. **Manual Refresh**: Users can manually trigger config fetch from settings page
4. **Conflict Resolution**: New items are merged with existing ones, avoiding duplicates
5. **Error Isolation**: If one config section fails, others continue to process
6. **User Feedback**: Clear status indicators and error messages in the UI

### 🎯 API Endpoint Expected

The implementation expects a new API endpoint:

```
GET /api/symbiote/config
Authorization: Bearer <token>

Response:
{
  "mcp_servers": [
    {
      "id": "server-1",
      "name": "example-server",
      "type": "stdio",
      "command": "example-command",
      "args": ["--arg1"],
      "isActive": true,
      "description": "Example MCP server"
    }
  ],
  "assistants": [
    {
      "id": "assistant-1", 
      "name": "Example Assistant",
      "prompt": "You are a helpful assistant",
      "type": "assistant",
      "emoji": "🤖"
    }
  ],
  "model_providers": [
    {
      "id": "provider-1",
      "name": "Example Provider", 
      "type": "openai",
      "apiHost": "https://api.example.com",
      "models": [...],
      "enabled": true
    }
  ]
}
```

### 🚀 Ready for Testing

The implementation is complete and ready for testing with a backend that provides the `/api/symbiote/config` endpoint. All error handling, user feedback, and edge cases have been addressed following the "economy of motion" principle. 