#!/usr/bin/env node

/**
 * Setup script for Persevere IDE
 * 
 * This script helps set up the VS Code OSS fork for Persevere IDE.
 * 
 * Usage:
 *   npm run setup:ide
 * 
 * Prerequisites:
 *   - VS Code OSS repository URL (will be prompted)
 *   - Git installed
 *   - Node.js 18+ installed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const IDE_DIR = path.join(ROOT_DIR, 'ide');

console.log('🚀 Persevere IDE Setup\n');

// Check if ide directory already exists
if (fs.existsSync(IDE_DIR)) {
  console.log('⚠️  IDE directory already exists.');
  console.log('   If you want to re-setup, delete the "ide" directory first.\n');
  process.exit(0);
}

// Prompt for VS Code OSS repository URL
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter VS Code OSS repository URL (or press Enter to skip): ', (repoUrl) => {
  if (!repoUrl || repoUrl.trim() === '') {
    console.log('\n📝 Skipping repository clone.');
    console.log('   To set up manually:');
    console.log('   1. Clone VS Code OSS repository into "ide" directory');
    console.log('   2. Run: cd ide && npm install');
    console.log('   3. Follow IDE_TECHNICAL_SPEC.md for customization steps\n');
    rl.close();
    process.exit(0);
  }

  console.log(`\n📦 Cloning VS Code OSS from: ${repoUrl}`);
  
  try {
    // Clone repository
    execSync(`git clone ${repoUrl} ide`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    console.log('\n✅ Repository cloned successfully!');
    console.log('\n📦 Installing dependencies...');
    
    // Install dependencies
    execSync('npm install', {
      cwd: IDE_DIR,
      stdio: 'inherit'
    });

    console.log('\n✅ Dependencies installed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Review IDE_TECHNICAL_SPEC.md for customization details');
    console.log('   2. Update product.json with Persevere branding');
    console.log('   3. Create src/persevere/ directory structure');
    console.log('   4. Follow IDE_MIGRATION_PLAN.md for migration steps\n');
    
    rl.close();
  } catch (error) {
    console.error('\n❌ Error during setup:', error.message);
    console.log('\n💡 You can set up manually:');
    console.log('   1. Clone VS Code OSS repository into "ide" directory');
    console.log('   2. Run: cd ide && npm install');
    console.log('   3. Follow IDE_TECHNICAL_SPEC.md for customization steps\n');
    rl.close();
    process.exit(1);
  }
});

