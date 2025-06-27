#!/bin/bash

# Haconiwa 3秒高速復旧システムテスト
# ArbitrageAssistant専用 - 高速復旧デバッグ

SESSION_NAME="arbitrage-assistant"
BASE_DIR="/Users/rnrnstar/github/ArbitrageAssistant"

echo "🧪 Haconiwa 3秒高速復旧システム テスト開始"
echo "============================================"

# 現在の状況確認
echo "📊 現在のClaude実行状況:"
total_panes=$(tmux list-panes -t $SESSION_NAME -a | wc -l | tr -d ' ')
claude_panes=$(tmux list-panes -t $SESSION_NAME -a -F "#{pane_current_command}" | grep -c "node" || echo "0")
echo "  ${claude_panes}/${total_panes}ペインでClaude実行中"

if [ "$claude_panes" -eq "$total_panes" ]; then
    echo "✅ 全ペインでClaude実行中 - テスト終了"
    exit 0
fi

# 未起動ペイン確認
echo ""
echo "📋 未起動ペイン一覧:"
failed_panes=()
while IFS= read -r line; do
    if [[ $line =~ ^[[:space:]]*([0-9]+\.[0-9]+): ]]; then
        pane_id="${BASH_REMATCH[1]}"
        failed_panes+=("$pane_id")
        echo "  ❌ $pane_id"
    fi
done < <(tmux list-panes -t $SESSION_NAME -a -F "  #{window_index}.#{pane_index}: #{pane_current_command}" | grep -v "node")

echo ""
echo "🚨 3秒高速復旧テスト開始..."
echo "復旧対象: ${failed_panes[@]}"

# 復旧実行
for pane in "${failed_panes[@]}"; do
    # エージェントID決定
    case $pane in
        "0.0") agent_id="ceo-main" ;;
        "0.1") agent_id="director-coordinator" ;;
        "0.2") agent_id="progress-monitor" ;;
        "1.0") agent_id="backend-director" ;;
        "1.1") agent_id="amplify-gen2-specialist" ;;
        "1.2") agent_id="cognito-auth-expert" ;;
        "2.0") agent_id="trading-flow-director" ;;
        "2.1") agent_id="entry-flow-specialist" ;;
        "2.2") agent_id="settlement-flow-specialist" ;;
        "3.0") agent_id="integration-director" ;;
        "3.1") agent_id="mt5-connector-specialist" ;;
        "3.2") agent_id="websocket-engineer" ;;
        "4.0") agent_id="frontend-director" ;;
        "4.1") agent_id="react-specialist" ;;
        "4.2") agent_id="desktop-app-engineer" ;;
        "5.0") agent_id="devops-director" ;;
        "5.1") agent_id="build-optimization-engineer" ;;
        "5.2") agent_id="quality-assurance-engineer" ;;
        *) agent_id="unknown" ;;
    esac
    
    echo "⚡ Pane $pane 高速復旧: $agent_id"
    # 超高速一括復旧（並列実行）
    tmux send-keys -t "$SESSION_NAME:$pane" "export HACONIWA_AGENT_ID='$agent_id' && echo 'export HACONIWA_AGENT_ID=\"$agent_id\"' > /tmp/haconiwa_env_$pane.sh && source /tmp/haconiwa_env_$pane.sh && claude --dangerously-skip-permissions" Enter &
done

wait  # 全バックグラウンドプロセス完了まで待機
echo "⚡ 高速復旧処理完了"

# 3秒サイクル確認
echo ""
echo "⏳ 3秒サイクル確認開始..."
max_cycles=5
current_cycle=0

while [ $current_cycle -lt $max_cycles ]; do
    sleep 3
    current_cycle=$((current_cycle + 1))
    
    claude_panes_current=$(tmux list-panes -t $SESSION_NAME -a -F "#{pane_current_command}" | grep -c "node" || echo "0")
    elapsed=$((current_cycle * 3))
    
    echo "🔄 Cycle $current_cycle: ${claude_panes_current}/${total_panes}ペイン起動済み (${elapsed}秒経過)"
    
    if [ "$claude_panes_current" -eq "$total_panes" ]; then
        echo "✅ 高速復旧成功！全${total_panes}ペインでClaude起動完了 (${elapsed}秒)"
        break
    fi
done

# 最終結果
final_claude_panes=$(tmux list-panes -t $SESSION_NAME -a -F "#{pane_current_command}" | grep -c "node" || echo "0")
if [ "$final_claude_panes" -eq "$total_panes" ]; then
    echo "🎉 テスト成功！3秒高速復旧システム正常動作"
else
    echo "⚠️  テスト部分成功: ${final_claude_panes}/${total_panes}ペインで起動完了"
    echo "📋 残り未起動ペイン:"
    tmux list-panes -t $SESSION_NAME -a -F "  #{window_index}.#{pane_index}: #{pane_current_command}" | grep -v "node"
fi

echo ""
echo "🎯 テスト完了 - 3秒高速監視サイクル検証終了"