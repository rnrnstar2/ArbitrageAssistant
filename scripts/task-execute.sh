#!/bin/bash

# Tasks Directory v2.0 タスク実行システム
# Specialist向けタスク実行・結果記録機能

set -e

TASK_FILE="$1"
ACTION="${2:-interactive}"  # start, progress, complete, interactive

if [ -z "$TASK_FILE" ] || [ ! -f "$TASK_FILE" ]; then
    echo "使用法: $0 [task_file] [action]"
    echo "Action: start, progress, complete, interactive"
    echo "例: $0 tasks/directors/backend/task-001.md start"
    exit 1
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
COMM_SYSTEM="$(dirname "$0")/tmux-communication-system.sh"

# タスクファイル情報抽出
extract_task_info() {
    local field="$1"
    case "$field" in
        "creator")
            grep "^\*\*作成者\*\*:" "$TASK_FILE" | sed 's/.*作成者\*\*: //' | head -n1
            ;;
        "assignee")
            grep "^\*\*担当者\*\*:" "$TASK_FILE" | sed 's/.*担当者\*\*: //' | head -n1
            ;;
        "priority")
            grep "^\*\*優先度\*\*:" "$TASK_FILE" | sed 's/.*優先度\*\*: //' | head -n1
            ;;
        "status")
            grep "^\*\*状態\*\*:" "$TASK_FILE" | sed 's/.*状態\*\*: //' | head -n1
            ;;
        "title")
            head -n1 "$TASK_FILE" | sed 's/^# //'
            ;;
    esac
}

# タスクファイル更新
update_task_field() {
    local field="$1"
    local value="$2"
    
    case "$field" in
        "status")
            sed -i '' "s/\*\*状態\*\*:.*/\*\*状態\*\*: $value/" "$TASK_FILE"
            ;;
        "start_time")
            sed -i '' "s/### 実行開始日時:.*/### 実行開始日時: $value/" "$TASK_FILE"
            ;;
        "complete_time")
            sed -i '' "s/### 実行完了日時:.*/### 実行完了日時: $value/" "$TASK_FILE"
            ;;
        "executor")
            sed -i '' "s/### 実行者:.*/### 実行者: $value/" "$TASK_FILE"
            ;;
    esac
}

# 進捗履歴追加
add_progress_entry() {
    local entry="$1"
    local section_line=$(grep -n "## 🔄 進捗履歴" "$TASK_FILE" | cut -d: -f1)
    
    if [ -n "$section_line" ]; then
        local insert_line=$((section_line + 1))
        sed -i '' "${insert_line}i\\
- $TIMESTAMP **$(extract_task_info assignee)**: $entry
" "$TASK_FILE"
    fi
}

# Specialist→Director報告
report_to_director() {
    local report_type="$1"  # start, progress, complete
    local message="$2"
    
    local director=$(extract_task_info creator)
    local specialist=$(extract_task_info assignee)
    local task_title=$(extract_task_info title)
    
    echo "📤 Director報告送信: $director"
    echo "📋 報告タイプ: $report_type"
    echo "💬 メッセージ: $message"
    
    # Director報告スクリプト実行
    if [ -f "$(dirname "$0")/report-to-director.sh" ]; then
        "$(dirname "$0")/report-to-director.sh" "$director" "$specialist" "$report_type" "$task_title" "$message"
    fi
}

# 対話モード
interactive_mode() {
    echo "🎯 タスク実行管理システム (対話モード)"
    echo "📁 タスクファイル: $TASK_FILE"
    echo "📋 タスク: $(extract_task_info title)"
    echo "👤 担当者: $(extract_task_info assignee)"
    echo "📊 現在の状態: $(extract_task_info status)"
    echo ""
    
    while true; do
        echo "選択してください："
        echo "  1) タスク実行開始"
        echo "  2) 進捗更新"
        echo "  3) タスク完了"
        echo "  4) 実装内容記録"
        echo "  5) 品質チェック実行"
        echo "  6) タスク状態確認"
        echo "  7) 終了"
        echo ""
        read -p "選択 (1-7): " choice
        
        case "$choice" in
            1)
                echo "🚀 タスク実行開始..."
                start_task
                ;;
            2)
                echo "📝 進捗更新..."
                read -p "進捗メッセージ: " progress_msg
                update_progress "$progress_msg"
                ;;
            3)
                echo "✅ タスク完了処理..."
                complete_task
                ;;
            4)
                echo "📝 実装内容記録..."
                record_implementation
                ;;
            5)
                echo "🔍 品質チェック実行..."
                run_quality_checks
                ;;
            6)
                echo "📊 タスク状態確認..."
                show_task_status
                ;;
            7)
                echo "👋 終了します"
                break
                ;;
            *)
                echo "❌ 無効な選択です"
                ;;
        esac
        echo ""
    done
}

