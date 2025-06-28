#!/bin/bash

# Tasks Directory v2.0 タスク実行システム
# Specialist向けタスク実行・結果記録機能（最小限版）

set -e

TASK_FILE="$1"
ACTION="${2:-interactive}"

if [ -z "$TASK_FILE" ] || [ ! -f "$TASK_FILE" ]; then
    echo "使用法: $0 [task_file] [action]"
    echo "Action: start, complete"
    echo "例: $0 tasks/directors/backend/task-001.md start"
    exit 1
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# タスクファイル情報抽出
extract_task_info() {
    local field="$1"
    case "$field" in
        "assignee")
            grep "^\*\*担当者\*\*:" "$TASK_FILE" | sed 's/.*担当者\*\*: //' | head -n1
            ;;
        "title")
            head -n1 "$TASK_FILE" | sed 's/^# //'
            ;;
    esac
}

# タスクファイル更新
update_task_field() {
    local field="$1"
    local value="$2"
    
    case "$field" in
        "status")
            sed -i '' "s/\*\*状態\*\*:.*/\*\*状態\*\*: $value/" "$TASK_FILE"
            ;;
        "start_time")
            sed -i '' "s/### 実行開始日時:.*/### 実行開始日時: $value/" "$TASK_FILE"
            ;;
        "complete_time")
            sed -i '' "s/### 実行完了日時:.*/### 実行完了日時: $value/" "$TASK_FILE"
            ;;
        "executor")
            sed -i '' "s/### 実行者:.*/### 実行者: $value/" "$TASK_FILE"
            ;;
    esac
}

# 進捗履歴追加
add_progress_entry() {
    local entry="$1"
    local section_line=$(grep -n "## 🔄 進捗履歴" "$TASK_FILE" | cut -d: -f1)
    
    if [ -n "$section_line" ]; then
        local insert_line=$((section_line + 1))
        sed -i '' "${insert_line}i\\
- $TIMESTAMP **$(extract_task_info assignee)**: $entry
" "$TASK_FILE"
    fi
}

# タスク開始
start_task() {
    echo "🚀 タスク実行開始: $(extract_task_info title)"
    
    update_task_field "status" "in_progress"
    update_task_field "start_time" "$TIMESTAMP"
    update_task_field "executor" "$(extract_task_info assignee)"
    add_progress_entry "タスク実行開始"
    
    echo "✅ タスク開始記録完了"
}

# タスク完了
complete_task() {
    echo "🎉 タスク完了処理"
    
    update_task_field "status" "completed"
    update_task_field "complete_time" "$TIMESTAMP"
    add_progress_entry "タスク完了"
    
    # 完了済みディレクトリに移動
    COMPLETED_DIR="tasks/completed"
    mkdir -p "$COMPLETED_DIR"
    COMPLETED_FILE="$COMPLETED_DIR/$(basename "$TASK_FILE")"
    mv "$TASK_FILE" "$COMPLETED_FILE"
    
    echo "✅ タスク完了 - アーカイブ先: $COMPLETED_FILE"
}

# メイン実行
case "$ACTION" in
    "start")
        start_task
        ;;
    "complete")
        complete_task
        ;;
    *)
        echo "📋 タスク: $(extract_task_info title)"
        echo "📊 現在のタスクファイル: $TASK_FILE"
        echo ""
        echo "利用可能なアクション:"
        echo "  start   - タスク実行開始"
        echo "  complete - タスク完了"
        echo ""
        echo "例: $0 $TASK_FILE start"
        ;;
esac