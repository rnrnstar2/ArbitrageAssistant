#!/bin/bash

# Tasks Directory タスク一覧表示
set -e

FILTER="${1:-all}"
TASKS_DIR="tasks"

echo "📋 タスク一覧 ($FILTER)"

# 基本的なタスクファイル検索・表示
case "$FILTER" in
    "all")
        find "$TASKS_DIR" -name "*.md" -type f 2>/dev/null | head -20
        ;;
    "active")
        find "$TASKS_DIR/directors" -name "*.md" -type f 2>/dev/null | head -10
        ;;
    "completed")
        find "$TASKS_DIR/completed" -name "*.md" -type f 2>/dev/null | head -10
        ;;
    "summary")
        echo "📊 緊急タスク: $(find "$TASKS_DIR/directors" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')件"
        echo "📊 完了タスク: $(find "$TASKS_DIR/completed" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')件"
        ;;
    "monitor")
        echo "🔄 リアルタイム監視ダッシュボード起動中..."
        while true; do
            clear
            echo "📊 Haconiwa監視ダッシュボード - $(date '+%H:%M:%S')"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            # 進行中タスク統計
            active_tasks=$(find "$TASKS_DIR/directors" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
            completed_tasks=$(find "$TASKS_DIR/completed" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
            echo "📋 タスク状況: 進行中 $active_tasks 件 | 完了済み $completed_tasks 件"
            
            # Director別タスク数
            echo ""
            echo "📊 Director別タスク数:"
            for director in backend-director trading-flow-director integration-director frontend-director devops-director; do
                if [ -d "$TASKS_DIR/directors/$director" ]; then
                    count=$(find "$TASKS_DIR/directors/$director" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
                    echo "  • $director: $count 件"
                fi
            done
            
            # 緊急事項確認
            echo ""
            if [ -d "$TASKS_DIR/alerts/urgent" ]; then
                urgent_count=$(find "$TASKS_DIR/alerts/urgent" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
                if [ "$urgent_count" -gt 0 ]; then
                    echo "🚨 緊急事項: $urgent_count 件"
                else
                    echo "✅ 緊急事項なし"
                fi
            fi
            
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "⏰ 自動更新中... (Ctrl+C で終了)"
            sleep 5
        done
        ;;
    "--department")
        if [ -n "$2" ]; then
            find "$TASKS_DIR/directors/$2" -name "*.md" -type f 2>/dev/null | head -10
        fi
        ;;
    *)
        echo "使用法: $0 [all|active|completed|summary|monitor|--department [department]]"
        ;;
esac

