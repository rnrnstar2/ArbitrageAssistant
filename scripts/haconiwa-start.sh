#!/bin/bash

# Haconiwa (箱庭) 6x3 Grid Multi-Agent Development Environment
# ArbitrageAssistant専用Claude Code開発環境 - 18エージェント構成

set -e

SESSION_NAME="arbitrage-assistant"
BASE_DIR="/Users/rnrnstar/github/ArbitrageAssistant"

echo "🚀 Haconiwa (箱庭) 6x3 Grid マルチエージェント開発環境起動中..."

# 並列実行モード設定（固定：並列起動）
PARALLEL_MODE="${HACONIWA_PARALLEL_MODE:-parallel_safe}"

echo "⚡ 起動モード: 並列起動（高速・並列3個）- 約20秒"
echo "✅ 固定起動モード: $PARALLEL_MODE"

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
            
            # 補完検索：ローカルTTYを除外してTMUX内Claudeプロセスを検出
            echo "  補完検索: 全Claudeプロセスから非ローカルTTYを検出..."
            all_claude_pids=$(ps aux | grep claude | grep -v grep | awk '{print $2" "$7}')
            while read -r pid tty_name; do
                if ps -p $pid > /dev/null 2>&1; then
                    # ローカルTTY（s003, s005など高CPU使用率）を除外
                    # 通常、ローカルClaudeは s000-s005 の範囲で動作
                    tty_num=$(echo $tty_name | sed 's/s//')
                    if [[ "$tty_num" =~ ^[0-9]+$ ]] && [ "$tty_num" -ge 6 ] && ! echo "$tmux_claude_pids" | grep -q "$pid"; then
                        echo "  補完検出: 非ローカルTTY $tty_name PID $pid"
                        tmux_claude_pids="$tmux_claude_pids $pid"
                        tmux_claude_count=$((tmux_claude_count + 1))
                    fi
                fi
            done <<< "$all_claude_pids"
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
                sleep 1
                echo "✅ TMUX内プロセス強制終了完了"
            fi
        else
            echo "✅ TMUX内Claudeプロセスなし（既にクリーン）"
        fi
    else
        echo "✅ tmuxセッションなし（Claudeプロセス全て保持）"
    fi
    
    # Step 2: tmuxセッション削除
    echo "🔥 tmuxセッション削除中..."
    if tmux has-session -t $SESSION_NAME 2>/dev/null; then
        tmux kill-session -t $SESSION_NAME
        sleep 1
        echo "✅ tmuxセッション削除完了"
    else
        echo "✅ tmuxセッションなし（既にクリーン）"
    fi
    
    # Step 3: 環境変数ファイル削除
    echo "🔥 環境変数ファイル削除中..."
    if [ "$env_files" -gt 0 ]; then
        rm -f /tmp/haconiwa_env_*.sh
        echo "✅ 環境変数ファイル削除完了（$env_files 個削除）"
    else
        echo "✅ 環境変数ファイルなし（既にクリーン）"
    fi
    
    # Step 4: TMUX関連一時ファイルのみクリーンアップ（Claude認証情報は除外）
    echo "🔥 TMUX関連一時ファイルクリーンアップ中..."
    # 注意: ~/.claude の認証情報は保持
    rm -f /tmp/haconiwa-* 2>/dev/null || true
    echo "✅ TMUX関連一時ファイルクリーンアップ完了（Claude認証情報は保持）"
    
    echo ""
    echo "✅ 完全自動クリーンアップ完了！"
    sleep 1
else
    echo "✅ クリーンな状態です"
fi

# ==========================================
# CEO指示出しヘルパー関数群
# ==========================================

