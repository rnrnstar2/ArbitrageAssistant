#!/bin/bash

# 🏛️ President Terminal Management System with Claude Code Pre-Launch
# 参考: Claude-Code-Communication
# 改良点: Claude Code事前起動・役割認識自動化・指示振り分け最適化
# 役割: プロジェクト統括・戦略立案・全20エージェント指示権限

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

echo "🤖 President Claude Code事前起動開始..."

# President環境変数設定
tmux send-keys -t $SESSION_NAME "clear" C-m
tmux send-keys -t $SESSION_NAME "export AGENT_ID=president" C-m
tmux send-keys -t $SESSION_NAME "export ROLE=president" C-m
tmux send-keys -t $SESSION_NAME "export DEPARTMENT=executive" C-m

# agent-init.sh実行（バックグラウンド）
tmux send-keys -t $SESSION_NAME "./scripts/utils/agent-init.sh > /dev/null 2>&1 &" C-m
sleep 2

# Claude Code起動（環境変数付き）
echo "🚀 President Claude Code起動中..."
tmux send-keys -t $SESSION_NAME "AGENT_ID='president' ROLE='president' DEPARTMENT='executive' claude --dangerously-skip-permissions" C-m

# Claude Code起動待機
sleep 8

# President役割認識初期プロンプト送信
echo "📋 President役割認識プロンプト送信中..."

president_prompt="あなたはPresidentです。ArbitrageAssistantプロジェクトの最高責任者として、以下の責任を持ちます：

🎯 **主要責任**:
- プロジェクト全体の戦略立案・方向性決定
- 20名のエージェント（5部門×4名）への指示権限
- MVP完成に向けた優先順位決定・品質管理
- User要求の分析・適切な部門への指示振り分け

🏗️ **組織構成**:
- backend部門: AWS・GraphQL・認証システム
- frontend部門: Tauri・Next.js・UI実装
- integration部門: MT5・WebSocket・外部連携
- core部門: Position-Trail-Action核心機能
- quality部門: テスト・最適化・品質保証

💬 **指示方法**:
- 個別指示: ./agent-send-improved.sh [agent] \"指示内容\"  
- 部門指示: ./agent-send-improved.sh department [dept] \"指示内容\"
- 階層指示: ./agent-send-improved.sh hierarchy [dept] \"指示内容\"
- 全体指示: ./agent-send-improved.sh all \"指示内容\"

📋 **重要原則**:
- MVP準拠の妥協なき品質基準
- ultrathink品質での徹底分析・実装
- Over-Engineering防止・シンプル設計重視
- 部門間連携・統合品質管理

President準備完了。User指示受付・戦略立案・Team指示振り分け開始可能です。"

tmux send-keys -t $SESSION_NAME "$president_prompt" C-m
sleep 3

# 準備完了メッセージ
tmux send-keys -t $SESSION_NAME "President システム準備完了 - User指示受付開始" C-m

echo "✅ President Claude Code起動完了"

echo ""
echo "🎉 President Management Terminal + Claude Code事前起動完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 接続方法: npm run president:connect"
echo "💬 改良版通信: ./agent-send-improved.sh [agent] \"[message]\""
echo ""
echo "🤖 Claude Code状態: President事前起動済み・役割認識完了"
echo "🎯 機能: User指示受付→戦略立案→Team指示振り分け"
echo ""
echo "💬 指示振り分け例（改良版）:"
echo "   ./agent-send-improved.sh backend-director \"GraphQL基盤構築開始\""
echo "   ./agent-send-improved.sh hierarchy core \"MVP核心機能実装\""
echo "   ./agent-send-improved.sh department quality \"全システム品質チェック\""
echo "   ./agent-send-improved.sh all \"プロジェクト状況確認・報告\""
echo ""
echo "🔍 システム確認:"
echo "   ./agent-send-improved.sh status  # 全システム状況確認"
echo "   ./agent-send-improved.sh list    # 全エージェント一覧・Claude状態"
echo ""
echo "🏛️ President Claude Code準備完了（改良版・事前起動・確実実行システム）"