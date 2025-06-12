# MiniApps Replacement and MCP Server Path Enhancement Plan

## Overview
This plan implements two key enhancements to the Symbiote configuration system:
1. Replace existing miniapps with content from the "miniApps" array in the config response
2. Replace "DATA_DIRECTORY_PATH_NAME" placeholders in MCP server args with actual file directory paths

## Current Architecture Analysis

### MiniApps System
- **Store**: `src/renderer/src/store/minapps.ts` - Redux store with `setMinApps` action
- **Config**: `src/renderer/src/config/minapps.ts` - Default apps with imported logos
- **Hook**: `src/renderer/src/hooks/useMinapps.ts` - `updateMinapps` function
- **Schema**: miniApps array contains `{id, name, url, logo, bordered}` where logo is a string reference

### MCP System
- **Processing**: `src/renderer/src/pages/home/SymbioteSettingsPage.tsx` - `handleFetchConfig` function
- **Store**: `src/renderer/src/store/mcp.ts` - `setMCPServers` action
- **Path Utility**: `src/main/utils/file.ts` - `getFilesDir()` function (not accessible from renderer)

## Implementation Plan

### Phase 1: Create Logo Mapping Utility
- [x] **Task 1.1**: Create `src/renderer/src/utils/logoMapping.ts`
  - Import all existing logo assets from `config/minapps.ts`
  - Create a mapping object: `logoName -> imported asset`
  - Provide fallback to `ApplicationLogo` for unknown references
  - Export `getLogo(logoName: string)` function

### Phase 2: Add File Directory Path Access
- [x] **Task 2.1**: Access to file directory path confirmed
  - ✅ `filesPath` already available via Redux store at `state.runtime.filesPath`
  - ✅ No additional IPC handlers needed
  - ✅ Path accessible from renderer via `useAppSelector((state) => state.runtime.filesPath)`

### Phase 3: Enhance Config Processing
- [x] **Task 3.1**: Create utility functions in `SymbioteSettingsPage.tsx`
  - ✅ `processMiniApps(miniApps: any[])` - Convert config miniApps to MinAppType[]
  - ✅ `processMCPServers(mcpServers: any[])` - Replace DATA_DIRECTORY_PATH_NAME placeholders
  - ✅ Access file directory path from Redux store (`state.runtime.filesPath`)

- [x] **Task 3.2**: Update `handleFetchConfig` function
  - ✅ Process miniApps from assistant config if present
  - ✅ Replace existing miniapps using `dispatch(setMinApps(processedMiniApps))`
  - ✅ Process MCP servers before setting them in store
  - ✅ Add error handling for logo mapping and path substitution

### Phase 4: Integration and Store Updates
- [x] **Task 4.1**: Update miniApps processing logic
  - ✅ Extract miniApps from first assistant in response (matching schema)
  - ✅ Convert logo string references using mapping utility
  - ✅ Maintain existing MinAppType structure
  - ✅ Log successful/failed logo mappings

- [x] **Task 4.2**: Update MCP server processing logic
  - ✅ Search for "DATA_DIRECTORY_PATH_NAME" in args arrays
  - ✅ Replace with actual path from `getFilesDir()`
  - ✅ Process before merging with existing servers
  - ✅ Maintain backward compatibility

### Phase 5: Testing and Validation
- [ ] **Task 5.1**: Test logo mapping
  - Verify known logo references resolve correctly
  - Verify unknown references fall back to default
  - Test with various logo string formats

- [ ] **Task 5.2**: Test MCP path substitution
  - Verify DATA_DIRECTORY_PATH_NAME replacement works
  - Test with multiple args containing the placeholder
  - Verify other args remain unchanged

- [ ] **Task 5.3**: Integration testing
  - Test complete config fetch and processing flow
  - Verify miniapps are replaced correctly
  - Verify MCP servers work with substituted paths
  - Test error scenarios (missing logos, path access failures)

## File Structure Changes

```
src/
├── main/
│   └── ipc.ts (add getFilesDir exposure)
├── renderer/src/
│   ├── utils/
│   │   └── logoMapping.ts (new)
│   ├── pages/home/
│   │   └── SymbioteSettingsPage.tsx (enhance config processing)
│   └── store/
│       └── minapps.ts (no changes needed)
```

## Implementation Details

### Logo Mapping Strategy
```typescript
// In logoMapping.ts
const LOGO_MAP = {
  'openai': OpenAiProviderLogo,
  'gemini': GeminiAppLogo,
  'claude': ClaudeAppLogo,
  // ... all existing logos
}

export const getLogo = (logoName: string) => {
  return LOGO_MAP[logoName] || ApplicationLogo
}
```

### MCP Path Substitution Strategy
```typescript
// In SymbioteSettingsPage.tsx
const processMCPServers = async (servers: any[]) => {
  const filesDir = await window.api.getFilesDir()
  return servers.map(server => ({
    ...server,
    args: server.args?.map(arg => 
      arg === 'DATA_DIRECTORY_PATH_NAME' ? filesDir : arg
    ) || []
  }))
}
```

### MiniApps Processing Strategy
```typescript
// In SymbioteSettingsPage.tsx
const processMiniApps = (miniApps: any[]): MinAppType[] => {
  return miniApps.map(app => ({
    id: app.id,
    name: app.name,
    url: app.url,
    logo: getLogo(app.logo),
    bordered: app.bordered || false
  }))
}
```

## Success Criteria
- [ ] MiniApps from config response completely replace existing ones
- [ ] Logo string references resolve to actual imported assets
- [ ] Unknown logo references gracefully fall back to default
- [ ] MCP servers with DATA_DIRECTORY_PATH_NAME get correct file paths
- [ ] Existing functionality remains unchanged
- [ ] Error handling prevents crashes on malformed data
- [ ] Performance impact is minimal

## Risk Mitigation
- **Logo Resolution Failures**: Fallback to ApplicationLogo prevents UI breaks
- **Path Access Failures**: Graceful degradation, log errors
- **Malformed Config Data**: Validate data structure before processing
- **Store Update Failures**: Wrap dispatch calls in try-catch blocks 