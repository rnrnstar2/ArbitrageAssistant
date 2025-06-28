#!/bin/bash

# 🏛️ Director → CEO 報告受信システム

set -e

DIRECTOR_ID="$1"
CEO_ID="${2:-ceo-supreme}"
SUMMARY_MESSAGE="$3"

if [ $# -lt 3 ]; then
    echo "使用法: $0 [director_id] [ceo_id] [summary_message]"
    exit 1
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
REPORT_ID="$(date '+%Y%m%d_%H%M%S')_${DIRECTOR_ID}"
REPORT_FILE="tasks/reports/director-reports/${REPORT_ID}.md"

echo "🏛️ Director報告受信: $DIRECTOR_ID → $CEO_ID"

# 配下Specialist報告集計
SPECIALIST_REPORTS_DIR="tasks/reports/specialist-reports/${DIRECTOR_ID}"
SPECIALIST_COUNT=0
if [ -d "$SPECIALIST_REPORTS_DIR" ]; then
    SPECIALIST_COUNT=$(find "$SPECIALIST_REPORTS_DIR" -name "*.md" | wc -l | tr -d ' ')
fi

# 統合報告ファイル作成
cat > "$REPORT_FILE" << EOF
# Director 統合報告: $DIRECTOR_ID → $CEO_ID

## 📋 報告情報
- **報告者**: $DIRECTOR_ID
- **受信者**: $CEO_ID
- **報告日時**: $TIMESTAMP
- **配下Specialist報告数**: ${SPECIALIST_COUNT}件
- **報告ID**: $REPORT_ID

## 📝 統合報告内容
$SUMMARY_MESSAGE

## 📊 配下作業状況
$(if [ -d "$SPECIALIST_REPORTS_DIR" ]; then
    echo "### Specialist報告一覧"
    find "$SPECIALIST_REPORTS_DIR" -name "*.md" | while read report; do
        specialist_name=$(basename "$report" .md | cut -d'_' -f3-)
        echo "- **$specialist_name**: $(basename "$report")"
    done
else
    echo "- 配下報告なし"
fi)

## 🎯 完了状況・品質評価
### 実装完了度
- [ ] 全機能実装完了
- [ ] 品質チェック通過
- [ ] MVP準拠確認済み

### 次回指示要否
- [ ] 追加作業不要（完全完了）
- [ ] 追加指示必要
- [ ] 品質改善必要

## 📊 CEO確認状況
- **受信日時**: $TIMESTAMP
- **確認状態**: 未確認
- **CEO決定**: 待機中

## 🔄 Next Actions
- CEO による統合報告確認
- 部門完了判定・承認
- 次サイクル指示決定
EOF

# 状況追跡更新
echo "$TIMESTAMP,$DIRECTOR_ID,$CEO_ID,director-report,received,$REPORT_FILE" >> "tasks/reports/status-tracking/report-log.csv"

# CEO未確認リストに追加
echo "$REPORT_FILE" >> "tasks/status/pending-actions/ceo-pending-reports.list"

echo "✅ Director報告受信完了: $REPORT_FILE"
echo "📋 CEO確認待ち: tasks/status/pending-actions/ceo-pending-reports.list"