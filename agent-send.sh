#!/bin/bash

# 🎭 Simple Multi-Agent Communication System
# 参考: https://github.com/nishimoto265/Claude-Code-Communication
# 2ターミナル構造（President + Team 5×4構造）対応版

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

# ログ記録
log_send() {
    local agent="$1"
    local message="$2"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    echo "[$timestamp] $agent: $message" >> "$LOG_FILE"
}

# メッセージ送信（重複防止・タイミング改善版）
send_message() {
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
    
    # 重複送信防止チェック（簡素化版）
    local recent_duplicate=$(grep -E "^\[.*\] $agent: $message$" "$LOG_FILE" 2>/dev/null | tail -1)
    if [ -n "$recent_duplicate" ]; then
        # 最新のログエントリが5行以内にある場合は重複とみなす
        local total_lines=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
        local duplicate_line=$(grep -n -E "^\[.*\] $agent: $message$" "$LOG_FILE" 2>/dev/null | tail -1 | cut -d: -f1)
        
        if [ -n "$duplicate_line" ] && [ $((total_lines - duplicate_line)) -lt 5 ]; then
            echo "⚠️ 重複送信防止: $agent への同一メッセージが最近送信済み"
            return 0
        fi
    fi
    
    # メッセージ送信（改良版：適切な待機時間付き）
    tmux send-keys -t "$target" C-c
    sleep 0.2  # 適切な待機時間
    tmux send-keys -t "$target" "$message" C-m
    
    # ログ記録
    log_send "$agent" "$message"
    
    echo "✅ メッセージ送信完了: $agent → $message"
}

# 階層的送信（President → Director のみ、重複防止版）
send_hierarchical() {
    local dept="$1"
    local message="$2"
    
    local director="${dept}-director"
    
    echo "🔄 階層的送信開始: President → $director"
    echo "📋 Director責任: Workerへの指示振り分けは${director}が実行"
    
    # Director のみに送信（Workerへの重複送信を防止）
    send_message "$director" "【President指示】$message"
    
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
        send_message "$agent" "$message"
    done
}

# 全体送信
send_to_all() {
    local message="$1"
    
    echo "📢 全体送信開始"
    for agent in $(get_all_agents); do
        send_message "$agent" "$message"
    done
}

# システム状況確認
show_status() {
    echo "🔍 システム状況確認"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Presidentセッション確認
    if tmux has-session -t "$PRESIDENT_SESSION" 2>/dev/null; then
        echo "✅ President Terminal: 起動中"
    else
        echo "❌ President Terminal: 停止中 (npm run president で起動)"
    fi
    
    # Teamセッション確認
    if tmux has-session -t "$TEAM_SESSION" 2>/dev/null; then
        echo "✅ Team Terminal: 起動中"
        echo "   📊 部門: backend, frontend, integration, core, quality"
        echo "   👥 各部門: director + worker1,2,3"
    else
        echo "❌ Team Terminal: 停止中 (npm run team で起動)"
    fi
    
    echo ""
    echo "💬 通信ログ: $LOG_FILE"
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
            echo "      - $agent"
        done
        echo ""
    done
}

# 使用方法表示
show_usage() {
    echo "🎭 Simple Multi-Agent Communication System"
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
        send_message "$1" "$2"
        ;;
esac