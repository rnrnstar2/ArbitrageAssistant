#!/bin/bash

# 🎯 強化版完了判定システム - 精密な完了条件・品質チェック

set -e

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
CHECK_ID="enhanced-check-$(date '+%Y%m%d_%H%M%S')"

echo "🎯 強化版完了判定システム起動"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 詳細完了判定結果
COMPLETION_SCORE=0
MAX_SCORE=10

# Phase 1: Specialist作業完了詳細判定
echo ""
echo "🔍 Phase 1: Specialist作業完了詳細判定"
echo "────────────────────────────────────────────────"

specialist_completion_detailed() {
    local director="$1"
    local score=0
    
    echo "🔍 $director 詳細作業確認中..."
    
    # タスクファイル存在確認
    if [ -d "tasks/directors/$director" ]; then
        task_files=$(find "tasks/directors/$director" -name "*.md" 2>/dev/null)
        if [ -n "$task_files" ]; then
            echo "  ✅ タスクファイル: 確認済み"
            score=$((score + 1))
            
            # 各タスクファイルの実行結果確認
            completed_tasks=0
            total_tasks=0
            
            echo "$task_files" | while read task_file; do
                total_tasks=$((total_tasks + 1))
                
                # 実行結果セクション確認
                if grep -q "## 実行結果" "$task_file" && grep -q "実行完了日時" "$task_file"; then
                    completed_tasks=$((completed_tasks + 1))
                fi
            done
            
            if [ $completed_tasks -eq $total_tasks ] && [ $total_tasks -gt 0 ]; then
                echo "  ✅ 実行結果記録: 完了 ($completed_tasks/$total_tasks)"
                score=$((score + 1))
            else
                echo "  ⚠️ 実行結果記録: 不完全 ($completed_tasks/$total_tasks)"
            fi
        else
            echo "  ❌ タスクファイル: なし"
        fi
    else
        echo "  ❌ タスクディレクトリ: 未作成"
    fi
    
    # 品質チェック結果確認
    if [ -f "scripts/quality/mvp-compliance-check.sh" ]; then
        if ./scripts/quality/mvp-compliance-check.sh . > /dev/null 2>&1; then
            echo "  ✅ MVP準拠: 合格"
            score=$((score + 1))
        else
            echo "  ⚠️ MVP準拠: 要確認"
        fi
    fi
    
    echo "  📊 $director 詳細スコア: $score/3"
    return $score
}

total_specialist_score=0
for director in backend-director trading-flow-director integration-director frontend-director devops-director; do
    specialist_completion_detailed "$director"
    director_score=$?
    total_specialist_score=$((total_specialist_score + director_score))
done

echo ""
echo "📊 Specialist詳細完了度: $total_specialist_score/15 (各部門3点満点)"

# Phase 2: 品質保証詳細チェック
echo ""
echo "🛡️ Phase 2: 品質保証詳細チェック"
echo "────────────────────────────────────────────────"

quality_score=0

# Lint詳細チェック
echo "🔍 Lint詳細チェック実行中..."
if npm run lint > /tmp/lint-check.log 2>&1; then
    echo "  ✅ Lint: 完全合格"
    quality_score=$((quality_score + 2))
else
    warning_count=$(grep -c "warning" /tmp/lint-check.log 2>/dev/null || echo "0")
    error_count=$(grep -c "error" /tmp/lint-check.log 2>/dev/null || echo "0")
    echo "  ⚠️ Lint: 警告$warning_count件, エラー$error_count件"
    if [ "$error_count" -eq 0 ]; then
        quality_score=$((quality_score + 1))
    fi
fi

# TypeScript詳細チェック  
echo "🔍 TypeScript詳細チェック実行中..."
type_check_result=0
for app in "apps/hedge-system" "apps/admin"; do
    if [ -d "$app" ]; then
        echo "  🔍 $app 型チェック中..."
        if cd "$app" && npm run check-types > /tmp/types-$app.log 2>&1; then
            echo "    ✅ $app: 型安全"
            type_check_result=$((type_check_result + 1))
        else
            type_errors=$(grep -c "error TS" /tmp/types-$app.log 2>/dev/null || echo "0")
            echo "    ⚠️ $app: 型エラー$type_errors件"
        fi
        cd - > /dev/null
    fi
