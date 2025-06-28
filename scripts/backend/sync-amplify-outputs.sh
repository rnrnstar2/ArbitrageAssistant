#!/bin/bash
# Amplify outputs synchronization for monorepo

set -e

# Change to script directory and go to repo root
cd "$(dirname "$0")/.."

BACKEND_CONFIG="packages/shared-backend/amplify_outputs.json"

if [ ! -f "$BACKEND_CONFIG" ]; then
  echo "❌ Backend config not found: $BACKEND_CONFIG"
  echo "   Run Amplify Sandbox first: npm run backend:dev"
  exit 1
fi

echo "🔄 Syncing amplify_outputs.json..."

# Copy to shared-amplify
echo "📂 Updating packages/shared-amplify/amplify_outputs.json..."
cp "$BACKEND_CONFIG" "packages/shared-amplify/amplify_outputs.json"
echo "✅ Completed"

# Copy to apps
echo "📂 Updating apps/admin/amplify_outputs.json..."
cp "$BACKEND_CONFIG" "apps/admin/amplify_outputs.json"
echo "✅ Completed"

echo "📂 Updating apps/hedge-system/amplify_outputs.json..."
cp "$BACKEND_CONFIG" "apps/hedge-system/amplify_outputs.json"
echo "✅ Completed"

echo "🎉 Amplify outputs synced successfully!"