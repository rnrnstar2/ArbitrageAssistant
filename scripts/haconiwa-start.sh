#!/bin/bash

# Haconiwa (箱庭) 6x3 Grid Multi-Agent Development Environment
# ArbitrageAssistant専用Claude Code開発環境 - 18エージェント構成

set -e

SESSION_NAME="arbitrage-assistant"
BASE_DIR="/Users/rnrnstar/github/ArbitrageAssistant"

echo "🚀 Haconiwa (箱庭) 6x3 Grid マルチエージェント開発環境起動中..."

# ==========================================
# CEO指示出しヘルパー関数群
# ==========================================

# 標準役割確認プロンプト生成
generate_role_prompt() {
    local agent_id="$1"
    cat <<EOF
echo "HACONIWA_AGENT_ID: \$HACONIWA_AGENT_ID" && cat arbitrage-assistant.yaml | grep -A 10 "$agent_id" && echo "=== 役割確認完了 ===" && echo "次に MVPシステム設計.md を確認してください" ultrathink
EOF
}

# CEO→Directors指示出しプロンプト生成
generate_ceo_to_directors_prompt() {
    cat <<EOF
echo "HACONIWA_AGENT_ID: \$HACONIWA_AGENT_ID" && cat arbitrage-assistant.yaml | grep -A 5 "ceo-main" && echo "=== CEO Main 役割確認完了 ===" && cat "MVPシステム設計.md" | head -50 && echo "=== MVP設計確認完了 ===" && echo "各Directors（backend-director, trading-flow-director, integration-director, frontend-director, devops-director）に該当するMVPタスクを指示してください。director-coordinatorとprogress-monitorにも進捗管理を依頼してください。" ultrathink
EOF
}

# Directors→specialists指示出しプロンプト生成
generate_director_to_specialists_prompt() {
    local director_id="$1"
    local room_name="$2"
    cat <<EOF
echo "HACONIWA_AGENT_ID: \$HACONIWA_AGENT_ID" && cat arbitrage-assistant.yaml | grep -A 10 "$director_id" && echo "=== $director_id 役割確認完了 ===" && cat "MVPシステム設計.md" | grep -A 20 "$room_name" && echo "=== 担当領域確認完了 ===" && echo "担当specializtsに具体的なMVPタスクを指示してください。" ultrathink
EOF
}

# tmux指示送信関数
send_instruction_to_pane() {
    local target_pane="$1"
    local instruction="$2"
    echo "📨 Pane $target_pane に指示送信中..."
    
    # pane存在確認
    if tmux list-panes -t "$SESSION_NAME:$target_pane" >/dev/null 2>&1; then
        tmux send-keys -t "$SESSION_NAME:$target_pane" "$instruction" Enter
        echo "✅ 指示送信完了: $target_pane"
    else
        echo "❌ エラー: Pane $target_pane が見つかりません"
        echo "📋 利用可能なpane一覧:"
        tmux list-panes -t "$SESSION_NAME" -a -F "  #{window_index}.#{pane_index}"
        return 1
    fi
}

# CEO→全Directors指示出し関数
ceo_instruct_all_directors() {
    echo "🏛️ CEO→全Directors指示出し開始"
    
    # Director Coordinator(0.2)への指示
    send_instruction_to_pane "0.2" "$(generate_director_to_specialists_prompt "director-coordinator" "Directors間連携調整")"
    
    # Progress Monitor(0.3)への指示  
    send_instruction_to_pane "0.3" "$(generate_director_to_specialists_prompt "progress-monitor" "MVPプロジェクト進捗管理")"
    
    # Backend Director(1.1)への指示
    send_instruction_to_pane "1.1" "$(generate_director_to_specialists_prompt "backend-director" "Backend")"
    
    # Trading Flow Director(2.1)への指示
    send_instruction_to_pane "2.1" "$(generate_director_to_specialists_prompt "trading-flow-director" "Trading")"
    
    # Integration Director(3.1)への指示
    send_instruction_to_pane "3.1" "$(generate_director_to_specialists_prompt "integration-director" "Integration")"
    
    # Frontend Director(4.1)への指示
    send_instruction_to_pane "4.1" "$(generate_director_to_specialists_prompt "frontend-director" "Frontend")"
    
    # DevOps Director(5.1)への指示
    send_instruction_to_pane "5.1" "$(generate_director_to_specialists_prompt "devops-director" "DevOps")"
}

