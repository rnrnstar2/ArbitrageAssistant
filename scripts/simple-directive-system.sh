#!/bin/bash

# シンプル指示システム（一方向通信版）
# 双方向通信タイムアウト問題を解決するシンプル版

SESSION_NAME="arbitrage-assistant"

# 使用法表示
show_usage() {
    echo "🎯 シンプル指示システム（一方向通信版）"
    echo ""
    echo "使用法:"
    echo "  $0 ceo-to-all              # CEO → 全Director一斉指示"
    echo "  $0 ceo-strategic           # CEO戦略的分析・選択指示"
    echo "  $0 director [id] [task]    # 特定Director指示"
    echo "  $0 broadcast [msg]         # 全エージェント通知"
    echo ""
    echo "例:"
    echo "  $0 ceo-strategic"
    echo "  $0 director backend-director 'AWS Amplify基盤構築'"
    echo "  $0 broadcast 'システム更新完了'"
}

# CEO戦略的分析・選択指示（v3.0簡易版）
ceo_strategic_directive() {
    echo "🏛️ CEO戦略的分析・選択指示実行..."
    echo ""
    
    # Backend実装評価
    if [ -f "packages/shared-backend/amplify/data/resource.ts" ]; then
        MODELS_CHECK=$(grep -E "(User|Account|Position|Action)" packages/shared-backend/amplify/data/resource.ts 2>/dev/null | wc -l)
        UNNECESSARY_MODELS=$(grep -E "(Performance|Analytics|Metrics)" packages/shared-backend/amplify/data/resource.ts 2>/dev/null | wc -l)
        
        if [ $UNNECESSARY_MODELS -gt 0 ]; then
            echo "🗄️ Backend: クリーンアップ必要（不要モデル検出）"
            BACKEND_ACTION="CLEANUP"
        elif [ $MODELS_CHECK -ge 4 ]; then
            echo "🛡️ Backend: 実装保護（完成済み）"
            BACKEND_ACTION="PROTECT"
        else
            echo "🚨 Backend: 実装必要"
            BACKEND_ACTION="IMPLEMENT"
        fi
    else
        echo "❌ Backend: 未実装"
        BACKEND_ACTION="IMPLEMENT"
    fi
    
    # Trading実装評価
    TRADING_FILES=$(find apps/hedge-system -name "*arbitrage*" -o -name "*position*" 2>/dev/null | wc -l)
    if [ $TRADING_FILES -gt 2 ]; then
        echo "🛡️ Trading: 実装保護（完成済み）"
        TRADING_ACTION="PROTECT"
    else
        echo "🚨 Trading: 実装必要"
        TRADING_ACTION="IMPLEMENT"
    fi
    
    echo ""
    echo "🚀 CEO選択的指示実行..."
    
    # Backend選択的指示
    if [ "$BACKEND_ACTION" = "IMPLEMENT" ]; then
        echo "📤 Backend Director指示送信..."
        send_directive_simple backend-director "【CEO戦略指示】AWS Amplify基盤の構築をDirectorチームにお任せします。MVPシステム設計.mdに記載のUser/Account/Position/Actionモデルを中心とした、必要最小限のバックエンド基盤を構築してください。"
    elif [ "$BACKEND_ACTION" = "CLEANUP" ]; then
        echo "📤 Backend Directorクリーンアップ指示送信..."
        send_directive_simple backend-director "【CEOクリーンアップ指示】Backend基盤に不要な実装が含まれています。MVPシステム設計.mdに記載の必須モデルのみ残し、余計な機能は削除してください。"
    else
        echo "🛡️ Backend: 保護対象（指示スキップ）"
    fi
    
    # Trading選択的指示
    if [ "$TRADING_ACTION" = "IMPLEMENT" ]; then
        echo "📤 Trading Director指示送信..."
        send_directive_simple trading-flow-director "【CEO戦略指示】Position-Trail-Actionの核心フロー実装をDirectorチームにお任せします。MVPシステム設計.mdのフローを実現し、リスク管理を重視してください。"
    else
        echo "🛡️ Trading: 保護対象（指示スキップ）"
    fi
    
    echo ""
    echo "✅ CEO戦略的指示実行完了"
}

# CEO → 全Director一斉指示
ceo_to_all_directors() {
    echo "🏛️ CEO → 全Director一斉指示実行..."
    
    local ceo_message="【CEO全体指示】MVPシステム設計.mdに基づく戦略的実装を開始してください。各Directorチームは自分の専門領域に集中し、品質とスピードを両立させてください。不要な機能は避け、必要最小限の実装を優先してください。"
    
    # 全5 Director指示送信
    send_directive_simple backend-director "$ceo_message"
    send_directive_simple trading-flow-director "$ceo_message"
    send_directive_simple integration-director "$ceo_message"
    send_directive_simple frontend-director "$ceo_message"
    send_directive_simple devops-director "$ceo_message"
    
    echo "✅ 全Director指示送信完了"
}

# シンプル指示送信（一方向・確実）
send_directive_simple() {
    local director_id="$1"
    local instruction="$2"
    
    # Director → Specialist マッピング
    case "$director_id" in
        "backend-director") target_pane="1.0" ;;
        "trading-flow-director") target_pane="2.0" ;;
        "integration-director") target_pane="3.0" ;;
        "frontend-director") target_pane="4.0" ;;
        "devops-director") target_pane="5.0" ;;
        *) echo "❌ 不明なDirector: $director_id"; return 1 ;;
    esac
    
    echo "📤 指示送信: $director_id"
    
    # セッション確認
    if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
        echo "❌ Haconiwaセッション未起動"
        return 1
    fi
    
    # 指示メッセージ作成
    local message="echo '【CEO指示受信】' && echo '$instruction' && echo '' && echo '📋 配下指示送信実行:' && ./scripts/director-auto-delegate.sh $director_id '$instruction' && echo '✅ CEO指示対応完了'"
    
    # tmux一方向送信（確実・シンプル）
    tmux send-keys -t "$SESSION_NAME:$target_pane" "$message" Enter
    
    echo "  ✅ 指示送信完了"
    sleep 1
}

# 全エージェント通知（シンプル版）
broadcast_simple() {
    local message="$1"
    
    echo "📢 全エージェント通知: $message"
    
    # 全18ペインに送信
    for window in 0 1 2 3 4 5; do
        for pane in 0 1 2; do
            tmux send-keys -t "$SESSION_NAME:$window.$pane" "echo '📢 $message'" Enter
            sleep 0.1
        done
    done
    
    echo "✅ 通知送信完了"
}

# メイン処理
case "${1:-help}" in
    "ceo-strategic")
        ceo_strategic_directive
        ;;
    "ceo-to-all")
        ceo_to_all_directors
        ;;
    "director")
        if [ $# -lt 3 ]; then
            echo "使用法: $0 director [director-id] [instruction]"
            exit 1
        fi
        send_directive_simple "$2" "$3"
        ;;
    "broadcast")
        if [ $# -lt 2 ]; then
            echo "使用法: $0 broadcast [message]"
            exit 1
        fi
        broadcast_simple "$2"
        ;;
    "help"|*)
        show_usage
        ;;
esac