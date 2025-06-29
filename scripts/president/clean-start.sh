#!/bin/bash

# President Terminal クリーンスタートスクリプト
# 既存セッション・プロセス・一時ファイルを完全にクリアしてから起動

SESSION_NAME="president"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🧹 President Terminal クリーンスタート開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 既存Presidentセッション強制終了
echo "🔄 既存Presidentセッションを確認・終了中..."
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "   📋 既存セッション '$SESSION_NAME' 発見"
    tmux kill-session -t $SESSION_NAME
    echo "   ✅ セッション終了完了"
else
    echo "   ℹ️  既存セッションなし"
fi

# 2. 関連Claudeプロセス確認（オプション）
echo "🔍 関連プロセス確認中..."
CLAUDE_PROCESSES=$(ps aux | grep -E "(claude|arbitrage-assistant)" | grep -v grep | wc -l | tr -d ' ')
if [ "$CLAUDE_PROCESSES" -gt 0 ]; then
    echo "   ⚠️  Claude関連プロセス発見: $CLAUDE_PROCESSES 個"
    echo "   💡 手動での確認をお勧めします: ps aux | grep claude"
else
    echo "   ✅ 関連プロセス問題なし"
fi

# 3. 通信ログクリア（オプション）
LOG_FILE="$PROJECT_ROOT/logs/agent_communication.log"
if [ -f "$LOG_FILE" ]; then
    echo "🗑️  通信ログクリア中..."
    > "$LOG_FILE"
    echo "   ✅ ログファイルクリア完了"
fi

# 4. 一時ファイル削除
echo "🗂️  一時ファイルクリア中..."
cd "$PROJECT_ROOT"

# tmux一時ファイル
if [ -d "/tmp/tmux-$(id -u)" ]; then
    find "/tmp/tmux-$(id -u)" -name "*$SESSION_NAME*" -delete 2>/dev/null || true
fi

# プロジェクト内一時ファイル
find . -name "*.tmp" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true

echo "   ✅ 一時ファイルクリア完了"

# 5. 短時間待機（安全な起動のため）
echo "⏱️  システム安定化待機中..."
sleep 2

# 6. 新しいPresidentセッション起動
echo "🚀 新しいPresidentセッション起動中..."
cd "$PROJECT_ROOT"

# 新Presidentセッション作成
tmux new-session -d -s $SESSION_NAME -c "${PROJECT_ROOT}"

# Presidentペイン設定
tmux send-keys -t $SESSION_NAME "clear" C-m
tmux send-keys -t $SESSION_NAME "echo '🧹 President Terminal - クリーンスタート完了'" C-m
tmux send-keys -t $SESSION_NAME "echo '🏛️ 役割: MVP完成戦略立案・全20エージェント指示権限'" C-m
tmux send-keys -t $SESSION_NAME "echo '📡 機能: ./agent-send.sh による直接指示・進捗監視・品質管理'" C-m
tmux send-keys -t $SESSION_NAME "echo ''" C-m
tmux send-keys -t $SESSION_NAME "echo '📋 主要コマンド:'" C-m
tmux send-keys -t $SESSION_NAME "echo '  ./agent-send.sh [agent] \"[message]\" - エージェント指示'" C-m
tmux send-keys -t $SESSION_NAME "echo '  ./agent-send.sh department [dept] \"[message]\" - 部門指示'" C-m
tmux send-keys -t $SESSION_NAME "echo '  ./agent-send.sh all \"[message]\" - 全体指示'" C-m
tmux send-keys -t $SESSION_NAME "echo '  ./agent-send.sh list - エージェント一覧'" C-m
tmux send-keys -t $SESSION_NAME "echo '  ./agent-send.sh status - システム状況'" C-m
tmux send-keys -t $SESSION_NAME "echo ''" C-m
tmux send-keys -t $SESSION_NAME "echo '✨ クリーンスタート完了 - Ready for commands!'" C-m

# 完了メッセージ
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ President Terminal クリーンスタート完了"
echo "📡 接続方法: tmux attach -t $SESSION_NAME"
echo "🎯 システム状況: ./agent-send.sh status"
echo "🧹 すべてのクリーンアップ処理完了"
echo ""

# セッションに自動接続
tmux attach -t $SESSION_NAME