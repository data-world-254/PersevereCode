# Phase 1: Path Spaces Issue - Action Required

## 🔴 Critical Issue

**Problem**: npm install fails because the project path contains spaces:
```
/home/fidel-ochieng-ogola/FIDEL OGOLA PERSONAL FOLDER/VS - Code Project/ide
```

**Error**: `/bin/sh: 1: OGOLA: not found` - The build system splits paths at spaces

**Root Cause**: `node-gyp` (used by `@vscode/sqlite3` and other native modules) doesn't properly escape paths with spaces in generated Makefiles and build commands.

## ✅ Solution: Clone to New Location

VS Code OSS must be built from a path **without spaces**. This is a requirement for native module builds.

## 📋 Step-by-Step Fix

### Option 1: Use Automated Script (Recommended)

```bash
# Run the fix script
cd "/home/fidel-ochieng-ogola/FIDEL OGOLA PERSONAL FOLDER/VS - Code Project"
./scripts/fix-ide-path.sh
```

This script will:
1. Create `~/persevere-workspace/ide` (no spaces!)
2. Clone VS Code OSS fresh
3. Copy your custom changes (product.json, src/persevere, etc.)
4. Preserve git history

### Option 2: Manual Clone (Alternative)

```bash
# 1. Create new workspace directory
mkdir -p ~/persevere-workspace
cd ~/persevere-workspace

# 2. Clone VS Code OSS
git clone https://github.com/microsoft/vscode.git ide
cd ide

# 3. Ensure Node.js 22 is active
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

# 4. Copy custom changes from old location
cp "/home/fidel-ochieng-ogola/FIDEL OGOLA PERSONAL FOLDER/VS - Code Project/ide/product.json" ./
cp "/home/fidel-ochieng-ogola/FIDEL OGOLA PERSONAL FOLDER/VS - Code Project/ide/package.json" ./  # Review before overwriting!

# 5. Copy persevere directory if it exists
mkdir -p src/persevere
cp -r "/home/fidel-ochieng-ogola/FIDEL OGOLA PERSONAL FOLDER/VS - Code Project/ide/src/persevere"/* src/persevere/ 2>/dev/null || echo "persevere directory doesn't exist"

# 6. Install dependencies (should work now!)
npm install
```

## ✅ After Fixing Path

Once VS Code OSS is in `~/persevere-workspace/ide`:

```bash
# 1. Navigate to new location
cd ~/persevere-workspace/ide

# 2. Ensure Node.js 22 is active
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

# 3. Verify path has no spaces
pwd  # Should show: /home/fidel-ochieng-ogola/persevere-workspace/ide
echo "$(pwd)" | grep -q ' ' && echo "❌ Path still has spaces!" || echo "✅ Path has no spaces"

# 4. Install dependencies (will take 10-20 minutes)
npm install

# 5. Test build
npm run compile
```

## 📊 What We've Tried

| Approach | Status | Result |
|----------|--------|--------|
| Install from original path | ❌ Failed | `/bin/sh: 1: OGOLA: not found` |
| Use symlink (`~/persevere-project`) | ❌ Failed | npm still resolves to original path internally |
| Environment variables | ❌ Failed | Doesn't fix node-gyp path handling |
| **Clone to new location** | ✅ **Recommended** | **Only reliable solution** |

## 🎯 Why This is Required

VS Code OSS uses many native modules (C++ bindings) that are compiled during `npm install`:
- `@vscode/sqlite3` - SQLite database bindings
- `node-pty` - Terminal emulation
- `spdlog` - Logging library
- `native-keymap` - Keyboard mapping
- And many more...

All of these use `node-gyp` which generates Makefiles that don't handle paths with spaces correctly.

## 📝 Update Project References

After moving to `~/persevere-workspace/ide`, you'll need to:

1. **Update documentation** to reference the new path
2. **Update any scripts** that reference the old path
3. **Keep the old `ide/` directory** as a backup until the new one is verified
4. **Consider removing the old directory** after successful build

## ⚡ Quick Command Reference

```bash
# Run fix script
./scripts/fix-ide-path.sh

# Or manually:
cd ~ && mkdir -p persevere-workspace && cd persevere-workspace
git clone https://github.com/microsoft/vscode.git ide
cd ide
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use 22
npm install
```

## 🚀 Expected Timeline

- Clone VS Code OSS: 5-10 minutes
- Copy custom changes: < 1 minute
- npm install: 10-20 minutes
- Test build: 5-10 minutes

**Total**: ~30-40 minutes

## ✅ Success Indicators

After completing the fix:
- ✅ `~/persevere-workspace/ide` exists (no spaces in path)
- ✅ `npm install` completes without errors
- ✅ `node_modules` directory is ~1-2 GB
- ✅ `npm run compile` succeeds
- ✅ No "OGOLA: not found" errors

---

**Next Action**: Run `./scripts/fix-ide-path.sh` to clone VS Code OSS to a path without spaces.

