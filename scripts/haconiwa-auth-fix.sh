#!/bin/bash

# Haconiwa Claude認証問題解決スクリプト
# 認証競合・認証ループ問題の完全解決

echo "🔧 Haconiwa Claude認証問題解決ツール"
echo "======================================"

# Claude設定ディレクトリ確認
CLAUDE_CONFIG_DIR="$HOME/.claude"
if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    echo "❌ Claude設定ディレクトリが見つかりません: $CLAUDE_CONFIG_DIR"
    echo "💡 Claude初期設定を実行してください: claude auth login"
    exit 1
fi

echo "✅ Claude設定ディレクトリ確認: $CLAUDE_CONFIG_DIR"

# 現在のClaude プロセス状況確認
echo ""
echo "🔍 現在のClaude プロセス状況:"
claude_processes=$(ps aux | grep -v grep | grep claude || echo "")
if [ -z "$claude_processes" ]; then
    echo "✅ Claude プロセスなし（クリーンな状態）"
else
    echo "$claude_processes"
    process_count=$(echo "$claude_processes" | wc -l | tr -d ' ')
    echo "📊 Claude プロセス数: $process_count"
    
    if [ "$process_count" -gt 3 ]; then
        echo ""
        echo "⚠️  過多なClaude プロセスが認証競合を引き起こしている可能性があります"
        echo "🔧 不要なプロセスを終了しますか？ [y/N]"
        read -r cleanup_response
        if [[ "$cleanup_response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            echo "🧹 Claude プロセスクリーンアップ中..."
            pkill -f claude
            sleep 3
            echo "✅ プロセスクリーンアップ完了"
        fi
    fi
fi

# tmuxセッション確認
echo ""
echo "🔍 tmuxセッション確認:"
if tmux has-session -t arbitrage-assistant 2>/dev/null; then
    echo "✅ arbitrage-assistant セッション実行中"
    
    # セッション内のClaude状況確認
    claude_in_tmux=$(tmux list-panes -t arbitrage-assistant -a -F "#{pane_current_command}" | grep -c "node" || echo "0")
    total_panes=$(tmux list-panes -t arbitrage-assistant -a | wc -l | tr -d ' ')
    echo "📊 tmux内Claude実行状況: $claude_in_tmux / $total_panes"
    
    if [ "$claude_in_tmux" -lt "$total_panes" ]; then
        echo "⚠️  一部のペインでClaude未起動"
        echo "🔧 認証問題による起動失敗の可能性があります"
    fi
else
    echo "ℹ️  arbitrage-assistant セッション未実行"
fi

# 認証状態テスト
echo ""
echo "🔍 Claude認証状態テスト中..."
echo "  （このテストは10秒でタイムアウトします）"

# macOS用のtimeout実装
timeout_test() {
    local cmd="$1"
    local timeout_duration="$2"
    
    # バックグラウンドでコマンド実行
    eval "$cmd" &
    local cmd_pid=$!
    
    # タイムアウト監視
    local count=0
    while [ $count -lt $timeout_duration ]; do
        if ! kill -0 $cmd_pid 2>/dev/null; then
            # プロセス完了
            wait $cmd_pid
            return $?
        fi
        sleep 1
        count=$((count + 1))
    done
    
    # タイムアウト：プロセス強制終了
    kill $cmd_pid 2>/dev/null
    echo "⏰ タイムアウト（${timeout_duration}秒）"
    return 124
}

if timeout_test "claude --version" 10; then
    echo "✅ Claude認証正常"
else
    echo "❌ Claude認証に問題があります"
    echo ""
    echo "🔧 推奨解決策:"
    echo "  1. Claude再認証: claude auth login"
    echo "  2. 設定リセット: rm -rf ~/.claude && claude auth login"
    echo "  3. プロセス完全クリーンアップ後に再認証"
    echo ""
    echo "🚨 認証修復を実行しますか？ [y/N]"
    read -r auth_fix_response
    if [[ "$auth_fix_response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "🔧 Claude認証修復中..."
        
        # 全Claudeプロセス停止
        pkill -f claude
        sleep 2
        
        # 認証状態リセット（慎重に）
        echo "⚠️  既存の認証設定をバックアップしますか？ [Y/n]"
        read -r backup_response
        if [[ ! "$backup_response" =~ ^([nN][oO]|[nN])$ ]]; then
            cp -r "$CLAUDE_CONFIG_DIR" "$CLAUDE_CONFIG_DIR.backup.$(date +%Y%m%d_%H%M%S)"
            echo "✅ 設定バックアップ完了"
        fi
        
        echo "🔄 Claude認証リセット中..."
        # 認証ファイルの一時的な退避
        if [ -d "$CLAUDE_CONFIG_DIR" ]; then
            mv "$CLAUDE_CONFIG_DIR" "$CLAUDE_CONFIG_DIR.temp"
        fi
        
        echo ""
        echo "🎯 Claude再認証を実行してください:"
        echo "   claude auth login"
        echo ""
        echo "認証完了後、以下を実行:"
        echo "   npm run haconiwa:start"
        
        exit 0
    fi
fi

echo ""
echo "📋 Haconiwa認証最適化完了"
echo "💡 認証問題が解決されていない場合:"
echo "  1. claude auth logout && claude auth login"
echo "  2. 全tmuxセッション終了後にHaconiwa再起動"
echo "  3. 本スクリプトを再実行"