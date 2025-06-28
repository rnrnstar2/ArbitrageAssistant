#!/bin/bash

# Haconiwa (箱庭) 6x3 Grid Multi-Agent Development Environment
# ArbitrageAssistant専用Claude Code開発環境 - 18エージェント構成

set -e

SESSION_NAME="arbitrage-assistant"
BASE_DIR="/Users/rnrnstar/github/ArbitrageAssistant"

echo "🚀 Haconiwa (箱庭) 6x3 Grid マルチエージェント開発環境起動中..."

# 並列実行モード設定（固定：完全並列起動）
PARALLEL_MODE="${HACONIWA_PARALLEL_MODE:-full_parallel}"

echo "🚀 起動モード: 完全並列起動（Claude起動確認付き・18個同時）- 約15秒"
echo "✅ 起動モード: $PARALLEL_MODE"

# 完全自動クリーンアップ（haconiwa-clean-start.sh統合）
echo "🔍 既存環境確認中..."

# 現在の状況確認
claude_processes=$(ps aux | grep -v grep | grep claude | wc -l | tr -d ' ')
echo "📊 現在のClaudeプロセス数: $claude_processes"

if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "📊 tmuxセッション: 実行中"
else
    echo "📊 tmuxセッション: 停止中"
fi

env_files=$(ls -1 /tmp/haconiwa_env_*.sh 2>/dev/null | wc -l | tr -d ' ')
echo "📊 環境変数ファイル数: $env_files"

# 自動クリーンアップ実行（ローカルClaude保持版）
if [ "$claude_processes" -gt 0 ] || tmux has-session -t $SESSION_NAME 2>/dev/null || [ "$env_files" -gt 0 ]; then
    echo ""
    echo "🧹 スマートクリーンアップ開始（ローカルClaude保持）..."
    
    # Step 1: TMUX内Claudeプロセスのみ終了（TTYベース最確実識別）
    echo "🔥 TMUX内Claudeプロセス特定・終了中（TTYベース識別）..."
    
    tmux_claude_pids=""
    tmux_claude_count=0
    local_claude_count=$claude_processes
    
    if tmux has-session -t $SESSION_NAME 2>/dev/null; then
        # TMUXで使用されているTTY名を取得
        tmux_ttys=$(tmux list-panes -t $SESSION_NAME -a -F "#{pane_tty}" 2>/dev/null | sort | uniq)
        
        if [ -n "$tmux_ttys" ]; then
            echo "📋 TMUX使用TTY識別中..."
            
            # TTYベースでClaudeプロセスを検索（最確実方法）
            for tty in $tmux_ttys; do
                # TTY名から短縮名を取得（例: /dev/ttys001 -> s001）
                short_tty=$(basename $tty | sed 's/^tty//')
                
                # そのTTYで動作するClaudeプロセスを検索
                claude_pids_in_tty=$(ps aux | grep claude | grep -v grep | grep "$short_tty" | awk '{print $2}' | tr '\n' ' ')
                
                if [ -n "$claude_pids_in_tty" ]; then
                    echo "  TTY $tty: Claude PID $claude_pids_in_tty"
                    tmux_claude_pids="$tmux_claude_pids $claude_pids_in_tty"
                    for pid in $claude_pids_in_tty; do
                        tmux_claude_count=$((tmux_claude_count + 1))
                    done
                fi
            done
        fi
        
        local_claude_count=$((claude_processes - tmux_claude_count))
        echo "📊 TMUX内Claudeプロセス: $tmux_claude_count 個（終了対象）"
        echo "📊 ローカルClaudeプロセス: $local_claude_count 個（保持）"
        
        # TMUX内Claudeプロセスのみ終了
        if [ $tmux_claude_count -gt 0 ]; then
            for pid in $tmux_claude_pids; do
                if ps -p $pid > /dev/null 2>&1; then
                    echo "🎯 TMUX内Claude PID $pid を終了中..."
                    kill $pid 2>/dev/null || true
                fi
            done
            sleep 3
            
            # 終了確認
            remaining_tmux=0
            for pid in $tmux_claude_pids; do
                if ps -p $pid > /dev/null 2>&1; then
                    remaining_tmux=$((remaining_tmux + 1))
                fi
            done
            
            if [ $remaining_tmux -eq 0 ]; then
                echo "✅ TMUX内Claudeプロセス終了完了"
            else
                echo "⚠️  $remaining_tmux 個のTMUX内プロセスが残存（強制終了実行）"
                for pid in $tmux_claude_pids; do
                    if ps -p $pid > /dev/null 2>&1; then
                        kill -9 $pid 2>/dev/null || true
                    fi
                done
                echo "✅ 強制終了完了"
            fi
        else
            echo "✅ TMUX内Claudeプロセスなし"
        fi
        
        # Step 2: tmuxセッション終了
        echo "🔥 tmuxセッション終了中..."
        if tmux kill-session -t $SESSION_NAME 2>/dev/null; then
            echo "✅ tmuxセッション終了完了"
        else
            echo "⚠️  tmuxセッション終了済み"
        fi
    else
        echo "✅ tmuxセッションなし"
    fi
    
    # Step 3: 環境変数ファイルクリーンアップ
    if [ "$env_files" -gt 0 ]; then
        echo "🔥 環境変数ファイルクリーンアップ中..."
        rm -f /tmp/haconiwa_env_*.sh 2>/dev/null || true
        echo "✅ 環境変数ファイルクリーンアップ完了"
    fi
    
    echo ""
    echo "✅ スマートクリーンアップ完了"
    echo "📊 ローカルClaudeプロセス保持: $local_claude_count 個"
    echo "🚀 クリーンな環境で起動開始..."
