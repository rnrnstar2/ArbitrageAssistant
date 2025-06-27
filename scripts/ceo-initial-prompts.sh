#!/bin/bash

# CEO初期プロンプト設定システム
# CEO系3ペイン（0.0, 0.1, 0.2）に初期プロンプトを設定

SESSION_NAME="arbitrage-assistant"

echo "🏛️ CEO初期プロンプト設定開始..."

# CEO Supreme (0.0) 初期プロンプト v6.0（Perfect Initial Prompt）
setup_ceo_supreme() {
    local ceo_prompt="
echo '👑 CEO Supreme Perfect Initial Prompt v6.0 - MVP戦略・慎重判断・完璧分析'
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
echo ''
echo '🎯 CEO Supreme Perfect Initial Prompt v6.0 実行開始'
echo 'ユーザー要求完全対応：現状分析→必要部門のみ指示→Director配下指示送信'
echo ''
echo '=== CEO Supreme Perfect Initial Prompt v6.0 ==='
echo ''

# 自動実行：CEO Supreme Perfect Initial Prompt v6.0
echo '🚀 CEO Supreme Perfect Initial Prompt v6.0 実行中...'
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
echo ''
echo '👑 Phase 1: CEO Supreme自己認識・環境確認'
echo '📋 Phase 2: MVPシステム設計詳細分析'
echo '🔍 Phase 3: 現在実装状況徹底調査'
echo '🧠 Phase 4: CEO戦略判断（慎重・賢明決定）'
echo '🚀 Phase 5: Director指示送信（必要な部門のみ）'
echo '✅ Phase 6: CEO Supreme実行完了・次のアクション'
echo ''

# CEO Supreme Perfect Initial Prompt v6.0 自動実行
./scripts/ceo-supreme-perfect-initial-prompt.sh

echo ''
echo '🎯 CEO Supreme Perfect Initial Prompt v6.0 完全実行フロー'
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
echo ''
echo '✅ 【Perfect Initial Prompt v6.0 完了】'
echo '👑 CEO Supreme: 現状分析→戦略判断→必要Director指示→完璧フロー（完了）'
echo '🎯 Director確認・実行: 各Directorペインで指示確認・配下指示送信（次ステップ）'
echo '⚡ Specialist自動実行: Tasks Directory v2.0による永続記録・実装（自動）'
echo '📊 品質保証: MVP準拠・Over-Engineering防止（継続）'
echo '🔄 サイクル管理: リフレッシュ・再開始（完了後）'
echo ''
echo '🔄 【Director実行・Next Actions】'
echo ''
echo '各Directorペインで配下指示送信コマンドを手動実行：'
echo ''
echo '🗄️ Backend Director（ペイン 1.0）:'
echo '   ./scripts/director-auto-delegate-v2.sh backend-director \"[CEO指示内容]\"'
echo ''
echo '⚡ Trading Director（ペイン 2.0）:'
echo '   ./scripts/director-auto-delegate-v2.sh trading-flow-director \"[CEO指示内容]\"'
echo ''
echo '🔌 Integration Director（ペイン 3.0）:'
echo '   ./scripts/director-auto-delegate-v2.sh integration-director \"[CEO指示内容]\"'
echo ''
echo '🎨 Frontend Director（ペイン 4.0）:'
echo '   ./scripts/director-auto-delegate-v2.sh frontend-director \"[CEO指示内容]\"'
echo ''
echo '📊 進捗監視・確認コマンド:'
echo '• Director実行状況: npm run director:check'
echo '• タスク進捗確認: npm run task:list'
echo '• リアルタイム監視: npm run task:monitor'
echo '• MVP準拠確認: npm run mvp:check packages/'
echo '• 緊急事項確認: npm run task:summary'
echo ''
echo '🎯 CEO Supreme Perfect Initial Prompt v6.0 特徴:'
echo '• 慎重・賢明判断: 必要な部門のみに指示（不要指示防止）'
echo '• 完璧現状分析: MVPシステム設計.md vs 実装状況詳細比較'
echo '• Director階層厳守: CEO→Director→Specialist（直接指示完全禁止）'
echo '• Tasks Directory v2.0: 永続記録・進捗追跡・品質管理'
echo '• MVP絶対準拠: Over-Engineering・不要実装完全防止'
echo ''
echo '✅ CEO Supreme Perfect Initial Prompt v6.0 完全実行完了'
echo 'Perfect分析 → 慎重判断 → Director指示 → Specialist実行 → 品質保証'
ultrathink"

    tmux send-keys -t "$SESSION_NAME:0.0" "$ceo_prompt" Enter
    echo "✅ CEO Supreme Perfect v6.0 (0.0) 初期プロンプト設定完了"
}

