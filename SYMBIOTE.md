# Symbiote Desktop

**Symbiote Desktop** is an AI/MCP DCC orchestrator for creative professionals, built by Symbiote Creative Labs. Think of it as "Cursor for Creatives": a powerful, extensible desktop app for managing AI tools, Model Context Protocol (MCP) servers, creative tools, and creative workflows—all in one place.

Website: [https://symbiotelabs.ai](https://symbiotelabs.ai)

---

## What is Symbiote Desktop?

Symbiote Desktop is a fork of Cherry Studio, extended to provide:
- **AI assistant orchestration**
- **MCP server management** (local, remote, and bundled)
- **Creative workflow automation**
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

---

## How to Use the Bundled MCP Server Feature

### 1. **First Launch**
- On first run, Symbiote Desktop will:
  - Ensure portable Python and UV are available in the app bundle.
  - Install all of Symbiote's servers in MCPInitializer.tsx

### 4. **Using the MCP Servers**
- MCP servers are available in the app's MCP server management UI.
- You can start, stop, and interact with them as you would with any other MCP server.
- No manual setup or dependency installation is required by the user.

---

## For Developers: Keeping Up with Upstream

- All customizations are isolated in config files and modular scripts/services.
- To update from upstream Cherry Studio, merge as usual—minimal conflicts expected.
- All Symbiote-specific logic is opt-in and does not interfere with core app logic.

---

## Upstream Merging Best Practices

This section outlines the best practices for merging upstream changes from Cherry Studio into our Symbiote Desktop fork while preserving our customizations and minimizing conflicts.

### Overview

Our fork strategy prioritizes **minimal merge conflicts** through:
- **Component isolation**: All Symbiote features use new components instead of modifying existing ones
- **Configuration-driven changes**: Customizations are config-based rather than code modifications
- **Strategic file placement**: New files are placed in dedicated directories to avoid upstream conflicts

### Pre-Merge Strategy: Creating New Components

To minimize future merge conflicts, we create **new components** for every UI change instead of modifying existing Cherry Studio components:

- ✅ **Good**: Create `SymbioteUserPopup.tsx` instead of modifying `UserPopup.tsx`
- ✅ **Good**: Create `auth/Login.tsx` and `auth/Register.tsx` as new components
- ✅ **Good**: Add new configuration files in dedicated directories
- ❌ **Avoid**: Direct modifications to existing Cherry Studio components

This strategy significantly reduces conflicts because:
- Upstream changes to existing files won't conflict with our new files
- Our customizations remain isolated and easy to identify
- Future merges become mostly additive rather than conflicting

### Merge Process

#### 1. Preparation

Before starting the merge process:

```bash
# Ensure you're on main branch
git checkout main

# Check current status
git status

# Set merge strategy to preserve history
git config pull.rebase false
```

#### 2. Add/Update Upstream Remote

If not already configured, add the upstream remote:

```bash
git remote add upstream https://github.com/CherryHQ/cherry-studio.git
```

Verify remotes:
```bash
git remote -v
# Should show:
# origin     git@github.com:symbiotelabs/symbiote-desktop.git (fetch/push)
# upstream   https://github.com/CherryHQ/cherry-studio.git (fetch/push)
```

#### 3. Sync with Our Origin

First, ensure your local main is in sync with your fork:

```bash
git pull origin main
```

#### 4. Fetch Upstream Changes

```bash
git fetch upstream
```

#### 5. Merge Upstream

```bash
git merge upstream/main
```

This will either:
- **Success**: Clean merge with no conflicts
- **Conflicts**: Git will stop and list conflicted files

#### 6. Resolve Conflicts (if any)

When conflicts occur:

1. **Review conflicted files**:
   ```bash
   git status
   ```

2. **Manually resolve each conflict**:
   - Open each conflicted file
   - Look for conflict markers: `<<<<<<<`, `=======`, `>>>>>>>`
   - Decide which changes to keep (usually both, but strategically combined)
   - Remove conflict markers

3. **Stage resolved files**:
   ```bash
   git add <resolved-file>
   ```

4. **Complete the merge**:
   ```bash
   git commit -m "Merge upstream/main into main

   - Merged latest changes from CherryHQ/cherry-studio
   - Preserved all Symbiote authentication and branding changes
   - Resolved conflicts in [list major files]
   - [Brief description of major changes integrated]"
   ```

#### 7. Push Changes

```bash
git push origin main
```

#### 8. Fix TypeScript/Linting Errors

After merging, check for any TypeScript or linting errors:

```bash
npm run typecheck:web
```

If there are errors:
- Fix import issues (remove unused imports)
- Install any new required dependencies: `yarn add <package-name>`
- Fix any API changes or type mismatches
- Commit and push fixes

### Conflict Resolution Strategies

#### Common Conflict Types

1. **Enum/Type Updates**: 
   - Usually safe to accept both changes
   - Add new upstream enum values alongside our custom ones

2. **Import Statements**:
   - Combine both sets of imports
   - Remove duplicates
   - Maintain alphabetical order when possible

3. **Component Props/Interfaces**:
   - Merge prop additions from both sides
   - Update our components to handle new upstream props

4. **Configuration Files**:
   - Carefully merge settings
   - Preserve our custom configurations
   - Add new upstream config options as appropriate

#### Resolution Best Practices

- **Preserve both changes when possible**: Most conflicts can be resolved by keeping both upstream and our changes
- **Test thoroughly**: After resolving conflicts, test affected features
- **Document major changes**: Update this README if the merge introduces significant changes
- **Atomic commits**: Make separate commits for conflict resolution vs. post-merge fixes

### Testing After Merge

After a successful merge:

1. **Run type checking**: `npm run typecheck:web`
2. **Start development server**: `npm run dev`
3. **Test authentication flows**: Login/logout, protected routes
4. **Test MCP server functionality**: Ensure auto-installation works
5. **Test core Cherry Studio features**: Verify nothing was broken

### Frequency Recommendations

Based on industry best practices and our fork structure:

- **Regular merges**: Weekly to bi-weekly during active upstream development
- **Release-based merges**: Always merge when Cherry Studio releases new versions
- **Before major changes**: Merge upstream before starting significant new features

Regular merging is crucial because:
- Smaller, more frequent merges are easier to resolve
- Long gaps lead to "merge hell" with complex conflicts
- Keeps our fork current with security updates and bug fixes

### Emergency Procedures

If a merge goes badly wrong:

1. **Abort the merge**:
   ```bash
   git merge --abort
   ```

2. **Reset to previous state**:
   ```bash
   git reset --hard HEAD~1  # Only if you haven't pushed yet
   ```

3. **Try alternative approaches**:
   - Merge in smaller chunks (individual commits)
   - Create a temporary branch to test merge strategies
   - Seek help from team members familiar with the conflicts

### Automation Opportunities

Consider setting up:
- **Weekly CI job** to attempt upstream merges in a test branch
- **Notifications** when new Cherry Studio releases are available
- **Automated testing** to verify merge success

This proactive approach helps identify potential conflicts early and keeps the merge process routine rather than stressful.

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
