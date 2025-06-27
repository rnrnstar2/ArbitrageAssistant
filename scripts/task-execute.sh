#!/bin/bash

# Task Execution System for Specialists
# Specialist用タスク実行・結果記録システム

set -e

# 使用方法チェック
if [ $# -lt 1 ]; then
    echo "使用方法: $0 <task_path> [status]"
    echo ""
    echo "例:"
    echo "  $0 tasks/directors/backend/task-001-amplify.md start    # 開始記録"
    echo "  $0 tasks/directors/backend/task-001-amplify.md progress # 進捗更新"
    echo "  $0 tasks/directors/backend/task-001-amplify.md complete # 完了記録"
    echo ""
    echo "status未指定時は対話モードで実行"
    exit 1
fi

TASK_PATH="$1"
STATUS="${2:-}"

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
ASSIGNED_SPECIALIST=$(grep "^\*\*担当者\*\*:" "$TASK_PATH" | sed 's/.*: //')

echo "📋 タスク実行・結果記録システム"
echo "============================================"
echo "タスク: $TASK_NAME"
echo "ファイル: $TASK_PATH"
echo "担当者: $ASSIGNED_SPECIALIST"
echo "現在のエージェント: $CURRENT_AGENT"
echo ""

# 担当者確認
if [ "$CURRENT_AGENT" != "$ASSIGNED_SPECIALIST" ] && [ "$CURRENT_AGENT" != "unknown" ]; then
    echo "⚠️  警告: このタスクは $ASSIGNED_SPECIALIST に割り当てられています"
    echo "現在のエージェント: $CURRENT_AGENT"
    read -p "続行しますか? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 実行を中止しました"
        exit 1
    fi
fi

# ステータス別処理
case "$STATUS" in
    "start")
        echo "🚀 タスク開始記録..."
        update_task_start
        ;;
    "progress")
        echo "📊 進捗更新記録..."
        update_task_progress
        ;;
    "complete")
        echo "✅ タスク完了記録..."
        update_task_complete
        ;;
    "")
        # 対話モード
        interactive_mode
        ;;
    *)
        echo "❌ エラー: 不正なステータス '$STATUS'"
        echo "利用可能: start, progress, complete"
        exit 1
        ;;
esac

# タスク開始記録関数
update_task_start() {
    echo "📝 開始時刻記録中..."
    
    # 実行結果セクションの実行者・開始日時更新
    sed -i.bak "s/### 実行者: /### 実行者: $CURRENT_AGENT/" "$TASK_PATH"
    sed -i.bak "s/### 実行開始日時: /### 実行開始日時: $CURRENT_TIME/" "$TASK_PATH"
    
    # 進捗履歴に追加
    sed -i.bak "/^- _\[実行履歴はここに時系列で追記\]_/a\\
- $CURRENT_TIME **$CURRENT_AGENT**: タスク実行開始" "$TASK_PATH"
    
    # ステータス更新
    sed -i.bak "s/\*\*状態\*\*: created/\*\*状態\*\*: in_progress/" "$TASK_PATH"
    sed -i.bak "s/\*\*状態\*\*: pending/\*\*状態\*\*: in_progress/" "$TASK_PATH"
    
    rm -f "$TASK_PATH.bak"
    echo "✅ 開始記録完了"
}

# 進捗更新記録関数
update_task_progress() {
    echo "進捗内容を入力してください（空行で終了）:"
    echo "---"
    
    PROGRESS_CONTENT=""
    while IFS= read -r line; do
        [ -z "$line" ] && break
        PROGRESS_CONTENT="$PROGRESS_CONTENT$line\n"
    done
    
    if [ -n "$PROGRESS_CONTENT" ]; then
        # 進捗履歴に追加
        sed -i.bak "/^- _\[実行履歴はここに時系列で追記\]_/a\\
- $CURRENT_TIME **$CURRENT_AGENT**: 進捗更新 - $(echo "$PROGRESS_CONTENT" | head -1)" "$TASK_PATH"
        
        rm -f "$TASK_PATH.bak"
        echo "✅ 進捗更新完了"
    else
        echo "❌ 進捗内容が入力されませんでした"
    fi
}