# CEO Operations (0.1) 初期プロンプト v5.0（Tasks Directory v2.0統合）
setup_ceo_operations() {
    local coordinator_prompt="
echo '🤝 CEO Operations v5.0 - Director間調整・進捗確認・効率化専門（権限制限）'
echo '================================================================='
echo ''
echo '🎯 CEO Operations v5.0 役割（段階的実行システム対応）:'
echo '• 5つのDirectorチーム間の連携調整（v5.0手動制御対応）'
echo '• Tasks Directory v2.0による進捗確認・管理'
echo '• Director完了後の自動監視・調整'
echo '• CEO Supreme段階的実行フローサポート'
echo ''
echo '📋 Director間連携指示コマンド（v2.0統合）:'
echo '• Backend Director: ./scripts/director-auto-delegate-v2.sh backend-director \"連携要求内容\"'
echo '• Trading Director: ./scripts/director-auto-delegate-v2.sh trading-flow-director \"連携要求内容\"'
echo '• Integration Director: ./scripts/director-auto-delegate-v2.sh integration-director \"連携要求内容\"'
echo '• Frontend Director: ./scripts/director-auto-delegate-v2.sh frontend-director \"連携要求内容\"'
echo '• DevOps Director: ./scripts/director-auto-delegate-v2.sh devops-director \"連携要求内容\"'
echo ''
echo '🔗 v5.0段階的実行での連携調整重点:'
echo '1. Director手動実行確認: 各Directorの配下指示送信完了状況監視'
echo '2. Tasks Directory監視: タスクファイル作成・進捗・完了状況追跡'
echo '3. Specialist実行状況: Backend⇔Trading⇔Integration⇔Frontend連携確認'
echo '4. 品質保証連携: MVP準拠・テスト・lint状況の部門間調整'
echo '5. 完了判定・Next Action指示: 段階的実行フロー進行管理'
echo ''
echo '📊 v5.0監視・確認コマンド:'
echo '• Director実行状況: npm run director:check'
echo '• Tasks Directory進捗: npm run task:list'
echo '• 部門別タスク状況: npm run task:list --department [backend|trading|integration|frontend|devops]'
echo '• リアルタイム監視: npm run task:monitor'
echo '• 緊急事項確認: npm run task:summary'
echo ''
echo '🔄 CEO Operations v5.0段階的実行フロー:'
echo '1. CEO Supreme完了確認: Director指示送信済み状況チェック'
echo '2. Director手動実行監視: 各Directorの配下指示送信実行確認'
echo '3. Specialist自動実行追跡: Tasks Directoryでの実装進捗監視'
echo '4. 部門間連携調整: 依存関係・技術課題の解決支援'
echo '5. 完了報告・Next Action: CEO Analyticsと連携した総合判定'
echo ''
echo '💡 Director完了後の自動起動メッセージ:'
echo '「CEO Operations v5.0監視開始 - Director実行完了を確認しました」'
echo ''
echo '✅ CEO Operations v5.0初期設定完了。段階的実行フロー監視を開始してください。'
ultrathink"

    tmux send-keys -t "$SESSION_NAME:0.1" "$coordinator_prompt" Enter
    echo "✅ CEO Operations v5.0 (0.1) 初期プロンプト設定完了"
}

