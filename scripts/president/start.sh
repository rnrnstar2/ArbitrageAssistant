#!/bin/bash

# 🏛️ President Terminal Management System
# 参考: Claude-Code-Communication
# 役割: プロジェクト統括・戦略立案・全20エージェント指示権限
# 機能: President管理専用ターミナル + Claude Code対応

SESSION_NAME="president"

# 既存セッションの確認と削除
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "既存のPresidentセッションを終了しています..."
    tmux kill-session -t $SESSION_NAME
fi

# Presidentセッション作成（tmux設定適用）
echo "🏛️ President Management Terminal起動中..."
tmux new-session -d -s $SESSION_NAME -c "${PWD}"

# tmux設定ファイル適用
if [ -f "${PWD}/.tmux.conf" ]; then
    tmux source-file "${PWD}/.tmux.conf" 2>/dev/null || true
fi

# Presidentペイン設定
tmux send-keys -t $SESSION_NAME "clear" C-m
tmux send-keys -t $SESSION_NAME "export AGENT_ID=president" C-m
tmux send-keys -t $SESSION_NAME "export ROLE=president" C-m
tmux send-keys -t $SESSION_NAME "export DEPARTMENT=executive" C-m
tmux send-keys -t $SESSION_NAME "source ./scripts/utils/agent-init.sh" C-m

echo ""
echo "✅ President Management Terminal起動完了（Claude Code指示振り分け専用）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 接続方法: npm run president:connect"
echo "🎯 役割: User指示受付→Team指示振り分け（タスク実行なし）"
echo ""
echo "🤖 Claude Code起動方法（役割認識付き・環境変数対応）:"
echo "   1. 起動案内: start_claude_with_role"
echo "   2. 即座起動: quick_claude_start"
echo "   3. 役割確認: check_role_recognition"
echo "   4. 直接起動: AGENT_ID='president' ROLE='president' DEPARTMENT='executive' claude --dangerously-skip-permissions"
echo ""
echo "💬 指示振り分け例:"
echo "   ./agent-send.sh backend-director \"GraphQL基盤構築開始\""
echo "   ./agent-send.sh hierarchy core \"MVP核心機能実装\""
echo "   ./agent-send.sh all \"システム全体品質チェック\""
echo ""
echo "🏛️ President Claude Code準備完了（指示振り分け専用・役割認識システム統合）"