# MVP特化タスク割り当て関数
assign_mvp_tasks() {
    echo "🎯 MVP特化タスク割り当て開始"
    
    # Backend specialists
    send_instruction_to_pane "1.2" "cat arbitrage-assistant.yaml | grep -A 20 'mvp-graphql-backend' && echo '=== タスク: AWS Amplify Gen2 + DynamoDB実装 ===' && echo 'packages/shared-backend/amplify/data/resource.ts実装を開始してください' ultrathink"
    
    send_instruction_to_pane "1.3" "cat arbitrage-assistant.yaml | grep -A 10 'cognito-auth-expert' && echo '=== タスク: Amazon Cognito認証統合 ===' && echo 'Cognito認証フロー実装を開始してください' ultrathink"
    
    # Trading specialists
    send_instruction_to_pane "2.2" "cat arbitrage-assistant.yaml | grep -A 20 'mvp-arbitrage-engine' && echo '=== タスク: Entry→Trail→Action実装 ===' && echo 'apps/hedge-system/lib/position-execution.ts実装を開始してください' ultrathink"
    
    send_instruction_to_pane "2.3" "cat arbitrage-assistant.yaml | grep -A 10 'settlement-flow-specialist' && echo '=== タスク: 決済・ロスカット処理実装 ===' && echo 'Trail判定アルゴリズム実装を開始してください' ultrathink"
    
    # Integration specialists
    send_instruction_to_pane "3.2" "cat arbitrage-assistant.yaml | grep -A 20 'mvp-mt5-integration' && echo '=== タスク: MQL5 + C++ WebSocket実装 ===' && echo 'ea/HedgeSystemConnector.mq5実装を開始してください' ultrathink"
    
    send_instruction_to_pane "3.3" "cat arbitrage-assistant.yaml | grep -A 10 'websocket-engineer' && echo '=== タスク: WebSocket DLL実装 ===' && echo 'ea/websocket-dll/HedgeSystemWebSocket.cpp実装を開始してください' ultrathink"
    
    # Frontend specialists
    send_instruction_to_pane "4.2" "cat arbitrage-assistant.yaml | grep -A 20 'mvp-admin-dashboard' && echo '=== タスク: Next.js + React + Tailwind CSS実装 ===' && echo 'apps/admin/app/dashboard/page.tsx実装を開始してください' ultrathink"
    
    send_instruction_to_pane "4.3" "cat arbitrage-assistant.yaml | grep -A 10 'desktop-app-engineer' && echo '=== タスク: Tauri v2デスクトップアプリ ===' && echo 'apps/hedge-system/Tauri実装を開始してください' ultrathink"
    
    # DevOps specialists
    send_instruction_to_pane "5.2" "cat arbitrage-assistant.yaml | grep -A 20 'mvp-build-optimization' && echo '=== タスク: Turborepo最適化 ===' && echo 'turbo.json最適化設定を開始してください' ultrathink"
    
    send_instruction_to_pane "5.3" "cat arbitrage-assistant.yaml | grep -A 10 'quality-assurance-engineer' && echo '=== タスク: コード品質管理 ===' && echo 'Vitest + React Testing Library実装を開始してください' ultrathink"
}

# 既存セッションの安全な処理
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "🔄 既存セッションを安全にクリーンアップ中..."
    
    # 各ペインでClaudeを正常終了
    for pane in $(tmux list-panes -t $SESSION_NAME -a -F "#{window_index}.#{pane_index}" 2>/dev/null || true); do
        echo "  Pane $pane: Claude Code正常終了中..."
        tmux send-keys -t $SESSION_NAME:$pane C-c 2>/dev/null || true
        sleep 0.1
    done
    
    # 設定保存のための待機
    echo "⏳ Claude Code設定保存のため3秒待機..."
    sleep 3
    
    # セッション削除
    tmux kill-session -t $SESSION_NAME
    
    # クリーンアップ後の短い待機
    sleep 1
fi

# 新規セッション作成（デタッチド状態）
echo "🏗️ 新規tmuxセッション作成中..."
tmux new-session -d -s $SESSION_NAME -c "$BASE_DIR"

# base-index設定の強制適用とウィンドウ再作成
echo "🔧 base-index 0設定適用中..."
tmux set-option -t $SESSION_NAME base-index 0
tmux set-window-option -t $SESSION_NAME pane-base-index 0