else
    echo "✅ クリーンな環境確認（クリーンアップ不要）"
fi

echo ""
echo "🚀 新環境構築開始..."

# ===========================================
# ペイン構成作成フェーズ
# ===========================================

echo ""
echo "📋 6x3 Grid構成作成開始..."

# 新セッション作成
cd "$BASE_DIR"
tmux new-session -d -s $SESSION_NAME -c "$BASE_DIR"

# Window 0: 🏛️ CEO Executive Office (3 panes)
echo "📋 Window 0: CEO Executive Office 作成中..."
# Window 0の名前設定（new-sessionで作成されたWindowに名前を付与）
tmux rename-window -t $SESSION_NAME:0 "🏛️CEO-Strategy"
# Window 0はすでに作成済み（new-sessionで作成される）
# Pane 0.1: Director Coordinator (右に分割)
tmux split-window -t $SESSION_NAME:0 -h
sleep 0.2
# Pane 0.2: Progress Monitor (左ペインを上下に分割)
tmux select-pane -t $SESSION_NAME:0.0
tmux split-window -t $SESSION_NAME:0 -v

# ===========================================
# ペイン構成のみ作成（エージェント起動は後で一括実行）
# ===========================================

# Window 1: 🗄️ Backend Architecture (3 panes)
echo "📋 Window 1: Backend Architecture 作成中..."
tmux new-window -t $SESSION_NAME -n "🗄️Backend-AWS" -c "$BASE_DIR/packages/shared-backend"
tmux split-window -t $SESSION_NAME:1.0 -h
sleep 0.2
tmux split-window -t $SESSION_NAME:1.0 -v

# Window 2: ⚡ Trading Systems (3 panes)
echo "📋 Window 2: Trading Systems 作成中..."
tmux new-window -t $SESSION_NAME -n "⚡Trading-Engine" -c "$BASE_DIR/apps/hedge-system"
tmux split-window -t $SESSION_NAME:2.0 -h
sleep 0.2
tmux split-window -t $SESSION_NAME:2.0 -v

# Window 3: 🔌 Integration Systems (3 panes)
echo "📋 Window 3: Integration Systems 作成中..."
tmux new-window -t $SESSION_NAME -n "🔌Integration-MT5" -c "$BASE_DIR/ea"
tmux split-window -t $SESSION_NAME:3.0 -h
sleep 0.2
tmux split-window -t $SESSION_NAME:3.0 -v

