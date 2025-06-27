#!/bin/bash

# 📊 CEO Analytics 自動実行システム
# CEO Supreme起動後の自動品質監視・分析スクリプト

echo "📊 CEO Analytics 自動分析開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "役割: 全体分析・品質評価・リスク監視（指示権限なし）"
echo "権限: 分析・報告のみ・指示権限なし"
echo ""

# Phase 1: MVP準拠チェック
echo "🛡️ Phase 1: MVP準拠チェック"
echo "────────────────────────────────────────────────"

MVP_VIOLATIONS=0

# Backend MVP準拠チェック
if [ -f "packages/shared-backend/amplify/data/resource.ts" ]; then
    echo "🗄️ Backend MVP準拠分析..."
    
    # 必須モデル確認
    REQUIRED_MODELS=("User" "Account" "Position" "Action")
    FOUND_MODELS=0
    
    for model in "${REQUIRED_MODELS[@]}"; do
        if grep -q "$model" packages/shared-backend/amplify/data/resource.ts; then
            echo "  ✅ $model モデル確認"
            FOUND_MODELS=$((FOUND_MODELS + 1))
        else
            echo "  ❌ $model モデル未実装"
        fi
    done
    
    # 禁止モデル確認
    FORBIDDEN_MODELS=("Performance" "Analytics" "Metrics" "Log" "Report")
    FORBIDDEN_FOUND=0
    
    for model in "${FORBIDDEN_MODELS[@]}"; do
        if grep -q "$model" packages/shared-backend/amplify/data/resource.ts 2>/dev/null; then
            echo "  🚨 禁止モデル検出: $model"
            FORBIDDEN_FOUND=$((FORBIDDEN_FOUND + 1))
            MVP_VIOLATIONS=$((MVP_VIOLATIONS + 1))
        fi
    done
    
    echo "  📊 必須モデル: $FOUND_MODELS/4"
    echo "  🚨 違反モデル: $FORBIDDEN_FOUND個"
else
    echo "  ⚠️ Backend実装未確認"
    MVP_VIOLATIONS=$((MVP_VIOLATIONS + 1))
fi

# Trading MVP準拠チェック
echo ""
echo "⚡ Trading MVP準拠分析..."
TRADING_FILES=$(find apps/hedge-system/lib -name "*position*" -o -name "*arbitrage*" -o -name "*trading*" 2>/dev/null | wc -l | tr -d ' ')
echo "  📊 Trading実装ファイル: $TRADING_FILES個"

if [ "$TRADING_FILES" -lt 3 ]; then
    echo "  ⚠️ Trading実装不足の可能性"
    MVP_VIOLATIONS=$((MVP_VIOLATIONS + 1))
else
    echo "  ✅ Trading実装確認"
fi

# Integration MVP準拠チェック
echo ""
echo "🔌 Integration MVP準拠分析..."
EA_FILES=$(find ea/ -name "*.mq5" 2>/dev/null | wc -l | tr -d ' ')
WEBSOCKET_FILES=$(find ea/ -name "*websocket*" 2>/dev/null | wc -l | tr -d ' ')
echo "  📊 EA実装: $EA_FILES個"
echo "  📊 WebSocket実装: $WEBSOCKET_FILES個"

if [ "$EA_FILES" -eq 0 ] || [ "$WEBSOCKET_FILES" -eq 0 ]; then
    echo "  ⚠️ Integration実装不足の可能性"
    MVP_VIOLATIONS=$((MVP_VIOLATIONS + 1))
else
    echo "  ✅ Integration実装確認"
fi

# Frontend MVP準拠チェック
echo ""
echo "🎨 Frontend MVP準拠分析..."
ADMIN_PAGES=$(find apps/admin/app -name "page.tsx" 2>/dev/null | wc -l | tr -d ' ')
TAURI_CONFIG=$([ -f "apps/hedge-system/src-tauri/tauri.conf.json" ] && echo "1" || echo "0")
echo "  📊 Admin画面: $ADMIN_PAGES個"
echo "  📊 Tauri設定: $TAURI_CONFIG"

