# Phase 1: Node.js Version Requirement

## ⚠️ Important: Node.js Version Mismatch

### Current Status
- **VS Code OSS Requires**: Node.js **22.21.1** (specified in `.nvmrc`)
- **Current System Version**: Node.js **20.19.6**
- **Status**: ⚠️ **Version mismatch - needs update**

### Options to Resolve

#### Option 1: Install Node.js 22.x (Recommended)

**Using nvm (Node Version Manager)** - Best approach:

```bash
# Install nvm if not already installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell or source profile
source ~/.bashrc

# Install Node.js 22
nvm install 22

# Use Node.js 22
nvm use 22

# Verify
node --version  # Should show v22.x.x
```

**Using NodeSource (Alternative)**:

```bash
# Install Node.js 22.x from NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

**Download from nodejs.org**:

- Visit: https://nodejs.org/
- Download Node.js 22.x LTS for Linux
- Install using the installer

#### Option 2: Skip Version Check (Temporary - Not Recommended)

Only use this if you cannot update Node.js immediately:

```bash
cd ide
VSCODE_SKIP_NODE_VERSION_CHECK=1 npm install
```

**Warning**: This may cause build issues. VS Code is tested with Node.js 22.x.

#### Option 3: Use Docker/Dev Container

VS Code OSS includes a development container configuration:

```bash
# Use VS Code Dev Containers extension
# Or use the included .devcontainer configuration
```

## Verification

After updating Node.js:

```bash
# Check Node.js version
node --version  # Should be v22.21.1 or later

# Check npm version
npm --version

# Verify in ide directory
cd ide
cat .nvmrc  # Should show 22.21.1
```

## Next Steps

Once Node.js 22.x is installed:

1. **Install dependencies**:
   ```bash
   cd ide
   npm install
   ```
   ⏱️ **Expected time**: 10-20 minutes

2. **Test build**:
   ```bash
   npm run compile
   ```
   ⏱️ **Expected time**: 5-10 minutes (first build)

3. **Test watch mode**:
   ```bash
   npm run watch
   ```

## Why Node.js 22.x?

VS Code OSS uses the latest Node.js features and dependencies that require Node.js 22.x:
- TypeScript 6.0 support
- Latest Electron compatibility
- Performance optimizations
- Security updates

## Resources

- **Node.js Downloads**: https://nodejs.org/
- **nvm Installation**: https://github.com/nvm-sh/nvm
- **NodeSource**: https://github.com/nodesource/distributions
- **VS Code Build Docs**: https://github.com/microsoft/vscode/wiki/How-to-Contribute

