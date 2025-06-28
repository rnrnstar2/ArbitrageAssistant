#!/bin/bash

# 🎯 Director状況確認スクリプト
# 全Director（5名）の実行状況・進捗・タスク管理状況を確認

echo "🎯 Director状況確認システム"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Haconiwaセッション確認
SESSION_NAME="arbitrage-assistant"
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ Haconiwaセッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

echo ""
echo "📊 Director実行状況確認"
echo "────────────────────────────────────────────────"

# Director情報定義
declare -A DIRECTORS=(
    ["1.0"]="backend-director"
    ["2.0"]="trading-flow-director"
    ["3.0"]="integration-director"
    ["4.0"]="frontend-director"
    ["5.0"]="devops-director"
)

# 各Director状況確認
for pane in "1.0" "2.0" "3.0" "4.0" "5.0"; do
    director_name=${DIRECTORS[$pane]}
    echo ""
    echo "🔍 $director_name (ペイン $pane)"
    echo "   ────────────────────────────────────"
    
    # ペイン状況確認
    if tmux list-panes -t "$SESSION_NAME:$pane" >/dev/null 2>&1; then
        echo "   ✅ ペイン状態: アクティブ"
        
        # 最新出力確認（最後の5行）
        echo "   📝 最新出力:"
        tmux capture-pane -t "$SESSION_NAME:$pane" -p | tail -3 | sed 's/^/      /'
        
    else
        echo "   ❌ ペイン状態: 非アクティブ"
    fi
    
    # Tasks Directory確認
    tasks_dir="tasks/directors/$director_name"
    if [ -d "$tasks_dir" ]; then
        task_count=$(ls "$tasks_dir"/*.md 2>/dev/null | wc -l | tr -d ' ')
        if [ "$task_count" -gt 0 ]; then
            echo "   📋 担当タスク: $task_count 個"
            # 最新タスクファイル確認
            latest_task=$(ls -t "$tasks_dir"/*.md 2>/dev/null | head -1)
            if [ -n "$latest_task" ]; then
                task_name=$(basename "$latest_task" .md)
                echo "   📄 最新タスク: $task_name"
            fi
        else
            echo "   📋 担当タスク: なし"
        fi
    else
        echo "   📋 担当タスク: ディレクトリなし"
    fi
done

echo ""
echo ""
echo "📈 全体サマリー"
echo "────────────────────────────────────────────────"

# 全体タスク統計
if [ -d "tasks/directors" ]; then
    total_tasks=$(find tasks/directors -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    echo "📊 総タスク数: $total_tasks 個"
    
    # 部門別タスク数
    for pane in "1.0" "2.0" "3.0" "4.0" "5.0"; do
        director_name=${DIRECTORS[$pane]}
        dept_tasks=$(find "tasks/directors/$director_name" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
        echo "   • $director_name: $dept_tasks 個"
    done
else
    echo "📊 Tasks Directory: 未初期化"
fi

echo ""
echo "🔄 推奨アクション"
echo "────────────────────────────────────────────────"
echo "• 進行中タスク確認: npm run task:active"
echo "• 全タスク一覧: npm run task:list"
echo "• リアルタイム監視: npm run task:monitor"
echo "• MVP準拠チェック: npm run mvp:check packages/"
echo ""
echo "✅ Director状況確認完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"