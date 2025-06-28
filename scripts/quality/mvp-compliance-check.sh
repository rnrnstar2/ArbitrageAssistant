#!/bin/bash

# 🛡️ MVP準拠強制チェックスクリプト
# 使用法: ./scripts/mvp-compliance-check.sh [ファイルパス]

set -e

echo "🛡️ MVP準拠強制チェック開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 引数チェック
if [ $# -eq 0 ]; then
    echo "使用法: $0 <ファイルパス または ディレクトリ>"
    echo "例: $0 packages/shared-backend/amplify/data/resource.ts"
    echo "例: $0 apps/hedge-system/"
    exit 1
fi

TARGET=$1
VIOLATIONS=0

echo "🎯 検査対象: $TARGET"
echo ""

# 禁止キーワード検出
echo "📋 MVP範囲外実装検出中..."

FORBIDDEN_KEYWORDS=(
    "Performance.*Table\|Analytics.*Table\|Metrics.*Table"
    "AITrading\|MachineLearning\|HighFrequency"
    "Kubernetes\|Docker.*Compose\|Microservice"
    "Multi.*Broker\|Multi.*Platform"
    "Advanced.*Dashboard\|Complex.*Chart"
    "RESTful.*API\|GraphQL.*Complex"
)

FORBIDDEN_DESCRIPTIONS=(
    "Performance/Analytics/Metricsテーブル"
    "AI・機械学習・高頻度取引"
    "Kubernetes・マイクロサービス"
    "マルチブローカー・マルチプラットフォーム"
    "高度なダッシュボード・複雑チャート"
    "RESTful API・複雑GraphQL"
)

for i in "${!FORBIDDEN_KEYWORDS[@]}"; do
    KEYWORD="${FORBIDDEN_KEYWORDS[$i]}"
    DESCRIPTION="${FORBIDDEN_DESCRIPTIONS[$i]}"
    
    if [ -f "$TARGET" ]; then
        MATCHES=$(grep -n -E "$KEYWORD" "$TARGET" 2>/dev/null || true)
    else
        MATCHES=$(find "$TARGET" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mq5" -o -name "*.cpp" \) -exec grep -l -E "$KEYWORD" {} \; 2>/dev/null || true)
    fi
    
    if [ -n "$MATCHES" ]; then
        echo "🚨 MVP範囲外実装検出: $DESCRIPTION"
        echo "$MATCHES"
        echo ""
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
done

# 必須実装確認（Backend）
if [[ "$TARGET" == *"shared-backend"* ]] || [[ "$TARGET" == *"amplify"* ]]; then
    echo "📊 Backend必須実装確認中..."
    
    REQUIRED_MODELS=("User" "Account" "Position" "Action")
    for MODEL in "${REQUIRED_MODELS[@]}"; do
        if [ -f "$TARGET" ]; then
            MODEL_FOUND=$(grep -c "model $MODEL\|interface $MODEL\|type $MODEL" "$TARGET" 2>/dev/null || echo "0")
        else
            MODEL_FOUND=$(find "$TARGET" -name "*.ts" -exec grep -l "model $MODEL\|interface $MODEL\|type $MODEL" {} \; 2>/dev/null | wc -l)
        fi
        
        if [ "$MODEL_FOUND" -eq 0 ]; then
            echo "⚠️ 必須モデル未実装: $MODEL"
            VIOLATIONS=$((VIOLATIONS + 1))
        else
            echo "✅ 必須モデル確認: $MODEL"
        fi
    done
fi

# shadcn/ui編集チェック
if [[ "$TARGET" == *"ui"* ]] && [[ "$TARGET" == *"components"* ]]; then
    echo "🎨 shadcn/ui編集チェック中..."
    
    SHADCN_FILES=$(find "$TARGET" -name "*.tsx" -exec grep -l "@/components/ui" {} \; 2>/dev/null || true)
    if [ -n "$SHADCN_FILES" ]; then
        echo "🚨 shadcn/ui編集禁止違反検出"
        echo "$SHADCN_FILES"
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
fi

# 結果サマリー
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 MVP準拠チェック結果"

if [ $VIOLATIONS -eq 0 ]; then
    echo "✅ MVP準拠: 違反なし"
    echo "🛡️ 実装がMVP設計書に準拠しています"
    exit 0
else
    echo "🚨 MVP範囲外違反: $VIOLATIONS件"
    echo "❌ MVP設計書外の実装が検出されました"
    echo ""
    echo "📋 対処方法:"
    echo "1. scripts/directors/common/forbidden-edits.md を確認"
    echo "2. MVPシステム設計.md の要件を再確認"
    echo "3. 不要な実装を削除"
    echo "4. 必要最小限の実装に修正"
    
    exit 1
fi