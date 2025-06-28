#!/bin/bash

# Haconiwaペイン内便利コマンド - 基本方針

# 現在の役割確認
get_current_role() {
    echo "${HACONIWA_AGENT_ID:-unknown}"
}

# 基本タスク確認
check_tasks() {
    local tasks_dir="${1:-tasks/directors}"
    if [ -d "$tasks_dir" ]; then
        find "$tasks_dir" -name "*.md" 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

# 基本進捗確認
check_progress() {
    echo "📊 役割: $(get_current_role)"
    echo "📊 進行中タスク: $(check_tasks)件"
    echo "📊 完了タスク: $(check_tasks tasks/completed)件"
}

# ヘルプ表示
show_help() {
    echo "🎯 Haconiwaペイン内基本コマンド:"
    echo "  get_current_role  - 現在の役割確認"
    echo "  check_tasks       - タスク数確認"
    echo "  check_progress    - 基本進捗確認"
    echo ""
    echo "**詳細なコマンド・機能・操作方法等は、エージェント自身が状況に応じて判断・決定する。**"
}

# デフォルトでヘルプ表示
case "${1:-help}" in
    "role") get_current_role ;;
    "tasks") check_tasks "$2" ;;
    "progress") check_progress ;;
    *) show_help ;;
esac