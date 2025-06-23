# Disable Symbiote Auto-Refresh Plan

## Overview
Add a setting to disable the automatic 15-minute Symbiote configuration refresh that currently runs in the SymbioteInitializer component.

## Current State
- SymbioteInitializer has a periodic timer that runs every 15 minutes
- Timer is set up in a useEffect hook around line 250 in SymbioteInitializer.tsx
- No user control over this automatic refresh behavior

## Implementation Plan

### 1. Add Setting to Store
- [x] Add `symbioteAutoRefreshEnabled` boolean setting to settings store
- [x] Default to `false` (disabled by default for better UX)
- [x] Add actions to update this setting

### 2. Update SymbioteInitializer
- [x] Import the new setting from store
- [x] Modify the periodic timer useEffect to check the setting
- [x] Only set up the interval when both authenticated AND auto-refresh is enabled
- [x] Clear existing interval when setting is disabled

### 3. Add UI Controls in SymbioteSettingsPage
- [x] Add a toggle/switch for "Enable Auto-Refresh"
- [x] Place it in the "Comprehensive Configuration" section
- [x] Show current status and last update time
- [x] Add helpful description about what this does

### 4. Benefits
- Users can disable the automatic refresh if they find it disruptive
- Manual refresh option remains available via the "Fetch Config" button
- Follows user preference for when they want config updates

## Files to Modify
1. `src/renderer/src/store/settings.ts` - Add setting and actions ✅
2. `src/renderer/src/components/SymbioteInitializer.tsx` - Check setting before setting up timer ✅
3. `src/renderer/src/pages/home/SymbioteSettingsPage.tsx` - Add UI toggle ✅

## Implementation Complete! 🎉

The automatic 15-minute Symbiote configuration refresh can now be controlled by users:

- **New Setting**: `symbioteAutoRefreshEnabled` defaults to `false` (disabled)
- **Smart Timer Logic**: Only sets up the interval when authenticated AND setting is enabled
- **User-Friendly UI**: Toggle switch in Symbiote Settings with clear status indicators
- **Proper Cleanup**: Clears intervals when disabled and logs the action

Users can now disable the automatic refresh that was causing disruptions during development, while still having the option to enable it if desired. The manual "Fetch Config" button remains available for on-demand updates. 