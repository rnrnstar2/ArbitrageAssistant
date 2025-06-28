#!/bin/bash

# ✅ 全作業完了判定システム

set -e

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
COMPLETION_ID="completion-$(date '+%Y%m%d_%H%M%S')"
COMPLETION_RECORD="tasks/cycles/completion-records/${COMPLETION_ID}.md"

echo "✅ 全作業完了判定開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 完了記録ファイル作成
mkdir -p "tasks/cycles/completion-records"
cat > "$COMPLETION_RECORD" << EOF
# 全作業完了判定記録: $COMPLETION_ID

## 📋 判定情報
- **判定日時**: $TIMESTAMP
- **判定ID**: $COMPLETION_ID
- **判定システム**: 自動完了判定システム v2.0

## 📊 判定結果サマリー
EOF

# Phase 1: 全Specialist作業完了判定
echo ""
echo "📊 Phase 1: 全Specialist作業完了判定"
echo "────────────────────────────────────────────────"

SPECIALIST_COMPLETION=0
TOTAL_SPECIALISTS=0

for director in backend-director trading-flow-director integration-director frontend-director devops-director; do
    echo "🔍 $director 配下作業確認中..."
    
    # 進行中タスク確認
    active_tasks=$(find "tasks/directors/$director" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    
    # Specialist報告確認
    specialist_reports=$(find "tasks/reports/specialist-reports/$director" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    
    echo "  進行中タスク: ${active_tasks}件"
    echo "  Specialist報告: ${specialist_reports}件"
    
    # 完了判定（簡易版：報告数がタスク数以上）
    if [ "$specialist_reports" -ge "$active_tasks" ] && [ "$active_tasks" -gt 0 ]; then
        echo "  ✅ $director: 配下作業完了"
        SPECIALIST_COMPLETION=$((SPECIALIST_COMPLETION + 1))
    elif [ "$active_tasks" -eq 0 ]; then
        echo "  ⚠️ $director: タスクなし"
    else
        echo "  ❌ $director: 作業未完了"
    fi
    
    TOTAL_SPECIALISTS=$((TOTAL_SPECIALISTS + 1))
    
    # 記録に追加
    cat >> "$COMPLETION_RECORD" << EOF
- **$director**: 進行中${active_tasks}件, 報告${specialist_reports}件
EOF
done

echo ""
echo "📊 Specialist作業完了度: $SPECIALIST_COMPLETION/$TOTAL_SPECIALISTS 部門"

# Phase 2: 全Director報告完了判定
echo ""
echo "🏛️ Phase 2: 全Director報告完了判定"
echo "────────────────────────────────────────────────"

DIRECTOR_REPORTS=0
director_reports=$(find "tasks/reports/director-reports" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
echo "📊 Director報告数: ${director_reports}件"

if [ "$director_reports" -ge "$SPECIALIST_COMPLETION" ] && [ "$SPECIALIST_COMPLETION" -gt 0 ]; then
    echo "✅ Director報告完了"
    DIRECTOR_REPORTS=1
else
    echo "❌ Director報告未完了"
fi

# Phase 3: MVP実装品質検証
echo ""
echo "🛡️ Phase 3: MVP実装品質検証"
echo "────────────────────────────────────────────────"

QUALITY_CHECK=0

# 基本品質チェック
echo "🔍 基本品質チェック実行中..."
if npm run lint > /dev/null 2>&1; then
    echo "  ✅ Lint: 合格"
    lint_status="✅"
else
    echo "  ❌ Lint: 不合格"
    lint_status="❌"
fi

# 型チェック
if npm run check-types > /dev/null 2>&1; then
    echo "  ✅ TypeScript: 合格"
    types_status="✅"
else
    echo "  ❌ TypeScript: 不合格"
    types_status="❌"
fi

# MVP設計書準拠確認
if [ -f "MVPシステム設計.md" ]; then
    echo "  ✅ MVP設計書: 存在"
    mvp_design_status="✅"
else
    echo "  ❌ MVP設計書: 未確認"
    mvp_design_status="❌"
fi

# 総合品質判定
if [ "$lint_status" = "✅" ] && [ "$types_status" = "✅" ] && [ "$mvp_design_status" = "✅" ]; then
    echo "✅ MVP品質検証: 合格"
    QUALITY_CHECK=1
else
    echo "❌ MVP品質検証: 不合格"
fi

# Phase 4: 総合完了判定
echo ""
echo "🎯 Phase 4: 総合完了判定"
echo "────────────────────────────────────────────────"

OVERALL_COMPLETION=0

if [ "$SPECIALIST_COMPLETION" -eq "$TOTAL_SPECIALISTS" ] && [ "$DIRECTOR_REPORTS" -eq 1 ] && [ "$QUALITY_CHECK" -eq 1 ]; then
    echo "🎉 全作業完了！ウォーターフォール実行サイクル完了"
    OVERALL_COMPLETION=1
    completion_status="完了"
else
    echo "📋 作業継続中：追加作業・品質改善が必要"
    completion_status="継続"
fi

# 完了記録完成
cat >> "$COMPLETION_RECORD" << EOF

## 🎯 総合判定結果

### 作業完了状況
- **Specialist作業**: $SPECIALIST_COMPLETION/$TOTAL_SPECIALISTS 部門完了
- **Director報告**: $DIRECTOR_REPORTS/1 完了
- **品質検証**: $QUALITY_CHECK/1 合格

### 品質チェック詳細
- **Lint**: $lint_status
- **TypeScript**: $types_status  
- **MVP設計書**: $mvp_design_status

### 総合判定
- **完了状況**: $completion_status
- **次のアクション**: $(if [ "$OVERALL_COMPLETION" -eq 1 ]; then echo "次サイクル準備"; else echo "未完了作業継続"; fi)

## 📅 Next Actions

$(if [ "$OVERALL_COMPLETION" -eq 1 ]; then
cat << 'NEXT_EOF'
### ✅ 完了時アクション
1. **サイクル完了記録**: 実行履歴の永続化
2. **次回準備**: 増分改善計画作成
3. **初期化実行**: npm run haconiwa:start で次サイクル開始

### 🔄 次サイクル推奨事項
- 品質継続改善
- パフォーマンス最適化
- 機能拡張検討
NEXT_EOF
else
cat << 'CONTINUE_EOF'
### 📋 継続時アクション  
1. **未完了作業確認**: 残存タスクの特定・実行
2. **品質改善**: 不合格項目の修正
3. **進捗監視**: 完了まで継続監視

### ⚠️ 要注意事項
- 品質基準未達成の項目修正優先
- 全Director報告完了の確認
- MVP準拠の徹底確認
CONTINUE_EOF
fi)

## 📊 統計情報
- **判定実行時刻**: $TIMESTAMP
- **記録ファイル**: $COMPLETION_RECORD
- **完了度**: $(echo "$SPECIALIST_COMPLETION + $DIRECTOR_REPORTS + $QUALITY_CHECK" | bc)点/5点満点
EOF

echo ""
echo "📁 完了判定記録: $COMPLETION_RECORD"

# 結果に応じてアラート生成
if [ "$OVERALL_COMPLETION" -eq 1 ]; then
    # 完了通知
    echo "$(date '+%Y-%m-%d %H:%M:%S'),system,all,cycle-completed,success,$COMPLETION_RECORD" >> "tasks/alerts/important/cycle-completed.log"
    echo "🎉 ウォーターフォール実行サイクル完了通知を生成しました"
else
    # 継続通知
    echo "$(date '+%Y-%m-%d %H:%M:%S'),system,all,cycle-continuing,info,$COMPLETION_RECORD" >> "tasks/alerts/notifications/cycle-status.log"
    echo "📋 実行継続通知を生成しました"
fi

exit $OVERALL_COMPLETION