#!/bin/bash

# haconiwa MVP開発環境起動スクリプト
set -e

echo "🏗️  ArbitrageAssistant MVP開発環境を起動中..."

# haconiwaインストール確認
if ! command -v haconiwa &> /dev/null; then
    echo "❌ haconiwaがインストールされていません"
    echo "💡 インストール: pip install haconiwa --upgrade"
    exit 1
fi

# YAML設定適用
echo "⚙️  設定を適用中..."
haconiwa apply -f arbitrage-assistant.yaml

# Space一覧表示
echo "📋 利用可能なスペース:"
haconiwa space list

# Space起動
echo "🚀 ArbitrageAssistant スペースを起動中..."
haconiwa space start -c arbitrage-assistant

echo "✅ MVP開発環境が起動しました！"
echo ""
echo "💡 次のステップ:"
echo "   • CEO Office: haconiwa space attach -c arbitrage-assistant -r room-ceo" 
echo "   • Backend: haconiwa space attach -c arbitrage-assistant -r room-backend"
echo "   • Trading: haconiwa space attach -c arbitrage-assistant -r room-trading"
echo "   • Integration: haconiwa space attach -c arbitrage-assistant -r room-integration"
echo "   • Frontend: haconiwa space attach -c arbitrage-assistant -r room-frontend"
echo "   • DevOps: haconiwa space attach -c arbitrage-assistant -r room-devops"