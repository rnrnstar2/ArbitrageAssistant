#!/bin/bash

# 🎭 Improved Multi-Agent Communication System
# 参考: https://github.com/nishimoto265/Claude-Code-Communication
# 改良点: Claude Code事前起動前提・実行確実化・ultrathink自動付加

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRESIDENT_SESSION="president"
TEAM_SESSION="team"
LOG_FILE="$SCRIPT_DIR/logs/agent_communication.log"

# ログディレクトリ作成
mkdir -p "$(dirname "$LOG_FILE")"

# エージェント→tmuxターゲットマッピング
get_agent_target() {
    local agent="$1"
    case "$agent" in
        # President Terminal
        "president") echo "$PRESIDENT_SESSION:0" ;;
        
        # Backend Department (Window backend)
        "backend-director") echo "$TEAM_SESSION:backend.0" ;;
        "backend-worker1") echo "$TEAM_SESSION:backend.1" ;;
        "backend-worker2") echo "$TEAM_SESSION:backend.2" ;;
        "backend-worker3") echo "$TEAM_SESSION:backend.3" ;;
        
        # Frontend Department (Window frontend)
        "frontend-director") echo "$TEAM_SESSION:frontend.0" ;;
        "frontend-worker1") echo "$TEAM_SESSION:frontend.1" ;;
        "frontend-worker2") echo "$TEAM_SESSION:frontend.2" ;;
        "frontend-worker3") echo "$TEAM_SESSION:frontend.3" ;;
        
        # Integration Department (Window integration)
        "integration-director") echo "$TEAM_SESSION:integration.0" ;;
        "integration-worker1") echo "$TEAM_SESSION:integration.1" ;;
        "integration-worker2") echo "$TEAM_SESSION:integration.2" ;;
        "integration-worker3") echo "$TEAM_SESSION:integration.3" ;;
        
        # Core Department (Window core)
        "core-director") echo "$TEAM_SESSION:core.0" ;;
        "core-worker1") echo "$TEAM_SESSION:core.1" ;;
        "core-worker2") echo "$TEAM_SESSION:core.2" ;;
        "core-worker3") echo "$TEAM_SESSION:core.3" ;;
        
        # Quality Department (Window quality)
        "quality-director") echo "$TEAM_SESSION:quality.0" ;;
        "quality-worker1") echo "$TEAM_SESSION:quality.1" ;;
        "quality-worker2") echo "$TEAM_SESSION:quality.2" ;;
        "quality-worker3") echo "$TEAM_SESSION:quality.3" ;;
        
        *) echo "" ;;
    esac
}

# 全エージェントリスト取得
get_all_agents() {
    echo "president backend-director backend-worker1 backend-worker2 backend-worker3 frontend-director frontend-worker1 frontend-worker2 frontend-worker3 integration-director integration-worker1 integration-worker2 integration-worker3 core-director core-worker1 core-worker2 core-worker3 quality-director quality-worker1 quality-worker2 quality-worker3"
}

# 部門別エージェント取得
get_department_agents() {
    local dept="$1"
    case "$dept" in
        "backend") echo "backend-director backend-worker1 backend-worker2 backend-worker3" ;;
        "frontend") echo "frontend-director frontend-worker1 frontend-worker2 frontend-worker3" ;;
        "integration") echo "integration-director integration-worker1 integration-worker2 integration-worker3" ;;
        "core") echo "core-director core-worker1 core-worker2 core-worker3" ;;
        "quality") echo "quality-director quality-worker1 quality-worker2 quality-worker3" ;;
        *) echo "" ;;
    esac
}

# ターゲット存在確認
check_target() {
    local target="$1"
    
    if [[ "$target" == "$PRESIDENT_SESSION:"* ]]; then
        # Presidentセッション確認
        if ! tmux has-session -t "$PRESIDENT_SESSION" 2>/dev/null; then
            echo "❌ Presidentセッション '$PRESIDENT_SESSION' が見つかりません"
            echo "💡 起動コマンド: npm run president"
            return 1
        fi
    else
        # Teamセッション確認
        if ! tmux has-session -t "$TEAM_SESSION" 2>/dev/null; then
            echo "❌ Teamセッション '$TEAM_SESSION' が見つかりません"
            echo "💡 起動コマンド: npm run team"
            return 1
        fi
        
        # ペイン存在確認
        if ! tmux list-panes -t "$target" >/dev/null 2>&1; then
            echo "❌ ターゲットペイン '$target' が見つかりません"
            return 1
        fi
    fi
    
    return 0
}

