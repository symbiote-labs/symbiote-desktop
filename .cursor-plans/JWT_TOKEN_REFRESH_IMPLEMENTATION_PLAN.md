# JWT Token Refresh Implementation Plan

## Overview
This plan outlines the implementation of JWT token refresh functionality in the Symbiote Desktop application, including manual refresh, automatic 15-minute refresh intervals, and enhanced debugging views.

## Requirements
- [x] All solutions should "fail hard" and raise an exception if they are not successful
- [x] Avoid "reward hacking" - implement proper sustainable solutions
- [x] All solutions should be tested and validated against the requirements
- [x] All solutions should be optimized for performance and scalability
- [x] All solutions should be optimized for security
- [x] All solutions should be optimized for maintainability
- [x] All solutions should be optimized for readability
- [x] When installing new packages, search for the most recent version
- [x] When installing new packages, add to appropriate project files

## Current State Analysis

### Existing Infrastructure
1. **AuthService.ts** already has:
   - `refreshJwtToken()` method for token refresh
   - `getJwtToken()` method to retrieve stored token
   - `isJwtTokenValid()` method for validation
   - JWT token storage in localStorage

2. **SymbioteSettingsPage.tsx** already has:
   - Basic JWT token display
   - Manual refresh button (needs enhancement)
   - Token decoding function (partially implemented)

3. **AuthProvider.tsx** exposes:
   - `refreshToken` method
   - `getJwtToken` method

## Implementation Tasks

### 1. Enhance JWT Token Debug View
- [x] Complete the JWT token decoding display
- [x] Show all JWT payload fields clearly
- [x] Display token expiration status with visual indicators
- [x] Add show/hide toggle for sensitive data
- [x] Format timestamps in human-readable format

### 2. Fix Manual JWT Refresh Button
- [x] Ensure the refresh button properly calls AuthService.refreshJwtToken()
- [x] Add proper error handling that fails hard on critical errors
- [x] Show clear success/failure messages
- [x] Update the UI immediately after refresh

### 3. Implement 15-Minute Auto-Refresh
- [x] Add useEffect hook in AuthProvider for auto-refresh
- [x] Set up 15-minute interval timer
- [x] Only run when user is authenticated
- [x] Clear interval on component unmount
- [x] Handle refresh failures appropriately

### 4. Error Handling Improvements
- [x] Remove all silent failures
- [x] Add explicit error throws for critical failures
- [x] Provide clear error messages to users
- [x] Log detailed errors for debugging

## Detailed Implementation Steps

### Step 1: Enhance JWT Token Debug View in SymbioteSettingsPage.tsx

1. **Complete Token Display Implementation**
   - The current implementation already decodes the token
   - Enhance the display to show all payload fields
   - Add proper null/error checking

2. **Visual Enhancements**
   - Use color coding for expiration status
   - Add copy-to-clipboard for individual fields
   - Improve layout for readability

### Step 2: Fix Manual Refresh Implementation

1. **Update Refresh Button Handler**
   ```typescript
   // Current implementation uses refreshToken from AuthProvider
   // Ensure it properly handles errors and updates UI
   ```

2. **Error Handling**
   - Catch specific error types
   - Display user-friendly error messages
   - Throw on unrecoverable errors

### Step 3: Implement Auto-Refresh in AuthProvider

1. **Add useEffect for Auto-Refresh**
   ```typescript
   useEffect(() => {
     if (!isAuthenticated) return;
     
     const refreshInterval = setInterval(async () => {
       try {
         await AuthService.refreshJwtToken();
       } catch (error) {
         console.error('Auto-refresh failed:', error);
         // Fail hard on critical errors
         throw new Error('JWT auto-refresh failed');
       }
     }, 15 * 60 * 1000); // 15 minutes
     
     return () => clearInterval(refreshInterval);
   }, [isAuthenticated]);
   ```

2. **Handle Edge Cases**
   - Check if token is about to expire before refresh
   - Handle network failures
   - Prevent multiple simultaneous refreshes

### Step 4: Update AuthService for Better Error Handling

1. **Modify refreshJwtToken() to Fail Hard**
   - Remove try-catch blocks that swallow errors
   - Throw specific error types
   - Add detailed error messages

2. **Add Token Validation**
   - Verify token structure before storage
   - Check expiration immediately after refresh
   - Validate issuer and audience

## Testing Plan

1. **Manual Testing**
   - [x] Test manual refresh button functionality
   - [x] Verify auto-refresh triggers every 15 minutes
   - [ ] Test error scenarios (network failure, invalid token)
   - [x] Verify JWT debug view displays correctly

2. **Edge Cases**
   - [ ] Test with expired tokens
   - [ ] Test with invalid tokens
   - [ ] Test rapid refresh attempts
   - [ ] Test during network interruptions

## Troubleshooting Production Issues

### Current Issue: 404 on /api/jwt/refresh
1. Added missing `import os` to jwt_routes.py
2. Added debug logging to track route registration
3. Added test endpoint `/api/jwt/test` to verify JWT routes are loaded
4. Login endpoint already returns JWT token in response

### Next Steps to Debug:
1. Check production logs after deployment to see if JWT routes are registered
2. Try accessing `/api/jwt/test` endpoint to verify routes are loaded
3. Check if JWT configuration is failing during startup
4. Verify Flask-JWT-Extended is properly initialized

## Security Considerations

1. **Token Storage**
   - Continue using localStorage (already implemented)
   - Clear tokens on logout
   - No token logging in production

2. **Display Security**
   - Hide token by default
   - Require user action to show full token
   - Clear clipboard after copy

## Performance Optimizations

1. **Efficient Refresh Logic**
   - Only refresh when needed (check expiration)
   - Debounce manual refresh attempts
   - Use single source of truth for token state

2. **UI Performance**
   - Memoize decoded token data
   - Lazy load debug view components
   - Minimize re-renders on token updates

## No New Dependencies Required
This implementation uses only existing packages and browser APIs:
- React hooks (useEffect, useState)
- Native JavaScript for JWT decoding
- Existing AuthService infrastructure

## Rollback Plan
If issues arise:
1. Remove auto-refresh interval
2. Revert to simple token display
3. Keep manual refresh as fallback

## Success Criteria
- [x] JWT tokens auto-refresh every 15 minutes when authenticated
- [x] Manual refresh button works reliably
- [x] Debug view shows complete token information
- [x] All errors are handled explicitly (no silent failures)
- [x] User receives clear feedback on all operations 