done

if [ $type_check_result -eq 2 ]; then
    echo "  ✅ TypeScript: 全アプリ合格"
    quality_score=$((quality_score + 2))
elif [ $type_check_result -eq 1 ]; then
    echo "  ⚠️ TypeScript: 部分合格"
    quality_score=$((quality_score + 1))
else
    echo "  ❌ TypeScript: 要修正"
fi

# ビルド確認
echo "🔍 ビルド確認実行中..."
if npm run build > /tmp/build-check.log 2>&1; then
    echo "  ✅ ビルド: 成功"
    quality_score=$((quality_score + 1))
else
    echo "  ❌ ビルド: 失敗"
fi

echo ""
echo "📊 品質保証詳細スコア: $quality_score/5"

# Phase 3: システム統合性チェック
echo ""
echo "🔗 Phase 3: システム統合性チェック"
echo "────────────────────────────────────────────────"

integration_score=0

# 設計書準拠確認
if [ -f "MVPシステム設計.md" ]; then
    echo "  ✅ MVP設計書: 存在確認"
    integration_score=$((integration_score + 1))
fi

# 重要ファイル存在確認
if [ -f "arbitrage-assistant.yaml" ]; then
    echo "  ✅ システム設定: 確認済み"
    integration_score=$((integration_score + 1))
fi

# Tasks Directory完整性確認
if [ -d "tasks" ] && [ -d "tasks/directors" ] && [ -d "tasks/completed" ]; then
    echo "  ✅ Tasks Directory: 完整性確認"
    integration_score=$((integration_score + 1))
fi

echo ""
echo "📊 システム統合性スコア: $integration_score/3"

# Phase 4: 総合判定
echo ""
echo "🏆 Phase 4: 総合完了判定"
echo "────────────────────────────────────────────────"

COMPLETION_SCORE=$((total_specialist_score + quality_score + integration_score))
MAX_SCORE=23

completion_percentage=$((COMPLETION_SCORE * 100 / MAX_SCORE))

echo "📊 総合完了スコア: $COMPLETION_SCORE/$MAX_SCORE ($completion_percentage%)"

# 判定基準
if [ $completion_percentage -ge 90 ]; then
    echo "🎉 完了判定: 優秀 (90%以上) - 次サイクル準備推奨"
    exit_code=1
elif [ $completion_percentage -ge 75 ]; then
    echo "✅ 完了判定: 良好 (75%以上) - 軽微な改善後完了可能"
    exit_code=1
elif [ $completion_percentage -ge 60 ]; then
    echo "⚠️ 完了判定: 継続 (60%以上) - 品質改善必要"
    exit_code=0
else
    echo "❌ 完了判定: 要改善 (60%未満) - 大幅な作業継続必要"
    exit_code=0
fi

# 詳細結果レポート生成
REPORT_FILE="tasks/cycles/completion-records/enhanced-completion-$CHECK_ID.md"
mkdir -p "tasks/cycles/completion-records"

cat > "$REPORT_FILE" << EOF
# 強化版完了判定レポート: $CHECK_ID

## 📊 判定結果サマリー
- **判定日時**: $TIMESTAMP
- **総合スコア**: $COMPLETION_SCORE/$MAX_SCORE ($completion_percentage%)
- **判定結果**: $(if [ $exit_code -eq 1 ]; then echo "完了"; else echo "継続"; fi)

## 詳細スコア内訳
- **Specialist作業**: $total_specialist_score/15
- **品質保証**: $quality_score/5  
- **システム統合**: $integration_score/3

## 📋 改善推奨項目
$(if [ $quality_score -lt 4 ]; then echo "- 品質チェック項目の修正"; fi)
$(if [ $total_specialist_score -lt 12 ]; then echo "- Specialist作業完了・記録の徹底"; fi)
$(if [ $integration_score -lt 3 ]; then echo "- システム統合性の確認・修正"; fi)

## 🚀 次のアクション
$(if [ $exit_code -eq 1 ]; then echo "✅ 次サイクル準備: ./scripts/tasks/waterfall/prepare-next-cycle.sh"; else echo "📋 継続作業: 改善項目の修正・完了"; fi)
EOF

echo ""
echo "📁 詳細レポート: $REPORT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $exit_code