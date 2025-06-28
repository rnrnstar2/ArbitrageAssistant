#!/bin/bash

# 🔄 ウォーターフォール次サイクル準備システム

set -e

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
CYCLE_ID="cycle-$(date '+%Y%m%d_%H%M%S')"
CYCLE_DIR="tasks/cycles/cycle-history/$CYCLE_ID"

echo "🔄 ウォーターフォール次サイクル準備開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Phase 1: 現サイクル記録保存
echo ""
echo "📁 Phase 1: 現サイクル記録保存"
echo "────────────────────────────────────────────────"

mkdir -p "$CYCLE_DIR"/{tasks,reports,status,quality}

echo "🔍 現サイクル記録アーカイブ中..."

# タスク記録保存
if [ -d "tasks/directors" ]; then
    cp -r "tasks/directors" "$CYCLE_DIR/tasks/"
    task_count=$(find "tasks/directors" -name "*.md" | wc -l | tr -d ' ')
    echo "  ✅ タスク記録: ${task_count}件アーカイブ"
fi

# 報告記録保存
if [ -d "tasks/reports" ]; then
    cp -r "tasks/reports" "$CYCLE_DIR/"
    report_count=$(find "tasks/reports" -name "*.md" | wc -l | tr -d ' ')
    echo "  ✅ 報告記録: ${report_count}件アーカイブ"
fi

# 状況記録保存
if [ -d "tasks/status" ]; then
    cp -r "tasks/status" "$CYCLE_DIR/"
    echo "  ✅ 状況記録: アーカイブ完了"
fi

# Phase 2: 品質分析・改善計画作成
echo ""
echo "📊 Phase 2: 品質分析・改善計画作成"
echo "────────────────────────────────────────────────"

IMPROVEMENT_PLAN="tasks/cycles/incremental-plans/improvement-${CYCLE_ID}.md"

# 最新完了判定記録を取得
LATEST_COMPLETION=$(find "tasks/cycles/completion-records" -name "*.md" | sort | tail -1)

echo "🔍 品質分析実行中..."

# 改善計画ファイル作成
cat > "$IMPROVEMENT_PLAN" << EOF
# 品質改善計画: $CYCLE_ID

## 📋 計画情報
- **作成日時**: $TIMESTAMP
- **前サイクル**: $CYCLE_ID
- **計画種別**: 増分改善計画

## 📊 前サイクル分析結果

### 完了状況分析
$(if [ -f "$LATEST_COMPLETION" ]; then
    echo "前サイクル完了判定結果:"
    grep -A 10 "総合判定結果" "$LATEST_COMPLETION" 2>/dev/null || echo "- 完了判定記録を参照"
else
    echo "- 完了判定記録なし"
fi)

### 品質分析結果
EOF

# 品質チェック実行・結果記録
echo "🔍 品質チェック実行中..."
if npm run lint > "$CYCLE_DIR/quality/lint-result.log" 2>&1; then
    lint_result="✅ 合格"
else
    lint_result="❌ 改善必要"
fi

if npm run check-types > "$CYCLE_DIR/quality/types-result.log" 2>&1; then
    types_result="✅ 合格"  
else
    types_result="❌ 改善必要"
fi

# 改善計画に追記
cat >> "$IMPROVEMENT_PLAN" << EOF
- **Lint品質**: $lint_result
- **型安全性**: $types_result
- **MVP準拠**: $([ -f "MVPシステム設計.md" ] && echo "✅ 確認済み" || echo "⚠️ 要確認")

## 🎯 次サイクル改善計画

### 優先改善項目
$(if [ "$lint_result" = "❌ 改善必要" ]; then
    echo "1. **Lint品質向上**: 警告・エラーの修正（高優先度）"
fi
if [ "$types_result" = "❌ 改善必要" ]; then
    echo "2. **型安全性向上**: TypeScript エラーの修正（高優先度）"
fi)
3. **機能拡張**: MVP機能の追加実装
4. **パフォーマンス**: 実行効率の最適化
5. **品質向上**: テスト・検証の強化

### 実装推奨順序
1. **品質修正**: Lint・型エラーの完全修正
2. **MVP完成**: 設計書準拠の完全実装
3. **機能検証**: 動作確認・品質保証
4. **最適化**: パフォーマンス・保守性向上

