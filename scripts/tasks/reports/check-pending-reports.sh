#!/bin/bash

# 📋 未確認報告チェックシステム

set -e

ROLE_ID="${1:-$(echo $HACONIWA_AGENT_ID)}"
CHECK_TYPE="${2:-all}"  # all, urgent, summary

echo "📋 未確認報告チェック: $ROLE_ID"

# CEO向け未確認報告確認
check_ceo_reports() {
    local pending_file="tasks/status/pending-actions/ceo-pending-reports.list"
    
    if [ -f "$pending_file" ] && [ -s "$pending_file" ]; then
        local count=$(wc -l < "$pending_file" | tr -d ' ')
        echo "🚨 CEO未確認Director報告: ${count}件"
        
        if [ "$CHECK_TYPE" != "summary" ]; then
            echo ""
            echo "📊 未確認報告一覧:"
            while IFS= read -r report_file; do
                if [ -f "$report_file" ]; then
                    local director_id=$(basename "$report_file" | cut -d'_' -f3)
                    local report_time=$(grep "報告日時" "$report_file" | cut -d':' -f2- | tr -d ' ')
                    echo "  - $director_id: $report_time"
                fi
            done < "$pending_file"
        fi
        
        return 1  # 未確認報告あり
    else
        echo "✅ CEO: 未確認報告なし"
        return 0  # 未確認報告なし
    fi
}

# Director向け未確認報告確認
check_director_reports() {
    local director_id="$1"
    local pending_file="tasks/status/pending-actions/${director_id}-pending-reports.list"
    
    if [ -f "$pending_file" ] && [ -s "$pending_file" ]; then
        local count=$(wc -l < "$pending_file" | tr -d ' ')
        echo "🚨 $director_id 未確認Specialist報告: ${count}件"
        
        if [ "$CHECK_TYPE" != "summary" ]; then
            echo ""
            echo "📊 未確認報告一覧:"
            while IFS= read -r report_file; do
                if [ -f "$report_file" ]; then
                    local specialist_id=$(basename "$report_file" | cut -d'_' -f3)
                    local report_time=$(grep "報告日時" "$report_file" | cut -d':' -f2- | tr -d ' ')
                    echo "  - $specialist_id: $report_time"
                fi
            done < "$pending_file"
        fi
        
        return 1  # 未確認報告あり
    else
        echo "✅ $director_id: 未確認報告なし"
        return 0  # 未確認報告なし
    fi
}

# 緊急事項確認
check_urgent_items() {
    local urgent_dir="tasks/alerts/urgent"
    
    if [ -d "$urgent_dir" ]; then
        local urgent_count=$(find "$urgent_dir" -name "*.md" | wc -l | tr -d ' ')
        if [ "$urgent_count" -gt 0 ]; then
            echo "🚨 緊急事項: ${urgent_count}件"
            if [ "$CHECK_TYPE" != "summary" ]; then
                find "$urgent_dir" -name "*.md" | while read urgent_file; do
                    echo "  - $(basename "$urgent_file" .md)"
                done
            fi
            return 1
        fi
    fi
    
    echo "✅ 緊急事項なし"
    return 0
}

# 役割別チェック実行
case "$ROLE_ID" in
    "ceo-supreme"|"ceo-operations"|"ceo-analytics")
        check_ceo_reports
        ceo_status=$?
        ;;
    "backend-director"|"trading-flow-director"|"integration-director"|"frontend-director"|"devops-director")
        check_director_reports "$ROLE_ID"
        director_status=$?
        ;;
    *)
        echo "⚠️ 不明な役割: $ROLE_ID"
        echo "📋 全体状況確認中..."
        check_ceo_reports
        ceo_status=$?
        
        for director in backend-director trading-flow-director integration-director frontend-director devops-director; do
            check_director_reports "$director"
        done
        ;;
esac

# 緊急事項確認
check_urgent_items
urgent_status=$?

echo ""
if [ "${ceo_status:-0}" -eq 0 ] && [ "${director_status:-0}" -eq 0 ] && [ "$urgent_status" -eq 0 ]; then
    echo "✅ 全ての報告確認完了・緊急事項なし"
else
    echo "📋 確認が必要な項目があります"
fi

