#!/bin/bash

# Haconiwa役割認識テストスクリプト

SESSION_NAME="arbitrage-assistant"

echo "🔍 Haconiwa役割認識テスト開始..."
echo ""

if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ セッション '$SESSION_NAME' が見つかりません"
    echo "まず 'npm run haconiwa:start' でセッションを開始してください"
    exit 1
fi

echo "📋 各ペインの役割確認中..."
echo ""

# 各ペインで環境変数をテスト
for window in 1 2 3 4 5 6; do
    for pane in 1 2 3; do
        echo "=== Window $window Pane $pane ==="
        
        # 環境変数確認コマンドを送信
        tmux send-keys -t $SESSION_NAME:$window.$pane "echo 'ROLE: '$HACONIWA_ROLE' | AGENT_ID: '$HACONIWA_AGENT_ID' | ROOM: '$HACONIWA_ROOM" Enter 2>/dev/null || true
        
        sleep 0.3
        
        # 最後の行を取得
        last_line=$(tmux capture-pane -t $SESSION_NAME:$window.$pane -p | tail -n 1)
        echo "$last_line"
        echo ""
    done
done

echo "✅ 役割認識テスト完了"
echo ""
echo "💡 使用方法："
echo "1. 各ペインで 'echo \$HACONIWA_ROLE' を実行して役割確認"
echo "2. Claude Codeで専門領域の質問をして動作確認"
echo "3. 例: Backend系エージェントには 'AWS Amplify Gen2について教えて' と質問"