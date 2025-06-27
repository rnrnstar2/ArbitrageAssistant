#!/bin/bash

# 🛡️ Backend テーブル追加監視・防止システム
# Amplify data/resource.ts の不正テーブル追加を検出・防止

set -e

echo "🛡️ Backend テーブル監視システム v1.0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DATA_RESOURCE_FILE="packages/shared-backend/amplify/data/resource.ts"
BACKUP_DIR="backups/data-resource"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# 許可されたテーブル（MVP必須のみ）
ALLOWED_TABLES=(
    "User"
    "Account" 
    "Position"
    "Action"
)

# 絶対禁止テーブル（勝手に追加されやすいもの）
FORBIDDEN_TABLES=(
    "Performance"
    "Analytics"
    "Metrics"
    "Monitoring"
    "Statistics"
    "Report"
    "Dashboard"
    "Notification"
    "Configuration"
    "Settings"
    "Strategy"
    "Optimization"
    "Alert"
    "Event"
    "Log"
)

echo "📋 監視対象: $DATA_RESOURCE_FILE"
echo "✅ 許可テーブル: ${ALLOWED_TABLES[*]}"
echo "🚨 禁止テーブル: ${FORBIDDEN_TABLES[*]}"
echo ""

# ファイル存在確認
if [ ! -f "$DATA_RESOURCE_FILE" ]; then
    echo "❌ data/resource.ts が見つかりません"
    echo "💡 Backend基盤が未実装の可能性があります"
    exit 1
fi

# バックアップディレクトリ作成
mkdir -p "$BACKUP_DIR"

echo "🔍 テーブル監視分析開始..."

# 現在のテーブル一覧取得
CURRENT_TABLES=$(grep -E "^\s*(const\s+\w+\s*=\s*)?defineData|\.model\(" "$DATA_RESOURCE_FILE" | \
    grep -oE "\.model\(['\"]([^'\"]+)['\"]" | \
    sed 's/\.model(['"'"'"]//' | sed 's/['"'"'"].*//' | \
    sort | uniq)

echo "📊 検出されたテーブル一覧:"
echo "$CURRENT_TABLES"
echo ""

# 許可テーブル確認
echo "✅ 許可テーブル確認:"
MISSING_REQUIRED=0
for table in "${ALLOWED_TABLES[@]}"; do
    if echo "$CURRENT_TABLES" | grep -q "^$table$"; then
        echo "  ✅ $table: 実装済み"
    else
        echo "  ❌ $table: 未実装"
        MISSING_REQUIRED=$((MISSING_REQUIRED + 1))
    fi
done
echo ""

# 禁止テーブル検出
echo "🚨 禁止テーブル検出:"
FORBIDDEN_FOUND=0
FORBIDDEN_LIST=""
for table in "${FORBIDDEN_TABLES[@]}"; do
    if echo "$CURRENT_TABLES" | grep -q "^$table$"; then
        echo "  🚨 $table: 【禁止テーブル検出】"
        FORBIDDEN_LIST="$FORBIDDEN_LIST $table"
        FORBIDDEN_FOUND=$((FORBIDDEN_FOUND + 1))
    fi
done

# 許可リスト外テーブル検出
echo "⚠️ 許可リスト外テーブル検出:"
UNKNOWN_FOUND=0
UNKNOWN_LIST=""
while IFS= read -r table; do
    if [ -n "$table" ]; then
        is_allowed=false
        for allowed in "${ALLOWED_TABLES[@]}"; do
            if [ "$table" = "$allowed" ]; then
                is_allowed=true
                break
            fi
        done
        
        if [ "$is_allowed" = false ]; then
            echo "  ⚠️ $table: 【許可リスト外】"
            UNKNOWN_LIST="$UNKNOWN_LIST $table"
            UNKNOWN_FOUND=$((UNKNOWN_FOUND + 1))
        fi
    fi
done <<< "$CURRENT_TABLES"
echo ""

# 結果判定
TOTAL_VIOLATIONS=$((FORBIDDEN_FOUND + UNKNOWN_FOUND))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Backend テーブル監視結果"
echo "📊 実装テーブル数: $(echo "$CURRENT_TABLES" | wc -l | tr -d ' ')"
echo "✅ 許可テーブル: $((4 - MISSING_REQUIRED))/4"
echo "🚨 禁止テーブル: $FORBIDDEN_FOUND個"
echo "⚠️ 許可外テーブル: $UNKNOWN_FOUND個"
echo "❌ 総違反数: $TOTAL_VIOLATIONS個"
echo ""

if [ $TOTAL_VIOLATIONS -eq 0 ] && [ $MISSING_REQUIRED -eq 0 ]; then
    echo "🎉 Backend テーブル設計: 【MVP準拠・完璧】"
    echo "✅ 不正テーブル追加なし"
    echo "✅ 必須テーブル完備"
    exit 0
elif [ $TOTAL_VIOLATIONS -eq 0 ] && [ $MISSING_REQUIRED -gt 0 ]; then
    echo "⚠️ Backend テーブル設計: 【部分実装】"
    echo "✅ 不正テーブル追加なし"
    echo "❌ 必須テーブル未完成: $MISSING_REQUIRED個"
    exit 1
else
    echo "🚨 Backend テーブル設計: 【MVP違反検出】"
    echo "❌ 不正テーブルが追加されています"
    echo ""
    
    # バックアップ作成
    echo "💾 違反ファイルのバックアップ作成..."
    cp "$DATA_RESOURCE_FILE" "$BACKUP_DIR/resource-violated-$TIMESTAMP.ts"
    echo "📁 バックアップ: $BACKUP_DIR/resource-violated-$TIMESTAMP.ts"
    echo ""
    
    # 修正方法提示
    echo "🔧 修正方法:"
    echo "1. 以下の禁止テーブルを削除してください:"
    if [ -n "$FORBIDDEN_LIST" ]; then
        for table in $FORBIDDEN_LIST; do
            echo "   - $table テーブル（MVP範囲外）"
        done
    fi
    
    echo "2. 以下の許可外テーブルを確認・削除してください:"
    if [ -n "$UNKNOWN_LIST" ]; then
        for table in $UNKNOWN_LIST; do
            echo "   - $table テーブル（許可リスト外）"
        done
    fi
    
    echo "3. MVPシステム設計.md の必須テーブルのみ残してください"
    echo "4. 修正後に再度チェック: ./scripts/backend-table-guard.sh"
    echo ""
    
    # Director警告送信（Haconiwaセッションがあれば）
    if tmux has-session -t arbitrage-assistant 2>/dev/null; then
        echo "📢 Backend Director警告送信中..."
        WARNING_MSG="🚨【Backend Director緊急警告】data/resource.ts でMVP外テーブル検出！ 禁止テーブル: $FORBIDDEN_LIST 許可外: $UNKNOWN_LIST 即座に削除して MVP必須テーブル(User/Account/Position/Action)のみに修正してください"
        tmux send-keys -t arbitrage-assistant:1.0 " && echo '$WARNING_MSG' ultrathink" Enter
        echo "✅ Backend Director警告送信完了"
    fi
    
    exit 1
fi