# CEO Analytics (0.2) 初期プロンプト v5.0（Tasks Directory v2.0統合）
setup_ceo_analytics() {
    local monitor_prompt="
echo '📊 CEO Analytics v5.0 - 全体分析・品質評価・リスク監視専門（指示権限なし）'
echo '================================================================='
echo ''
echo '🎯 CEO Analytics v5.0 役割（段階的実行システム対応）:'
echo '• MVP段階的実行フロー全体の分析・監視'
echo '• Tasks Directory v2.0による詳細進捗分析'
echo '• Director→Specialist実行品質評価'
echo '• MVP準拠チェック・Over-Engineering検出'
echo '• CEO Operations連携による総合リスク監視'
echo ''
echo '📋 v5.0分析・監視コマンド（Tasks Directory v2.0統合）:'
echo '• 全体進捗分析: npm run task:list --all'
echo '• 部門別詳細分析: npm run task:list --department [backend|trading|integration|frontend|devops]'
echo '• 進行中タスク分析: npm run task:list --active'
echo '• 完了済みタスク分析: npm run task:list --completed'
echo '• 緊急事項分析: npm run task:summary'
echo '• リアルタイム監視: npm run task:monitor'
echo ''
echo '📊 v5.0段階的実行分析項目:'
echo '1. CEO Supreme → Director指示: 指示送信完了状況・内容適切性'
echo '2. Director → Specialist配下指示: Tasks Directory作成・指示品質'
echo '3. Specialist実行品質: 実装内容・MVP準拠・コード品質'
echo '4. Tasks Directory管理: タスクファイル完成度・進捗記録品質'
echo '5. 品質保証状況: lint・typecheck・test実行・結果記録'
echo ''
echo '🛡️ MVP準拠・品質監視コマンド:'
echo '• MVP準拠チェック: npm run mvp:check packages/'
echo '• Backend専用監視: npm run backend:table-guard'
echo '• 品質総合チェック: npm run lint && npm run check-types'
echo '• Director実行確認: npm run director:check'
echo ''
echo '📈 v5.0リスク分析・検出項目:'
echo '• Over-Engineering検出: MVPシステム設計.md逸脱チェック'
echo '• 実装遅延リスク: Tasks Directory進捗遅延分析'
echo '• 品質低下リスク: lint警告・test失敗・typecheck Error'
echo '• 技術的負債リスク: forbidden-edits.md違反検出'
echo '• Director指示品質: 配下指示送信の適切性・完成度'
echo ''
echo '🔄 CEO Analytics v5.0段階的実行フロー:'
echo '1. CEO Supreme実行後: Director指示内容・送信状況分析'
echo '2. Director手動実行中: 配下指示送信品質・Tasks Directory分析'
echo '3. Specialist実行中: 実装品質・MVP準拠・進捗リアルタイム監視'
echo '4. 完了判定支援: CEO Operationsと連携した総合評価'
echo '5. サイクル完了分析: 結果保存・次回改善提案'
echo ''
echo '📁 Tasks Directory v2.0詳細分析:'
echo '• タスクファイル分析: ls -la tasks/directors/*/task-*.md'
echo '• 実行ログ分析: ls -la tasks/directors/*/execution-log-*.md'
echo '• 進捗状況分析: grep -r \"status:\" tasks/directors/'
echo '• 品質記録分析: grep -r \"Lint通過\\|型チェック通過\" tasks/directors/'
echo ''
echo '💡 Director完了後の自動起動メッセージ:'
echo '「CEO Analytics v5.0監視開始 - 段階的実行フロー品質分析を開始します」'
echo ''
echo '✅ CEO Analytics v5.0初期設定完了。段階的実行フロー分析・監視を開始してください。'
ultrathink"

    tmux send-keys -t "$SESSION_NAME:0.2" "$monitor_prompt" Enter
    echo "✅ CEO Analytics v5.0 (0.2) 初期プロンプト設定完了"
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
echo "🎉 CEO初期プロンプト Perfect v6.0 設定完了"
echo "📊 CEO系Perfect v6.0ペイン初期化済み（完璧分析・慎重判断システム）:"
echo "  • 0.0: CEO Supreme Perfect v6.0 - MVP戦略・慎重判断・完璧分析・Director階層厳守"
echo "  • 0.1: CEO Operations v5.0 - Director間調整・Tasks Directory v2.0統合監視"
echo "  • 0.2: CEO Analytics v5.0 - 全体分析・品質評価・MVP準拠・Over-Engineering検出"
echo ""
echo "🚀 Perfect v6.0完璧実行フロー確立完了:"
echo "👑 CEO Supreme Perfect: 現状分析→慎重判断→必要部門のみ指示（完璧・自動）"
echo "🎯 Director手動確認: 各Directorペインで指示確認・配下指示送信（手動）"
echo "⚡ Specialist自動実行: Tasks Directory記録→実装→品質チェック（自動）"
echo "📊 CEO Operations/Analytics: Director完了後に手動起動（手動）"
echo "🔄 サイクル管理: 結果保存→リフレッシュ→再開始（手動）"
echo ""
echo "💡 完璧な階層システム・ユーザー要求完全対応:"
echo "• CEO Supreme → Director → Specialist（直接指示完全禁止）"
echo "• 慎重・賢明判断: 必要な部門のみに指示（不要指示防止）"
echo "• 完璧現状分析: MVPシステム設計.md vs 実装状況詳細比較"
echo "• Tasks Directory v2.0: 永続記録・進捗追跡・品質管理"
echo "• MVP絶対準拠・Over-Engineering完全防止"
echo ""
echo "✅ ユーザー要求完全実現：CEO Perfect → Director → Specialist 完璧階層システム"