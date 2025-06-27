#!/bin/bash

# 🎯 Director自動配下指示送信システム v2.0（Tasks Directory統合版）
# Usage: ./scripts/director-auto-delegate-v2.sh [director-id] "[instruction]"

if [ $# -lt 2 ]; then
    echo "使用法: $0 [director-id] \"[instruction]\""
    echo "例: $0 backend-director \"AWS Amplify基盤構築を実行してください\""
    exit 1
fi

DIRECTOR_ID="$1"
INSTRUCTION="$2"
SESSION_NAME="arbitrage-assistant"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Director → Specialist マッピング（v2.0対応）
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

# Specialist名取得（v2.0対応）
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

echo "🎯 Director自動配下指示送信 v2.0: $DIRECTOR_ID"
echo "📋 指示内容: $INSTRUCTION"
echo "⏰ タイムスタンプ: $TIMESTAMP"
echo ""

# セッション確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ Haconiwaセッション未起動"
    echo "💡 起動: npm run haconiwa:start"
    exit 1
fi

# Tasks Directory確認・作成
TASKS_DIR="tasks/directors/${DIRECTOR_ID}"
mkdir -p "$TASKS_DIR"

# 配下Specialist取得
SPECIALIST_PANES=$(get_specialist_panes "$DIRECTOR_ID")

if [ -z "$SPECIALIST_PANES" ]; then
    echo "❌ 不明なDirector ID: $DIRECTOR_ID"
    exit 1
fi

echo "🚀 配下Specialist指示送信開始（Tasks Directory v2.0統合）..."

# Director実行結果記録ファイル作成
EXECUTION_LOG="tasks/directors/${DIRECTOR_ID}/execution-log-${TIMESTAMP}.md"
cat > "$EXECUTION_LOG" << EOF
# Director実行ログ: $DIRECTOR_ID

## 📋 実行情報
- **Director**: $DIRECTOR_ID
- **実行日時**: $(date '+%Y-%m-%d %H:%M:%S')
- **指示内容**: $INSTRUCTION
- **配下Specialist数**: $(echo $SPECIALIST_PANES | wc -w | tr -d ' ')

## 📤 配下指示送信
EOF

# 各Specialistに指示送信（Tasks Directory統合）
TASK_FILES=()
for pane in $SPECIALIST_PANES; do
    specialist_name=$(get_specialist_name "$pane")
    echo "📤 指示送信: $specialist_name (ペイン $pane)"
    
    # 個別タスクファイル作成
    task_file="$TASKS_DIR/task-${TIMESTAMP}-${specialist_name}.md"
    TASK_FILES+=("$task_file")
    
    # 詳細タスクファイル作成
    cat > "$task_file" << EOF
# 【Director指示 v2.0】$specialist_name への任務

## 📋 タスク情報
- **作成者**: $DIRECTOR_ID
- **担当者**: $specialist_name
- **優先度**: high
- **状態**: pending
- **作成日時**: $(date '+%Y-%m-%d %H:%M:%S')
- **タスクID**: task-${TIMESTAMP}-${specialist_name}

## 🎯 指示内容
$INSTRUCTION

## 🛡️ MVP準拠絶対指示
**【重要】以下は絶対に守ってください：**
- **MVPシステム設計.md記載の機能のみ実装**
- **scripts/directors/common/forbidden-edits.md の禁止事項は死んでも実装禁止**
- **迷ったら実装しない・必要最小限の実装のみ**
- **実装前に ./scripts/mvp-compliance-check.sh でチェック必須**
- **Over-Engineering・将来拡張を見据えた抽象化は絶対禁止**

### 🗄️ Backend専用追加指示（該当者のみ）
**data/resource.ts 編集時の絶対ルール：**
- **許可テーブル**: User/Account/Position/Action のみ
- **禁止テーブル**: Performance/Analytics/Metrics等は死んでも追加禁止
- **テーブル追加前チェック**: npm run backend:table-guard 必須実行
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
- [ ] 品質チェック: 

### 品質確認
- [ ] Lint通過: 
- [ ] 型チェック通過: 
- [ ] テスト通過: 
- [ ] MVP準拠確認: 

## 🔄 進捗履歴
- $(date '+%Y-%m-%d %H:%M:%S') **$DIRECTOR_ID**: タスク作成・指示送信

## 💬 コミュニケーションログ
### Director → Specialist
$(date '+%Y-%m-%d %H:%M:%S') - $DIRECTOR_ID: 初期指示
> $INSTRUCTION

### Specialist → Director
（作業完了時に報告をここに記録してください）

## 🎯 作業管理コマンド
**タスク実行管理**:
\`\`\`bash
# タスク開始
./scripts/task-execute.sh $task_file start

# 進捗更新
./scripts/task-execute.sh $task_file progress

# タスク完了
./scripts/task-execute.sh $task_file complete

# 対話モード（推奨）
./scripts/task-execute.sh $task_file
\`\`\`

**品質チェック**:
\`\`\`bash
# MVP準拠チェック
./scripts/mvp-compliance-check.sh [対象ファイル]

# Backend専用テーブルチェック
npm run backend:table-guard

# 総合品質チェック
npm run lint && npm run check-types
\`\`\`
EOF

    echo "📁 タスクファイル作成: $task_file"
    
    # 実行ログに記録
    echo "- **$specialist_name** (ペイン $pane): $task_file" >> "$EXECUTION_LOG"
    
    # シンプルなtmux指示送信（双方向通信削除）
    echo "📤 指示送信: $specialist_name (ペイン $pane)"
    
    # ペインをクリアして指示送信
    tmux send-keys -t "$SESSION_NAME:$pane" "clear" Enter
    sleep 1
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '【Director指示 v2.0】$DIRECTOR_ID → $specialist_name'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '🆔 タスクID: task-${TIMESTAMP}-${specialist_name}'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '📁 タスクファイル: $task_file'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '🎯 指示内容: $INSTRUCTION'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo ''" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '🛡️【MVP準拠絶対指示】'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '• MVPシステム設計.md記載の機能のみ実装'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '• forbidden-edits.md の禁止事項は死んでも実装禁止'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '• 迷ったら実装しない・必要最小限のみ'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '• 実装前にmvp-compliance-check.shでチェック必須'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '• Over-Engineering絶対禁止'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo ''" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '📝 作業管理:'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '• タスク開始: ./scripts/task-execute.sh $task_file start'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '• 進捗更新: ./scripts/task-execute.sh $task_file progress'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '• タスク完了: ./scripts/task-execute.sh $task_file complete'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '• 対話モード: ./scripts/task-execute.sh $task_file'" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo ''" Enter
    tmux send-keys -t "$SESSION_NAME:$pane" "echo '✅ 指示受信完了。MVP準拠を守って作業開始します。ultrathink'" Enter
    
    echo "  ✅ 指示送信完了（シンプルtmux）"
    echo "  ✅ 指示送信完了（シンプルtmux）" >> "$EXECUTION_LOG"
    
    sleep 2
done

# 実行ログ完成
cat >> "$EXECUTION_LOG" << EOF

## ✅ 指示送信完了
- **実行完了時刻**: $(date '+%Y-%m-%d %H:%M:%S')
- **送信先Specialist数**: $(echo $SPECIALIST_PANES | wc -w | tr -d ' ')名
- **作成タスクファイル数**: ${#TASK_FILES[@]}個

## 🔄 Next Actions
1. **進捗確認**: \`npm run task:list --department ${DIRECTOR_ID}\`
2. **リアルタイム監視**: \`npm run task:monitor\`
3. **品質チェック**: \`npm run mvp:check packages/\`
4. **Director状況確認**: \`npm run director:check\`

## 📁 作成ファイル一覧
$(for file in "${TASK_FILES[@]}"; do echo "- $file"; done)
EOF

echo ""
echo "✅ Director配下指示送信完了（Tasks Directory v2.0統合）"
echo "📊 送信先: $(echo $SPECIALIST_PANES | wc -w | tr -d ' ')名のSpecialist"
echo "📁 実行ログ: $EXECUTION_LOG"
echo "📝 作成タスクファイル: ${#TASK_FILES[@]}個"
echo ""
echo "🔄 Next Actions:"
echo "• 進捗確認: npm run task:list --department $DIRECTOR_ID"
echo "• リアルタイム監視: npm run task:monitor"
echo "• 品質チェック: npm run mvp:check packages/"
echo "• Director状況確認: npm run director:check"

# 成功通知
osascript -e "display notification 'Director配下指示送信完了 ($DIRECTOR_ID)' with title 'ArbitrageAssistant' sound name 'Glass'" 2>/dev/null || true