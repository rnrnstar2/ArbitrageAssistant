#!/bin/bash

# Haconiwa tmux通信システム - 基本方針

set -e

SESSION_NAME="arbitrage-assistant"

# 基本tmux通信原則
echo "🔄 Haconiwa tmux通信システム"
echo "原則: 必要最小限の指示送信・報告受信"

# 基本指示送信
send_instruction() {
    local target_pane="$1"
    local instruction="$2"
    
    if tmux list-panes -t "$SESSION_NAME:$target_pane" >/dev/null 2>&1; then
        tmux send-keys -t "$SESSION_NAME:$target_pane" "$instruction" Enter
        echo "✅ 指示送信完了: $target_pane"
    else
        echo "❌ ペイン未発見: $target_pane"
        return 1
    fi
}

# 基本報告確認
check_reports() {
    local reports_dir="${1:-tasks/directors}"
    
    if [ -d "$reports_dir" ]; then
        report_count=$(find "$reports_dir" -name "*.md" -newer "${reports_dir}/.last_check" 2>/dev/null | wc -l | tr -d ' ')
        echo "📊 新規報告: ${report_count}件"
        touch "${reports_dir}/.last_check"
    else
        echo "⚠️ 報告ディレクトリ未確認: $reports_dir"
    fi
}

# 使用例表示
case "${1:-help}" in
    "send")
        send_instruction "$2" "$3"
        ;;
    "check")
        check_reports "$2"
        ;;
    *)
        echo "使用法:"
        echo "  $0 send [pane] [instruction]"
        echo "  $0 check [reports_dir]"
        echo ""
        echo "**詳細な通信機能・監視・エラーハンドリング等は、使用者が状況に応じて判断・決定する。**"
        ;;
esac