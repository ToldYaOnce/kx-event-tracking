#!/usr/bin/env node

// Simple version bumper script that avoids npm/pnpm issues
const fs = require('fs');
const path = require('path');

function bumpVersion(packagePath, bumpType = 'patch') {
  const packageJsonPath = path.join(packagePath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`package.json not found at ${packageJsonPath}`);
    process.exit(1);
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version;
  
  if (!currentVersion) {
    console.error('No version field found in package.json');
    process.exit(1);
  }
  
  // Parse version
  const versionParts = currentVersion.split('.').map(Number);
  if (versionParts.length !== 3) {
    console.error(`Invalid version format: ${currentVersion}`);
    process.exit(1);
  }
  
  // Bump version
  switch (bumpType) {
    case 'patch':
      versionParts[2]++;
      break;
    case 'minor':
      versionParts[1]++;
      versionParts[2] = 0;
      break;
    case 'major':
      versionParts[0]++;
      versionParts[1] = 0;
      versionParts[2] = 0;
      break;
    default:
      console.error(`Invalid bump type: ${bumpType}`);
      process.exit(1);
  }
  
  const newVersion = versionParts.join('.');
  
  // Update package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  
  console.log(`${packageJson.name}`);
  console.log(`v${newVersion}`);
  
  return newVersion;
}

// Get arguments
const packagePath = process.argv[2] || '.';
const bumpType = process.argv[3] || 'patch';

bumpVersion(packagePath, bumpType);


