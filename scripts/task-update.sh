#!/bin/bash

# Task Update System for Directors
# Director用タスク追加指示・進捗更新システム

set -e

# 使用方法チェック
if [ $# -lt 2 ]; then
    echo "使用方法: $0 <task_path> <action> [content]"
    echo ""
    echo "アクション:"
    echo "  add-instruction \"追加指示内容\"     # 追加指示作成"
    echo "  feedback \"フィードバック内容\"      # Specialistへのフィードバック"
    echo "  update-priority high|medium|low     # 優先度変更"
    echo "  block \"ブロック理由\"               # タスクブロック"
    echo "  unblock                             # ブロック解除"
    echo "  approve                             # タスク承認・完了確定"
    echo ""
    echo "例:"
    echo "  $0 tasks/directors/backend/task-001-amplify.md add-instruction \"GraphQLスキーマ最適化を追加で実装\""
    echo "  $0 tasks/directors/backend/task-001-amplify.md feedback \"実装内容確認、パフォーマンステストも追加してください\""
    echo "  $0 tasks/directors/backend/task-001-amplify.md approve"
    exit 1
fi

TASK_PATH="$1"
ACTION="$2"
CONTENT="$3"

# タスクファイル存在確認
if [ ! -f "$TASK_PATH" ]; then
    echo "❌ エラー: タスクファイルが見つかりません: $TASK_PATH"
    exit 1
fi

# 現在のエージェントID取得
CURRENT_AGENT="${HACONIWA_AGENT_ID:-unknown}"
CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S')

# タスク情報取得
TASK_NAME=$(grep "^# " "$TASK_PATH" | head -1 | sed 's/^# //')
DIRECTOR_ID=$(grep "^\*\*作成者\*\*:" "$TASK_PATH" | sed 's/.*: //')
SPECIALIST_ID=$(grep "^\*\*担当者\*\*:" "$TASK_PATH" | sed 's/.*: //')

echo "🎯 タスク更新システム"
echo "============================================"
echo "タスク: $TASK_NAME"
echo "ファイル: $TASK_PATH"
echo "Director: $DIRECTOR_ID"
echo "Specialist: $SPECIALIST_ID"
echo "アクション: $ACTION"
echo ""

# Director権限確認
if [ "$CURRENT_AGENT" != "$DIRECTOR_ID" ] && [ "$CURRENT_AGENT" != "unknown" ]; then
    echo "⚠️  警告: このタスクは $DIRECTOR_ID が作成したタスクです"
    echo "現在のエージェント: $CURRENT_AGENT"
    read -p "Director権限で実行しますか? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 実行を中止しました"
        exit 1
    fi
fi

# アクション別処理
case "$ACTION" in
    "add-instruction")
        add_instruction "$CONTENT"
        ;;
    "feedback")
        add_feedback "$CONTENT"
        ;;
    "update-priority")
        update_priority "$CONTENT"
        ;;
    "block")
        block_task "$CONTENT"
        ;;
    "unblock")
        unblock_task
        ;;
    "approve")
        approve_task
        ;;
    *)
        echo "❌ エラー: 不正なアクション '$ACTION'"
        echo "利用可能: add-instruction, feedback, update-priority, block, unblock, approve"
        exit 1
        ;;
esac

# 追加指示作成関数
add_instruction() {
    local instruction="$1"
    
    if [ -z "$instruction" ]; then
        echo "追加指示内容を入力してください:"
        read -r instruction
    fi
    
    echo "📝 追加指示作成中..."
    
    # 新しい指示をタスクファイルに追加
    sed -i.bak "/## 🎯 指示内容/a\\
\\
### 【追加指示 - $CURRENT_TIME】\\
$instruction\\
" "$TASK_PATH"
    
    # 進捗履歴に追加
    sed -i.bak "/^- _\[実行履歴はここに時系列で追記\]_/a\\
- $CURRENT_TIME **$DIRECTOR_ID**: 追加指示作成" "$TASK_PATH"
    
    # コミュニケーションログに追加
    sed -i.bak "/### Director → Specialist/a\\
**$CURRENT_TIME** - $DIRECTOR_ID: $instruction\\
" "$TASK_PATH"
    
    rm -f "$TASK_PATH.bak"
    
    echo "✅ 追加指示作成完了"
    
    # Specialist通知確認
    read -p "🔔 Specialistに即座通知しますか? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        notify_specialist_update "$instruction"
    fi
}

