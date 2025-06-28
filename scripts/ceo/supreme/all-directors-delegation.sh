#!/bin/bash

# 🎯 CEO Supreme 全Director指示送信システム - 優先順位表示版

set -e

# 引数チェック
if [ $# -lt 1 ]; then
    echo "使用法: $0 \"[全体指示内容]\" \"[依存関係タイプ: parallel|sequential|mixed]\""
    echo "例: $0 \"MVP基盤システム構築\" \"sequential\""
    echo "例: $0 \"UI改善とパフォーマンス最適化\" \"parallel\""
    exit 1
fi

OVERALL_INSTRUCTION="$1"
DEPENDENCY_TYPE="${2:-mixed}"

echo "🎯 CEO Supreme 全Director指示送信システム"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 全体指示: $OVERALL_INSTRUCTION"
echo "🔗 依存関係: $DEPENDENCY_TYPE"
echo ""

# Director一覧と依存関係定義
DIRECTORS=(
    "backend-director"
    "trading-flow-director" 
    "integration-director"
    "frontend-director"
    "devops-director"
)

# 依存関係に基づく優先順位表示
show_execution_priority() {
    echo "📊 実行優先順位・依存関係:"
    echo "════════════════════════════════════════════════"
    
    case "$DEPENDENCY_TYPE" in
        "sequential")
            echo "🔄 【直列実行推奨】依存関係順での実行を推奨"
            echo "   1️⃣ 最優先: backend-director (基盤構築)"
            echo "   2️⃣ 次優先: trading-flow-director (Backend完了後)"
            echo "   3️⃣ 次優先: integration-director (Trading完了後)"
            echo "   4️⃣ 次優先: frontend-director (Backend/Trading完了後)"
            echo "   5️⃣ 最終: devops-director (全体統合後)"
            ;;
        "parallel")
            echo "⚡ 【並列実行可能】全Director同時実行可能"
            echo "   🟢 同時実行OK: 全Director並列作業可能"
            echo "   📝 注意: 作業競合回避のため情報共有重要"
            ;;
        "mixed")
            echo "🔀 【混合実行】一部並列・一部直列"
            echo "   1️⃣ 優先: backend-director (基盤構築優先)"
            echo "   2️⃣ 並列可: trading-flow-director + frontend-director"
            echo "   3️⃣ 並列可: integration-director + devops-director"
            echo "   📝 注意: 基盤完了後に他Directorが並列実行"
            ;;
    esac
    
    echo ""
    echo "⚠️ 【重要】実行判断はユーザーが各Claude Codeで決定"
    echo "   • CEO Supremeは指示出しのみ完了"
    echo "   • ユーザーが順序を参考にEnterキー押下で実行"
    echo "   • 依存関係違反は各Directorが自動判定・待機"
    echo ""
}

# 各Director向け専門的指示生成 v6.1-enhanced
generate_director_instruction() {
    local director="$1"
    local base_instruction="$2"
    
    case "$director" in
        "backend-director")
            echo "$base_instruction

【🎯 Backend Director専門指示 v6.1】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【核心技術要件】
• AWS Amplify Gen2基盤: data/resource.ts・GraphQLスキーマ最適化
• 認証システム: Cognito・userIdベース設計・権限管理
• データベース設計: User/Account/Position/Action テーブルMVP準拠
• GraphQL実装: クエリ・ミューテーション・サブスクリプション

【品質・完了基準】
• 型安全性: TypeScript strict mode・GraphQL型生成
• MVP準拠100%: MVPシステム設計.md セクション2完全準拠
• テーブル追加禁止: Performance/Analytics/Metrics等MVP外禁止
• セキュリティ: 認証・認可・データ保護の完全実装

【専門責任領域】
• packages/shared-backend/ 全体管理・最適化
• AWS Amplify Gen2設定・デプロイ・管理
• データベース設計・マイグレーション・性能最適化
• Backend API・認証システム・権限制御

【Over-Engineering防止】
• 将来拡張・過度な抽象化は絶対禁止
• MVP機能のみ実装・余計な機能追加禁止
• シンプル・確実・保守性優先の設計

【依存関係・連携】
• Trading Director: Position/Actionモデル提供
• Frontend Director: GraphQL API・認証基盤提供
• Integration Director: データ永続化・API提供

【実行指示】
./scripts/directors/delegation/auto-delegate-v2.sh経由で配下Specialistに詳細技術要件を指示し、MVP Backend基盤を完璧に構築してください。"
            ;;
        "trading-flow-director")
            echo "$base_instruction

