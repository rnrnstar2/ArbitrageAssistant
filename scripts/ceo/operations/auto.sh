#!/bin/bash

# 🏛️ CEO Operations 自動実行 - 基本方針

echo "🏛️ CEO Operations 自動監視開始"
echo "役割: Director間調整・進捗確認・効率化（権限制限）"

# 前回実行結果確認
echo ""
echo "🔍 前回実行結果確認中..."
if [ -f "scripts/utils/check-previous-cycle.sh" ]; then
    chmod +x "scripts/utils/check-previous-cycle.sh"
    ./scripts/utils/check-previous-cycle.sh
fi

# 基本監視原則  
echo ""
echo "🎯 監視基本原則:"
echo "- 前回実行結果を踏まえたDirector間調整・進捗確認"
echo "- 戦略決定権限なし"
echo "- 効率化・改善提案のみ"

# 基本進捗確認
echo ""
echo "📊 基本進捗確認..."

# Tasks Directory確認
if [ -d "tasks/directors" ]; then
    active_tasks=$(find tasks/directors -name "*.md" -type f | wc -l | tr -d ' ')
    completed_tasks=$(find tasks/completed -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    echo "📊 進行中タスク: ${active_tasks}件"
    echo "📊 完了タスク: ${completed_tasks}件"
else
    echo "⚠️ Tasks Directory未確認"
fi

# 基本品質チェック
if npm run lint > /dev/null 2>&1; then
    echo "✅ 基本品質良好"
else
    echo "⚠️ 品質問題検出"
fi

echo ""
echo "✅ CEO Operations 監視完了"
echo ""
echo "**詳細な監視方法・調整提案・効率化方法等は、CEO Operations自身が状況に応じて判断・決定する。**"