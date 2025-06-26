#!/bin/bash

# haconiwa MVP開発環境起動スクリプト（完全新規環境）
set -e

echo "🏗️  ArbitrageAssistant MVP開発環境を起動中（新規環境）..."

# haconiwaインストール確認
if ! command -v haconiwa &> /dev/null; then
    echo "❌ haconiwaがインストールされていません"
    echo "💡 インストール: pip install haconiwa --upgrade"
    exit 1
fi

# 既存環境完全クリーンアップ
echo "🧹 既存環境をクリーンアップ中..."
tmux kill-session -t arbitrage-assistant 2>/dev/null || true
haconiwa space stop -c arbitrage-assistant 2>/dev/null || true
haconiwa space clean -c arbitrage-assistant 2>/dev/null || true

# 少し待機（tmux完全終了確保）
sleep 2

# YAML設定適用
echo "⚙️  設定を適用中..."
haconiwa apply -f arbitrage-assistant.yaml

# Space一覧表示
echo "📋 利用可能なスペース:"
haconiwa space list

# Space起動（新規環境）
echo "🚀 ArbitrageAssistant スペースを起動中（6 Windows構成）..."
haconiwa space start -c arbitrage-assistant

# 起動確認
sleep 3
echo "🔍 起動状態確認中..."
tmux list-sessions 2>/dev/null || echo "tmuxセッション確認中..."
tmux list-windows -t arbitrage-assistant 2>/dev/null || echo "Window構成確認中..."

echo "✅ MVP開発環境が起動しました！"
echo ""
echo "💡 次のステップ:"
echo "   • CEO Office: haconiwa space attach -c arbitrage-assistant -r room-ceo" 
echo "   • Backend: haconiwa space attach -c arbitrage-assistant -r room-backend"
echo "   • Trading: haconiwa space attach -c arbitrage-assistant -r room-trading"
echo "   • Integration: haconiwa space attach -c arbitrage-assistant -r room-integration"
echo "   • Frontend: haconiwa space attach -c arbitrage-assistant -r room-frontend"
echo "   • DevOps: haconiwa space attach -c arbitrage-assistant -r room-devops"