# Persevere IDE Setup Guide

## Quick Start

### Step 1: Get VS Code OSS Repository

You need the VS Code OSS (Open Source) repository. The official repository is:
- **GitHub**: https://github.com/microsoft/vscode

However, for a fork/custom build, you may want to use:
- **Code-OSS**: https://github.com/microsoft/vscode (main branch)

### Step 2: Run Setup Script

```bash
# From project root
npm run setup:ide
```

The script will:
1. Prompt for VS Code OSS repository URL
2. Clone the repository into `ide/` directory
3. Install dependencies
4. Set up the basic structure

### Step 3: Manual Setup (Alternative)

If you prefer to set up manually:

```bash
# Clone VS Code OSS
git clone https://github.com/microsoft/vscode.git ide

# Navigate to IDE directory
cd ide

# Install dependencies (this may take 10-20 minutes)
npm install

# Build for development
npm run watch
```

## Initial Customization

After cloning VS Code OSS, you need to customize it for Persevere:

### 1. Update Product Branding

Edit `ide/product.json`:

```json
{
  "nameShort": "Persevere",
  "nameLong": "Persevere IDE",
  "applicationName": "persevere",
  "dataFolderName": ".persevere",
  "win32AppUserModelId": "Persevere.PersevereIDE",
  "win32MutexName": "persevere",
  "darwinBundleIdentifier": "com.persevere.ide",
  "linuxIconName": "persevere",
  "reportIssueUrl": "https://github.com/your-org/persevere/issues",
  "urlProtocol": "persevere",
  "extensionAllowedProposedApi": [
    "ms-vscode.vscode-js-debug"
  ]
}
```

### 2. Create Custom Features Directory

```bash
cd ide/src
mkdir -p persevere/{meeting,chat,execution,sync,api,project}
```

### 3. Update package.json

Edit `ide/package.json` and update:
- `name`: `persevere-ide`
- `displayName`: `Persevere IDE`
- `description`: `Autonomous software development IDE`

## Development Workflow

### Watch Mode (Development)

```bash
cd ide
npm run watch
```

This will:
- Watch for file changes
- Rebuild automatically
- Launch IDE in development mode

### Build for Production

```bash
cd ide
npm run compile
```

### Run Tests

```bash
cd ide
npm test
```

## Next Steps

1. **Review Technical Spec**: Read `IDE_TECHNICAL_SPEC.md` for detailed architecture
2. **Follow Migration Plan**: See `IDE_MIGRATION_PLAN.md` for step-by-step migration
3. **Start Integration**: Begin integrating cloud services (see Phase 4 in migration plan)

## Troubleshooting

### Build Errors

If you encounter build errors:

1. **Clear cache and rebuild**:
   ```bash
   cd ide
   rm -rf node_modules out
   npm install
   npm run compile
   ```

2. **Check Node.js version**: Ensure you're using Node.js 18+
   ```bash
   node --version
   ```

3. **Check dependencies**: Some native modules may need to be rebuilt
   ```bash
   npm rebuild
   ```

### VS Code OSS Updates

To pull updates from VS Code OSS:

```bash
cd ide
git remote add upstream https://github.com/microsoft/vscode.git
git fetch upstream
git merge upstream/main
```

**Note**: Always test thoroughly after merging updates, as they may break customizations.

## Resources

- [VS Code OSS GitHub](https://github.com/microsoft/vscode)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Electron Documentation](https://www.electronjs.org/docs)
- [VS Code Build Guide](https://github.com/microsoft/vscode/wiki/How-to-Contribute#build-and-run)

