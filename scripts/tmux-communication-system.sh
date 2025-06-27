#!/bin/bash

# Haconiwa tmux双方向通信システム（v2.0）
# tmuxのcapture-pane、pipe-paneを活用した情報受け渡し最適化

set -e

SESSION_NAME="arbitrage-assistant"
COMM_DIR="/tmp/haconiwa-communication"
MONITORING_LOG="$COMM_DIR/monitoring.log"

# 通信ディレクトリ初期化
mkdir -p "$COMM_DIR/responses"
mkdir -p "$COMM_DIR/status"
mkdir -p "$COMM_DIR/broadcasts"

# ==========================================
# 双方向通信機能
# ==========================================

# 指示送信＋応答確認システム
send_instruction_with_response() {
    local target_pane="$1"
    local instruction="$2"
    local timeout="${3:-30}"  # デフォルト30秒タイムアウト
    local response_file="$COMM_DIR/responses/pane_$target_pane.response"
    
    echo "🚀 双方向指示送信: Pane $target_pane"
    echo "📋 指示内容: $instruction"
    
    # 応答ファイル初期化
    echo "" > "$response_file"
    
    # セッション確認
    if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
        echo "❌ Haconiwaセッション未起動"
        return 1
    fi
    
    # 指示送信（構造化メッセージ）
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local structured_instruction=$(cat <<EOF
{
  "type": "instruction",
  "timestamp": "$timestamp",
  "from": "system",
  "to": "pane_$target_pane",
  "instruction": "$instruction",
  "response_required": true,
  "timeout": $timeout
}
EOF
)
    
    # 指示送信（JSON構造化）
    tmux send-keys -t "$SESSION_NAME:$target_pane" "echo '📨 【構造化指示受信】' && echo '$structured_instruction' && echo '📝 作業完了時は以下コマンドで応答:' && echo 'echo \"RESPONSE_COMPLETE: [作業結果要約]\" > $response_file' && echo '🎯 指示実行開始:' && $instruction" Enter
    
    echo "⏳ 応答待機中... (最大${timeout}秒)"
    
    # 応答確認ループ
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if [ -s "$response_file" ] && grep -q "RESPONSE_COMPLETE" "$response_file" 2>/dev/null; then
            local response=$(cat "$response_file" | sed 's/RESPONSE_COMPLETE: //')
            echo "✅ 応答受信完了 (${elapsed}秒): $response"
            
            # 応答ログ記録
            echo "[$timestamp] Pane $target_pane Response: $response" >> "$MONITORING_LOG"
            return 0
        fi
        
        sleep 1
        elapsed=$((elapsed + 1))
        
        # 進捗表示（10秒間隔）
        if [ $((elapsed % 10)) -eq 0 ]; then
            echo "⏳ 応答待機中... ${elapsed}/${timeout}秒経過"
        fi
    done
    
    echo "⚠️ 応答タイムアウト (${timeout}秒経過)"
    return 1
}

# ペイン出力キャプチャ＋分析
capture_pane_output() {
    local target_pane="$1"
    local lines="${2:-50}"  # デフォルト50行
    local output_file="$COMM_DIR/captures/pane_$target_pane.txt"
    
    mkdir -p "$COMM_DIR/captures"
    
    echo "📸 ペイン出力キャプチャ: Pane $target_pane (最新${lines}行)"
    
    # tmux capture-paneでペイン内容を取得
    if tmux capture-pane -t "$SESSION_NAME:$target_pane" -p | tail -n "$lines" > "$output_file" 2>/dev/null; then
        echo "✅ キャプチャ完了: $output_file"
        
        # エラー・警告検出
        local errors=$(grep -i "error\|エラー" "$output_file" | wc -l)
        local warnings=$(grep -i "warning\|警告" "$output_file" | wc -l)
        
        if [ "$errors" -gt 0 ] || [ "$warnings" -gt 0 ]; then
            echo "⚠️ 問題検出: エラー${errors}件、警告${warnings}件"
            echo "🔍 詳細: $output_file"
        fi
        
        return 0
    else
        echo "❌ キャプチャ失敗: Pane $target_pane"
        return 1
    fi
}

