# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Symbiote Desktop is an AI/MCP (Model Context Protocol) orchestrator for creative professionals, built as a fork of Cherry Studio. It's an Electron desktop application using React, TypeScript, and modern web technologies to provide AI assistant orchestration, MCP server management, and creative workflow automation.

## Common Development Commands

### Build & Development
```bash
# Development server with hot reload
npm run dev

# TypeScript type checking
npm run typecheck
npm run typecheck:web
npm run typecheck:node

# Testing
npm run test                    # Run all tests
npm run test:renderer          # Run renderer tests only
npm run test:main              # Run main process tests only
npm run test:e2e               # End-to-end tests with Playwright
npm run test:watch             # Watch mode for tests

# Code quality
npm run lint                   # Lint and fix code
npm run format                 # Format code with Prettier

# Building for production
npm run build                  # Full build with type checking
npm run build:unpack           # Build without packaging
npm run build:mac              # macOS builds (both architectures)
npm run build:win              # Windows builds (both architectures)
npm run build:linux            # Linux builds (both architectures)
```

### Testing Single Components
```bash
# Run tests for specific files or patterns
npx vitest run src/renderer/src/components/__tests__/ComponentName.test.tsx
npx vitest run --project renderer
npx vitest run --project main
```

## High-Level Architecture

### Electron Multi-Process Architecture
- **Main Process** (`src/main/`): Node.js environment handling system operations, IPC, and window management
- **Renderer Process** (`src/renderer/`): React application running in Chromium environment
- **Preload Scripts** (`src/preload/`): Secure bridge between main and renderer processes

### Key Architectural Components

#### State Management
- **Redux Toolkit** with Redux Persist for global state
- **React Query** (@tanstack/react-query) for server state management
- **Dexie** for local IndexedDB storage
- **Electron Store** for persistent configuration

#### MCP Server Integration
- Custom MCP server bundling system in `src/main/mcpServers/`
- Portable Python and UV binaries for cross-platform MCP server execution
- Automatic first-run setup and dependency management
- Support for both local and remote MCP servers

#### Multi-Window System
Four distinct window types with separate HTML entry points:
- **Main Window**: Primary application interface (`src/renderer/index.html`)
- **Mini Window**: Compact chat interface (`src/renderer/miniWindow.html`)
- **Selection Toolbar**: Text selection assistant (`src/renderer/selectionToolbar.html`)
- **Selection Action**: Quick actions overlay (`src/renderer/selectionAction.html`)

#### Authentication & User Management
- Symbiote-specific authentication system (fork customization)
- Custom user popup and registration components
- Session management with secure token storage

### Path Aliases
- `@renderer` → `src/renderer/src`
- `@main` → `src/main`
- `@shared` → `packages/shared`
- `@types` → `src/renderer/src/types`

### Core Services Architecture
- **WindowService**: Centralized window lifecycle management
- **MCPService**: Model Context Protocol server orchestration
- **ProxyManager**: Network proxy configuration
- **FileStorage**: Cross-platform file operations
- **CacheService**: Application-level caching
- **NotificationService**: System notifications

## Important Development Patterns

### Fork-Specific Customizations
- All Symbiote customizations use **new components** instead of modifying existing Cherry Studio components
- Configuration-driven changes to minimize merge conflicts with upstream
- Isolated authentication system with custom user management
- MCP server bundling system is entirely additive

### Component Development
- Use functional components with hooks
- Styled-components for CSS-in-JS styling
- Ant Design components with custom theming
- Proper TypeScript interfaces for all props

### IPC Communication Patterns
```typescript
// Renderer to Main (async)
const result = await window.api.invoke('channel-name', data)

// Renderer to Main (fire-and-forget)
window.api.send('channel-name', data)

// Main to Renderer
webContents.send('channel-name', data)
```

### Testing Strategy
- **Unit Tests**: Vitest with Testing Library for React components
- **Integration Tests**: Vitest workspace configuration for main/renderer separation  
- **E2E Tests**: Playwright for cross-platform testing
- **Coverage**: V8 provider with comprehensive exclusions

### Build Configuration
- **Electron Vite** for build tooling with React SWC
- **Rollup** for bundling with external dependency handling
- **TypeScript** strict mode with separate configs for main/renderer/node
- **Bundle analysis** with rollup-plugin-visualizer

## Symbiote-Specific Features

### MCP Server Bundling
- Configuration in `config/extended-mcp-servers.json`
- Automatic installation of Python dependencies via portable UV
- Cross-platform binary management in `resources/python-portable/`
- Server lifecycle management through `MCPInitializer.tsx`

### Authentication System
- Custom login/registration flows
- Secure token management
- Protected route system
- User session persistence

### Creative Workflow Integration
- AI assistant orchestration
- File processing pipeline with multiple format support
- Knowledge base management with embedding system
- Visual tools for creative professionals

## Development Notes

### Upstream Merge Strategy
- Regular merges from Cherry Studio to stay current
- Minimal conflicts due to isolated customization approach
- Pre-merge testing with `npm run build:check`
- Automated conflict resolution documentation in SYMBIOTE.md

### Code Quality Standards
- ESLint with React and TypeScript rules
- Prettier for consistent formatting
- Husky git hooks for pre-commit quality checks
- Strict TypeScript configuration

### Platform-Specific Considerations
- Electron Builder configuration for multi-platform builds
- Native dependencies handled via electron-rebuild
- Platform-specific binary bundling for MCP servers
- Cross-platform file path handling

### Performance Optimizations
- Code splitting with dynamic imports
- Worker threads for heavy computations
- Bundle optimization with tree shaking
- Memory management with proper cleanup patterns