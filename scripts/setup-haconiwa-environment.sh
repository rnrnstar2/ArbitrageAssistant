#!/bin/bash

# Haconiwa環境構築スクリプト（Step 1）
# tmux環境とHaconiwa組織構造の構築のみ

set -e

echo "🏗️  ArbitrageAssistant Haconiwa環境構築（Step 1/2）"

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

# Haconiwaパス設定
HACONIWA_PATH="/Users/rnrnstar/Library/Python/3.9/bin/haconiwa"

# 既存セッション確認・保護
if tmux has-session -t arbitrage-assistant 2>/dev/null; then
    log "✅ 既存のtmuxセッション 'arbitrage-assistant' を発見"
    log "🛡️ Claude Codeセッション保護のため、既存セッションを維持します"
    
    # ウィンドウ数確認
    window_count=$(tmux list-windows -t arbitrage-assistant | wc -l)
    if [ "$window_count" -ge 6 ]; then
        log "✅ 既存セッションに十分なウィンドウ($window_count個)が存在"
        log "🚀 既存セッション再利用でHaconiwa環境準備完了"
        
        # 既存セッションをそのまま利用して終了
        log "📊 既存ウィンドウ:"
        tmux list-windows -t arbitrage-assistant | while read line; do
            log "  $line"
        done
        
        log ""
        log "🎉 Haconiwa環境構築完了（既存セッション保護）"
        log "✅ Claude Codeセッション: 完全保護済み"
        log "🚀 次のステップ: npm run start:claude または haconiwa自律実行"
        exit 0
    else
        warn "⚠️ 既存セッションのウィンドウ数不足($window_count個)"
        warn "必要なウィンドウを追加作成します..."
    fi
fi

# Step 1: Haconiwa環境構築
log "📋 Haconiwa環境構築中..."
if [ -f "arbitrage-assistant-optimal.yaml" ]; then
    $HACONIWA_PATH apply -f arbitrage-assistant-optimal.yaml
    log "✅ Haconiwa環境構築完了"
elif [ -f "arbitrage-assistant.yaml" ]; then
    $HACONIWA_PATH apply -f arbitrage-assistant.yaml
    log "✅ Haconiwa環境構築完了（arbitrage-assistant.yaml使用）"
else
    error "YAML設定ファイルが見つかりません"
    error "arbitrage-assistant-optimal.yaml または arbitrage-assistant.yaml が必要です"
    exit 1
fi

# Step 2: tmuxセッション確認
log "🖥️  tmuxセッション確認中..."
sleep 1

if tmux has-session -t arbitrage-assistant 2>/dev/null; then
    log "✅ tmuxセッション 'arbitrage-assistant' 作成完了"
    
    # Haconiwaウィンドウ作成失敗の回避処理
    window_count=$(tmux list-windows -t arbitrage-assistant | wc -l)
    if [ "$window_count" -lt 6 ]; then
        log "🔧 ウィンドウ数不足を検出（$window_count個）、手動でウィンドウ作成中..."
        
        # 既存の不要ウィンドウを削除
        tmux list-windows -t arbitrage-assistant | grep -E "^[0-9]+: zsh" | while read line; do
            window_id=$(echo "$line" | cut -d: -f1)
            tmux kill-window -t arbitrage-assistant:$window_id 2>/dev/null || true
        done
        
        # 必要なウィンドウを手動作成
        tmux new-window -t arbitrage-assistant -n "🏛️ CEO Executive Office" -c "$PWD"
        tmux new-window -t arbitrage-assistant -n "🗄️ Backend Architecture" -c "$PWD"
        tmux new-window -t arbitrage-assistant -n "⚡ Trading Systems" -c "$PWD"
        tmux new-window -t arbitrage-assistant -n "🔌 Integration Systems" -c "$PWD"
        tmux new-window -t arbitrage-assistant -n "🎨 Frontend Experience" -c "$PWD"
        tmux new-window -t arbitrage-assistant -n "🚀 DevOps & QA" -c "$PWD"
        
        # CEO Officeをアクティブに
        tmux select-window -t arbitrage-assistant:1
        
        log "✅ ウィンドウ手動作成完了"
    fi
    
    # ウィンドウ一覧表示
    log "📊 作成されたtmuxウィンドウ:"
    tmux list-windows -t arbitrage-assistant | while read line; do
        log "  $line"
    done
    
    # tmux設定読み込み（マウス操作有効化）
    log "🖱️  tmux設定読み込み中..."
    if [ -f ".tmux.conf" ]; then
        tmux source-file .tmux.conf
        log "✅ tmux設定読み込み完了（マウス操作有効）"
    else
        # .tmux.confが存在しない場合は直接設定
        tmux set-option -g mouse on
        log "✅ マウス操作有効化完了"
    fi
else
    warn "HaconiwaでのSpace作成がスキップされました。手動でtmuxセッション作成中..."
    
    # tmuxセッション手動作成
    log "🔧 tmuxセッション 'arbitrage-assistant' を手動作成中..."
    tmux new-session -d -s arbitrage-assistant -c "$PWD"
    
    # 必要なウィンドウを手動作成
    log "🔧 6つのウィンドウを手動作成中..."
    tmux new-window -t arbitrage-assistant -n "🏛️ CEO Executive Office" -c "$PWD"
    tmux new-window -t arbitrage-assistant -n "🗄️ Backend Architecture" -c "$PWD"
    tmux new-window -t arbitrage-assistant -n "⚡ Trading Systems" -c "$PWD"
    tmux new-window -t arbitrage-assistant -n "🔌 Integration Systems" -c "$PWD"
    tmux new-window -t arbitrage-assistant -n "🎨 Frontend Experience" -c "$PWD"
    tmux new-window -t arbitrage-assistant -n "🚀 DevOps & QA" -c "$PWD"
    
    # 初期ウィンドウ削除
    tmux kill-window -t arbitrage-assistant:0 2>/dev/null || true
    
    # CEO Officeをアクティブに
    tmux select-window -t arbitrage-assistant:1
    
    log "✅ tmuxセッション手動作成完了"
    
    # ウィンドウ一覧表示
    log "📊 作成されたtmuxウィンドウ:"
    tmux list-windows -t arbitrage-assistant | while read line; do
        log "  $line"
    done
    
    # tmux設定読み込み（マウス操作有効化）
    log "🖱️  tmux設定読み込み中..."
    if [ -f ".tmux.conf" ]; then
        tmux source-file .tmux.conf
        log "✅ tmux設定読み込み完了（マウス操作有効）"
    else
        # .tmux.confが存在しない場合は直接設定
        tmux set-option -g mouse on
        log "✅ マウス操作有効化完了"
    fi
fi

log ""
log "🎉 Haconiwa環境構築完了（Step 1/2）"
log ""
log "📊 構築内容:"
log "  ✅ Haconiwa組織構造: CEO + 5部門"
log "  ✅ tmuxマルチウィンドウ環境: 6-7ウィンドウ"
log "  ✅ 階層的組織定義: Directors + Engineers"
log "  ✅ MVP方針設定: 全役職に浸透済み"
log ""
log "🚀 次のステップ:"
log "  npm run start:claude で全ウィンドウにClaude Code起動"
log ""
log "📱 tmux操作:"
log "  tmux list-sessions    # セッション確認"
log "  tmux attach-session -t arbitrage-assistant:1  # CEO画面接続"
log "  Ctrl+B → 1,2,3,4,5,6  # ウィンドウ移動"
log ""