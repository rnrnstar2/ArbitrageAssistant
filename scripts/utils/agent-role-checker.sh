#!/bin/bash

# Agent Role Checker for Haconiwa System
# Displays current agent role and specialized functions

# Check environment variable
if [ -z "$HACONIWA_AGENT_ID" ]; then
    echo "❌ HACONIWA_AGENT_ID not set"
    echo "手動設定例: export HACONIWA_AGENT_ID='ceo-supreme'"
    exit 1
fi

echo "🎭 Current Agent Role: $HACONIWA_AGENT_ID"
echo ""

# Role-specific information
case "$HACONIWA_AGENT_ID" in
    "ceo-supreme")
        echo "🏛️ CEO Supreme - MVP戦略決定・完全自動化・完璧分析システム"
        echo "専門領域: 戦略的意思決定、Director統括、MVP全体管理"
        echo "主要機能: 動的戦略判断システム、Director指示送信、進捗監視"
        ;;
    "ceo-operations")
        echo "🤝 CEO Operations - Director間調整・Tasks Directory v2.0統合監視"
        echo "専門領域: Directors間コミュニケーション、クロスチーム課題解決"
        echo "主要機能: 自律動作、連携調整、課題解決"
        ;;
    "ceo-analytics")
        echo "📊 CEO Analytics - 全体分析・完全自動化フロー監視・品質評価"
        echo "専門領域: 進捗管理、Directors間調整、リリース準備確認"
        echo "主要機能: 自律動作、進捗監視、リスク監視"
        ;;
    "backend-director")
        echo "🗄️ Backend Director - AWS Amplify Gen2 + GraphQL + userIdベース最適化"
        echo "専門領域: AWS Amplify Gen2、GraphQL設計、認証システム"
        ;;
    "trading-flow-director")
        echo "⚡ Trading Flow Director - コア実行フロー戦略・Position-Trail-Actionフロー"
        echo "専門領域: トレーディングフロー、Position管理、リスク管理"
        ;;
    "integration-director")
        echo "🔌 Integration Director - MT4/MT5統合戦略・外部API連携"
        echo "専門領域: MT4/MT5統合、WebSocket通信、外部API連携"
        ;;
    "frontend-director")
        echo "🎨 Frontend Director - 管理画面・デスクトップUI・ユーザー体験"
        echo "専門領域: React/Next.js、Tauri v2、UI/UX設計"
        ;;
    "devops-director")
        echo "🚀 DevOps Director - インフラ最適化・品質保証・CI/CD"
        echo "専門領域: インフラ、CI/CD、監視、品質管理"
        ;;
    *)
        echo "🔧 Specialist Agent: $HACONIWA_AGENT_ID"
        echo "専門領域: 特定技術領域の実装・最適化"
        ;;
esac

echo ""

# 前回サイクル実行結果確認
echo "🔍 前回実行結果確認中..."
if [ -f "scripts/utils/check-previous-cycle.sh" ]; then
    chmod +x "scripts/utils/check-previous-cycle.sh"
    ./scripts/utils/check-previous-cycle.sh
else
    echo "⚠️ 前回実行結果確認システムが見つかりません"
    echo ""
fi

echo "📋 Next Actions:"
echo "• 役割完遂チェック: ./scripts/utils/role-completion-system.sh"
echo "• 設計書確認: cat MVPシステム設計.md"
echo "• 技術要件確認: grep -A 20 '$HACONIWA_AGENT_ID' arbitrage-assistant.yaml"