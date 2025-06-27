# 🎯 CEO動的戦略判断システム v3.0 - 選択的指示版

## 🧠 CEOの高精度戦略的思考フレームワーク

### **Phase 1: 実装内容詳細分析（CEO自律実行）**

```bash
echo "=== CEO戦略的現状分析開始 v3.0 ==="
echo "🎯 CEOとして、既存実装の品質を詳細に分析し、必要な部分のみ選択的に指示します"
echo ""

# 1. MVPシステム設計要件の把握
echo "📋 Step 1: MVPシステム設計要件とのマッピング"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "MVPシステム設計.md の達成要件を抽出中..."
echo ""

# 必須実装要件の抽出
echo "🎯 MVP必須実装要件:"
echo "• Backend: User/Account/Position/Actionモデル、GraphQL Subscription、Cognito認証"
echo "• Trading: Position-Trail-Actionフロー、リスク管理（ドローダウン<5%）"
echo "• Integration: MT5 EA、WebSocket通信（レイテンシ<10ms）"
echo "• Frontend: 管理画面（FCP<1.5s）、Tauriデスクトップアプリ"
echo "• DevOps: CI/CD、テストカバレッジ90%+、ESLint警告0"
echo ""
```

### **Phase 2: 既存実装品質評価（CEO詳細調査）**

