#!/bin/bash

# 各ペインでエージェントID環境変数を手動設定するスクリプト
SESSION_NAME="arbitrage-assistant"

# エージェント定義関数
get_agent_for_pane() {
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

echo "🔧 全ペインに環境変数設定中..."

# セッション存在確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ セッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

# 各ペインに環境変数設定コマンドを送信
for window in 0 1 2 3 4 5; do
    for pane in 0 1 2; do
        pane_key="$window.$pane"
        agent_id=$(get_agent_for_pane "$pane_key")
        
        echo "🚀 Pane $pane_key → $agent_id"
        
        # ペイン存在確認
        if tmux list-panes -t "$SESSION_NAME:$pane_key" >/dev/null 2>&1; then
            # 環境変数設定コマンドを送信
            tmux send-keys -t "$SESSION_NAME:$pane_key" "export HACONIWA_AGENT_ID='$agent_id'" Enter
            tmux send-keys -t "$SESSION_NAME:$pane_key" "echo \"✅ エージェントID設定: $agent_id\"" Enter
        else
            echo "  ⚠️ Pane $pane_key が存在しません"
        fi
        
        sleep 0.1
    done
done

echo ""
echo "✅ 全18ペインに環境変数設定完了！"
echo ""
echo "🔍 確認コマンド:"
echo "  npm run haconiwa:debug    # 設定確認"
echo "  tmux send-keys -t arbitrage-assistant:0.0 'echo \$HACONIWA_AGENT_ID' Enter"
echo ""
echo "💡 各ペインで確認:"
echo "  echo \$HACONIWA_AGENT_ID"