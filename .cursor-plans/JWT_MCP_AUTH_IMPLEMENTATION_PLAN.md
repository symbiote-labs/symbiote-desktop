# JWT MCP Authentication Implementation Plan

## Overview

This document outlines the implementation plan for adding proper JWT authentication support to MCP (Model Context Protocol) providers in the Symbiote Desktop application. Currently, the `SymbioteMcpAuthProvider` incorrectly implements the `OAuthClientProvider` interface while using JWT tokens, causing errors when OAuth flow methods are called.

## Problem Statement

1. **Current Issue**: `SymbioteMcpAuthProvider` implements `OAuthClientProvider` but throws errors on OAuth methods like `redirectToAuthorization`
2. **Architecture Problem**: JWT authentication is forced into OAuth interface patterns
3. **Error Manifestation**: "JWT authentication does not require OAuth flow" error when MCP servers try to initiate OAuth flows

## Solution Architecture

### Core Strategy: Separation of Concerns
- Create a dedicated JWT authentication provider that doesn't implement OAuth interfaces
- Keep existing OAuth provider unchanged
- Create a unified auth provider factory/wrapper to choose between JWT and OAuth
- Minimal changes to existing MCP service code

### Key Principles
- **Economy of Motion**: Reuse existing patterns and minimize code changes
- **Surgical Changes**: Only modify what's necessary
- **No Breaking Changes**: Existing OAuth functionality remains intact
- **Type Safety**: Proper TypeScript interfaces and type guards

## Implementation Plan

### Phase 1: Create JWT Authentication Infrastructure

#### Task 1.1: Create JWT Provider Interface
- [x] Create `src/main/services/mcp/jwt/types.ts`
- [x] Define `JwtAuthProvider` interface (NOT extending `OAuthClientProvider`)
- [x] Define `JwtProviderOptions` interface
- [x] Add proper TypeScript types for JWT-specific functionality

#### Task 1.2: Implement JWT MCP Authentication Provider  
- [x] Create `src/main/services/mcp/jwt/provider.ts`
- [x] Implement `JwtMcpAuthProvider` class
- [x] Copy JWT logic from existing `SymbioteMcpAuthProvider` 
- [x] Remove OAuth interface implementations
- [x] Add proper JWT token validation and caching
- [x] Implement renderer communication for token fetching

#### Task 1.3: Create Authentication Provider Factory
- [x] Create `src/main/services/mcp/auth/factory.ts`
- [x] Implement `createAuthProvider()` function
- [x] Add logic to determine auth type (OAuth vs JWT)
- [x] Return appropriate provider based on server configuration
- [x] Add proper TypeScript union types

### Phase 2: Integrate with MCP Service

#### Task 2.1: Update MCP Service Integration
- [x] Modify `src/main/services/MCPService.ts`
- [x] Replace direct provider instantiation with factory
- [x] Update transport initialization to handle both auth types
- [x] Modify `handleAuth` function to support JWT providers
- [x] Add proper type guards for JWT vs OAuth providers

#### Task 2.2: Update Transport Configuration
- [x] Update SSE transport configuration for JWT auth
- [x] Update StreamableHTTP transport configuration for JWT auth
- [x] Ensure JWT tokens are properly included in Authorization headers
- [x] Handle token refresh scenarios

### Phase 3: Clean Up and Testing

#### Task 3.1: Remove Deprecated Implementation
- [x] Delete or deprecate `SymbioteMcpAuthProvider`
- [x] Update imports across the codebase
- [x] Add migration notes if needed

#### Task 3.2: Add Configuration Support
- [x] Update MCP server configuration to specify auth type
- [x] Add UI support for JWT vs OAuth selection (auto-detection implemented)
- [x] Update settings validation

#### Task 3.3: Testing and Validation
- [x] Test JWT authentication with Symbiote servers
- [x] Test OAuth authentication with third-party servers  
- [x] Verify no regressions in existing functionality
- [x] Test error handling and edge cases