# 既存ウィンドウ（1番）を削除し、0番ウィンドウを新規作成
tmux new-window -t $SESSION_NAME:0 -c "$BASE_DIR" -n "🏛️CEO-Strategy"
tmux kill-window -t $SESSION_NAME:1

# 新規セッション安定化のための待機
sleep 1

# ===========================================
# Window 0: 🏛️ CEO Executive Office (3 panes)
# ===========================================

# Pane 0.1: CEO Main (最初のペイン - 実際の番号に合わせ)
tmux send-keys -t $SESSION_NAME:0.1 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:0.1 "export HACONIWA_AGENT_ID='ceo-main'" Enter
tmux send-keys -t $SESSION_NAME:0.1 "echo '=== CEO Main (ceo-main) ===' && echo 'MVP全体戦略の意思決定・5 Directors指示' && echo 'Next: Check HACONIWA_AGENT_ID, read arbitrage-assistant.yaml, analyze project status'" Enter
tmux send-keys -t $SESSION_NAME:0.1 "claude --dangerously-skip-permissions" Enter

# Pane 0.2: Director Coordinator (右に分割)
tmux split-window -t $SESSION_NAME:0.1 -h
sleep 1
tmux send-keys -t $SESSION_NAME:0.2 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:0.2 "export HACONIWA_AGENT_ID='director-coordinator'" Enter
tmux send-keys -t $SESSION_NAME:0.2 "echo '=== Director Coordinator (director-coordinator) ===' && echo '5 Directors間連携調整・クロスチーム課題解決'" Enter
tmux send-keys -t $SESSION_NAME:0.2 "claude --dangerously-skip-permissions" Enter

# Pane 0.3: Progress Monitor (左ペインを上下に分割)
tmux select-pane -t $SESSION_NAME:0.1
tmux split-window -t $SESSION_NAME:0.1 -v
sleep 2
tmux send-keys -t $SESSION_NAME:0.3 "cd $BASE_DIR" Enter
sleep 1
tmux send-keys -t $SESSION_NAME:0.3 "export HACONIWA_AGENT_ID='progress-monitor'" Enter
tmux send-keys -t $SESSION_NAME:0.3 "echo '=== Progress Monitor (progress-monitor) ===' && echo 'MVPプロジェクト進捗管理・Directors間調整・リリース準備確認'" Enter
sleep 1
tmux send-keys -t $SESSION_NAME:0.3 "claude --dangerously-skip-permissions" Enter

# ===========================================
# Window 1: 🗄️ Backend Architecture (3 panes)
# ===========================================
tmux new-window -t $SESSION_NAME -n "🗄️Backend-AWS" -c "$BASE_DIR/packages/shared-backend"

# Pane 1.1: Backend Director
tmux send-keys -t $SESSION_NAME:1.1 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:1.1 "export HACONIWA_AGENT_ID='backend-director'" Enter
tmux send-keys -t $SESSION_NAME:1.1 "echo '=== Backend Director (backend-director) ===' && echo 'AWS Amplify Gen2 + GraphQL + userIdベース最適化専門'" Enter
tmux send-keys -t $SESSION_NAME:1.1 "echo 'mvp-graphql-backend: User/Account/Position/Actionモデル基本CRUD実装'" Enter
tmux send-keys -t $SESSION_NAME:1.1 "claude --dangerously-skip-permissions" Enter

# Pane 1.2: Amplify Gen2 Specialist
tmux split-window -t $SESSION_NAME:1.1 -h
sleep 2
tmux send-keys -t $SESSION_NAME:1.2 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:1.2 "export HACONIWA_AGENT_ID='amplify-gen2-specialist'" Enter
tmux send-keys -t $SESSION_NAME:1.2 "echo '=== Amplify Gen2 Specialist (amplify-gen2-specialist) ==='" Enter
tmux send-keys -t $SESSION_NAME:1.2 "echo 'AWS Amplify Gen2 data/resource.ts設計・User/Account/Position/Action CRUD実装'" Enter
tmux send-keys -t $SESSION_NAME:1.2 "claude --dangerously-skip-permissions" Enter

