#!/bin/bash

# 📊 CEO Analytics 自動実行 - 基本方針

echo "📊 CEO Analytics 自動分析開始"
echo "役割: 全体分析・品質評価・リスク監視（指示権限なし）"

# 前回実行結果確認
echo ""
echo "🔍 前回実行結果確認中..."
if [ -f "scripts/utils/check-previous-cycle.sh" ]; then
    chmod +x "scripts/utils/check-previous-cycle.sh"
    ./scripts/utils/check-previous-cycle.sh
fi

# 基本分析原則
echo ""
echo "🎯 分析基本原則:"
echo "- 前回実行結果との比較分析"
echo "- MVP準拠絶対"
echo "- Over-Engineering検出"
echo "- 品質・リスク監視"
echo "- 分析・報告のみ（指示権限なし）"

# 基本チェック
echo ""
echo "🔍 基本チェック実行..."

# MVP設計書確認
if [ -f "MVPシステム設計.md" ]; then
    echo "✅ MVP設計書確認済み"
else
    echo "⚠️ MVP設計書未確認"
fi

# 基本品質チェック
if npm run lint > /dev/null 2>&1; then
    echo "✅ Lint品質良好"
else
    echo "⚠️ Lint問題検出"
fi

# Tasks Directory確認
if [ -d "tasks/directors" ]; then
    task_count=$(find tasks/directors -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    echo "📊 進行中タスク: ${task_count}件"
else
    echo "⚠️ Tasks Directory未確認"
fi

echo ""
echo "✅ CEO Analytics 分析完了"
echo ""
echo "**詳細な分析方法・チェック項目・報告内容等は、CEO Analytics自身が状況に応じて判断・決定する。**"