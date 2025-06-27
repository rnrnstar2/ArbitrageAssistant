#!/bin/bash

# Tasks Directory v2.0 タスク一覧・監視システム
# Director/Specialist向けタスク状況可視化

set -e

FILTER="${1:-all}"  # all, active, completed, department, summary

TASKS_DIR="tasks"
COMM_SYSTEM="$(dirname "$0")/tmux-communication-system.sh"

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# タスクファイル情報抽出
extract_task_info() {
    local file="$1"
    local field="$2"
    
    if [ ! -f "$file" ]; then
        echo "unknown"
        return
    fi
    
    case "$field" in
        "title")
            head -n1 "$file" | sed 's/^# //'
            ;;
        "creator")
            grep "^\*\*作成者\*\*:" "$file" | sed 's/.*作成者\*\*: //' | head -n1
            ;;
        "assignee")
            grep "^\*\*担当者\*\*:" "$file" | sed 's/.*担当者\*\*: //' | head -n1
            ;;
        "priority")
            grep "^\*\*優先度\*\*:" "$file" | sed 's/.*優先度\*\*: //' | head -n1
            ;;
        "status")
            grep "^\*\*状態\*\*:" "$file" | sed 's/.*状態\*\*: //' | head -n1
            ;;
        "created")
            grep "^\*\*作成日時\*\*:" "$file" | sed 's/.*作成日時\*\*: //' | head -n1
            ;;
    esac
}

# 優先度色付け
priority_color() {
    case "$1" in
        "high") echo "${RED}$1${NC}" ;;
        "medium") echo "${YELLOW}$1${NC}" ;;
        "low") echo "${BLUE}$1${NC}" ;;
        *) echo "$1" ;;
    esac
}

# 状態色付け
status_color() {
    case "$1" in
        "completed") echo "${GREEN}$1${NC}" ;;
        "in_progress") echo "${YELLOW}$1${NC}" ;;
        "pending") echo "${RED}$1${NC}" ;;
        *) echo "$1" ;;
    esac
}

