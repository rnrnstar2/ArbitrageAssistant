#!/bin/bash

# 🎯 CEO Supreme Perfect Initial Prompt v6.0
# Haconiwa起動時自動実行・完璧CEO初期プロンプトシステム
# ユーザー要求完全対応版

set -e

echo "🎭 CEO Supreme Perfect Initial Prompt v6.0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 実行時刻記録
EXECUTION_START=$(date '+%Y-%m-%d %H:%M:%S')

# Phase 1: CEO Supreme自己認識・役割確認
echo ""
echo "👑 Phase 1: CEO Supreme自己認識・環境確認"
echo "════════════════════════════════════════════════════════════════════════════════"

# 環境確認
echo "🔍 CEO環境確認中..."
echo "HACONIWA_AGENT_ID: ${HACONIWA_AGENT_ID:-未設定}"
echo "実行ディレクトリ: $(pwd)"
echo "実行時刻: $EXECUTION_START"
echo ""

# CEO Supreme権限確認
if [ "$HACONIWA_AGENT_ID" != "ceo-main" ]; then
    echo "⚠️ 警告: CEO Supreme以外のエージェントが実行"
    echo "適切な権限: HACONIWA_AGENT_ID=ceo-main"
    echo "現在の権限: $HACONIWA_AGENT_ID"
    echo ""
fi

echo "🎯 CEO Supreme責任範囲:"
echo "• MVP全体戦略の意思決定"
echo "• 5 Directors統括・指示送信"
echo "• 完成済み実装の保護"
echo "• Over-Engineering完全防止"
echo ""

# Phase 2: MVPシステム設計詳細分析
echo "📋 Phase 2: MVPシステム設計詳細分析"
echo "════════════════════════════════════════════════════════════════════════════════"

echo "🔍 MVPシステム設計.md要件分析中..."

# MVPシステム設計.md存在確認
if [ ! -f "MVPシステム設計.md" ]; then
    echo "❌ MVPシステム設計.md が見つかりません"
    echo "💡 解決策: MVPシステム設計.md をプロジェクトルートに配置"
    exit 1
fi

echo "✅ MVPシステム設計.md 確認完了"

# MVP核心要件抽出
echo ""
echo "📊 MVP核心要件抽出:"
echo "────────────────────────────────────────────────────────────────────────────────"

# Backend要件
echo "🗄️ Backend要件:"
grep -A 5 "## 2\. データベース設計" "MVPシステム設計.md" | head -5 | sed 's/^/  /'
echo ""

# Trading要件
echo "⚡ Trading要件:"
grep -A 5 "## 4\. 実行パターン詳細" "MVPシステム設計.md" | head -5 | sed 's/^/  /'
echo ""

# Integration要件  
echo "🔌 Integration要件:"
grep -A 5 "## 7\. WebSocket通信設計" "MVPシステム設計.md" | head -5 | sed 's/^/  /'
echo ""

# Frontend要件
echo "🎨 Frontend要件:"
grep -A 5 "### 5-4\. 管理者画面" "MVPシステム設計.md" | head -5 | sed 's/^/  /'
echo ""

# Phase 3: 現在実装状況徹底調査
echo "🔍 Phase 3: 現在実装状況徹底調査"
echo "════════════════════════════════════════════════════════════════════════════════"

echo "📊 各部門実装状況詳細調査中..."

# Backend実装調査（詳細）
echo ""
echo "🗄️ Backend実装状況詳細調査:"
echo "────────────────────────────────────────────────────────────────────────────────"

