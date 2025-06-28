#!/bin/bash

# Director → CEO 報告システム
# Usage: ./scripts/report-to-ceo.sh [director-id] "[report-message]"

if [ $# -lt 2 ]; then
    echo "使用法: $0 [director-id] \"[report-message]\""
    echo "例: $0 backend-director \"AWS Amplify基盤構築完了。全Specialist作業完了。\""
    exit 1
fi

DIRECTOR_ID="$1"
REPORT_MESSAGE="$2"
SESSION_NAME="arbitrage-assistant"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
CEO_PANE="0.0"  # ceo-supreme

# Director名確認
case "$DIRECTOR_ID" in
    "backend-director"|"trading-flow-director"|"integration-director"|"frontend-director"|"devops-director")
        # 有効なDirector ID
        ;;
    *)
        echo "❌ 不明なDirector ID: $DIRECTOR_ID"
        echo "有効なDirector: backend-director, trading-flow-director, integration-director, frontend-director, devops-director"
        exit 1
        ;;
esac

echo "📤 Director → CEO 報告送信"
echo "👤 報告者: $DIRECTOR_ID"
echo "📝 報告内容: $REPORT_MESSAGE"
echo ""

# セッション確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ Haconiwaセッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

echo "🎯 報告送信先: CEO Supreme (ペイン $CEO_PANE)"

# CEOに報告送信
tmux send-keys -t "$SESSION_NAME:$CEO_PANE" " && echo '【Director報告】$DIRECTOR_ID → CEO Supreme' && echo '⏰ 時刻: $TIMESTAMP' && echo '📋 部門報告: $REPORT_MESSAGE' && echo '✅ CEO報告確認。戦略判断に反映します。' ultrathink" Enter

# 進捗記録ファイル作成
PROGRESS_FILE="/tmp/haconiwa-progress-$(date +%Y%m%d).log"
echo "[$TIMESTAMP] $DIRECTOR_ID: $REPORT_MESSAGE" >> "$PROGRESS_FILE"

echo ""
echo "✅ CEO報告送信完了"
echo "📊 送信先: CEO Supreme"
echo "📁 進捗記録: $PROGRESS_FILE"
echo "💡 進捗確認: npm run haconiwa:monitor"