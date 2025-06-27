#!/bin/bash

# Task Notification System for Specialists
# Specialist用タスク通知システム

set -e

# 使用方法チェック
if [ $# -lt 2 ]; then
    echo "使用方法: $0 <task_path> <specialist_id>"
    echo ""
    echo "例:"
    echo "  $0 tasks/directors/backend/task-001-amplify.md amplify-gen2-specialist"
    exit 1
fi

TASK_PATH="$1"
SPECIALIST_ID="$2"

# タスクファイル存在確認
if [ ! -f "$TASK_PATH" ]; then
    echo "❌ エラー: タスクファイルが見つかりません: $TASK_PATH"
    exit 1
fi

# Specialist用のpane番号決定
get_specialist_pane() {
    case "$1" in
        "amplify-gen2-specialist") echo "1.1" ;;
        "cognito-auth-expert") echo "1.2" ;;
        "entry-flow-specialist") echo "2.1" ;;
        "settlement-flow-specialist") echo "2.2" ;;
        "mt5-connector-specialist") echo "3.1" ;;
        "websocket-engineer") echo "3.2" ;;
        "react-specialist") echo "4.1" ;;
        "desktop-app-engineer") echo "4.2" ;;
        "build-optimization-engineer") echo "5.1" ;;
        "quality-assurance-engineer") echo "5.2" ;;
        *) echo "" ;;
    esac
}

PANE=$(get_specialist_pane "$SPECIALIST_ID")

if [ -z "$PANE" ]; then
    echo "❌ エラー: 不正なSpecialist ID: $SPECIALIST_ID"
    echo "利用可能なSpecialist:"
    echo "  amplify-gen2-specialist, cognito-auth-expert"
    echo "  entry-flow-specialist, settlement-flow-specialist"
    echo "  mt5-connector-specialist, websocket-engineer" 
    echo "  react-specialist, desktop-app-engineer"
    echo "  build-optimization-engineer, quality-assurance-engineer"
    exit 1
fi

# タスク情報取得
TASK_NAME=$(grep "^# " "$TASK_PATH" | head -1 | sed 's/^# //')
DIRECTOR_ID=$(grep "^\*\*作成者\*\*:" "$TASK_PATH" | sed 's/.*: //')

echo "🔔 タスク通知送信中..."
echo "📋 タスク: $TASK_NAME"
echo "👤 $DIRECTOR_ID → $SPECIALIST_ID (Pane $PANE)"

# tmuxセッション存在確認
if ! tmux has-session -t arbitrage-assistant 2>/dev/null; then
    echo "❌ エラー: Haconiwa環境が起動していません"
    echo "💡 起動コマンド: npm run haconiwa:start"
    exit 1
fi

# Specialistペイン存在確認
if ! tmux list-panes -t "arbitrage-assistant:$PANE" >/dev/null 2>&1; then
    echo "❌ エラー: Specialist pane ($PANE) が見つかりません"
    echo "📋 利用可能なpane:"
    tmux list-panes -t arbitrage-assistant -a -F "  #{window_index}.#{pane_index}"
    exit 1
fi

# タスク通知コマンド作成
NOTIFICATION_CMD="echo '🔔【新規タスク通知】' && echo 'タスク: $TASK_NAME' && echo '作成者: $DIRECTOR_ID' && echo 'ファイル: $TASK_PATH' && echo '=== タスク確認・実行方法 ===' && echo './scripts/task-execute.sh \"$TASK_PATH\"' && echo '実行後は必ずタスクファイルに結果を記録してください' ultrathink"

# Specialist paneに通知送信
echo "📤 Specialist pane ($PANE) に通知送信中..."
tmux send-keys -t "arbitrage-assistant:$PANE" "$NOTIFICATION_CMD" Enter

echo "✅ タスク通知送信完了"
echo ""
echo "📋 送信された内容:"
echo "  - 新規タスク通知"
echo "  - タスクファイルパス: $TASK_PATH"
echo "  - 実行コマンド: ./scripts/task-execute.sh"
echo ""
echo "🔄 次のステップ:"
echo "  1. Specialist ($SPECIALIST_ID) がタスクを確認・実行"
echo "  2. 進捗確認: ./scripts/task-status.sh '$TASK_PATH'"
echo "  3. 結果確認後: ./scripts/task-update.sh '$TASK_PATH' '追加指示'"