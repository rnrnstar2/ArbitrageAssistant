#!/bin/bash

# Haconiwa 6 Window構成手動セットアップスクリプト
set -e

echo "🔧 Haconiwa 6 Window構成を手動セットアップ中..."

# セッション存在確認
if ! tmux has-session -t arbitrage-assistant 2>/dev/null; then
    echo "❌ arbitrage-assistantセッションが見つかりません"
    echo "💡 先に 'npm run haconiwa:start' を実行してください"
    exit 1
fi

echo "📊 現在のWindow構成:"
tmux list-windows -t arbitrage-assistant

# 不足WindowがあればBackend以降を作成
echo "🔧 6 Window構成を完成させます..."

# Backend (Window 2)
if ! tmux list-windows -t arbitrage-assistant | grep -q ":2"; then
    tmux new-window -t arbitrage-assistant:2 -n 'Backend'
    echo "✅ Backend Window作成"
fi

# Trading (Window 3)  
if ! tmux list-windows -t arbitrage-assistant | grep -q ":3"; then
    tmux new-window -t arbitrage-assistant:3 -n 'Trading'
    echo "✅ Trading Window作成"
fi

# Integration (Window 4)
if ! tmux list-windows -t arbitrage-assistant | grep -q ":4"; then
    tmux new-window -t arbitrage-assistant:4 -n 'Integration'
    echo "✅ Integration Window作成"
fi

# Frontend (Window 5)
if ! tmux list-windows -t arbitrage-assistant | grep -q ":5"; then
    tmux new-window -t arbitrage-assistant:5 -n 'Frontend'
    echo "✅ Frontend Window作成"
fi

# DevOps (Window 6)
if ! tmux list-windows -t arbitrage-assistant | grep -q ":6"; then
    tmux new-window -t arbitrage-assistant:6 -n 'DevOps'
    echo "✅ DevOps Window作成"
fi

# Window名を統一
tmux rename-window -t arbitrage-assistant:0 'CEO' 2>/dev/null || true
tmux rename-window -t arbitrage-assistant:1 'Admin' 2>/dev/null || true

echo "📊 完成したWindow構成:"
tmux list-windows -t arbitrage-assistant

echo ""
echo "✅ 6 Window構成セットアップ完了！"
echo ""
echo "💡 各Windowへのアクセス:"
echo "   • CEO: tmux select-window -t arbitrage-assistant:0"
echo "   • Admin: tmux select-window -t arbitrage-assistant:1"  
echo "   • Backend: tmux select-window -t arbitrage-assistant:2"
echo "   • Trading: tmux select-window -t arbitrage-assistant:3"
echo "   • Integration: tmux select-window -t arbitrage-assistant:4"
echo "   • Frontend: tmux select-window -t arbitrage-assistant:5"
echo "   • DevOps: tmux select-window -t arbitrage-assistant:6"
echo ""
echo "🚀 各WindowでClaude Code起動準備完了！"