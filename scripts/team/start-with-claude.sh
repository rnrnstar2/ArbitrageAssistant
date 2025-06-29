#!/bin/bash

# 🗄️ Team Terminal Management System with Claude Code Pre-Launch
# 参考: Claude-Code-Communication
# 改良点: Claude Code事前起動・役割認識自動化・指示実行確実化
# 構成: 5部門×4エージェント（director + worker1,2,3）= 20ペイン

SESSION_NAME="team"

# 既存セッションの確認と削除
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "既存のTeamセッションを終了しています..."
    tmux kill-session -t $SESSION_NAME
fi

# Teamセッション作成（tmux設定適用）
echo "🗄️ Team Management Terminal起動中..."
tmux new-session -d -s $SESSION_NAME -c "${PWD}"

# tmux設定ファイル適用
if [ -f "${PWD}/.tmux.conf" ]; then
    tmux source-file "${PWD}/.tmux.conf" 2>/dev/null || true
fi

# 各部門のウィンドウ作成
departments=("backend" "frontend" "integration" "core" "quality")

echo "🤖 Claude Code事前起動システム開始..."

for i in "${!departments[@]}"; do
    dept="${departments[$i]}"
    
    if [ $i -eq 0 ]; then
        # 最初の部門は既存ウィンドウを使用
        tmux rename-window -t $SESSION_NAME:0 "$dept"
    else
        # 新しいウィンドウを作成
        tmux new-window -t $SESSION_NAME -n "$dept"
    fi
    
    # 各ウィンドウで4ペイン（director + worker1,2,3）を作成
    window="$SESSION_NAME:$dept"
    
    # 完全な2x2グリッド構成でペイン作成
    # Step1: 最初に横分割（上下に分割）
    tmux split-window -t $window -v
    
    # Step2: 上のペインを縦分割（左上・右上）
    tmux split-window -t $window.0 -h
    
    # Step3: 下のペインを縦分割（左下・右下）  
    tmux split-window -t $window.2 -h
    
    # 各ペインの配置：
    # ペイン0=左上(Director), ペイン1=右上(Worker1)
    # ペイン2=左下(Worker2), ペイン3=右下(Worker3)
    
    # Claude Code事前起動ヘルパー関数
    setup_claude_pane() {
        local pane="$1"
        local agent_id="$2"
        local role="$3"
        local instructions_path="$4"
        
        echo "🚀 $agent_id Claude Code起動中..."
        
        # 環境変数設定
        tmux send-keys -t $pane "clear" C-m
        tmux send-keys -t $pane "export AGENT_ID=$agent_id" C-m
        tmux send-keys -t $pane "export DEPARTMENT=$dept" C-m
        tmux send-keys -t $pane "export ROLE=$role" C-m
        
        # agent-init.sh実行（バックグラウンド）
        tmux send-keys -t $pane "./scripts/utils/agent-init.sh > /dev/null 2>&1 &" C-m
        sleep 1
        
        # Claude Code起動（環境変数付き）
        tmux send-keys -t $pane "AGENT_ID='$agent_id' ROLE='$role' DEPARTMENT='$dept' claude --dangerously-skip-permissions" C-m
        
        # Claude Code起動待機
        sleep 5
        
        # 役割認識初期プロンプト送信
        local role_prompt=""
        case "$role" in
            "director")
                role_prompt="あなたは${agent_id}です。${dept}部門の統括責任者として、戦略立案・品質管理・Worker指導を行ってください。Presidentからの指示を受けて部門運営を行い、必要に応じてWorkerに指示を振り分けます。MVP準拠の高品質実装を監督してください。"
                ;;
            "worker")
                role_prompt="あなたは${agent_id}です。${dept}部門の専門実装担当として、高品質なコード実装・技術的課題解決を行ってください。Directorからの指示に従い、MVP準拠の完璧な実装を提供します。完了後は自動でDirectorに報告してください。"
                ;;
        esac
        
        tmux send-keys -t $pane "$role_prompt" C-m
        sleep 2
        
        # 準備完了メッセージ
        tmux send-keys -t $pane "エージェント準備完了: $agent_id ($role)" C-m
        sleep 1
        
        echo "✅ $agent_id Claude Code起動完了"
    }
    
    echo "📂 $dept部門 Claude Code起動中..."
    
    # Director ペイン（左上、ペイン0）- 部門統括・戦略立案
    setup_claude_pane "$window.0" "${dept}-director" "director" "instructions/directors/${dept}-director.md"
    
    # Worker1 ペイン（右上、ペイン1）- 専門実装
    setup_claude_pane "$window.1" "${dept}-worker1" "worker" "instructions/workers/${dept}-worker.md"
    
    # Worker2 ペイン（左下、ペイン2）- 専門実装
    setup_claude_pane "$window.2" "${dept}-worker2" "worker" "instructions/workers/${dept}-worker.md"
    
    # Worker3 ペイン（右下、ペイン3）- 専門実装
    setup_claude_pane "$window.3" "${dept}-worker3" "worker" "instructions/workers/${dept}-worker.md"
    
    echo "✅ $dept部門 Claude Code起動完了"
    echo ""
done

# Backendウィンドウに戻る
tmux select-window -t $SESSION_NAME:backend

echo ""
echo "🎉 Team Management Terminal + Claude Code事前起動完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 接続方法: npm run team:connect"
echo "💬 通信方法: ./agent-send-improved.sh [agent] \"[message]\""
echo ""
echo "🤖 Claude Code状態: 全20エージェント事前起動済み"
echo "🎯 機能: ultrathink品質自動付加・実行確実化"
echo ""
echo "🏗️ 部門構成:"
echo "   🔹 backend: AWS・GraphQL・認証"
echo "   🔹 frontend: Tauri・Next.js・UI"
echo "   🔹 integration: MT5・WebSocket・連携"
echo "   🔹 core: Position-Trail-Action核心"
echo "   🔹 quality: テスト・最適化・品質保証"
echo ""
echo "👥 各部門構成: director(戦略) + worker1,2,3(実装)"
echo "🚀 改良版システム準備完了"
echo ""
echo "💡 使用例:"
echo "   ./agent-send-improved.sh backend-director \"GraphQL基盤構築開始\""
echo "   ./agent-send-improved.sh status  # システム状況確認"
echo "   ./agent-send-improved.sh list    # エージェント一覧確認"