### 注意事項
- **MVP準拠絶対**: 設計書外の実装は禁止
- **Over-Engineering防止**: 必要最小限の実装
- **品質重視**: 妥協なしの品質基準維持

## 📅 次サイクル実行準備

### 推奨実行手順
1. **初期化実行**: \`npm run haconiwa:start\`
2. **品質確認**: 前サイクル改善項目の事前確認
3. **CEO実行**: 戦略判断・Director指示送信
4. **継続監視**: 品質・進捗の継続監視

### 成功指標
- [ ] 全品質チェック合格
- [ ] MVP機能完全実装
- [ ] 全Director・Specialist作業完了
- [ ] ウォーターフォール実行完了

## 🔄 継続改善ポイント
- **品質基準**: 妥協なしの高品質維持
- **効率向上**: 実行プロセスの最適化
- **完成度**: MVP要件の100%達成
- **保守性**: 長期維持可能な実装品質
EOF

echo "✅ 改善計画作成完了: $IMPROVEMENT_PLAN"

# Phase 3: 次サイクル環境準備
echo ""
echo "🚀 Phase 3: 次サイクル環境準備"
echo "────────────────────────────────────────────────"

echo "🔄 次サイクル環境クリーンアップ中..."

# 完了済みタスク移動
if [ -d "tasks/directors" ]; then
    mkdir -p "tasks/completed"
    find "tasks/directors" -name "*.md" -exec mv {} "tasks/completed/" \;
    echo "  ✅ 完了タスク移動完了"
fi

# 報告記録クリーンアップ（アーカイブ済み）
if [ -d "tasks/reports/specialist-reports" ]; then
    find "tasks/reports/specialist-reports" -name "*.md" -delete 2>/dev/null || true
    echo "  ✅ Specialist報告クリーンアップ"
fi

if [ -d "tasks/reports/director-reports" ]; then
    find "tasks/reports/director-reports" -name "*.md" -delete 2>/dev/null || true
    echo "  ✅ Director報告クリーンアップ"
fi

# 未確認リストクリーンアップ
if [ -d "tasks/status/pending-actions" ]; then
    find "tasks/status/pending-actions" -name "*.list" -delete 2>/dev/null || true
    echo "  ✅ 未確認リストクリーンアップ"
fi

# Phase 4: サイクル記録完成
echo ""
echo "📋 Phase 4: サイクル記録完成"
echo "────────────────────────────────────────────────"

CYCLE_SUMMARY="$CYCLE_DIR/cycle-summary.md"

cat > "$CYCLE_SUMMARY" << EOF
# ウォーターフォール実行サイクル記録: $CYCLE_ID

## 📋 サイクル情報
- **サイクルID**: $CYCLE_ID
- **実行期間**: $TIMESTAMP までのサイクル
- **記録作成**: $TIMESTAMP

## 📊 実行結果サマリー
- **タスク実行**: ${task_count:-0}件
- **報告受信**: ${report_count:-0}件
- **品質状況**: Lint[$lint_result] Types[$types_result]

## 📁 保存記録
- **タスク記録**: $CYCLE_DIR/tasks/
- **報告記録**: $CYCLE_DIR/reports/
- **品質記録**: $CYCLE_DIR/quality/
- **改善計画**: $IMPROVEMENT_PLAN

## 🔄 次サイクル準備状況
- ✅ 記録アーカイブ完了
- ✅ 改善計画作成完了
- ✅ 環境クリーンアップ完了
- ✅ 次サイクル実行準備完了

## 🚀 次サイクル推奨実行
\`\`\`bash
# 次サイクル開始コマンド
npm run haconiwa:start
\`\`\`

**次サイクルでは品質改善項目を重点的に実装し、MVP完成度の向上を図る。**
EOF

echo "✅ サイクル記録完成: $CYCLE_SUMMARY"

# 完了通知
echo ""
echo "🎉 次サイクル準備完了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 サイクル記録: $CYCLE_DIR"
echo "📋 改善計画: $IMPROVEMENT_PLAN"
echo "🚀 次サイクル実行: npm run haconiwa:start"

# アラート生成
echo "$(date '+%Y-%m-%d %H:%M:%S'),system,all,next-cycle-ready,success,$CYCLE_DIR" >> "tasks/alerts/important/next-cycle-ready.log"

