# Build and Publish Scripts

This directory contains build and publish scripts for the KX Event Tracking monorepo.

## Available Scripts

### Individual Package Scripts

- **`build-and-publish-decorators.sh`** - Build and publish kx-events-decorators package
- **`build-and-publish-cdk.sh`** - Build and publish kx-events-cdk package  
- **`build-and-publish-consumers.sh`** - Build and publish kx-event-consumers package

### Orchestrator Scripts

- **`build-and-publish-all.sh`** - Build and publish all packages sequentially
- **`build-and-publish.sh`** - Legacy script (builds all packages)

### Utility Scripts

- **`bump-version.js`** - Custom version bumper that avoids npm/pnpm issues

## Usage

### Quick Commands (from root directory)

```bash
# Build and publish individual packages
npm run build-and-publish-decorators
npm run build-and-publish-cdk  
npm run build-and-publish-consumers

# Build and publish all packages
npm run build-and-publish-all
```

### Direct Script Usage

```bash
# Individual packages
./build-and-publish-decorators.sh
./build-and-publish-cdk.sh
./build-and-publish-consumers.sh

# All packages
./build-and-publish-all.sh
```

## What Each Script Does

1. **Installs dependencies** using pnpm
2. **Builds the package** (including Lambda preparation for CDK)
3. **Bumps patch version** using custom version bumper
4. **Rebuilds** after version bump
5. **Publishes to GitHub Packages** (if authenticated)

## Authentication

Before publishing, make sure you're logged in to GitHub Packages:

```bash
npm login --scope=@toldyaonce --registry=https://npm.pkg.github.com
```

## Version Bumping

The scripts use a custom Node.js version bumper (`scripts/bump-version.js`) to avoid npm/pnpm dependency resolution issues. This bumper:

- Reads the current version from package.json
- Increments the patch version
- Writes the new version back to package.json
- Outputs the new version for the script to use

## Error Handling

- Scripts will exit on any error (`set -e`)
- If not authenticated with GitHub Packages, scripts will ask if you want to continue without publishing
- Version conflicts are detected and handled gracefully
- All scripts provide colored output for easy debugging

## Examples

### Publish just the consumers package
```bash
npm run build-and-publish-consumers
```

### Publish all packages in sequence
```bash
npm run build-and-publish-all
```

### Check what would be published (dry run)
```bash
# Run with SKIP_PUBLISH=true to build and version without publishing
SKIP_PUBLISH=true ./build-and-publish-consumers.sh
```


