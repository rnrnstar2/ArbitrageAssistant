#!/bin/bash

# 🏛️ CEO Operations 自動実行システム
# CEO Supreme起動後の自動監視・調整スクリプト

echo "🏛️ CEO Operations 自動監視開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "役割: Director間調整・進捗確認・効率化（権限制限）"
echo "権限: 調整指示のみ・戦略決定不可"
echo ""

# Phase 1: Director進捗確認
echo "📊 Phase 1: Director進捗確認"
echo "────────────────────────────────────────────────"

# Tasks Directory進捗確認
if [ -d "tasks/directors" ]; then
    ACTIVE_TASKS=$(find tasks/directors -name "*.md" -type f | wc -l | tr -d ' ')
    COMPLETED_TASKS=$(find tasks/completed -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    
    echo "📋 活動中タスク: $ACTIVE_TASKS個"
    echo "✅ 完了済みタスク: $COMPLETED_TASKS個"
    
    # 部門別進捗確認
    for dept in backend trading integration frontend devops; do
        if [ -d "tasks/directors/${dept}-director" ]; then
            dept_tasks=$(find "tasks/directors/${dept}-director" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
            echo "• ${dept}: $dept_tasks タスク"
        fi
    done
else
    echo "📋 Tasks Directory未作成"
fi

echo ""

# Phase 2: Director状況監視
echo "🔍 Phase 2: Director状況監視"
echo "────────────────────────────────────────────────"

# Director配下指示送信状況確認
DIRECTOR_STATUS=""
SESSION_NAME="arbitrage-assistant"

if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "📡 Haconiwa接続確認済み"
    
    # 各Directorペイン監視
    declare -A DIRECTOR_PANES=(
        ["backend-director"]="1.0"
        ["trading-flow-director"]="2.0"
        ["integration-director"]="3.0"
        ["frontend-director"]="4.0"
        ["devops-director"]="5.0"
    )
    
    for director in "${!DIRECTOR_PANES[@]}"; do
        pane="${DIRECTOR_PANES[$director]}"
        
        # ペインの最新出力を確認（簡易版）
        if tmux list-panes -t "$SESSION_NAME" | grep -q "$pane"; then
            echo "✅ $director: 接続中"
            DIRECTOR_STATUS="${DIRECTOR_STATUS}$director:active|"
        else
            echo "⚠️ $director: 未接続"
            DIRECTOR_STATUS="${DIRECTOR_STATUS}$director:inactive|"
        fi
    done
else
    echo "❌ Haconiwaセッション未接続"
    DIRECTOR_STATUS="session:inactive"
fi

echo ""

# Phase 3: 課題検出・調整提案
echo "🔧 Phase 3: 課題検出・調整提案"
echo "────────────────────────────────────────────────"

ISSUES_DETECTED=0

# 長時間実行タスク検出
if [ -d "tasks/directors" ]; then
    # 2時間以上古いタスクファイルを検出
    OLD_TASKS=$(find tasks/directors -name "*.md" -type f -mmin +120 2>/dev/null | wc -l | tr -d ' ')
    if [ "$OLD_TASKS" -gt 0 ]; then
        echo "⚠️ 長時間実行タスク検出: $OLD_TASKS個（2時間以上）"
        echo "💡 調整提案: Director進捗確認・リフレッシュ検討"
        ISSUES_DETECTED=$((ISSUES_DETECTED + 1))
    fi
fi

# エラーファイル検出
ERROR_FILES=$(find . -name "*.log" -o -name "*error*" -type f -mmin -60 2>/dev/null | wc -l | tr -d ' ')
if [ "$ERROR_FILES" -gt 0 ]; then
    echo "🚨 最近のエラーファイル検出: $ERROR_FILES個"
    echo "💡 調整提案: エラー確認・品質チェック実行"
    ISSUES_DETECTED=$((ISSUES_DETECTED + 1))
fi

# ディスク使用量確認
if command -v df >/dev/null 2>&1; then
    DISK_USAGE=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 85 ]; then
        echo "💾 ディスク使用量警告: ${DISK_USAGE}%"
        echo "💡 調整提案: 一時ファイルクリーンアップ"
        ISSUES_DETECTED=$((ISSUES_DETECTED + 1))
    fi
fi

if [ "$ISSUES_DETECTED" -eq 0 ]; then
    echo "✅ 課題なし - 順調な進行"
fi

echo ""

# Phase 4: Director調整指示（権限制限内）
echo "🎯 Phase 4: Director調整指示（権限制限内）"
echo "────────────────────────────────────────────────"

if [ "$ISSUES_DETECTED" -gt 0 ]; then
    echo "🔄 調整指示送信中..."
    
    # 長時間タスクがある場合の調整指示
    if [ "$OLD_TASKS" -gt 0 ]; then
        echo "📤 Director進捗確認指示送信..."
        
        # 各Directorに軽微な調整指示送信
        for director in "${!DIRECTOR_PANES[@]}"; do
            pane="${DIRECTOR_PANES[$director]}"
            if tmux list-panes -t "$SESSION_NAME" | grep -q "$pane"; then
                ADJUSTMENT_MSG="【CEO Operations調整】$director
🔍 長時間実行タスク検出 - 進捗確認をお願いします
📋 コマンド: npm run task:list --department $director
💡 必要に応じてリフレッシュ検討"
                
                tmux send-keys -t "$SESSION_NAME:$pane" " && echo '$ADJUSTMENT_MSG'" Enter
                echo "  ✅ $director: 調整指示送信完了"
                sleep 1
            fi
        done
    fi
else
    echo "✅ 調整指示不要 - 正常運行中"
fi

echo ""

# Phase 5: 監視結果保存
echo "💾 Phase 5: 監視結果保存"
echo "────────────────────────────────────────────────"

MONITORING_LOG="tasks/ceo-operations-monitor-$(date '+%Y%m%d_%H%M%S').md"
mkdir -p "tasks"

cat > "$MONITORING_LOG" << EOF
# CEO Operations 監視レポート

## 📊 監視情報
- **実行日時**: $(date '+%Y-%m-%d %H:%M:%S')
- **実行者**: CEO Operations（自律監視）
- **監視対象**: 5 Directors + Tasks Directory

## 📋 Tasks進捗
- **活動中タスク**: $ACTIVE_TASKS個
- **完了済みタスク**: $COMPLETED_TASKS個

### 部門別タスク状況
$(for dept in backend trading integration frontend devops; do
    if [ -d "tasks/directors/${dept}-director" ]; then
        dept_tasks=$(find "tasks/directors/${dept}-director" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "- **${dept}**: $dept_tasks タスク"
    fi
done)

## 🔍 Director状況
$(echo "$DIRECTOR_STATUS" | tr '|' '\n' | grep -v '^$' | sed 's/^/- /')

## 🚨 課題検出
- **検出課題数**: $ISSUES_DETECTED個
- **長時間実行タスク**: $OLD_TASKS個
- **エラーファイル**: $ERROR_FILES個

## 🔄 実行アクション
$(if [ "$ISSUES_DETECTED" -gt 0 ]; then
    echo "- Director調整指示送信済み"
    echo "- 進捗確認依頼送信済み"
else
    echo "- アクション不要（正常運行）"
fi)

## 📊 システム状況
- **ディスク使用量**: ${DISK_USAGE:-unknown}%
- **Haconiwa接続**: $(if tmux has-session -t $SESSION_NAME 2>/dev/null; then echo "正常"; else echo "未接続"; fi)

## 🔄 Next Actions
1. **継続監視**: 30分後の再実行
2. **品質チェック**: CEO Analytics連携
3. **進捗フォロー**: Director結果確認

---
*CEO Operations自律監視システム - 権限制限内での調整・効率化専門*
EOF

echo "📁 監視結果保存: $MONITORING_LOG"

echo ""
echo "✅ CEO Operations 自動監視完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 監視結果: 課題 $ISSUES_DETECTED個検出"
echo "🔄 Next: 30分後の再監視・CEO Analytics連携"
echo "💾 結果保存: $MONITORING_LOG"

# 30分後の自動再実行設定（バックグラウンド）
echo ""
echo "⏰ 30分後の自動再実行設定..."
(sleep 1800 && echo "🔄 CEO Operations 30分監視実行中..." && ./scripts/ceo-operations-auto.sh) &
CEO_OPS_PID=$!
echo "🆔 CEO Operations PID: $CEO_OPS_PID"

# 通知
osascript -e "display notification 'CEO Operations監視完了' with title 'ArbitrageAssistant' sound name 'Tink'" 2>/dev/null || true

echo ""
echo "🏛️ CEO Operations、Director調整・効率化監視を完了しました。"
echo "継続的な監視により、プロジェクトの円滑な進行をサポートします。"