# ==========================================
# リアルタイム監視システム
# ==========================================

# 全ペイン状態監視ダッシュボード
monitor_all_panes() {
    local refresh_interval="${1:-5}"  # デフォルト5秒間隔
    
    echo "📊 Haconiwa リアルタイム監視ダッシュボード開始"
    echo "🔄 更新間隔: ${refresh_interval}秒"
    echo "📋 Ctrl+C で終了"
    echo ""
    
    while true; do
        clear
        echo "🎭 Haconiwa 6x3 Grid エージェント監視ダッシュボード"
        echo "📅 $(date '+%Y-%m-%d %H:%M:%S')"
        echo "==============================================="
        
        # 全ペイン状態取得
        local total_panes=0
        local active_claude_panes=0
        local error_panes=0
        
        # Window別状態表示
        for window in 0 1 2 3 4 5; do
            case $window in
                0) window_name="🏛️CEO-Strategy" ;;
                1) window_name="🗄️Backend-AWS" ;;
                2) window_name="⚡Trading-Engine" ;;
                3) window_name="🔌Integration-MT5" ;;
                4) window_name="🎨Frontend-UI" ;;
                5) window_name="🚀DevOps-CI" ;;
            esac
            
            echo ""
            echo "Window $window: $window_name"
            echo "----------------------------------------"
            
            for pane in 0 1 2; do
                local pane_id="$window.$pane"
                total_panes=$((total_panes + 1))
                
                # ペイン存在確認
                if tmux list-panes -t "$SESSION_NAME:$pane_id" >/dev/null 2>&1; then
                    # 現在のコマンド取得
                    local current_cmd=$(tmux list-panes -t "$SESSION_NAME:$pane_id" -F "#{pane_current_command}" 2>/dev/null || echo "unknown")
                    
                    # エージェント名取得
                    local agent_name=$(get_agent_name "$pane_id")
                    
                    # 状態判定
                    if [ "$current_cmd" = "node" ]; then
                        echo "  ✅ Pane $pane_id: $agent_name (Claude稼働中)"
                        active_claude_panes=$((active_claude_panes + 1))
                    elif [ "$current_cmd" = "bash" ] || [ "$current_cmd" = "zsh" ]; then
                        echo "  ⏸️  Pane $pane_id: $agent_name (待機中)"
                    else
                        echo "  ❓ Pane $pane_id: $agent_name ($current_cmd)"
                    fi
                    
                    # エラー検出（直近出力から）
                    local recent_output=$(tmux capture-pane -t "$SESSION_NAME:$pane_id" -p | tail -n 5 2>/dev/null || echo "")
                    if echo "$recent_output" | grep -qi "error\|エラー"; then
                        echo "    🚨 エラー検出: 直近出力に問題あり"
                        error_panes=$((error_panes + 1))
                    fi
                else
                    echo "  ❌ Pane $pane_id: 存在しません"
                fi
            done
        done
        
        # サマリー表示
        echo ""
        echo "==============================================="
        echo "📊 システム状態サマリー"
        echo "  全ペイン数: $total_panes"
        echo "  Claude稼働中: $active_claude_panes"
        echo "  エラー検出: $error_panes"
        
        # 稼働率計算
        local operational_rate=$((active_claude_panes * 100 / total_panes))
        echo "  稼働率: ${operational_rate}%"
        
        if [ "$operational_rate" -eq 100 ]; then
            echo "  🎉 全エージェント正常稼働中！"
        elif [ "$operational_rate" -ge 80 ]; then
            echo "  ✅ 良好な稼働状態"
        else
            echo "  ⚠️ 稼働率低下 - 復旧が必要"
        fi
        
        # 監視ログ記録
        echo "$(date '+%Y-%m-%d %H:%M:%S') - 稼働率: ${operational_rate}%, Claude稼働中: ${active_claude_panes}/${total_panes}, エラー: ${error_panes}" >> "$MONITORING_LOG"
        
        sleep "$refresh_interval"
    done
}

# エージェント名取得ヘルパー
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
        *) echo "unknown-agent" ;;
    esac
}