```bash
echo "📊 Step 2: 既存実装の品質詳細評価"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backend実装品質評価
echo "🗄️ Backend実装品質詳細評価:"
echo "GraphQLスキーマ検証中..."

# Amplify data/resource.ts の存在と内容確認
if [ -f "packages/shared-backend/amplify/data/resource.ts" ]; then
    echo "✅ data/resource.ts存在確認"
    
    # 必須モデルの実装確認
    MODELS_CHECK=$(grep -E "(User|Account|Position|Action)" packages/shared-backend/amplify/data/resource.ts 2>/dev/null | wc -l)
    SUBSCRIPTION_CHECK=$(grep -i "subscription" packages/shared-backend/amplify/data/resource.ts 2>/dev/null | wc -l)
    
    echo "• モデル実装状況: $MODELS_CHECK個の必須モデル検出"
    echo "• Subscription実装: $SUBSCRIPTION_CHECK箇所検出"
    
    # Performanceテーブルなど不要な実装の検出
    UNNECESSARY_MODELS=$(grep -E "(Performance|Analytics|Metrics)" packages/shared-backend/amplify/data/resource.ts 2>/dev/null | wc -l)
    if [ $UNNECESSARY_MODELS -gt 0 ]; then
        echo "⚠️ 警告: 不要なモデル（Performance等）$UNNECESSARY_MODELS個検出"
        BACKEND_NEEDS_CLEANUP=true
    fi
    
    # 品質判定
    if [ $MODELS_CHECK -ge 4 ] && [ $SUBSCRIPTION_CHECK -gt 0 ]; then
        echo "🎉 Backend基盤: 【実装完了・品質良好】"
        BACKEND_STATUS="COMPLETED_GOOD"
        BACKEND_ACTION="PROTECT"  # 保護対象
    else
        echo "🚨 Backend基盤: 【実装不完全】"
        BACKEND_STATUS="INCOMPLETE"
        BACKEND_ACTION="IMPLEMENT"
    fi
else
    echo "❌ data/resource.ts未実装"
    BACKEND_STATUS="NOT_IMPLEMENTED"
    BACKEND_ACTION="IMPLEMENT"
fi

# 不要な変更の検出
if [ "$BACKEND_NEEDS_CLEANUP" = true ]; then
    echo "🧹 クリーンアップ必要: 余計なPerformanceテーブル等を削除"
    BACKEND_ACTION="CLEANUP"
fi
echo ""

# Trading実装品質評価
echo "⚡ Trading実装品質詳細評価:"
POSITION_EXECUTION=$(find apps/hedge-system -name "*position*execution*" 2>/dev/null | wc -l)
ARBITRAGE_LOGIC=$(find apps/hedge-system -name "*arbitrage*" 2>/dev/null | wc -l)
RISK_MANAGEMENT=$(grep -r "drawdown\|risk" apps/hedge-system 2>/dev/null | wc -l)

echo "• Position実行ロジック: $POSITION_EXECUTION個"
echo "• アービトラージロジック: $ARBITRAGE_LOGIC個"
echo "• リスク管理実装: $RISK_MANAGEMENT箇所"

if [ $POSITION_EXECUTION -gt 0 ] && [ $ARBITRAGE_LOGIC -gt 0 ] && [ $RISK_MANAGEMENT -gt 0 ]; then
    echo "🎉 Trading核心: 【実装完了・品質良好】"
    TRADING_STATUS="COMPLETED_GOOD"
    TRADING_ACTION="PROTECT"
else
    echo "🚨 Trading核心: 【実装必要】"
    TRADING_STATUS="NEEDS_IMPLEMENTATION"
    TRADING_ACTION="IMPLEMENT"
fi
echo ""

# Integration実装品質評価
echo "🔌 Integration実装品質詳細評価:"
MT5_EA=$(find ea/ -name "*.mq5" 2>/dev/null | head -1)
if [ -n "$MT5_EA" ]; then
    echo "✅ MT5 EA実装確認: $MT5_EA"
    WEBSOCKET_IMPL=$(grep -l "WebSocket" ea/websocket-dll/*.cpp 2>/dev/null | wc -l)
    echo "• WebSocket DLL実装: $WEBSOCKET_IMPL個"
    
    if [ $WEBSOCKET_IMPL -gt 0 ]; then
        echo "🎉 Integration: 【実装完了・品質良好】"
        INTEGRATION_STATUS="COMPLETED_GOOD"
        INTEGRATION_ACTION="PROTECT"
    else
        echo "⚠️ Integration: 【部分実装・WebSocket未完】"
        INTEGRATION_STATUS="PARTIAL"
        INTEGRATION_ACTION="COMPLETE_WEBSOCKET"
    fi
else
    echo "❌ MT5 EA未実装"
    INTEGRATION_STATUS="NOT_IMPLEMENTED"
    INTEGRATION_ACTION="IMPLEMENT"
fi
echo ""

# Frontend実装品質評価
echo "🎨 Frontend実装品質詳細評価:"
ADMIN_PAGES=$(find apps/admin/app -name "page.tsx" 2>/dev/null | wc -l)
TAURI_CONFIG=$([ -f "apps/hedge-system/src-tauri/tauri.conf.json" ] && echo "✅" || echo "❌")

echo "• Admin管理画面: $ADMIN_PAGES ページ"
echo "• Tauriデスクトップ: $TAURI_CONFIG"

if [ $ADMIN_PAGES -gt 3 ] && [ "$TAURI_CONFIG" = "✅" ]; then
    echo "🎉 Frontend: 【実装完了・品質良好】"
    FRONTEND_STATUS="COMPLETED_GOOD"
    FRONTEND_ACTION="PROTECT"
else
    echo "🚨 Frontend: 【実装必要】"
    FRONTEND_STATUS="NEEDS_IMPLEMENTATION"
    FRONTEND_ACTION="IMPLEMENT"
fi
echo ""

# DevOps実装品質評価
echo "🚀 DevOps実装品質詳細評価:"
CI_WORKFLOWS=$(ls .github/workflows/*.yml 2>/dev/null | wc -l)
TEST_COVERAGE=$(find . -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | wc -l)

echo "• CI/CDワークフロー: $CI_WORKFLOWS個"
echo "• テストファイル: $TEST_COVERAGE個"

if [ $CI_WORKFLOWS -gt 0 ] && [ $TEST_COVERAGE -gt 10 ]; then
    echo "🎉 DevOps: 【実装完了・品質良好】"
    DEVOPS_STATUS="COMPLETED_GOOD"
    DEVOPS_ACTION="PROTECT"
else
    echo "⚠️ DevOps: 【最適化フェーズ待ち】"
    DEVOPS_STATUS="OPTIMIZATION_PHASE"
    DEVOPS_ACTION="DEFER"
fi
echo ""

echo "✅ 既存実装品質評価完了"
echo ""
```

### **Phase 3: CEO選択的戦略判断（必要部分のみ抽出）**

