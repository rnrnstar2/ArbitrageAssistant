#!/bin/bash

# Team Terminal クリーンスタートスクリプト
# 既存セッション・プロセス・一時ファイルを完全にクリアしてから起動
# 5部門×4エージェント（20ペイン）構成

SESSION_NAME="team"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🧹 Team Terminal クリーンスタート開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 既存Teamセッション強制終了
echo "🔄 既存Teamセッションを確認・終了中..."
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

# 6. 新しいTeamセッション起動（5部門×4エージェント）
echo "🚀 新しいTeamセッション起動中..."
cd "$PROJECT_ROOT"

# Teamセッション作成
tmux new-session -d -s $SESSION_NAME -c "${PROJECT_ROOT}"

# 各部門のウィンドウ作成
departments=("backend" "frontend" "integration" "core" "quality")

echo "🏗️  部門構成作成中..."
for i in "${!departments[@]}"; do
    dept="${departments[$i]}"
    
    if [ $i -eq 0 ]; then
        # 最初の部門は既存ウィンドウを使用
        tmux rename-window -t $SESSION_NAME:0 "$dept"
    else
        # 新しいウィンドウを作成
        tmux new-window -t $SESSION_NAME -n "$dept"
    fi
    
    # 各ウィンドウで4ペイン（director + worker1,2,3）を作成
    window="$SESSION_NAME:$dept"
    
    echo "   📁 $dept Department 構成中..."
    
    # Director ペイン（左上）
    tmux send-keys -t $window "clear" C-m
    tmux send-keys -t $window "echo '🎯 ${dept^} Director - 部門統括・タスク配分・品質管理'" C-m
    tmux send-keys -t $window "echo '🧹 クリーンスタート完了'" C-m
    tmux send-keys -t $window "export AGENT_ID=${dept}-director" C-m
    tmux send-keys -t $window "export DEPARTMENT=${dept}" C-m
    
    # Worker1 ペイン（右上）
    tmux split-window -t $window -h
    tmux send-keys -t $window "clear" C-m
    tmux send-keys -t $window "echo '⚡ ${dept^} Worker1 - 専門実装'" C-m
    tmux send-keys -t $window "echo '🧹 クリーンスタート完了'" C-m
    tmux send-keys -t $window "export AGENT_ID=${dept}-worker1" C-m
    tmux send-keys -t $window "export DEPARTMENT=${dept}" C-m
    
    # Worker2 ペイン（左下）
    tmux split-window -t $window.0 -v
    tmux send-keys -t $window "clear" C-m
    tmux send-keys -t $window "echo '⚡ ${dept^} Worker2 - 専門実装'" C-m
    tmux send-keys -t $window "echo '🧹 クリーンスタート完了'" C-m
    tmux send-keys -t $window "export AGENT_ID=${dept}-worker2" C-m
    tmux send-keys -t $window "export DEPARTMENT=${dept}" C-m
    
    # Worker3 ペイン（右下）
    tmux split-window -t $window.1 -v
    tmux send-keys -t $window "clear" C-m
    tmux send-keys -t $window "echo '⚡ ${dept^} Worker3 - 専門実装'" C-m
    tmux send-keys -t $window "echo '🧹 クリーンスタート完了'" C-m
    tmux send-keys -t $window "export AGENT_ID=${dept}-worker3" C-m
    tmux send-keys -t $window "export DEPARTMENT=${dept}" C-m
done

# Backendウィンドウに戻る
tmux select-window -t $SESSION_NAME:backend

# 完了メッセージ
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Team Terminal クリーンスタート完了"
echo "📡 接続方法: tmux attach -t $SESSION_NAME"
echo "🏗️ 部門: backend, frontend, integration, core, quality"
echo "👥 各部門: director + worker1,2,3 (計20ペイン)"
echo "🎯 システム状況: ./agent-send.sh status"
echo "🧹 すべてのクリーンアップ処理完了"
echo ""

# セッションに自動接続
tmux attach -t $SESSION_NAME