# Claude Code実行状態確認
check_claude_running() {
    local target="$1"
    
    # tmuxペインでClaude Codeが動作しているかチェック
    local pane_content=$(tmux capture-pane -t "$target" -p | tail -5)
    
    # Claude Codeの典型的なプロンプトやメッセージを確認
    if echo "$pane_content" | grep -q -E "(Claude|claude|Assistant|How can I help|What would you like)" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# ログ記録
log_send() {
    local agent="$1"
    local message="$2"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    echo "[$timestamp] $agent: $message" >> "$LOG_FILE"
}

# 改良版メッセージ送信（Claude Code事前起動前提）
send_message_to_claude() {
    local agent="$1"
    local message="$2"
    
    local target=$(get_agent_target "$agent")
    if [ -z "$target" ]; then
        echo "❌ 未知のエージェント: $agent"
        echo "💡 使用可能エージェント: $(get_all_agents)"
        return 1
    fi
    
    if ! check_target "$target"; then
        return 1
    fi
    
    # ultrathink品質指示に自動変換
    local enhanced_message="$message この指示をultrathink品質で徹底的に分析・実装してください。"
    
    echo "🤖 Claude Code メッセージ送信中..."
    echo "📍 エージェント: $agent"
    echo "🎯 ターゲット: $target"
    echo "📝 メッセージ: $enhanced_message"
    
    # Claude Codeが実行中かチェック
    if check_claude_running "$target"; then
        echo "✅ Claude Code実行中を確認"
        
        # 現在の入力をクリア → メッセージ送信 → 実行
        tmux send-keys -t "$target" C-c
        sleep 0.3
        tmux send-keys -t "$target" "$enhanced_message"
        sleep 0.2
        tmux send-keys -t "$target" C-m
        
        echo "✅ メッセージ送信完了: $agent"
        echo "🚀 ultrathink品質適用済み"
        
    else
        echo "⚠️ Claude Code未実行または未確認"
        echo "🔄 Claude Code起動を試行中..."
        
        # Claude Code起動 → 役割設定 → メッセージ送信
        local role_setup="あなたは${agent}です。"
        
        # 環境変数を使用して役割を特定
        case "$agent" in
            *-director) role_setup="あなたは${agent}です。あなたの部門の統括責任者として行動してください。" ;;
            *-worker*) role_setup="あなたは${agent}です。あなたの専門分野で高品質な実装を行ってください。" ;;
            president) role_setup="あなたはPresidentです。全20エージェントの統括責任者として戦略立案と指示を行ってください。" ;;
        esac
        
        # Claude Code起動
        tmux send-keys -t "$target" "claude --dangerously-skip-permissions" C-m
        sleep 5
        
        # 役割設定送信
        tmux send-keys -t "$target" "$role_setup" C-m
        sleep 2
        
        # メッセージ送信
        tmux send-keys -t "$target" "$enhanced_message" C-m
        
        echo "✅ Claude Code起動・メッセージ送信完了: $agent"
    fi
    
    # ログ記録
    log_send "$agent" "$enhanced_message"
    
    return 0
}

# 階層的送信（改良版）
send_hierarchical() {
    local dept="$1"
    local message="$2"
    
    local director="${dept}-director"
    
    echo "🔄 階層的送信開始: President → $director"
    echo "📋 Director責任: Workerへの指示振り分けは${director}が実行"
    
    # Director のみに送信
    send_message_to_claude "$director" "【President指示】$message"
    
    echo "✅ 階層的送信完了: ${director}がWorkerへの指示振り分けを担当"
}

# 部門全体送信
send_to_department() {
    local dept="$1"
    local message="$2"
    
    local agents=$(get_department_agents "$dept")
    if [ -z "$agents" ]; then
        echo "❌ 未知の部門: $dept"
        echo "💡 使用可能部門: backend, frontend, integration, core, quality"
        return 1
    fi
    
    echo "📢 部門全体送信: $dept"
    for agent in $agents; do
        send_message_to_claude "$agent" "$message"
        sleep 1  # 連続送信の間隔
    done
}

# 全体送信
send_to_all() {
    local message="$1"
    
    echo "📢 全体送信開始"
    for agent in $(get_all_agents); do
        send_message_to_claude "$agent" "$message"
        sleep 1  # 連続送信の間隔
    done
}