# 全タスク一覧表示
show_all_tasks() {
    echo -e "${CYAN}🎭 Haconiwa Tasks Directory 一覧${NC}"
    echo "=================================================="
    echo ""
    
    local total_tasks=0
    local active_tasks=0
    local completed_tasks=0
    
    # 進行中タスク
    echo -e "${YELLOW}📋 進行中タスク${NC}"
    echo "--------------------------------------------------"
    if [ -d "$TASKS_DIR/directors" ]; then
        for director_dir in "$TASKS_DIR/directors"/*; do
            if [ -d "$director_dir" ]; then
                local director_name=$(basename "$director_dir")
                local has_tasks=false
                
                for task_file in "$director_dir"/*.md; do
                    if [ -f "$task_file" ]; then
                        local status=$(extract_task_info "$task_file" "status")
                        if [ "$status" != "completed" ]; then
                            if [ "$has_tasks" = false ]; then
                                echo -e "  ${PURPLE}▶ $director_name${NC}"
                                has_tasks=true
                            fi
                            
                            local title=$(extract_task_info "$task_file" "title")
                            local assignee=$(extract_task_info "$task_file" "assignee")
                            local priority=$(extract_task_info "$task_file" "priority")
                            local created=$(extract_task_info "$task_file" "created")
                            
                            echo -e "    📄 $(basename "$task_file")"
                            echo -e "       🎯 $title"
                            echo -e "       👤 $assignee | 🔥 $(priority_color "$priority") | 📊 $(status_color "$status")"
                            echo -e "       📅 $created"
                            echo ""
                            
                            total_tasks=$((total_tasks + 1))
                            active_tasks=$((active_tasks + 1))
                        fi
                    fi
                done
            fi
        done
    fi
    
    if [ "$active_tasks" -eq 0 ]; then
        echo "  📭 進行中のタスクはありません"
        echo ""
    fi
    
    # 完了済みタスク
    echo -e "${GREEN}✅ 完了済みタスク${NC}"
    echo "--------------------------------------------------"
    if [ -d "$TASKS_DIR/completed" ]; then
        for task_file in "$TASKS_DIR/completed"/*.md; do
            if [ -f "$task_file" ]; then
                local title=$(extract_task_info "$task_file" "title")
                local assignee=$(extract_task_info "$task_file" "assignee")
                local creator=$(extract_task_info "$task_file" "creator")
                
                echo -e "  ✅ $(basename "$task_file")"
                echo -e "     🎯 $title"
                echo -e "     👤 $assignee ← 👨‍💼 $creator"
                echo ""
                
                total_tasks=$((total_tasks + 1))
                completed_tasks=$((completed_tasks + 1))
            fi
        done
    fi
    
    if [ "$completed_tasks" -eq 0 ]; then
        echo "  📭 完了済みタスクはありません"
        echo ""
    fi
    
    # サマリー
    echo "=================================================="
    echo -e "${CYAN}📊 タスクサマリー${NC}"
    echo "  全タスク数: $total_tasks"
    echo "  進行中: $active_tasks"
    echo "  完了済み: $completed_tasks"
    
    if [ "$total_tasks" -gt 0 ]; then
        local completion_rate=$((completed_tasks * 100 / total_tasks))
        echo "  完了率: ${completion_rate}%"
        
        if [ "$completion_rate" -ge 80 ]; then
            echo -e "  📈 ${GREEN}優秀な進捗状況！${NC}"
        elif [ "$completion_rate" -ge 50 ]; then
            echo -e "  📊 ${YELLOW}順調な進捗${NC}"
        else
            echo -e "  📉 ${RED}進捗加速が必要${NC}"
        fi
    fi
}

# 進行中タスクのみ表示
show_active_tasks() {
    echo -e "${YELLOW}📋 進行中タスク一覧${NC}"
    echo "=================================================="
    echo ""
    
    local active_count=0
    
    if [ -d "$TASKS_DIR/directors" ]; then
        for director_dir in "$TASKS_DIR/directors"/*; do
            if [ -d "$director_dir" ]; then
                local director_name=$(basename "$director_dir")
                local has_active_tasks=false
                
                for task_file in "$director_dir"/*.md; do
                    if [ -f "$task_file" ]; then
                        local status=$(extract_task_info "$task_file" "status")
                        if [ "$status" != "completed" ]; then
                            if [ "$has_active_tasks" = false ]; then
                                echo -e "${PURPLE}▶ $director_name${NC}"
                                echo "--------------------------------------------------"
                                has_active_tasks=true
                            fi
                            
                            local title=$(extract_task_info "$task_file" "title")
                            local assignee=$(extract_task_info "$task_file" "assignee")
                            local priority=$(extract_task_info "$task_file" "priority")
                            local created=$(extract_task_info "$task_file" "created")
                            
                            echo -e "  📄 $(basename "$task_file")"
                            echo -e "     🎯 $title"
                            echo -e "     👤 $assignee"
                            echo -e "     🔥 優先度: $(priority_color "$priority")"
                            echo -e "     📊 状態: $(status_color "$status")"
                            echo -e "     📅 作成: $created"
                            
                            # 最新進捗確認
                            local latest_progress=$(grep "^- [0-9]" "$task_file" | tail -n 1)
                            if [ -n "$latest_progress" ]; then
                                echo -e "     📝 最新: $latest_progress"
                            fi
                            
                            echo ""
                            active_count=$((active_count + 1))
                        fi
                    fi
                done
                
                if [ "$has_active_tasks" = true ]; then
                    echo ""
                fi
            fi
        done
    fi
    
    if [ "$active_count" -eq 0 ]; then
        echo "📭 進行中のタスクはありません"
    else
        echo "📊 進行中タスク数: $active_count"
    fi
}

# Department別表示
show_department_tasks() {
    local department="$2"
    
    if [ -z "$department" ]; then
        echo "使用法: $0 department [director-name]"
        echo "例: $0 department backend-director"
        return 1
    fi
    
    echo -e "${PURPLE}📋 $department タスク一覧${NC}"
    echo "=================================================="
    echo ""
    
    local dept_dir="$TASKS_DIR/directors/$department"
    if [ ! -d "$dept_dir" ]; then
        echo "❌ Department not found: $department"
        return 1
    fi
    
    local task_count=0
    
    for task_file in "$dept_dir"/*.md; do
        if [ -f "$task_file" ]; then
            local title=$(extract_task_info "$task_file" "title")
            local assignee=$(extract_task_info "$task_file" "assignee")
            local priority=$(extract_task_info "$task_file" "priority")
            local status=$(extract_task_info "$task_file" "status")
            local created=$(extract_task_info "$task_file" "created")
            
            echo -e "📄 $(basename "$task_file")"
            echo -e "   🎯 $title"
            echo -e "   👤 $assignee"
            echo -e "   🔥 $(priority_color "$priority") | 📊 $(status_color "$status")"
            echo -e "   📅 $created"
            
            # 進捗サマリー
            local progress_count=$(grep -c "^- [0-9]" "$task_file" || echo "0")
            echo -e "   📝 進捗エントリー: ${progress_count}件"
            
            echo ""
            task_count=$((task_count + 1))
        fi
    done
    
    echo "📊 $department タスク数: $task_count"
}

# 緊急事項サマリー表示
show_summary() {
    echo -e "${RED}🚨 緊急事項サマリー${NC}"
    echo "=================================================="
    echo ""
    
    local high_priority_count=0
    local overdue_count=0
    local error_count=0
    
    # 高優先度タスク確認
    echo -e "${RED}🔥 高優先度タスク${NC}"
    echo "--------------------------------------------------"
    
    if [ -d "$TASKS_DIR/directors" ]; then
        for director_dir in "$TASKS_DIR/directors"/*; do
            if [ -d "$director_dir" ]; then
                for task_file in "$director_dir"/*.md; do
                    if [ -f "$task_file" ]; then
                        local priority=$(extract_task_info "$task_file" "priority")
                        local status=$(extract_task_info "$task_file" "status")
                        
                        if [ "$priority" = "high" ] && [ "$status" != "completed" ]; then
                            local title=$(extract_task_info "$task_file" "title")
                            local assignee=$(extract_task_info "$task_file" "assignee")
                            
                            echo -e "  🚨 $title"
                            echo -e "     👤 $assignee | 📊 $(status_color "$status")"
                            echo ""
                            
                            high_priority_count=$((high_priority_count + 1))
                        fi
                    fi
                done
            fi
        done
    fi
    
    if [ "$high_priority_count" -eq 0 ]; then
        echo "  ✅ 高優先度の未完了タスクはありません"
        echo ""
    fi
    
    # 長期間未更新タスク確認
    echo -e "${YELLOW}⏰ 長期間未更新タスク（24時間以上）${NC}"
    echo "--------------------------------------------------"
    
    local current_time=$(date +%s)
    local day_ago=$((current_time - 86400))  # 24時間前
    
    if [ -d "$TASKS_DIR/directors" ]; then
        for director_dir in "$TASKS_DIR/directors"/*; do
            if [ -d "$director_dir" ]; then
                for task_file in "$director_dir"/*.md; do
                    if [ -f "$task_file" ]; then
                        local file_mtime=$(stat -f "%m" "$task_file" 2>/dev/null || echo "0")
                        
                        if [ "$file_mtime" -lt "$day_ago" ]; then
                            local title=$(extract_task_info "$task_file" "title")
                            local assignee=$(extract_task_info "$task_file" "assignee")
                            local last_update=$(date -r "$file_mtime" '+%Y-%m-%d %H:%M:%S')
                            
                            echo -e "  ⏰ $title"
                            echo -e "     👤 $assignee | 📅 最終更新: $last_update"
                            echo ""
                            
                            overdue_count=$((overdue_count + 1))
                        fi
                    fi
                done
            fi
        done
    fi
    
    if [ "$overdue_count" -eq 0 ]; then
        echo "  ✅ 長期間未更新のタスクはありません"
        echo ""
    fi
    
    # サマリー表示
    echo "=================================================="
    echo -e "${CYAN}📊 緊急事項サマリー${NC}"
    echo "  🚨 高優先度未完了: $high_priority_count"
    echo "  ⏰ 長期間未更新: $overdue_count"
    
    if [ "$high_priority_count" -gt 0 ] || [ "$overdue_count" -gt 0 ]; then
        echo ""
        echo -e "${RED}⚠️ 要注意事項があります！${NC}"
    else
        echo ""
        echo -e "${GREEN}✅ 緊急事項はありません${NC}"
    fi
}

# リアルタイム監視モード
realtime_monitor() {
    local refresh_interval="${2:-10}"  # デフォルト10秒
    
    echo -e "${CYAN}📊 リアルタイムタスク監視モード${NC}"
    echo "更新間隔: ${refresh_interval}秒 | Ctrl+C で終了"
    echo ""
    
    while true; do
        clear
        echo -e "${CYAN}🎭 Haconiwa Tasks リアルタイム監視${NC}"
        echo "📅 $(date '+%Y-%m-%d %H:%M:%S')"
        echo "=================================================="
        echo ""
        
        # 簡潔なサマリー表示
        local total_active=0
        local total_completed=0
        
        # 進行中タスクカウント
        if [ -d "$TASKS_DIR/directors" ]; then
            for director_dir in "$TASKS_DIR/directors"/*; do
                if [ -d "$director_dir" ]; then
                    for task_file in "$director_dir"/*.md; do
                        if [ -f "$task_file" ]; then
                            local status=$(extract_task_info "$task_file" "status")
                            if [ "$status" = "completed" ]; then
                                total_completed=$((total_completed + 1))
                            else
                                total_active=$((total_active + 1))
                            fi
                        fi
                    done
                fi
            done
        fi
        
        # 完了済みカウント
        if [ -d "$TASKS_DIR/completed" ]; then
            for task_file in "$TASKS_DIR/completed"/*.md; do
                if [ -f "$task_file" ]; then
                    total_completed=$((total_completed + 1))
                fi
            done
        fi
        
        echo -e "${YELLOW}📊 全体サマリー${NC}"
        echo "  進行中: $total_active"
        echo "  完了済み: $total_completed"
        
        if [ $((total_active + total_completed)) -gt 0 ]; then
            local completion_rate=$(((total_completed * 100) / (total_active + total_completed)))
            echo "  完了率: ${completion_rate}%"
        fi
        
        echo ""
        
        # 緊急事項確認
        show_summary
        
        sleep "$refresh_interval"
    done
}

# メイン実行
case "$FILTER" in
    "all")
        show_all_tasks
        ;;
    "active")
        show_active_tasks
        ;;
    "completed")
        if [ -d "$TASKS_DIR/completed" ]; then
            echo -e "${GREEN}✅ 完了済みタスク一覧${NC}"
            echo "=================================================="
            echo ""
            for task_file in "$TASKS_DIR/completed"/*.md; do
                if [ -f "$task_file" ]; then
                    local title=$(extract_task_info "$task_file" "title")
                    local assignee=$(extract_task_info "$task_file" "assignee")
                    echo "✅ $(basename "$task_file"): $title ($assignee)"
                fi
            done
        else
            echo "📭 完了済みタスクはありません"
        fi
        ;;
    "department")
        show_department_tasks "$@"
        ;;
    "summary")
        show_summary
        ;;
    "monitor")
        realtime_monitor "$@"
        ;;
    "help"|*)
        echo "🎭 Haconiwa Tasks Directory 一覧システム"
        echo ""
        echo "使用法: $0 [filter] [options]"
        echo ""
        echo "Filters:"
        echo "  all              # 全タスク表示（デフォルト）"
        echo "  active           # 進行中タスクのみ"
        echo "  completed        # 完了済みタスクのみ"
        echo "  department [dir] # 特定Director/Department"
        echo "  summary          # 緊急事項サマリー"
        echo "  monitor [sec]    # リアルタイム監視"
        echo ""
        echo "例:"
        echo "  $0 active"
        echo "  $0 department backend-director"
        echo "  $0 summary"
        echo "  $0 monitor 5"
        ;;
esac