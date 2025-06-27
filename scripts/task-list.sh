#!/bin/bash

# Task List Management System
# タスク一覧管理システム

set -e

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 使用方法表示
show_usage() {
    echo "使用方法: $0 [オプション]"
    echo ""
    echo "オプション:"
    echo "  --all                    # 全タスク一覧（デフォルト）"
    echo "  --active                 # 進行中タスクのみ"
    echo "  --completed              # 完了済みタスクのみ"
    echo "  --department <dept>      # 部門別（backend/trading/integration/frontend/devops）"
    echo "  --priority <level>       # 優先度別（high/medium/low）"
    echo "  --specialist <id>        # Specialist別"
    echo "  --summary                # サマリーのみ"
    echo "  --help                   # ヘルプ表示"
    echo ""
    echo "例:"
    echo "  $0                                    # 全タスク表示"
    echo "  $0 --active                          # 進行中タスクのみ"
    echo "  $0 --department backend              # Backend部門のみ"
    echo "  $0 --priority high                   # 高優先度のみ"
    echo "  $0 --specialist amplify-gen2-specialist  # 特定Specialistのみ"
}

# ステータス表示関数
get_status_color() {
    case "$1" in
        "created") echo -e "${YELLOW}🆕${NC}" ;;
        "in_progress") echo -e "${BLUE}🔄${NC}" ;;
        "completed") echo -e "${GREEN}✅${NC}" ;;
        "approved") echo -e "${GREEN}✅${NC}" ;;
        "blocked") echo -e "${RED}🚫${NC}" ;;
        *) echo -e "${PURPLE}❓${NC}" ;;
    esac
}

# 優先度表示関数
get_priority_color() {
    case "$1" in
        "high") echo -e "${RED}🔥${NC}" ;;
        "medium") echo -e "${YELLOW}📋${NC}" ;;
        "low") echo -e "${GREEN}📝${NC}" ;;
        *) echo -e "${PURPLE}❓${NC}" ;;
    esac
}

# タスク情報取得関数
get_task_info() {
    local task_file="$1"
    local task_name=$(grep "^# " "$task_file" | head -1 | sed 's/^# //')
    local director_id=$(grep "^\*\*作成者\*\*:" "$task_file" | sed 's/.*: //')
    local specialist_id=$(grep "^\*\*担当者\*\*:" "$task_file" | sed 's/.*: //')
    local priority=$(grep "^\*\*優先度\*\*:" "$task_file" | sed 's/.*: //')
    local status=$(grep "^\*\*状態\*\*:" "$task_file" | sed 's/.*: //')
    local created_at=$(grep "^\*\*作成日時\*\*:" "$task_file" | sed 's/.*: //')
    local due_date=$(grep "^\*\*予定完了日\*\*:" "$task_file" | sed 's/.*: //')
    
    echo "$task_name|$director_id|$specialist_id|$priority|$status|$created_at|$due_date|$task_file"
}

# タスク一覧表示関数
display_task_list() {
    local filter_type="$1"
    local filter_value="$2"
    
    echo -e "${CYAN}📋 タスク一覧${NC}"
    if [ -n "$filter_type" ]; then
        echo -e "${CYAN}フィルター: $filter_type = $filter_value${NC}"
    fi
    echo "==============================================="
    
    # ヘッダー
    printf "%-3s %-4s %-3s %-30s %-20s %-12s\n" "状態" "優先度" "部門" "タスク名" "担当者" "作成日"
    echo "-----------------------------------------------"
    
    local task_count=0
    local completed_count=0
    
    # directors/ディレクトリのタスク処理
    for department in backend trading integration frontend devops; do
        local dept_tasks=(tasks/directors/$department/task-*.md)
        
        if [ -f "${dept_tasks[0]}" ]; then
            for task_file in "${dept_tasks[@]}"; do
                if [ -f "$task_file" ]; then
                    process_task_file "$task_file" "$department" "$filter_type" "$filter_value"
                    task_count=$((task_count + 1))
                fi
            done
        fi
    done
    
    # completed/ディレクトリのタスク処理
    local completed_tasks=(tasks/completed/task-*.md)
    if [ -f "${completed_tasks[0]}" ]; then
        for task_file in "${completed_tasks[@]}"; do
            if [ -f "$task_file" ]; then
                # 元の部門を推定（ファイル名から）
                local dept="completed"
                process_task_file "$task_file" "$dept" "$filter_type" "$filter_value"
            fi
        done
    fi
    
    echo "-----------------------------------------------"
    
    # サマリー表示
    show_summary
}

