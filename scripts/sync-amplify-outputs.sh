#!/bin/bash

# Amplify出力ファイルを各アプリに同期するスクリプト

set -e

echo "🔄 Amplify outputs同期中..."

SOURCE_FILE="/Users/rnrnstar/github/ArbitrageAssistant/packages/shared-backend/amplify_outputs.json"
APPS=(
  "/Users/rnrnstar/github/ArbitrageAssistant/apps/hedge-system"
  "/Users/rnrnstar/github/ArbitrageAssistant/apps/admin"
)

if [ ! -f "$SOURCE_FILE" ]; then
  echo "❌ エラー: $SOURCE_FILE が見つかりません"
  echo "   先にAmplify Sandboxを実行してください: npm run backend:dev"
  exit 1
fi

for APP_DIR in "${APPS[@]}"; do
  if [ -d "$APP_DIR" ]; then
    echo "📂 $APP_DIR/amplify_outputs.json を更新中..."
    cp "$SOURCE_FILE" "$APP_DIR/amplify_outputs.json"
    echo "✅ 完了"
  else
    echo "⚠️  ディレクトリが見つかりません: $APP_DIR"
  fi
done

echo "🎉 Amplify outputs同期完了！"