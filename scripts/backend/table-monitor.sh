#!/bin/bash

# 🔄 Backend テーブル継続監視システム
# data/resource.ts の変更を監視して自動チェック

echo "🔄 Backend テーブル継続監視開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DATA_RESOURCE_FILE="packages/shared-backend/amplify/data/resource.ts"
WATCH_MODE="${1:-once}"

if [ ! -f "$DATA_RESOURCE_FILE" ]; then
    echo "❌ $DATA_RESOURCE_FILE が見つかりません"
    exit 1
fi

# 一回だけチェック
if [ "$WATCH_MODE" = "once" ]; then
    echo "🔍 現在のテーブル状態をチェック中..."
    ./scripts/backend-table-guard.sh
    exit $?
fi

# 継続監視モード
if [ "$WATCH_MODE" = "watch" ]; then
    echo "👁️ ファイル変更監視モード開始..."
    echo "📁 監視対象: $DATA_RESOURCE_FILE"
    echo "🔄 変更検出時に自動チェック実行"
    echo "⏹️ 停止: Ctrl+C"
    echo ""
    
    # 初回チェック
    echo "📋 初回チェック:"
    ./scripts/backend-table-guard.sh
    echo ""
    
    # ファイル監視開始
    if command -v fswatch >/dev/null 2>&1; then
        # fswatch使用（macOS推奨）
        fswatch -o "$DATA_RESOURCE_FILE" | while read f; do
            echo "🔄 ファイル変更検出: $(date '+%Y-%m-%d %H:%M:%S')"
            ./scripts/backend-table-guard.sh
            echo ""
        done
    elif command -v inotifywait >/dev/null 2>&1; then
        # inotify使用（Linux）
        while inotifywait -e modify "$DATA_RESOURCE_FILE" 2>/dev/null; do
            echo "🔄 ファイル変更検出: $(date '+%Y-%m-%d %H:%M:%S')"
            ./scripts/backend-table-guard.sh
            echo ""
        done
    else
        # ポーリング方式（フォールバック）
        echo "⚠️ fswatch/inotifywait未検出 - ポーリング監視に切替"
        LAST_MODIFIED=$(stat -f "%m" "$DATA_RESOURCE_FILE" 2>/dev/null || stat -c "%Y" "$DATA_RESOURCE_FILE" 2>/dev/null)
        
        while true; do
            sleep 3
            CURRENT_MODIFIED=$(stat -f "%m" "$DATA_RESOURCE_FILE" 2>/dev/null || stat -c "%Y" "$DATA_RESOURCE_FILE" 2>/dev/null)
            
            if [ "$CURRENT_MODIFIED" != "$LAST_MODIFIED" ]; then
                echo "🔄 ファイル変更検出: $(date '+%Y-%m-%d %H:%M:%S')"
                ./scripts/backend-table-guard.sh
                echo ""
                LAST_MODIFIED="$CURRENT_MODIFIED"
            fi
        done
    fi
fi

echo "使用法:"
echo "  $0 once   # 一回チェック（デフォルト）"
echo "  $0 watch  # 継続監視"