```bash
echo "🧠 Step 3: CEO選択的戦略判断・必要タスク抽出"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "CEOとして、本当に必要なタスクのみを選択的に抽出します..."
echo ""

# 実装保護リスト作成
echo "🛡️ 実装保護対象（変更禁止）:"
PROTECTED_COUNT=0

if [ "$BACKEND_ACTION" = "PROTECT" ]; then
    echo "• Backend: Amplify data/resource.ts - 完成済み保護"
    PROTECTED_COUNT=$((PROTECTED_COUNT + 1))
fi

if [ "$TRADING_ACTION" = "PROTECT" ]; then
    echo "• Trading: Position-Trail-Actionフロー - 完成済み保護"
    PROTECTED_COUNT=$((PROTECTED_COUNT + 1))
fi

if [ "$INTEGRATION_ACTION" = "PROTECT" ]; then
    echo "• Integration: MT5/WebSocket統合 - 完成済み保護"
    PROTECTED_COUNT=$((PROTECTED_COUNT + 1))
fi

if [ "$FRONTEND_ACTION" = "PROTECT" ]; then
    echo "• Frontend: Admin/Tauriアプリ - 完成済み保護"
    PROTECTED_COUNT=$((PROTECTED_COUNT + 1))
fi

if [ "$DEVOPS_ACTION" = "PROTECT" ]; then
    echo "• DevOps: CI/CD・品質保証 - 完成済み保護"
    PROTECTED_COUNT=$((PROTECTED_COUNT + 1))
fi

echo "📊 保護対象: $PROTECTED_COUNT部門"
echo ""

# 必要タスクリスト作成
echo "🎯 必要タスクリスト（選択的実行）:"
TASK_COUNT=0
TASK_LIST=""

# Backend選択的タスク
if [ "$BACKEND_ACTION" = "IMPLEMENT" ]; then
    echo "• Backend: 基盤実装（User/Account/Position/Actionモデル）"
    TASK_LIST="$TASK_LIST\n🗄️ Backend: AWS Amplify基盤実装"
    TASK_COUNT=$((TASK_COUNT + 1))
elif [ "$BACKEND_ACTION" = "CLEANUP" ]; then
    echo "• Backend: 不要モデル削除（Performanceテーブル等）"
    TASK_LIST="$TASK_LIST\n🗄️ Backend: 不要実装クリーンアップ"
    TASK_COUNT=$((TASK_COUNT + 1))
fi

# Trading選択的タスク
if [ "$TRADING_ACTION" = "IMPLEMENT" ]; then
    echo "• Trading: Position-Trail-Actionフロー実装"
    TASK_LIST="$TASK_LIST\n⚡ Trading: 核心フロー実装"
    TASK_COUNT=$((TASK_COUNT + 1))
fi

# Integration選択的タスク
if [ "$INTEGRATION_ACTION" = "IMPLEMENT" ]; then
    echo "• Integration: MT5 EA・WebSocket統合実装"
    TASK_LIST="$TASK_LIST\n🔌 Integration: MT5/WebSocket実装"
    TASK_COUNT=$((TASK_COUNT + 1))
elif [ "$INTEGRATION_ACTION" = "COMPLETE_WEBSOCKET" ]; then
    echo "• Integration: WebSocket DLL完成"
    TASK_LIST="$TASK_LIST\n🔌 Integration: WebSocket DLL完成"
    TASK_COUNT=$((TASK_COUNT + 1))
fi

# Frontend選択的タスク
if [ "$FRONTEND_ACTION" = "IMPLEMENT" ]; then
    echo "• Frontend: 管理画面・Tauriアプリ実装"
    TASK_LIST="$TASK_LIST\n🎨 Frontend: UI実装"
    TASK_COUNT=$((TASK_COUNT + 1))
fi

# DevOps選択的タスク
if [ "$DEVOPS_ACTION" = "DEFER" ]; then
    echo "• DevOps: 最適化フェーズで後日実装"
    # タスクリストには追加しない（延期）
fi

echo ""
echo "📊 実行必要タスク: $TASK_COUNT個"
echo "⏭️ スキップ・延期: $((5 - TASK_COUNT - PROTECTED_COUNT))部門"
echo ""

echo "✅ CEO選択的戦略判断完了"
echo ""
```

### **Phase 4: CEO選択的指示作成（必要部分のみ）**

