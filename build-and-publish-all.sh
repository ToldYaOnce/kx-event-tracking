#!/bin/bash

# Build and Publish All Packages Script
# Orchestrates building and publishing all KX Event Tracking packages

set -e  # Exit on any error

echo "🚀 Building and publishing ALL KX Event Tracking packages..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${PURPLE}[ALL]${NC} $1"
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

# Check if individual scripts exist
SCRIPTS=(
    "build-and-publish-decorators.sh"
    "build-and-publish-cdk.sh"
    "build-and-publish-consumers.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ ! -f "$script" ]; then
        print_error "Required script not found: $script"
        exit 1
    fi
    
    # Make sure scripts are executable
    chmod +x "$script"
done

print_status "All required scripts found and made executable"

# Ask for confirmation
echo
print_status "This will build and publish all packages:"
echo "  🎯 kx-events-decorators"
echo "  🏗️  kx-events-cdk"
echo "  🔍 kx-event-consumers"
echo
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Aborted by user"
    exit 0
fi

# Track start time
start_time=$(date +%s)

# Run each script
echo "=============================================="
print_status "Step 1/3: Building and publishing decorators..."
echo "=============================================="
./build-and-publish-decorators.sh

echo
echo "=============================================="
print_status "Step 2/3: Building and publishing CDK..."
echo "=============================================="
./build-and-publish-cdk.sh

echo
echo "=============================================="
print_status "Step 3/3: Building and publishing consumers..."
echo "=============================================="
./build-and-publish-consumers.sh

# Calculate total time
end_time=$(date +%s)
total_time=$((end_time - start_time))
minutes=$((total_time / 60))
seconds=$((total_time % 60))

# Final summary
echo
echo "=============================================="
print_success "🎉 ALL PACKAGES PUBLISHED SUCCESSFULLY!"
echo "=============================================="
echo
print_status "Completed in ${minutes}m ${seconds}s"
echo
print_status "All packages are now available:"
echo "  📦 @toldyaonce/kx-events-decorators"
echo "  📦 @toldyaonce/kx-events-cdk"
echo "  📦 @toldyaonce/kx-event-consumers"
echo
print_status "Next steps:"
echo "  • Update your applications to use the new versions"
echo "  • Test the packages in your target environments"
echo "  • Consider creating a git tag for this release"
echo
print_success "Happy coding! 🚀"
echo