# クリーンなエージェント起動関数（並列実行対応・競合回避）
start_agent() {
    local pane="$1"
    local agent_id="$2"
    local description="$3"
    local work_dir="${4:-$BASE_DIR}"
    
    echo "🚀 Pane $pane でエージェント起動中: $agent_id"
    
    # Step 1: 既存Claudeプロセスを確実に終了
    echo "  🧹 Pane $pane: 既存プロセス終了中..."
    tmux send-keys -t "$SESSION_NAME:$pane" C-c 2>/dev/null || true
    sleep 0.3
    tmux send-keys -t "$SESSION_NAME:$pane" C-c 2>/dev/null || true
    sleep 0.2
    
    # Step 2: 入力バッファを完全クリア
    echo "  🧹 Pane $pane: 入力バッファクリア中..."
    tmux send-keys -t "$SESSION_NAME:$pane" C-u 2>/dev/null || true  # 現在行をクリア
    sleep 0.1
    tmux send-keys -t "$SESSION_NAME:$pane" "" Enter 2>/dev/null || true  # 空のEnter
    sleep 0.1
    tmux send-keys -t "$SESSION_NAME:$pane" "clear" Enter 2>/dev/null || true  # 画面クリア
    sleep 0.3
    
    # Step 3: 環境変数設定
    echo "  ⚙️ Pane $pane: 環境変数設定中..."
    tmux set-environment -t "$SESSION_NAME:$pane" HACONIWA_AGENT_ID "$agent_id"
    echo 'export HACONIWA_AGENT_ID="'$agent_id'"' > /tmp/haconiwa_env_$pane.sh
    
    # Step 4: クリーンな状態でClaude起動
    echo "  🚀 Pane $pane: Claude起動中..."
    tmux send-keys -t "$SESSION_NAME:$pane" "cd $work_dir" Enter
    sleep 0.2
    tmux send-keys -t "$SESSION_NAME:$pane" "export HACONIWA_AGENT_ID='$agent_id'" Enter
    sleep 0.2
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '=== $description ==='" Enter
    sleep 0.2
    tmux send-keys -t "$SESSION_NAME:$pane" "echo \"エージェントID: $agent_id\"" Enter
    sleep 0.2
    tmux send-keys -t "$SESSION_NAME:$pane" "source /tmp/haconiwa_env_$pane.sh" Enter
    sleep 0.3
    tmux send-keys -t "$SESSION_NAME:$pane" "claude --dangerously-skip-permissions" Enter
}

# 並列エージェント起動関数（競合回避・段階的起動）
start_agent_parallel() {
    local pane="$1"
    local agent_id="$2"
    local description="$3"
    local work_dir="${4:-$BASE_DIR}"
    local batch_delay="${5:-0}"  # バッチ間遅延
    
    # 並列実行競合回避のための遅延
    sleep "$batch_delay"
    
    {
        echo "🚀 [並列] Pane $pane でエージェント起動中: $agent_id"
        
        # 環境変数ファイル作成（並列安全）
        local env_file="/tmp/haconiwa_env_$pane.sh"
        echo 'export HACONIWA_AGENT_ID="'$agent_id'"' > "$env_file"
        
        # tmux環境変数設定（並列安全）
        tmux set-environment -t "$SESSION_NAME:$pane" HACONIWA_AGENT_ID "$agent_id" 2>/dev/null || true
        
        # 段階的クリーンアップ（競合回避）
        tmux send-keys -t "$SESSION_NAME:$pane" C-c 2>/dev/null || true
        sleep 0.2
        tmux send-keys -t "$SESSION_NAME:$pane" C-c 2>/dev/null || true
        sleep 0.1
        tmux send-keys -t "$SESSION_NAME:$pane" C-u 2>/dev/null || true
        sleep 0.1
        tmux send-keys -t "$SESSION_NAME:$pane" "" Enter 2>/dev/null || true
        sleep 0.1
        tmux send-keys -t "$SESSION_NAME:$pane" "clear" Enter 2>/dev/null || true
        sleep 0.2
        
        # Claude起動（認証競合回避のため段階的）
        tmux send-keys -t "$SESSION_NAME:$pane" "cd $work_dir && export HACONIWA_AGENT_ID='$agent_id' && source $env_file && echo '=== $description ===' && echo \"エージェントID: $agent_id\" && claude --dangerously-skip-permissions" Enter
        
        echo "  ✅ [並列] Pane $pane: 起動完了"
    } &
}

