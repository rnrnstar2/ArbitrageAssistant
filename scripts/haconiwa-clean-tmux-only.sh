#!/bin/bash

# Haconiwa TMUX内Claudeプロセスのみクリーンアップスクリプト
# ローカルで開いているClaude Codeは保持して、TMUX内のプロセスのみクリーンアップ

SESSION_NAME="arbitrage-assistant"

echo "🧹 Haconiwa TMUX内Claudeプロセスのみクリーンアップ"
echo "=============================================="

echo "🔍 現在の状況確認..."

# 全Claudeプロセス確認
all_claude_processes=$(ps aux | grep -v grep | grep claude | wc -l | tr -d ' ')
echo "📊 全Claudeプロセス数: $all_claude_processes"

# tmuxセッション確認
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "📊 tmuxセッション: 実行中"
    
    # TMUX内のClaudeプロセス取得（TTYベース - 最も確実な方法）
    echo "🔍 TMUX内のClaudeプロセス確認中（TTYベース識別）..."
    
    # TMUXで使用されているTTY名を取得
    tmux_ttys=$(tmux list-panes -t $SESSION_NAME -a -F "#{pane_tty}" 2>/dev/null | sort | uniq)
    
    tmux_claude_pids=""
    tmux_claude_count=0
    
    if [ -n "$tmux_ttys" ]; then
        echo "📋 TMUX使用TTY一覧:"
        echo "$tmux_ttys" | sed 's/^/  /'
        
        # TTYベースでClaudeプロセスを検索
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
    else
        echo "⚠️  TMUXペインのTTY情報を取得できませんでした"
    fi
    
    echo "📊 TMUX内Claudeプロセス数: $tmux_claude_count"
    if [ $tmux_claude_count -gt 0 ]; then
        echo "📋 対象PID: $tmux_claude_pids"
    fi
else
    echo "📊 tmuxセッション: 停止中"
    tmux_claude_count=0
fi

# ローカルClaudeプロセス数計算
local_claude_count=$((all_claude_processes - tmux_claude_count))
echo "📊 ローカルClaudeプロセス数（保持対象）: $local_claude_count"

echo ""
echo "🚨 TMUX内Claudeプロセスのみクリーンアップを実行しますか？"
echo "  - TMUX内Claudeプロセス終了: $tmux_claude_count 個"
echo "  - ローカルClaudeプロセス保持: $local_claude_count 個"
echo "  - tmuxセッション削除"
echo "  - 環境変数ファイル削除"
echo "  - その後にHaconiwa起動"
echo ""
echo "実行しますか？ [y/N]"
read -r response

if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "❌ キャンセルされました"
    exit 0
fi

echo ""
echo "🧹 TMUX内プロセスクリーンアップ開始..."

# Step 1: TMUX内Claudeプロセスのみ終了
echo "🔥 TMUX内Claudeプロセス終了中..."
if [ $tmux_claude_count -gt 0 ]; then
    for pid in $tmux_claude_pids; do
        if ps -p $pid > /dev/null 2>&1; then
            echo "🎯 PID $pid を終了中..."
            kill $pid 2>/dev/null || true
        fi
    done
    sleep 3
    
    # 終了確認
    remaining_count=0
    for pid in $tmux_claude_pids; do
        if ps -p $pid > /dev/null 2>&1; then
            remaining_count=$((remaining_count + 1))
        fi
    done
    
    if [ $remaining_count -eq 0 ]; then
        echo "✅ TMUX内Claudeプロセス終了完了"
    else
        echo "⚠️  $remaining_count 個のプロセスが残存（強制終了実行）"
        for pid in $tmux_claude_pids; do
            if ps -p $pid > /dev/null 2>&1; then
                kill -9 $pid 2>/dev/null || true
            fi
        done
        sleep 1
        echo "✅ 強制終了完了"
    fi
else
    echo "✅ TMUX内Claudeプロセスなし（既にクリーン）"
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
env_files=$(ls -1 /tmp/haconiwa_env_*.sh 2>/dev/null | wc -l | tr -d ' ')
if [ "$env_files" -gt 0 ]; then
    rm -f /tmp/haconiwa_env_*.sh
    echo "✅ 環境変数ファイル削除完了（$env_files 個削除）"
else
    echo "✅ 環境変数ファイルなし（既にクリーン）"
fi

# Step 4: TMUX関連一時ファイルのみクリーンアップ
echo "🔥 TMUX関連一時ファイルクリーンアップ中..."
rm -f /tmp/haconiwa-* 2>/dev/null || true
echo "✅ TMUX関連一時ファイルクリーンアップ完了"

echo ""
echo "✅ TMUX内プロセスクリーンアップ完了！"

# 最終確認
remaining_all=$(ps aux | grep -v grep | grep claude | wc -l | tr -d ' ')
echo "📊 残存Claudeプロセス数: $remaining_all （ローカル保持分）"

echo ""
echo "🚀 Haconiwa起動中..."
sleep 2

# Haconiwa起動
exec "$(dirname "$0")/haconiwa-start.sh"