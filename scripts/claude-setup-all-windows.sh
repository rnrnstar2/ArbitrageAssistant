#!/bin/bash

# 全ウィンドウClaude Code初期設定統一スクリプト
# DevOpsウィンドウの設定完了状態に全ウィンドウを統一

set -e

echo "🎯 全ウィンドウClaude Code設定統一開始"

# カラー設定
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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
    exit 1
fi

# Claude Code設定完了確認関数
check_claude_ready() {
    local window=$1
    local content=$(tmux capture-pane -t arbitrage-assistant:$window -p 2>/dev/null || echo "")
    
    # 設定完了済みのパターンをチェック
    echo "$content" | grep -q "/help for help" || \
    echo "$content" | grep -q "I'm Claude" || \
    echo "$content" | grep -q "How can I help" || \
    echo "$content" | grep -q "assistant:"
}

# 初期設定画面確認関数
check_claude_setup_needed() {
    local window=$1
    local content=$(tmux capture-pane -t arbitrage-assistant:$window -p 2>/dev/null || echo "")
    
    # 初期設定画面のパターンをチェック
    echo "$content" | grep -q "Let's get started" || \
    echo "$content" | grep -q "Choose the text style"
}

log "📊 全ウィンドウClaude Code状況確認中..."

# Window 2-7でClaude Code状況確認・統一
for i in {2..7}; do
    if tmux list-windows -t arbitrage-assistant | grep -q "^$i:"; then
        if check_claude_ready $i; then
            log "  ✅ Window $i: Claude Code設定完了済み"
        elif check_claude_setup_needed $i; then
            log "  🔧 Window $i: 初期設定実行中..."
            
            # 初期設定を自動完了
            # 1. ダークモード選択（デフォルト）
            tmux send-keys -t arbitrage-assistant:$i '' Enter
            sleep 2
            
            # 2. Terms同意
            tmux send-keys -t arbitrage-assistant:$i 'y' Enter
            sleep 2
            
            # 3. 設定完了確認
            sleep 3
            if check_claude_ready $i; then
                log "  ✅ Window $i: 初期設定完了"
            else
                warn "  ⚠️ Window $i: 設定未完了（手動確認必要）"
            fi
        else
            warn "  🔄 Window $i: Claude Code未起動（起動実行中）"
            
            # Claude Code起動
            tmux send-keys -t arbitrage-assistant:$i 'claude --dangerously-skip-permissions' Enter
            sleep 5
            
            # 初期設定実行
            if check_claude_setup_needed $i; then
                log "  🔧 Window $i: 初期設定実行中..."
                
                # ダークモード選択
                tmux send-keys -t arbitrage-assistant:$i '' Enter
                sleep 2
                
                # Terms同意
                tmux send-keys -t arbitrage-assistant:$i 'y' Enter
                sleep 2
                
                log "  ✅ Window $i: Claude Code起動・設定完了"
            fi
        fi
    fi
done

log ""
log "🎉 全ウィンドウClaude Code設定統一完了！"
log ""
log "📊 統一後状況:"
for i in {2..7}; do
    if tmux list-windows -t arbitrage-assistant | grep -q "^$i:"; then
        if check_claude_ready $i; then
            log "  ✅ Window $i: 設定完了・使用可能"
        else
            warn "  ❌ Window $i: 手動確認必要"
        fi
    fi
done

log ""
log "🚀 次のアクション:"
log "  npm run auto:haconiwa で自律指示配信可能"
log ""

# 完了通知
osascript -e 'display notification "🎯 全ウィンドウClaude Code設定統一完了！" with title "ArbitrageAssistant UNIFIED" sound name "Glass"' 2>/dev/null || true

log "🎯 Claude Code設定統一完了！全ウィンドウ使用可能"