# Window 4: 🎨 Frontend Experience (3 panes)
echo "📋 Window 4: Frontend Experience 作成中..."
tmux new-window -t $SESSION_NAME -n "🎨Frontend-UI" -c "$BASE_DIR/apps/admin"
tmux split-window -t $SESSION_NAME:4.0 -h
sleep 0.2
tmux split-window -t $SESSION_NAME:4.0 -v

# Window 5: 🚀 DevOps & QA (3 panes)
echo "📋 Window 5: DevOps & QA 作成中..."
tmux new-window -t $SESSION_NAME -n "🚀DevOps-CI" -c "$BASE_DIR"
tmux split-window -t $SESSION_NAME:5.0 -h
sleep 0.2
tmux split-window -t $SESSION_NAME:5.0 -v

echo "✅ 全ペイン構成作成完了（6窓 x 3ペイン = 18ペイン）"

# ===========================================
# エージェント起動フェーズ（モード別実行）
# ===========================================

echo ""
echo "🚀 Claude エージェント起動フェーズ開始..."
echo "📊 起動モード: $PARALLEL_MODE"

# エージェント定義配列
declare -a AGENTS=(
    "0.0|ceo-supreme|CEO Supreme v6.0 (ceo-supreme) - MVP戦略決定・完全自動化・完璧分析システム|$BASE_DIR"
    "0.1|ceo-operations|CEO Operations (ceo-operations) - Director間調整・進捗確認・効率化専門（権限制限）|$BASE_DIR"
    "0.2|ceo-analytics|CEO Analytics (ceo-analytics) - 全体分析・品質評価・リスク監視専門（指示権限なし）|$BASE_DIR"
    "1.0|backend-director|Backend Director (backend-director) - AWS Amplify Gen2 + GraphQL + userIdベース最適化専門|$BASE_DIR"
    "1.1|amplify-gen2-specialist|Amplify Gen2 Specialist (amplify-gen2-specialist) - AWS Amplify Gen2 data/resource.ts設計・GraphQL実装|$BASE_DIR/packages/shared-backend"
    "1.2|mvp-implementation-specialist|MVP Implementation Specialist (mvp-implementation-specialist) - MVP最終実装・品質向上・統合テスト|$BASE_DIR"
    "2.0|trading-flow-director|Trading Flow Director (trading-flow-director) - コア実行フロー戦略・Position-Trail-Actionフロー管理|$BASE_DIR"
    "2.1|entry-flow-specialist|Entry Flow Specialist (entry-flow-specialist) - エントリーポジション作成→トレイル実行→アクション実行|$BASE_DIR/apps/hedge-system"
    "2.2|settlement-flow-specialist|Settlement Flow Specialist (settlement-flow-specialist) - ポジション決済→トレール実行→アクション実行|$BASE_DIR/apps/hedge-system"
    "3.0|integration-director|Integration Director (integration-director) - MT4/MT5統合戦略・外部API連携アーキテクチャ設計|$BASE_DIR"
    "3.1|mt5-connector-specialist|MT5 Connector Specialist (mt5-connector-specialist) - MT4/MT5 EA開発・MQL5プログラミング・取引所連携|$BASE_DIR/ea"
    "3.2|websocket-engineer|WebSocket Engineer (websocket-engineer) - WebSocket DLL実装・C++/Rustプロトコル実装|$BASE_DIR/ea"
    "4.0|frontend-director|Frontend Director (frontend-director) - 管理画面・デスクトップUI・ユーザー体験専門|$BASE_DIR"
    "4.1|react-specialist|React Specialist (react-specialist) - React/Next.js開発・状態管理・UI実装|$BASE_DIR/apps/admin"
    "4.2|desktop-app-engineer|Desktop App Engineer (desktop-app-engineer) - Tauri v2デスクトップアプリ開発・Rust統合|$BASE_DIR/apps/hedge-system"
    "5.0|devops-director|DevOps Director (devops-director) - インフラ最適化・品質保証・CI/CD・監視専門|$BASE_DIR"
    "5.1|build-optimization-engineer|Build Optimization Engineer (build-optimization-engineer) - Turborepo最適化・ビルドパフォーマンス・キャッシュ戦略|$BASE_DIR"
    "5.2|quality-assurance-engineer|Quality Assurance Engineer (quality-assurance-engineer) - コード品質管理・テスト自動化・CI/CD品質ゲート|$BASE_DIR"
)

