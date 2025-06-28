#!/bin/bash

# 🔍 前回サイクル実行結果確認システム v2.0
# ウォーターフォール式繰り返し実行で前回の状況を把握

set -e

echo "🔍 前回サイクル実行結果確認"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 最新サイクル記録の確認
LATEST_CYCLE=$(find "tasks/cycles/cycle-history" -maxdepth 1 -type d -name "cycle-*" | sort | tail -1)
LATEST_IMPROVEMENT=$(find "tasks/cycles/incremental-plans" -name "improvement-*.md" | sort | tail -1)
LATEST_COMPLETION=$(find "tasks/cycles/completion-records" -name "*.md" | sort | tail -1)

if [ -z "$LATEST_CYCLE" ] && [ -z "$LATEST_IMPROVEMENT" ] && [ -z "$LATEST_COMPLETION" ]; then
    echo "📋 初回実行: 前回サイクル記録なし"
    echo ""
    echo "🎯 初回実行の方針:"
    echo "• MVPシステム設計.mdの要件に基づく実装"
    echo "• 品質最優先の完璧な基盤構築"
    echo "• Over-Engineering完全防止"
    echo ""
    return 0
fi

echo ""
echo "📊 前回サイクル状況サマリー"
echo "────────────────────────────────────────────────"

# 最新改善計画の確認
if [ -f "$LATEST_IMPROVEMENT" ]; then
    echo "📋 前回改善計画: $(basename "$LATEST_IMPROVEMENT")"
    echo ""
    
    # 優先改善項目の表示
    if grep -q "優先改善項目" "$LATEST_IMPROVEMENT"; then
        echo "🎯 前回特定の優先改善項目:"
        grep -A 10 "優先改善項目" "$LATEST_IMPROVEMENT" | head -10 | sed 's/^/  /'
        echo ""
    fi
    
    # 品質状況の表示
    if grep -q "品質分析結果" "$LATEST_IMPROVEMENT"; then
        echo "📈 前回品質分析結果:"
        grep -A 5 "品質分析結果" "$LATEST_IMPROVEMENT" | tail -5 | sed 's/^/  /'
        echo ""
    fi
else
    echo "⚠️ 改善計画記録なし"
fi

# 最新完了記録の確認
if [ -f "$LATEST_COMPLETION" ]; then
    echo "✅ 前回完了判定: $(basename "$LATEST_COMPLETION")"
    echo ""
    
    # 完了状況の表示
    if grep -q "総合判定結果" "$LATEST_COMPLETION"; then
        echo "📊 前回完了状況:"
        grep -A 5 "総合判定結果" "$LATEST_COMPLETION" | sed 's/^/  /'
        echo ""
    fi
else
    echo "⚠️ 完了判定記録なし"
fi

# 最新サイクル記録の確認
if [ -d "$LATEST_CYCLE" ]; then
    CYCLE_ID=$(basename "$LATEST_CYCLE")
    echo "📁 前回サイクル記録: $CYCLE_ID"
    
    if [ -f "$LATEST_CYCLE/cycle-summary.md" ]; then
        echo ""
        echo "📋 前回実行サマリー:"
        grep -E "タスク実行|報告受信|品質状況" "$LATEST_CYCLE/cycle-summary.md" | sed 's/^/  /'
        echo ""
    fi
else
    echo "⚠️ サイクル記録なし"
fi

# 現在の課題状況確認
echo "🔍 現在の状況確認"
echo "────────────────────────────────────────────────"

# 進行中タスクの確認
active_tasks=0
for director in backend-director trading-flow-director integration-director frontend-director devops-director; do
    if [ -d "tasks/directors/$director" ]; then
        task_count=$(find "tasks/directors/$director" -name "*.md" | wc -l | tr -d ' ')
        if [ "$task_count" -gt 0 ]; then
            echo "  $director: ${task_count}件の進行中タスク"
            active_tasks=$((active_tasks + task_count))
        fi
    fi
done

if [ "$active_tasks" -eq 0 ]; then
    echo "  ✅ 進行中タスクなし - 新規サイクル実行準備完了"
else
    echo "  ⚠️ 進行中タスク${active_tasks}件 - 継続実行中"
fi

echo ""
echo "🎯 今回実行の推奨方針"
echo "────────────────────────────────────────────────"

if [ -f "$LATEST_IMPROVEMENT" ]; then
    echo "• 前回改善計画の優先項目を重点実装"
    echo "• 品質課題の完全解決"
    echo "• MVP機能の段階的完成"
else
    echo "• MVPシステム設計.mdの要件準拠"
    echo "• 品質最優先の基盤構築"
    echo "• Over-Engineering完全防止"
fi

echo ""
echo "**前回実行結果を踏まえた最適な戦略判断・実装計画を立案してください。**"
echo ""