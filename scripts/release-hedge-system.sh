#!/bin/bash

# Hedge System Release Script
# This script automates the release process for the hedge-system app

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_info() { echo -e "${YELLOW}→ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps/hedge-system" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Get the release type (patch, minor, major)
RELEASE_TYPE=${1:-patch}

if [[ ! "$RELEASE_TYPE" =~ ^(patch|minor|major)$ ]]; then
    print_error "Invalid release type. Use: patch, minor, or major"
    echo "Usage: $0 [patch|minor|major]"
    exit 1
fi

print_info "Starting hedge-system release process..."
print_info "Release type: $RELEASE_TYPE"

# Navigate to hedge-system directory
cd apps/hedge-system

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_info "Current version: $CURRENT_VERSION"

# Bump version
print_info "Bumping version..."
npm version $RELEASE_TYPE --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
print_success "New version: $NEW_VERSION"

# Go back to root directory
cd ../..

# Build all packages
print_info "Building all packages..."
npm run build

# Run tests
print_info "Running lint checks..."
npm run lint

# Type check
print_info "Running type checks..."
cd apps/hedge-system
npm run check-types
cd ../..

# Commit changes
print_info "Committing version bump..."
git add apps/hedge-system/package.json
git commit -m "chore: bump hedge-system version to $NEW_VERSION"

# Create and push tag
TAG_NAME="hedge-system-v$NEW_VERSION"
print_info "Creating tag: $TAG_NAME"
git tag $TAG_NAME

# Push commit and tag
print_info "Pushing to remote..."
git push origin main
git push origin $TAG_NAME

print_success "Release process completed!"
print_success "Version $NEW_VERSION has been tagged and pushed"
print_info "GitHub Actions will now build and release the desktop app"
print_info "Check the Actions tab for build progress: https://github.com/rnrnstar/ArbitrageAssistant/actions"