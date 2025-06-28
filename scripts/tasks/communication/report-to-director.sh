#!/bin/bash

# Specialist → Director 報告システム
# Usage: ./scripts/report-to-director.sh [specialist-id] "[report-message]"

if [ $# -lt 2 ]; then
    echo "使用法: $0 [specialist-id] \"[report-message]\""
    echo "例: $0 amplify-gen2-specialist \"AWS Amplify基盤構築完了。data/resource.ts実装済み。\""
    exit 1
fi

SPECIALIST_ID="$1"
REPORT_MESSAGE="$2"
SESSION_NAME="arbitrage-assistant"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Specialist → Director マッピング
get_director_pane() {
    case "$1" in
        "amplify-gen2-specialist"|"mvp-implementation-specialist")
            echo "1.0"  # backend-director
            ;;
        "position-execution-specialist"|"trail-management-specialist")
            echo "2.0"  # trading-flow-director
            ;;
        "mt5-connector-specialist"|"websocket-engineer")
            echo "3.0"  # integration-director
            ;;
        "react-specialist"|"desktop-app-engineer")
            echo "4.0"  # frontend-director
            ;;
        "build-optimization-engineer"|"quality-assurance-engineer")
            echo "5.0"  # devops-director
            ;;
        *)
            echo ""
            ;;
    esac
}

# Director名取得
get_director_name() {
    case "$1" in
        "1.0") echo "backend-director" ;;
        "2.0") echo "trading-flow-director" ;;
        "3.0") echo "integration-director" ;;
        "4.0") echo "frontend-director" ;;
        "5.0") echo "devops-director" ;;
        *) echo "unknown-director" ;;
    esac
}

echo "📤 Specialist → Director 報告送信"
echo "👤 報告者: $SPECIALIST_ID"
echo "📝 報告内容: $REPORT_MESSAGE"
echo ""

# セッション確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ Haconiwaセッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

# 担当Director取得
DIRECTOR_PANE=$(get_director_pane "$SPECIALIST_ID")

if [ -z "$DIRECTOR_PANE" ]; then
    echo "❌ 不明なSpecialist ID: $SPECIALIST_ID"
    exit 1
fi

DIRECTOR_NAME=$(get_director_name "$DIRECTOR_PANE")

echo "🎯 報告送信先: $DIRECTOR_NAME (ペイン $DIRECTOR_PANE)"

# Directorに報告送信
tmux send-keys -t "$SESSION_NAME:$DIRECTOR_PANE" " && echo '【Specialist報告】$SPECIALIST_ID → $DIRECTOR_NAME' && echo '⏰ 時刻: $TIMESTAMP' && echo '📋 報告: $REPORT_MESSAGE' && echo '✅ 報告確認。次の指示をお待ちください。' ultrathink" Enter

echo ""
echo "✅ Director報告送信完了"
echo "📊 送信先: $DIRECTOR_NAME"
echo "💡 進捗確認: npm run haconiwa:monitor"