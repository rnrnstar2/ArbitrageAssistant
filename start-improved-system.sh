#!/bin/bash

# 🚀 Improved Multi-Agent System Launcher
# Claude Code事前起動・確実実行システム完全版
# 参考: Claude-Code-Communication + 独自改良

echo "🎭 Improved Multi-Agent System起動開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 権限確認
chmod +x agent-send-improved.sh
chmod +x scripts/president/start-with-claude.sh  
chmod +x scripts/team/start-with-claude.sh

echo "✅ 実行権限設定完了"

# 既存セッション終了
echo "🔄 既存システム終了中..."
pkill -f "claude --dangerously-skip-permissions" 2>/dev/null || true
tmux kill-session -t president 2>/dev/null || true
tmux kill-session -t team 2>/dev/null || true
sleep 2

echo "✅ 既存システム終了完了"

# President Terminal起動（Claude Code事前起動版）
echo ""
echo "🏛️ President Terminal起動中（Claude Code事前起動）..."
./scripts/president/start-with-claude.sh

echo "✅ President Terminal起動完了"
sleep 3

# Team Terminal起動（Claude Code事前起動版）
echo ""
echo "🗄️ Team Terminal起動中（Claude Code事前起動 - 20エージェント）..."
./scripts/team/start-with-claude.sh

echo "✅ Team Terminal起動完了"
sleep 2

# システム状況確認
echo ""
echo "🔍 システム状況確認中..."
./agent-send-improved.sh status

echo ""
echo "🎉 Improved Multi-Agent System起動完了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 **改良版システム特徴**:"
echo "   ✅ Claude Code事前起動（全21エージェント）"
echo "   ✅ ultrathink品質自動付加"
echo "   ✅ 実行確実化システム"
echo "   ✅ 役割認識自動化"
echo "   ✅ 重複防止・効率化"
echo ""
echo "📡 **接続方法**:"
echo "   President: npm run president:connect"
echo "   Team:      npm run team:connect"
echo ""
echo "💬 **改良版通信システム**:"
echo "   個別指示: ./agent-send-improved.sh [agent] \"指示内容\""
echo "   部門指示: ./agent-send-improved.sh department [dept] \"指示内容\""
echo "   階層指示: ./agent-send-improved.sh hierarchy [dept] \"指示内容\""
echo "   全体指示: ./agent-send-improved.sh all \"指示内容\""
echo ""
echo "🔍 **システム管理**:"
echo "   状況確認: ./agent-send-improved.sh status"
echo "   一覧確認: ./agent-send-improved.sh list"
echo "   使用方法: ./agent-send-improved.sh help"
echo ""
echo "💡 **使用例**:"
echo "   ./agent-send-improved.sh backend-director \"GraphQL基盤構築開始\""
echo "   ./agent-send-improved.sh hierarchy core \"MVP核心機能実装\""
echo "   ./agent-send-improved.sh all \"システム全体状況報告\""
echo ""
echo "🎯 **問題解決済み**:"
echo "   ❌ input boxに入力されるが実行されない問題"
echo "   ✅ Claude Code事前起動で確実実行"
echo "   ✅ ultrathink品質自動適用"
echo "   ✅ 役割認識自動化・重複防止"
echo ""
echo "🏛️ President準備完了 - User指示受付可能"
echo "🗄️ Team準備完了 - President指示実行待機中"