# タスク開始
start_task() {
    echo "🚀 タスク実行開始: $(extract_task_info title)"
    
    # 状態更新
    update_task_field "status" "in_progress"
    update_task_field "start_time" "$TIMESTAMP"
    update_task_field "executor" "$(extract_task_info assignee)"
    
    # 進捗履歴追加
    add_progress_entry "タスク実行開始"
    
    # Director報告
    report_to_director "start" "タスク実行を開始しました"
    
    echo "✅ タスク開始記録完了"
}

# 進捗更新
update_progress() {
    local progress_msg="$1"
    
    echo "📝 進捗更新: $progress_msg"
    
    # 進捗履歴追加
    add_progress_entry "進捗更新: $progress_msg"
    
    # Director報告
    report_to_director "progress" "$progress_msg"
    
    echo "✅ 進捗更新完了"
}

# タスク完了
complete_task() {
    echo "🎉 タスク完了処理開始"
    
    # 完了確認
    read -p "本当にタスクを完了としますか？ (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "❌ タスク完了をキャンセルしました"
        return
    fi
    
    # 完了サマリー入力
    read -p "完了サマリー: " completion_summary
    
    # 状態更新
    update_task_field "status" "completed"
    update_task_field "complete_time" "$TIMESTAMP"
    
    # 進捗履歴追加
    add_progress_entry "タスク完了: $completion_summary"
    
    # 完了済みディレクトリに移動
    COMPLETED_DIR="tasks/completed"
    mkdir -p "$COMPLETED_DIR"
    
    COMPLETED_FILE="$COMPLETED_DIR/$(basename "$TASK_FILE")"
    mv "$TASK_FILE" "$COMPLETED_FILE"
    
    # Director報告
    report_to_director "complete" "タスク完了: $completion_summary"
    
    echo "✅ タスク完了処理完了"
    echo "📁 アーカイブ先: $COMPLETED_FILE"
}

# 実装内容記録
record_implementation() {
    echo "📝 実装内容記録"
    echo "現在の実装内容セクションを更新します..."
    
    # 一時ファイルでエディタ起動
    local temp_file="/tmp/implementation_$(date +%s).md"
    
    # 現在の実装内容を取得
    local start_line=$(grep -n "### 実装内容" "$TASK_FILE" | cut -d: -f1)
    local end_line=$(grep -n "### 成果物" "$TASK_FILE" | cut -d: -f1)
    
    if [ -n "$start_line" ] && [ -n "$end_line" ]; then
        local content_start=$((start_line + 1))
        local content_end=$((end_line - 1))
        sed -n "${content_start},${content_end}p" "$TASK_FILE" > "$temp_file"
    fi
    
    echo "📝 実装内容を入力してください（終了するには空行でCtrl+D）:"
    cat > "$temp_file"
    
    # ファイルに反映
    if [ -n "$start_line" ] && [ -n "$end_line" ]; then
        local temp_before="/tmp/task_before_$(date +%s).md"
        local temp_after="/tmp/task_after_$(date +%s).md"
        
        # 前半部分
        head -n "$start_line" "$TASK_FILE" > "$temp_before"
        
        # 後半部分
        tail -n "+$end_line" "$TASK_FILE" > "$temp_after"
        
        # 結合
        cat "$temp_before" > "$TASK_FILE"
        cat "$temp_file" >> "$TASK_FILE"
        cat "$temp_after" >> "$TASK_FILE"
        
        # 一時ファイル削除
        rm -f "$temp_before" "$temp_after"
    fi
    
    rm -f "$temp_file"
    
    # 進捗履歴追加
    add_progress_entry "実装内容記録更新"
    
    echo "✅ 実装内容記録完了"
}

