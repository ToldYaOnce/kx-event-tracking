#!/bin/bash

# Build and Publish Script for KX Event Tracking Monorepo
# This script builds both packages, bumps their patch versions, and publishes them

set -e  # Exit on any error

echo "🚀 Starting build and publish process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Clean previous builds
print_status "Cleaning previous builds..."
pnpm run clean || true

# Install dependencies
print_status "Installing dependencies..."
pnpm install

# Build all packages
print_status "Building all packages..."
pnpm run build

# Function to bump version and get new version
bump_version() {
    local package_dir=$1
    local package_name=$2
    
    print_status "Bumping version for $package_name..."
    
    cd "$package_dir"
    
    # Get current version
    local current_version=$(node -p "require('./package.json').version")
    print_status "Current version of $package_name: $current_version"
    
    # Bump patch version using our custom script
    local new_version=$(node ../scripts/bump-version.js . patch | tail -1 | sed 's/^v//')
    print_success "Bumped $package_name to version: $new_version"
    
    cd - > /dev/null
    echo "$new_version"
}

# Function to publish package
publish_package() {
    local package_dir=$1
    local package_name=$2
    local version=$3
    
    if [ "$SKIP_PUBLISH" = true ]; then
        print_warning "Skipping publish for $package_name (not logged in to npm)"
        return
    fi
    
    print_status "Publishing $package_name@$version..."
    
    cd "$package_dir"
    
    # Check if this version already exists
    if npm view "$package_name@$version" version --registry=https://npm.pkg.github.com &> /dev/null; then
        print_warning "Version $version of $package_name already exists on GitHub Packages, skipping publish"
    else
        npm publish --registry=https://npm.pkg.github.com
        print_success "Published $package_name@$version to GitHub Packages"
    fi
    
    cd - > /dev/null
}

# Bump versions and publish packages
print_status "Processing packages..."

# Process kx-events-decorators
decorators_version=$(bump_version "packages/kx-events-decorators" "kx-events-decorators")

# Process kx-events-cdk
cdk_version=$(bump_version "packages/kx-events-cdk" "kx-events-cdk")

# Process kx-event-consumers
consumers_version=$(bump_version "packages/kx-event-consumers" "kx-event-consumers")

# Rebuild after version bumps (in case version is used in build)
print_status "Rebuilding packages after version bumps..."
pnpm run build

# Publish packages
print_status "Publishing packages..."
publish_package "packages/kx-events-decorators" "@toldyaonce/kx-events-decorators" "$decorators_version"
publish_package "packages/kx-events-cdk" "@toldyaonce/kx-events-cdk" "$cdk_version"
publish_package "packages/kx-event-consumers" "@toldyaonce/kx-event-consumers" "$consumers_version"

# Summary
echo
print_success "🎉 Build and publish process completed!"
echo
print_status "Summary:"
echo "  📦 kx-events-decorators: $decorators_version"
echo "  📦 kx-events-cdk: $cdk_version"
echo "  📦 kx-event-consumers: $consumers_version"
echo

if [ "$SKIP_PUBLISH" = true ]; then
    print_warning "Packages were built and versioned but not published (GitHub Packages login required)"
    echo "To publish manually:"
    echo "  npm login --scope=@toldyaonce --registry=https://npm.pkg.github.com"
    echo "  cd packages/kx-events-decorators && npm publish --registry=https://npm.pkg.github.com"
    echo "  cd packages/kx-events-cdk && npm publish --registry=https://npm.pkg.github.com"
    echo "  cd packages/kx-event-consumers && npm publish --registry=https://npm.pkg.github.com"
else
    print_success "All packages have been built, versioned, and published to GitHub Packages successfully!"
fi

echo
print_status "Next steps:"
echo "  • Update your applications to use the new versions"
echo "  • Test the new packages in your target environments"
echo "  • Consider creating a git tag for this release"
echo

# Optional: Create git tag
if [ "$SKIP_PUBLISH" != true ]; then
    read -p "Create a git tag for this release? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        tag_name="v$(date +%Y%m%d-%H%M%S)"
        git add .
        git commit -m "chore: bump versions - decorators@$decorators_version, cdk@$cdk_version, consumers@$consumers_version" || true
        git tag "$tag_name"
        print_success "Created git tag: $tag_name"
        echo "Don't forget to push: git push && git push --tags"
    fi
fi
