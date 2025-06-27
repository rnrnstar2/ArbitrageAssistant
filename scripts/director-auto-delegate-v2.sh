#!/bin/bash

# Director Auto Delegate System v2.0 - Tasks Directory Integration
# Directorが指示受信後、Tasks Directoryにタスクファイルを作成し、Specialistに通知

set -e

# Director役割に基づく自動指示送信関数（Tasks Directory版）
auto_delegate_with_tasks() {
    local director_id="$1"
    local task_description="$2"
    
    echo "🎯 $director_id: Tasks Directory連携による配下指示システム開始..."
    
    # Director → 部門マッピング
    local department
    case "$director_id" in
        "backend-director") department="backend" ;;
        "trading-flow-director") department="trading" ;;
        "integration-director") department="integration" ;;
        "frontend-director") department="frontend" ;;
        "devops-director") department="devops" ;;
        *)
            echo "❌ 未知のDirector ID: $director_id"
            return 1
            ;;
    esac
    
    echo "📂 部門: $department"
    echo "📝 指示内容: $task_description"
    
    # 部門別Specialist配置とタスク作成
    case "$director_id" in
        "backend-director")
            create_backend_tasks "$task_description"
            ;;
        "trading-flow-director")
            create_trading_tasks "$task_description"
            ;;
        "integration-director")
            create_integration_tasks "$task_description"
            ;;
        "frontend-director")
            create_frontend_tasks "$task_description"
            ;;
        "devops-director")
            create_devops_tasks "$task_description"
            ;;
    esac
    
    echo "✅ $director_id: Tasks Directory連携指示送信完了"
}

# Backend部門タスク作成関数
create_backend_tasks() {
    local task_desc="$1"
    
    echo "📤 Backend部門タスク作成中..."
    
    # Amplify Gen2 Specialist向けタスク
    local amplify_task="AWS Amplify Gen2実装: $task_desc"
    ./scripts/task-create.sh backend "$amplify_task" amplify-gen2-specialist high
    
    # 作成されたタスクファイルを特定
    local amplify_task_file=$(ls -t tasks/directors/backend/task-*amplify*.md | head -1)
    
    # タスク詳細を追記
    cat >> "$amplify_task_file" << EOF

### 【Backend Director追加指示】
**技術要件詳細**:
- packages/shared-backend/amplify/data/resource.ts 設計・実装
- DynamoDB + GSI設定による最適化
- GraphQL Subscription技術実装
- userIdベースの最適化実装

**参照資料**:
- MVPシステム設計.md「2. データベース設計」セクション必須
- arbitrage-assistant.yaml backend部門技術要件

**完了条件追加**:
- [ ] DynamoDB設計完了・パフォーマンステスト実行
- [ ] GraphQL Subscription動作確認
- [ ] lint・typecheck完全通過
- [ ] Backend Directorへの実装結果・パフォーマンス測定結果報告

**品質要件**:
- レスポンス時間: GraphQLクエリ < 200ms
- 認証処理: JWT検証 < 100ms
- データ整合性: 100%保証
EOF
    
    # Cognito Auth Expert向けタスク
    local cognito_task="Amazon Cognito認証システム統合: $task_desc"
    ./scripts/task-create.sh backend "$cognito_task" cognito-auth-expert high
    
    local cognito_task_file=$(ls -t tasks/directors/backend/task-*cognito*.md | head -1)
    
    cat >> "$cognito_task_file" << EOF

### 【Backend Director追加指示】
**技術要件詳細**:
- Amazon Cognito技術統合・JWT管理実装
- 認証フロー最適化・セキュリティ強化
- userIdベース権限管理システム

**参照資料**:
- MVPシステム設計.md「2-4. 認証・権限設計」セクション
- セキュリティ設計セクション準拠

**完了条件追加**:
- [ ] JWT管理・権限チェック完全実装
- [ ] セキュリティ検証結果
- [ ] Backend Directorへのセキュリティ検証結果報告

**セキュリティ要件**:
- JWT有効期限管理: 適切なrefresh token実装
- 権限チェック: roleベースアクセス制御
- セッション管理: セキュアなセッション実装
EOF
    
    # Specialist通知
    echo "🔔 Backend配下への通知送信..."
    ./scripts/task-notify.sh "$amplify_task_file" amplify-gen2-specialist
    ./scripts/task-notify.sh "$cognito_task_file" cognito-auth-expert
    
    echo "✅ Backend配下タスク作成・通知完了"
}

