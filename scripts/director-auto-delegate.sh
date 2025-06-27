#!/bin/bash

# Director自動配下指示送信システム（シンプル版）
# Usage: ./scripts/director-auto-delegate.sh [director-id] "[instruction]"

if [ $# -lt 2 ]; then
    echo "使用法: $0 [director-id] \"[instruction]\""
    echo "例: $0 backend-director \"AWS Amplify基盤構築を実行してください\""
    exit 1
fi

DIRECTOR_ID="$1"
INSTRUCTION="$2"
SESSION_NAME="arbitrage-assistant"

# Director → Specialist マッピング
get_specialist_panes() {
    case "$1" in
        "backend-director")
            echo "1.1 1.2"  # amplify-gen2-specialist, cognito-auth-expert
            ;;
        "trading-flow-director")
            echo "2.1 2.2"  # entry-flow-specialist, settlement-flow-specialist
            ;;
        "integration-director")
            echo "3.1 3.2"  # mt5-connector-specialist, websocket-engineer
            ;;
        "frontend-director")
            echo "4.1 4.2"  # react-specialist, desktop-app-engineer
            ;;
        "devops-director")
            echo "5.1 5.2"  # build-optimization-engineer, quality-assurance-engineer
            ;;
        *)
            echo ""
            ;;
    esac
}

# Specialist名取得
get_specialist_name() {
    case "$1" in
        "1.1") echo "amplify-gen2-specialist" ;;
        "1.2") echo "cognito-auth-expert" ;;
        "2.1") echo "entry-flow-specialist" ;;
        "2.2") echo "settlement-flow-specialist" ;;
        "3.1") echo "mt5-connector-specialist" ;;
        "3.2") echo "websocket-engineer" ;;
        "4.1") echo "react-specialist" ;;
        "4.2") echo "desktop-app-engineer" ;;
        "5.1") echo "build-optimization-engineer" ;;
        "5.2") echo "quality-assurance-engineer" ;;
        *) echo "unknown-specialist" ;;
    esac
}

echo "🎯 Director自動配下指示送信: $DIRECTOR_ID"
echo "📋 指示内容: $INSTRUCTION"
echo ""

# セッション確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ Haconiwaセッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

# 配下Specialist取得
SPECIALIST_PANES=$(get_specialist_panes "$DIRECTOR_ID")

if [ -z "$SPECIALIST_PANES" ]; then
    echo "❌ 不明なDirector ID: $DIRECTOR_ID"
    exit 1
fi

echo "🚀 配下Specialist指示送信開始..."

# 各Specialistに指示送信
for pane in $SPECIALIST_PANES; do
    specialist_name=$(get_specialist_name "$pane")
    echo "📤 指示送信: $specialist_name (ペイン $pane)"
    
    # Tasks Directoryファイル作成
    timestamp=$(date '+%Y%m%d_%H%M%S')
    task_file="tasks/directors/${DIRECTOR_ID}/task-${timestamp}-${specialist_name}.md"
    
    # ディレクトリ作成
    mkdir -p "tasks/directors/${DIRECTOR_ID}"
    
    # タスクファイル作成
    cat > "$task_file" << EOF
# ${specialist_name}への指示

## 📋 タスク情報
- **作成者**: $DIRECTOR_ID
- **担当者**: $specialist_name
- **優先度**: medium
- **状態**: pending
- **作成日時**: $(date '+%Y-%m-%d %H:%M:%S')

## 🎯 指示内容
$INSTRUCTION

## 🛡️ MVP準拠絶対指示
**【重要】以下は絶対に守ってください：**
- **MVPシステム設計.md記載の機能のみ実装**
- **scripts/directors/common/forbidden-edits.md の禁止事項は死んでも実装禁止**
- **迷ったら実装しない・必要最小限の実装のみ**
- **実装前に ./scripts/mvp-compliance-check.sh でチェック必須**
- **Over-Engineering・将来拡張を見据えた抽象化は禁止**

### 🗄️ Backend専用追加指示（該当者のみ）
**data/resource.ts 編集時の絶対ルール：**
- **許可テーブル**: User/Account/Position/Action のみ
- **禁止テーブル**: Performance/Analytics/Metrics等は死んでも追加禁止
- **テーブル追加前チェック**: ./scripts/backend-table-guard.sh 必須実行
- **違反検出時**: 即座に削除・Director報告

## 📊 実行結果
### 実行者: $specialist_name
### 実行開始日時: 
### 実行完了日時: 

### 実装内容
（実装した機能・変更点の詳細を記録してください）

### 成果物
- [ ] ファイル作成: 
- [ ] テスト実行: 

### 品質確認
- [ ] Lint通過: 
- [ ] 型チェック通過: 
- [ ] テスト通過: 

## 🔄 進捗履歴
- $(date '+%Y-%m-%d %H:%M:%S') **$DIRECTOR_ID**: タスク作成・指示送信

## 💬 コミュニケーションログ
### Director → Specialist
$(date '+%Y-%m-%d %H:%M:%S') - $DIRECTOR_ID: 初期指示

### Specialist → Director
（作業完了時に報告をここに記録してください）
EOF

    echo "📁 タスクファイル作成: $task_file"
    
    # tmuxペインに指示送信（MVP準拠強制付き）
    tmux send-keys -t "$SESSION_NAME:$pane" " && echo '【Director指示】$DIRECTOR_ID → $specialist_name' && echo '📁 タスクファイル: $task_file' && echo '$INSTRUCTION' && echo '' && echo '🛡️【MVP準拠絶対指示】' && echo '• MVPシステム設計.md記載の機能のみ実装' && echo '• forbidden-edits.md の禁止事項は死んでも実装禁止' && echo '• 迷ったら実装しない・必要最小限のみ' && echo '• 実装前にmvp-compliance-check.shでチェック必須' && echo '✅ 指示受信完了。MVP準拠を守って作業開始します。' ultrathink" Enter
    
    sleep 1
done

echo ""
echo "✅ Director配下指示送信完了"
echo "📊 送信先: $(echo $SPECIALIST_PANES | wc -w | tr -d ' ')名のSpecialist"
echo "💡 進捗確認: npm run haconiwa:monitor"