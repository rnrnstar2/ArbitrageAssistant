#!/bin/bash

# 全システム クリーンスタートスクリプト
# President + Team 両方のターミナルを完全にクリアしてから起動

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PRESIDENT_SESSION="president"
TEAM_SESSION="team"

echo "🧹 全システム クリーンスタート開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 対象: President Terminal + Team Terminal"
echo ""

# 1. 全tmuxセッション確認・終了
echo "🔄 全tmuxセッション確認・終了中..."
echo "   📋 既存セッション一覧:"
tmux list-sessions 2>/dev/null || echo "   ℹ️  既存セッションなし"

# President セッション終了
if tmux has-session -t $PRESIDENT_SESSION 2>/dev/null; then
    echo "   🏛️  President セッション終了中..."
    tmux kill-session -t $PRESIDENT_SESSION
    echo "   ✅ President セッション終了完了"
fi

# Team セッション終了
if tmux has-session -t $TEAM_SESSION 2>/dev/null; then
    echo "   🗄️  Team セッション終了中..."
    tmux kill-session -t $TEAM_SESSION
    echo "   ✅ Team セッション終了完了"
fi

# その他の関連セッション終了
OTHER_SESSIONS=$(tmux list-sessions 2>/dev/null | grep -E "(arbitrage|ceo|haconiwa)" | cut -d: -f1 || true)
if [ -n "$OTHER_SESSIONS" ]; then
    echo "   🔧 関連セッション終了中..."
    echo "$OTHER_SESSIONS" | while read session; do
        if [ -n "$session" ]; then
            echo "      - $session"
            tmux kill-session -t "$session" 2>/dev/null || true
        fi
    done
    echo "   ✅ 関連セッション終了完了"
fi

# 2. 関連プロセス確認
echo "🔍 関連プロセス確認中..."
CLAUDE_PROCESSES=$(ps aux | grep -E "(claude|arbitrage-assistant)" | grep -v grep | wc -l | tr -d ' ')
if [ "$CLAUDE_PROCESSES" -gt 0 ]; then
    echo "   ⚠️  Claude関連プロセス発見: $CLAUDE_PROCESSES 個"
    echo "   💡 必要に応じて手動確認: ps aux | grep claude"
else
    echo "   ✅ 関連プロセス問題なし"
fi

# 3. ログ・一時ファイル完全クリア
echo "🗑️  ログ・一時ファイル完全クリア中..."
cd "$PROJECT_ROOT"

# 通信ログクリア
LOG_FILE="$PROJECT_ROOT/logs/agent_communication.log"
if [ -f "$LOG_FILE" ]; then
    > "$LOG_FILE"
    echo "   📝 通信ログクリア完了"
fi

# tmux一時ファイル
if [ -d "/tmp/tmux-$(id -u)" ]; then
    find "/tmp/tmux-$(id -u)" -name "*president*" -delete 2>/dev/null || true
    find "/tmp/tmux-$(id -u)" -name "*team*" -delete 2>/dev/null || true
    find "/tmp/tmux-$(id -u)" -name "*arbitrage*" -delete 2>/dev/null || true
    echo "   🗂️  tmux一時ファイルクリア完了"
fi

# プロジェクト内一時ファイル
find . -name "*.tmp" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true
find . -name "*.pid" -delete 2>/dev/null || true

# ログディレクトリ再作成
mkdir -p "$PROJECT_ROOT/logs"

echo "   ✅ すべてのクリーンアップ完了"

# 4. システム安定化待機
echo "⏱️  システム安定化待機中..."
sleep 3

# 5. 選択式起動
echo ""
echo "🚀 起動オプション選択:"
echo "  1) President のみ起動"
echo "  2) Team のみ起動" 
echo "  3) 両方起動（別ターミナル推奨）"
echo "  4) 手動起動（何もしない）"
echo ""
read -p "選択してください (1-4): " choice

case $choice in
    1)
        echo "🏛️  President Terminal 起動中..."
        "$SCRIPT_DIR/president/clean-start.sh"
        ;;
    2)
        echo "🗄️  Team Terminal 起動中..."
        "$SCRIPT_DIR/team/clean-start.sh"
        ;;
    3)
        echo "🎯 両方起動モード"
        echo ""
        echo "⚠️  注意: 2つのターミナルウィンドウが必要です"
        echo ""
        echo "🏛️  President Terminal 起動中..."
        
        # Presidentセッション作成（自動接続なし）
        tmux new-session -d -s $PRESIDENT_SESSION -c "${PROJECT_ROOT}"
        tmux send-keys -t $PRESIDENT_SESSION "clear" C-m
        tmux send-keys -t $PRESIDENT_SESSION "echo '🧹 President Terminal - クリーンスタート完了'" C-m
        tmux send-keys -t $PRESIDENT_SESSION "echo '🏛️ 役割: MVP完成戦略立案・全20エージェント指示権限'" C-m
        tmux send-keys -t $PRESIDENT_SESSION "echo '📡 機能: ./agent-send.sh による直接指示・進捗監視・品質管理'" C-m
        tmux send-keys -t $PRESIDENT_SESSION "echo '✨ 準備完了 - Ready for commands!'" C-m
        
        echo "   ✅ President セッション作成完了"
        
        echo "🗄️  Team Terminal 起動中..."
        "$SCRIPT_DIR/team/clean-start.sh" &
        
        sleep 2
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ 全システム クリーンスタート完了"
        echo ""
        echo "📡 接続方法:"
        echo "   President: tmux attach -t $PRESIDENT_SESSION"
        echo "   Team:      tmux attach -t $TEAM_SESSION"
        echo ""
        echo "🎯 システム状況: ./agent-send.sh status"
        exit 0
        ;;
    4)
        echo "📋 手動起動モード"
        echo ""
        echo "💡 利用可能コマンド:"
        echo "   npm run president:clean    # President クリーンスタート"
        echo "   npm run team:clean         # Team クリーンスタート"
        echo "   npm run president          # President 通常起動"
        echo "   npm run team               # Team 通常起動"
        ;;
    *)
        echo "❌ 無効な選択です"
        exit 1
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 全システム クリーンスタート完了"
echo "🧹 すべてのクリーンアップ処理完了"