#!/bin/bash

# Build and Publish Script for kx-events-cdk
# Builds, bumps version, and publishes the CDK package

set -e  # Exit on any error

echo "🏗️ Building and publishing kx-events-cdk..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[CDK]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "pnpm-workspace.yaml" ]; then
    print_error "This script must be run from the root of the monorepo"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is required but not installed. Please install pnpm first."
    exit 1
fi

# Check if authenticated with GitHub Packages
if ! npm whoami --registry=https://npm.pkg.github.com &> /dev/null; then
    print_warning "You are not logged in to GitHub Packages."
    print_warning "Please run: npm login --scope=@toldyaonce --registry=https://npm.pkg.github.com"
    read -p "Continue without publishing? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    SKIP_PUBLISH=true
fi

PACKAGE_DIR="packages/kx-events-cdk"
PACKAGE_NAME="@toldyaonce/kx-events-cdk"

# Clean and install dependencies
print_status "Installing dependencies..."
pnpm install

# Build the package (includes Lambda preparation)
print_status "Building kx-events-cdk (including Lambda preparation)..."
cd "$PACKAGE_DIR"
pnpm run build
cd - > /dev/null

# Get current version
current_version=$(node -p "require('./$PACKAGE_DIR/package.json').version")
print_status "Current version: $current_version"

# Bump patch version
print_status "Bumping version..."
new_version=$(node scripts/bump-version.js "$PACKAGE_DIR" patch | tail -1 | sed 's/^v//')
print_success "Bumped to version: $new_version"

# Rebuild after version bump
print_status "Rebuilding after version bump..."
cd "$PACKAGE_DIR"
pnpm run build
cd - > /dev/null

# Publish package
if [ "$SKIP_PUBLISH" = true ]; then
    print_warning "Skipping publish (not logged in to npm)"
else
    print_status "Publishing to GitHub Packages..."
    cd "$PACKAGE_DIR"
    
    # Check if this version already exists
    if npm view "$PACKAGE_NAME@$new_version" version --registry=https://npm.pkg.github.com &> /dev/null; then
        print_warning "Version $new_version already exists on GitHub Packages, skipping publish"
    else
        npm publish --registry=https://npm.pkg.github.com
        print_success "Published $PACKAGE_NAME@$new_version to GitHub Packages"
    fi
    
    cd - > /dev/null
fi

# Summary
echo
print_success "🎉 kx-events-cdk build and publish completed!"
echo "  📦 Version: $new_version"
echo "  🔧 Lambda functions prepared and bundled"

if [ "$SKIP_PUBLISH" = true ]; then
    echo
    print_warning "Package was built and versioned but not published"
    echo "To publish manually:"
    echo "  npm login --scope=@toldyaonce --registry=https://npm.pkg.github.com"
    echo "  cd $PACKAGE_DIR && npm publish --registry=https://npm.pkg.github.com"
fi

echo
