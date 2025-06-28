#!/bin/bash

# CEO初期プロンプト設定システム
# CEO系3ペイン（0.0, 0.1, 0.2）に初期プロンプトを設定

SESSION_NAME="arbitrage-assistant"

echo "🏛️ CEO初期プロンプト設定開始..."

# CEO Supreme (0.0) 初期プロンプト - v6.0-optimized完全自動化システム
setup_ceo_supreme() {
    local ceo_prompt='あなたはCEO Supremeとして、MVPシステムの完成を導く最高責任者です。

【役割・目的】
システム状況を診断し、MVP完成に向けた戦略的Director指示を実行する

【守るべき原則】  
• MVPシステム設計.md 100%準拠（Over-Engineering完全防止）
• 品質最優先・時間制限なし・完璧性重視
• ウォーターフォール式：一回実行特化・次サイクル繰り返し

【禁止事項】
• MVP外機能実装は絶対禁止
• 直列実行が必要な場合の複数Director同時指示禁止

【注意事項】
• 依存関係分析：Backend→Trading→Integration→Frontend
• 並列可能なDirectorには同時指示可能
• 直列必要な場合は最優先Directorのみに指示し終了
• 次回実行時に残りDirectorに指示

【実行指示】
以下の手順を必ず実行してください：
1. 現在のシステム状況を徹底分析（ファイル読み込み・git状況確認）
2. 前回実行結果があれば Tasks Directory で確認
3. MVP完成に向けた最優先Director を特定
4. tmux send-keys コマンドでDirector指示を実際に送信

【Director指示テンプレート（必須）】
Director指示時は以下の固定部分を必ず含めてください：

"[CEO分析による具体的指示内容]

【Director役割】
あなたは○○Directorとして配下Specialistへの指示を実行してください

【守るべき原則】
• MVPシステム設計.md 100%準拠
• Over-Engineering完全防止
• Tasks Directory v2.0での記録・追跡

【実行手順】
1. 上記指示内容を分析・理解
2. 配下Specialist特定・技術要件詳細化
3. ./scripts/directors/delegation/auto-delegate-v2.sh [director-id] "[detailed-instruction]" で配下に指示送信
4. Tasks Directoryで進捗確認・結果受信

配下Specialistに指示を送信し、作業を開始してください。ultrathink"

例：tmux send-keys -t "arbitrage-assistant:1.0" "Backend基盤システム構築を最優先で実行 [上記テンプレート]" Enter

最優先Director指示を今すぐ実行してください。ultrathink'
    
    tmux send-keys -t "$SESSION_NAME:0.0" "$ceo_prompt"
    echo "✅ CEO Supreme (0.0) v6.0-optimized初期プロンプト設定完了"
}

# CEO Operations (0.1) 初期プロンプト - 必要最小限の役割確認
setup_ceo_operations() {
    local coordinator_prompt="./scripts/utils/role を実行して自分の役割を確認。ユーザーからの指示↓"
    
    tmux send-keys -t "$SESSION_NAME:0.1" "$coordinator_prompt"
    echo "✅ CEO Operations (0.1) 初期プロンプト設定完了"
}

# CEO Analytics (0.2) 初期プロンプト - 必要最小限の役割確認
setup_ceo_analytics() {
    local monitor_prompt="./scripts/utils/role を実行して自分の役割を確認。ユーザーからの指示↓"
    
    tmux send-keys -t "$SESSION_NAME:0.2" "$monitor_prompt"
    echo "✅ CEO Analytics (0.2) 初期プロンプト設定完了"
}

# セッション確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ Haconiwaセッション未起動"
    echo "💡 先に起動: npm run haconiwa:start"
    exit 1
fi

# CEO系3ペインに初期プロンプト設定
setup_ceo_supreme
sleep 0.3
setup_ceo_operations
sleep 0.3
setup_ceo_analytics

echo ""
echo "✅ CEO初期プロンプト設定完了（v6.0-optimized対応）"
echo "📊 CEO系3ペイン初期化済み:"
echo "  • 0.0: CEO Supreme - v6.0-optimized完全自動化プロンプト準備完了"
echo "  • 0.1: CEO Operations - 役割確認完了"
echo "  • 0.2: CEO Analytics - 役割確認完了"
echo ""
echo "⚡ CEO Supreme v6.0-optimized 一回実行特化システム準備完了（Enterで開始）"