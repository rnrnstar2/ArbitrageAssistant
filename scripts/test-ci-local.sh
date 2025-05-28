#!/bin/bash

echo "🔧 Testing GitHub Actions locally..."

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "❌ 'act' is not installed. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install act
    else
        echo "Please install act manually: https://github.com/nektos/act"
        exit 1
    fi
fi

# Test the hedge-system CI workflow
echo "🚀 Running hedge-system CI workflow locally..."
act -W .github/workflows/hedge-system-ci.yml --job lint-and-test

echo "✅ Local CI test completed!"