# システム状況確認
show_status() {
    echo "🔍 システム状況確認"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Presidentセッション確認
    if tmux has-session -t "$PRESIDENT_SESSION" 2>/dev/null; then
        echo "✅ President Terminal: 起動中"
        local pres_target=$(get_agent_target "president")
        if check_claude_running "$pres_target"; then
            echo "   🤖 Claude Code: 実行中"
        else
            echo "   ⚠️ Claude Code: 未確認"
        fi
    else
        echo "❌ President Terminal: 停止中 (npm run president で起動)"
    fi
    
    # Teamセッション確認
    if tmux has-session -t "$TEAM_SESSION" 2>/dev/null; then
        echo "✅ Team Terminal: 起動中"
        echo "   📊 部門: backend, frontend, integration, core, quality"
        echo "   👥 各部門: director + worker1,2,3"
        
        # 各エージェントのClaude Code状態確認
        local running_count=0
        local total_count=0
        
        for agent in $(get_all_agents | grep -v president); do
            local target=$(get_agent_target "$agent")
            if [ -n "$target" ]; then
                total_count=$((total_count + 1))
                if check_claude_running "$target"; then
                    running_count=$((running_count + 1))
                fi
            fi
        done
        
        echo "   🤖 Claude Code状態: $running_count/$total_count エージェント実行中"
    else
        echo "❌ Team Terminal: 停止中 (npm run team で起動)"
    fi
    
    echo ""
    echo "💬 通信ログ: $LOG_FILE"
    echo "🚀 改良版機能: Claude Code事前起動前提・ultrathink自動付加"
}

# エージェント一覧表示
show_agents() {
    echo "👥 エージェント一覧"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🏛️ President Terminal:"
    echo "   - president"
    echo ""
    echo "🗄️ Team Terminal (5部門 × 4エージェント):"
    for dept in backend frontend integration core quality; do
        echo "   📁 $dept Department:"
        for agent in $(get_department_agents "$dept"); do
            local target=$(get_agent_target "$agent")
            if check_claude_running "$target" 2>/dev/null; then
                echo "      - $agent (🤖 Claude実行中)"
            else
                echo "      - $agent (⚠️ Claude未確認)"
            fi
        done
        echo ""
    done
}

# 使用方法表示
show_usage() {
    echo "🎭 Improved Multi-Agent Communication System"
    echo ""
    echo "🚀 改良点:"
    echo "  • Claude Code事前起動前提"
    echo "  • ultrathink品質自動付加"
    echo "  • 実行確実化システム"
    echo ""
    echo "使用方法:"
    echo "  $0 <agent> \"<message>\"            # 個別エージェント送信"
    echo "  $0 department <dept> \"<message>\"   # 部門全体送信"
    echo "  $0 hierarchy <dept> \"<message>\"    # 階層的送信（President→Director→Workers）"
    echo "  $0 all \"<message>\"                # 全体送信"
    echo "  $0 status                          # システム状況確認"
    echo "  $0 list                            # エージェント一覧"
    echo ""
    echo "例:"
    echo "  $0 backend-director \"GraphQL基盤構築開始\""
    echo "  $0 department backend \"バックエンド基盤強化\""
    echo "  $0 hierarchy core \"MVP核心機能実装開始\""
    echo "  $0 all \"システム全体品質チェック実行\""
}

# メイン処理
case "${1:-help}" in
    "status")
        show_status
        ;;
    "list")
        show_agents
        ;;
    "department")
        if [ $# -lt 3 ]; then
            echo "❌ 引数不足: department <dept> \"<message>\""
            exit 1
        fi
        send_to_department "$2" "$3"
        ;;
    "hierarchy")
        if [ $# -lt 3 ]; then
            echo "❌ 引数不足: hierarchy <dept> \"<message>\""
            exit 1
        fi
        send_hierarchical "$2" "$3"
        ;;
    "all")
        if [ $# -lt 2 ]; then
            echo "❌ 引数不足: all \"<message>\""
            exit 1
        fi
        send_to_all "$2"
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    *)
        if [ $# -lt 2 ]; then
            echo "❌ 引数不足: <agent> \"<message>\""
            show_usage
            exit 1
        fi
        send_message_to_claude "$1" "$2"
        ;;
esac