if [ "$ADMIN_PAGES" -lt 3 ] || [ "$TAURI_CONFIG" = "0" ]; then
    echo "  ⚠️ Frontend実装不足の可能性"
    MVP_VIOLATIONS=$((MVP_VIOLATIONS + 1))
else
    echo "  ✅ Frontend実装確認"
fi

echo ""

# Phase 2: 品質分析
echo "📈 Phase 2: 品質分析"
echo "────────────────────────────────────────────────"

QUALITY_ISSUES=0

# TypeScript型エラー確認
echo "🔍 TypeScript品質分析..."
if command -v npm >/dev/null 2>&1; then
    # Backend型チェック（簡易版）
    if [ -d "apps/hedge-system" ]; then
        cd apps/hedge-system
        TYPE_ERRORS=$(npm run check-types 2>&1 | grep -c "error" || echo "0")
        cd - >/dev/null
        echo "  📊 hedge-system型エラー: $TYPE_ERRORS個"
        if [ "$TYPE_ERRORS" -gt 0 ]; then
            QUALITY_ISSUES=$((QUALITY_ISSUES + TYPE_ERRORS))
        fi
    fi
    
    # Admin型チェック（簡易版）
    if [ -d "apps/admin" ]; then
        cd apps/admin
        ADMIN_TYPE_ERRORS=$(npm run check-types 2>&1 | grep -c "error" || echo "0")
        cd - >/dev/null
        echo "  📊 admin型エラー: $ADMIN_TYPE_ERRORS個"
        if [ "$ADMIN_TYPE_ERRORS" -gt 0 ]; then
            QUALITY_ISSUES=$((QUALITY_ISSUES + ADMIN_TYPE_ERRORS))
        fi
    fi
else
    echo "  ⚠️ npm未利用（型チェックスキップ）"
fi

# Lint分析
echo ""
echo "🧹 Lint品質分析..."
if command -v npm >/dev/null 2>&1; then
    LINT_WARNINGS=$(npm run lint 2>&1 | grep -c "warning\|error" || echo "0")
    echo "  📊 Lint警告・エラー: $LINT_WARNINGS個"
    if [ "$LINT_WARNINGS" -gt 0 ]; then
        QUALITY_ISSUES=$((QUALITY_ISSUES + LINT_WARNINGS))
    fi
else
    echo "  ⚠️ Lint確認スキップ"
fi

# ファイルサイズ分析
echo ""
echo "📏 ファイルサイズ分析..."
LARGE_FILES=$(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs wc -l 2>/dev/null | awk '$1 > 500 {print $1, $2}' | wc -l | tr -d ' ')
echo "  📊 大型ファイル（500行超）: $LARGE_FILES個"
if [ "$LARGE_FILES" -gt 10 ]; then
    echo "  ⚠️ 大型ファイル過多 - リファクタリング検討"
    QUALITY_ISSUES=$((QUALITY_ISSUES + 1))
fi

echo ""

# Phase 3: リスク監視
echo "🚨 Phase 3: リスク監視"
echo "────────────────────────────────────────────────"

RISK_LEVEL=0

# Git未コミット変更確認
UNCOMMITTED_FILES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
echo "🔄 Git未コミット変更: $UNCOMMITTED_FILES個"
if [ "$UNCOMMITTED_FILES" -gt 20 ]; then
    echo "  ⚠️ 大量未コミット変更 - データ損失リスク"
    RISK_LEVEL=$((RISK_LEVEL + 1))
fi