# エージェント起動関数
start_agent() {
    local pane="$1"
    local agent_id="$2"
    local description="$3"
    local work_dir="$4"
    
    echo "🚀 起動中: $pane -> $agent_id"
    
    # ペイン存在確認
    if ! tmux list-panes -t "$SESSION_NAME:$pane" >/dev/null 2>&1; then
        echo "❌ ペイン $pane が存在しません"
        return 1
    fi
    
    # 作業ディレクトリ移動 & 環境変数設定（一括実行）
    tmux send-keys -t "$SESSION_NAME:$pane" "cd '$work_dir' && export HACONIWA_AGENT_ID='$agent_id'" Enter
    sleep 0.1
    
    # 環境変数ファイル作成（デバッグ用）
    env_file="/tmp/haconiwa_env_${agent_id}.sh"
    cat > "$env_file" << EOF
#!/bin/bash
export HACONIWA_AGENT_ID='$agent_id'
export HACONIWA_DESCRIPTION='$description'
export HACONIWA_WORK_DIR='$work_dir'
export HACONIWA_PANE='$pane'
export HACONIWA_SESSION='$SESSION_NAME'
EOF
    
    # Claude Code起動（セキュリティプロンプトスキップ）
    tmux send-keys -t "$SESSION_NAME:$pane" "claude --dangerously-skip-permissions" Enter
    
    # Claude起動確認（確実な起動待機）
    echo "🔍 $agent_id Claude起動確認中..."
    wait_count=0
    max_wait=30  # 最大30秒待機
    
    while [ $wait_count -lt $max_wait ]; do
        # ペイン内容キャプチャでClaude起動確認
        pane_content=$(tmux capture-pane -t "$SESSION_NAME:$pane" -p 2>/dev/null || echo "")
        
        # Claude Code起動完了のサイン確認
        if echo "$pane_content" | grep -q "claude code" || \
           echo "$pane_content" | grep -q "Claude Code" || \
           echo "$pane_content" | grep -q "Welcome" || \
           echo "$pane_content" | grep -q "●" || \
           echo "$pane_content" | grep -q "ArbitrageAssistant"; then
            echo "✅ $agent_id Claude起動確認完了 (${wait_count}秒)"
            break
        fi
        
        sleep 0.5
        wait_count=$((wait_count + 1))
        
        # 進捗表示（5秒ごと）
        if [ $((wait_count % 10)) -eq 0 ]; then
            echo "⏳ $agent_id 起動待機中... (${wait_count}/30秒)"
        fi
    done
    
    if [ $wait_count -ge $max_wait ]; then
        echo "⚠️ $agent_id Claude起動タイムアウト (30秒) - 継続"
    fi
    
    # 追加安定化待機
    sleep 0.3
    
    # 初期プロンプト設定（CEO系以外・役割確認のみ・必要最小限）
    # CEO系（0.0, 0.1, 0.2）は後でceo-initial-prompts.shで設定するためスキップ
    if [[ ! "$pane" =~ ^0\.[0-2]$ ]]; then
        initial_prompt="./scripts/utils/role を実行して自分の役割を確認。"
        tmux send-keys -t "$SESSION_NAME:$pane" "$initial_prompt"
        sleep 0.1
    fi
    
    echo "✅ 起動完了: $agent_id"
    return 0
}

# 並列起動設定（最高速化 v2.0）
BATCH_SIZE=6  # バッチモード用（full_parallelでは無効）
BATCH_DELAY=0.5  # バッチ間遅延短縮

# 起動モード別実行
if [ "$PARALLEL_MODE" = "sequential" ]; then
    # 順次起動モード
    echo "🔄 順次起動実行中..."
    for agent_def in "${AGENTS[@]}"; do
        IFS='|' read -r pane agent_id description work_dir <<< "$agent_def"
        start_agent "$pane" "$agent_id" "$description" "$work_dir"
    done
