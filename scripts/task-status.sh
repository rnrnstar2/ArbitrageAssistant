#!/bin/bash

# Task Status Check System
# タスク状況確認システム

set -e

# 使用方法チェック
if [ $# -eq 0 ]; then
    echo "使用方法: $0 <task_path> または $0 --all"
    echo ""
    echo "例:"
    echo "  $0 tasks/directors/backend/task-001-amplify.md    # 個別タスク確認"
    echo "  $0 --all                                          # 全タスク確認"
    echo "  $0 --department backend                           # 部門別確認"
    exit 1
fi

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ステータス表示関数
get_status_color() {
    case "$1" in
        "created") echo -e "${YELLOW}🆕 作成済み${NC}" ;;
        "in_progress") echo -e "${BLUE}🔄 実行中${NC}" ;;
        "completed") echo -e "${GREEN}✅ 完了${NC}" ;;
        "blocked") echo -e "${RED}🚫 ブロック${NC}" ;;
        *) echo -e "${PURPLE}❓ 不明${NC}" ;;
    esac
}

# 優先度表示関数
get_priority_color() {
    case "$1" in
        "high") echo -e "${RED}🔥 高${NC}" ;;
        "medium") echo -e "${YELLOW}📋 中${NC}" ;;
        "low") echo -e "${GREEN}📝 低${NC}" ;;
        *) echo -e "${PURPLE}❓ 不明${NC}" ;;
    esac
}

# 個別タスク詳細表示関数
show_task_detail() {
    local task_path="$1"
    
    if [ ! -f "$task_path" ]; then
        echo "❌ エラー: タスクファイルが見つかりません: $task_path"
        return 1
    fi
    
    # タスク情報取得
    local task_name=$(grep "^# " "$task_path" | head -1 | sed 's/^# //')
    local director_id=$(grep "^\*\*作成者\*\*:" "$task_path" | sed 's/.*: //')
    local specialist_id=$(grep "^\*\*担当者\*\*:" "$task_path" | sed 's/.*: //')
    local priority=$(grep "^\*\*優先度\*\*:" "$task_path" | sed 's/.*: //')
    local status=$(grep "^\*\*状態\*\*:" "$task_path" | sed 's/.*: //')
    local created_at=$(grep "^\*\*作成日時\*\*:" "$task_path" | sed 's/.*: //')
    local due_date=$(grep "^\*\*予定完了日\*\*:" "$task_path" | sed 's/.*: //')
    
    # 実行情報取得
    local executor=$(grep "^### 実行者: " "$task_path" | sed 's/^### 実行者: //')
    local start_time=$(grep "^### 実行開始日時: " "$task_path" | sed 's/^### 実行開始日時: //')
    local complete_time=$(grep "^### 実行完了日時: " "$task_path" | sed 's/^### 実行完了日時: //')
    
    echo "========================================"
    echo -e "${CYAN}📋 タスク詳細${NC}"
    echo "========================================"
    echo "タスク名: $task_name"
    echo "ファイル: $task_path"
    echo "作成者: $director_id"
    echo "担当者: $specialist_id"
    echo "優先度: $(get_priority_color "$priority")"
    echo "状態: $(get_status_color "$status")"
    echo "作成日時: $created_at"
    echo "予定完了日: $due_date"
    
    if [ -n "$executor" ]; then
        echo ""
        echo -e "${CYAN}🔄 実行情報${NC}"
        echo "実行者: $executor"
        [ -n "$start_time" ] && echo "開始日時: $start_time"
        [ -n "$complete_time" ] && echo "完了日時: $complete_time"
    fi
    
    # 進捗履歴表示
    echo ""
    echo -e "${CYAN}📊 進捗履歴${NC}"
    grep "^- [0-9]" "$task_path" | head -10
    
    # 完了条件チェック
    echo ""
    echo -e "${CYAN}✅ 完了条件${NC}"
    local completed_items=$(grep "^- \[x\]" "$task_path" | wc -l | tr -d ' ')
    local total_items=$(grep "^- \[\]\\|^- \[x\]" "$task_path" | wc -l | tr -d ' ')
    
    if [ "$total_items" -gt 0 ]; then
        local completion_rate=$((completed_items * 100 / total_items))
        echo "進捗率: $completed_items/$total_items ($completion_rate%)"
        
        if [ "$completion_rate" -lt 100 ]; then
            echo "未完了項目:"
            grep "^- \[\]" "$task_path" | head -5
        fi
    fi
    
    # 品質チェック状況
    echo ""
    echo -e "${CYAN}🔍 品質チェック状況${NC}"
    grep "Lint通過\\|型チェック通過\\|テスト通過\\|ビルド成功" "$task_path" | head -4
    
    echo "========================================"
}

