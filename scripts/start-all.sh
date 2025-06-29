#!/bin/bash

# 🚀 Complete Multi-Agent System Startup
# 参考: https://github.com/nishimoto265/Claude-Code-Communication
# 機能: 全ワークスペース起動 + 各ペインでClaude Code自動実行

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Complete Multi-Agent System 起動開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# tmux設定ファイル読み込み
if [ -f "$PROJECT_ROOT/.tmux.conf" ]; then
    echo "⚙️ tmux設定ファイル読み込み中..."
    tmux source-file "$PROJECT_ROOT/.tmux.conf" 2>/dev/null || true
    echo "✅ tmux設定ファイル読み込み完了"
else
    echo "⚠️ tmux設定ファイルが見つかりません: $PROJECT_ROOT/.tmux.conf"
fi

# 既存セッション削除
echo "🧹 既存セッションクリーンアップ..."
tmux kill-session -t president 2>/dev/null || true
tmux kill-session -t team 2>/dev/null || true

# President Terminal起動
echo "🏛️ President Terminal起動..."
"$SCRIPT_DIR/president/start.sh"

# Team Terminal起動  
echo "🗄️ Team Terminal起動..."
"$SCRIPT_DIR/team/start.sh"

# 全ペインでClaude Code自動実行（21ペイン）
echo "⚡ Claude Code自動実行開始（全21ペイン）..."

# President ペインでClaude Code起動（指示振り分け専用）
echo "  🏛️ President: Claude Code起動中（指示振り分け専用）..."
# PresidentはUser指示を受けて./agent-send.shで他エージェントに振り分け
tmux send-keys -t president:0 C-c  # 現在の処理を停止
sleep 0.5
tmux send-keys -t president:0 "clear" C-m
tmux send-keys -t president:0 "claude --dangerously-skip-permissions" C-m

# Team各部門でClaude Code実行（20ペイン）
departments=("backend" "frontend" "integration" "core" "quality")

for dept in "${departments[@]}"; do
    echo "  🗄️ $dept Department: Claude Code起動中..."
    
    # Director
    tmux send-keys -t team:$dept.0 C-c  # 現在の処理を停止
    sleep 0.3
    tmux send-keys -t team:$dept.0 "clear" C-m
    tmux send-keys -t team:$dept.0 "claude --dangerously-skip-permissions" C-m
    sleep 0.5  # 起動タイミング調整
    
    # Workers
    for i in {1..3}; do
        tmux send-keys -t team:$dept.$i C-c  # 現在の処理を停止
        sleep 0.3
        tmux send-keys -t team:$dept.$i "clear" C-m
        tmux send-keys -t team:$dept.$i "claude --dangerously-skip-permissions" C-m
        sleep 0.5  # 起動タイミング調整
    done
done

echo ""
echo "⏳ Claude Code起動完了待機中（3秒）..."
sleep 3

echo ""
echo "✅ Complete Multi-Agent System起動完了（全21ペインでClaude Code実行中）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔥 Claude Code Status:"
echo "  🏛️ President: 1ペイン（指示振り分け専用・./agent-send.sh使用）"
echo "  🗄️ Team: 20ペイン（タスク実行専用・claude --dangerously-skip-permissions）"
echo "  💯 Total: 21ペイン全てでClaude Code待機中"
echo "  📍 役割分担: User→President→Team の完全な指示連携システム"
echo ""
echo "📡 接続方法:"
echo "  President Terminal: npm run president:connect"
echo "  Team Terminal:      npm run team:connect"
echo ""
echo "💬 使用方法:"
echo "  1. User → President Claude Code: 直接指示"  
echo "  2. President → Team: ./agent-send.sh で指示振り分け"
echo "     ./agent-send.sh [agent] \"[message]\"          # 個別指示"
echo "     ./agent-send.sh hierarchy [dept] \"[message]\"  # 階層的送信"
echo "     ./agent-send.sh department [dept] \"[message]\" # 部門全体指示"
echo "     ./agent-send.sh all \"[message]\"              # 全体指示"
echo "     ./agent-send.sh status                        # システム状況"
echo ""
echo "🎯 All 21 Claude Code agents ready for collaboration!"