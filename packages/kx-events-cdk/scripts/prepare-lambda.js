#!/usr/bin/env node

/**
 * Prepare Lambda function for deployment
 * Ensures all dependencies are properly installed and packaged
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const lambdaDir = path.join(__dirname, '../src/lambdas/events-consumer');

console.log('🔧 Preparing Lambda function for deployment...');
console.log(`📁 Lambda directory: ${lambdaDir}`);

// Check if Lambda directory exists
if (!fs.existsSync(lambdaDir)) {
  console.error('❌ Lambda directory not found:', lambdaDir);
  process.exit(1);
}

// Check if package.json exists
const packageJsonPath = path.join(lambdaDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json not found in Lambda directory');
  process.exit(1);
}

// Check if index.js exists
const indexJsPath = path.join(lambdaDir, 'index.js');
if (!fs.existsSync(indexJsPath)) {
  console.error('❌ index.js not found in Lambda directory');
  process.exit(1);
}

// Install dependencies
console.log('📦 Installing Lambda dependencies...');
try {
  execSync('npm install --production --no-optional', {
    cwd: lambdaDir,
    stdio: 'inherit'
  });
  console.log('✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Verify pg module
console.log('🔍 Verifying pg module...');
const nodeModulesPath = path.join(lambdaDir, 'node_modules');
const pgPath = path.join(nodeModulesPath, 'pg');

if (!fs.existsSync(pgPath)) {
  console.error('❌ pg module not found in node_modules');
  process.exit(1);
}

// Test module loading
try {
  const testScript = `
    const { Client } = require('pg');
    const { handler } = require('./index.js');
    console.log('✅ All modules loaded successfully');
    console.log('✅ pg Client:', typeof Client);
    console.log('✅ Lambda handler:', typeof handler);
  `;
  
  execSync(`node -e "${testScript}"`, {
    cwd: lambdaDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('❌ Module loading test failed:', error.message);
  process.exit(1);
}

// Clean up unnecessary files to reduce package size
console.log('🧹 Cleaning up unnecessary files...');
try {
  const cleanupDirs = [
    'node_modules/.cache',
    'node_modules/**/test',
    'node_modules/**/tests',
    'node_modules/**/spec',
    'node_modules/**/specs'
  ];
  
  cleanupDirs.forEach(pattern => {
    try {
      execSync(`find node_modules -path "${pattern}" -type d -exec rm -rf {} + 2>/dev/null || true`, {
        cwd: lambdaDir,
        stdio: 'pipe'
      });
    } catch (e) {
      // Ignore errors for cleanup
    }
  });
  
  // Remove documentation files
  try {
    execSync('find node_modules -name "*.md" -delete 2>/dev/null || true', {
      cwd: lambdaDir,
      stdio: 'pipe'
    });
    execSync('find node_modules -name "*.txt" -delete 2>/dev/null || true', {
      cwd: lambdaDir,
      stdio: 'pipe'
    });
  } catch (e) {
    // Ignore errors for cleanup
  }
  
  console.log('✅ Cleanup completed');
} catch (error) {
  console.warn('⚠️ Cleanup failed (non-critical):', error.message);
}

// Generate deployment info
const deploymentInfo = {
  timestamp: new Date().toISOString(),
  nodeVersion: process.version,
  packageVersion: require('../package.json').version,
  dependencies: require(packageJsonPath).dependencies
};

fs.writeFileSync(
  path.join(lambdaDir, 'deployment-info.json'),
  JSON.stringify(deploymentInfo, null, 2)
);

console.log('🎉 Lambda function prepared successfully!');
console.log('📊 Deployment info:');
console.log(`   - Package version: ${deploymentInfo.packageVersion}`);
console.log(`   - Node version: ${deploymentInfo.nodeVersion}`);
console.log(`   - Dependencies: ${Object.keys(deploymentInfo.dependencies).join(', ')}`);