# セキュリティリスク確認
echo ""
echo "🔒 セキュリティリスク分析..."
SECRET_FILES=$(find . -name "*.env*" -o -name "*.key" -o -name "*secret*" | grep -v node_modules | wc -l | tr -d ' ')
HARDCODED_SECRETS=$(grep -r "password\|secret\|key.*=" . --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules 2>/dev/null | wc -l | tr -d ' ')
echo "  📊 シークレットファイル: $SECRET_FILES個"
echo "  📊 ハードコード疑い: $HARDCODED_SECRETS個"
if [ "$HARDCODED_SECRETS" -gt 5 ]; then
    echo "  🚨 ハードコードシークレット疑い - セキュリティリスク"
    RISK_LEVEL=$((RISK_LEVEL + 2))
fi

# パフォーマンスリスク確認
echo ""
echo "⚡ パフォーマンスリスク分析..."
NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1 || echo "unknown")
echo "  📊 node_modules サイズ: $NODE_MODULES_SIZE"

# ビルド時間推定（簡易）
if [ -f "package.json" ]; then
    DEPENDENCIES=$(grep -c '"' package.json | head -1)
    echo "  📊 依存関係概算: $DEPENDENCIES個"
    if [ "$DEPENDENCIES" -gt 100 ]; then
        echo "  ⚠️ 依存関係過多 - ビルド時間リスク"
        RISK_LEVEL=$((RISK_LEVEL + 1))
    fi
fi

echo ""

# Phase 4: 総合分析結果
echo "📊 Phase 4: 総合分析結果"
echo "────────────────────────────────────────────────"

# 総合スコア計算
TOTAL_ISSUES=$((MVP_VIOLATIONS + QUALITY_ISSUES + RISK_LEVEL))
if [ "$TOTAL_ISSUES" -eq 0 ]; then
    HEALTH_SCORE="A+"
    HEALTH_COLOR="✅"
elif [ "$TOTAL_ISSUES" -le 5 ]; then
    HEALTH_SCORE="B+"
    HEALTH_COLOR="🟡"
elif [ "$TOTAL_ISSUES" -le 15 ]; then
    HEALTH_SCORE="C"
    HEALTH_COLOR="🟠"
else
    HEALTH_SCORE="D"
    HEALTH_COLOR="🔴"
fi

echo "$HEALTH_COLOR プロジェクト健全性: $HEALTH_SCORE"
echo "📊 総合課題数: $TOTAL_ISSUES個"
echo ""
echo "内訳:"
echo "  🛡️ MVP準拠違反: $MVP_VIOLATIONS個"
echo "  📈 品質課題: $QUALITY_ISSUES個"  
echo "  🚨 リスク要因: $RISK_LEVEL個"

echo ""

# Phase 5: 分析結果保存
echo "💾 Phase 5: 分析結果保存"
echo "────────────────────────────────────────────────"

ANALYTICS_REPORT="tasks/ceo-analytics-report-$(date '+%Y%m%d_%H%M%S').md"
mkdir -p "tasks"

cat > "$ANALYTICS_REPORT" << EOF
# CEO Analytics 分析レポート

## 📊 分析情報
- **実行日時**: $(date '+%Y-%m-%d %H:%M:%S')
- **分析者**: CEO Analytics（自律監視）
- **分析対象**: 全部門 + MVP準拠 + 品質 + リスク

## 🎯 総合評価
- **健全性スコア**: $HEALTH_SCORE
- **総合課題数**: $TOTAL_ISSUES個

### 課題内訳
- **MVP準拠違反**: $MVP_VIOLATIONS個
- **品質課題**: $QUALITY_ISSUES個
- **リスク要因**: $RISK_LEVEL個

## 🛡️ MVP準拠分析
### Backend
- **必須モデル**: $FOUND_MODELS/4 実装
- **禁止モデル**: $FORBIDDEN_FOUND個 検出

### Trading
- **実装ファイル**: $TRADING_FILES個

### Integration
- **EA実装**: $EA_FILES個
- **WebSocket実装**: $WEBSOCKET_FILES個

### Frontend
- **Admin画面**: $ADMIN_PAGES個
- **Tauri設定**: $TAURI_CONFIG

