#!/bin/bash

# Pre-input Role Check Commands for All Panes
# 各ペインに役割確認コマンドを予め入力する機能

set -e

SESSION_NAME="arbitrage-assistant"

echo "🎭 各ペインに役割確認コマンドを予め入力中..."

# 全18ペインの定義
declare -a PANE_AGENTS=(
    "0.0|ceo-main"
    "0.1|director-coordinator" 
    "0.2|progress-monitor"
    "1.0|backend-director"
    "1.1|amplify-gen2-specialist"
    "1.2|cognito-auth-expert"
    "2.0|trading-flow-director"
    "2.1|entry-flow-specialist"
    "2.2|settlement-flow-specialist"
    "3.0|integration-director"
    "3.1|mt5-connector-specialist"
    "3.2|websocket-engineer"
    "4.0|frontend-director"
    "4.1|react-specialist"
    "4.2|desktop-app-engineer"
    "5.0|devops-director"
    "5.1|build-optimization-engineer"
    "5.2|quality-assurance-engineer"
)

# 役割確認コマンドの予め入力
for pane_def in "${PANE_AGENTS[@]}"; do
    IFS='|' read -r pane agent_id <<< "$pane_def"
    
    # ペイン存在確認
    if tmux list-panes -t "$SESSION_NAME:$pane" >/dev/null 2>&1; then
        echo "🎯 Pane $pane ($agent_id): 役割確認コマンド予め入力中..."
        
        # 役割確認コマンドを予め入力（Enterは押さない）
        tmux send-keys -t "$SESSION_NAME:$pane" "./scripts/role && echo '🎯 役割確認完了 - 指示をお待ちしています...'"
        
        echo "✅ Pane $pane: 予め入力完了"
    else
        echo "❌ Pane $pane: ペインが見つかりません"
    fi
    
    sleep 0.1
done

echo ""
echo "✅ 全ペインに役割確認コマンド予め入力完了！"
echo ""
echo "📋 使用方法："
echo "1. 各ペインには役割確認コマンドが予め入力済み"
echo "2. 指示を出すときは、既存の入力の下に追加される"
echo "3. 実行時は 役割確認 → 指示実行 の順序で自動実行される"
echo "4. 例: CEOが指示を出すとき："
echo "   tmux send-keys -t arbitrage-assistant:1.0 ' && echo \"CEO指示: Backend実装を開始してください\" ultrathink' Enter"
echo ""
echo "🎭 役割認識システムが自動化されました！"