# タスク完了記録関数
update_task_complete() {
    echo "🎯 完了内容記録中..."
    
    # 完了日時記録
    sed -i.bak "s/### 実行完了日時: /### 実行完了日時: $CURRENT_TIME/" "$TASK_PATH"
    
    # ステータス更新
    sed -i.bak "s/\*\*状態\*\*: in_progress/\*\*状態\*\*: completed/" "$TASK_PATH"
    
    # 進捗履歴に追加
    sed -i.bak "/^- _\[実行履歴はここに時系列で追記\]_/a\\
- $CURRENT_TIME **$CURRENT_AGENT**: タスク実行完了・結果記録" "$TASK_PATH"
    
    rm -f "$TASK_PATH.bak"
    echo "✅ 完了記録完了"
    
    # 品質チェック実行確認
    echo ""
    echo "🔍 品質チェック実行確認"
    read -p "Lint・TypeCheck・テストを実行しますか? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        run_quality_checks
    fi
    
    # completed/ディレクトリへの移動確認
    echo ""
    read -p "📁 タスクをcompletedディレクトリに移動しますか? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        move_to_completed
    fi
}

# 対話モード関数
interactive_mode() {
    echo "対話モードでタスク実行記録を行います"
    echo ""
    
    PS3="選択してください: "
    options=("開始記録" "進捗更新" "実装内容記録" "完了記録" "手動編集" "終了")
    
    select opt in "${options[@]}"; do
        case $opt in
            "開始記録")
                update_task_start
                break
                ;;
            "進捗更新")
                update_task_progress
                ;;
            "実装内容記録")
                record_implementation
                ;;
            "完了記録")
                update_task_complete
                break
                ;;
            "手動編集")
                echo "タスクファイルを手動編集: $TASK_PATH"
                ${EDITOR:-nano} "$TASK_PATH"
                ;;
            "終了")
                echo "記録作業を終了します"
                break
                ;;
            *) echo "無効な選択です" ;;
        esac
    done
}

# 実装内容記録関数
record_implementation() {
    echo ""
    echo "実装内容を記録してください:"
    echo "1. 実装した機能・変更点:"
    read -r IMPLEMENTATION_DETAIL
    
    echo "2. 作成・更新したファイル（複数可、スペース区切り）:"
    read -r FILES_CHANGED
    
    echo "3. 技術的課題・解決策:"
    read -r TECHNICAL_ISSUES
    
    # タスクファイル更新
    sed -i.bak "/### 実装内容/a\\
$IMPLEMENTATION_DETAIL" "$TASK_PATH"
    
    # ファイル変更記録
    for file in $FILES_CHANGED; do
        sed -i.bak "/### 成果物/a\\
- [x] ファイル更新: $file" "$TASK_PATH"
    done
    
    # 技術的課題記録
    if [ -n "$TECHNICAL_ISSUES" ]; then
        sed -i.bak "/### 技術的課題・解決策/a\\
$TECHNICAL_ISSUES" "$TASK_PATH"
    fi
    
    rm -f "$TASK_PATH.bak"
    echo "✅ 実装内容記録完了"
}

# 品質チェック実行関数
run_quality_checks() {
    echo "🔍 品質チェック実行中..."
    
    # Lint実行
    echo "📝 Lint実行中..."
    if npm run lint > /tmp/lint_result.txt 2>&1; then
        echo "✅ Lint通過"
        sed -i.bak "s/- \[ \] Lint通過: .*/- [x] Lint通過: ✅ 成功/" "$TASK_PATH"
    else
        echo "❌ Lint失敗"
        sed -i.bak "s/- \[ \] Lint通過: .*/- [ ] Lint通過: ❌ 失敗 (要修正)/" "$TASK_PATH"
        echo "Lintエラー詳細:"
        tail -10 /tmp/lint_result.txt
    fi
    
    # TypeCheck実行
    echo "🔍 TypeCheck実行中..."
    if npm run check-types > /tmp/typecheck_result.txt 2>&1; then
        echo "✅ TypeCheck通過"
        sed -i.bak "s/- \[ \] 型チェック通過: .*/- [x] 型チェック通過: ✅ 成功/" "$TASK_PATH"
    else
        echo "❌ TypeCheck失敗"
        sed -i.bak "s/- \[ \] 型チェック通過: .*/- [ ] 型チェック通過: ❌ 失敗 (要修正)/" "$TASK_PATH"
    fi
    
    rm -f "$TASK_PATH.bak"
    echo "📊 品質チェック結果をタスクファイルに記録しました"
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
echo "📋 タスク実行記録完了"
echo "ファイル: $TASK_PATH"
echo ""
echo "🔄 次のステップ:"
echo "  1. Director確認待ち"
echo "  2. 追加指示があれば実行"
echo "  3. タスク状況確認: ./scripts/task-status.sh '$TASK_PATH'"