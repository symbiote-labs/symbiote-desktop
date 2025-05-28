# Symbiote Desktop

**Symbiote Desktop** is an AI/MCP DCC orchestrator for creative professionals, built by Symbiote Creative Labs. Think of it as "Cursor for Creatives": a powerful, extensible desktop app for managing AI tools, Model Context Protocol (MCP) servers, creative tools, and creative workflows—all in one place.

Website: [https://symbiotelabs.ai](https://symbiotelabs.ai)

---

## What is Symbiote Desktop?

Symbiote Desktop is a fork of Cherry Studio, extended to provide:
- **AI assistant orchestration**
- **MCP server management** (local, remote, and bundled)
- **Creative workflow automation**
- **Cross-platform support** (macOS, Windows, Linux)
- **Configurable, self-contained MCP server bundling**

It is designed for creative professionals who want to leverage AI and automation tools (like Blender MCP, memory servers, search, etc.) without complex setup or manual dependency management.

---

## Key Features

- **Configurable MCP Server Bundling**: Easily bundle, auto-install, and manage external MCP servers (e.g., Blender MCP) with the app.
- **Portable Python & UV**: Ships with portable Python and UV binaries for each platform—no system dependencies required.
- **Automatic First-Run Setup**: On first launch, the app ensures all dependencies and MCP servers are installed and ready.
- **Minimal Merge Conflicts**: All customizations are config-driven and modular, making it easy to keep up with upstream Cherry Studio changes.

---

## What's New in Symbiote Desktop (vs. Cherry Studio)

### 1. **Config-Driven MCP Server Bundling**
- New config file: `config/extended-mcp-servers.json`
- Define any number of external MCP servers to bundle, including install method, dependencies, and launch commands.

### 2. **Portable Dependency Management**
- Python and UV are downloaded and bundled for each platform during the build process.
- No need for users to install Python or UV globally.

### 3. **Automated After-Pack Setup**
- The build process (`scripts/after-pack.js`) ensures all portable dependencies are included in the packaged app.

### 4. **IPC and Service Integration**
- New Electron IPC channels and services for initializing, installing, and managing extended MCP servers.
- Renderer and main process communicate via new API endpoints.

---

## How to Use the Bundled MCP Server Feature

### 1. **Add or Edit MCP Servers**
- Edit `config/extended-mcp-servers.json` to add new servers or change existing ones.
- Example entry for Blender MCP:

```json
{
  "id": "blender-mcp",
  "name": "Blender MCP Server",
  "description": "MCP server for Blender integration",
  "type": "stdio",
  "installer": {
    "type": "uvx",
    "package": "blender-mcp",
    "source": "https://github.com/ahujasid/blender-mcp",
    "pythonRequired": true,
    "uvRequired": true
  },
  "config": {
    "command": "uvx",
    "args": ["blender-mcp"],
    "windowsCommand": "cmd",
    "windowsArgs": ["/c", "uvx", "blender-mcp"],
    "env": {},
    "timeout": 60
  },
  "isActive": true,
  "provider": "SymbioteDesktop"
}
```

### 2. **Build the App**
- Run the build process for your platform (e.g., `yarn build:mac:arm64` for Apple Silicon Macs).
- The build will automatically download and bundle portable Python and UV for each platform.

### 3. **First Launch**
- On first run, Symbiote Desktop will:
  - Ensure portable Python and UV are available in the app bundle.
  - Install any MCP servers defined in `extended-mcp-servers.json` (e.g., clone and install `blender-mcp`).
  - Add the servers to the built-in MCP server list for use in the app.

### 4. **Using the MCP Servers**
- MCP servers are available in the app's MCP server management UI.
- You can start, stop, and interact with them as you would with any other MCP server.
- No manual setup or dependency installation is required by the user.

---

## Advanced: Adding More MCP Servers

- To add more servers, simply add entries to `config/extended-mcp-servers.json`.
- Each server can specify its own install method, dependencies, and launch configuration.
- The system is fully extensible and cross-platform.

---

## For Developers: Keeping Up with Upstream

- All customizations are isolated in config files and modular scripts/services.
- To update from upstream Cherry Studio, merge as usual—minimal conflicts expected.
- All Symbiote-specific logic is opt-in and does not interfere with core app logic.

---

## Support & More Info

- Website: [https://symbiotelabs.ai](https://symbiotelabs.ai)
- For issues, feature requests, or contributions, please open an issue or pull request on our GitHub.

---

## Credits

- Built on Cherry Studio (https://github.com/CherryHQ/cherry-studio)
- Extended by Symbiote Creative Labs

---

**Symbiote Desktop: The creative AI/MCP orchestrator for the next generation of digital artists and makers.**
