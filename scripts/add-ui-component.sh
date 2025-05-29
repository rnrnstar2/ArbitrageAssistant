#!/bin/bash

# Add shadcn/ui component to @repo/ui package
# Usage: ./scripts/add-ui-component.sh component-name

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

# Check if component name is provided
if [ -z "$1" ]; then
    print_error "Component name is required"
    echo "Usage: $0 <component-name>"
    echo "Example: $0 badge"
    exit 1
fi

COMPONENT_NAME="$1"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages/ui" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

print_info "Adding shadcn/ui component: $COMPONENT_NAME"

# Navigate to UI package directory
cd packages/ui

# Add the component using shadcn
print_info "Installing component with shadcn..."
npx shadcn@latest add "$COMPONENT_NAME" --yes --overwrite

# Check if component file was created
COMPONENT_FILE="src/components/ui/${COMPONENT_NAME}.tsx"
if [ ! -f "$COMPONENT_FILE" ]; then
    print_error "Component file not found: $COMPONENT_FILE"
    exit 1
fi

print_success "Component $COMPONENT_NAME installed"

# Build the UI package to generate types and compiled files
print_info "Building UI package..."
npm run build

print_success "UI package built successfully"

# Go back to root directory
cd ../..

# Add export to package.json exports field
print_info "Updating package.json exports..."

# Use Node.js to update package.json
node -e "
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join('packages', 'ui', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const componentName = '$COMPONENT_NAME';
const exportKey = \`./components/ui/\${componentName}\`;

// Add the export entry
packageJson.exports[exportKey] = {
  'import': \`./dist/components/ui/\${componentName}.js\`,
  'require': \`./dist/components/ui/\${componentName}.js\`,
  'types': \`./dist/components/ui/\${componentName}.d.ts\`
};

// Write back to file with proper formatting
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
"

print_success "package.json exports updated"

# Rebuild UI package with new exports
print_info "Rebuilding UI package with new exports..."
cd packages/ui
npm run build
cd ../..

print_success "Component $COMPONENT_NAME successfully added and configured!"
print_info "You can now import it in your apps:"
echo "  import { ${COMPONENT_NAME^} } from '@repo/ui/components/ui/${COMPONENT_NAME}'"
print_info "Don't forget to commit the changes to git"