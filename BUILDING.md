# Building Cherry Studio

This document provides instructions for building Cherry Studio for different operating systems.

## Prerequisites

- Node.js (latest LTS version recommended)
- Yarn (version 4.x, as specified in `packageManager` in `package.json`)
- Operating System Specific Build Tools:
    - **Windows**: No special tools are typically required if not building native modules from source.
    - **macOS**: Xcode Command Line Tools.
    - **Linux**: `libarchive-tools`, `fakeroot`, `dpkg` for .deb; `rpm` for .rpm; `fuse` for AppImage.

## General Build Process

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/CherryHQ/cherry-studio.git
    cd cherry-studio
    ```

2.  **Install dependencies:**
    ```bash
    yarn install
    ```

3.  **Run the build command for your target platform and architecture.**

    The general command structure is `yarn build:<platform>:<architecture>` or `npx electron-builder --<platform> --<architecture>`.

    The `electron-vite build` command is often included in the scripts and will be run automatically. This bundles the main and renderer process code. `electron-builder` then takes this output to create the distributable installers/packages.

## Platform-Specific Builds

Refer to the `scripts` section in `package.json` for the most up-to-date build commands. Here are some common examples:

### macOS

-   **Build for Apple Silicon (arm64):**
    ```bash
    yarn build:mac:arm64
    ```
    Alternatively:
    ```bash
    dotenv electron-vite build && npx electron-builder --mac --arm64
    ```

-   **Build for Intel (x64):**
    ```bash
    yarn build:mac:x64
    ```
    Alternatively:
    ```bash
    dotenv electron-vite build && npx electron-builder --mac --x64
    ```

-   **Build for both (Universal):**
    ```bash
    yarn build:mac
    ```
    Alternatively:
    ```bash
    dotenv electron-vite build && npx electron-builder --mac --arm64 --x64
    ```

### Windows

-   **Build for 64-bit Intel/AMD (x64):**
    ```bash
    yarn build:win:x64
    ```
    Alternatively:
    ```bash
    dotenv npm run build && npx electron-builder --win --x64
    ```
    *(Note: The `npm run build` in the alternative command ensures `electron-vite build` is run, which is good practice.)*


-   **Build for both x64 and arm64 (if configured and supported by native dependencies):**
    ```bash
    yarn build:win
    ```

### Linux

-   **Build for 64-bit Intel/AMD (x64):**
    ```bash
    yarn build:linux:x64
    ```
    Alternatively:
    ```bash
    dotenv electron-vite build && npx electron-builder --linux --x64
    ```

-   **Build for ARM64:**
    ```bash
    yarn build:linux:arm64
    ```
    Alternatively:
    ```bash
    dotenv electron-vite build && npx electron-builder --linux --arm64
    ```

-   **Build for both x64 and arm64:**
    ```bash
    yarn build:linux
    ```

## Output

Build artifacts (installers, packaged apps) will be located in the `dist/` directory.

## MCP (Model Context Protocol) Servers

This fork includes three additional MCP servers that are automatically installed and configured:

- **blender-mcp**: MCP server for controlling Blender 3D software
- **symbiote-unreal-mcp**: MCP server for controlling Unreal Engine
- **symbiote-mcp**: MCP server for talking to Symbiote Labs

These servers are configured in `src/renderer/src/store/mcp.ts` and will be automatically added to new installations or during migration for existing users.

### MCP Server Configuration

The MCP servers are defined in the `builtinMCPServers` array and configured to use `uvx` (Python universal executor) on macOS/Linux and appropriate command wrappers on Windows. They are set to be active by default when installed.

To modify the default MCP servers or add new ones:
1. Edit the `builtinMCPServers` array in `src/renderer/src/store/mcp.ts`
2. Add a migration step in `src/renderer/src/store/migrate.ts` for existing users
3. Update the store version in `src/renderer/src/store/index.ts`

## Troubleshooting

-   **Native Modules:** If you encounter issues related to native Node.js modules, ensure your development environment has the necessary compilers and tools (e.g., Python, C++ compiler like MSVC on Windows, Xcode Command Line Tools on macOS, build-essential on Linux). Cross-compiling native modules can sometimes be tricky, especially from macOS to Windows x64 if modules don't have prebuilt binaries for that target.
-   **`electron-builder` Configuration:** Refer to the `electron-builder.yml` file for detailed build configurations, including file inclusions/exclusions, signing, and specific target options.
-   **Dependency Issues:** Ensure `yarn install` completes without errors. If you switch branches or pull new changes, re-running `yarn install` is a good practice.