# 即座復旧関数（3秒後の高速復旧）
perform_immediate_recovery() {
    echo "🔧 3秒即座復旧システム開始..."
    
    # 未起動ペインを特定
    local failed_panes_immediate=()
    while IFS= read -r line; do
        if [[ $line =~ ^[[:space:]]*([0-9]+\.[0-9]+): ]]; then
            pane_id="${BASH_REMATCH[1]}"
            failed_panes_immediate+=("$pane_id")
        fi
    done < <(tmux list-panes -t $SESSION_NAME -a -F "  #{window_index}.#{pane_index}: #{pane_current_command}" | grep -v "node")
    
    if [ ${#failed_panes_immediate[@]} -eq 0 ]; then
        echo "✅ 復旧対象なし"
        return 0
    fi
    
    echo "⚡ 即座復旧対象: ${failed_panes_immediate[@]}"
    
    # 高速復旧実行
    for pane in "${failed_panes_immediate[@]}"; do
        # エージェントID決定
        case $pane in
            "0.0") agent_id="ceo-main" ;;
            "0.1") agent_id="director-coordinator" ;;
            "0.2") agent_id="progress-monitor" ;;
            "1.0") agent_id="backend-director" ;;
            "1.1") agent_id="amplify-gen2-specialist" ;;
            "1.2") agent_id="cognito-auth-expert" ;;
            "2.0") agent_id="trading-flow-director" ;;
            "2.1") agent_id="entry-flow-specialist" ;;
            "2.2") agent_id="settlement-flow-specialist" ;;
            "3.0") agent_id="integration-director" ;;
            "3.1") agent_id="mt5-connector-specialist" ;;
            "3.2") agent_id="websocket-engineer" ;;
            "4.0") agent_id="frontend-director" ;;
            "4.1") agent_id="react-specialist" ;;
            "4.2") agent_id="desktop-app-engineer" ;;
            "5.0") agent_id="devops-director" ;;
            "5.1") agent_id="build-optimization-engineer" ;;
            "5.2") agent_id="quality-assurance-engineer" ;;
            *) agent_id="unknown" ;;
        esac
        
        echo "⚡ Pane $pane 即座復旧: $agent_id"
        # クリーンな復旧処理（入力バッファクリア対応）
        {
            echo "  🧹 Pane $pane 復旧: 既存プロセス終了・バッファクリア..."
            tmux send-keys -t "$SESSION_NAME:$pane" C-c 2>/dev/null || true
            sleep 0.2
            tmux send-keys -t "$SESSION_NAME:$pane" C-c 2>/dev/null || true
            sleep 0.1
            tmux send-keys -t "$SESSION_NAME:$pane" C-u 2>/dev/null || true
            sleep 0.1
            tmux send-keys -t "$SESSION_NAME:$pane" "" Enter 2>/dev/null || true
            sleep 0.1
            tmux send-keys -t "$SESSION_NAME:$pane" "clear" Enter 2>/dev/null || true
            sleep 0.2
            
            echo "  ⚙️ Pane $pane 復旧: 環境変数設定..."
            tmux set-environment -t "$SESSION_NAME:$pane" HACONIWA_AGENT_ID "$agent_id"
            echo 'export HACONIWA_AGENT_ID="'$agent_id'"' > /tmp/haconiwa_env_$pane.sh
            
            echo "  🚀 Pane $pane 復旧: Claude起動..."
            tmux send-keys -t "$SESSION_NAME:$pane" "export HACONIWA_AGENT_ID='$agent_id'" Enter
            sleep 0.2
            tmux send-keys -t "$SESSION_NAME:$pane" "source /tmp/haconiwa_env_$pane.sh" Enter
            sleep 0.2
            tmux send-keys -t "$SESSION_NAME:$pane" "claude --dangerously-skip-permissions" Enter
        } &
    done
    
    wait  # 全バックグラウンドジョブ完了まで待機
    echo "⚡ 即座復旧処理完了"
}

# 並列ペイン分割と起動（さらなる高速化）
start_agent_batch() {
    local agents=()
    while IFS='|' read -r pane agent_id description work_dir; do
        if [ -n "$pane" ]; then
            start_agent "$pane" "$agent_id" "$description" "$work_dir" &
        fi
    done
}

