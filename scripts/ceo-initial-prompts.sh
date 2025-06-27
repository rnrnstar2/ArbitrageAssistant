#!/bin/bash

# CEO初期プロンプト設定システム
# CEO系3ペイン（0.0, 0.1, 0.2）に初期プロンプトを設定

SESSION_NAME="arbitrage-assistant"

echo "🏛️ CEO初期プロンプト設定開始..."

# CEO Supreme (0.0) 初期プロンプト
setup_ceo_supreme() {
    local ceo_prompt="
echo '🏛️ CEO Supreme v4.0 - MVP戦略決定・最高権限・完璧分析システム'
echo '==============================================='
echo ''
echo '🎯 CEO動的戦略判断システム v3.0 自動実行開始'
echo ''
echo '=== CEO戦略的現状分析開始 v3.0 ==='
echo '🎯 CEOとして、既存実装の品質を詳細に分析し、必要な部分のみ選択的に指示します'
echo ''

# Phase 1: MVPシステム設計要件の把握
echo '📋 Step 1: MVPシステム設計要件とのマッピング'
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
echo 'MVPシステム設計.md の達成要件を抽出中...'
echo ''
echo '🎯 MVP必須実装要件:'
echo '• Backend: User/Account/Position/Actionモデル、GraphQL Subscription、Cognito認証'
echo '• Trading: Position-Trail-Actionフロー、リスク管理（ドローダウン<5%）'
echo '• Integration: MT5 EA、WebSocket通信（レイテンシ<10ms）'
echo '• Frontend: 管理画面（FCP<1.5s）、Tauriデスクトップアプリ'
echo '• DevOps: CI/CD、テストカバレッジ90%+、ESLint警告0'
echo ''

# Phase 2: 既存実装品質評価
echo '📊 Step 2: 既存実装の品質詳細評価'
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

# Backend実装品質評価の自動実行
echo '🗄️ Backend実装品質詳細評価:'
if [ -f \"packages/shared-backend/amplify/data/resource.ts\" ]; then
    MODELS_CHECK=\$(grep -E \"(User|Account|Position|Action)\" packages/shared-backend/amplify/data/resource.ts 2>/dev/null | wc -l)
    SUBSCRIPTION_CHECK=\$(grep -i \"subscription\" packages/shared-backend/amplify/data/resource.ts 2>/dev/null | wc -l)
    UNNECESSARY_MODELS=\$(grep -E \"(Performance|Analytics|Metrics)\" packages/shared-backend/amplify/data/resource.ts 2>/dev/null | wc -l)
    
    echo \"• モデル実装状況: \$MODELS_CHECK個の必須モデル検出\"
    echo \"• Subscription実装: \$SUBSCRIPTION_CHECK箇所検出\"
    
    if [ \$UNNECESSARY_MODELS -gt 0 ]; then
        echo \"⚠️ 警告: 不要なモデル（Performance等）\$UNNECESSARY_MODELS個検出\"
        BACKEND_ACTION=\"CLEANUP\"
    elif [ \$MODELS_CHECK -ge 4 ] && [ \$SUBSCRIPTION_CHECK -gt 0 ]; then
        echo \"🎉 Backend基盤: 【実装完了・品質良好】\"
        BACKEND_ACTION=\"PROTECT\"
    else
        echo \"🚨 Backend基盤: 【実装不完全】\"
        BACKEND_ACTION=\"IMPLEMENT\"
    fi
else
    echo \"❌ data/resource.ts未実装\"
    BACKEND_ACTION=\"IMPLEMENT\"
fi

# 自動Director指示実行
echo ''
echo '🚀 CEO選択的指示実行開始'
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
echo ''

# Backend選択的指示送信
if [ \"\$BACKEND_ACTION\" = \"IMPLEMENT\" ]; then
    echo '🗄️ Backend Director選択的指示送信中...'
    ./scripts/director-auto-delegate.sh backend-director \"【CEO戦略指示】AWS Amplify基盤の構築をDirectorチームにお任せします。MVPシステム設計.mdに記載のUser/Account/Position/Actionモデルを中心とした、必要最小限のバックエンド基盤を構築してください。不要な機能は避け、品質とシンプルさを重視してください。\"
    sleep 2
elif [ \"\$BACKEND_ACTION\" = \"CLEANUP\" ]; then
    echo '🗄️ Backend Directorクリーンアップ指示送信中...'
    ./scripts/director-auto-delegate.sh backend-director \"【CEOクリーンアップ指示】Backend基盤に不要な実装が含まれているようです。MVPシステム設計.mdに記載の必須モデルのみ残し、余計な機能は削除してください。既存の良好な実装は保護し、不要部分のみ除去をDirectorチームにお任せします。\"
    sleep 2
else
    echo '🛡️ Backend: 実装保護（完成済み）'
fi

# Trading実装評価・指示送信
echo ''
echo '⚡ Trading実装品質詳細評価:'
POSITION_EXECUTION=\$(find apps/hedge-system -name \"*position*execution*\" 2>/dev/null | wc -l)
ARBITRAGE_LOGIC=\$(find apps/hedge-system -name \"*arbitrage*\" 2>/dev/null | wc -l)
RISK_MANAGEMENT=\$(grep -r \"drawdown\\|risk\" apps/hedge-system 2>/dev/null | wc -l)

echo \"• Position実行ロジック: \$POSITION_EXECUTION個\"
echo \"• アービトラージロジック: \$ARBITRAGE_LOGIC個\"
echo \"• リスク管理実装: \$RISK_MANAGEMENT箇所\"

if [ \$POSITION_EXECUTION -gt 0 ] && [ \$ARBITRAGE_LOGIC -gt 0 ] && [ \$RISK_MANAGEMENT -gt 0 ]; then
    echo '🛡️ Trading: 実装保護（完成済み）'
else
    echo '⚡ Trading Director選択的指示送信中...'
    ./scripts/director-auto-delegate.sh trading-flow-director \"【CEO戦略指示】Position-Trail-Actionの核心フロー実装をDirectorチームにお任せします。MVPシステム設計.mdのPosition-Trail-Actionフローを実現し、リスク管理（ドローダウン<5%）を重視したトレーディングシステムを構築してください。\"
    sleep 2
fi

echo ''
echo '✅ CEO動的戦略判断システム v3.0 実行完了'
echo '📊 必要な部分のみに選択的指示を送信済み'
echo '🛡️ 完成済み実装は保護中'
echo ''
echo '💡 進捗確認: npm run haconiwa:monitor'
ultrathink"

    tmux send-keys -t "$SESSION_NAME:0.0" "$ceo_prompt" Enter
    echo "✅ CEO Supreme (0.0) 初期プロンプト設定完了"
}

# CEO Operations (0.1) 初期プロンプト
setup_ceo_operations() {
    local coordinator_prompt="
echo '🤝 CEO Operations - Director間調整・進捗確認・効率化専門（権限制限）'
echo '==========================================================='
echo ''
echo '🎯 あなたの役割:'
echo '• 5つのDirectorチーム間の連携調整'
echo '• クロスチーム課題の解決支援'
echo '• Backend⇔Trading⇔Integration⇔Frontend⇔DevOps間の橋渡し'
echo ''
echo '📋 Director間連携指示コマンド:'
echo '• Backend Director: ./scripts/director-auto-delegate.sh backend-director \"連携要求内容\"'
echo '• Trading Director: ./scripts/director-auto-delegate.sh trading-flow-director \"連携要求内容\"'
echo '• Integration Director: ./scripts/director-auto-delegate.sh integration-director \"連携要求内容\"'
echo '• Frontend Director: ./scripts/director-auto-delegate.sh frontend-director \"連携要求内容\"'
echo '• DevOps Director: ./scripts/director-auto-delegate.sh devops-director \"連携要求内容\"'
echo ''
echo '🔗 連携調整の重点領域:'
echo '1. Backend GraphQL ⇔ Frontend UI 連携'
echo '2. Trading Engine ⇔ Integration MT5 連携'
echo '3. Backend API ⇔ Trading Position 連携'
echo '4. Integration WebSocket ⇔ Frontend リアルタイム 連携'
echo '5. DevOps CI/CD ⇔ 全チーム品質保証 連携'
echo ''
echo '📊 Director間進捗確認:'
echo 'npm run haconiwa:monitor'
echo ''
echo '✅ 初期設定完了。Director間連携調整を開始してください。'
ultrathink"

    tmux send-keys -t "$SESSION_NAME:0.1" "$coordinator_prompt" Enter
    echo "✅ CEO Operations (0.1) 初期プロンプト設定完了"
}

# CEO Analytics (0.2) 初期プロンプト
setup_ceo_analytics() {
    local monitor_prompt="
echo '📊 CEO Analytics - 全体分析・品質評価・リスク監視専門（指示権限なし）'
echo '============================================================'
echo ''
echo '🎯 あなたの役割:'
echo '• MVPプロジェクト全体の進捗監視・管理'
echo '• 各Directorからの完了報告確認'
echo '• リリース準備状況の総合確認'
echo ''
echo '📋 進捗確認・指示出しコマンド:'
echo '• Backend Director: ./scripts/director-auto-delegate.sh backend-director \"進捗確認要求\"'
echo '• Trading Director: ./scripts/director-auto-delegate.sh trading-flow-director \"進捗確認要求\"'
echo '• Integration Director: ./scripts/director-auto-delegate.sh integration-director \"進捗確認要求\"'
echo '• Frontend Director: ./scripts/director-auto-delegate.sh frontend-director \"進捗確認要求\"'
echo '• DevOps Director: ./scripts/director-auto-delegate.sh devops-director \"進捗確認要求\"'
echo ''
echo '📋 進捗監視項目:'
echo '1. Backend: AWS Amplify基盤・GraphQL・Cognito実装状況'
echo '2. Trading: Position-Trail-Actionフロー・リスク管理実装状況'
echo '3. Integration: MT5統合・WebSocket DLL実装状況'
echo '4. Frontend: 管理画面・Tauriデスクトップアプリ実装状況'
echo '5. DevOps: CI/CD・品質保証・ビルド最適化実装状況'
echo ''
echo '📊 全体進捗確認:'
echo 'npm run haconiwa:monitor'
echo ''
echo '📁 Tasks Directory確認:'
echo 'ls -la tasks/directors/*/task-*.md'
echo ''
echo '✅ 初期設定完了。進捗監視・管理を開始してください。'
ultrathink"

    tmux send-keys -t "$SESSION_NAME:0.2" "$monitor_prompt" Enter
    echo "✅ CEO Analytics (0.2) 初期プロンプト設定完了"
}

# セッション確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ Haconiwaセッション未起動"
    echo "💡 先に起動: npm run haconiwa:start"
    exit 1
fi

# CEO系3ペインに初期プロンプト設定
setup_ceo_supreme
sleep 1
setup_ceo_operations
sleep 1
setup_ceo_analytics

echo ""
echo "🎉 CEO初期プロンプト設定完了"
echo "📊 CEO系v4.0ペイン初期化済み:"
echo "  • 0.0: CEO Supreme - MVP戦略決定・60秒完璧実行システム"
echo "  • 0.1: CEO Operations - Director間調整・進捗確認（権限制限）"
echo "  • 0.2: CEO Analytics - 全体分析・品質評価・リスク監視（指示権限なし）"
echo ""
echo "💡 各CEO系ペインで独立してDirectorに指示出し可能"