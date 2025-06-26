#!/bin/bash

# Haconiwa 8 Window構成手動セットアップスクリプト（CEO + 5 Directors + 2 Admin）
set -e

echo "🔧 Haconiwa 8 Window構成を手動セットアップ中..."

# セッション存在確認
if ! tmux has-session -t arbitrage-assistant 2>/dev/null; then
    echo "❌ arbitrage-assistantセッションが見つかりません"
    echo "💡 先に 'npm run haconiwa:start' を実行してください"
    exit 1
fi

echo "📊 現在のWindow構成:"
tmux list-windows -t arbitrage-assistant

# 不足WindowがあればDirector Window群を作成
echo "🔧 8 Window構成を完成させます..."

# Backend (Window 3)
if ! tmux list-windows -t arbitrage-assistant | grep -q ":3"; then
    tmux new-window -t arbitrage-assistant:3 -n 'Backend'
    echo "✅ Backend Window作成"
fi

# Trading (Window 4)  
if ! tmux list-windows -t arbitrage-assistant | grep -q ":4"; then
    tmux new-window -t arbitrage-assistant:4 -n 'Trading'
    echo "✅ Trading Window作成"
fi

# Integration (Window 5)
if ! tmux list-windows -t arbitrage-assistant | grep -q ":5"; then
    tmux new-window -t arbitrage-assistant:5 -n 'Integration'
    echo "✅ Integration Window作成"
fi

# Frontend (Window 6)
if ! tmux list-windows -t arbitrage-assistant | grep -q ":6"; then
    tmux new-window -t arbitrage-assistant:6 -n 'Frontend'
    echo "✅ Frontend Window作成"
fi

# DevOps (Window 7)
if ! tmux list-windows -t arbitrage-assistant | grep -q ":7"; then
    tmux new-window -t arbitrage-assistant:7 -n 'DevOps'
    echo "✅ DevOps Window作成"
fi

# Window名を統一
tmux rename-window -t arbitrage-assistant:0 'CEO' 2>/dev/null || true
tmux rename-window -t arbitrage-assistant:1 'Admin' 2>/dev/null || true
tmux rename-window -t arbitrage-assistant:2 'Executive' 2>/dev/null || true

echo "📊 完成したWindow構成:"
tmux list-windows -t arbitrage-assistant

echo ""
echo "✅ 8 Window構成セットアップ完了！"
echo ""
echo "💡 各Windowへのアクセス:"
echo "   🏛️  CEO: tmux select-window -t arbitrage-assistant:0 (メイン作業・複数ペーン)"
echo "   📋 Admin: tmux select-window -t arbitrage-assistant:1 (管理作業)"  
echo "   👔 Executive: tmux select-window -t arbitrage-assistant:2 (役員会議)"
echo "   🗄️  Backend: tmux select-window -t arbitrage-assistant:3 (Backend Director)"
echo "   ⚡ Trading: tmux select-window -t arbitrage-assistant:4 (Trading Director)"
echo "   🔌 Integration: tmux select-window -t arbitrage-assistant:5 (Integration Director)"
echo "   🎨 Frontend: tmux select-window -t arbitrage-assistant:6 (Frontend Director)"
echo "   🚀 DevOps: tmux select-window -t arbitrage-assistant:7 (DevOps Director)"
echo ""
echo "🚀 CEO→5 Directors階層指示フロー準備完了！"