【🎯 Trading Flow Director専門指示 v6.1】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【核心技術要件】
• Position実行フロー: Entry/Exit・両建て管理・動的組み替え
• Trail Engine: トレーリングストップ・価格監視・トリガー制御
• Action同期: Position→Action連携・実行状態管理
• WebSocket通信: MT4/MT5リアルタイム価格・実行フィードバック

【品質・完了基準】
• 実行精度: Position実行・決済・トレール機能の完璧動作
• MVP準拠100%: MVPシステム設計.md セクション4・11完全準拠
• パフォーマンス: リアルタイム処理・低遅延・高精度実行
• エラーハンドリング: 通信断・実行失敗・回復処理

【専門責任領域】
• apps/hedge-system/lib/position-execution.ts 実行精度向上
• apps/hedge-system/lib/trail-engine.ts トレール機能最適化
• apps/hedge-system/lib/action-sync.ts 同期機能完全実装
• apps/hedge-system/lib/websocket-handler.ts 通信安定性

【Over-Engineering防止】
• 複雑な最適化・予測機能は絶対禁止
• MVPの確実実行のみ・余計な機能追加禁止
• シンプル・確実・安定性優先の実装

【依存関係・連携】
• Backend Director: Position/Actionモデル・GraphQL API
• Integration Director: MT4/MT5実行・WebSocket通信
• Frontend Director: 管理画面でのPosition制御

【実行指示】
./scripts/directors/delegation/auto-delegate-v2.sh経由で配下Specialistに詳細実装要件を指示し、確実なTrading実行フローを完璧に実装してください。"
            ;;
        "integration-director")
            echo "$base_instruction

【🎯 Integration Director専門指示 v6.1】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【核心技術要件】
• MT4/MT5 EA開発: MQL5・WebSocket DLL・取引実行
• WebSocket通信: C++/Rust実装・プロトコル設計・安定性
• EA統合: 複数口座管理・リアルタイム通信・エラーハンドリング
• 外部API連携: 価格取得・実行フィードバック・状態同期

【品質・完了基準】
• 通信安定性: WebSocket接続・断線回復・データ整合性
• MVP準拠100%: MVPシステム設計.md セクション7・8完全準拠
• 実行精度: MT4/MT5実行・ポジション管理・トレール制御
• パフォーマンス: 低遅延・高頻度通信・リアルタイム処理

【専門責任領域】
• ea/ ディレクトリ: EA開発・MQL5プログラミング
• apps/hedge-system/lib/websocket-server.ts 通信基盤
• WebSocket DLL: C++/Rust実装・MT4/MT5連携
• 外部API統合: 取引所・価格配信・実行システム

【Over-Engineering防止】
• 複雑なプロトコル・冗長な機能は絶対禁止
• MVPの確実通信のみ・余計な最適化禁止
• シンプル・確実・保守性優先の実装

【依存関係・連携】
• Trading Director: Position実行・Trail制御・実行指示
• Backend Director: データ永続化・状態管理・API連携
• DevOps Director: 通信品質・パフォーマンス・監視

【実行指示】
./scripts/directors/delegation/auto-delegate-v2.sh経由で配下Specialistに詳細技術要件を指示し、安定したMT4/MT5統合システムを完璧に構築してください。"
            ;;
        "frontend-director")
            echo "$base_instruction

【🎯 Frontend Director専門指示 v6.1】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【核心技術要件】
• 管理画面: Next.js・React・Tailwind CSS・shadcn/ui
• デスクトップアプリ: Tauri v2・Rust統合・ネイティブ機能
• UI/UX設計: レスポンシブ・アクセシビリティ・使いやすさ
• 状態管理: Redux/Zustand・リアルタイム更新・データ同期

【品質・完了基準】
• UI品質: 直感的操作・エラーハンドリング・ユーザビリティ
• MVP準拠100%: MVPシステム設計.md セクション5・6完全準拠
• パフォーマンス: 高速レンダリング・メモリ効率・応答性
• 互換性: クロスプラットフォーム・ブラウザ対応・アクセシビリティ

【専門責任領域】
• apps/admin/ 管理画面: Next.js・React実装・UI/UX
• apps/hedge-system/ デスクトップ: Tauri・Rust統合
• packages/ui/ 共通コンポーネント: 再利用性・統一性
• ユーザー体験: 操作性・可視性・フィードバック

【Over-Engineering防止】
• 複雑なアニメーション・装飾は絶対禁止
• MVPの必要UI/UXのみ・余計なデザイン禁止
• シンプル・使いやすさ・保守性優先の実装