## File Structure

```
src/main/services/mcp/
├── auth/
│   ├── factory.ts          # Auth provider factory
│   └── types.ts           # Common auth types
├── jwt/
│   ├── provider.ts        # JWT authentication provider
│   └── types.ts          # JWT-specific types
├── oauth/
│   ├── provider.ts        # Existing OAuth provider (unchanged)
│   ├── callback.ts        # Existing OAuth callback (unchanged)
│   ├── storage.ts         # Existing OAuth storage (unchanged)
│   └── types.ts          # Existing OAuth types (unchanged)
└── SymbioteMcpAuthProvider.ts  # To be deprecated
```

## Implementation Details

### JWT Provider Interface

```typescript
// src/main/services/mcp/jwt/types.ts
export interface JwtAuthProvider {
  tokens(): Promise<{ access_token: string; token_type: string } | undefined>
  clearCache(): void
}

export interface JwtProviderOptions {
  serverUrlHash: string
  tokenCacheDuration?: number
}
```

### Authentication Factory

```typescript
// src/main/services/mcp/auth/factory.ts
export type AuthProvider = OAuthClientProvider | JwtAuthProvider

export function createAuthProvider(
  serverConfig: MCPServer
): AuthProvider {
  const isSymbioteServer = detectSymbioteServer(serverConfig)
  
  if (isSymbioteServer) {
    return new JwtMcpAuthProvider({
      serverUrlHash: createServerHash(serverConfig.baseUrl)
    })
  } else {
    return new McpOAuthClientProvider({
      serverUrlHash: createServerHash(serverConfig.baseUrl)
      // ... other OAuth options
    })
  }
}

export function isJwtProvider(provider: AuthProvider): provider is JwtAuthProvider {
  return 'clearCache' in provider && !('redirectToAuthorization' in provider)
}
```

### Updated MCP Service Integration

```typescript
// In MCPService.ts
import { createAuthProvider, isJwtProvider } from './mcp/auth/factory'

const authProvider = createAuthProvider(server)

const handleAuth = async (client: Client, transport: SSEClientTransport | StreamableHTTPClientTransport) => {
  if (isJwtProvider(authProvider)) {
    Logger.info(`[MCP] JWT authentication handled automatically: ${server.name}`)
    return // JWT tokens are automatically included in transport headers
  }
  
  // Existing OAuth flow code...
}
```

## Risk Mitigation

### Backward Compatibility
- Existing OAuth providers continue to work unchanged
- Server detection logic maintains current behavior
- Configuration format remains compatible

### Error Handling
- Graceful fallback for authentication failures
- Clear error messages for configuration issues
- Proper logging for debugging

### Type Safety
- Strong TypeScript interfaces prevent runtime errors
- Type guards ensure correct provider usage
- Compile-time validation of provider assignments

## Testing Strategy

1. **Unit Tests**: Test JWT provider in isolation
2. **Integration Tests**: Test with real Symbiote servers
3. **Regression Tests**: Verify OAuth providers still work
4. **Error Scenarios**: Test invalid tokens, network failures, etc.

## Deployment Strategy

1. **Phase 1**: Deploy JWT infrastructure (non-breaking)
2. **Phase 2**: Update MCP service to use factory (minimal risk)
3. **Phase 3**: Remove deprecated code (cleanup)

## Success Criteria

- [x] No more "JWT authentication does not require OAuth flow" errors
- [x] Symbiote MCP servers authenticate successfully with JWT
- [x] Third-party MCP servers continue to work with OAuth
- [x] No breaking changes to existing functionality
- [x] Clean separation of JWT and OAuth authentication logic
- [x] Proper TypeScript types throughout

## Notes

- Follow existing code patterns in the repository
- Use existing logging patterns with `electron-log`
- Maintain existing error handling patterns
- Follow repository naming conventions
- Ensure all new code includes proper TypeScript types
- Add comprehensive JSDoc comments for public APIs 