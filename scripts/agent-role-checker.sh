#!/bin/bash

# Haconiwa Agent Role Checker
# 環境変数HACONIWA_AGENT_IDに基づいて自分の役割を確認するスクリプト

set -e

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m' 
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎭 Haconiwa Agent Role Checker${NC}"
echo "=================================="

# 環境変数確認
if [ -z "$HACONIWA_AGENT_ID" ]; then
    echo -e "${RED}❌ HACONIWA_AGENT_ID が設定されていません${NC}"
    echo "環境変数を設定してください:"
    echo "export HACONIWA_AGENT_ID='your-agent-id'"
    exit 1
fi

echo -e "${GREEN}✅ あなたのエージェントID: ${YELLOW}$HACONIWA_AGENT_ID${NC}"
echo ""

# 役割別詳細定義
case "$HACONIWA_AGENT_ID" in
    "ceo-main")
        echo -e "${PURPLE}🏛️ CEO MAIN - 最高経営責任者${NC}"
        echo "【専門領域】MVP全体戦略の意思決定・5 Directors動的指示"
        echo ""
        echo -e "${RED}🚨 重要：固定指示システム廃止${NC}"
        echo "従来の固定指示テンプレートは戦略的判断を阻害するため廃止"
        echo ""
        echo -e "${GREEN}✅ 動的戦略判断システム採用${NC}"
        echo "現状分析→戦略判断→動的指示作成→実行の完全自律システム"
        echo ""
        echo -e "${YELLOW}📖 CEO動的戦略システム実行:${NC}"
        echo ""
        if [ -f "scripts/ceo-dynamic-strategy.md" ]; then
            echo "【CEO実行コマンド】"
            echo "cat scripts/ceo-dynamic-strategy.md"
            echo ""
            echo "【実行内容】6フェーズ自動実行:"
            echo "1. 詳細現状分析（MVPシステム設計.md vs 実装状況）"
            echo "2. 現在実装状況詳細調査（全部門ファイル数・技術完成度）"
            echo "3. CEO戦略的ギャップ分析（CRITICAL→HIGH→MEDIUM→LOW判定）"
            echo "4. CEO動的指示作成（戦略根拠・具体要件・完了条件）"
            echo "5. CEO戦略的指示実行（Director別条件付き送信）"
            echo "6. CEO戦略実行サマリー（判断根拠・実行結果記録）"
            echo ""
            echo -e "${CYAN}📚 参考ガイド: scripts/ceo-systems/ceo-main-guide.md${NC}"
        else
            echo -e "${RED}❌ CEO動的戦略システムが見つかりません${NC}"
            echo "【緊急対応】現状分析→戦略判断→動的指示作成を手動実行"
        fi
        ;;
    "director-coordinator")
        echo -e "${PURPLE}🏛️ DIRECTOR COORDINATOR - 統括調整官${NC}"
        echo "【専門領域】5 Directors間連携調整・クロスチーム課題解決"
        echo ""
        echo -e "${YELLOW}📖 初期プロンプト実行中...${NC}"
        echo ""
        if [ -f "scripts/ceo-systems/director-coordinator-guide.md" ]; then
            cat "scripts/ceo-systems/director-coordinator-guide.md"
        else
            echo -e "${RED}❌ director-coordinator-guide.md が見つかりません${NC}"
            echo "【主要タスク】"
            echo "1. Directors間の連携状況監視"
            echo "2. クロスチーム課題の特定と解決"
            echo "3. リソース競合の調整"
            echo "4. 進捗ボトルネックの解消"
        fi
        ;;
    "progress-monitor")
        echo -e "${PURPLE}🏛️ PROGRESS MONITOR - 進捗監視官${NC}"
        echo "【専門領域】MVPプロジェクト進捗管理・Directors間調整・リリース準備確認"
        echo ""
        echo -e "${YELLOW}📖 初期プロンプト実行中...${NC}"
        echo ""
        if [ -f "scripts/ceo-systems/progress-monitor-guide.md" ]; then
            cat "scripts/ceo-systems/progress-monitor-guide.md"
        else
            echo -e "${RED}❌ progress-monitor-guide.md が見つかりません${NC}"
            echo "【主要タスク】"
            echo "1. MVPプロジェクト全体進捗監視"
            echo "2. Directors間の調整サポート"
            echo "3. リリース準備状況確認"
            echo "4. 品質ゲート監視"
        fi
        ;;
    "backend-director")
        echo -e "${CYAN}🗄️ BACKEND DIRECTOR - バックエンド部門長${NC}"
        echo "【専門領域】AWS Amplify Gen2 + GraphQL + userIdベース最適化専門"
        echo "【参照セクション】MVPシステム設計.md: 2. データベース設計, 2-4. 認証・権限設計"
        echo "【管理対象】amplify-gen2-specialist, cognito-auth-expert"
        echo "【主要タスク】"
        echo "1. AWS Amplify Gen2アーキテクチャ設計"
        echo "2. GraphQL API設計・実装"
        echo "3. userIdベース最適化戦略"
        echo "4. 配下スペシャリストへのタスク振り分け"
        echo ""
        echo -e "${YELLOW}📖 専用ガイド：scripts/directors/backend-director-guide.md${NC}"
        ;;
    "amplify-gen2-specialist")
        echo -e "${CYAN}🗄️ AMPLIFY GEN2 SPECIALIST - Amplify専門官${NC}"
        echo "【専門領域】AWS Amplify Gen2 data/resource.ts設計・GraphQL実装"
        echo "【主要タスク】"
        echo "1. data/resource.ts設計・実装"
        echo "2. GraphQLスキーマ定義"
        echo "3. Amplify Gen2ベストプラクティス適用"
        echo "4. Backend Directorへの実装報告"
        ;;
    "cognito-auth-expert")
        echo -e "${CYAN}🗄️ COGNITO AUTH EXPERT - 認証専門官${NC}"
        echo "【専門領域】Amazon Cognito認証システム統合・JWT管理"
        echo "【主要タスク】"
        echo "1. Amazon Cognito設定・統合"
        echo "2. JWT認証フロー実装"
        echo "3. ユーザー認証・権限管理"
        echo "4. Backend Directorへの実装報告"
        ;;
    "trading-flow-director")
        echo -e "${YELLOW}⚡ TRADING FLOW DIRECTOR - トレーディング部門長${NC}"
        echo "【専門領域】コア実行フロー戦略・Position-Trail-Actionフロー管理"
        echo "【参照セクション】MVPシステム設計.md: 4. 実行パターン詳細, 11. 実行ロジック詳細説明"
        echo "【管理対象】entry-flow-specialist, settlement-flow-specialist"
        echo "【主要タスク】"
        echo "1. Position-Trail-Actionフロー設計"
        echo "2. アービトラージ実行戦略"
        echo "3. リスク管理フロー"
        echo "4. 配下スペシャリストへのタスク振り分け"
        echo ""
        echo -e "${YELLOW}📖 専用ガイド：scripts/directors/trading-director-guide.md${NC}"
        ;;
    "entry-flow-specialist")
        echo -e "${YELLOW}⚡ ENTRY FLOW SPECIALIST - エントリー専門官${NC}"
        echo "【専門領域】エントリーポジション作成→トレイル実行→アクション実行"
        echo "【主要タスク】"
        echo "1. エントリーポジション作成ロジック"
        echo "2. トレイル実行メカニズム"
        echo "3. アクション実行フロー"
        echo "4. Trading Flow Directorへの実装報告"
        ;;
    "settlement-flow-specialist")
        echo -e "${YELLOW}⚡ SETTLEMENT FLOW SPECIALIST - 決済専門官${NC}"
        echo "【専門領域】ポジション決済→トレール実行→アクション実行"
        echo "【主要タスク】"
        echo "1. ポジション決済ロジック"
        echo "2. 決済トレール実行"
        echo "3. 決済アクション実行"
        echo "4. Trading Flow Directorへの実装報告"
        ;;
    "integration-director")
        echo -e "${GREEN}🔌 INTEGRATION DIRECTOR - 統合部門長${NC}"
        echo "【専門領域】MT4/MT5統合戦略・外部API連携アーキテクチャ設計"
        echo "【参照セクション】MVPシステム設計.md: 7. WebSocket通信設計, 8. エラーハンドリング設計"
        echo "【管理対象】mt5-connector-specialist, websocket-engineer"
        echo "【主要タスク】"
        echo "1. MT4/MT5統合アーキテクチャ"
        echo "2. 外部API連携設計"
        echo "3. 通信プロトコル最適化"
        echo "4. 配下スペシャリストへのタスク振り分け"
        echo ""
        echo -e "${YELLOW}📖 専用ガイド：scripts/directors/integration-director-guide.md${NC}"
        ;;
    "mt5-connector-specialist")
        echo -e "${GREEN}🔌 MT5 CONNECTOR SPECIALIST - MT5連携専門官${NC}"
        echo "【専門領域】MT4/MT5 EA開発・MQL5プログラミング・取引所連携"
        echo "【主要タスク】"
        echo "1. MT4/MT5 EA開発"
        echo "2. MQL5プログラミング"
        echo "3. 取引所連携実装"
        echo "4. Integration Directorへの実装報告"
        ;;
    "websocket-engineer")
        echo -e "${GREEN}🔌 WEBSOCKET ENGINEER - WebSocket専門官${NC}"
        echo "【専門領域】WebSocket DLL実装・C++/Rustプロトコル実装"
        echo "【主要タスク】"
        echo "1. WebSocket DLL実装"
        echo "2. C++/Rustプロトコル実装"
        echo "3. リアルタイム通信最適化"
        echo "4. Integration Directorへの実装報告"
        ;;
    "frontend-director")
        echo -e "${BLUE}🎨 FRONTEND DIRECTOR - フロントエンド部門長${NC}"
        echo "【専門領域】管理画面・デスクトップUI・ユーザー体験専門"
        echo "【参照セクション】MVPシステム設計.md: 5-4. 管理者画面, 6. データフロー設計"
        echo "【管理対象】react-specialist, desktop-app-engineer"
        echo "【主要タスク】"
        echo "1. 管理画面UI/UX設計"
        echo "2. デスクトップアプリ設計"
        echo "3. ユーザー体験最適化"
        echo "4. 配下スペシャリストへのタスク振り分け"
        echo ""
        echo -e "${YELLOW}📖 専用ガイド：scripts/directors/frontend-director-guide.md${NC}"
        ;;
    "react-specialist")
        echo -e "${BLUE}🎨 REACT SPECIALIST - React専門官${NC}"
        echo "【専門領域】React/Next.js開発・状態管理・UI実装"
        echo "【主要タスク】"
        echo "1. React/Next.js開発"
        echo "2. 状態管理実装"
        echo "3. UI コンポーネント実装"
        echo "4. Frontend Directorへの実装報告"
        ;;
    "desktop-app-engineer")
        echo -e "${BLUE}🎨 DESKTOP APP ENGINEER - デスクトップアプリ専門官${NC}"
        echo "【専門領域】Tauri v2デスクトップアプリ開発・Rust統合"
        echo "【主要タスク】"
        echo "1. Tauri v2アプリ開発"
        echo "2. Rust統合実装"
        echo "3. ネイティブ機能統合"
        echo "4. Frontend Directorへの実装報告"
        ;;
    "devops-director")
        echo -e "${RED}🚀 DEVOPS DIRECTOR - DevOps部門長${NC}"
        echo "【専門領域】インフラ最適化・品質保証・CI/CD・監視専門"
        echo "【参照セクション】MVPシステム設計.md: 10. パフォーマンス最適化, 9. セキュリティ設計"
        echo "【管理対象】build-optimization-engineer, quality-assurance-engineer"
        echo "【主要タスク】"
        echo "1. インフラ最適化戦略"
        echo "2. 品質保証プロセス"
        echo "3. CI/CD パイプライン"
        echo "4. 配下エンジニアへのタスク振り分け"
        echo ""
        echo -e "${YELLOW}📖 専用ガイド：scripts/directors/devops-director-guide.md${NC}"
        ;;
    "build-optimization-engineer")
        echo -e "${RED}🚀 BUILD OPTIMIZATION ENGINEER - ビルド最適化専門官${NC}"
        echo "【専門領域】Turborepo最適化・ビルドパフォーマンス・キャッシュ戦略"
        echo "【主要タスク】"
        echo "1. Turborepo最適化"
        echo "2. ビルドパフォーマンス向上"
        echo "3. キャッシュ戦略実装"
        echo "4. DevOps Directorへの実装報告"
        ;;
    "quality-assurance-engineer")
        echo -e "${RED}🚀 QUALITY ASSURANCE ENGINEER - 品質保証専門官${NC}"
        echo "【専門領域】コード品質管理・テスト自動化・CI/CD品質ゲート"
        echo "【主要タスク】"
        echo "1. コード品質管理"
        echo "2. テスト自動化"
        echo "3. CI/CD品質ゲート"
        echo "4. DevOps Directorへの実装報告"
        ;;
    *)
        echo -e "${RED}❌ 未知のエージェントID: $HACONIWA_AGENT_ID${NC}"
        echo "有効なエージェントID一覧:"
        echo "CEO系: ceo-main, director-coordinator, progress-monitor"
        echo "Backend系: backend-director, amplify-gen2-specialist, cognito-auth-expert"
        echo "Trading系: trading-flow-director, entry-flow-specialist, settlement-flow-specialist"
        echo "Integration系: integration-director, mt5-connector-specialist, websocket-engineer"
        echo "Frontend系: frontend-director, react-specialist, desktop-app-engineer"
        echo "DevOps系: devops-director, build-optimization-engineer, quality-assurance-engineer"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}📋 次のステップ${NC}"
echo "1. arbitrage-assistant.yamlで詳細な技術要件を確認"
echo "2. MVPシステム設計.mdで該当セクションを詳細分析"
echo "3. 現在のプロジェクト実装状況をチェック"
echo "4. 自分の専門領域に集中して作業開始"
echo ""
echo -e "${PURPLE}📚 共通リソース${NC}"
echo "• 編集禁止ルール: scripts/directors/common/forbidden-edits.md"
echo "• コードスニペット: scripts/directors/common/code-snippets.md"
echo "• コラボレーション: scripts/directors/common/collaboration-rules.md"
echo ""
echo -e "${BLUE}🎯 専門領域集中モード開始！${NC}"