if [ -f "packages/shared-backend/amplify/data/resource.ts" ]; then
    BACKEND_USER=$(grep -c "User" packages/shared-backend/amplify/data/resource.ts 2>/dev/null || echo "0")
    BACKEND_ACCOUNT=$(grep -c "Account" packages/shared-backend/amplify/data/resource.ts 2>/dev/null || echo "0")
    BACKEND_POSITION=$(grep -c "Position" packages/shared-backend/amplify/data/resource.ts 2>/dev/null || echo "0")
    BACKEND_ACTION=$(grep -c "Action" packages/shared-backend/amplify/data/resource.ts 2>/dev/null || echo "0")
    BACKEND_TOTAL=$((BACKEND_USER + BACKEND_ACCOUNT + BACKEND_POSITION + BACKEND_ACTION))
    
    # 不要実装チェック
    BACKEND_PERFORMANCE=$(grep -c "Performance\|Analytics\|Metrics\|Reporting" packages/shared-backend/amplify/data/resource.ts 2>/dev/null || echo "0")
    
    echo "  必須モデル実装状況: $BACKEND_TOTAL/4"
    echo "    User: $BACKEND_USER"
    echo "    Account: $BACKEND_ACCOUNT" 
    echo "    Position: $BACKEND_POSITION"
    echo "    Action: $BACKEND_ACTION"
    echo "  不要実装: $BACKEND_PERFORMANCE （Performance/Analytics/Metrics等）"
    
    # GraphQL認証確認
    COGNITO_IMPL=$(find packages/shared-backend -name "*auth*" -o -name "*cognito*" | wc -l | xargs)
    echo "  認証実装: $COGNITO_IMPL ファイル"
else
    BACKEND_TOTAL=0
    BACKEND_PERFORMANCE=0
    COGNITO_IMPL=0
    echo "  ❌ Backend基盤未実装"
fi

# Trading実装調査（詳細）
echo ""
echo "⚡ Trading実装状況詳細調査:"
echo "────────────────────────────────────────────────────────────────────────────────"

TRADING_POSITION=$(find apps/hedge-system -name "*position*" 2>/dev/null | wc -l | xargs)
TRADING_ARBITRAGE=$(find apps/hedge-system -name "*arbitrage*" 2>/dev/null | wc -l | xargs)
TRADING_TRAIL=$(find apps/hedge-system -name "*trail*" 2>/dev/null | wc -l | xargs)
TRADING_TOTAL=$((TRADING_POSITION + TRADING_ARBITRAGE + TRADING_TRAIL))

echo "  核心実装状況: $TRADING_TOTAL ファイル"
echo "    Position管理: $TRADING_POSITION ファイル"
echo "    Arbitrage実行: $TRADING_ARBITRAGE ファイル"
echo "    Trail機能: $TRADING_TRAIL ファイル"

# Integration実装調査（詳細）
echo ""
echo "🔌 Integration実装状況詳細調査:"
echo "────────────────────────────────────────────────────────────────────────────────"

INTEGRATION_EA=$(find ea/ -name "*.mq5" 2>/dev/null | wc -l | xargs)
INTEGRATION_WEBSOCKET=$(find ea/ -name "*websocket*" 2>/dev/null | wc -l | xargs)
INTEGRATION_DLL=$(find ea/ -name "*.cpp" -o -name "*.h" 2>/dev/null | wc -l | xargs)

echo "  MT5統合: $INTEGRATION_EA EA ファイル"
echo "  WebSocket通信: $INTEGRATION_WEBSOCKET ファイル"
echo "  DLL実装: $INTEGRATION_DLL ファイル"

# Frontend実装調査（詳細）
echo ""
echo "🎨 Frontend実装状況詳細調査:"
echo "────────────────────────────────────────────────────────────────────────────────"

FRONTEND_ADMIN_PAGES=$(find apps/admin/app -name "page.tsx" 2>/dev/null | wc -l | xargs)
FRONTEND_ADMIN_COMPONENTS=$(find apps/admin -name "*.tsx" 2>/dev/null | wc -l | xargs)
FRONTEND_TAURI=$([ -f "apps/hedge-system/src-tauri/tauri.conf.json" ] && echo "1" || echo "0")
FRONTEND_HEDGE_COMPONENTS=$(find apps/hedge-system/src -name "*.tsx" 2>/dev/null | wc -l | xargs)

echo "  管理画面: $FRONTEND_ADMIN_PAGES ページ、$FRONTEND_ADMIN_COMPONENTS コンポーネント"
echo "  Tauriアプリ: $FRONTEND_TAURI (設定ファイル)"
echo "  Hedge System UI: $FRONTEND_HEDGE_COMPONENTS コンポーネント"

