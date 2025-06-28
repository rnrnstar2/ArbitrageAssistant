#!/bin/bash

# Haconiwa エージェント精度維持システム
# 全ペインで/clear実行 + 初期プロンプト入力

set -e

SESSION_NAME="arbitrage-assistant"

echo "🔄 Haconiwa エージェント全ペインリフレッシュ中..."

# セッション確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ Haconiwaセッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

# 全ペインでリフレッシュ実行
for window in 0 1 2 3 4 5; do
    for pane in 0 1 2; do
        local pane_id="$window.$pane"
        
        if tmux list-panes -t "$SESSION_NAME:$pane_id" >/dev/null 2>&1; then
            echo "🔄 Pane $pane_id リフレッシュ中..."
            
            # /clear でセッションクリア
            tmux send-keys -t "$SESSION_NAME:$pane_id" "/clear" Enter
            sleep 0.3
            
            # 初期プロンプト（役割確認 + ペイン内セットアップ）を入力
            tmux send-keys -t "$SESSION_NAME:$pane_id" "./scripts/pane-quick-setup.sh && echo '🔄 リフレッシュ完了。ペイン内作業環境復旧済み。'"
            
            sleep 0.1
        fi
    done
done

echo "✅ 全18ペインリフレッシュ完了"
echo "📋 各ペインで初期プロンプトが入力済み（Enterで実行）"