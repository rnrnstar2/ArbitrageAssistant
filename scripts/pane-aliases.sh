#!/bin/bash

# Haconiwaペイン内エイリアス設定
# 各ペインで便利にCEO機能を使えるようにするエイリアス集

# ペイン内コマンドスクリプトのパス
PANE_COMMANDS="/Users/rnrnstar/github/ArbitrageAssistant/scripts/pane-commands.sh"

# 便利エイリアス設定
setup_pane_aliases() {
    echo "🎯 ペイン内エイリアス設定中..."
    
    # 実行権限付与
    chmod +x "$PANE_COMMANDS" 2>/dev/null
    
    # CEO系エイリアス
    alias ceo='$PANE_COMMANDS ceo-strategic'
    alias strategic='$PANE_COMMANDS ceo-strategic'
    
    # Director指示エイリアス
    alias direct='$PANE_COMMANDS director'
    alias backend='$PANE_COMMANDS director backend-director'
    alias trading='$PANE_COMMANDS director trading-flow-director'
    alias integration='$PANE_COMMANDS director integration-director'
    alias frontend='$PANE_COMMANDS director frontend-director'
    alias devops='$PANE_COMMANDS director devops-director'
    
    # 進捗・監視エイリアス
    alias progress='$PANE_COMMANDS progress'
    alias status='$PANE_COMMANDS progress'
    alias check='$PANE_COMMANDS progress'
    
    # 通信エイリアス
    alias broadcast='$PANE_COMMANDS broadcast'
    alias notify='$PANE_COMMANDS broadcast'
    
    # ユーティリティエイリアス
    alias role='$PANE_COMMANDS role'
    alias restore='$PANE_COMMANDS role'
    alias phelp='$PANE_COMMANDS help'
    
    # よく使うGitコマンド
    alias gs='git status'
    alias gl='git log --oneline -10'
    alias gd='git diff'
    
    # よく使うnpmコマンド
    alias dev='npm run dev'
    alias build='npm run build'
    alias lint='npm run lint'
    alias test='npm run test'
    
    echo "✅ ペイン内エイリアス設定完了"
    echo ""
    echo "🎯 利用可能なエイリアス:"
    echo "  CEO系: ceo, strategic"
    echo "  Director指示: direct, backend, trading, integration, frontend, devops"
    echo "  進捗確認: progress, status, check"
    echo "  通信: broadcast, notify"
    echo "  ユーティリティ: role, restore, phelp"
    echo ""
    echo "💡 使用例:"
    echo "  ceo                              # CEO戦略実行"
    echo "  backend \"AWS Amplify基盤構築\"    # Backend Director指示"
    echo "  progress                         # 進捗確認"
    echo "  broadcast \"システム更新完了\"     # 全体通知"
    echo "  role                             # 役割確認・復旧"
    echo ""
}

# Refresh後の簡単復旧
quick_restore() {
    echo "🚀 Refresh後クイック復旧開始..."
    echo ""
    
    # エイリアス再設定
    setup_pane_aliases
    
    # 役割確認・復旧
    "$PANE_COMMANDS" role
    
    echo ""
    echo "✅ クイック復旧完了"
    echo "💡 次のステップ: ceo コマンドで戦略実行"
}

# ペイン内ワークフロー説明
explain_workflow() {
    echo "🎯 Haconiwaペイン内ワークフロー"
    echo "================================"
    echo ""
    echo "📋 基本の流れ:"
    echo "1. haconiwa:start でウィンドウ起動"
    echo "2. 任意のペインで 'quick' 実行（初回のみ）"
    echo "3. 'ceo' でCEO戦略実行"
    echo "4. 'progress' で進捗確認"
    echo "5. 必要に応じて個別指示: backend \"タスク内容\""
    echo ""
    echo "🔄 リフレッシュ時:"
    echo "1. haconiwa:refresh でコンテキストリセット"
    echo "2. 'quick' で復旧"
    echo "3. 'ceo' で戦略再開"
    echo ""
    echo "⭐ 最頻用コマンド:"
    echo "  ceo      # 戦略実行（最重要）"
    echo "  progress # 進捗確認"
    echo "  role     # 役割確認"
    echo "  phelp    # ヘルプ"
    echo ""
    echo "💡 このワークフローで、ペイン内だけで全ての作業が完結します！"
}

# メイン処理
case "${1:-setup}" in
    "setup")
        setup_pane_aliases
        ;;
    "quick")
        quick_restore
        ;;
    "workflow")
        explain_workflow
        ;;
    "help")
        explain_workflow
        ;;
    *)
        setup_pane_aliases
        ;;
esac