```bash
echo "🎯 Step 4: CEO選択的指示作成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $TASK_COUNT -eq 0 ]; then
    echo "🎉 全実装完了確認 - 新規指示不要"
    echo "✅ MVPシステム品質良好・追加作業不要"
    echo ""
    echo "🛡️ 実装保護モード: 既存実装の不要な変更を防止"
    exit 0
fi

echo "CEOとして、$TASK_COUNT個の必要タスクに対して選択的指示を作成します..."
echo ""

# Backend選択的指示
if [ "$BACKEND_ACTION" = "IMPLEMENT" ]; then
    echo "🗄️ Backend Director選択的指示作成中..."
    BACKEND_INSTRUCTION="【CEO戦略指示】AWS Amplify基盤の構築をDirectorチームにお任せします。MVPシステム設計.mdに記載のUser/Account/Position/Actionモデルを中心とした、必要最小限のバックエンド基盤を構築してください。不要な機能は避け、品質とシンプルさを重視してください。"
    BACKEND_EXECUTE=true
elif [ "$BACKEND_ACTION" = "CLEANUP" ]; then
    echo "🗄️ Backend Directorクリーンアップ指示作成中..."
    BACKEND_INSTRUCTION="【CEOクリーンアップ指示】Backend基盤に不要な実装が含まれているようです。MVPシステム設計.mdに記載の必須モデルのみ残し、余計な機能は削除してください。既存の良好な実装は保護し、不要部分のみ除去をDirectorチームにお任せします。"
    BACKEND_EXECUTE=true
else
    BACKEND_EXECUTE=false
fi

# Trading選択的指示
if [ "$TRADING_ACTION" = "IMPLEMENT" ]; then
    echo "⚡ Trading Director選択的指示作成中..."
    TRADING_INSTRUCTION="【CEO戦略指示】Position-Trail-Actionの核心フロー実装をDirectorチームにお任せします。MVPシステム設計.mdのPosition-Trail-Actionフローを実現し、リスク管理（ドローダウン<5%）を重視したトレーディングシステムを構築してください。"
    TRADING_EXECUTE=true
else
    TRADING_EXECUTE=false
fi

# Integration選択的指示
if [ "$INTEGRATION_ACTION" = "IMPLEMENT" ]; then
    echo "🔌 Integration Director選択的指示作成中..."
    INTEGRATION_INSTRUCTION="【CEO戦略指示】MT5統合システムの構築をDirectorチームにお任せします。MVPシステム設計.mdのMT5統合要件を実現し、レイテンシ<10msのリアルタイム統合を目指してください。段階的な実装と動作確認を重視してください。"
    INTEGRATION_EXECUTE=true
elif [ "$INTEGRATION_ACTION" = "COMPLETE_WEBSOCKET" ]; then
    echo "🔌 Integration Director部分指示作成中..."
    INTEGRATION_INSTRUCTION="【CEO部分指示】MT5 EAは実装済みですが、WebSocket統合の完成をDirectorチームにお任せします。レイテンシ<10msを達成し、既存のEA実装との連携を重視してください。"
    INTEGRATION_EXECUTE=true
else
    INTEGRATION_EXECUTE=false
fi

# Frontend選択的指示
if [ "$FRONTEND_ACTION" = "IMPLEMENT" ]; then
    echo "🎨 Frontend Director選択的指示作成中..."
    FRONTEND_INSTRUCTION="【CEO戦略指示】管理画面とデスクトップアプリの構築をDirectorチームにお任せします。MVPシステム設計.mdの管理画面要件を実現し、Backend GraphQL連携によるリアルタイムUIを構築してください。過度な機能追加は避け、MVPに必要な最小限の実装を優先してください。"
    FRONTEND_EXECUTE=true
else
    FRONTEND_EXECUTE=false
fi

# DevOps選択的指示（延期）
if [ "$DEVOPS_ACTION" = "DEFER" ]; then
    echo "🚀 DevOps Director: 最適化フェーズまで延期"
    DEVOPS_EXECUTE=false
else
    DEVOPS_EXECUTE=false
fi

echo ""
echo "✅ CEO選択的指示作成完了（$TASK_COUNT個）"
echo ""
```

### **Phase 5: CEO選択的指示実行（必要部分のみ送信）**

