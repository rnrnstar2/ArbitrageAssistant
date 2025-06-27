#!/bin/bash

# Director Auto Delegate System
# Directorが指示受信後、自動的に配下のSpecialistに指示を送信する

set -e

# Director役割に基づく自動指示送信関数
auto_delegate_to_specialists() {
    local director_id="$1"
    local task_description="$2"
    
    echo "🎯 $director_id: 配下Specialistへの自動指示送信開始..."
    
    case "$director_id" in
        "backend-director")
            echo "📤 Backend配下への指示送信..."
            
            # Amplify Gen2 Specialist指示
            tmux send-keys -t arbitrage-assistant:1.1 " && echo '【Backend Director指示受信】$task_description' && echo 'タスク: AWS Amplify Gen2 data/resource.ts設計・GraphQL実装' && echo '要件: MVPシステム設計.mdのデータベース設計セクション準拠' && echo '完了後: Backend Directorに実装結果・パフォーマンス測定結果報告' && echo '品質要件: lint・typecheck通過必須' ultrathink" Enter
            
            # Cognito Auth Expert指示
            tmux send-keys -t arbitrage-assistant:1.2 " && echo '【Backend Director指示受信】$task_description' && echo 'タスク: Amazon Cognito認証システム統合・JWT管理実装' && echo '要件: MVPシステム設計.mdの認証・権限設計セクション準拠' && echo '完了後: Backend Directorに実装結果・セキュリティ検証結果報告' && echo 'セキュリティ要件: JWT管理・権限チェック完全実装' ultrathink" Enter
            
            echo "✅ Backend配下指示送信完了: amplify-gen2-specialist, cognito-auth-expert"
            ;;
            
        "trading-flow-director")
            echo "📤 Trading配下への指示送信..."
            
            # Entry Flow Specialist指示
            tmux send-keys -t arbitrage-assistant:2.1 " && echo '【Trading Director指示受信】$task_description' && echo 'タスク: エントリーポジション作成→トレイル実行→アクション実行システム実装' && echo '要件: MVPシステム設計.mdの実行パターン詳細セクション準拠' && echo '完了後: Trading Directorにパフォーマンス測定結果・リスク評価含めて報告' && echo 'パフォーマンス要件: エントリー判定 < 100ms' ultrathink" Enter
            
            # Settlement Flow Specialist指示
            tmux send-keys -t arbitrage-assistant:2.2 " && echo '【Trading Director指示受信】$task_description' && echo 'タスク: ポジション決済→トレール実行→アクション実行システム実装' && echo '要件: MVPシステム設計.mdの実行ロジック詳細説明セクション準拠' && echo '完了後: Trading Directorにリスク評価結果・決済成功率含めて報告' && echo 'リスク要件: 決済失敗時の自動リトライ機構実装必須' ultrathink" Enter
            
            echo "✅ Trading配下指示送信完了: entry-flow-specialist, settlement-flow-specialist"
            ;;
            
        "integration-director")
            echo "📤 Integration配下への指示送信..."
            
            # MT5 Connector Specialist指示
            tmux send-keys -t arbitrage-assistant:3.1 " && echo '【Integration Director指示受信】$task_description' && echo 'タスク: MT4/MT5 EA開発・MQL5プログラミング・取引所連携実装' && echo '要件: MVPシステム設計.mdのWebSocket通信設計セクション準拠' && echo '完了後: Integration Directorに通信テスト結果・EA動作確認結果含めて報告' && echo '技術要件: MQL5準拠・リアルタイム通信対応' ultrathink" Enter
            
            # WebSocket Engineer指示
            tmux send-keys -t arbitrage-assistant:3.2 " && echo '【Integration Director指示受信】$task_description' && echo 'タスク: WebSocket DLL実装・C++/Rustプロトコル実装' && echo '要件: MVPシステム設計.mdのエラーハンドリング設計セクション準拠' && echo '完了後: Integration Directorにパフォーマンステスト結果・通信安定性評価含めて報告' && echo '技術要件: C++/Rust実装・MT5互換インターフェース' ultrathink" Enter
            
            echo "✅ Integration配下指示送信完了: mt5-connector-specialist, websocket-engineer"
            ;;
            
        "frontend-director")
            echo "📤 Frontend配下への指示送信..."
            
            # React Specialist指示
            tmux send-keys -t arbitrage-assistant:4.1 " && echo '【Frontend Director指示受信】$task_description' && echo 'タスク: React/Next.js開発・状態管理・UI実装' && echo '要件: MVPシステム設計.mdの管理者画面・データフロー設計セクション準拠' && echo '完了後: Frontend Directorにパフォーマンス測定結果・UX評価含めて報告' && echo 'UI要件: shadcn/ui使用・レスポンシブデザイン・アクセシビリティ準拠' ultrathink" Enter
            
            # Desktop App Engineer指示
            tmux send-keys -t arbitrage-assistant:4.2 " && echo '【Frontend Director指示受信】$task_description' && echo 'タスク: Tauri v2デスクトップアプリ開発・Rust統合実装' && echo '要件: MVPシステム設計.mdの該当セクション準拠' && echo '完了後: Frontend Directorにクロスプラットフォーム動作確認結果・パフォーマンス測定含めて報告' && echo '技術要件: Rust統合・ネイティブ機能活用・セキュリティ準拠' ultrathink" Enter
            
            echo "✅ Frontend配下指示送信完了: react-specialist, desktop-app-engineer"
            ;;
            
        "devops-director")
            echo "📤 DevOps配下への指示送信..."
            
            # Build Optimization Engineer指示
            tmux send-keys -t arbitrage-assistant:5.1 " && echo '【DevOps Director指示受信】$task_description' && echo 'タスク: Turborepo最適化・ビルドパフォーマンス・キャッシュ戦略実装' && echo '要件: MVPシステム設計.mdのパフォーマンス最適化セクション準拠' && echo '完了後: DevOps Directorにベンチマーク結果・最適化効果測定含めて報告' && echo 'パフォーマンス要件: ビルド時間50%短縮・キャッシュ効率95%以上' ultrathink" Enter
            
            # Quality Assurance Engineer指示
            tmux send-keys -t arbitrage-assistant:5.2 " && echo '【DevOps Director指示受信】$task_description' && echo 'タスク: コード品質管理・テスト自動化・CI/CD品質ゲート実装' && echo '要件: MVPシステム設計.mdのセキュリティ設計セクション準拠' && echo '完了後: DevOps Directorに品質メトリクス改善結果・CI/CD効率化測定含めて報告' && echo '品質要件: コードカバレッジ90%以上・Lint警告0・型エラー0' ultrathink" Enter
            
            echo "✅ DevOps配下指示送信完了: build-optimization-engineer, quality-assurance-engineer"
            ;;
            
        *)
            echo "❌ 未知のDirector ID: $director_id"
            return 1
            ;;
    esac
    
    echo "🎯 $director_id: 配下への自動指示送信完了"
}

# メイン実行部分
if [ $# -eq 2 ]; then
    auto_delegate_to_specialists "$1" "$2"
else
    echo "使用法: $0 <director_id> <task_description>"
    echo "例: $0 backend-director 'AWS Amplify Gen2基盤構築'"
fi