#!/bin/bash

# Agent Role Checker for Haconiwa System
# Displays current agent role and specialized functions

# Check environment variable
if [ -z "$HACONIWA_AGENT_ID" ]; then
    echo "❌ HACONIWA_AGENT_ID not set"
    echo "手動設定例: export HACONIWA_AGENT_ID='ceo-main'"
    exit 1
fi

echo "🎭 Current Agent Role: $HACONIWA_AGENT_ID"
echo ""

# Role-specific information
case "$HACONIWA_AGENT_ID" in
    "ceo-main")
        echo "🏛️ CEO Main - MVP全体戦略の意思決定・5 Directors動的指示"
        echo "専門領域: 戦略的意思決定、Director統括、MVP全体管理"
        echo "主要機能: 動的戦略判断システム、Director指示送信、進捗監視"
        ;;
    "director-coordinator")
        echo "🤝 Director Coordinator - 5 Directors間連携調整"
        echo "専門領域: Directors間コミュニケーション、クロスチーム課題解決"
        echo "主要機能: 自律動作、連携調整、課題解決"
        ;;
    "progress-monitor")
        echo "📊 Progress Monitor - MVPプロジェクト進捗管理"
        echo "専門領域: 進捗管理、Directors間調整、リリース準備確認"
        echo "主要機能: 自律動作、進捗監視、リリース準備"
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
echo "📋 Next Actions:"
echo "• 設計書確認: cat MVPシステム設計.md"
echo "• 技術要件確認: grep -A 20 '$HACONIWA_AGENT_ID' arbitrage-assistant.yaml"
echo "• 進捗監視: npm run haconiwa:monitor"