## 📈 品質分析
- **TypeScript型エラー**: $TYPE_ERRORS + $ADMIN_TYPE_ERRORS個
- **Lint警告・エラー**: $LINT_WARNINGS個
- **大型ファイル**: $LARGE_FILES個

## 🚨 リスク分析
- **未コミット変更**: $UNCOMMITTED_FILES個
- **ハードコード疑い**: $HARDCODED_SECRETS個
- **依存関係**: $DEPENDENCIES個
- **node_modules**: $NODE_MODULES_SIZE

## 💡 推奨アクション
$(if [ "$MVP_VIOLATIONS" -gt 0 ]; then
    echo "### 🚨 高優先度（MVP準拠違反）"
    echo "- Backend禁止モデル削除"
    echo "- 必須実装の完成"
    echo ""
fi)

$(if [ "$QUALITY_ISSUES" -gt 10 ]; then
    echo "### 📈 中優先度（品質改善）"
    echo "- TypeScript型エラー修正"
    echo "- Lint警告解決"
    echo "- 大型ファイルリファクタリング"
    echo ""
fi)

$(if [ "$RISK_LEVEL" -gt 2 ]; then
    echo "### 🚨 注意事項（リスク管理）"
    echo "- セキュリティチェック"
    echo "- 定期的なコミット"
    echo "- 依存関係最適化"
    echo ""
fi)

## 🔄 Next Actions
1. **継続監視**: リアルタイム品質監視
2. **CEO Operations連携**: 課題報告・調整依頼
3. **Director通知**: 重要課題の個別通知

---
*CEO Analytics自律分析システム - 指示権限なし・分析専門*
EOF

echo "📁 分析結果保存: $ANALYTICS_REPORT"

# 重要課題がある場合はCEO Operationsに通知
if [ "$TOTAL_ISSUES" -gt 10 ]; then
    echo ""
    echo "🚨 重要課題検出 - CEO Operations通知送信..."
    
    if tmux has-session -t arbitrage-assistant 2>/dev/null; then
        ALERT_MSG="【CEO Analytics 緊急報告】
🚨 重要課題検出: $TOTAL_ISSUES個
📊 健全性スコア: $HEALTH_SCORE
🛡️ MVP準拠違反: $MVP_VIOLATIONS個
📈 品質課題: $QUALITY_ISSUES個
🚨 リスク要因: $RISK_LEVEL個

📁 詳細: $ANALYTICS_REPORT
💡 推奨: Director進捗確認・品質チェック強化"
        
        tmux send-keys -t arbitrage-assistant:0.1 " && echo '$ALERT_MSG'" Enter
        echo "  ✅ CEO Operations通知送信完了"
    fi
fi

echo ""
echo "✅ CEO Analytics 自動分析完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 分析結果: $HEALTH_COLOR $HEALTH_SCORE (課題 $TOTAL_ISSUES個)"
echo "🔄 Next: リアルタイム品質監視・CEO Operations連携"
echo "💾 結果保存: $ANALYTICS_REPORT"

# リアルタイム監視設定（バックグラウンド・軽量）
echo ""
echo "⏰ リアルタイム品質監視設定..."
(sleep 900 && echo "🔄 CEO Analytics 15分監視実行中..." && ./scripts/ceo-analytics-auto.sh) &
CEO_ANALYTICS_PID=$!
echo "🆔 CEO Analytics PID: $CEO_ANALYTICS_PID"

# 通知
if [ "$TOTAL_ISSUES" -gt 10 ]; then
    osascript -e "display notification 'CEO Analytics: 重要課題検出 ($TOTAL_ISSUES個)' with title 'ArbitrageAssistant' sound name 'Sosumi'" 2>/dev/null || true
else
    osascript -e "display notification 'CEO Analytics: 分析完了 ($HEALTH_SCORE)' with title 'ArbitrageAssistant' sound name 'Tink'" 2>/dev/null || true
fi

echo ""
echo "📊 CEO Analytics、品質分析・リスク監視を完了しました。"
echo "継続的な分析により、プロジェクトの健全性を監視します。"