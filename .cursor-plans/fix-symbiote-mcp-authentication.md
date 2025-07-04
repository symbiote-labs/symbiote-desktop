# Fix Symbiote MCP Authentication Issue

## Problem
The `symbiote-mcp` server is not returning tools, which indicates it can't connect to the MCP server. This is likely because the JWT token isn't being sent along with the MCP requests for authentication.

## Analysis
1. The `symbiote-mcp` server is configured as `streamableHttp` type
2. It needs to authenticate with the remote MCP server using JWT Bearer tokens
3. The JWT token is available in the client but not being passed to the MCP server configuration
4. The FastMCP server needs to validate the JWT tokens

## Solution Steps

### 1. Update MCP Server Configuration to Include Authentication
- [x] Modify the assistant configuration in `SymbioteSettingsPage.tsx` to include authentication for the `symbiote-mcp` server
- [x] Add JWT token to the MCP server configuration dynamically

### 2. Update MCPService to Handle JWT Authentication
- [x] Ensure the `MCPService.ts` properly handles JWT authentication for streamableHttp servers
- [x] Add logic to get JWT token from the auth context and pass it to the MCP server

### 3. Configure FastMCP Server for JWT Validation
- [x] The MCP server should be configured to validate JWT tokens using FastMCP Bearer auth
- [x] Ensure the JWKS endpoint is accessible for token validation

### 4. Add Dynamic JWT Token Injection
- [x] Create a mechanism to inject the current JWT token into MCP server configurations
- [x] Handle token refresh scenarios

### 5. Testing
- [ ] Test the authentication flow
- [ ] Verify that tools are returned from the symbiote-mcp server
- [ ] Test token refresh scenarios

## Implementation Order
1. First, update the MCP server configuration to include JWT authentication
2. Update the MCPService to handle JWT tokens properly
3. Test the authentication flow
4. Add dynamic token refresh handling

## Implementation Summary

### Changes Made:

1. **MCPService.ts** - Updated `streamableHttp` transport initialization to inject JWT tokens:
   - Added JWT token retrieval for `streamableHttp` servers using `JwtMcpAuthProvider`
   - JWT tokens are now added to the `Authorization` header as `Bearer <token>`
   - This matches the existing pattern used for SSE transport

2. **JWT Provider** - Enhanced `JwtMcpAuthProvider` to reliably get JWT tokens:
   - Improved token retrieval with multiple fallback methods
   - Added support for `window.__AUTH_CONTEXT__` for main process access
   - Enhanced localStorage access with proper error handling

3. **AuthProvider.tsx** - Added token exposure mechanism:
   - JWT tokens are now exposed to `window.__AUTH_CONTEXT__` when authenticated
   - This allows the main process to access tokens reliably
   - Tokens are cleared when user logs out

4. **IPC Channels** - Added dedicated auth IPC methods:
   - Added `Auth_GetJwtToken` IPC channel for main process to get tokens
   - Added `Auth_RefreshJwtToken` IPC channel for token refresh
   - Enhanced preload script with `getJwtTokenViaIpc` method

5. **Auth Factory** - JWT detection logic:
   - `symbiote-mcp` servers are correctly detected as JWT providers
   - Based on provider='Symbiote' or name containing 'symbiote'
   - Creates `JwtMcpAuthProvider` for these servers

### Expected Result:
The `symbiote-mcp` server should now:
- Be detected as a JWT provider by the auth factory
- Have JWT tokens automatically injected into HTTP headers
- Successfully authenticate with the FastMCP server using Bearer tokens
- Return tools instead of empty responses

### Testing:
To test this fix:
1. Ensure you're authenticated in Symbiote Desktop
2. Check that a JWT token is available in localStorage (`symbiote_jwt_token`)
3. Try using the `symbiote-mcp` server - it should now return tools
4. Check the logs for JWT token injection messages in MCPService