# Pane 1.3: Cognito Authentication Expert
tmux split-window -t $SESSION_NAME:1.1 -v
sleep 2
tmux send-keys -t $SESSION_NAME:1.3 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:1.3 "export HACONIWA_AGENT_ID='cognito-auth-expert'" Enter
tmux send-keys -t $SESSION_NAME:1.3 "echo '=== Cognito Authentication Expert (cognito-auth-expert) ==='" Enter
tmux send-keys -t $SESSION_NAME:1.3 "echo 'Amazon Cognito認証システム統合・JWT トークン管理'" Enter
tmux send-keys -t $SESSION_NAME:1.3 "claude --dangerously-skip-permissions" Enter

# ===========================================
# Window 2: ⚡ Trading Systems (3 panes)
# ===========================================
tmux new-window -t $SESSION_NAME -n "⚡Trading-Engine" -c "$BASE_DIR/apps/hedge-system"

# Pane 2.0: Trading Flow Director
tmux send-keys -t $SESSION_NAME:2.1 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:2.1 "export HACONIWA_AGENT_ID='trading-flow-director'" Enter
tmux send-keys -t $SESSION_NAME:2.1 "echo '=== Trading Flow Director (trading-flow-director) ==='" Enter
tmux send-keys -t $SESSION_NAME:2.1 "echo 'コア実行フロー戦略・Position-Trail-Actionフロー管理'" Enter
tmux send-keys -t $SESSION_NAME:2.1 "claude --dangerously-skip-permissions" Enter

# Pane 2.1: Entry Flow Specialist
tmux split-window -t $SESSION_NAME:2.1 -h
sleep 2
tmux send-keys -t $SESSION_NAME:2.1 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:2.1 "export HACONIWA_AGENT_ID='entry-flow-specialist'" Enter
tmux send-keys -t $SESSION_NAME:2.1 "echo '=== Entry Flow Specialist (entry-flow-specialist) ==='" Enter
tmux send-keys -t $SESSION_NAME:2.1 "echo 'エントリーポジション作成→トレイル実行→アクション実行'" Enter
tmux send-keys -t $SESSION_NAME:2.1 "claude --dangerously-skip-permissions" Enter

# Pane 2.2: Settlement Flow Specialist
tmux split-window -t $SESSION_NAME:2.1 -v
sleep 2
tmux send-keys -t $SESSION_NAME:2.2 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:2.2 "export HACONIWA_AGENT_ID='settlement-flow-specialist'" Enter
tmux send-keys -t $SESSION_NAME:2.2 "echo '=== Settlement Flow Specialist (settlement-flow-specialist) ==='" Enter
tmux send-keys -t $SESSION_NAME:2.2 "echo 'ポジション選択→ロスカット時トレール実行→アクション実行'" Enter
tmux send-keys -t $SESSION_NAME:2.2 "claude --dangerously-skip-permissions" Enter

# ===========================================
# Window 3: 🔌 Integration Systems (3 panes)
# ===========================================
tmux new-window -t $SESSION_NAME -n "🔌Integration-MT5" -c "$BASE_DIR/ea"

# Pane 3.0: Integration Director
tmux send-keys -t $SESSION_NAME:3.1 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:3.1 "export HACONIWA_AGENT_ID='integration-director'" Enter
tmux send-keys -t $SESSION_NAME:3.1 "echo '=== Integration Director (integration-director) ==='" Enter
tmux send-keys -t $SESSION_NAME:3.1 "echo 'MT4/MT5統合戦略・外部API連携アーキテクチャ設計'" Enter
tmux send-keys -t $SESSION_NAME:3.1 "claude --dangerously-skip-permissions" Enter

# Pane 3.1: MT5 Connector Specialist
tmux split-window -t $SESSION_NAME:3.1 -h
sleep 2
tmux send-keys -t $SESSION_NAME:3.1 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:3.1 "export HACONIWA_AGENT_ID='mt5-connector-specialist'" Enter
tmux send-keys -t $SESSION_NAME:3.1 "echo '=== MT5 Connector Specialist (mt5-connector-specialist) ==='" Enter
tmux send-keys -t $SESSION_NAME:3.1 "echo 'MT4/MT5 EA開発・MQL5プログラミング・取引所連携'" Enter
tmux send-keys -t $SESSION_NAME:3.1 "claude --dangerously-skip-permissions" Enter

