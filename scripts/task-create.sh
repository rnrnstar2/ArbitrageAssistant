#!/bin/bash

# Task Creation System for Directors
# Director用タスク作成・配下指示システム

set -e

# 使用方法チェック
if [ $# -lt 3 ]; then
    echo "使用方法: $0 <director_department> <task_name> <specialist_id> [priority] [due_date]"
    echo ""
    echo "例:"
    echo "  $0 backend 'AWS Amplify基盤構築' amplify-gen2-specialist high '2025-01-30'"
    echo "  $0 trading 'Position実行エンジン実装' entry-flow-specialist medium"
    echo ""
    echo "利用可能な部門:"
    echo "  backend, trading, integration, frontend, devops"
    exit 1
fi

# パラメータ取得
DEPARTMENT="$1"
TASK_NAME="$2"
SPECIALIST_ID="$3"
PRIORITY="${4:-medium}"
DUE_DATE="${5:-$(date -d '+7 days' '+%Y-%m-%d' 2>/dev/null || date -v +7d '+%Y-%m-%d' 2>/dev/null || echo '未設定')}"

# Director ID決定
case "$DEPARTMENT" in
    "backend") DIRECTOR_ID="backend-director" ;;
    "trading") DIRECTOR_ID="trading-flow-director" ;;
    "integration") DIRECTOR_ID="integration-director" ;;
    "frontend") DIRECTOR_ID="frontend-director" ;;
    "devops") DIRECTOR_ID="devops-director" ;;
    *) 
        echo "❌ エラー: 不正な部門名 '$DEPARTMENT'"
        echo "利用可能: backend, trading, integration, frontend, devops"
        exit 1
        ;;
esac

# タスクファイル名生成（連番付き）
TASK_DIR="tasks/directors/$DEPARTMENT"
TASK_NUMBER=$(printf "%03d" $(($(ls "$TASK_DIR"/task-*.md 2>/dev/null | wc -l | tr -d ' ') + 1)))
TASK_FILENAME="task-${TASK_NUMBER}-$(echo "$TASK_NAME" | sed 's/[^a-zA-Z0-9]/-/g' | tr '[:upper:]' '[:lower:]').md"
TASK_PATH="$TASK_DIR/$TASK_FILENAME"

# 現在日時
CREATED_AT=$(date '+%Y-%m-%d %H:%M:%S')

echo "🎯 タスク作成中: $TASK_NAME"
echo "📂 作成パス: $TASK_PATH"
echo "👤 Director: $DIRECTOR_ID → Specialist: $SPECIALIST_ID"

# テンプレートからタスクファイル作成
cp tasks/templates/task-template.md "$TASK_PATH"

# プレースホルダー置換
sed -i.bak "s/\[TASK_NAME\]/$TASK_NAME/g" "$TASK_PATH"
sed -i.bak "s/\[DIRECTOR_ID\]/$DIRECTOR_ID/g" "$TASK_PATH"
sed -i.bak "s/\[SPECIALIST_ID\]/$SPECIALIST_ID/g" "$TASK_PATH"
sed -i.bak "s/\[PRIORITY\]/$PRIORITY/g" "$TASK_PATH"
sed -i.bak "s/\[CREATED_AT\]/$CREATED_AT/g" "$TASK_PATH"
sed -i.bak "s/\[DUE_DATE\]/$DUE_DATE/g" "$TASK_PATH"

# 部門別の詳細情報設定
case "$DEPARTMENT" in
    "backend")
        TECH_AREA="AWS Amplify Gen2, GraphQL, DynamoDB"
        RELEVANT_SECTION="2. データベース設計, 2-4. 認証・権限設計"
        RELEVANT_CONFIG="backend部門技術要件"
        ;;
    "trading")
        TECH_AREA="TypeScript, Position-Trail-Action, 金融計算"
        RELEVANT_SECTION="4. 実行パターン詳細, 11. 実行ロジック詳細説明"
        RELEVANT_CONFIG="trading部門技術要件"
        ;;
    "integration")
        TECH_AREA="MQL5, C++, WebSocket DLL"
        RELEVANT_SECTION="7. WebSocket通信設計, 8. エラーハンドリング設計"
        RELEVANT_CONFIG="integration部門技術要件"
        ;;
    "frontend")
        TECH_AREA="React, Next.js, Tauri v2"
        RELEVANT_SECTION="5-4. 管理者画面, 6. データフロー設計"
        RELEVANT_CONFIG="frontend部門技術要件"
        ;;
    "devops")
        TECH_AREA="Turborepo, GitHub Actions, Vitest"
        RELEVANT_SECTION="10. パフォーマンス最適化, 9. セキュリティ設計"
        RELEVANT_CONFIG="devops部門技術要件"
        ;;
esac

# 部門別情報置換
sed -i.bak "s/\[TECH_AREA\]/$TECH_AREA/g" "$TASK_PATH"
sed -i.bak "s/\[RELEVANT_SECTION\]/$RELEVANT_SECTION/g" "$TASK_PATH"
sed -i.bak "s/\[RELEVANT_CONFIG\]/$RELEVANT_CONFIG/g" "$TASK_PATH"
sed -i.bak "s/\[DEPARTMENT\]/$DEPARTMENT/g" "$TASK_PATH"

# 一時ファイル削除
rm -f "$TASK_PATH.bak"

echo "✅ タスクファイル作成完了: $TASK_PATH"
echo ""
echo "🔄 次のステップ:"
echo "  1. タスクファイルを編集して詳細指示を記載"
echo "  2. Specialistに通知: ./scripts/task-notify.sh '$TASK_PATH' '$SPECIALIST_ID'"
echo "  3. 進捗確認: ./scripts/task-status.sh '$TASK_PATH'"
echo ""
echo "📝 タスクファイル編集:"
echo "  code '$TASK_PATH'"

# Specialist通知確認
read -p "🔔 Specialistに即座通知しますか? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./scripts/task-notify.sh "$TASK_PATH" "$SPECIALIST_ID"
fi