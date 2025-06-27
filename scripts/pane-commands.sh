#!/bin/bash

# Haconiwaペイン内で使える便利コマンド集
# ペイン内で直接実行できるCEO・Director機能

# 現在のペインIDを取得
get_current_pane() {
    echo "$TMUX_PANE" | sed 's/%//' 2>/dev/null || echo "unknown"
}

# 現在の役割を取得
get_current_role() {
    if [ -n "$HACONIWA_AGENT_ID" ]; then
        echo "$HACONIWA_AGENT_ID"
    else
        local pane_id=$(get_current_pane)
        case "$pane_id" in
            "0") echo "ceo-main" ;;
            "1") echo "director-coordinator" ;;
            "2") echo "progress-monitor" ;;
            "3") echo "backend-director" ;;
            "4") echo "cognito-auth-expert" ;;
            "5") echo "amplify-gen2-specialist" ;;
            *) echo "unknown" ;;
        esac
    fi
}

# ペイン内CEO戦略実行
ceo_strategic_in_pane() {
    echo "🏛️ ペイン内CEO戦略実行開始..."
    echo ""
    
    local current_role=$(get_current_role)
    if [[ "$current_role" =~ ceo ]] || [[ "$current_role" == "ceo-main" ]]; then
        echo "✅ CEO権限確認済み"
    else
        echo "⚠️ 注意: 非CEO ペインからの実行（$current_role）"
    fi
    
    # 戦略分析・指示実行
    cd /Users/rnrnstar/github/ArbitrageAssistant
    ./scripts/simple-directive-system.sh ceo-strategic
    
    echo ""
    echo "✅ ペイン内CEO戦略実行完了"
}