# Trading部門タスク作成関数
create_trading_tasks() {
    local task_desc="$1"
    
    echo "📤 Trading部門タスク作成中..."
    
    # Entry Flow Specialist向けタスク
    local entry_task="エントリーポジション実行システム: $task_desc"
    ./scripts/task-create.sh trading "$entry_task" entry-flow-specialist high
    
    local entry_task_file=$(ls -t tasks/directors/trading/task-*entry*.md | head -1)
    
    cat >> "$entry_task_file" << EOF

### 【Trading Director追加指示】
**技術要件詳細**:
- apps/hedge-system/lib/position-execution.ts実装
- エントリーポジション作成→トレイル実行→アクション実行フロー
- Position状態遷移ロジック最適化

**参照資料**:
- MVPシステム設計.md「4. 実行パターン詳細」セクション
- 「11. 実行ロジック詳細説明」セクション

**完了条件追加**:
- [ ] Position-Trail-Actionフロー完全実装
- [ ] パフォーマンス測定: エントリー判定 < 100ms
- [ ] リスク評価結果・バックテスト実行
- [ ] Trading Directorへのパフォーマンス・リスク評価報告

**パフォーマンス要件**:
- エントリー判定速度: < 100ms
- 実行成功率: > 99%
- リスク監視: リアルタイム監視実装
EOF
    
    # Settlement Flow Specialist向けタスク
    local settlement_task="ポジション決済・トレールシステム: $task_desc"
    ./scripts/task-create.sh trading "$settlement_task" settlement-flow-specialist high
    
    local settlement_task_file=$(ls -t tasks/directors/trading/task-*settlement*.md | head -1)
    
    cat >> "$settlement_task_file" << EOF

### 【Trading Director追加指示】
**技術要件詳細**:
- ポジション決済→トレール実行→アクション実行システム
- Trail判定アルゴリズム実装・最適化
- ロスカット・自動決済システム

**参照資料**:
- MVPシステム設計.md「実行ロジック詳細説明」セクション
- リスク管理・トレール設定仕様

**完了条件追加**:
- [ ] トレール機能完全実装・テスト完了
- [ ] 決済システム・リトライ機構実装
- [ ] 決済成功率・リスク評価測定
- [ ] Trading Directorへの決済成功率・リスク評価報告

**リスク要件**:
- 決済実行速度: < 200ms
- 決済失敗時: 自動リトライ機構必須
- 最大ドローダウン: < 5%の監視実装
EOF
    
    # Specialist通知
    echo "🔔 Trading配下への通知送信..."
    ./scripts/task-notify.sh "$entry_task_file" entry-flow-specialist
    ./scripts/task-notify.sh "$settlement_task_file" settlement-flow-specialist
    
    echo "✅ Trading配下タスク作成・通知完了"
}

