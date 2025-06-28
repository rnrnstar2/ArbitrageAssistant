#!/bin/bash

# 🗂️ 自動アーカイブシステム - 完了タスクの自動移動

set -e

TASKS_DIR="tasks"
COMPLETED_DIR="$TASKS_DIR/completed"
ARCHIVE_DATE=$(date '+%Y%m%d')

echo "🗂️ 自動アーカイブシステム起動"

# 完了済みディレクトリ作成
mkdir -p "$COMPLETED_DIR"

# 各Director完了タスク確認・移動
archive_completed_tasks() {
    local director="$1"
    local director_dir="$TASKS_DIR/directors/$director"
    
    if [ ! -d "$director_dir" ]; then
        return 0
    fi
    
    echo "🔍 $director 完了タスクチェック中..."
    
    archived_count=0
    
    # タスクファイル一覧取得
    find "$director_dir" -name "*.md" -type f 2>/dev/null | while read task_file; do
        # ファイル内容で完了判定（簡単な方法）
        if grep -q "## 実行結果" "$task_file" && grep -q "実行完了日時" "$task_file"; then
            # 完了タスクを発見
            task_name=$(basename "$task_file")
            archive_file="$COMPLETED_DIR/${ARCHIVE_DATE}_${director}_${task_name}"
            
            # アーカイブ実行
            mv "$task_file" "$archive_file"
            echo "  ✅ アーカイブ: $task_name"
            archived_count=$((archived_count + 1))
        fi
    done
    
    if [ $archived_count -gt 0 ]; then
        echo "📦 $director: $archived_count 件アーカイブ完了"
    else
        echo "📝 $director: 完了タスクなし"
    fi
}

# 全Director対象実行
for director in backend-director trading-flow-director integration-director frontend-director devops-director; do
    archive_completed_tasks "$director"
done

# アーカイブ統計
total_archived=$(find "$COMPLETED_DIR" -name "${ARCHIVE_DATE}_*.md" 2>/dev/null | wc -l | tr -d ' ')
total_completed=$(find "$COMPLETED_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "📊 アーカイブ統計:"
echo "  今日のアーカイブ: $total_archived 件"
echo "  総完了タスク: $total_completed 件"

echo ""
echo "✅ 自動アーカイブ完了"