# 全タスク一覧表示関数
show_all_tasks() {
    echo -e "${CYAN}📋 全タスク一覧${NC}"
    echo "========================================"
    
    local task_count=0
    local completed_count=0
    
    # directors/ディレクトリのタスク
    for department in backend trading integration frontend devops; do
        local dept_tasks=(tasks/directors/$department/task-*.md)
        
        if [ -f "${dept_tasks[0]}" ]; then
            echo ""
            echo -e "${PURPLE}🏢 $department 部門${NC}"
            echo "----------------------------------------"
            
            for task_file in "${dept_tasks[@]}"; do
                if [ -f "$task_file" ]; then
                    local task_name=$(grep "^# " "$task_file" | head -1 | sed 's/^# //')
                    local specialist_id=$(grep "^\*\*担当者\*\*:" "$task_file" | sed 's/.*: //')
                    local priority=$(grep "^\*\*優先度\*\*:" "$task_file" | sed 's/.*: //')
                    local status=$(grep "^\*\*状態\*\*:" "$task_file" | sed 's/.*: //')
                    
                    echo "$(get_status_color "$status") $(get_priority_color "$priority") $task_name ($specialist_id)"
                    
                    task_count=$((task_count + 1))
                    [ "$status" = "completed" ] && completed_count=$((completed_count + 1))
                fi
            done
        fi
    done
    
    # completed/ディレクトリのタスク
    local completed_tasks=(tasks/completed/task-*.md)
    if [ -f "${completed_tasks[0]}" ]; then
        echo ""
        echo -e "${GREEN}✅ 完了済みタスク${NC}"
        echo "----------------------------------------"
        
        for task_file in "${completed_tasks[@]}"; do
            if [ -f "$task_file" ]; then
                local task_name=$(grep "^# " "$task_file" | head -1 | sed 's/^# //')
                echo "✅ $task_name"
                completed_count=$((completed_count + 1))
            fi
        done
    fi
    
    echo ""
    echo "========================================"
    echo -e "${CYAN}📊 サマリー${NC}"
    echo "総タスク数: $task_count"
    echo "完了済み: $completed_count"
    echo "進行中: $((task_count - completed_count))"
    
    if [ "$task_count" -gt 0 ]; then
        local completion_rate=$((completed_count * 100 / task_count))
        echo "完了率: $completion_rate%"
    fi
    echo "========================================"
}

# 部門別タスク表示関数
show_department_tasks() {
    local department="$1"
    
    echo -e "${CYAN}📋 $department 部門タスク一覧${NC}"
    echo "========================================"
    
    local dept_tasks=(tasks/directors/$department/task-*.md)
    
    if [ ! -f "${dept_tasks[0]}" ]; then
        echo "この部門にはタスクがありません"
        return 0
    fi
    
    for task_file in "${dept_tasks[@]}"; do
        if [ -f "$task_file" ]; then
            echo ""
            show_task_detail "$task_file"
        fi
    done
}

# メイン処理
case "$1" in
    "--all")
        show_all_tasks
        ;;
    "--department")
        if [ $# -lt 2 ]; then
            echo "❌ エラー: 部門名を指定してください"
            echo "利用可能: backend, trading, integration, frontend, devops"
            exit 1
        fi
        show_department_tasks "$2"
        ;;
    *)
        show_task_detail "$1"
        ;;
esac