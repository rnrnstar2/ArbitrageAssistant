#!/bin/bash

# Haconiwaペイン内クイックセットアップ
# ペイン内で実行してすぐに作業開始できるオールインワン初期化スクリプト

echo "🚀 Haconiwaペイン内クイックセットアップ開始..."
echo ""

# 基本パス設定
BASE_DIR="/Users/rnrnstar/github/ArbitrageAssistant"
cd "$BASE_DIR" 2>/dev/null || {
    echo "❌ プロジェクトディレクトリが見つかりません: $BASE_DIR"
    exit 1
}

# Step 1: エイリアス設定
echo "⚙️ Step 1: ペイン内エイリアス設定..."
source ./scripts/pane-aliases.sh setup

# Step 2: 役割確認・復旧
echo ""
echo "🎭 Step 2: 役割確認・復旧..."
./scripts/pane-commands.sh role

# Step 3: 便利な追加設定
echo ""
echo "🔧 Step 3: 便利な追加設定..."

# プロンプト改善（現在の役割を表示）
export PS1="\[\e[1;36m\][\$HACONIWA_AGENT_ID]\[\e[0m\] \[\e[1;32m\]\w\[\e[0m\] $ "

# よく使う環境変数
export EDITOR=nano
export TERM=xterm-256color

# 便利な関数定義
mvp_check() {
    echo "🔍 MVP準拠チェック実行中..."
    cd "$BASE_DIR"
    ./scripts/mvp-compliance-check.sh .
}

quick_lint() {
    echo "🔍 クイックLintチェック..."
    cd "$BASE_DIR"
    npm run lint --silent 2>/dev/null || echo "⚠️ Lint実行失敗"
}

task_list() {
    echo "📋 アクティブタスク一覧:"
    find "$BASE_DIR/tasks/directors" -name "task-*.md" 2>/dev/null | tail -5 | while read file; do
        echo "  • $(basename "$file")"
    done
}

# 関数エクスポート
export -f mvp_check quick_lint task_list

echo "✅ 追加設定完了"

# Step 4: 現在の状況表示
echo ""
echo "📊 Step 4: 現在の状況確認..."

echo "🎯 現在の環境:"
echo "  • ディレクトリ: $(pwd)"
echo "  • 役割: ${HACONIWA_AGENT_ID:-'確認中...'}"
echo "  • ペイン: ${TMUX_PANE:-'tmux外'}"

echo ""
echo "📋 利用可能なコマンド:"
echo "  🏛️ CEO系:"
echo "    ceo           # CEO戦略実行（最重要）"
echo "    strategic     # 同上"
echo ""
echo "  🎯 Director指示:"
echo "    backend \"タスク\"      # Backend Director指示"
echo "    trading \"タスク\"      # Trading Director指示"
echo "    integration \"タスク\"  # Integration Director指示"
echo "    frontend \"タスク\"     # Frontend Director指示"
echo "    devops \"タスク\"       # DevOps Director指示"
echo ""
echo "  📊 監視・確認:"
echo "    progress      # 進捗確認"
echo "    status        # 同上"
echo "    task_list     # タスク一覧"
echo "    mvp_check     # MVP準拠チェック"
echo "    quick_lint    # 高速Lint"
echo ""
echo "  🔧 ユーティリティ:"
echo "    role          # 役割確認・復旧"
echo "    restore       # 同上"
echo "    phelp         # ヘルプ"
echo "    broadcast \"メッセージ\"  # 全体通知"

echo ""
echo "🎉 クイックセットアップ完了！"
echo ""
echo "💡 推奨ワークフロー:"
echo "  1. ceo          # 戦略実行"
echo "  2. progress     # 進捗確認"
echo "  3. backend \"任意のタスク\"  # 必要に応じて個別指示"
echo ""
echo "🔄 コンテキスト重い時:"
echo "  1. 外部で 'npm run haconiwa:refresh' 実行"
echo "  2. './scripts/pane-quick-setup.sh' 再実行"
echo "  3. 'ceo' で作業再開"
echo ""
echo "⭐ 最も簡単: 'ceo' だけ覚えておけばOK！"