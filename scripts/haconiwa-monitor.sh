#!/bin/bash

# Haconiwa 6x3 Grid エージェント監視システム（非侵入型）
# エージェント割り当て情報をファイルベースで管理

SESSION_NAME="arbitrage-assistant"
MONITOR_FILE="/tmp/haconiwa-agents.json"

echo "🔍 Haconiwa (箱庭) エージェント監視システム"
echo "=============================================="

# セッション存在確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ セッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

# エージェント構成定義（arbitrage-assistant.yamlと同期）
get_agent_name() {
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

get_room_name() {
    case "$1" in
        "0") echo "🏛️CEO-Strategy" ;;
        "1") echo "🗄️Backend-AWS" ;;
        "2") echo "⚡Trading-Engine" ;;
        "3") echo "🔌Integration-MT5" ;;
        "4") echo "🎨Frontend-UI" ;;
        "5") echo "🚀DevOps-CI" ;;
        *) echo "Unknown" ;;
    esac
}

# 簡単な統計
claude_count=$(tmux list-panes -t $SESSION_NAME -a -F "#{pane_current_command}" | grep -c "node" || echo "0")
total_panes=$(tmux list-panes -t $SESSION_NAME -a | wc -l | tr -d ' ')

echo "✅ セッション: $SESSION_NAME 実行中"
echo "📊 Claude実行状況: $claude_count / $total_panes ペイン"
echo ""

# テーブル形式で表示（haconiwa monitor風）
printf "┏━━━━━━━━━━━━┳━━━━━━┳━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━┓\n"
printf "┃ 部屋       ┃ デバイス ┃ プロバイダAI  ┃ エージェント名    ┃ 稼働率                                                     ┃ ステータス ┃\n"
printf "┡━━━━━━━━━━━━╇━━━━━━╇━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━┩\n"

for window in 0 1 2 3 4 5; do
    for pane in 0 1 2; do
        room_key="$window.$pane"
        agent_name=$(get_agent_name "$room_key")
        room_name=$(get_room_name "$window")
        
        # プロセス確認
        cmd=$(tmux list-panes -t "$SESSION_NAME:$window.$pane" -F "#{pane_current_command}" 2>/dev/null | head -1)
        
        # Claude実行状況
        if [ "$cmd" = "node" ]; then
            claude_status="✓ Claude"
            activity="  0.0% ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░"
            status="仕事待機中"
        else
            claude_status="✗ Claude無し"
            activity="N/A"
            status="プロセス待機"
        fi
        
        printf "│ %-10s │ %-4s │ %-13s │ %-17s │ %s │ %-7s │\n" \
               "$room_name" "$pane" "$claude_status" "$agent_name" "$activity" "$status"
    done
done

echo ""
echo "💡 便利コマンド:"
echo "  アクセス: tmux attach -t $SESSION_NAME"
echo "  ウィンドウ切替: Ctrl+b + 0-5"
echo "  ペイン切替: Ctrl+b + 矢印キー"
echo "  再起動: npm run haconiwa:stop && npm run haconiwa:start"
echo ""
echo "🎯 各エージェントの役割:"
echo "  CEO系: 戦略決定・Directors調整・進捗監視"
echo "  Backend系: AWS Amplify Gen2・GraphQL・Cognito"
echo "  Trading系: Position-Trail-Action・金融計算"
echo "  Integration系: MT5連携・WebSocket・C++/MQL5"
echo "  Frontend系: React・Next.js・Tauri・UI実装"
echo "  DevOps系: Turborepo・CI/CD・品質管理"