# ペイン内Director指示
director_command_in_pane() {
    local director_id="$1"
    local instruction="$2"
    
    if [ $# -lt 2 ]; then
        echo "使用法: director_command_in_pane [director-id] \"[instruction]\""
        echo "例: director_command_in_pane backend-director \"AWS Amplify基盤構築\""
        return 1
    fi
    
    echo "🎯 ペイン内Director指示送信..."
    echo "📋 対象: $director_id"
    echo "📋 指示: $instruction"
    echo ""
    
    cd /Users/rnrnstar/github/ArbitrageAssistant
    ./scripts/simple-directive-system.sh director "$director_id" "$instruction"
    
    echo "✅ ペイン内Director指示完了"
}

# ペイン内進捗確認
progress_check_in_pane() {
    echo "📊 ペイン内進捗確認..."
    echo ""
    
    cd /Users/rnrnstar/github/ArbitrageAssistant
    
    # Tasks Directory確認
    echo "📁 Tasks Directory状況:"
    find tasks/directors -name "task-*.md" 2>/dev/null | wc -l | sed 's/^/  進行中タスク: /' && echo "件"
    
    # 最新タスク確認
    echo ""
    echo "📋 最新タスク:"
    find tasks/directors -name "task-*.md" -print0 2>/dev/null | xargs -0 ls -t | head -3 | while read file; do
        echo "  • $(basename "$file")"
    done
    
    # 簡易監視
    echo ""
    echo "📊 システム状況:"
    if tmux list-sessions | grep -q arbitrage-assistant; then
        echo "  ✅ Haconiwaセッション稼働中"
        local active_panes=$(tmux list-panes -t arbitrage-assistant -a | wc -l)
        echo "  📊 アクティブペイン: ${active_panes}/18"
    else
        echo "  ❌ Haconiwaセッション未稼働"
    fi
    
    echo ""
    echo "✅ ペイン内進捗確認完了"
}

# ペイン内全体通知
broadcast_in_pane() {
    local message="$1"
    
    if [ $# -lt 1 ]; then
        echo "使用法: broadcast_in_pane \"[message]\""
        echo "例: broadcast_in_pane \"システム更新完了\""
        return 1
    fi
    
    echo "📢 ペイン内全体通知送信..."
    echo "📋 メッセージ: $message"
    echo ""
    
    cd /Users/rnrnstar/github/ArbitrageAssistant
    ./scripts/simple-directive-system.sh broadcast "$message"
    
    echo "✅ ペイン内全体通知完了"
}

# ペイン内役割確認・復旧
role_check_and_restore() {
    echo "🎭 ペイン内役割確認・復旧..."
    echo ""
    
    local current_role=$(get_current_role)
    local pane_id=$(get_current_pane)
    
    echo "📊 現在の状況:"
    echo "  • ペインID: $pane_id"
    echo "  • 役割: $current_role"
    echo "  • 環境変数: ${HACONIWA_AGENT_ID:-'未設定'}"
    echo ""
    
    # 役割に応じた復旧
    case "$current_role" in
        "ceo-main"|"ceo-supreme")
            echo "👑 CEO Supreme機能復旧中..."
            echo "利用可能なコマンド:"
            echo "  • ceo_strategic_in_pane          # 戦略実行"
            echo "  • director_command_in_pane [id] \"[task]\"  # Director指示"
            echo "  • progress_check_in_pane         # 進捗確認"
            echo "  • broadcast_in_pane \"[msg]\"      # 全体通知"
            ;;
        "director-coordinator"|"ceo-operations")
            echo "⚙️ CEO Operations機能復旧中..."
            echo "利用可能なコマンド:"
            echo "  • progress_check_in_pane         # 進捗確認"
            echo "  • director_command_in_pane [id] \"[coordination]\"  # 調整指示"
            ;;
        "progress-monitor"|"ceo-analytics")
            echo "📊 CEO Analytics機能復旧中..."
            echo "利用可能なコマンド:"
            echo "  • progress_check_in_pane         # 進捗分析"
            echo "  • npm run lint                   # 品質確認"
            echo "  • npm run type-check             # 型チェック"
            ;;
        *)
            echo "🤖 General Agent機能復旧中..."
            echo "利用可能なコマンド:"
            echo "  • progress_check_in_pane         # 進捗確認"
            echo "  • ./scripts/role                 # 役割確認"
            ;;
    esac
    
    echo ""
    echo "✅ ペイン内役割確認・復旧完了"
}

# ペイン内クイックヘルプ
pane_help() {
    echo "🎯 Haconiwaペイン内コマンド一覧"
    echo "================================"
    echo ""
    echo "🏛️ CEO系コマンド:"
    echo "  ceo_strategic_in_pane                    # CEO戦略実行"
    echo "  director_command_in_pane [id] \"[task]\"   # Director指示"
    echo "  progress_check_in_pane                   # 進捗確認"
    echo "  broadcast_in_pane \"[message]\"            # 全体通知"
    echo ""
    echo "🔧 ユーティリティ:"
    echo "  role_check_and_restore                   # 役割確認・復旧"
    echo "  pane_help                                # このヘルプ"
    echo ""
    echo "🚀 リフレッシュ後の復旧:"
    echo "  1. role_check_and_restore  # 役割復旧"
    echo "  2. ceo_strategic_in_pane   # CEO戦略再開（CEO系ペインのみ）"
    echo ""
    echo "💡 基本ワークフロー:"
    echo "  haconiwa:start → role_check_and_restore → ceo_strategic_in_pane"
    echo "  コンテキスト重い → haconiwa:refresh → role_check_and_restore → ceo_strategic_in_pane"
}

# メイン処理
case "${1:-help}" in
    "ceo-strategic")
        ceo_strategic_in_pane
        ;;
    "director")
        director_command_in_pane "$2" "$3"
        ;;
    "progress")
        progress_check_in_pane
        ;;
    "broadcast")
        broadcast_in_pane "$2"
        ;;
    "role")
        role_check_and_restore
        ;;
    "help"|*)
        pane_help
        ;;
esac