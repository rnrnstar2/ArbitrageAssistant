#\!/bin/bash

SESSION_NAME="arbitrage-assistant"

echo "🔍 Haconiwa (箱庭) 実行状況チェック"
echo "=================================="

if \! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ セッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

echo "✅ セッション: $SESSION_NAME 実行中"
echo ""

# 簡単な統計
claude_count=$(tmux list-panes -t $SESSION_NAME -a -F "#{pane_current_command}" | grep -c "node")
total_panes=$(tmux list-panes -t $SESSION_NAME -a | wc -l)

echo "📊 ペイン状況: $claude_count / $total_panes Claude実行中"

# 詳細な状況
echo ""
echo "📋 詳細状況:"
for window in 0 1 2 3 4 5; do
    case $window in
        0) echo "Window $window (🏛️CEO):" ;;
        1) echo "Window $window (🗄️Backend):" ;;
        2) echo "Window $window (⚡Trading):" ;;
        3) echo "Window $window (🔌Integration):" ;;
        4) echo "Window $window (🎨Frontend):" ;;
        5) echo "Window $window (🚀DevOps):" ;;
    esac
    
    for pane in 0 1 2; do
        cmd=$(tmux list-panes -t "$SESSION_NAME:$window.$pane" -F "#{pane_current_command}" 2>/dev/null | head -1)
        # 環境変数HACONIWA_AGENT_IDもチェック（改良版）
        pane_id=$(tmux list-panes -t "$SESSION_NAME:$window.$pane" -F "#{pane_id}" 2>/dev/null)
        if [ -n "$pane_id" ]; then
            agent_id=$(tmux send-keys -t "$pane_id" 'echo $HACONIWA_AGENT_ID' Enter 2>/dev/null && sleep 0.1 && tmux capture-pane -t "$pane_id" -p | tail -1 | grep -v "^$" | head -1)
            # 空の場合は直接確認
            if [ -z "$agent_id" ] || [ "$agent_id" = "echo \$HACONIWA_AGENT_ID" ]; then
                agent_id="未設定"
            fi
        else
            agent_id="未設定"
        fi
        case $cmd in
            node) echo "  ✅ Pane $window.$pane: Claude実行中 (Agent: ${agent_id:-未設定})" ;;
            zsh|bash) echo "  ⚠️  Pane $window.$pane: シェル待機 (Agent: ${agent_id:-未設定})" ;;
            *) echo "  ❓ Pane $window.$pane: $cmd (Agent: ${agent_id:-未設定})" ;;
        esac
    done
done

echo ""
echo "💡 便利コマンド:"
echo "  監視: npm run haconiwa:monitor"
echo "  接続: npm run haconiwa:attach"
echo "  再起動: npm run haconiwa:stop && npm run haconiwa:start"
