#!/bin/bash

# 🎯 CEO Supreme技術領域判定システム - 適切なDirector選択支援

# 技術領域判定関数
determine_technical_domain() {
    local issue_description="$1"
    local file_path="$2"
    
    echo "🔍 技術領域判定実行中..."
    echo "  問題: $issue_description"
    echo "  ファイル: $file_path"
    
    # UI/Frontend領域判定
    if [[ "$file_path" =~ packages/ui ]] || \
       [[ "$file_path" =~ apps/admin ]] || \
       [[ "$file_path" =~ apps/hedge-system.*\.(tsx|jsx|css|scss) ]] || \
       [[ "$issue_description" =~ (PostCSS|Tailwind|CSS|UI|Frontend|React|Next\.js|Tauri) ]]; then
        echo "  ✅ 判定結果: Frontend領域"
        echo "  📋 適切Director: frontend-director"
        echo "  🎯 理由: UI/Frontend技術スタック"
        return 0
    fi
    
    # Backend領域判定
    if [[ "$file_path" =~ packages/shared-backend ]] || \
       [[ "$file_path" =~ amplify ]] || \
       [[ "$issue_description" =~ (GraphQL|DynamoDB|AWS|Amplify|Backend|Database|API) ]]; then
        echo "  ✅ 判定結果: Backend領域"
        echo "  📋 適切Director: backend-director"
        echo "  🎯 理由: Backend/AWS技術スタック"
        return 1
    fi
    
    # Trading領域判定
    if [[ "$file_path" =~ position-execution ]] || \
       [[ "$file_path" =~ trail-engine ]] || \
       [[ "$issue_description" =~ (Position|Trail|Trading|Action|Execution) ]]; then
        echo "  ✅ 判定結果: Trading領域"
        echo "  📋 適切Director: trading-flow-director"
        echo "  🎯 理由: Trading実行システム"
        return 2
    fi
    
    # Integration領域判定
    if [[ "$file_path" =~ ea/ ]] || \
       [[ "$file_path" =~ websocket ]] || \
       [[ "$issue_description" =~ (MT4|MT5|WebSocket|Integration|EA|MQL) ]]; then
        echo "  ✅ 判定結果: Integration領域"
        echo "  📋 適切Director: integration-director"
        echo "  🎯 理由: MT5統合・WebSocket"
        return 3
    fi
    
    # DevOps領域判定
    if [[ "$file_path" =~ package\.json ]] || \
       [[ "$file_path" =~ turbo\.json ]] || \
       [[ "$issue_description" =~ (Build|CI/CD|DevOps|Turborepo|Dependencies|Performance) ]]; then
        echo "  ✅ 判定結果: DevOps領域"
        echo "  📋 適切Director: devops-director"
        echo "  🎯 理由: ビルド・依存関係・インフラ"
        return 4
    fi
    
    # 不明な場合のデフォルト
    echo "  ⚠️ 判定結果: 領域不明"
    echo "  📋 デフォルト: backend-director"
    echo "  🎯 理由: 汎用的技術問題として処理"
    return 1
}

# Director選択支援関数
get_appropriate_director() {
    local issue_description="$1"
    local file_path="$2"
    
    determine_technical_domain "$issue_description" "$file_path" > /dev/null 2>&1
    local domain_code=$?
    
    case $domain_code in
        0) echo "frontend-director" ;;
        1) echo "backend-director" ;;
        2) echo "trading-flow-director" ;;
        3) echo "integration-director" ;;
        4) echo "devops-director" ;;
        *) echo "backend-director" ;;
    esac
}

# 判定例デモ実行
if [ "$1" = "demo" ]; then
    echo "🎯 技術領域判定システム デモ実行"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # テストケース1: UI問題
    echo ""
    echo "📋 テストケース1: packages/ui PostCSS設定問題"
    determine_technical_domain "PostCSS設定問題" "packages/ui"
    appropriate_director=$(get_appropriate_director "PostCSS設定問題" "packages/ui")
    echo "  💡 推奨Director: $appropriate_director"
    
    # テストケース2: Backend問題
    echo ""
    echo "📋 テストケース2: AWS Amplify GraphQL問題"
    determine_technical_domain "GraphQL schema問題" "packages/shared-backend/amplify/data/resource.ts"
    appropriate_director=$(get_appropriate_director "GraphQL schema問題" "packages/shared-backend/amplify/data/resource.ts")
    echo "  💡 推奨Director: $appropriate_director"
    
    # テストケース3: Trading問題
    echo ""
    echo "📋 テストケース3: Position実行問題"
    determine_technical_domain "Position実行エラー" "apps/hedge-system/lib/position-execution.ts"
    appropriate_director=$(get_appropriate_director "Position実行エラー" "apps/hedge-system/lib/position-execution.ts")
    echo "  💡 推奨Director: $appropriate_director"
    
    echo ""
    echo "✅ 技術領域判定システム デモ完了"
fi

# メイン実行（引数指定時）
if [ $# -eq 2 ]; then
    get_appropriate_director "$1" "$2"
fi