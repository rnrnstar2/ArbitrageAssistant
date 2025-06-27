#!/bin/bash

# CEO初期プロンプト設定システム
# CEO系3ペイン（0.0, 0.1, 0.2）に初期プロンプトを設定

SESSION_NAME="arbitrage-assistant"

echo "🏛️ CEO初期プロンプト設定開始..."

# CEO Main (0.0) 初期プロンプト
setup_ceo_main() {
    local ceo_prompt="
echo '🏛️ CEO Main - MVP全体戦略の意思決定・5 Directors動的指示'
echo '==============================================='
echo ''
echo '🎯 あなたの役割:'
echo '• MVPシステム設計.mdに基づく戦略的意思決定'
echo '• 5つのDirectorチームへの選択的指示出し'
echo '• プロジェクト全体の戦略的統括'
echo ''
echo '📋 利用可能な指示出しコマンド:'
echo '• Backend Director: ./scripts/director-auto-delegate.sh backend-director \"指示内容\"'
echo '• Trading Director: ./scripts/director-auto-delegate.sh trading-flow-director \"指示内容\"'
echo '• Integration Director: ./scripts/director-auto-delegate.sh integration-director \"指示内容\"'
echo '• Frontend Director: ./scripts/director-auto-delegate.sh frontend-director \"指示内容\"'
echo '• DevOps Director: ./scripts/director-auto-delegate.sh devops-director \"指示内容\"'
echo ''
echo '🧠 戦略的思考フレームワーク:'
echo '1. MVPシステム設計.mdで現在必要な機能を確認'
echo '2. 実装状況を調査（完成済みか未実装か）'
echo '3. 必要な部分のみ選択的に指示出し'
echo '4. 不要な機能は指示しない（実装保護）'
echo ''
echo '📊 現在の進捗確認:'
echo 'npm run haconiwa:monitor'
echo ''
echo '✅ 初期設定完了。戦略的判断を開始してください。'
ultrathink"

    tmux send-keys -t "$SESSION_NAME:0.0" "$ceo_prompt" Enter
    echo "✅ CEO Main (0.0) 初期プロンプト設定完了"
}

# Director Coordinator (0.1) 初期プロンプト
setup_director_coordinator() {
    local coordinator_prompt="
echo '🤝 Director Coordinator - 5 Directors間連携調整・クロスチーム課題解決'
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
    echo "✅ Director Coordinator (0.1) 初期プロンプト設定完了"
}

# Progress Monitor (0.2) 初期プロンプト
setup_progress_monitor() {
    local monitor_prompt="
echo '📊 Progress Monitor - MVPプロジェクト進捗管理・リリース準備確認'
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
    echo "✅ Progress Monitor (0.2) 初期プロンプト設定完了"
}

# セッション確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ Haconiwaセッション未起動"
    echo "💡 先に起動: npm run haconiwa:start"
    exit 1
fi

# CEO系3ペインに初期プロンプト設定
setup_ceo_main
sleep 1
setup_director_coordinator
sleep 1
setup_progress_monitor

echo ""
echo "🎉 CEO初期プロンプト設定完了"
echo "📊 CEO系3ペイン初期化済み:"
echo "  • 0.0: CEO Main - 戦略的意思決定・Director指示"
echo "  • 0.1: Director Coordinator - Director間連携調整"
echo "  • 0.2: Progress Monitor - 進捗監視・リリース準備"
echo ""
echo "💡 各CEO系ペインで独立してDirectorに指示出し可能"