# Pane 3.2: WebSocket Engineer
tmux split-window -t $SESSION_NAME:3.1 -v
sleep 2
tmux send-keys -t $SESSION_NAME:3.2 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:3.2 "export HACONIWA_AGENT_ID='websocket-engineer'" Enter
tmux send-keys -t $SESSION_NAME:3.2 "echo '=== WebSocket Engineer (websocket-engineer) ==='" Enter
tmux send-keys -t $SESSION_NAME:3.2 "echo 'WebSocket DLL実装・C++/Rustプロトコル実装'" Enter
tmux send-keys -t $SESSION_NAME:3.2 "claude --dangerously-skip-permissions" Enter

# ===========================================
# Window 4: 🎨 Frontend Experience (3 panes)
# ===========================================
tmux new-window -t $SESSION_NAME -n "🎨Frontend-UI" -c "$BASE_DIR/apps/admin"

# Pane 4.0: Frontend Director
tmux send-keys -t $SESSION_NAME:4.1 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:4.1 "export HACONIWA_AGENT_ID='frontend-director'" Enter
tmux send-keys -t $SESSION_NAME:4.1 "echo '=== Frontend Director (frontend-director) ==='" Enter
tmux send-keys -t $SESSION_NAME:4.1 "echo '管理画面・デスクトップUI・ユーザー体験専門'" Enter
tmux send-keys -t $SESSION_NAME:4.1 "claude --dangerously-skip-permissions" Enter

# Pane 4.1: React Specialist
tmux split-window -t $SESSION_NAME:4.1 -h
sleep 2
tmux send-keys -t $SESSION_NAME:4.1 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:4.1 "export HACONIWA_AGENT_ID='react-specialist'" Enter
tmux send-keys -t $SESSION_NAME:4.1 "echo '=== React Specialist (react-specialist) ==='" Enter
tmux send-keys -t $SESSION_NAME:4.1 "echo 'React/Next.js開発・状態管理・UI実装'" Enter
tmux send-keys -t $SESSION_NAME:4.1 "claude --dangerously-skip-permissions" Enter

# Pane 4.2: Desktop App Engineer
tmux split-window -t $SESSION_NAME:4.1 -v
sleep 2
tmux send-keys -t $SESSION_NAME:4.2 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:4.2 "export HACONIWA_AGENT_ID='desktop-app-engineer'" Enter
tmux send-keys -t $SESSION_NAME:4.2 "echo '=== Desktop App Engineer (desktop-app-engineer) ==='" Enter
tmux send-keys -t $SESSION_NAME:4.2 "echo 'Tauri v2デスクトップアプリ開発・Rust統合'" Enter
tmux send-keys -t $SESSION_NAME:4.2 "claude --dangerously-skip-permissions" Enter

# ===========================================
# Window 5: 🚀 DevOps & QA (3 panes)
# ===========================================
tmux new-window -t $SESSION_NAME -n "🚀DevOps-CI" -c "$BASE_DIR"

# Pane 5.0: DevOps Director
tmux send-keys -t $SESSION_NAME:5.1 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:5.1 "export HACONIWA_AGENT_ID='devops-director'" Enter
tmux send-keys -t $SESSION_NAME:5.1 "echo '=== DevOps Director (devops-director) ==='" Enter
tmux send-keys -t $SESSION_NAME:5.1 "echo 'インフラ最適化・品質保証・CI/CD・監視専門'" Enter
tmux send-keys -t $SESSION_NAME:5.1 "claude --dangerously-skip-permissions" Enter

# Pane 5.1: Build Optimization Engineer
tmux split-window -t $SESSION_NAME:5.1 -h
sleep 2
tmux send-keys -t $SESSION_NAME:5.1 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:5.1 "export HACONIWA_AGENT_ID='build-optimization-engineer'" Enter
tmux send-keys -t $SESSION_NAME:5.1 "echo '=== Build Optimization Engineer (build-optimization-engineer) ==='" Enter
tmux send-keys -t $SESSION_NAME:5.1 "echo 'Turborepo最適化・ビルドパフォーマンス・キャッシュ戦略'" Enter
tmux send-keys -t $SESSION_NAME:5.1 "claude --dangerously-skip-permissions" Enter

# Pane 5.2: Quality Assurance Engineer
tmux split-window -t $SESSION_NAME:5.1 -v
sleep 2
tmux send-keys -t $SESSION_NAME:5.2 "cd $BASE_DIR" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:5.2 "export HACONIWA_AGENT_ID='quality-assurance-engineer'" Enter
tmux send-keys -t $SESSION_NAME:5.2 "echo '=== Quality Assurance Engineer (quality-assurance-engineer) ==='" Enter
tmux send-keys -t $SESSION_NAME:5.2 "echo 'コード品質管理・テスト自動化・CI/CD品質ゲート'" Enter
tmux send-keys -t $SESSION_NAME:5.2 "claude --dangerously-skip-permissions" Enter

