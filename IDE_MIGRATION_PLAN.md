# IDE Migration Plan

## Overview

This document outlines the step-by-step migration from VS Code extension to full IDE based on VS Code OSS.

## Prerequisites

1. VS Code OSS repository access
2. Node.js 18+ and npm/yarn
3. Build tools (gulp, webpack)
4. Git for version control

## Migration Steps

### Step 1: Remove Extension Code ✅

**Action**: Delete the extension directory and update project structure

**Files to Remove**:
- `apps/extension/` (entire directory)

**Files to Update**:
- `package.json` - Remove extension workspace
- `README.md` - Update architecture section

### Step 2: Set Up VS Code OSS Fork

**Action**: Clone and set up VS Code OSS repository

**Commands**:
```bash
# Clone VS Code OSS (you'll provide the link)
git clone <vscode-oss-repo-url> ide

# Navigate to IDE directory
cd ide

# Install dependencies
npm install

# Build for development
npm run watch
```

**Customizations Needed**:
1. Update `product.json` with Persevere branding
2. Modify `package.json` with Persevere metadata
3. Update icons and assets
4. Configure build scripts

### Step 3: Create Custom Feature Structure

**Action**: Set up directory structure for custom features

**Directories to Create**:
```
ide/src/persevere/
├── meeting/
├── chat/
├── execution/
├── sync/
├── api/
└── project/
```

### Step 4: Integrate Cloud Services

**Action**: Port API client and services from extension to IDE

**Files to Create**:
- `ide/src/persevere/api/apiClient.ts`
- `ide/src/persevere/api/authService.ts`
- `ide/src/persevere/api/websocketClient.ts`

**Files to Reference**:
- `apps/api/` - Backend API (keep as-is)
- `apps/web/` - Web dashboard (keep as-is)

### Step 5: Build Custom UI Components

**Action**: Create custom panels and widgets

**Components to Build**:
1. Tavus Meeting Widget (draggable)
2. Chat Panel
3. Execution Summary Panel
4. Offline Sync Indicator

### Step 6: Implement Offline Sync

**Action**: Build offline sync layer

**Components**:
- Local cache (IndexedDB)
- Action queue
- Background sync service
- Conflict resolution

### Step 7: Cross-Platform Builds

**Action**: Set up build system for all platforms

**Platforms**:
- Windows (x64)
- macOS (x64, ARM64)
- Linux (x64, ARM64)

## Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1 | Week 1 | Remove extension, set up VS Code OSS |
| Phase 2 | Week 2 | Integrate cloud services, basic UI |
| Phase 3 | Week 3 | Build custom panels and widgets |
| Phase 4 | Week 4 | Implement offline sync |
| Phase 5 | Week 5 | Testing and bug fixes |
| Phase 6 | Week 6 | Cross-platform builds |
| Phase 7 | Week 7 | Documentation and polish |
| Phase 8 | Week 8 | Release preparation |

## Risk Mitigation

1. **VS Code OSS Updates**: Fork and maintain our own branch
2. **Breaking Changes**: Test thoroughly before merging updates
3. **Build Complexity**: Use VS Code's existing build system
4. **Performance**: Profile and optimize early
5. **Platform Differences**: Test on all platforms regularly

## Success Criteria

- [ ] IDE builds successfully on all platforms
- [ ] All custom features working
- [ ] Offline sync functional
- [ ] Performance meets targets
- [ ] No critical bugs
- [ ] Documentation complete

