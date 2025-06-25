#!/bin/bash

# Haconiwa正式自律実行スクリプト
# 正しいHaconiwaワークフロー: Claude Code自動起動 + 階層指示配信

set -e

echo "🎯 Haconiwa正式自律実行開始"

# カラー設定
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"
}

# tmuxセッション確認
if ! tmux has-session -t arbitrage-assistant 2>/dev/null; then
    echo "❌ tmuxセッション 'arbitrage-assistant' が見つかりません"
    echo "先に 'npm run start:haconiwa' を実行してください"
    exit 1
fi

# Haconiwaパス設定
HACONIWA_PATH="/Users/rnrnstar/Library/Python/3.9/bin/haconiwa"

# Step 1: 全ウィンドウでClaude Code起動（正しいHaconiwa方式）
log "🤖 全ウィンドウでClaude Code起動中..."
$HACONIWA_PATH space run -c arbitrage-assistant --claude-code --no-confirm

# Claude Code起動待機
log "⏳ Claude Code起動完了待機中（30秒）..."
sleep 30

# Step 2: CEO戦略指示
log "🏛️ CEOへ戦略指示送信中..."
$HACONIWA_PATH space run -c arbitrage-assistant -r room-ceo-office --cmd \
"CEO、ArbitrageAssistant MVPの完成に向けて戦略的分析と指示をお願いします。

【現状分析タスク】
1. 現在のコードベース状況を完全把握
2. MVP設計.md の変更内容確認  
3. hedge-system-core.ts の実装状況確認
4. 削除されたファイルの影響分析

【戦略策定タスク】
1. MVP完成への最短ルート策定
2. 技術的課題の優先順位付け
3. 各部門への具体的タスク分解
4. リスク要因の洗い出し

【実行計画】
各Director（Backend/Trading/Integration/Frontend/DevOps）に対して：
- 具体的な実装タスク指示
- 完了期限と品質基準設定
- 相互依存関係の調整指示

完了後、全体統合計画をultrathinkで報告してください。"

log "✅ CEO戦略指示送信完了"

# 3秒待機（CEO処理時間）
sleep 3

# Backend Director指示
log "🗄️ Backend Directorへ指示送信中..."
$HACONIWA_PATH space run -c arbitrage-assistant -r room-backend --cmd \
"Backend Director、packages/shared-backend/amplify/data/resource.tsにて以下を完璧な品質で完了してください：

1. User, Account, Position, Action モデル完全実装
2. userIdベースGSI設定（高速検索達成）
3. GraphQL Subscription設定（リアルタイム同期）
4. Cognito認証・権限システム構築（CLIENT/ADMIN）

❌ 複雑なリレーション設計は実装禁止
❌ 高度なクエリ最適化は後回し
✅ 基本的なCRUD操作の確実な動作を最優先
✅ MVPシステム設計書v7.0準拠の最小限実装のみ

完了時は「Backend Director、実装完了。テスト結果・パフォーマンス報告します」
ultrathink"

# Trading Director指示
log "⚡ Trading Directorへ指示送信中..."
$HACONIWA_PATH space run -c arbitrage-assistant -r room-trading --cmd \
"Trading Director、apps/hedge-system/lib/hedge-system-core.tsにて以下を確実な動作を保証して完了してください：

1. アービトラージ計算エンジン完全実装
2. PENDING→OPENING→OPEN状態遷移確実実行
3. 金融計算精度小数点5桁程度
4. 高速実行判定実現

❌ 複雑なアルゴリズム実装は禁止
❌ 高度な最適化は後回し
✅ 確実に動作する基本取引機能を最優先
✅ 通信の安定性は絶対に妥協しない

完了時は「Trading Director、実装完了。金融計算・性能テスト結果報告します」
ultrathink"

# Integration Director指示
log "🔌 Integration Directorへ指示送信中..."
$HACONIWA_PATH space run -c arbitrage-assistant -r room-integration --cmd \
"Integration Director、MT4/MT5統合システムにて以下を確実な動作を保証して完了してください：

1. MQL4/MQL5 EA完全実装（WebSocket通信高速検索）
2. C++ WebSocket DLL構築（接続成功率99%以上）
3. 取引実行システム実装（成功率99.5%以上）
4. エラー回復機能構築（回復時間高速に）

❌ 複雑な通信プロトコル実装は禁止
❌ 高度な最適化は後回し
✅ 確実に動作する基本通信機能を最優先
✅ 通信の安定性は絶対に妥協しない

完了時は「Integration Director、実装完了。通信性能・安定性テスト結果報告します」
ultrathink"

# Frontend Director指示
log "🎨 Frontend Directorへ指示送信中..."
$HACONIWA_PATH space run -c arbitrage-assistant -r room-frontend --cmd \
"Frontend Director、apps/admin/app/dashboard/page.tsxにて以下を確実な動作を保証して完了してください：

1. 管理画面完全実装（初期表示高速表示）
2. リアルタイム更新機能（更新遅延リアルタイム更新）
3. アカウント・ポジション管理UI構築
4. レスポンシブデザイン完全対応

❌ 装飾的なUI要素実装は禁止
❌ 複雑なアニメーションは後回し
✅ 確実に動作する基本表示機能を最優先
✅ ユーザビリティは絶対に妥協しない

完了時は「Frontend Director、実装完了。UI性能・ユーザビリティテスト結果報告します」
ultrathink"

# DevOps Director指示
log "🚀 DevOps Directorへ指示送信中..."
$HACONIWA_PATH space run -c arbitrage-assistant -r room-devops --cmd \
"DevOps Director、Turborepo最適化・品質保証システムにて以下を確実な動作を保証して完了してください：

1. Turborepo設定最適化（高速ビルド実現）
2. ESLint 0 warnings品質基準絶対維持
3. AWS Amplify/GitHub Actions CI/CD自動化
4. キャッシュ効率80%以上達成

❌ 複雑な最適化設定は実装禁止
❌ 高度なキャッシュ戦略は後回し
✅ 確実に動作する基本ビルド設定を最優先
✅ 品質基準は絶対に妥協しない

完了時は「DevOps Director、実装完了。ビルド性能・品質確認結果報告します」
ultrathink"

log ""
log "🎉 Haconiwa正式自律実行完了！"
log ""
log "📊 実行内容:"
log "  ✅ Claude Code全ウィンドウ自動起動: 完了"
log "  ✅ CEO戦略指示送信: 完了"
log "  ✅ Backend Director指示: 完了"
log "  ✅ Trading Director指示: 完了"
log "  ✅ Integration Director指示: 完了"  
log "  ✅ Frontend Director指示: 完了"
log "  ✅ DevOps Director指示: 完了"
log ""
log "🚀 次のアクション:"
log "  1. 各Directorの戦略分析・計画策定を確認"
log "  2. 各Directorからの部下への指示を確認"
log "  3. 実装進捗の定期的監視"
log ""
log "📱 tmux操作:"
log "  Ctrl+B → 2: CEO確認"
log "  Ctrl+B → 3,4,5,6,7: 各Director確認"

# 完了通知
osascript -e 'display notification "🎯 Haconiwa正式自律実行完了！Claude Code + 階層指示配信済み" with title "ArbitrageAssistant AUTONOMOUS" sound name "Hero"' 2>/dev/null || true

log "🎯 正式自律実行完了！Haconiwa + Claude Code完全統合"