# CEO Main戦略的指示プロンプト生成（階層的命令系統）
generate_ceo_main_prompt() {
    cat <<EOF
echo "HACONIWA_AGENT_ID: \$HACONIWA_AGENT_ID" && cat arbitrage-assistant.yaml | grep -A 10 "ceo-main" && echo "=== CEO Main 役割確認完了 ===" && cat "MVPシステム設計.md" | head -50 && echo "=== MVP設計確認完了 ===" && echo "

🎯 CEO戦略的指示システム - 階層的命令フロー:

【CEO系エージェント管理】
1. Director Coordinatorに指示:
tmux send-keys -t arbitrage-assistant:0.1 'echo \"HACONIWA_AGENT_ID: \\\$HACONIWA_AGENT_ID\" && cat arbitrage-assistant.yaml | grep -A 10 \"director-coordinator\" && echo \"=== CEO指示: 5 Directors間連携調整を開始。各部門の技術実装状況を監視し、クロスチーム課題を解決してください ===\" && cat \"MVPシステム設計.md\" | grep -A 20 \"部門間連携\" ultrathink' Enter

2. Progress Monitorに指示:
tmux send-keys -t arbitrage-assistant:0.2 'echo \"HACONIWA_AGENT_ID: \\\$HACONIWA_AGENT_ID\" && cat arbitrage-assistant.yaml | grep -A 10 \"progress-monitor\" && echo \"=== CEO指示: MVPプロジェクト進捗監視を開始。KPI管理とリリース準備確認を実行してください ===\" && cat \"MVPシステム設計.md\" | grep -A 20 \"進捗管理\" ultrathink' Enter

【5 Directors戦略指示】
3. Backend Directorに戦略指示:
tmux send-keys -t arbitrage-assistant:1.0 'echo \"HACONIWA_AGENT_ID: \\\$HACONIWA_AGENT_ID\" && cat arbitrage-assistant.yaml | grep -A 15 \"backend-director\" && echo \"=== CEO戦略指示: AWS Amplify Gen2 + GraphQL + userIdベース最適化を統括。Amplify Gen2 Specialist・Cognito Auth Expertを指導し、packages/shared-backend実装を完遂してください ===\" && cat \"MVPシステム設計.md\" | grep -A 30 \"データベース設計\" ultrathink' Enter

4. Trading Directorに戦略指示:
tmux send-keys -t arbitrage-assistant:2.0 'echo \"HACONIWA_AGENT_ID: \\\$HACONIWA_AGENT_ID\" && cat arbitrage-assistant.yaml | grep -A 15 \"trading-flow-director\" && echo \"=== CEO戦略指示: Position-Trail-Actionフロー管理を統括。Entry Flow・Settlement Flow Specialistを指導し、apps/hedge-system金融計算ロジックを完遂してください ===\" && cat \"MVPシステム設計.md\" | grep -A 30 \"実行パターン詳細\" ultrathink' Enter

5. Integration Directorに戦略指示:
tmux send-keys -t arbitrage-assistant:3.0 'echo \"HACONIWA_AGENT_ID: \\\$HACONIWA_AGENT_ID\" && cat arbitrage-assistant.yaml | grep -A 15 \"integration-director\" && echo \"=== CEO戦略指示: MT4/MT5統合戦略・外部API連携アーキテクチャを統括。MT5 Connector・WebSocket Engineerを指導し、ea/統合システムを完遂してください ===\" && cat \"MVPシステム設計.md\" | grep -A 30 \"WebSocket通信設計\" ultrathink' Enter

6. Frontend Directorに戦略指示:
tmux send-keys -t arbitrage-assistant:4.0 'echo \"HACONIWA_AGENT_ID: \\\$HACONIWA_AGENT_ID\" && cat arbitrage-assistant.yaml | grep -A 15 \"frontend-director\" && echo \"=== CEO戦略指示: 管理画面・デスクトップUI・ユーザー体験を統括。React Specialist・Desktop App Engineerを指導し、apps/admin・apps/hedge-system UI実装を完遂してください ===\" && cat \"MVPシステム設計.md\" | grep -A 30 \"管理者画面\" ultrathink' Enter

7. DevOps Directorに戦略指示:
tmux send-keys -t arbitrage-assistant:5.0 'echo \"HACONIWA_AGENT_ID: \\\$HACONIWA_AGENT_ID\" && cat arbitrage-assistant.yaml | grep -A 15 \"devops-director\" && echo \"=== CEO戦略指示: インフラ最適化・品質保証・CI/CD・監視を統括。Build Optimization・Quality Assurance Engineerを指導し、Turborepo最適化を完遂してください ===\" && cat \"MVPシステム設計.md\" | grep -A 30 \"パフォーマンス最適化\" ultrathink' Enter

CEO戦略判断に基づき、上記tmuxコマンドで階層的指示を実行してください。各Directorは部下のSpecialistエージェントを管理・指導する責任があります。" ultrathink
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


# 既存セッションの安全な処理（並列クリーンアップ・認証状態保持）
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "🔄 既存セッションを並列クリーンアップ中..."
    
    # 各ペインでClaudeを並列で正常終了（認証状態保持・入力バッファクリア）
    panes=($(tmux list-panes -t $SESSION_NAME -a -F "#{window_index}.#{pane_index}" 2>/dev/null || true))
    
    # 並列でクリーンアップ処理
    for pane in "${panes[@]}"; do
        {
            echo "  Pane $pane: Claude Code正常終了・バッファクリア中..."
            # Ctrl+Cを複数回送信して確実に終了
            tmux send-keys -t $SESSION_NAME:$pane C-c 2>/dev/null || true
            sleep 0.2
            tmux send-keys -t $SESSION_NAME:$pane C-c 2>/dev/null || true
            sleep 0.1
            # 入力バッファをクリア（次回起動時のデータ残留防止）
            tmux send-keys -t $SESSION_NAME:$pane C-u 2>/dev/null || true
            sleep 0.1
            tmux send-keys -t $SESSION_NAME:$pane "" Enter 2>/dev/null || true
            sleep 0.1
            echo "  ✅ Pane $pane: クリーンアップ完了"
        } &
    done
    
    echo "⏳ 並列クリーンアップ完了待機中..."
    wait  # 全並列クリーンアップ完了まで待機
    
    # Claude設定保存のための短縮待機（並列化により高速化）
    echo "⏳ Claude Code設定・認証状態保存のため3秒待機..."
    sleep 3
    
    # セッション削除
    tmux kill-session -t $SESSION_NAME
    
    # 認証状態安定化のための短縮待機
    sleep 1
    
    # 古い環境変数ファイルをクリーンアップ（Claude認証情報は保持）
    echo "🧹 古い環境変数ファイルをクリーンアップ中..."
    # 注意: Claude認証情報は ~/.claude に保存されているため、/tmpファイルのみクリーンアップ
    rm -f /tmp/haconiwa_env_*.sh 2>/dev/null || true
    echo "✅ 並列クリーンアップ完了（Claude認証情報は保持）"
fi

# 新規セッション作成（デタッチド状態）
echo "🏗️ 新規tmuxセッション作成中..."
tmux new-session -d -s $SESSION_NAME -c "$BASE_DIR" -n "🏛️CEO-Strategy"

# base-index設定の強制適用
echo "🔧 base-index 0設定適用中..."
tmux set-option -t $SESSION_NAME base-index 0
tmux set-window-option -t $SESSION_NAME pane-base-index 0

# 新規セッション安定化のための待機
sleep 1

# ===========================================
# 全ペイン構成作成（6窓 x 3ペイン = 18ペイン）
# ===========================================

# モード別の起動関数選択
if [ "$PARALLEL_MODE" = "sequential" ]; then
    echo "🔄 順次起動モード（安全・確実）で開始..."
    START_FUNC="start_agent"
else
    echo "⚡ 並列起動モード（$PARALLEL_MODE）で開始..."
    START_FUNC="start_agent_parallel"
    
    # 並列実行設定
    case "$PARALLEL_MODE" in
        "parallel_safe") 
            BATCH_SIZE=3
            BATCH_DELAY=0.2
            ;;
        "parallel_fast") 
            BATCH_SIZE=6
            BATCH_DELAY=0.1
            ;;
    esac
    echo "  📊 並列度: $BATCH_SIZE, バッチ遅延: ${BATCH_DELAY}秒"
