#!/bin/bash

# Haconiwa完全クリーン起動スクリプト
# 全Claudeプロセス・tmuxセッション・環境変数ファイルを完全クリーンアップして起動

SESSION_NAME="arbitrage-assistant"

echo "🧹 Haconiwa完全クリーン起動ツール"
echo "=================================="

echo "🔍 現在の状況確認..."

# Claudeプロセス確認
claude_processes=$(ps aux | grep -v grep | grep claude | wc -l | tr -d ' ')
echo "📊 現在のClaudeプロセス数: $claude_processes"

# tmuxセッション確認
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "📊 tmuxセッション: 実行中"
else
    echo "📊 tmuxセッション: 停止中"
fi

# 環境変数ファイル確認
env_files=$(ls -1 /tmp/haconiwa_env_*.sh 2>/dev/null | wc -l | tr -d ' ')
echo "📊 環境変数ファイル数: $env_files"

echo ""
echo "🚨 完全クリーンアップを実行しますか？"
echo "  - 全Claudeプロセス終了"
echo "  - tmuxセッション削除"
echo "  - 環境変数ファイル削除"
echo "  - その後にHaconiwa起動"
echo ""
echo "実行しますか？ [y/N]"
read -r response

if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "❌ キャンセルされました"
    exit 0
fi

echo ""
echo "🧹 完全クリーンアップ開始..."

# Step 1: 全Claudeプロセス終了
echo "🔥 全Claudeプロセス終了中..."
if [ "$claude_processes" -gt 0 ]; then
    pkill -f claude
    sleep 3
    remaining=$(ps aux | grep -v grep | grep claude | wc -l | tr -d ' ')
    if [ "$remaining" -eq 0 ]; then
        echo "✅ Claudeプロセス終了完了"
    else
        echo "⚠️  $remaining 個のプロセスが残存"
    fi
else
    echo "✅ Claudeプロセスなし（既にクリーン）"
fi

# Step 2: tmuxセッション削除
echo "🔥 tmuxセッション削除中..."
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    tmux kill-session -t $SESSION_NAME
    sleep 1
    echo "✅ tmuxセッション削除完了"
else
    echo "✅ tmuxセッションなし（既にクリーン）"
fi

# Step 3: 環境変数ファイル削除
echo "🔥 環境変数ファイル削除中..."
if [ "$env_files" -gt 0 ]; then
    rm -f /tmp/haconiwa_env_*.sh
    echo "✅ 環境変数ファイル削除完了（$env_files 個削除）"
else
    echo "✅ 環境変数ファイルなし（既にクリーン）"
fi

# Step 4: 一時ファイル完全クリーンアップ
echo "🔥 一時ファイル完全クリーンアップ中..."
rm -f /tmp/claude-* 2>/dev/null || true
rm -f /tmp/haconiwa-* 2>/dev/null || true
echo "✅ 一時ファイルクリーンアップ完了"

echo ""
echo "✅ 完全クリーンアップ完了！"
echo ""
echo "🚀 Haconiwa起動中..."
sleep 2

# Haconiwa起動
exec "$(dirname "$0")/haconiwa-start.sh"