elif [ "$PARALLEL_MODE" = "full_parallel" ]; then
    # 完全並列起動モード（Claude起動確認付き）
    echo "🚀 完全並列起動実行中（18個同時起動 + Claude起動確認）..."
    echo "🔍 各エージェントのClaude起動状態を監視中..."
    
    for agent_def in "${AGENTS[@]}"; do
        IFS='|' read -r pane agent_id description work_dir <<< "$agent_def"
        # 全エージェントを即座並列起動（Claude起動確認付き）
        start_agent "$pane" "$agent_id" "$description" "$work_dir" &
    done
    
    echo "⏳ 全エージェントClaude起動確認完了待機中..."
    wait
    echo "✅ 全エージェントのClaude起動確認完了！"
else
    # バッチ並列起動モード（デフォルト）
    echo "⚡ バッチ並列起動実行中（${BATCH_SIZE}個ずつ）..."
    batch_count=0
    for agent_def in "${AGENTS[@]}"; do
        IFS='|' read -r pane agent_id description work_dir <<< "$agent_def"
        
        # バックグラウンドで起動（並列実行）
        start_agent "$pane" "$agent_id" "$description" "$work_dir" &
        
        batch_count=$((batch_count + 1))
        
        # バッチサイズ到達時は待機
        if [ $((batch_count % BATCH_SIZE)) -eq 0 ]; then
            echo "⏳ バッチ $((batch_count / BATCH_SIZE)) 完了待機中..."
            wait
        fi
    done
    
    # 残りのジョブ完了待機
    echo "⏳ 全エージェント起動完了待機中..."
    wait
fi

echo ""
echo "✅ 全エージェント起動完了"

# ===========================================
# 環境変数・統計確認
# ===========================================

echo ""
echo "📊 起動結果確認中..."

# 環境変数ファイル作成確認
env_files_created=$(ls -1 /tmp/haconiwa_env_*.sh 2>/dev/null | wc -l | tr -d ' ')
if [ "$env_files_created" -eq 18 ]; then
    echo "✅ 全18ペインで環境変数ファイル作成完了"
else
    echo "⚠️  ${env_files_created}/18ペインで環境変数ファイル作成済み"
    echo "🔧 詳細確認: npm run haconiwa:debug"
fi

echo "✅ Haconiwa 6x3 Grid セットアップ完了（18エージェント）"

# ===========================================
# 🎯 CEO戦略的指示システム（v6.0統合版）
# ===========================================
echo "🎯 CEO戦略的指示システム v6.0完全自動化："
echo "  1. CEO初期設定用プロンプト自動入力"
echo "  2. CEO系エージェント自動指示"
echo "  3. 全Directors自動指示実行"
echo ""
echo "🏛️ CEO系エージェント初期プロンプト設定開始..."
sleep 1

# CEO初期プロンプト設定スクリプト実行（v6.0対応）
echo "🎯 CEO系3ペイン初期プロンプト設定中..."
if [ -f "./scripts/ceo/ceo-initial-prompts.sh" ]; then
    if ./scripts/ceo/ceo-initial-prompts.sh; then
        echo "✅ CEO初期プロンプト設定完了"
    else
        echo "⚠️  CEO初期プロンプト設定に問題が発生（継続実行）"
    fi
else
    echo "⚠️  CEO初期プロンプトスクリプトが見つかりません"
fi

echo ""
echo "✅ CEO初期プロンプトシステム完了！"
echo "📋 CEO系3ペイン全てに初期プロンプトを設定しました"
echo "🎯 各CEO系ペインが独立してDirectorに指示出し可能"

echo "✅ CEO系3ペイン初期プロンプト設定完了"

# 最後にtmuxセッションにアタッチ
echo ""
echo "🔗 tmuxセッションにアタッチ中..."
sleep 0.3
tmux source .tmux.conf 2>/dev/null || true
exec tmux attach -t $SESSION_NAME