【依存関係・連携】
• Backend Director: GraphQL API・認証・データ取得
• Trading Director: Position制御・実行状況表示
• DevOps Director: ビルド最適化・デプロイ・品質保証

【実行指示】
./scripts/directors/delegation/auto-delegate-v2.sh経由で配下Specialistに詳細実装要件を指示し、使いやすいFrontend環境を完璧に構築してください。"
            ;;
        "devops-director")
            echo "$base_instruction

【🎯 DevOps Director専門指示 v6.1】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【核心技術要件】
• ビルド最適化: Turborepo・npm workspaces・キャッシュ戦略
• 品質保証: ESLint・TypeScript・テスト自動化・CI/CD
• パフォーマンス: ビルド時間・実行速度・メモリ使用量
• 監視・デプロイ: 品質ゲート・自動デプロイ・ロールバック

【品質・完了基準】
• ビルド効率: 高速ビルド・増分ビルド・並列処理
• MVP準拠100%: MVPシステム設計.md セクション9・10完全準拠
• 品質維持: lint・typecheck・test自動化・品質ゲート
• 安定性: CI/CD・自動テスト・デプロイ自動化・監視

【専門責任領域】
• package.json・turbo.json: 依存関係・ビルド設定最適化
• CI/CD パイプライン: 品質保証・自動テスト・デプロイ
• 品質ツール: ESLint・TypeScript・Vitest設定・最適化
• パフォーマンス監視: ビルド時間・実行効率・ボトルネック特定

【Over-Engineering防止】
• 複雑なCI/CD・過度な自動化は絶対禁止
• MVPの品質保証のみ・余計なツール導入禁止
• シンプル・確実・保守性優先の設定

【依存関係・連携】
• 全Director: 品質チェック・ビルド最適化・デプロイ支援
• Backend Director: AWS デプロイ・インフラ最適化
• Frontend Director: ビルド最適化・パフォーマンス向上

【実行指示】
./scripts/directors/delegation/auto-delegate-v2.sh経由で配下Specialistに詳細技術要件を指示し、高品質なDevOps環境を完璧に構築してください。"
            ;;
    esac
}

# 優先順位表示
show_execution_priority

echo "🚀 全Director指示送信開始"
echo "────────────────────────────────────────────────"

# 全Directorに指示送信
SUCCESS_COUNT=0
TOTAL_COUNT=${#DIRECTORS[@]}

for director in "${DIRECTORS[@]}"; do
    echo ""
    echo "📤 指示送信: $director"
    
    # 個別指示生成
    SPECIFIC_INSTRUCTION=$(generate_director_instruction "$director" "$OVERALL_INSTRUCTION")
    
    echo "📋 指示内容: $SPECIFIC_INSTRUCTION"
    
    # auto-delegate-v2.shを使用して指示送信
    if ./scripts/directors/delegation/auto-delegate-v2.sh "$director" "$SPECIFIC_INSTRUCTION"; then
        echo "   ✅ 送信成功: $director"
        ((SUCCESS_COUNT++))
        
        # 成功ログ
        echo "$(date '+%Y-%m-%d %H:%M:%S'),success,$director,$OVERALL_INSTRUCTION,$SPECIFIC_INSTRUCTION" >> "tasks/logs/all-directors-delegation.log"
    else
        echo "   ❌ 送信失敗: $director"
        
        # エラーログ
        echo "$(date '+%Y-%m-%d %H:%M:%S'),error,$director,$OVERALL_INSTRUCTION,$SPECIFIC_INSTRUCTION" >> "tasks/logs/all-directors-delegation.log"
    fi
done

echo ""
echo "📊 指示送信結果サマリー"
echo "════════════════════════════════════════════════"
echo "✅ 成功: $SUCCESS_COUNT/$TOTAL_COUNT Directors"

if [ $SUCCESS_COUNT -eq $TOTAL_COUNT ]; then
    echo "🎉 全Director指示送信完了"
    echo ""
    echo "🎯 次のアクション（ユーザー実行）:"
    echo "   1. 各DirectorのClaude Codeで指示確認"
    echo "   2. 優先順位を参考にEnterキー押下"
    echo "   3. 依存関係順での実行推奨（$DEPENDENCY_TYPE モード）"
    echo ""
    echo "📋 Tasks Directory監視: ./scripts/tasks/list.sh monitor"
else
    echo "⚠️ 一部Director指示送信失敗"
    echo "🔧 失敗Directorは手動確認・再送信してください"
fi

echo ""
echo "🎯 CEO Supreme 全Director指示送信完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"