# DevOps実装調査（最適化フェーズ）
echo ""
echo "🚀 DevOps実装状況（最適化フェーズ）:"
echo "────────────────────────────────────────────────────────────────────────────────"

DEVOPS_CI=$(ls .github/workflows/*.yml 2>/dev/null | wc -l | xargs)
DEVOPS_TESTS=$(find . -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | wc -l | xargs)

echo "  CI/CD: $DEVOPS_CI ワークフロー"
echo "  テスト: $DEVOPS_TESTS ファイル"
echo "  📅 実行タイミング: MVP完成後の最適化フェーズ"

# Phase 4: CEO戦略判断（慎重・賢明決定）
echo ""
echo "🧠 Phase 4: CEO戦略判断（慎重・賢明決定）"
echo "════════════════════════════════════════════════════════════════════════════════"

echo "⚖️ 各部門実装必要性判定中..."

DIRECTOR_TASKS=""
PROTECT_COUNT=0
TASK_COUNT=0
CLEANUP_COUNT=0

# Backend戦略判断
echo ""
echo "🗄️ Backend戦略判断:"
if [ "$BACKEND_TOTAL" -ge 4 ] && [ "$BACKEND_PERFORMANCE" -eq 0 ] && [ "$COGNITO_IMPL" -ge 1 ]; then
    echo "  ✅ 判定: 実装完了・保護対象"
    echo "  📊 状況: 必須モデル完備・不要実装なし・認証完備"
    PROTECT_COUNT=$((PROTECT_COUNT + 1))
elif [ "$BACKEND_TOTAL" -ge 4 ] && [ "$BACKEND_PERFORMANCE" -gt 0 ]; then
    echo "  🧹 判定: クリーンアップ必要"
    echo "  📊 状況: 必須モデル完備だが不要実装あり"
    DIRECTOR_TASKS="${DIRECTOR_TASKS}BACKEND:backend-director:不要実装削除（Performance/Analytics/Metrics等）・MVP準拠クリーンアップ|"
    CLEANUP_COUNT=$((CLEANUP_COUNT + 1))
    TASK_COUNT=$((TASK_COUNT + 1))
elif [ "$BACKEND_TOTAL" -ge 4 ] && [ "$COGNITO_IMPL" -eq 0 ]; then
    echo "  🔐 判定: 認証システム完成必要"
    echo "  📊 状況: 必須モデル完備だが認証未完成"
    DIRECTOR_TASKS="${DIRECTOR_TASKS}BACKEND:backend-director:Amazon Cognito認証システム完成・JWT統合|"
    TASK_COUNT=$((TASK_COUNT + 1))
else
    echo "  🎯 判定: 基盤実装必要"
    echo "  📊 状況: 必須モデル不完全（$BACKEND_TOTAL/4）"
    DIRECTOR_TASKS="${DIRECTOR_TASKS}BACKEND:backend-director:AWS Amplify基盤構築（User/Account/Position/Actionモデル・Cognito認証）|"
    TASK_COUNT=$((TASK_COUNT + 1))
fi

# Trading戦略判断  
echo ""
echo "⚡ Trading戦略判断:"
if [ "$TRADING_TOTAL" -ge 3 ] && [ "$TRADING_POSITION" -ge 1 ] && [ "$TRADING_ARBITRAGE" -ge 1 ]; then
    echo "  ✅ 判定: 実装完了・保護対象"
    echo "  📊 状況: Position-Trail-Actionフロー完備"
    PROTECT_COUNT=$((PROTECT_COUNT + 1))
else
    echo "  🎯 判定: 核心実装必要"
    echo "  📊 状況: Position($TRADING_POSITION)・Arbitrage($TRADING_ARBITRAGE)・Trail($TRADING_TRAIL)"
    DIRECTOR_TASKS="${DIRECTOR_TASKS}TRADING:trading-flow-director:Position-Trail-Actionフロー実装（リスク管理・ドローダウン<5%監視）|"
    TASK_COUNT=$((TASK_COUNT + 1))
fi

# Integration戦略判断
echo ""
echo "🔌 Integration戦略判断:"
if [ "$INTEGRATION_EA" -ge 1 ] && [ "$INTEGRATION_WEBSOCKET" -ge 1 ] && [ "$INTEGRATION_DLL" -ge 2 ]; then
    echo "  ✅ 判定: 実装完了・保護対象"
    echo "  📊 状況: MT5統合・WebSocket・DLL完備"
    PROTECT_COUNT=$((PROTECT_COUNT + 1))
elif [ "$INTEGRATION_EA" -ge 1 ] && [ "$INTEGRATION_WEBSOCKET" -eq 0 ]; then
    echo "  🔌 判定: WebSocket完成必要"
    echo "  📊 状況: MT5はあるがWebSocket未完成"
    DIRECTOR_TASKS="${DIRECTOR_TASKS}INTEGRATION:integration-director:WebSocket DLL完成（レイテンシ<10ms・C++/Rust実装）|"
    TASK_COUNT=$((TASK_COUNT + 1))
else
    echo "  🎯 判定: 統合実装必要"
    echo "  📊 状況: EA($INTEGRATION_EA)・WebSocket($INTEGRATION_WEBSOCKET)・DLL($INTEGRATION_DLL)"
    DIRECTOR_TASKS="${DIRECTOR_TASKS}INTEGRATION:integration-director:MT5 EA・WebSocket統合実装（レイテンシ<10ms）|"
    TASK_COUNT=$((TASK_COUNT + 1))
fi

# Frontend戦略判断
echo ""
echo "🎨 Frontend戦略判断:"
if [ "$FRONTEND_ADMIN_PAGES" -ge 3 ] && [ "$FRONTEND_TAURI" = "1" ] && [ "$FRONTEND_HEDGE_COMPONENTS" -ge 10 ]; then
    echo "  ✅ 判定: 実装完了・保護対象"
    echo "  📊 状況: 管理画面・Tauriアプリ・コンポーネント完備"
    PROTECT_COUNT=$((PROTECT_COUNT + 1))
else
    echo "  🎯 判定: UI実装必要"
    echo "  📊 状況: 管理画面($FRONTEND_ADMIN_PAGES)・Tauri($FRONTEND_TAURI)・コンポーネント($FRONTEND_HEDGE_COMPONENTS)"
    DIRECTOR_TASKS="${DIRECTOR_TASKS}FRONTEND:frontend-director:管理画面・Tauriアプリ実装（FCP<1.5s・リアルタイム更新）|"
    TASK_COUNT=$((TASK_COUNT + 1))
fi

# DevOps戦略判断（最適化フェーズ延期）
echo ""
echo "🚀 DevOps戦略判断:"
echo "  ⏭️ 判定: 最適化フェーズ延期"
echo "  📊 理由: MVP完成優先・CI/CD($DEVOPS_CI)・Test($DEVOPS_TESTS)は後回し"

# 戦略判断サマリー
echo ""
echo "📊 CEO戦略判断サマリー:"
echo "────────────────────────────────────────────────────────────────────────────────"
MVP_COMPLETION=$(( (PROTECT_COUNT * 100) / 4 ))
echo "  🛡️ 実装保護対象: $PROTECT_COUNT / 4部門"
echo "  🎯 実装必要対象: $TASK_COUNT部門"
echo "  🧹 クリーンアップ: $CLEANUP_COUNT部門"
echo "  📈 MVP完成度: $MVP_COMPLETION%"

# Phase 5: Director指示送信（必要な部門のみ）
echo ""
echo "🚀 Phase 5: Director指示送信（必要な部門のみ）"
echo "════════════════════════════════════════════════════════════════════════════════"

if [ "$TASK_COUNT" -eq 0 ]; then
    echo "🎉 全部門実装完了確認"
    echo "✅ MVP完成状態・追加指示不要"
    echo "🛡️ 実装保護モード有効"
    echo ""
    echo "🔄 CEO Supreme完了フロー:"
    echo "1. ✅ 現在: 全実装完了確認"
    echo "2. 🛡️ 実装保護継続（Over-Engineering防止）"
    echo "3. 📊 品質監視・MVP準拠確認継続"
    echo "4. 🚀 本番リリース準備モード"
else
    echo "📤 $TASK_COUNT部門にDirector指示送信開始"
    echo ""
    echo "🎯 指示送信対象Director:"
    
    # 指示送信ペイン確認
    echo "────────────────────────────────────────────────────────────────────────────────"
    IFS='|' read -ra TASKS_ARRAY <<< "$DIRECTOR_TASKS"
    for task_info in "${TASKS_ARRAY[@]}"; do
        if [ -n "$task_info" ]; then
            DEPT=$(echo "$task_info" | cut -d: -f1)
            DIRECTOR_ID=$(echo "$task_info" | cut -d: -f2)
            TASK_DESC=$(echo "$task_info" | cut -d: -f3-)
            
            case "$DIRECTOR_ID" in
                "backend-director") PANE="1.0" ;;
                "trading-flow-director") PANE="2.0" ;;
                "integration-director") PANE="3.0" ;;
                "frontend-director") PANE="4.0" ;;
                "devops-director") PANE="5.0" ;;
                *) continue ;;
            esac
            
            echo "  📋 $DIRECTOR_ID (ペイン $PANE)"
            echo "     🎯 任務: $TASK_DESC"
        fi
    done
    
    echo ""
    echo "🔄 Director指示送信実行中..."
    echo "────────────────────────────────────────────────────────────────────────────────"
    
    # tmuxセッション確認
    if ! tmux has-session -t "arbitrage-assistant" 2>/dev/null; then
        echo "❌ Haconiwaセッション未起動"
        echo "💡 起動: npm run haconiwa:start"
        exit 1
    fi
    
    # Director指示送信実行
    SENT_COUNT=0
    IFS='|' read -ra TASKS_ARRAY <<< "$DIRECTOR_TASKS"
    for task_info in "${TASKS_ARRAY[@]}"; do
        if [ -n "$task_info" ]; then
            DEPT=$(echo "$task_info" | cut -d: -f1)
            DIRECTOR_ID=$(echo "$task_info" | cut -d: -f2)
            TASK_DESC=$(echo "$task_info" | cut -d: -f3-)
            
            case "$DIRECTOR_ID" in
                "backend-director") PANE="1.0" ;;
                "trading-flow-director") PANE="2.0" ;;
                "integration-director") PANE="3.0" ;;
                "frontend-director") PANE="4.0" ;;
                "devops-director") PANE="5.0" ;;
                *) continue ;;
            esac

            echo "📤 指示送信: $DIRECTOR_ID → ペイン $PANE"
            
            # Director指示送信（改善版）
            tmux send-keys -t "arbitrage-assistant:$PANE" "clear" Enter
            sleep 1
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '👑【CEO Supreme Perfect指示 v6.0】$DIRECTOR_ID'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo ''" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '🎯 Director任務: $TASK_DESC'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo ''" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '🛡️【MVP絶対準拠指示】'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '• MVPシステム設計.md記載の必須実装のみ'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '• forbidden-edits.md の禁止事項は死んでも実装禁止'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '• Over-Engineering・将来拡張の抽象化は絶対禁止'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '• 迷ったら実装しない・必要最小限のみ'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo ''" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '👥【Director責任範囲・完全フロー】'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '1. ✅ 指示内容確認・理解（現在完了）'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '2. 🔄 配下Specialist指示送信（次の必須ステップ）:'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo ''" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '   📋 配下指示送信コマンド（必須実行）:'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '   cd /Users/rnrnstar/github/ArbitrageAssistant'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '   ./scripts/director-auto-delegate-v2.sh $DIRECTOR_ID \"$TASK_DESC\"'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo ''" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '3. 📊 進捗管理・監視:'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '   npm run task:list --department $DIRECTOR_ID'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '   npm run task:monitor'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo ''" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '4. 📈 CEO完了報告:'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '   tasks/directors/$DIRECTOR_ID/ に完了結果記録'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo ''" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '🚨【重要】Director実行フロー'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '• 指示受信 ✅（完了）'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '• 配下指示送信 🔄（上記コマンド実行必須）'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '• 進捗監視 📊（Tasks Directory監視）'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '• CEO報告 📈（完了時報告）'" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo ''" Enter
            tmux send-keys -t "arbitrage-assistant:$PANE" "echo '✅ Director指示受信完了。配下指示送信コマンドを実行します。ultrathink'" Enter
            
            SENT_COUNT=$((SENT_COUNT + 1))
            echo "  ✅ 送信完了"
            sleep 2
        fi
    done
    
    echo ""
    echo "📊 Director指示送信完了: $SENT_COUNT / $TASK_COUNT 部門"
fi

# Phase 6: CEO Supreme実行完了・次のアクション
echo ""
echo "✅ Phase 6: CEO Supreme Perfect Initial Prompt完了"
echo "════════════════════════════════════════════════════════════════════════════════"

EXECUTION_END=$(date '+%Y-%m-%d %H:%M:%S')

echo ""
echo "👑 CEO Supreme Perfect Initial Prompt v6.0 実行完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🕐 実行時間: $EXECUTION_START ～ $EXECUTION_END"
echo ""

if [ "$TASK_COUNT" -eq 0 ]; then
    echo "🎉 MVP完成確認・実装保護モード"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 全実装品質良好・追加作業不要"
    echo "🛡️ 実装保護モード有効・Over-Engineering防止"
    echo "📈 MVP完成度: $MVP_COMPLETION%"
    echo ""
    echo "🔄 CEO Supreme完了後フロー:"
    echo "• 実装保護継続: 不要な変更防止"
    echo "• 品質監視: 定期的MVP準拠確認"
    echo "• 本番準備: デプロイ・リリース計画"
else
    echo "📈 MVP完成指向・Director実行フロー開始"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📤 Director指示送信: $SENT_COUNT部門完了"
    echo "🛡️ 実装保護: $PROTECT_COUNT部門継続"
    echo "📈 MVP完成度: $MVP_COMPLETION%"
    echo ""
    echo "🔄 Director実行フロー・Next Actions:"
    echo ""
    echo "1️⃣ 【現在・Director実行フェーズ】"
    echo "   • 各Directorペインで指示確認"
    echo "   • 配下指示送信コマンド手動実行"
    echo "   • 「./scripts/director-auto-delegate-v2.sh [director-id] [task]」"
    echo ""
    echo "2️⃣ 【進捗監視フェーズ】"
    echo "   • リアルタイム監視: npm run task:monitor"
    echo "   • 部門別確認: npm run task:list --department [director-id]"
    echo "   • 全体確認: npm run task:list"
    echo ""
    echo "3️⃣ 【品質確認フェーズ】"
    echo "   • MVP準拠確認: npm run mvp:check packages/"
    echo "   • Director状況確認: npm run director:check"
    echo "   • 品質チェック: npm run lint && npm run type-check"
    echo ""
    echo "4️⃣ 【完了・リフレッシュフェーズ】"
    echo "   • 完了確認: 全Director完了報告受信"
    echo "   • リフレッシュ: npm run haconiwa:refresh"
    echo "   • 再開始: CEO Supreme初期プロンプト再実行"
fi

echo ""
echo "🎯 CEO Supreme Perfect Initial Prompt v6.0 特徴:"
echo "────────────────────────────────────────────────────────────────────────────────"
echo "• 🎭 Haconiwa起動時自動実行対応"
echo "• 📊 MVPシステム設計.md完全準拠分析"
echo "• 🧠 慎重・賢明な戦略判断（必要な部門のみ指示）"
echo "• 👥 Director→Specialist完全フロー確立"
echo "• 🛡️ 実装保護・Over-Engineering防止"
echo "• 🔄 Tasks Directory v2.0完全統合"
echo ""

# 完了通知
osascript -e 'display notification "CEO Supreme Perfect Initial Prompt v6.0 実行完了" with title "ArbitrageAssistant" sound name "Glass"' 2>/dev/null || true

echo "✅ CEO Supreme Perfect Initial Prompt v6.0 実行完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"