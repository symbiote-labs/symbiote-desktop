# JWT Bearer Authentication for MCP Servers - Implementation Plan

## Overview

This document outlines the step-by-step implementation to integrate JWT bearer authentication from the existing JWT API into MCP server requests. The current AuthService uses simple base64-encoded tokens, but the Flask API already provides proper JWT token endpoints.

## Current State Analysis

### ✅ What's Already Working:
- Flask API has JWT token endpoints (`/api/jwt/token`, `/api/jwt/jwks`)
- MCP servers already support bearer authentication via `authProvider.tokens()`
- AuthService has session-based authentication with the Flask API
- MCPService can add Authorization headers to requests

### 🔧 What Needs to Change:
- AuthService should get JWT tokens from `/api/jwt/token` after login
- Store JWT tokens instead of simple base64 tokens
- Provide JWT tokens to MCP servers via the existing auth infrastructure
- Handle JWT token expiration and refresh

## Implementation Steps

### Phase 1: Update AuthService to Use JWT Tokens

#### ✅ Step 1: Add JWT Token Endpoint to AuthService
- [x] Add `getJwtToken()` method to fetch JWT from `/api/jwt/token`
- [x] Update login flow to fetch JWT token after successful session login
- [x] Store JWT token in localStorage with key `symbiote_jwt_token`
- [x] Update logout to clear JWT token storage

#### ✅ Step 2: Add JWT Token Management
- [x] Add `getStoredJwtToken()` method to retrieve JWT from localStorage
- [x] Add `isJwtTokenValid()` method to check expiration
- [x] Add `refreshJwtToken()` method for token refresh
- [x] Update `isAuthenticated()` to check JWT token validity

#### ✅ Step 3: Update AuthProvider Integration
- [x] Add JWT token to AuthProvider context
- [x] Update `checkAuthStatus()` to validate JWT token
- [x] Ensure JWT token is available after successful login

### Phase 2: Create Symbiote MCP Authentication Provider

#### ✅ Step 4: Create SymbioteMcpAuthProvider
- [x] Create new file: `src/main/services/mcp/SymbioteMcpAuthProvider.ts`
- [x] Implement interface matching existing MCP auth providers
- [x] Connect to renderer AuthService via IPC to get JWT tokens
- [x] Handle token refresh and validation

#### ✅ Step 5: Add IPC Communication for JWT Tokens
- [x] Add IPC handler in main process to get JWT tokens from renderer
- [x] Update preload.ts to expose JWT token methods
- [x] Ensure secure token passing between processes

### Phase 3: Update Symbiote MCP Servers Configuration

#### ✅ Step 6: Update Built-in Symbiote MCP Servers
- [x] Update `symbiote-mcp` server configuration in `src/renderer/src/store/mcp.ts`
- [x] Remove hardcoded `HTTP_HEADER_Authorization` from env
- [x] Configure to use SymbioteMcpAuthProvider instead

#### ✅ Step 7: Update MCPService Integration
- [x] Modify MCPService to use SymbioteMcpAuthProvider for Symbiote servers
- [x] Ensure proper provider selection based on server configuration
- [x] Add logging for JWT token usage in MCP requests

### Phase 4: Handle Server Configuration and UI

#### ✅ Step 8: Update Symbiote Server Configuration
- [x] Remove manual bearer token requirements from Symbiote MCP server configs
- [x] Update SymbioteSettingsPage to show JWT authentication status
- [x] Ensure auto-configuration properly sets up authentication

#### ✅ Step 9: Add Error Handling and Recovery
- [x] Handle JWT token expiration in MCP requests
- [x] Implement automatic token refresh for MCP services
- [x] Add fallback authentication flow for expired tokens
- [x] Add proper error messages for authentication failures

### Phase 5: Testing and Validation

#### ✅ Step 10: Testing
- [x] Test JWT token retrieval after login
- [x] Test MCP server requests with JWT authentication
- [x] Test token refresh and expiration handling
- [x] Test logout and token cleanup
- [x] Test server startup with valid/invalid tokens

## File Changes Required

### New Files:
- `src/main/services/mcp/SymbioteMcpAuthProvider.ts`

### Modified Files:
- `src/renderer/src/services/AuthService.ts` - JWT token management
- `src/renderer/src/context/AuthProvider.tsx` - JWT token in context
- `src/main/preload/index.ts` - IPC methods for JWT tokens
- `src/main/main.ts` - IPC handlers for JWT tokens
- `src/main/services/MCPService.ts` - Integration with SymbioteMcpAuthProvider
- `src/renderer/src/store/mcp.ts` - Update Symbiote server configs
- `src/renderer/src/pages/home/SymbioteSettingsPage.tsx` - JWT status display

## Implementation Details

### JWT Token Flow:
1. User logs in → Session established with Flask API
2. AuthService calls `/api/jwt/token` → Receives JWT token
3. JWT token stored in localStorage
4. MCP requests use JWT token via SymbioteMcpAuthProvider
5. Token automatically refreshed when needed

### Security Considerations:
- JWT tokens stored securely in localStorage
- Tokens transmitted only over HTTPS to MCP servers
- Automatic token cleanup on logout
- Proper error handling for expired/invalid tokens

### Architecture Benefits:
- Leverages existing JWT infrastructure
- No changes to Flask API required
- Minimal changes to existing auth flow
- Reuses existing MCP auth provider pattern
- Economy of motion - surgical changes only

## Success Criteria

- [x] JWT tokens properly retrieved and stored after login
- [x] Symbiote MCP servers authenticate with JWT tokens
- [x] Token refresh works automatically
- [x] Logout properly cleans up JWT tokens
- [x] Error handling for authentication failures
- [x] No manual bearer token configuration required
- [x] UI shows JWT authentication status

## Implementation Summary

✅ **COMPLETED**: JWT Bearer Authentication for MCP Servers has been successfully implemented!

### What Was Implemented:

1. **Enhanced AuthService**: Added JWT token management with automatic refresh and validation
2. **Updated AuthProvider**: Integrated JWT token access into the authentication context
3. **SymbioteMcpAuthProvider**: Created a new authentication provider specifically for Symbiote MCP servers
4. **MCPService Integration**: Modified to automatically use JWT authentication for Symbiote servers
5. **UI Updates**: Added JWT token status display in SymbioteSettingsPage
6. **Configuration Updates**: Removed hardcoded bearer tokens from Symbiote MCP server configs
7. **Error Handling**: Comprehensive token validation, expiration handling, and automatic refresh

### Key Features:

- **Automatic Authentication**: Symbiote MCP servers now automatically authenticate using JWT tokens
- **Token Management**: Secure token storage, validation, and automatic refresh
- **Seamless Integration**: No manual configuration required - works automatically after login
- **Backward Compatibility**: Existing OAuth-based MCP servers continue to work unchanged
- **Real-time Status**: UI shows current JWT authentication status
- **Error Recovery**: Graceful handling of expired tokens with automatic refresh

### Architecture Benefits:

- **Economy of Motion**: Leverages existing JWT infrastructure from the Flask API
- **Surgical Changes**: Minimal modifications to existing codebase
- **Reusable Patterns**: Uses established MCP authentication provider pattern
- **Security**: Proper JWT token validation and secure storage
- **Maintainability**: Clean separation of concerns and well-documented code

## Notes

- This implementation follows the "economy of motion" principle by reusing existing patterns
- No new dependencies required - uses existing JWT and MCP infrastructure
- Maintains backward compatibility with existing authentication
- Follows the repository's coding standards and architecture patterns 