fi

echo "🏗️ ペイン構成作成中..."

# Window 0: 🏛️ CEO Executive Office (3 panes)
echo "📋 Window 0: CEO Executive Office 作成中..."
# Pane 0.1: Director Coordinator (右に分割)
tmux split-window -t $SESSION_NAME:0.0 -h
sleep 0.2
# Pane 0.2: Progress Monitor (左ペインを上下に分割)
tmux select-pane -t $SESSION_NAME:0.0
tmux split-window -t $SESSION_NAME:0.0 -v

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
    "0.0|ceo-main|CEO Main (ceo-main) - MVP全体戦略の意思決定・5 Directors指示|$BASE_DIR"
    "0.1|director-coordinator|Director Coordinator (director-coordinator) - 5 Directors間連携調整・クロスチーム課題解決|$BASE_DIR"
    "0.2|progress-monitor|Progress Monitor (progress-monitor) - MVPプロジェクト進捗管理・Directors間調整・リリース準備確認|$BASE_DIR"
    "1.0|backend-director|Backend Director (backend-director) - AWS Amplify Gen2 + GraphQL + userIdベース最適化専門|$BASE_DIR"
    "1.1|amplify-gen2-specialist|Amplify Gen2 Specialist (amplify-gen2-specialist) - AWS Amplify Gen2 data/resource.ts設計・GraphQL実装|$BASE_DIR/packages/shared-backend"
    "1.2|cognito-auth-expert|Cognito Authentication Expert (cognito-auth-expert) - Amazon Cognito認証システム統合・JWT管理|$BASE_DIR"
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

