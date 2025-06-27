#!/bin/bash

# Auto Initialize Claude in Haconiwa Panes
# 各ペインのClaude Codeに自動で初期化コマンドを送信

set -e

echo "🚀 Haconiwa Claude Auto-Initialization"
echo "======================================"

# 全ペインリスト（6x3 Grid構成）
PANES=(
    "ceo-main"
    "director-coordinator" 
    "progress-monitor"
    "backend-director"
    "amplify-gen2-specialist"
    "cognito-auth-expert"
    "trading-flow-director"
    "entry-flow-specialist"
    "settlement-flow-specialist"
    "integration-director"
    "mt5-connector-specialist"
    "websocket-engineer"
    "frontend-director"
    "react-specialist"
    "desktop-app-engineer"
    "devops-director"
    "build-optimization-engineer"
    "quality-assurance-engineer"
)

# 初期化コマンド
INIT_COMMAND="./scripts/role && echo '' && echo '🎯 専門領域集中モード開始' && echo '上記の役割詳細を確認し、MVPシステム設計.mdの該当セクションをチェックして作業を開始してください。' ultrathink"

echo "各ペインに初期化コマンドを送信中..."

for pane in "${PANES[@]}"; do
    echo "📡 $pane に初期化コマンド送信"
    
    # ペインが存在するかチェック
    if tmux list-panes -t "$pane" &>/dev/null; then
        # 入力バッファクリア → 初期化コマンド送信
        tmux send-keys -t "$pane" C-c C-u clear Enter
        sleep 0.5
        tmux send-keys -t "$pane" "$INIT_COMMAND" Enter
    else
        echo "⚠️  $pane ペインが見つかりません"
    fi
    
    sleep 0.2
done

echo ""
echo "✅ 全ペインの初期化コマンド送信完了"
echo "各Claude Codeが役割確認と作業開始準備を実行中..."
echo ""
echo "📋 次のステップ:"
echo "1. 各ペインでClaude Codeの応答を確認"
echo "2. CEOメインペインでscripts/ceo-main-directive.mdを実行"
echo "3. 各Directorペインで配下への指示出しを確認"
echo "4. 全体の作業進捗を監視"