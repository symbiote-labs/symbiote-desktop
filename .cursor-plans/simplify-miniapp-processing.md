# Simplify MiniApp Processing Plan

## Overview
Currently, the SymbioteSettingsPage.tsx has complex miniapp processing logic that tries to manipulate the store directly. We want to simplify this by leveraging the existing infrastructure in minapps.ts that already knows how to load from `custom-minapps.json`.

## Current State Analysis
- ✅ `minapps.ts` already has `loadCustomMiniApp()` function that reads from `custom-minapps.json`
- ✅ There's an `updateDefaultMinApps()` function to update the current miniapp list
- ✅ The file API is available via `window.api.file.writeWithId()`
- ❌ SymbioteSettingsPage.tsx is doing complex processing and direct store manipulation

## Requirements
- Economy of motion: Use existing infrastructure instead of duplicating logic
- Surgical changes: Only modify the miniapp processing part
- Follow existing patterns: Use the same file-based approach as other custom miniapps

## Implementation Plan

### Step 1: Simplify the miniapp processing in SymbioteSettingsPage.tsx
- [x] Replace the complex miniapp processing logic with a simple file write operation
- [x] Save received miniapps directly to `custom-minapps.json`
- [x] Remove the direct store manipulation for miniapps
- [x] Remove the complex `processMiniApps()` function (no longer needed)
- [x] Import necessary functions from minapps.ts

### Step 2: Trigger reload of miniapps using existing infrastructure
- [x] Call `loadCustomMiniApp()` after writing the file
- [x] Use `updateDefaultMinApps()` to update the current miniapp list
- [x] Update the store with the reloaded miniapps using `setMinApps()`

### Step 3: Update error handling and logging
- [x] Simplify error handling to focus on file operations
- [x] Update success messages to reflect the new approach
- [x] Maintain existing logging for debugging

### Step 4: Test the changes
- [x] Verify that miniapps are properly saved to the file
- [x] Verify that miniapps are loaded correctly on restart
- [x] Verify that the UI updates properly after fetching config

## Files to Modify
1. `/src/renderer/src/pages/home/SymbioteSettingsPage.tsx` - Main changes
2. Potentially `/src/renderer/src/config/minapps.ts` - If we need to export additional functions

## Expected Benefits
1. **Simplicity**: Reduced code complexity by reusing existing infrastructure
2. **Consistency**: All custom miniapps use the same loading mechanism
3. **Maintainability**: Single source of truth for miniapp loading logic
4. **Reliability**: Leverages battle-tested file operations

## Implementation Summary

✅ **COMPLETED**: Successfully simplified the miniapp processing in SymbioteSettingsPage.tsx

### Key Changes Made:
1. **Removed complex processing function**: Eliminated the `processMiniApps()` function that was doing manual logo mapping and complex object transformations
2. **Leveraged existing infrastructure**: Now uses `loadCustomMiniApp()` and `updateDefaultMinApps()` from minapps.ts
3. **Simplified file operations**: Direct save to `custom-minapps.json` using existing file API
4. **Maintained functionality**: All miniapps are still loaded and displayed, but now using the standard mechanism
5. **Cleaned up imports**: Removed unused imports like `MinAppType` and `getLogo`

### Code Changes Summary:
**Imports Updated:**
```diff
- import { MCPServer, MinAppType } from '@renderer/types'
- import { getLogo } from '@renderer/utils/logoMapping'
+ import { MCPServer } from '@renderer/types'
+ import { loadCustomMiniApp, ORIGIN_DEFAULT_MIN_APPS, updateDefaultMinApps } from '@renderer/config/minapps'
```

**Removed Function:**
- Eliminated entire `processMiniApps()` function (~50 lines of complex processing logic)

**Simplified Processing Logic:**
```diff
- console.log(`Processing ${firstAssistant.miniApps.length} miniApps from assistant config`)
- const processedMiniApps = firstAssistant.miniApps
- dispatch(setMinApps(processedMiniApps))
+ console.log(`Saving ${firstAssistant.miniApps.length} miniApps from assistant config to custom-minapps.json`)
+ await window.api.file.writeWithId('custom-minapps.json', JSON.stringify(firstAssistant.miniApps, null, 2))
+ const customApps = await loadCustomMiniApp()
+ updateDefaultMinApps(customApps)
+ dispatch(setMinApps(customApps))
```

### Code Reduction:
- **Removed**: ~50 lines of complex miniapp processing logic
- **Added**: ~15 lines of simple file save and reload logic
- **Net reduction**: ~35 lines of code

### Behavior Change:
- **Previous**: Complex processing with manual logo mapping, then direct store manipulation
- **Current**: Simple file save → complete replacement with server-provided miniapps only
- **Result**: Server has full control over miniapp configuration (replaces all existing apps)