# Integration部門タスク作成関数
create_integration_tasks() {
    local task_desc="$1"
    
    echo "📤 Integration部門タスク作成中..."
    
    # MT5 Connector Specialist向けタスク
    local mt5_task="MT4/MT5 EA開発・取引所連携: $task_desc"
    ./scripts/task-create.sh integration "$mt5_task" mt5-connector-specialist high
    
    local mt5_task_file=$(ls -t tasks/directors/integration/task-*mt5*.md | head -1)
    
    cat >> "$mt5_task_file" << EOF

### 【Integration Director追加指示】
**技術要件詳細**:
- ea/HedgeSystemConnector.mq5実装
- MQL5プログラミング・取引所連携最適化
- MT4/MT5通信プロトコル実装

**参照資料**:
- MVPシステム設計.md「7. WebSocket通信設計」セクション
- MT4/MT5統合仕様・API仕様

**完了条件追加**:
- [ ] MQL5準拠EA実装・動作確認
- [ ] リアルタイム通信対応・レイテンシ測定
- [ ] 通信テスト結果・EA動作確認結果
- [ ] Integration Directorへの通信テスト・動作確認報告

**技術要件**:
- 通信レイテンシ: < 10ms
- EA動作安定性: 99.9%稼働率
- MQL5準拠: 完全互換実装
EOF
    
    # WebSocket Engineer向けタスク
    local websocket_task="WebSocket DLL・通信プロトコル: $task_desc"
    ./scripts/task-create.sh integration "$websocket_task" websocket-engineer high
    
    local websocket_task_file=$(ls -t tasks/directors/integration/task-*websocket*.md | head -1)
    
    cat >> "$websocket_task_file" << EOF

### 【Integration Director追加指示】
**技術要件詳細**:
- ea/websocket-dll/HedgeSystemWebSocket.cpp実装
- C++/Rustプロトコル実装・最適化
- apps/hedge-system/lib/websocket-server.ts統合

**参照資料**:
- MVPシステム設計.md「8. エラーハンドリング設計」セクション
- WebSocket仕様・パフォーマンス要件

**完了条件追加**:
- [ ] C++/Rust実装・MT5互換インターフェース
- [ ] パフォーマンステスト・通信安定性評価
- [ ] エラーハンドリング・復旧機能実装
- [ ] Integration Directorへのパフォーマンス・安定性評価報告

**技術要件**:
- WebSocket latency: < 10ms
- DLL overhead: < 1ms
- C++/Rust実装: メモリ安全・高性能
EOF
    
    # Specialist通知
    echo "🔔 Integration配下への通知送信..."
    ./scripts/task-notify.sh "$mt5_task_file" mt5-connector-specialist
    ./scripts/task-notify.sh "$websocket_task_file" websocket-engineer
    
    echo "✅ Integration配下タスク作成・通知完了"
}

# Frontend部門タスク作成関数
create_frontend_tasks() {
    local task_desc="$1"
    
    echo "📤 Frontend部門タスク作成中..."
    
    # React Specialist向けタスク
    local react_task="React/Next.js管理画面開発: $task_desc"
    ./scripts/task-create.sh frontend "$react_task" react-specialist high
    
    local react_task_file=$(ls -t tasks/directors/frontend/task-*react*.md | head -1)
    
    cat >> "$react_task_file" << EOF

### 【Frontend Director追加指示】
**技術要件詳細**:
- apps/admin/Next.js実装・状態管理最適化
- React + Tailwind CSS実装・レスポンシブデザイン
- GraphQL Subscription連携・リアルタイム更新

**参照資料**:
- MVPシステム設計.md「5-4. 管理者画面」セクション
- 「6. データフロー設計」セクション

**完了条件追加**:
- [ ] shadcn/ui使用・アクセシビリティ準拠
- [ ] パフォーマンス測定・UX評価
- [ ] レスポンシブデザイン・クロスブラウザ対応
- [ ] Frontend Directorへのパフォーマンス・UX評価報告

**UI要件**:
- FCP (First Contentful Paint): < 1.5s
- LCP (Largest Contentful Paint): < 2.5s
- CLS (Cumulative Layout Shift): < 0.1
EOF
    
    # Desktop App Engineer向けタスク
    local tauri_task="Tauri v2デスクトップアプリ開発: $task_desc"
    ./scripts/task-create.sh frontend "$tauri_task" desktop-app-engineer high
    
    local tauri_task_file=$(ls -t tasks/directors/frontend/task-*tauri*.md | head -1)
    
    cat >> "$tauri_task_file" << EOF

### 【Frontend Director追加指示】
**技術要件詳細**:
- apps/hedge-system/Tauri v2デスクトップアプリ開発
- Rust統合・ネイティブ機能活用
- クロスプラットフォーム対応・セキュリティ準拠

**参照資料**:
- MVPシステム設計.md該当セクション
- Tauri v2仕様・Rust統合ガイド

**完了条件追加**:
- [ ] Rust統合・ネイティブ機能実装
- [ ] クロスプラットフォーム動作確認
- [ ] セキュリティ準拠・パフォーマンス測定
- [ ] Frontend Directorへの動作確認・パフォーマンス報告

**技術要件**:
- Rust統合: 完全なType-safe実装
- セキュリティ: sandboxed環境での安全実行
- パフォーマンス: ネイティブレベル性能
EOF
    
    # Specialist通知
    echo "🔔 Frontend配下への通知送信..."
    ./scripts/task-notify.sh "$react_task_file" react-specialist
    ./scripts/task-notify.sh "$tauri_task_file" desktop-app-engineer
    
    echo "✅ Frontend配下タスク作成・通知完了"
}

