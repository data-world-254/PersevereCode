#!/bin/bash

# Script to clone VS Code OSS to a location without spaces
# This fixes the path spaces issue that breaks native module builds

set -e

echo "=========================================="
echo "VS Code OSS Path Fix - Clone to New Location"
echo "=========================================="
echo ""

# Define paths
OLD_PATH="/home/fidel-ochieng-ogola/FIDEL OGOLA PERSONAL FOLDER/VS - Code Project/ide"
NEW_BASE="$HOME/persevere-workspace"
NEW_PATH="$NEW_BASE/ide"

# Create new workspace directory
echo "📁 Creating new workspace directory..."
mkdir -p "$NEW_BASE"
cd "$NEW_BASE"

# Check if ide already exists
if [ -d "ide" ]; then
    echo "⚠️  Directory $NEW_PATH already exists!"
    read -p "Do you want to remove it and clone fresh? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing existing directory..."
        rm -rf "ide"
    else
        echo "❌ Aborted. Exiting."
        exit 1
    fi
fi

# Clone VS Code OSS
echo "📦 Cloning VS Code OSS repository..."
echo "   From: https://github.com/microsoft/vscode.git"
echo "   To: $NEW_PATH"
git clone https://github.com/microsoft/vscode.git ide

cd "$NEW_PATH"

# Checkout the same commit (if we can determine it from old location)
if [ -f "$OLD_PATH/.git/config" ]; then
    OLD_COMMIT=$(cd "$OLD_PATH" && git rev-parse HEAD 2>/dev/null || echo "")
    if [ ! -z "$OLD_COMMIT" ]; then
        echo "🔄 Checking out commit: $OLD_COMMIT"
        git checkout "$OLD_COMMIT"
    fi
fi

# Copy our custom changes
echo "📋 Copying custom changes from old location..."

# Copy product.json
if [ -f "$OLD_PATH/product.json" ]; then
    echo "   ✓ Copying product.json"
    cp "$OLD_PATH/product.json" ./
fi

# Copy custom package.json changes (merge carefully)
if [ -f "$OLD_PATH/package.json" ]; then
    echo "   ✓ Backup original package.json"
    cp package.json package.json.original
    # We'll need to manually merge package.json changes
    echo "   ⚠️  Note: package.json should be manually merged"
fi

# Copy persevere directory structure
if [ -d "$OLD_PATH/src/persevere" ]; then
    echo "   ✓ Copying src/persevere directory"
    mkdir -p src/persevere
    cp -r "$OLD_PATH/src/persevere"/* src/persevere/
fi

# Copy .nvmrc if it exists
if [ -f "$OLD_PATH/.nvmrc" ]; then
    echo "   ✓ Copying .nvmrc"
    cp "$OLD_PATH/.nvmrc" ./
fi

echo ""
echo "✅ VS Code OSS cloned to: $NEW_PATH"
echo ""
echo "📋 Next steps:"
echo "   1. cd $NEW_PATH"
echo "   2. export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\" && nvm use 22"
echo "   3. npm install"
echo ""
echo "⚠️  Important: Update your workspace path references to use:"
echo "   $NEW_PATH"
echo "   (instead of the old path with spaces)"
echo ""