# 個別タスク処理関数
process_task_file() {
    local task_file="$1"
    local department="$2"
    local filter_type="$3"
    local filter_value="$4"
    
    local task_info=$(get_task_info "$task_file")
    IFS='|' read -r task_name director_id specialist_id priority status created_at due_date file_path <<< "$task_info"
    
    # フィルター適用
    case "$filter_type" in
        "department")
            [ "$department" != "$filter_value" ] && return
            ;;
        "priority")
            [ "$priority" != "$filter_value" ] && return
            ;;
        "specialist")
            [ "$specialist_id" != "$filter_value" ] && return
            ;;
        "active")
            [ "$status" = "completed" ] || [ "$status" = "approved" ] && return
            ;;
        "completed")
            [ "$status" != "completed" ] && [ "$status" != "approved" ] && return
            ;;
    esac
    
    # タスク表示
    local dept_short=$(echo "$department" | cut -c1-3)
    local task_short=$(echo "$task_name" | cut -c1-28)
    local specialist_short=$(echo "$specialist_id" | cut -c1-18)
    local date_short=$(echo "$created_at" | cut -c1-10)
    
    printf "%-10s %-8s %-3s %-30s %-20s %-12s\n" \
        "$(get_status_color "$status")" \
        "$(get_priority_color "$priority")" \
        "$dept_short" \
        "$task_short" \
        "$specialist_short" \
        "$date_short"
}

# サマリー表示関数
show_summary() {
    echo ""
    echo -e "${CYAN}📊 サマリー${NC}"
    echo "==============================================="
    
    local total_tasks=0
    local created_tasks=0
    local in_progress_tasks=0
    local completed_tasks=0
    local blocked_tasks=0
    
    # 統計収集
    for department in backend trading integration frontend devops; do
        local dept_tasks=(tasks/directors/$department/task-*.md)
        
        if [ -f "${dept_tasks[0]}" ]; then
            for task_file in "${dept_tasks[@]}"; do
                if [ -f "$task_file" ]; then
                    local status=$(grep "^\*\*状態\*\*:" "$task_file" | sed 's/.*: //')
                    total_tasks=$((total_tasks + 1))
                    
                    case "$status" in
                        "created") created_tasks=$((created_tasks + 1)) ;;
                        "in_progress") in_progress_tasks=$((in_progress_tasks + 1)) ;;
                        "completed"|"approved") completed_tasks=$((completed_tasks + 1)) ;;
                        "blocked") blocked_tasks=$((blocked_tasks + 1)) ;;
                    esac
                fi
            done
        fi
    done
    
    # completed/ディレクトリのタスクも含める
    local completed_dir_tasks=(tasks/completed/task-*.md)
    if [ -f "${completed_dir_tasks[0]}" ]; then
        for task_file in "${completed_dir_tasks[@]}"; do
            if [ -f "$task_file" ]; then
                completed_tasks=$((completed_tasks + 1))
                total_tasks=$((total_tasks + 1))
            fi
        done
    fi
    
    echo "総タスク数: $total_tasks"
    echo "🆕 作成済み: $created_tasks"
    echo "🔄 実行中: $in_progress_tasks"
    echo "✅ 完了済み: $completed_tasks"
    echo "🚫 ブロック中: $blocked_tasks"
    
    if [ "$total_tasks" -gt 0 ]; then
        local completion_rate=$((completed_tasks * 100 / total_tasks))
        echo ""
        echo "完了率: $completion_rate%"
        
        # プログレスバー表示
        local bar_length=30
        local completed_bars=$((completion_rate * bar_length / 100))
        local remaining_bars=$((bar_length - completed_bars))
        
        printf "進捗: ["
        printf "%*s" $completed_bars | tr ' ' '='
        printf "%*s" $remaining_bars | tr ' ' '-'
        printf "] %d%%\n" $completion_rate
    fi
    
    echo "==============================================="
}

