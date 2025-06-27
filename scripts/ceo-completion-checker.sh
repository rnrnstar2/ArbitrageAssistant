#!/bin/bash

# 🔄 CEO実行完了チェッカー
# CEO Supreme→Director→Specialist実行サイクルの完了判定とリフレッシュ管理

echo "🔄 CEO実行完了チェッカー開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Phase 1: 実行状況確認
echo ""
echo "📊 Phase 1: 実行状況確認"
echo "────────────────────────────────────────────────"

# Tasks Directory分析
COMPLETION_SCORE=0
TOTAL_POSSIBLE=0

if [ -d "tasks/directors" ]; then
    # 各部門の完了状況確認
    DEPARTMENTS=("backend-director" "trading-flow-director" "integration-director" "frontend-director" "devops-director")
    
    for dept in "${DEPARTMENTS[@]}"; do
        if [ -d "tasks/directors/$dept" ]; then
            DEPT_TASKS=$(find "tasks/directors/$dept" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
            COMPLETED_TASKS=0
            
            # 完了タスク数確認（簡易版：完了済みマークダウンチェック）
            if [ "$DEPT_TASKS" -gt 0 ]; then
                for task_file in tasks/directors/$dept/*.md; do
                    if [ -f "$task_file" ]; then
                        if grep -q "実行完了日時:" "$task_file" && grep -q "✅.*成功" "$task_file"; then
                            COMPLETED_TASKS=$((COMPLETED_TASKS + 1))
                        fi
                    fi
                done
            fi
            
            if [ "$DEPT_TASKS" -gt 0 ]; then
                DEPT_COMPLETION=$(( (COMPLETED_TASKS * 100) / DEPT_TASKS ))
                echo "📊 $dept: $COMPLETED_TASKS/$DEPT_TASKS 完了 ($DEPT_COMPLETION%)"
                COMPLETION_SCORE=$((COMPLETION_SCORE + DEPT_COMPLETION))
                TOTAL_POSSIBLE=$((TOTAL_POSSIBLE + 100))
            else
                echo "📊 $dept: タスクなし（0%）"
                TOTAL_POSSIBLE=$((TOTAL_POSSIBLE + 100))
            fi
        else
            echo "📊 $dept: 未起動（0%）"
            TOTAL_POSSIBLE=$((TOTAL_POSSIBLE + 100))
        fi
    done
    
    if [ "$TOTAL_POSSIBLE" -gt 0 ]; then
        OVERALL_COMPLETION=$(( COMPLETION_SCORE / 5 ))  # 5部門平均
    else
        OVERALL_COMPLETION=0
    fi
    
    echo ""
    echo "📈 全体完了率: $OVERALL_COMPLETION%"
else
    echo "📊 Tasks Directory未作成"
    OVERALL_COMPLETION=0
fi

# Phase 2: CEO階層状況確認
echo ""
echo "🏛️ Phase 2: CEO階層状況確認"
echo "────────────────────────────────────────────────"

# CEO Operations状況
CEO_OPS_LOGS=$(find tasks -name "ceo-operations-monitor-*.md" -mmin -60 2>/dev/null | wc -l | tr -d ' ')
echo "📊 CEO Operations活動: 最近60分で $CEO_OPS_LOGS 回"

# CEO Analytics状況
CEO_ANALYTICS_LOGS=$(find tasks -name "ceo-analytics-report-*.md" -mmin -60 2>/dev/null | wc -l | tr -d ' ')
echo "📊 CEO Analytics活動: 最近60分で $CEO_ANALYTICS_LOGS 回"

# CEO階層活動度
if [ "$CEO_OPS_LOGS" -gt 0 ] && [ "$CEO_ANALYTICS_LOGS" -gt 0 ]; then
    CEO_ACTIVITY="高活動"
    echo "✅ CEO階層: 正常な自律運行"
elif [ "$CEO_OPS_LOGS" -gt 0 ] || [ "$CEO_ANALYTICS_LOGS" -gt 0 ]; then
    CEO_ACTIVITY="中活動"
    echo "🟡 CEO階層: 部分的活動"
else
    CEO_ACTIVITY="低活動"
    echo "🔴 CEO階層: 活動低下"
fi

# Phase 3: 完了判定とリフレッシュ決定
echo ""
echo "🎯 Phase 3: 完了判定とリフレッシュ決定"
echo "────────────────────────────────────────────────"

REFRESH_RECOMMENDED=false
REFRESH_REASON=""

# 完了率ベース判定
if [ "$OVERALL_COMPLETION" -ge 80 ]; then
    echo "✅ 高完了率（$OVERALL_COMPLETION%）- リフレッシュ推奨"
    REFRESH_RECOMMENDED=true
    REFRESH_REASON="高完了率達成"
elif [ "$OVERALL_COMPLETION" -ge 50 ] && [ "$CEO_ACTIVITY" = "低活動" ]; then
    echo "🟡 中完了率+CEO活動低下 - リフレッシュ推奨"
    REFRESH_RECOMMENDED=true
    REFRESH_REASON="中完了率+CEO活動低下"
fi

# 時間ベース判定（2時間以上古いタスクファイル）
OLD_TASKS=$(find tasks/directors -name "*.md" -type f -mmin +120 2>/dev/null | wc -l | tr -d ' ')
if [ "$OLD_TASKS" -gt 3 ]; then
    echo "⏰ 長時間実行タスク多数（$OLD_TASKS個）- リフレッシュ推奨"
    REFRESH_RECOMMENDED=true
    REFRESH_REASON="${REFRESH_REASON}, 長時間実行タスク多数"
fi

# 品質劣化判定（最新のCEO Analytics確認）
LATEST_ANALYTICS=$(find tasks -name "ceo-analytics-report-*.md" -type f -mmin -30 2>/dev/null | head -1)
if [ -f "$LATEST_ANALYTICS" ]; then
    HEALTH_ISSUES=$(grep "総合課題数:" "$LATEST_ANALYTICS" | grep -o "[0-9]\+" | head -1)
    if [ "$HEALTH_ISSUES" -gt 15 ]; then
        echo "🚨 品質劣化検出（課題$HEALTH_ISSUES個）- リフレッシュ推奨"
        REFRESH_RECOMMENDED=true
        REFRESH_REASON="${REFRESH_REASON}, 品質劣化"
    fi
fi

echo ""

# Phase 4: リフレッシュ実行・延期決定
echo "🔄 Phase 4: リフレッシュ実行・延期決定"
echo "────────────────────────────────────────────────"

if [ "$REFRESH_RECOMMENDED" = true ]; then
    echo "🎯 リフレッシュ推奨理由: $REFRESH_REASON"
    echo ""
    echo "🔄 自動リフレッシュ実行開始..."
    
    # 結果保存
    COMPLETION_LOG="tasks/ceo-completion-$(date '+%Y%m%d_%H%M%S').md"
    cat > "$COMPLETION_LOG" << EOF
# CEO実行サイクル完了レポート

## 📊 完了判定結果
- **実行日時**: $(date '+%Y-%m-%d %H:%M:%S')
- **全体完了率**: $OVERALL_COMPLETION%
- **CEO階層活動**: $CEO_ACTIVITY
- **リフレッシュ判定**: 推奨

### 推奨理由
$REFRESH_REASON

## 📋 部門別完了状況
$(for dept in "${DEPARTMENTS[@]}"; do
    if [ -d "tasks/directors/$dept" ]; then
        dept_tasks=$(find "tasks/directors/$dept" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        completed=0
        if [ "$dept_tasks" -gt 0 ]; then
            for task_file in tasks/directors/$dept/*.md; do
                if [ -f "$task_file" ] && grep -q "実行完了日時:" "$task_file" && grep -q "✅.*成功" "$task_file"; then
                    completed=$((completed + 1))
                fi
            done
        fi
        echo "- **$dept**: $completed/$dept_tasks 完了"
    fi
done)

## 🏛️ CEO階層活動
- **CEO Operations**: $CEO_OPS_LOGS 回（60分）
- **CEO Analytics**: $CEO_ANALYTICS_LOGS 回（60分）

## 🔄 実行アクション
- **リフレッシュ実行**: $(date '+%Y-%m-%d %H:%M:%S')
- **完了タスクアーカイブ**: 実行
- **環境クリーンアップ**: 実行

---
*CEO実行サイクル管理システム - 自動完了判定・リフレッシュ*
EOF
    
    echo "💾 完了レポート保存: $COMPLETION_LOG"
    
    # 完了タスクをアーカイブに移動
    if [ -d "tasks/directors" ]; then
        echo "📁 完了タスクアーカイブ中..."
        mkdir -p "tasks/completed/$(date '+%Y%m%d')"
        
        ARCHIVED_COUNT=0
        for dept_dir in tasks/directors/*/; do
            if [ -d "$dept_dir" ]; then
                for task_file in "$dept_dir"*.md; do
                    if [ -f "$task_file" ] && grep -q "実行完了日時:" "$task_file" && grep -q "✅.*成功" "$task_file"; then
                        mv "$task_file" "tasks/completed/$(date '+%Y%m%d')/"
                        ARCHIVED_COUNT=$((ARCHIVED_COUNT + 1))
                    fi
                done
            fi
        done
        
        echo "📦 $ARCHIVED_COUNT 個のタスクをアーカイブ"
    fi
    
    # Haconiwaリフレッシュ実行
    echo ""
    echo "🔄 Haconiwaリフレッシュ実行..."
    if command -v npm >/dev/null 2>&1; then
        if npm run haconiwa:refresh >/dev/null 2>&1; then
            echo "✅ Haconiwaリフレッシュ成功"
            
            # リフレッシュ後の自動CEO Supreme再起動
            echo ""
            echo "🎯 CEO Supreme自動再起動..."
            sleep 10  # リフレッシュ完了待機
            
            # CEO Supreme初期プロンプト自動入力
            if tmux has-session -t arbitrage-assistant 2>/dev/null; then
                tmux send-keys -t arbitrage-assistant:0.0 "echo '🔄 CEO Supreme自動再起動' && echo '' && ./scripts/ceo-supreme-perfect-execution-v4.sh" Enter
                echo "✅ CEO Supreme自動再起動完了"
            else
                echo "⚠️ Haconiwaセッション未検出"
            fi
        else
            echo "❌ Haconiwaリフレッシュ失敗"
        fi
    else
        echo "⚠️ npm未利用（手動リフレッシュ必要）"
    fi
    
    # 通知
    osascript -e "display notification 'CEO実行サイクル完了・リフレッシュ実行' with title 'ArbitrageAssistant' sound name 'Glass'" 2>/dev/null || true
    
else
    echo "⏳ リフレッシュ不要 - 継続監視"
    echo "📊 完了率: $OVERALL_COMPLETION% (80%未満)"
    echo "🏛️ CEO活動: $CEO_ACTIVITY"
    echo "⏰ 古いタスク: $OLD_TASKS個 (3個未満)"
    
    # 次回チェックを1時間後に設定
    echo ""
    echo "⏰ 1時間後の再チェック設定..."
    (sleep 3600 && echo "🔄 CEO完了チェッカー 1時間後実行中..." && ./scripts/ceo-completion-checker.sh) &
    CHECKER_PID=$!
    echo "🆔 完了チェッカー PID: $CHECKER_PID"
fi

echo ""
echo "✅ CEO実行完了チェッカー完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 完了率: $OVERALL_COMPLETION%"
echo "🔄 リフレッシュ: $(if [ "$REFRESH_RECOMMENDED" = true ]; then echo "実行済み"; else echo "不要（継続監視）"; fi)"
echo "💾 結果: $(if [ -f "$COMPLETION_LOG" ]; then echo "$COMPLETION_LOG"; else echo "継続監視中"; fi)"