# DevOps部門タスク作成関数
create_devops_tasks() {
    local task_desc="$1"
    
    echo "📤 DevOps部門タスク作成中..."
    
    # Build Optimization Engineer向けタスク
    local build_task="Turborepo最適化・ビルドパフォーマンス: $task_desc"
    ./scripts/task-create.sh devops "$build_task" build-optimization-engineer medium
    
    local build_task_file=$(ls -t tasks/directors/devops/task-*build*.md | head -1)
    
    cat >> "$build_task_file" << EOF

### 【DevOps Director追加指示】
**技術要件詳細**:
- turbo.json最適化設定・キャッシュ戦略実装
- .github/workflows/CI/CD設定最適化
- ビルドパフォーマンス・並列実行最適化

**参照資料**:
- MVPシステム設計.md「10. パフォーマンス最適化」セクション
- Turborepo最適化ガイド

**完了条件追加**:
- [ ] ビルド時間50%短縮・キャッシュ効率95%以上
- [ ] ベンチマーク結果・最適化効果測定
- [ ] CI/CD効率化・並列実行最適化
- [ ] DevOps Directorへのベンチマーク・最適化効果報告

**パフォーマンス要件**:
- ビルド時間: 現状から50%短縮
- キャッシュ効率: 95%以上
- CI/CD実行時間: 大幅短縮
EOF
    
    # Quality Assurance Engineer向けタスク
    local qa_task="コード品質管理・テスト自動化: $task_desc"
    ./scripts/task-create.sh devops "$qa_task" quality-assurance-engineer medium
    
    local qa_task_file=$(ls -t tasks/directors/devops/task-*qa*.md | head -1)
    
    cat >> "$qa_task_file" << EOF

### 【DevOps Director追加指示】
**技術要件詳細**:
- Vitest + React Testing Library実装
- ESLint品質チェック・CI/CD品質ゲート
- コードカバレッジ向上・品質メトリクス実装

**参照資料**:
- MVPシステム設計.md「9. セキュリティ設計」セクション
- 品質保証・テスト自動化仕様

**完了条件追加**:
- [ ] コードカバレッジ90%以上・Lint警告0・型エラー0
- [ ] 品質メトリクス改善・CI/CD効率化測定
- [ ] テスト自動化・回帰テスト実装
- [ ] DevOps Directorへの品質メトリクス・効率化測定報告

**品質要件**:
- コードカバレッジ: 90%以上
- Lint警告: 0件
- 型エラー: 0件
- テスト成功率: 100%
EOF
    
    # Specialist通知
    echo "🔔 DevOps配下への通知送信..."
    ./scripts/task-notify.sh "$build_task_file" build-optimization-engineer
    ./scripts/task-notify.sh "$qa_task_file" quality-assurance-engineer
    
    echo "✅ DevOps配下タスク作成・通知完了"
}

# メイン実行部分
main() {
    if [ $# -eq 2 ]; then
        echo "🚀 Director Auto Delegate System v2.0 - Tasks Directory Integration"
        echo "=================================================================="
        auto_delegate_with_tasks "$1" "$2"
        echo ""
        echo "📋 Tasks Directory連携完了"
        echo "🔍 タスク確認: ./scripts/task-list.sh --all"
        echo "📊 進捗確認: ./scripts/task-status.sh --all"
    else
        echo "使用法: $0 <director_id> <task_description>"
        echo ""
        echo "Director IDs:"
        echo "  backend-director       - AWS Amplify Gen2 + GraphQL統括"
        echo "  trading-flow-director  - Position-Trail-Action統括"
        echo "  integration-director   - MT4/MT5統合統括"
        echo "  frontend-director      - 管理画面・UI統括"
        echo "  devops-director        - Turborepo・CI/CD統括"
        echo ""
        echo "例:"
        echo "  $0 backend-director 'MVP基盤システム構築'"
        echo "  $0 trading-flow-director 'アービトラージエンジン実装'"
        echo ""
        echo "📁 Tasks Directory:"
        echo "  作成: tasks/directors/<department>/task-XXX-<name>.md"
        echo "  確認: ./scripts/task-list.sh --all"
        echo "  状況: ./scripts/task-status.sh --department <dept>"
    fi
}

# スクリプト実行権限確認
chmod +x "$0" 2>/dev/null || true

# メイン実行
main "$@"