if [ "$PARALLEL_MODE" = "sequential" ]; then
    # 順次起動モード
    echo "🔄 順次起動実行中..."
    for agent_def in "${AGENTS[@]}"; do
        IFS='|' read -r pane agent_id description work_dir <<< "$agent_def"
        start_agent "$pane" "$agent_id" "$description" "$work_dir"
    done
else
    # 並列起動モード
    echo "⚡ 並列起動実行中..."
    batch_count=0
    for agent_def in "${AGENTS[@]}"; do
        IFS='|' read -r pane agent_id description work_dir <<< "$agent_def"
        
        # バッチ遅延計算
        delay=$(echo "$batch_count * $BATCH_DELAY" | bc -l 2>/dev/null || echo "0")
        
        start_agent_parallel "$pane" "$agent_id" "$description" "$work_dir" "$delay"
        
        batch_count=$((batch_count + 1))
        
        # バッチサイズに達したら待機
        if [ $((batch_count % BATCH_SIZE)) -eq 0 ]; then
            echo "  ⏳ バッチ $((batch_count / BATCH_SIZE)) 完了、次バッチまで待機..."
            sleep 1
        fi
    done
    
    echo "⏳ 全並列エージェント起動完了待機中..."
    wait  # 全バックグラウンドジョブ完了まで待機
fi

# 動的Claude起動確認（超高速化：3秒サイクル）
echo "⏳ Claude Code起動確認中..."
total_panes=$(tmux list-panes -t $SESSION_NAME -a | wc -l | tr -d ' ')
monitoring_cycles=10  # 3秒 x 10回 = 30秒最大監視
current_cycle=0

while [ $current_cycle -lt $monitoring_cycles ]; do
    claude_panes=$(tmux list-panes -t $SESSION_NAME -a -F "#{pane_current_command}" | grep -c "node" || echo "0")
    elapsed=$((current_cycle * 3))
    
    if [ "$claude_panes" -eq "$total_panes" ]; then
        echo "✅ 全${total_panes}ペインでClaude起動完了！（${elapsed}秒）"
        
        # 🎭 各ペインに役割確認コマンドを予め入力
        echo "🎭 各ペインに役割確認コマンドを予め入力中..."
        
        # 全エージェントに対して役割確認コマンドを予め入力
        for agent_def in "${AGENTS[@]}"; do
            IFS='|' read -r pane agent_id description work_dir <<< "$agent_def"
            
            # ペイン存在確認してから予め入力
            if tmux list-panes -t "$SESSION_NAME:$pane" >/dev/null 2>&1; then
                echo "  🎯 Pane $pane ($agent_id): 役割確認コマンド予め入力..."
                
                # 役割確認コマンドを予め入力（Enterは押さない）
                tmux send-keys -t "$SESSION_NAME:$pane" "./scripts/role && echo '🎯 役割確認完了'"
                
                sleep 0.05  # 高速処理
            fi
        done
        
        echo "✅ 全ペインに役割確認コマンド予め入力完了！"
        echo "📋 指示出し時は既存入力の下に追加され、実行時は役割確認→指示実行の順序で処理されます。"
        
        break
    fi
    
    echo "🔄 ${claude_panes}/${total_panes}ペイン起動済み... (Cycle $((current_cycle + 1))/${monitoring_cycles})"
    
    # 3秒後に未起動ペインがあれば即座復旧開始
    if [ $current_cycle -eq 0 ] && [ "$claude_panes" -lt "$total_panes" ]; then
        echo "🚨 3秒経過：未起動ペイン検出 → 即座復旧開始"
        # 即座復旧ロジックをここで実行
        perform_immediate_recovery
    fi
    
    sleep 3
    current_cycle=$((current_cycle + 1))
