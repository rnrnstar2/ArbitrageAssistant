#!/bin/bash

# 📊 Specialist → Director 報告受信システム

set -e

SPECIALIST_ID="$1"
DIRECTOR_ID="$2"  
TASK_FILE="$3"
REPORT_MESSAGE="$4"

if [ $# -lt 4 ]; then
    echo "使用法: $0 [specialist_id] [director_id] [task_file] [report_message]"
    exit 1
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
REPORT_ID="$(date '+%Y%m%d_%H%M%S')_${SPECIALIST_ID}"
REPORT_FILE="tasks/reports/specialist-reports/${DIRECTOR_ID}/${REPORT_ID}.md"

# 報告ディレクトリ作成
mkdir -p "tasks/reports/specialist-reports/${DIRECTOR_ID}"

echo "📊 Specialist報告受信: $SPECIALIST_ID → $DIRECTOR_ID"

# 報告ファイル作成
cat > "$REPORT_FILE" << EOF
# Specialist 報告: $SPECIALIST_ID → $DIRECTOR_ID

## 📋 報告情報
- **報告者**: $SPECIALIST_ID
- **受信者**: $DIRECTOR_ID
- **報告日時**: $TIMESTAMP
- **元タスク**: $TASK_FILE
- **報告ID**: $REPORT_ID

## 📝 報告内容
$REPORT_MESSAGE

## 📊 確認状況
- **受信日時**: $TIMESTAMP
- **確認状態**: 未確認
- **Director確認**: 待機中

## 🔄 Next Actions
- Director による報告内容確認
- 必要に応じた追加指示・承認
- 統合報告への反映
EOF

# 状況追跡更新
echo "$TIMESTAMP,$SPECIALIST_ID,$DIRECTOR_ID,specialist-report,received,$REPORT_FILE" >> "tasks/reports/status-tracking/report-log.csv"

# 未確認リストに追加
echo "$REPORT_FILE" >> "tasks/status/pending-actions/${DIRECTOR_ID}-pending-reports.list"

echo "✅ 報告受信完了: $REPORT_FILE"
echo "📋 Director確認待ち: tasks/status/pending-actions/${DIRECTOR_ID}-pending-reports.list"