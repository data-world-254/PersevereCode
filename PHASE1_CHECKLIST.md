# Phase 1: Foundation - Checklist

## Goal
Set up VS Code OSS fork and prepare foundation for Persevere IDE customization.

## Timeline: Week 1

## Tasks

### ✅ Step 1: Clone VS Code OSS Repository
- [ ] Clone repository from https://github.com/microsoft/vscode.git
- [ ] Verify clone successful
- [ ] Check repository size and structure

### ⏳ Step 2: Install Dependencies
- [ ] Run `npm install` in ide directory
- [ ] Verify all dependencies installed
- [ ] Check for any build errors
- [ ] Note: This may take 10-20 minutes

### ⏳ Step 3: Update Product Branding
- [ ] Edit `ide/product.json`
  - [ ] Update `nameShort` to "Persevere"
  - [ ] Update `nameLong` to "Persevere IDE"
  - [ ] Update `applicationName` to "persevere"
  - [ ] Update `dataFolderName` to ".persevere"
  - [ ] Update `win32AppUserModelId` to "Persevere.PersevereIDE"
  - [ ] Update `darwinBundleIdentifier` to "com.persevere.ide"
  - [ ] Update `linuxIconName` to "persevere"
  - [ ] Update `reportIssueUrl` to Persevere's issue tracker
  - [ ] Update `urlProtocol` to "persevere"

### ⏳ Step 4: Update package.json
- [ ] Edit `ide/package.json`
  - [ ] Update `name` to "persevere-ide"
  - [ ] Update `displayName` to "Persevere IDE"
  - [ ] Update `description` to Persevere IDE description
  - [ ] Update `version` if needed

### ⏳ Step 5: Create Custom Features Directory Structure
- [ ] Create `ide/src/persevere/` directory
- [ ] Create subdirectories:
  - [ ] `meeting/` - Tavus meeting integration
  - [ ] `chat/` - Chat panel
  - [ ] `execution/` - Execution summary panel
  - [ ] `sync/` - Offline sync layer
  - [ ] `api/` - API client integration
  - [ ] `project/` - Project management

### ⏳ Step 6: Create Initial TypeScript Files
- [ ] Create placeholder index files in each subdirectory
- [ ] Set up basic TypeScript exports
- [ ] Ensure proper imports structure

### ⏳ Step 7: Test Build Process
- [ ] Run `npm run compile` to test build
- [ ] Run `npm run watch` to test watch mode
- [ ] Verify no build errors
- [ ] Check build output structure

### ⏳ Step 8: Verify VS Code Core Functionality
- [ ] Ensure IDE can launch in development mode
- [ ] Verify basic VS Code features work
- [ ] Check extension system works
- [ ] Test editor, terminal, file explorer

## Success Criteria
- ✅ VS Code OSS cloned successfully
- ✅ Dependencies installed without errors
- ✅ Product branding updated
- ✅ Custom directory structure created
- ✅ Build process works (compile and watch)
- ✅ IDE can launch in development mode
- ✅ No critical build errors

## Notes
- VS Code OSS is a large repository (~500MB+)
- Initial `npm install` may take 10-20 minutes
- Build process requires Node.js 18+ and sufficient RAM (8GB+ recommended)
- First build may take 5-10 minutes

## Next Phase
After Phase 1 completion, proceed to Phase 2: Cloud Services Integration


## COMMAND FOR STARTING THE APP

cd ~/persevere-workspace/ide
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22
./scripts/code.sh