# ==========================================
# ブロードキャスト通信システム
# ==========================================

# 全エージェントへの一斉通知
broadcast_to_all_agents() {
    local message="$1"
    local priority="${2:-normal}"  # normal, high, emergency
    
    echo "📢 全エージェント一斉通知"
    echo "📋 メッセージ: $message"
    echo "🚨 優先度: $priority"
    echo ""
    
    # 優先度別のプレフィックス
    local prefix
    case "$priority" in
        "emergency") prefix="🚨【緊急】" ;;
        "high") prefix="⚠️【重要】" ;;
        *) prefix="📢【通知】" ;;
    esac
    
    local broadcast_message="$prefix $message"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 全18ペインに送信
    local sent_count=0
    for window in 0 1 2 3 4 5; do
        for pane in 0 1 2; do
            local pane_id="$window.$pane"
            if tmux list-panes -t "$SESSION_NAME:$pane_id" >/dev/null 2>&1; then
                tmux send-keys -t "$SESSION_NAME:$pane_id" "echo '$broadcast_message' && echo '[$timestamp]'" Enter
                sent_count=$((sent_count + 1))
                sleep 0.1  # 送信間隔
            fi
        done
    done
    
    echo "✅ ブロードキャスト完了: ${sent_count}ペインに送信"
    
    # ブロードキャストログ記録
    echo "[$timestamp] BROADCAST ($priority): $message" >> "$MONITORING_LOG"
}

# 特定Department（Window）への通知
broadcast_to_department() {
    local department="$1"  # ceo, backend, trading, integration, frontend, devops
    local message="$2"
    
    # Department → Window番号マッピング
    local window_num
    case "$department" in
        "ceo") window_num=0 ;;
        "backend") window_num=1 ;;
        "trading") window_num=2 ;;
        "integration") window_num=3 ;;
        "frontend") window_num=4 ;;
        "devops") window_num=5 ;;
        *) echo "❌ 不明なDepartment: $department"; return 1 ;;
    esac
    
    echo "📢 Department通知: $department (Window $window_num)"
    echo "📋 メッセージ: $message"
    
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local dept_message="📢【Department通知】$message"
    
    # 該当Windowの全ペインに送信
    local sent_count=0
    for pane in 0 1 2; do
        local pane_id="$window_num.$pane"
        if tmux list-panes -t "$SESSION_NAME:$pane_id" >/dev/null 2>&1; then
            tmux send-keys -t "$SESSION_NAME:$pane_id" "echo '$dept_message' && echo '[$timestamp]'" Enter
            sent_count=$((sent_count + 1))
            sleep 0.1
        fi
    done
    
    echo "✅ Department通知完了: ${sent_count}ペインに送信"
}

# ==========================================
# メイン機能選択
# ==========================================

case "${1:-help}" in
    "send")
        send_instruction_with_response "$2" "$3" "$4"
        ;;
    "capture")
        capture_pane_output "$2" "$3"
        ;;
    "monitor")
        monitor_all_panes "$2"
        ;;
    "broadcast")
        broadcast_to_all_agents "$2" "$3"
        ;;
    "dept-notify")
        broadcast_to_department "$2" "$3"
        ;;
    "help"|*)
        echo "🎭 Haconiwa tmux双方向通信システム (v2.0)"
        echo ""
        echo "使用法:"
        echo "  $0 send [pane_id] [instruction] [timeout]  # 双方向指示送信"
        echo "  $0 capture [pane_id] [lines]               # ペイン出力キャプチャ"
        echo "  $0 monitor [interval]                      # リアルタイム監視"
        echo "  $0 broadcast [message] [priority]          # 全エージェント通知"
        echo "  $0 dept-notify [dept] [message]            # Department通知"
        echo ""
        echo "例:"
        echo "  $0 send 1.1 'npm run build' 60"
        echo "  $0 capture 2.0 100"
        echo "  $0 monitor 3"
        echo "  $0 broadcast 'システムメンテナンス開始' high"
        echo "  $0 dept-notify backend 'Amplify設定更新中'"
        ;;
esac