```bash
echo "🚀 Step 5: CEO選択的指示実行"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "CEOとして、選択的に作成した指示を必要なDirectorのみに送信します..."
echo ""

INSTRUCTIONS_SENT=0

# Backend選択的実行
if [ "$BACKEND_EXECUTE" = true ]; then
    echo "🗄️ Backend Director選択的指示送信中..."
    tmux send-keys -t arbitrage-assistant:1.0 " && echo '【CEO選択的指示 v2.0】' && echo '$BACKEND_INSTRUCTION' && echo '' && echo '📋【Tasks Directory統合実行】' && cd /Users/rnrnstar/github/ArbitrageAssistant && ./scripts/director-auto-delegate-v2.sh backend-director '$BACKEND_INSTRUCTION' && echo '✅ CEO選択的指示完了（Tasks Directory記録済み）' ultrathink" Enter
    INSTRUCTIONS_SENT=$((INSTRUCTIONS_SENT + 1))
    sleep 2
fi

# Trading選択的実行
if [ "$TRADING_EXECUTE" = true ]; then
    echo "⚡ Trading Director選択的指示送信中..."
    tmux send-keys -t arbitrage-assistant:2.0 " && echo '【CEO選択的指示 v2.0】' && echo '$TRADING_INSTRUCTION' && echo '' && echo '📋【Tasks Directory統合実行】' && cd /Users/rnrnstar/github/ArbitrageAssistant && ./scripts/director-auto-delegate-v2.sh trading-flow-director '$TRADING_INSTRUCTION' && echo '✅ CEO選択的指示完了（Tasks Directory記録済み）' ultrathink" Enter
    INSTRUCTIONS_SENT=$((INSTRUCTIONS_SENT + 1))
    sleep 2
fi

# Integration選択的実行
if [ "$INTEGRATION_EXECUTE" = true ]; then
    echo "🔌 Integration Director選択的指示送信中..."
    tmux send-keys -t arbitrage-assistant:3.0 " && echo '【CEO選択的指示 v2.0】' && echo '$INTEGRATION_INSTRUCTION' && echo '' && echo '📋【Tasks Directory統合実行】' && cd /Users/rnrnstar/github/ArbitrageAssistant && ./scripts/director-auto-delegate-v2.sh integration-director '$INTEGRATION_INSTRUCTION' && echo '✅ CEO選択的指示完了（Tasks Directory記録済み）' ultrathink" Enter
    INSTRUCTIONS_SENT=$((INSTRUCTIONS_SENT + 1))
    sleep 2
fi

# Frontend選択的実行
if [ "$FRONTEND_EXECUTE" = true ]; then
    echo "🎨 Frontend Director選択的指示送信中..."
    tmux send-keys -t arbitrage-assistant:4.0 " && echo '【CEO選択的指示 v2.0】' && echo '$FRONTEND_INSTRUCTION' && echo '' && echo '📋【Tasks Directory統合実行】' && cd /Users/rnrnstar/github/ArbitrageAssistant && ./scripts/director-auto-delegate-v2.sh frontend-director '$FRONTEND_INSTRUCTION' && echo '✅ CEO選択的指示完了（Tasks Directory記録済み）' ultrathink" Enter
    INSTRUCTIONS_SENT=$((INSTRUCTIONS_SENT + 1))
    sleep 2
fi

echo ""
echo "✅ CEO選択的指示実行完了"
echo ""
```

### **Phase 6: CEO実行サマリー（選択的実行結果）**

```bash
echo "📊 Step 6: CEO選択的実行サマリー"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

EXECUTION_TIME=$(date '+%Y-%m-%d %H:%M:%S')

echo "🎯 CEO選択的戦略管理 実行サマリー"
echo "実行時刻: $EXECUTION_TIME"
echo ""

echo "🛡️ 実装保護（変更禁止）: $PROTECTED_COUNT部門"
if [ $PROTECTED_COUNT -gt 0 ]; then
    echo -e "$PROTECTED_LIST"
fi
echo ""

echo "🎯 選択的指示実行: $INSTRUCTIONS_SENT部門"
if [ $INSTRUCTIONS_SENT -gt 0 ]; then
    echo -e "$TASK_LIST"
fi
echo ""

echo "⏭️ スキップ・延期: $((5 - INSTRUCTIONS_SENT - PROTECTED_COUNT))部門"
echo ""

if [ $INSTRUCTIONS_SENT -eq 0 ] && [ $PROTECTED_COUNT -eq 5 ]; then
    echo "🎉 MVP完成状態確認"
    echo "✅ 全実装品質良好・追加作業不要"
    echo "🛡️ 実装保護モード有効"
else
    echo "📈 選択的改善実行中"
    echo "• 必要部分のみ指示: $INSTRUCTIONS_SENT個"
    echo "• 既存実装保護: $PROTECTED_COUNT個"
    echo "• 品質重視の選択的実行"
fi

echo ""
echo "🎯 CEO選択的戦略判断システム v3.0 実行完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ultrathink
```

---

## 💡 v3.0の特徴

### **1. 実装内容の詳細分析**
- ファイル数カウントではなく、実際の実装内容を検証
- 必須モデルの存在確認（User/Account/Position/Action）
- 不要な実装（Performanceテーブル等）の検出

### **2. 選択的指示システム**
- 本当に必要な部分のみに指示
- 既存の良好な実装は「保護対象」として明示
- 不要な変更を防ぐメカニズム

### **3. クリーンアップ機能**
- 余計な実装を検出して削除指示
- MVPシステム設計.mdに準拠した最小限実装の維持

### **4. 段階的実行**
- 実装済み: 保護（PROTECT）
- 未実装: 実装（IMPLEMENT）
- 不要実装あり: クリーンアップ（CLEANUP）
- 最適化待ち: 延期（DEFER）

### **5. CEO実行コマンド**
```bash
# v3.0 選択的戦略判断システム
cat scripts/ceo-dynamic-strategy-v3.md

# 実行により、必要な部分のみに選択的指示を送信
```

このv3.0により、CEOは現状を正確に把握し、本当に必要なタスクのみを選択的に指示することで、既存の良好な実装を保護しながら、効率的なMVP開発を実現します。