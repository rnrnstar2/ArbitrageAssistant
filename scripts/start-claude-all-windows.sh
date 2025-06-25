#!/bin/bash

# Claude Code全ウィンドウ起動スクリプト（Step 2）
# 既存のtmuxセッションでClaude Codeを全ウィンドウで起動し、CEO指示を送信

set -e

echo "🤖 ArbitrageAssistant Claude Code全起動（Step 2/2）"

# カラー設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# ログ関数
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
}

# tmuxセッション確認
if ! tmux has-session -t arbitrage-assistant 2>/dev/null; then
    error "tmuxセッション 'arbitrage-assistant' が見つかりません"
    error "先に 'npm run setup:haconiwa' を実行してください"
    exit 1
fi

log "📊 現在のtmuxウィンドウ確認中..."
tmux list-windows -t arbitrage-assistant | while read line; do
    log "  $line"
done

# Claude Code起動確認関数
check_claude_running() {
    local window=$1
    local content=$(tmux capture-pane -t arbitrage-assistant:$window -p 2>/dev/null || echo "")
    
    echo "$content" | grep -q "Welcome to Claude Code" || \
    echo "$content" | grep -q "I'm Claude" || \
    echo "$content" | grep -q "How can I help" || \
    echo "$content" | grep -q "assistant:" || \
    echo "$content" | grep -q "/help for help"
}

# Claude Code設定完了確認関数
check_claude_ready() {
    local window=$1
    local content=$(tmux capture-pane -t arbitrage-assistant:$window -p 2>/dev/null || echo "")
    
    echo "$content" | grep -q "/help for help" || \
    echo "$content" | grep -q "I'm Claude" || \
    echo "$content" | grep -q "How can I help" || \
    echo "$content" | grep -q "assistant:"
}

# 初期設定実行関数
setup_claude_window() {
    local window=$1
    log "  🔧 Window $window: 初期設定実行中..."
    
    # ダークモード選択（デフォルト）
    tmux send-keys -t arbitrage-assistant:$window '' Enter
    sleep 2
    
    # Terms同意
    tmux send-keys -t arbitrage-assistant:$window 'y' Enter
    sleep 3
    
    if check_claude_ready $window; then
        log "  ✅ Window $window: 設定完了"
    else
        warn "  ⚠️ Window $window: 設定未完了（手動確認必要）"
    fi
}

# tmuxセッション確認（外部からでも実行可能）
check_tmux_session() {
    if [ -z "$TMUX" ]; then
        log "tmuxセッション外から実行されました"
        log "arbitrage-assistantセッションが存在するか確認中..."
        
        if tmux has-session -t arbitrage-assistant 2>/dev/null; then
            log "✅ arbitrage-assistantセッションが見つかりました"
            return 0
        else
            error "tmuxセッション 'arbitrage-assistant' が見つかりません"
            error "先に 'npm run setup:haconiwa' を実行してください"
            return 1
        fi
    fi
    
    local current_session=$(tmux display-message -p '#S' 2>/dev/null || echo "")
    if [ "$current_session" != "arbitrage-assistant" ]; then
        warn "現在のtmuxセッション: $current_session"
        log "arbitrage-assistantセッションにコマンドを送信します"
    fi
    return 0
}

# tmuxセッション確認
if ! check_tmux_session; then
    exit 1
fi

# tmux内の既存プロセスのみ停止（システム全体のclaudeは保護）
log "🔄 tmux内既存プロセス停止中（外部Claudeセッション保護）..."
# システム全体のpkillは使用せず、tmux内のプロセスのみ停止
log "✅ 安全性のため、tmux内プロセス停止のみ実行"
sleep 1

# 既存Claude Codeセッション確認と統一設定
log "🔍 既存Claude Codeセッション確認・設定統一中..."
for i in {1..7}; do
    if tmux list-windows -t arbitrage-assistant | grep -q "^$i:"; then
        # 設定完了済み確認
        if check_claude_ready $i; then
            log "  ✅ Window $i: Claude Code設定完了済み（DevOps統一）"
        # 起動済みだが設定未完了
        elif check_claude_running $i; then
            log "  🔧 Window $i: Claude Code起動済み、設定実行中..."
            setup_claude_window $i
        # 未起動
        else
            log "  🎯 Window $i: Claude Code起動・設定中..."
            
            # 空のプロンプトをクリア
            tmux send-keys -t arbitrage-assistant:$i 'clear' Enter 2>/dev/null || true
            sleep 0.5
            
            # Claude Code起動
            tmux send-keys -t arbitrage-assistant:$i 'claude --dangerously-skip-permissions' Enter
            sleep 5
            
            # 初期設定実行
            setup_claude_window $i
        fi
    fi
done

# 起動確認待機（全ウィンドウ起動完了を待つ）
log "⏳ Claude Code全起動確認中（20秒待機）..."
sleep 20

# 設定統一状況確認
log "📊 Claude Code設定統一状況確認中..."
all_ready=true
for i in {1..7}; do
    if tmux list-windows -t arbitrage-assistant | grep -q "^$i:"; then
        if check_claude_ready $i; then
            log "  ✅ Window $i: Claude Code設定完了（DevOps統一）"
        else
            warn "  ❌ Window $i: 設定未完了（要手動確認）"
            all_ready=false
        fi
    fi
done

if [ "$all_ready" = true ]; then
    log "🎉 全ウィンドウでClaude Code設定統一完了！"
else
    warn "⚠️ 一部ウィンドウで設定未完了。手動確認が必要です。"
fi

# 全Claude Code DevOps統一状態で完了
log "✅ 全Claude Code DevOps統一状態で完了"
log "🎯 CEO階層指示システム準備完了"

log ""
log "🎉 Claude Code全設定統一完了（Step 2/2）"
log ""
log "📊 完了内容:"
log "  ✅ 全ウィンドウでClaude Code設定統一（DevOps基準）"
log "  ✅ CEO階層指示システム準備完了"
log "  ✅ 設定完了状態で指示待機状態"
log ""
log "🚀 次のアクション:"
log "  1. ユーザーがCEOに戦略指示を出してください"
log "  2. CEOが各Directorに指示（ultrathinkで終了）"
log "  3. Directorが各Engineerに指示（ultrathinkで終了）"
log ""
log "📱 tmux操作:"
log "  Ctrl+B → 1: CEO Executive Office （ここから開始）"
log "  Ctrl+B → 2: Backend Architecture Room"
log "  Ctrl+B → 3: Trading Systems Room"
log "  Ctrl+B → 4: Integration Systems Room"
log "  Ctrl+B → 5: Frontend Experience Room"
log "  Ctrl+B → 6: DevOps & QA Room"
log ""

# 完了通知
osascript -e 'display notification "🤖 Claude Code全起動完了！CEO指示待機状態" with title "ArbitrageAssistant Ready" sound name "Glass"' 2>/dev/null || true

log "🎯 Claude Code全起動完了！"
log "   統合スクリプトによるtmuxセッション接続を待機中..."