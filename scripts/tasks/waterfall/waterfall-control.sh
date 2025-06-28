#!/bin/bash

# 🌊 ウォーターフォール統合制御システム v2.0

set -e

COMMAND="${1:-status}"  # status, check-completion, prepare-next, full-cycle
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "🌊 ウォーターフォール統合制御システム v2.0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

case "$COMMAND" in
    "status")
        echo "📊 ウォーターフォール実行状況確認"
        echo ""
        
        # 未確認報告チェック
        echo "🔍 報告状況確認中..."
        ./scripts/tasks/reports/check-pending-reports.sh summary
        
        echo ""
        echo "📊 進行中作業確認中..."
        
        # 各Director進行状況
        total_tasks=0
        for director in backend-director trading-flow-director integration-director frontend-director devops-director; do
            if [ -d "tasks/directors/$director" ]; then
                task_count=$(find "tasks/directors/$director" -name "*.md" | wc -l | tr -d ' ')
                echo "  $director: ${task_count}件"
                total_tasks=$((total_tasks + task_count))
            fi
        done
        
        echo ""
        echo "📋 ウォーターフォール状況サマリー:"
        echo "  進行中タスク: ${total_tasks}件"
        echo "  実行フェーズ: $([ "$total_tasks" -gt 0 ] && echo "作業実行中" || echo "実行準備 / 完了判定")"
        ;;
        
    "check-completion")
        echo "✅ 全作業完了判定実行"
        echo ""
        
        ./scripts/tasks/waterfall/check-all-completed.sh
        completion_result=$?
        
        echo ""
        if [ "$completion_result" -eq 1 ]; then
            echo "🎉 ウォーターフォール実行サイクル完了！"
            echo "🔄 次サイクル準備実行推奨: $0 prepare-next"
        else
            echo "📋 作業継続中 - 完了まで継続実行"
        fi
        ;;
        
    "prepare-next")
        echo "🚀 次サイクル準備実行"
        echo ""
        
        # 完了判定確認
        echo "🔍 完了状況事前確認中..."
        ./scripts/tasks/waterfall/check-all-completed.sh > /dev/null 2>&1
        completion_result=$?
        
        if [ "$completion_result" -eq 1 ]; then
            echo "✅ 完了確認済み - 次サイクル準備開始"
            ./scripts/tasks/waterfall/prepare-next-cycle.sh
        else
            echo "⚠️ 未完了作業あり - 完了後に再実行してください"
            echo "💡 完了判定: $0 check-completion"
            exit 1
        fi
        ;;
        
    "full-cycle")
        echo "🔄 完全サイクル実行（完了判定→次サイクル準備）"
        echo ""
        
        echo "Step 1: 完了判定実行"
        ./scripts/tasks/waterfall/check-all-completed.sh
        completion_result=$?
        
        echo ""
        if [ "$completion_result" -eq 1 ]; then
            echo "Step 2: 次サイクル準備実行"
            ./scripts/tasks/waterfall/prepare-next-cycle.sh
            
            echo ""
            echo "🎉 完全サイクル実行完了！"
            echo "🚀 次サイクル開始: npm run haconiwa:start"
        else
            echo "📋 作業未完了 - サイクル完了まで継続実行"
        fi
        ;;
        
    "help"|*)
        echo "🎯 ウォーターフォール制御コマンド:"
        echo ""
        echo "  $0 status           - 現在の実行状況確認"
        echo "  $0 check-completion - 全作業完了判定実行"
        echo "  $0 prepare-next     - 次サイクル準備実行"
        echo "  $0 full-cycle       - 完了判定→次サイクル準備"
        echo ""
        echo "🔄 基本使用フロー:"
        echo "  1. npm run haconiwa:start     # ウォーターフォール開始"
        echo "  2. $0 status                  # 進捗確認"
        echo "  3. $0 check-completion        # 完了判定"
        echo "  4. $0 prepare-next            # 次サイクル準備"
        echo "  5. npm run haconiwa:start     # 次サイクル開始"
        ;;
esac