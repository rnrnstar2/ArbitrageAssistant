#!/bin/bash

# 完全統合Haconiwaワークスペース起動スクリプト
# Step 1: 環境構築 + Step 2: Claude Code起動 + Step 3: tmux接続

set -e

echo "🚀 ArbitrageAssistant Haconiwa Complete Startup"

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

log ""
log "🎯 3ステップ完全自動実行："
log "  Step 1: Haconiwa環境構築 + tmuxセッション作成"
log "  Step 2: Claude Code全ウィンドウ起動 + CEO指示送信"
log "  Step 3: tmuxセッション自動接続"
log ""

# Step 1: Haconiwa環境構築
log "📋 Step 1: Haconiwa環境構築実行中..."
if ! ./scripts/setup-haconiwa-environment.sh; then
    error "Step 1 失敗: Haconiwa環境構築エラー"
    exit 1
fi

log "✅ Step 1完了: Haconiwa環境構築成功"
sleep 1

# Step 2: Claude Code全起動
log "🤖 Step 2: Claude Code全起動実行中..."
if ! ./scripts/start-claude-all-windows.sh; then
    error "Step 2 失敗: Claude Code起動エラー"
    exit 1
fi

log "✅ Step 2完了: Claude Code全起動成功"
sleep 1

# Step 3: tmuxセッション自動接続
log "🖥️  Step 3: tmuxセッション自動接続中..."

# tmuxセッション存在確認
if ! tmux has-session -t arbitrage-assistant 2>/dev/null; then
    error "tmuxセッション 'arbitrage-assistant' が見つかりません"
    exit 1
fi

log "✅ Step 3準備完了: tmuxセッション接続開始"
log ""
log "🎉 Haconiwa Complete Startup成功！"
log ""
log "📊 起動完了内容:"
log "  ✅ Haconiwa組織構造: CEO + 5部門"
log "  ✅ tmuxマルチウィンドウ: 6ウィンドウ環境"
log "  ✅ Claude Code全起動: 指示待機状態"
log "  ✅ CEO階層指示システム: 準備完了"
log ""
log "🚀 tmuxセッション自動接続中..."
log "📱 操作方法:"
log "  Ctrl+B → 1,2,3,4,5,6  # ウィンドウ移動（1:CEO, 2:Backend, 3:Trading, 4:Integration, 5:Frontend, 6:DevOps）"
log "  Ctrl+B → d            # セッションデタッチ（バックグラウンド実行）"
log ""

# 完了通知
osascript -e 'display notification "🚀 Haconiwa Complete Startup完了！CEO指示待機状態" with title "ArbitrageAssistant" sound name "Glass"' 2>/dev/null || true

# CEO Executive Officeに移動
log "🎯 CEO Executive Officeに移動中..."
# tmuxセッション自動接続（CEO Executive Officeウィンドウに移動）
tmux attach-session -t arbitrage-assistant:1