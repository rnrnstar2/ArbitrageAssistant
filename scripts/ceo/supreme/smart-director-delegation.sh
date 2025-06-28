#!/bin/bash

# 🎯 CEO Supreme スマート指示送信システム - 技術領域判定統合版

set -e

# 引数チェック
if [ $# -lt 2 ]; then
    echo "使用法: $0 \"[issue_description]\" \"[file_path_or_context]\" \"[instruction]\""
    echo "例: $0 \"PostCSS設定問題\" \"packages/ui\" \"UI設定問題を解決してください\""
    exit 1
fi

ISSUE_DESCRIPTION="$1"
FILE_PATH_CONTEXT="$2"
INSTRUCTION="${3:-$ISSUE_DESCRIPTION}"

echo "🎯 CEO Supreme スマート指示送信システム"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 問題: $ISSUE_DESCRIPTION"
echo "📁 対象: $FILE_PATH_CONTEXT"
echo "🎯 指示: $INSTRUCTION"

# 技術領域判定実行
echo ""
echo "🔍 技術領域自動判定実行中..."

# 技術領域判定システムを使用
APPROPRIATE_DIRECTOR=$(./scripts/ceo/supreme/technical-domain-mapper.sh "$ISSUE_DESCRIPTION" "$FILE_PATH_CONTEXT")

echo ""
echo "✅ 判定完了: $APPROPRIATE_DIRECTOR"

# 専門領域外指示を防止するための確認
validate_director_expertise() {
    local director="$1"
    local issue="$2"
    local context="$3"
    
    echo ""
    echo "🛡️ 専門領域適合性確認中..."
    
    case "$director" in
        "frontend-director")
            if [[ "$issue" =~ (AWS|DynamoDB|GraphQL|Backend|Database) ]] && [[ ! "$context" =~ (ui|admin|frontend) ]]; then
                echo "  ⚠️ 警告: Frontend DirectorにBackend問題を指示しようとしています"
                return 1
            fi
            ;;
        "backend-director")
            if [[ "$issue" =~ (PostCSS|Tailwind|CSS|UI|React|Frontend) ]] && [[ "$context" =~ (packages/ui|apps/admin) ]]; then
                echo "  ⚠️ 警告: Backend DirectorにUI問題を指示しようとしています"
                return 1
            fi
            ;;
        "trading-flow-director")
            if [[ ! "$issue" =~ (Position|Trail|Trading|Action|Execution) ]] && [[ ! "$context" =~ (position-execution|trail-engine) ]]; then
                echo "  ⚠️ 警告: Trading DirectorにTrading外問題を指示しようとしています"
                return 1
            fi
            ;;
        "integration-director")
            if [[ ! "$issue" =~ (MT4|MT5|WebSocket|Integration|EA) ]] && [[ ! "$context" =~ (ea/|websocket) ]]; then
                echo "  ⚠️ 警告: Integration DirectorにIntegration外問題を指示しようとしています"
                return 1
            fi
            ;;
        "devops-director")
            if [[ ! "$issue" =~ (Build|CI/CD|DevOps|Dependencies|Performance) ]] && [[ ! "$context" =~ (package\.json|turbo\.json) ]]; then
                echo "  ⚠️ 警告: DevOps DirectorにDevOps外問題を指示しようとしています"
                return 1
            fi
            ;;
    esac
    
    echo "  ✅ 専門領域適合性: 確認済み"
    return 0
}

# 専門領域適合性確認
if ! validate_director_expertise "$APPROPRIATE_DIRECTOR" "$ISSUE_DESCRIPTION" "$FILE_PATH_CONTEXT"; then
    echo ""
    echo "🚨 専門領域不適合検出"
    echo "💡 推奨アクション: 技術領域分析を再実行するか、CEO判断で適切なDirectorを選択してください"
    echo ""
    echo "📋 各Director専門領域:"
    echo "  • frontend-director: UI/PostCSS/React/Tauri/Frontend"
    echo "  • backend-director: AWS/GraphQL/DynamoDB/Backend/API"
    echo "  • trading-flow-director: Position/Trail/Trading/Action/Execution"
    echo "  • integration-director: MT4/MT5/WebSocket/Integration/EA"
    echo "  • devops-director: Build/CI/CD/Dependencies/Performance"
    exit 1
fi

# 適切なDirectorに指示送信実行
echo ""
echo "🚀 適切なDirector指示送信実行"
echo "────────────────────────────────────────────────"

echo "📤 指示送信先: $APPROPRIATE_DIRECTOR"
echo "📋 指示内容: $INSTRUCTION"

# 既存のauto-delegate-v2.shを使用して指示送信
if ./scripts/directors/delegation/auto-delegate-v2.sh "$APPROPRIATE_DIRECTOR" "$INSTRUCTION"; then
    echo ""
    echo "✅ スマート指示送信完了"
    echo "📊 送信結果: $APPROPRIATE_DIRECTOR への適切な指示完了"
    
    # 成功ログ
    echo "$(date '+%Y-%m-%d %H:%M:%S'),success,$APPROPRIATE_DIRECTOR,$ISSUE_DESCRIPTION,$INSTRUCTION" >> "tasks/logs/smart-delegation.log"
    
else
    echo ""
    echo "❌ 指示送信失敗"
    echo "🔧 推奨対処: 手動でDirector指示を確認・再実行してください"
    
    # エラーログ
    echo "$(date '+%Y-%m-%d %H:%M:%S'),error,$APPROPRIATE_DIRECTOR,$ISSUE_DESCRIPTION,$INSTRUCTION" >> "tasks/logs/smart-delegation.log"
    exit 1
fi

echo ""
echo "🎯 CEO Supreme スマート指示送信完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"