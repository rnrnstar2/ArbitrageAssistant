#!/bin/bash

# Haconiwa環境変数設定修復スクリプト
# 起動済みClaudeペインに環境変数を正しく設定

SESSION_NAME="arbitrage-assistant"

echo "🔧 Haconiwa環境変数設定修復ツール"
echo "======================================"

# セッション存在確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ セッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

# エージェント構成定義
get_agent_id() {
    case "$1" in
        "0.0") echo "ceo-main" ;;
        "0.1") echo "director-coordinator" ;;
        "0.2") echo "progress-monitor" ;;
        "1.0") echo "backend-director" ;;
        "1.1") echo "amplify-gen2-specialist" ;;
        "1.2") echo "cognito-auth-expert" ;;
        "2.0") echo "trading-flow-director" ;;
        "2.1") echo "entry-flow-specialist" ;;
        "2.2") echo "settlement-flow-specialist" ;;
        "3.0") echo "integration-director" ;;
        "3.1") echo "mt5-connector-specialist" ;;
        "3.2") echo "websocket-engineer" ;;
        "4.0") echo "frontend-director" ;;
        "4.1") echo "react-specialist" ;;
        "4.2") echo "desktop-app-engineer" ;;
        "5.0") echo "devops-director" ;;
        "5.1") echo "build-optimization-engineer" ;;
        "5.2") echo "quality-assurance-engineer" ;;
        *) echo "unknown" ;;
    esac
}

echo "🔍 現在の状況確認..."
claude_count=$(tmux list-panes -t $SESSION_NAME -a -F "#{pane_current_command}" | grep -c "node")
total_panes=$(tmux list-panes -t $SESSION_NAME -a | wc -l | tr -d ' ')
echo "📊 Claude実行状況: $claude_count / $total_panes"

echo ""
echo "🔧 環境変数設定を修復中..."

success_count=0
error_count=0

for window in 0 1 2 3 4 5; do
    for pane in 0 1 2; do
        pane_key="$window.$pane"
        agent_id=$(get_agent_id "$pane_key")
        
        echo "🎯 Pane $pane_key: $agent_id 設定中..."
        
        # tmux環境変数に直接設定
        if tmux set-environment -t "$SESSION_NAME:$pane_key" HACONIWA_AGENT_ID "$agent_id" 2>/dev/null; then
            echo "  ✅ tmux環境変数設定成功"
            ((success_count++))
        else
            echo "  ❌ tmux環境変数設定失敗"
            ((error_count++))
        fi
        
        # 念のため環境変数ファイルも更新
        echo "export HACONIWA_AGENT_ID=\"$agent_id\"" > "/tmp/haconiwa_env_$pane_key.sh"
        
        # 起動済みClaudeプロセスに環境変数を注入（安全な方法）
        # Note: 既に起動済みのClaudeには反映されないが、次回起動時に有効
        
        sleep 0.1
    done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 環境変数設定結果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 成功: $success_count ペイン"
echo "❌ 失敗: $error_count ペイン"

# 環境変数ファイル確認
env_files=$(ls -1 /tmp/haconiwa_env_*.sh 2>/dev/null | wc -l | tr -d ' ')
echo "📁 環境変数ファイル: $env_files / 18"

echo ""
echo "🔍 設定確認中..."
for window in 0 1 2 3 4 5; do
    for pane in 0 1 2; do
        pane_key="$window.$pane"
        expected_agent=$(get_agent_id "$pane_key")
        
        # tmux環境変数確認
        actual_agent=$(tmux show-environment -t "$SESSION_NAME:$pane_key" HACONIWA_AGENT_ID 2>/dev/null | cut -d= -f2 2>/dev/null || echo "")
        
        if [ "$actual_agent" = "$expected_agent" ]; then
            echo "  ✅ Pane $pane_key: $actual_agent (正常)"
        else
            echo "  ❌ Pane $pane_key: 期待値=$expected_agent, 実際値=$actual_agent"
        fi
    done
done

echo ""
echo "💡 注意事項:"
echo "  - 既に起動済みのClaudeには環境変数は即座に反映されません"
echo "  - 各ペインでClaude再起動が必要な場合があります"
echo "  - 次回のHaconiwa起動時には正しく設定されます"

echo ""
echo "🔧 Claude再起動が必要な場合:"
echo "  各ペインで: Ctrl+C → 'claude' Enter"
echo "  または: npm run haconiwa:stop && npm run haconiwa:start"