# フィードバック追加関数
add_feedback() {
    local feedback="$1"
    
    if [ -z "$feedback" ]; then
        echo "フィードバック内容を入力してください:"
        read -r feedback
    fi
    
    echo "📝 フィードバック追加中..."
    
    # コミュニケーションログに追加
    sed -i.bak "/### Director → Specialist/a\\
**$CURRENT_TIME** - $DIRECTOR_ID [フィードバック]: $feedback\\
" "$TASK_PATH"
    
    # 進捗履歴に追加
    sed -i.bak "/^- _\[実行履歴はここに時系列で追記\]_/a\\
- $CURRENT_TIME **$DIRECTOR_ID**: フィードバック提供" "$TASK_PATH"
    
    rm -f "$TASK_PATH.bak"
    
    echo "✅ フィードバック追加完了"
    
    # Specialist通知
    notify_specialist_update "【フィードバック】$feedback"
}

# 優先度更新関数
update_priority() {
    local new_priority="$1"
    
    if [ -z "$new_priority" ]; then
        echo "新しい優先度を選択してください:"
        PS3="選択: "
        options=("high" "medium" "low")
        select new_priority in "${options[@]}"; do
            [ -n "$new_priority" ] && break
        done
    fi
    
    case "$new_priority" in
        "high"|"medium"|"low")
            echo "📊 優先度更新中: $new_priority"
            
            sed -i.bak "s/\*\*優先度\*\*: .*/\*\*優先度\*\*: $new_priority/" "$TASK_PATH"
            
            # 進捗履歴に追加
            sed -i.bak "/^- _\[実行履歴はここに時系列で追記\]_/a\\
- $CURRENT_TIME **$DIRECTOR_ID**: 優先度変更 → $new_priority" "$TASK_PATH"
            
            rm -f "$TASK_PATH.bak"
            echo "✅ 優先度更新完了: $new_priority"
            ;;
        *)
            echo "❌ エラー: 不正な優先度 '$new_priority'"
            echo "利用可能: high, medium, low"
            exit 1
            ;;
    esac
}

# タスクブロック関数
block_task() {
    local reason="$1"
    
    if [ -z "$reason" ]; then
        echo "ブロック理由を入力してください:"
        read -r reason
    fi
    
    echo "🚫 タスクブロック中..."
    
    # ステータス更新
    sed -i.bak "s/\*\*状態\*\*: .*/\*\*状態\*\*: blocked/" "$TASK_PATH"
    
    # ブロック理由追加
    sed -i.bak "/## 🎯 指示内容/a\\
\\
### 🚫 ブロック状況 - $CURRENT_TIME\\
**理由**: $reason\\
**ブロック解除**: Director判断により解除予定\\
" "$TASK_PATH"
    
    # 進捗履歴に追加
    sed -i.bak "/^- _\[実行履歴はここに時系列で追記\]_/a\\
- $CURRENT_TIME **$DIRECTOR_ID**: タスクブロック - $reason" "$TASK_PATH"
    
    rm -f "$TASK_PATH.bak"
    
    echo "✅ タスクブロック完了"
    notify_specialist_update "【タスクブロック】$reason"
}

