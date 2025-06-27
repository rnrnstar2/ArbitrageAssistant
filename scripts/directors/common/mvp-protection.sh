#!/bin/bash

# 🛡️ Director/Specialist用MVP保護スクリプト
# 作業開始前に実行してMVP準拠を確認

echo "🛡️ MVP保護システム v1.0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 役割確認
echo "📋 Step 1: 役割・責任確認"
if [ -n "$HACONIWA_AGENT_ID" ]; then
    echo "✅ 現在の役割: $HACONIWA_AGENT_ID"
else
    echo "⚠️ 環境変数未設定 - 役割を確認してください"
fi
echo ""

# 2. MVP設計書確認
echo "📖 Step 2: MVP設計書確認必須"
echo "以下を必ず確認してから作業開始："
echo "• cat 'MVPシステム設計.md'"
echo "• grep -A 20 '自分の部門名' arbitrage-assistant.yaml"
echo ""

# 3. 編集禁止リスト表示
echo "🚨 Step 3: 編集禁止事項確認"
if [ -f "scripts/directors/common/forbidden-edits.md" ]; then
    echo "✅ 編集禁止リスト:"
    echo "• cat scripts/directors/common/forbidden-edits.md"
else
    echo "❌ 編集禁止リストが見つかりません"
fi
echo ""

# 4. MVP準拠チェック方法
echo "🔍 Step 4: MVP準拠チェック方法"
echo "実装前に以下でチェック："
echo "• ./scripts/mvp-compliance-check.sh <ファイル/ディレクトリ>"
echo ""

# 5. 緊急時対応
echo "🆘 Step 5: 緊急時対応"
echo "MVP範囲外実装を検出した場合："
echo "1. 即座に実装停止"
echo "2. Director/CEOに報告"
echo "3. MVPシステム設計.md再確認"
echo "4. 必要最小限への修正"
echo ""

echo "🎯 原則: 迷ったら実装しない。MVP設計書が絶対基準。"
echo "🛡️ MVP保護システム確認完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"