done

if [ "$claude_panes" -ne "$total_panes" ]; then
    echo "⚠️  起動タイムアウト: ${claude_panes}/${total_panes}ペインで起動完了"
    echo "🔧 未起動ペインの自動復旧を開始..."
    
    # 未起動ペインを特定してリストアップ
    failed_panes=()
    while IFS= read -r line; do
        if [[ $line =~ ^[[:space:]]*([0-9]+\.[0-9]+): ]]; then
            pane_id="${BASH_REMATCH[1]}"
            failed_panes+=("$pane_id")
        fi
    done < <(tmux list-panes -t $SESSION_NAME -a -F "  #{window_index}.#{pane_index}: #{pane_current_command}" | grep -v "node")
    
    echo "📋 復旧対象ペイン: ${failed_panes[@]}"
    
    # 各未起動ペインに個別復旧処理
    for pane in "${failed_panes[@]}"; do
        echo "🚀 Pane $pane 復旧中..."
        
        # 環境変数再設定 + Claude起動
        case $pane in
            "0.0") agent_id="ceo-main" ;;
            "0.1") agent_id="director-coordinator" ;;
            "0.2") agent_id="progress-monitor" ;;
            "1.0") agent_id="backend-director" ;;
            "1.1") agent_id="amplify-gen2-specialist" ;;
            "1.2") agent_id="cognito-auth-expert" ;;
            "2.0") agent_id="trading-flow-director" ;;
            "2.1") agent_id="entry-flow-specialist" ;;
            "2.2") agent_id="settlement-flow-specialist" ;;
            "3.0") agent_id="integration-director" ;;
            "3.1") agent_id="mt5-connector-specialist" ;;
            "3.2") agent_id="websocket-engineer" ;;
            "4.0") agent_id="frontend-director" ;;
            "4.1") agent_id="react-specialist" ;;
            "4.2") agent_id="desktop-app-engineer" ;;
            "5.0") agent_id="devops-director" ;;
            "5.1") agent_id="build-optimization-engineer" ;;
            "5.2") agent_id="quality-assurance-engineer" ;;
            *) agent_id="unknown" ;;
        esac
        
        # クリーンな復旧処理実行（入力バッファクリア対応）
        echo "  🧹 Pane $pane: 既存プロセス終了・バッファクリア..."
        tmux send-keys -t "$SESSION_NAME:$pane" C-c 2>/dev/null || true
        sleep 0.3
        tmux send-keys -t "$SESSION_NAME:$pane" C-c 2>/dev/null || true
        sleep 0.2
        tmux send-keys -t "$SESSION_NAME:$pane" C-u 2>/dev/null || true
        sleep 0.1
        tmux send-keys -t "$SESSION_NAME:$pane" "" Enter 2>/dev/null || true
        sleep 0.1
        tmux send-keys -t "$SESSION_NAME:$pane" "clear" Enter 2>/dev/null || true
        sleep 0.3
        
        echo "  ⚙️ Pane $pane: 環境変数設定..."
        tmux set-environment -t "$SESSION_NAME:$pane" HACONIWA_AGENT_ID "$agent_id"
        echo 'export HACONIWA_AGENT_ID="'$agent_id'"' > /tmp/haconiwa_env_$pane.sh
        
        echo "  🚀 Pane $pane: Claude起動..."
        tmux send-keys -t "$SESSION_NAME:$pane" "export HACONIWA_AGENT_ID='$agent_id'" Enter
        sleep 0.2
        tmux send-keys -t "$SESSION_NAME:$pane" "source /tmp/haconiwa_env_$pane.sh" Enter
        sleep 0.2
        tmux send-keys -t "$SESSION_NAME:$pane" "claude --dangerously-skip-permissions" Enter
        sleep 1
    done
    
    # 復旧後の最終確認（3秒サイクル x 5回 = 15秒）
    echo "⏳ 復旧後の最終確認中..."
    recovery_cycles=5
    recovery_cycle=0
    
    while [ $recovery_cycle -lt $recovery_cycles ]; do
        claude_panes_final=$(tmux list-panes -t $SESSION_NAME -a -F "#{pane_current_command}" | grep -c "node" || echo "0")
        
        if [ "$claude_panes_final" -eq "$total_panes" ]; then
            echo "✅ 復旧完了！全${total_panes}ペインでClaude起動成功"
            break
        fi
        
        echo "🔄 復旧確認中... ${claude_panes_final}/${total_panes} (Cycle $((recovery_cycle + 1))/${recovery_cycles})"
        sleep 3
        recovery_cycle=$((recovery_cycle + 1))
    done
    
    # 最終的な失敗報告
    if [ "$claude_panes_final" -ne "$total_panes" ]; then
        echo "❌ 復旧失敗: ${claude_panes_final}/${total_panes}ペインで起動完了"
        echo "📋 復旧失敗ペイン一覧:"
        tmux list-panes -t $SESSION_NAME -a -F "  #{window_index}.#{pane_index}: #{pane_current_command}" | grep -v "node"
        echo ""
        echo "🔧 手動復旧コマンド例:"
        echo "  tmux send-keys -t arbitrage-assistant:X.Y 'claude --dangerously-skip-permissions' Enter"
    fi
