# Phase 1: Next Steps - Action Required

## ✅ Current Status

**Good News**: Node.js 22.21.1 is now installed and active! ✅

**Current Setup**:
- ✅ Node.js: v22.21.1 (via nvm)
- ✅ npm: v10.9.4
- ✅ Build tools: gcc, make, python3, build-essential installed
- ✅ Python 3.12.3 with dev headers installed

## ⚠️ Missing System Dependencies

The npm install failed because some system dependencies are missing. You need to install:

```bash
sudo apt-get update
sudo apt-get install -y \
  libkrb5-dev \
  libsecret-1-dev \
  libxkbfile-dev
```

**Why these are needed**:
- `libkrb5-dev`: Kerberos authentication headers (for native modules)
- `libsecret-1-dev`: Secret storage library headers (for secure credential storage)
- `libxkbfile-dev`: X11 keyboard file library headers (for VS Code functionality)

## 📋 Step-by-Step Instructions

### Step 1: Install Missing System Dependencies

**Run in terminal**:
```bash
sudo apt-get update
sudo apt-get install -y libkrb5-dev libsecret-1-dev libxkbfile-dev
```

### Step 2: Ensure Node.js 22.x is Active

**In your terminal, run**:
```bash
# Load nvm (if not already in your shell)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node.js 22
nvm use 22

# Verify
node --version  # Should show v22.21.1
```

**Tip**: Add this to your `~/.bashrc` to always use Node.js 22:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 > /dev/null 2>&1
```

### Step 3: Install npm Dependencies

**Navigate to IDE directory**:
```bash
cd "/home/fidel-ochieng-ogola/FIDEL OGOLA PERSONAL FOLDER/VS - Code Project/ide"
```

**Install dependencies**:
```bash
# Ensure Node.js 22 is active (reload nvm if needed)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

# Install dependencies (this will take 10-20 minutes)
npm install
```

**What to expect**:
- ⏱️ **Time**: 10-20 minutes (many dependencies)
- 💾 **Size**: ~1-2 GB for `node_modules/`
- 📊 **Progress**: Will show progress bars and build output
- ⚙️ **Native Modules**: Will compile some native modules (this is normal)

**If you see errors**:
- Missing headers: Install the missing `-dev` packages
- Build errors: Make sure `build-essential` is installed
- Permission errors: Check file permissions in `ide/` directory

### Step 4: Test Build Process

**After dependencies are installed**:
```bash
# Test compilation (first build takes 5-10 minutes)
npm run compile
```

**What to expect**:
- TypeScript compilation
- Gulp-based build process
- Output in `out/` directory
- First build takes 5-10 minutes

### Step 5: Test Watch Mode (Development)

**Once build succeeds**:
```bash
# Start watch mode (auto-rebuilds on changes)
npm run watch
```

This will:
- Watch for file changes
- Auto-rebuild TypeScript
- Build extensions
- Ready for development

## 🚨 Common Issues & Solutions

### Issue: Still using Node.js 20.x

**Symptoms**: `node --version` shows v20.x.x

**Solution**:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22
node --version  # Verify
```

### Issue: Missing gssapi/gssapi.h

**Symptoms**: Build error about `gssapi/gssapi.h`

**Solution**:
```bash
sudo apt-get install libkrb5-dev
```

### Issue: npm install fails with permission errors

**Symptoms**: Permission denied errors

**Solution**:
```bash
# Check ownership of ide directory
ls -la ide

# If needed, fix ownership
sudo chown -R $USER:$USER ide
```

### Issue: npm install takes too long

**Normal**: npm install for VS Code takes 10-20 minutes. Be patient.

### Issue: Memory errors during build

**Symptoms**: Out of memory errors

**Solution**: VS Code build requires significant RAM (8GB+ recommended). If you have less:
- Close other applications
- Use `npm run compile` instead of watch mode initially
- Consider building in smaller chunks

## ✅ Success Indicators

After successful `npm install`:
- ✅ `ide/node_modules/` directory exists (large, ~1-2 GB)
- ✅ No critical errors in output
- ✅ Some native modules compiled successfully

After successful `npm run compile`:
- ✅ `ide/out/` directory created
- ✅ Compiled TypeScript files in `out/`
- ✅ No compilation errors

After successful `npm run watch`:
- ✅ Watch process running
- ✅ File changes trigger rebuilds
- ✅ No errors in output

## 📊 Phase 1 Remaining Tasks

| Task | Status | Action |
|------|--------|--------|
| Install system deps | ⏳ Pending | Run: `sudo apt-get install libkrb5-dev libsecret-1-dev libxkbfile-dev` |
| Install npm deps | ⏳ Pending | Run: `npm install` (after system deps) |
| Test build | ⏳ Pending | Run: `npm run compile` |
| Test watch | ⏳ Pending | Run: `npm run watch` |
| Verify launch | ⏳ Pending | Launch IDE from build output |

## 🎯 Current Progress

**Phase 1: 75% Complete**

✅ VS Code OSS cloned
✅ Branding updated
✅ Structure created
✅ Node.js 22.x installed
⏳ System dependencies (missing 3 packages)
⏳ npm dependencies (pending)
⏳ Build test (pending)
⏳ Launch test (pending)

## 📝 Quick Command Reference

```bash
# 1. Install system dependencies
sudo apt-get install -y libkrb5-dev libsecret-1-dev libxkbfile-dev

# 2. Ensure Node.js 22 is active
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

# 3. Install npm dependencies
cd ide
npm install

# 4. Test build
npm run compile

# 5. Test watch mode
npm run watch
```

## 🚀 After Phase 1 Completion

Once Phase 1 is complete, we'll proceed to **Phase 2: Cloud Services Integration**:
- Port API client from extension to IDE
- Integrate authentication service
- Set up WebSocket client for real-time updates
- Implement basic offline sync layer

---

**Next Action**: Install the 3 missing system dependencies, then run `npm install`.

