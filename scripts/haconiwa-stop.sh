#!/bin/bash

# Haconiwa (箱庭) Safe Environment Shutdown
# 開発環境を安全に終了

set -e

SESSION_NAME="arbitrage-assistant"

echo "🧹 Haconiwa (箱庭) 安全終了開始..."

# 1. 各ウィンドウでClaudeを正常終了
echo "📝 各Claude Codeセッションを正常終了中..."

# アクティブなウィンドウを取得
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    # 各ウィンドウでCtrl+Cを送信（graceful shutdown）
    for window in $(tmux list-windows -t $SESSION_NAME -F "#{window_index}"); do
        echo "  Window $window: Claude Code正常終了中..."
        tmux send-keys -t $SESSION_NAME:$window C-c 2>/dev/null || true
        # 短い待機時間を与える
        sleep 0.5
    done
    
    # 少し待ってからセッション削除
    echo "⏳ Claude Code設定保存のため3秒待機..."
    sleep 3
    
    # セッション削除
    echo "🗑️ tmuxセッション削除中..."
    tmux kill-session -t $SESSION_NAME
else
    echo "ℹ️ セッション '$SESSION_NAME' は既に存在しません"
fi

echo "✅ Haconiwa (箱庭) 安全終了完了！"
echo "💡 次回: npm run haconiwa:start で安全に起動できます"