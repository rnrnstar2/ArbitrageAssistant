#!/bin/bash

# 🗄️ Team Terminal Management System
# 参考: Claude-Code-Communication
# 構成: 5部門×4エージェント（director + worker1,2,3）= 20ペイン
# 機能: Team管理専用ターミナル + Claude Code対応

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
    
    # 部門名を大文字に変換（互換性重視）
    case "$dept" in
        "backend") dept_upper="Backend" ;;
        "frontend") dept_upper="Frontend" ;;
        "integration") dept_upper="Integration" ;;
        "core") dept_upper="Core" ;;
        "quality") dept_upper="Quality" ;;
        *) dept_upper="$dept" ;;
    esac
    
    # 完全な2x2グリッド構成でペイン作成
    # 方法: 横分割→上下それぞれを縦分割
    
    # Step1: 最初に横分割（上下に分割）
    tmux split-window -t $window -v
    
    # Step2: 上のペインを縦分割（左上・右上）
    tmux split-window -t $window.0 -h
    
    # Step3: 下のペインを縦分割（左下・右下）  
    tmux split-window -t $window.2 -h
    
    # 各ペインの配置：
    # ペイン0=左上(Director), ペイン1=右上(Worker1)
    # ペイン2=左下(Worker2), ペイン3=右下(Worker3)
    
    # Director ペイン（左上、ペイン0）- 部門統括・戦略立案
    tmux send-keys -t $window.0 "clear" C-m
    tmux send-keys -t $window.0 "export AGENT_ID=${dept}-director" C-m
    tmux send-keys -t $window.0 "export DEPARTMENT=${dept}" C-m
    tmux send-keys -t $window.0 "export ROLE=director" C-m
    tmux send-keys -t $window.0 "./scripts/utils/agent-init.sh" C-m
    
    # Worker1 ペイン（右上、ペイン1）- 専門実装
    tmux send-keys -t $window.1 "clear" C-m
    tmux send-keys -t $window.1 "export AGENT_ID=${dept}-worker1" C-m
    tmux send-keys -t $window.1 "export DEPARTMENT=${dept}" C-m
    tmux send-keys -t $window.1 "export ROLE=worker" C-m
    tmux send-keys -t $window.1 "./scripts/utils/agent-init.sh" C-m
    
    # Worker2 ペイン（左下、ペイン2）- 専門実装
    tmux send-keys -t $window.2 "clear" C-m
    tmux send-keys -t $window.2 "export AGENT_ID=${dept}-worker2" C-m
    tmux send-keys -t $window.2 "export DEPARTMENT=${dept}" C-m
    tmux send-keys -t $window.2 "export ROLE=worker" C-m
    tmux send-keys -t $window.2 "./scripts/utils/agent-init.sh" C-m
    
    # Worker3 ペイン（右下、ペイン3）- 専門実装
    tmux send-keys -t $window.3 "clear" C-m
    tmux send-keys -t $window.3 "export AGENT_ID=${dept}-worker3" C-m
    tmux send-keys -t $window.3 "export DEPARTMENT=${dept}" C-m
    tmux send-keys -t $window.3 "export ROLE=worker" C-m
    tmux send-keys -t $window.3 "./scripts/utils/agent-init.sh" C-m
done

# Backendウィンドウに戻る
tmux select-window -t $SESSION_NAME:backend

echo ""
echo "✅ Team Management Terminal起動完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 接続方法: npm run team:connect"
echo "🏗️ 部門構成:"
echo "   🔹 backend: AWS・GraphQL・認証"
echo "   🔹 frontend: Tauri・Next.js・UI"
echo "   🔹 integration: MT5・WebSocket・連携"
echo "   🔹 core: Position-Trail-Action核心"
echo "   🔹 quality: テスト・最適化・品質保証"
echo ""
echo "👥 各部門構成: director(戦略) + worker1,2,3(実装)"
echo "💬 通信方法: ./agent-send.sh [agent] \"[message]\""
echo "🎯 Team Terminal管理準備完了"