# 部門別統計表示関数
show_department_summary() {
    echo -e "${CYAN}📊 部門別統計${NC}"
    echo "==============================================="
    
    for department in backend trading integration frontend devops; do
        local dept_tasks=(tasks/directors/$department/task-*.md)
        
        if [ -f "${dept_tasks[0]}" ]; then
            local dept_total=0
            local dept_completed=0
            
            for task_file in "${dept_tasks[@]}"; do
                if [ -f "$task_file" ]; then
                    local status=$(grep "^\*\*状態\*\*:" "$task_file" | sed 's/.*: //')
                    dept_total=$((dept_total + 1))
                    
                    if [ "$status" = "completed" ] || [ "$status" = "approved" ]; then
                        dept_completed=$((dept_completed + 1))
                    fi
                fi
            done
            
            if [ "$dept_total" -gt 0 ]; then
                local dept_rate=$((dept_completed * 100 / dept_total))
                printf "%-12s: %2d/%2d (%3d%%)\n" "$department" "$dept_completed" "$dept_total" "$dept_rate"
            fi
        fi
    done
    
    echo "==============================================="
}

# 緊急度確認関数
check_urgent_tasks() {
    echo -e "${RED}🚨 緊急確認事項${NC}"
    echo "==============================================="
    
    local urgent_found=false
    
    # 高優先度 + ブロック中
    for department in backend trading integration frontend devops; do
        local dept_tasks=(tasks/directors/$department/task-*.md)
        
        if [ -f "${dept_tasks[0]}" ]; then
            for task_file in "${dept_tasks[@]}"; do
                if [ -f "$task_file" ]; then
                    local priority=$(grep "^\*\*優先度\*\*:" "$task_file" | sed 's/.*: //')
                    local status=$(grep "^\*\*状態\*\*:" "$task_file" | sed 's/.*: //')
                    local task_name=$(grep "^# " "$task_file" | head -1 | sed 's/^# //')
                    
                    if [ "$priority" = "high" ] && [ "$status" = "blocked" ]; then
                        echo "🚫 高優先度ブロック: $task_name ($department)"
                        urgent_found=true
                    fi
                    
                    # 期限超過チェック（簡易版）
                    local due_date=$(grep "^\*\*予定完了日\*\*:" "$task_file" | sed 's/.*: //')
                    if [ "$due_date" != "未設定" ]; then
                        # 実際の日付比較は省略（date コマンドの互換性を考慮）
                        echo "📅 期限要確認: $task_name (期限: $due_date)"
                    fi
                fi
            done
        fi
    done
    
    if [ "$urgent_found" = false ]; then
        echo "✅ 緊急事項なし"
    fi
    
    echo "==============================================="
}

# メイン処理
main() {
    case "$1" in
        "--help"|"-h")
            show_usage
            ;;
        "--all"|"")
            display_task_list
            show_department_summary
            check_urgent_tasks
            ;;
        "--active")
            display_task_list "active"
            ;;
        "--completed")
            display_task_list "completed"
            ;;
        "--department")
            if [ $# -lt 2 ]; then
                echo "❌ エラー: 部門名を指定してください"
                echo "利用可能: backend, trading, integration, frontend, devops"
                exit 1
            fi
            display_task_list "department" "$2"
            ;;
        "--priority")
            if [ $# -lt 2 ]; then
                echo "❌ エラー: 優先度を指定してください"
                echo "利用可能: high, medium, low"
                exit 1
            fi
            display_task_list "priority" "$2"
            ;;
        "--specialist")
            if [ $# -lt 2 ]; then
                echo "❌ エラー: Specialist IDを指定してください"
                exit 1
            fi
            display_task_list "specialist" "$2"
            ;;
        "--summary")
            show_summary
            show_department_summary
            check_urgent_tasks
            ;;
        *)
            echo "❌ エラー: 不正なオプション '$1'"
            show_usage
            exit 1
            ;;
    esac
}

# スクリプト実行権限確認
chmod +x "$0" 2>/dev/null || true

# メイン実行
main "$@"