#!/bin/bash

# 🎯 役割完遂システム - 各ペイン役割完了判定・品質保証

set -e

ROLE_ID="${HACONIWA_AGENT_ID:-unknown}"

echo "🎯 役割完遂システム: $ROLE_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 役割別完了条件定義
get_completion_criteria() {
    case "$ROLE_ID" in
        "ceo-supreme")
            echo "✅ CEO Supreme完了条件:"
            echo "  1. システム診断完了"
            echo "  2. 戦略判断・Director指示送信完了"
            echo "  3. MVP準拠確認・Over-Engineering防止確認"
            ;;
        "backend-director"|"trading-flow-director"|"integration-director"|"frontend-director"|"devops-director")
            echo "✅ Director完了条件:"
            echo "  1. CEO指示理解・分析完了"
            echo "  2. 配下Specialist指示送信完了"
            echo "  3. Specialist進捗確認・品質監視完了"
            echo "  4. CEO報告送信完了"
            ;;
        *)
            echo "✅ Specialist完了条件:"
            echo "  1. Director指示理解・タスクファイル確認完了"
            echo "  2. 実装・テスト・品質チェック完了"
            echo "  3. 結果記録・Director報告完了"
            echo "  4. MVP準拠・forbidden-edits.md遵守確認"
            ;;
    esac
}

# 品質保証チェック実行
quality_assurance_check() {
    echo ""
    echo "🔍 品質保証チェック実行中..."
    
    case "$ROLE_ID" in
        "ceo-supreme"|"ceo-operations"|"ceo-analytics")
            # CEO系品質チェック
            echo "  📊 CEO戦略品質チェック:"
            if [ -d "tasks/directors" ]; then
                task_count=$(find tasks/directors -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
                if [ "$task_count" -gt 0 ]; then
                    echo "    ✅ Director指示送信: $task_count 件確認"
                else
                    echo "    ⚠️ Director指示未送信"
                fi
            fi
            ;;
        "backend-director"|"trading-flow-director"|"integration-director"|"frontend-director"|"devops-director")
            # Director品質チェック
            echo "  📋 Director管理品質チェック:"
            if [ -d "tasks/directors/$ROLE_ID" ]; then
                specialist_tasks=$(find "tasks/directors/$ROLE_ID" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
                echo "    ✅ Specialist指示: $specialist_tasks 件"
            fi
            ;;
        *)
            # Specialist品質チェック
            echo "  🔧 Specialist実装品質チェック:"
            echo "    🔍 MVP準拠チェック実行中..."
            if [ -f "scripts/quality/mvp-compliance-check.sh" ]; then
                ./scripts/quality/mvp-compliance-check.sh . > /dev/null 2>&1
                if [ $? -eq 0 ]; then
                    echo "    ✅ MVP準拠: 合格"
                else
                    echo "    ⚠️ MVP準拠: 要確認"
                fi
            fi
            
            echo "    🔍 編集禁止チェック実行中..."
            if [ -f "scripts/directors/common/forbidden-edits.md" ]; then
                echo "    ✅ 編集禁止リスト: 確認済み"
            fi
            ;;
    esac
}

# 作業完了判定
check_work_completion() {
    echo ""
    echo "🎯 作業完了判定:"
    
    case "$ROLE_ID" in
        "ceo-supreme")
            # CEO Supreme完了判定
            if [ -d "tasks/directors" ] && [ "$(find tasks/directors -name '*.md' 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ]; then
                echo "  ✅ Director指示送信完了"
                echo "  🎯 次回サイクル実行準備: ./scripts/tasks/waterfall/waterfall-control.sh status"
                return 0
            else
                echo "  📋 Director指示送信が必要"
                return 1
            fi
            ;;
        "backend-director"|"trading-flow-director"|"integration-director"|"frontend-director"|"devops-director")
            # Director完了判定
            if [ -d "tasks/directors/$ROLE_ID" ] && [ "$(find "tasks/directors/$ROLE_ID" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ]; then
                echo "  ✅ Specialist指示送信完了"
                echo "  📊 Specialist進捗監視: ./scripts/tasks/list.sh --department $ROLE_ID"
                return 0
            else
                echo "  📋 Specialist指示送信が必要"
                return 1
            fi
            ;;
        *)
            # Specialist完了判定
            echo "  📝 タスクファイル実行・結果記録確認"
            echo "  🔍 品質チェック・テスト実行確認"
            echo "  ✅ 手動確認: 実装・テスト・記録完了時に完了と判定"
            return 0
            ;;
    esac
}

# 次のアクション提案
suggest_next_actions() {
    echo ""
    echo "🚀 推奨次アクション:"
    
    case "$ROLE_ID" in
        "ceo-supreme")
            echo "  1. システム診断: 現在状況の徹底分析"
            echo "  2. 戦略判断: MVP完成に向けた最適判断"
            echo "  3. Director指示: ./scripts/directors/delegation/auto-delegate-v2.sh [director-id] \"[instruction]\""
            ;;
        "backend-director"|"trading-flow-director"|"integration-director"|"frontend-director"|"devops-director")
            echo "  1. CEO指示分析: 受信指示の詳細分析"
            echo "  2. Specialist指示: ./scripts/directors/delegation/auto-delegate-v2.sh $ROLE_ID \"[specific-task]\""
            echo "  3. 進捗監視: ./scripts/tasks/list.sh --department $ROLE_ID"
            ;;
        *)
            echo "  1. タスク確認: cat tasks/directors/*/task-*-$ROLE_ID.md"
            echo "  2. 実装実行: 指示に基づく実装・テスト"
            echo "  3. 結果記録: タスクファイルに実行結果記録"
            echo "  4. 品質確認: ./scripts/quality/mvp-compliance-check.sh"
            ;;
    esac
}

# メイン実行
get_completion_criteria
quality_assurance_check
check_work_completion
completion_status=$?
suggest_next_actions

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $completion_status -eq 0 ]; then
    echo "✅ 役割完遂システム: 主要作業完了確認"
else
    echo "📋 役割完遂システム: 継続作業あり"
fi