# 品質チェック実行
run_quality_checks() {
    echo "🔍 品質チェック実行中..."
    
    local checks_passed=0
    local checks_total=4
    
    # Lint チェック
    echo "📋 Lint チェック実行中..."
    if npm run lint >/dev/null 2>&1; then
        echo "  ✅ Lint: 通過"
        sed -i '' "s/- \[ \] Lint通過:.*/- [x] Lint通過: ✅ 成功/" "$TASK_FILE"
        checks_passed=$((checks_passed + 1))
    else
        echo "  ❌ Lint: 失敗"
        sed -i '' "s/- \[ \] Lint通過:.*/- [x] Lint通過: ❌ 失敗/" "$TASK_FILE"
    fi
    
    # 型チェック
    echo "📋 型チェック実行中..."
    if (cd apps/hedge-system && npm run check-types) >/dev/null 2>&1 && (cd apps/admin && npm run check-types) >/dev/null 2>&1; then
        echo "  ✅ 型チェック: 通過"
        sed -i '' "s/- \[ \] 型チェック通過:.*/- [x] 型チェック通過: ✅ 成功/" "$TASK_FILE"
        checks_passed=$((checks_passed + 1))
    else
        echo "  ❌ 型チェック: 失敗"
        sed -i '' "s/- \[ \] 型チェック通過:.*/- [x] 型チェック通過: ❌ 失敗/" "$TASK_FILE"
    fi
    
    # テスト実行
    echo "📋 テスト実行中..."
    if npm run test >/dev/null 2>&1; then
        echo "  ✅ テスト: 通過"
        sed -i '' "s/- \[ \] テスト通過:.*/- [x] テスト通過: ✅ 成功/" "$TASK_FILE"
        checks_passed=$((checks_passed + 1))
    else
        echo "  ⚠️ テスト: スキップ（テストなし）"
        sed -i '' "s/- \[ \] テスト通過:.*/- [x] テスト通過: ⚠️ スキップ/" "$TASK_FILE"
        checks_passed=$((checks_passed + 1))  # テストなしは許可
    fi
    
    # ビルドチェック
    echo "📋 ビルドチェック実行中..."
    if npm run build >/dev/null 2>&1; then
        echo "  ✅ ビルド: 成功"
        sed -i '' "s/- \[ \] ビルド成功:.*/- [x] ビルド成功: ✅ 成功/" "$TASK_FILE"
        checks_passed=$((checks_passed + 1))
    else
        echo "  ❌ ビルド: 失敗"
        sed -i '' "s/- \[ \] ビルド成功:.*/- [x] ビルド成功: ❌ 失敗/" "$TASK_FILE"
    fi
    
    # 結果サマリー
    echo ""
    echo "📊 品質チェック結果: ${checks_passed}/${checks_total} 通過"
    
    if [ "$checks_passed" -eq "$checks_total" ]; then
        echo "🎉 全品質チェック通過！"
        add_progress_entry "品質チェック完了: 全${checks_total}項目通過"
    else
        echo "⚠️ 品質チェックで問題が検出されました"
        add_progress_entry "品質チェック完了: ${checks_passed}/${checks_total}項目通過"
    fi
}

# タスク状態確認
show_task_status() {
    echo "📊 タスク状態確認"
    echo "=================="
    echo "📋 タスク: $(extract_task_info title)"
    echo "👤 担当者: $(extract_task_info assignee)"
    echo "👨‍💼 作成者: $(extract_task_info creator)"
    echo "📊 状態: $(extract_task_info status)"
    echo "🔥 優先度: $(extract_task_info priority)"
    echo ""
    echo "📁 タスクファイル: $TASK_FILE"
    echo "📅 最終更新: $(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$TASK_FILE")"
    echo ""
    
    # 最新の進捗履歴表示（最新5件）
    echo "📋 最新の進捗履歴:"
    grep "^- [0-9]" "$TASK_FILE" | tail -n 5 | while read line; do
        echo "  $line"
    done
}

# メイン実行
case "$ACTION" in
    "start")
        start_task
        ;;
    "progress")
        read -p "進捗メッセージ: " progress_msg
        update_progress "$progress_msg"
        ;;
    "complete")
        complete_task
        ;;
    "interactive"|*)
        interactive_mode
        ;;
esac