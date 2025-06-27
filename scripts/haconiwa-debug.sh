#!/bin/bash

# Haconiwa 環境変数デバッグツール
# 各ペインの環境変数設定を非侵入的に確認

SESSION_NAME="arbitrage-assistant"

echo "🔧 Haconiwa 環境変数デバッグツール"
echo "================================="

# セッション存在確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ セッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

echo "🔍 各ペインの環境変数設定確認中..."
echo ""

# 期待されるエージェント構成（連想配列を使わない方法）
get_expected_agent() {
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

success_count=0
error_count=0

for window in 0 1 2 3 4 5; do
    room_name=$(get_room_name "$window")
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎯 $room_name (Window $window)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    for pane in 0 1 2; do
        pane_key="$window.$pane"
        expected_agent=$(get_expected_agent "$pane_key")
        
        # ペイン存在確認
        if ! tmux list-panes -t "$SESSION_NAME:$pane_key" >/dev/null 2>&1; then
            echo "  ❌ Pane $pane_key: ペインが存在しません"
            ((error_count++))
            continue
        fi
        
        # プロセス確認
        cmd=$(tmux list-panes -t "$SESSION_NAME:$pane_key" -F "#{pane_current_command}" 2>/dev/null)
        
        # ペインのシェル環境を確認（tmux show-environment使用）
        env_output=$(tmux show-environment -t "$SESSION_NAME:$pane_key" 2>/dev/null | grep HACONIWA_AGENT_ID || echo "")
        
        if [ -n "$env_output" ]; then
            actual_agent=$(echo "$env_output" | cut -d= -f2)
            if [ "$actual_agent" = "$expected_agent" ]; then
                echo "  ✅ Pane $pane_key: $actual_agent (プロセス: $cmd) - 正常"
                ((success_count++))
            else
                echo "  ⚠️  Pane $pane_key: $actual_agent ≠ $expected_agent (プロセス: $cmd) - 不一致"
                ((error_count++))
            fi
        else
            echo "  ❌ Pane $pane_key: 環境変数未設定 (プロセス: $cmd)"
            ((error_count++))
        fi
    done
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 デバッグ結果サマリー"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 正常なペイン: $success_count"
echo "❌ 問題のあるペイン: $error_count"
echo "📊 総ペイン数: $((success_count + error_count))"

if [ $error_count -gt 0 ]; then
    echo ""
    echo "🔧 修復推奨アクション："
    echo "  1. Haconiwa再起動: npm run haconiwa:stop && npm run haconiwa:start"
    echo "  2. 個別ペインの環境変数再設定"
    echo "  3. tmuxセッション完全クリーンアップ後の再起動"
else
    echo ""
    echo "🎉 全ペインの環境変数設定が正常です！"
fi

echo ""
echo "💡 追加デバッグコマンド："
echo "  特定ペインの詳細確認: tmux display-message -t arbitrage-assistant:X.Y -p '#{pane_current_command}'"
echo "  環境変数手動確認: tmux send-keys -t arbitrage-assistant:X.Y 'echo \$HACONIWA_AGENT_ID' Enter"