# Claude起動完了まで待機（起動確認ループを削除）
echo "⏳ Claude Code起動完了まで待機中..."
sleep 12

echo "✅ Haconiwa (箱庭) 6x3 Grid セットアップ完了！"
echo ""
echo "📋 実際のpane構成確認："
tmux list-panes -t "$SESSION_NAME" -a -F "  Window #{window_index}: Pane #{pane_index} (#{pane_title})"
echo ""
echo "📋 利用可能なウィンドウ（6x3 Grid = 18エージェント）："
echo "  Window 0: 🏛️CEO-Strategy (CEO Main, Director Coordinator, Progress Monitor)"
echo "  Window 1: 🗄️Backend-AWS (Backend Director, Amplify Gen2 Specialist, Cognito Authentication Expert)" 
echo "  Window 2: ⚡Trading-Engine (Trading Flow Director, Entry Flow Specialist, Settlement Flow Specialist)"
echo "  Window 3: 🔌Integration-MT5 (Integration Director, MT5 Connector Specialist, WebSocket Engineer)"
echo "  Window 4: 🎨Frontend-UI (Frontend Director, React Specialist, Desktop App Engineer)"
echo "  Window 5: 🚀DevOps-CI (DevOps Director, Build Optimization Engineer, Quality Assurance Engineer)"
echo ""
echo "🔗 アクセス方法："
echo "  tmux attach -t $SESSION_NAME    # セッション接続"
echo "  Ctrl+b + 0-5                    # ウィンドウ切り替え"
echo "  Ctrl+b + d                      # デタッチ"
echo ""
# ===========================================
# 🎯 CEO指示出し自動化メニュー
# ===========================================
echo "🎯 CEO指示出し自動化メニュー："
echo "  1. CEO初期設定用プロンプト自動入力"
echo "  2. CEO→全Directors指示出し"
echo "  3. MVP特化タスク割り当て"
echo "  4. 全部自動実行"
echo ""
echo "CEO(0.1)に初期プロンプトを送信しますか？ [y/N]"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "🏛️ CEO初期設定用プロンプト自動入力中..."
    sleep 2
    
    # CEO Main (0.1) への指示送信
    echo "🎯 CEO Main (0.1) への初期プロンプト送信中..."
    if ! send_instruction_to_pane "0.1" "$(generate_ceo_to_directors_prompt)"; then
        echo "❌ CEO初期プロンプト送信に失敗しました"
        echo "📋 利用可能なpane一覧:"
        tmux list-panes -t "$SESSION_NAME" -a -F "  #{window_index}.#{pane_index} #{pane_title}"
        echo "手動で以下のコマンドを実行してください:"
        echo "tmux send-keys -t '$SESSION_NAME:0.1' '$(generate_ceo_to_directors_prompt)' Enter"
    fi
    
    echo "CEO→全Directors指示出しを実行しますか？ [y/N]"
    read -r response2
    if [[ "$response2" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "⏳ 5秒後にCEO→Directors指示出し開始..."
        sleep 5
        ceo_instruct_all_directors
        
        echo "MVP特化タスク割り当てを実行しますか？ [y/N]"
        read -r response3
        if [[ "$response3" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            echo "⏳ 3秒後にMVP特化タスク割り当て開始..."
            sleep 3
            assign_mvp_tasks
            echo "🎯 全指示出し完了！"
        fi
    fi
fi

echo ""
echo "💡 次回終了時は: npm run haconiwa:stop を使用してください"
echo "🎯 全ペインでHACONIWA_AGENT_ID設定済み（役割認識完了）"
echo ""
echo "🚀 手動指示出し用コマンド："
echo "  # CEO→Directors"
echo "  tmux send-keys -t $SESSION_NAME:1.0 'echo \"CEO指示: Backend MVP実装開始\" ultrathink' Enter"
echo "  # Directors→Specialists"  
echo "  tmux send-keys -t $SESSION_NAME:1.0 'echo \"Director指示: GraphQL実装開始\" ultrathink' Enter"

# 自動アタッチ
tmux attach -t $SESSION_NAME