# ブロック解除関数
unblock_task() {
    echo "🔓 ブロック解除中..."
    
    # ステータス更新
    sed -i.bak "s/\*\*状態\*\*: blocked/\*\*状態\*\*: in_progress/" "$TASK_PATH"
    
    # ブロック解除記録
    sed -i.bak "/### 🚫 ブロック状況/a\\
**解除日時**: $CURRENT_TIME - ブロック解除、作業再開可能\\
" "$TASK_PATH"
    
    # 進捗履歴に追加
    sed -i.bak "/^- _\[実行履歴はここに時系列で追記\]_/a\\
- $CURRENT_TIME **$DIRECTOR_ID**: ブロック解除・作業再開" "$TASK_PATH"
    
    rm -f "$TASK_PATH.bak"
    
    echo "✅ ブロック解除完了"
    notify_specialist_update "【ブロック解除】作業を再開してください"
}

# タスク承認関数
approve_task() {
    echo "✅ タスク承認・完了確定中..."
    
    # ステータス更新
    sed -i.bak "s/\*\*状態\*\*: .*/\*\*状態\*\*: approved/" "$TASK_PATH"
    
    # 承認記録
    sed -i.bak "/## 📊 実行結果/a\\
\\
### ✅ Director承認 - $CURRENT_TIME\\
**承認者**: $DIRECTOR_ID\\
**承認内容**: 実装内容・品質ともに要件を満たしており、タスク完了を承認\\
" "$TASK_PATH"
    
    # 進捗履歴に追加
    sed -i.bak "/^- _\[実行履歴はここに時系列で追記\]_/a\\
- $CURRENT_TIME **$DIRECTOR_ID**: タスク承認・完了確定" "$TASK_PATH"
    
    rm -f "$TASK_PATH.bak"
    
    echo "✅ タスク承認完了"
    
    # completed移動確認
    read -p "📁 承認済みタスクをcompletedディレクトリに移動しますか? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        move_to_completed
    fi
    
    notify_specialist_update "【タスク承認】お疲れ様でした！実装が承認されました。"
}

# Specialist通知関数
notify_specialist_update() {
    local message="$1"
    
    # specialist用のpane番号決定
    get_specialist_pane() {
        case "$1" in
            "amplify-gen2-specialist") echo "1.1" ;;
            "cognito-auth-expert") echo "1.2" ;;
            "entry-flow-specialist") echo "2.1" ;;
            "settlement-flow-specialist") echo "2.2" ;;
            "mt5-connector-specialist") echo "3.1" ;;
            "websocket-engineer") echo "3.2" ;;
            "react-specialist") echo "4.1" ;;
            "desktop-app-engineer") echo "4.2" ;;
            "build-optimization-engineer") echo "5.1" ;;
            "quality-assurance-engineer") echo "5.2" ;;
            *) echo "" ;;
        esac
    }
    
    PANE=$(get_specialist_pane "$SPECIALIST_ID")
    
    if [ -n "$PANE" ] && tmux has-session -t arbitrage-assistant 2>/dev/null; then
        NOTIFICATION_CMD="echo '🔔【Director更新通知】' && echo 'タスク: $TASK_NAME' && echo 'From: $DIRECTOR_ID' && echo 'メッセージ: $message' && echo 'ファイル確認: $TASK_PATH' ultrathink"
        
        tmux send-keys -t "arbitrage-assistant:$PANE" "$NOTIFICATION_CMD" Enter
        echo "🔔 Specialist ($SPECIALIST_ID) に通知送信完了"
    fi
}

# completed移動関数
move_to_completed() {
    COMPLETED_DIR="tasks/completed"
    mkdir -p "$COMPLETED_DIR"
    
    COMPLETED_PATH="$COMPLETED_DIR/$(basename "$TASK_PATH")"
    
    mv "$TASK_PATH" "$COMPLETED_PATH"
    echo "📁 タスクを移動しました: $COMPLETED_PATH"
}

echo ""
echo "📋 タスク更新完了"
echo "ファイル: $TASK_PATH"
echo ""
echo "🔄 利用可能なコマンド:"
echo "  状況確認: ./scripts/task-status.sh '$TASK_PATH'"
echo "  全タスク: ./scripts/task-status.sh --all"
echo "  追加更新: ./scripts/task-update.sh '$TASK_PATH' <action>"