fi

# 環境変数設定確認（高速化）
echo "🔍 環境変数設定確認中..."

# 環境変数ファイル存在確認（高速化）
env_files_success=0
for window in 0 1 2 3 4 5; do
    for pane in 0 1 2; do
        if [ -f "/tmp/haconiwa_env_$window.$pane.sh" ]; then
            ((env_files_success++))
        fi
    done
done

if [ "$env_files_success" -eq 18 ]; then
    echo "✅ 全18ペインで環境変数ファイル作成完了！"
else
    echo "⚠️  ${env_files_success}/18ペインで環境変数ファイル作成済み"
    echo "🔧 詳細確認: npm run haconiwa:debug"
fi

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
# 🎯 CEO戦略的指示システム（改善版）
# ===========================================
echo "🎯 CEO戦略的指示システム完全自動化："
echo "  1. CEO初期設定用プロンプト自動入力"
echo "  2. CEO系エージェント自動指示"
echo "  3. 全Directors自動指示実行"
echo ""
echo "🏛️ CEO系エージェント自動指示開始..."
sleep 3

# CEO Main (0.0) への役割確認プロンプト送信
echo "🎯 CEO Main (0.0) への初期プロンプト送信中..."
if send_instruction_to_pane "0.0" "$(generate_ceo_main_prompt)"; then
    echo "✅ CEO初期プロンプト送信完了"
else
    echo "⚠️  CEO初期プロンプト送信に問題が発生（継続実行）"
fi

echo ""
echo "✅ CEO階層的指示システム完了！"
echo "📋 CEO Main (0.0) にのみ初期プロンプトを送信しました"
echo "🎯 以降の指示はCEOが階層的に実行します"

echo ""
echo "💡 次回終了時は: npm run haconiwa:stop を使用してください"
echo "🎯 全ペインでHACONIWA_AGENT_ID設定済み（役割認識完了）"
echo ""
echo "🎯 階層的命令系統による起動完了！"
echo ""
echo "✅ 実行された内容:"
echo "  1. 完全自動クリーンアップ"
echo "  2. 6x3 Grid構成（18エージェント）起動"
echo "  3. 全ペイン環境変数設定"
echo "  4. CEO Main (0.0) への戦略プロンプト送信"
echo ""
echo "🏛️ 階層的命令フロー:"
echo "  🎯 CEO Main (0.0) - 戦略プロンプト受信済み"
echo "  📋 CEOが以下エージェントに指示を出します:"
echo "    ├─ Director Coordinator (0.1) - Directors間連携調整"
echo "    ├─ Progress Monitor (0.2) - MVP進捗監視" 
echo "    ├─ Backend Director (1.0) - AWS Amplify実装統括"
echo "    ├─ Trading Director (2.0) - Position-Trail-Action統括"
echo "    ├─ Integration Director (3.0) - MT5統合統括"
echo "    ├─ Frontend Director (4.0) - 管理画面統括"
echo "    └─ DevOps Director (5.0) - Turborepo最適化統括"
echo ""
echo "⚡ CEOによる階層的指示システムが稼働中！"
echo "🎯 各DirectorがSpecialistエージェントを管理・指導します"