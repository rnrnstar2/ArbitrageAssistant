#!/bin/bash

# 🎯 Director → Specialist指示送信システム v2.0
# Usage: ./scripts/directors/delegation/auto-delegate-v2.sh [director-id] "[instruction]"

if [ $# -lt 2 ]; then
    echo "使用法: $0 [director-id] \"[instruction]\""
    exit 1
fi

DIRECTOR_ID="$1"
INSTRUCTION="$2"
SESSION_NAME="arbitrage-assistant"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Director → Specialist マッピング
get_specialist_panes() {
    case "$1" in
        "backend-director") echo "1.1 1.2" ;;
        "trading-flow-director") echo "2.1 2.2" ;;
        "integration-director") echo "3.1 3.2" ;;
        "frontend-director") echo "4.1 4.2" ;;
        "devops-director") echo "5.1 5.2" ;;
        *) echo "" ;;
    esac
}

# Specialist名取得
get_specialist_name() {
    case "$1" in
        "1.1") echo "amplify-gen2-specialist" ;;
        "1.2") echo "mvp-implementation-specialist" ;;
        "2.1") echo "position-execution-specialist" ;;
        "2.2") echo "trail-management-specialist" ;;
        "3.1") echo "mt5-connector-specialist" ;;
        "3.2") echo "websocket-engineer" ;;
        "4.1") echo "react-specialist" ;;
        "4.2") echo "desktop-app-engineer" ;;
        "5.1") echo "build-optimization-engineer" ;;
        "5.2") echo "quality-assurance-engineer" ;;
        *) echo "unknown-specialist" ;;
    esac
}

# セッション確認
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ Haconiwaセッション未起動"
    exit 1
fi

# Tasks Directory作成
TASKS_DIR="tasks/directors/${DIRECTOR_ID}"
mkdir -p "$TASKS_DIR"

# 配下Specialist取得
SPECIALIST_PANES=$(get_specialist_panes "$DIRECTOR_ID")
if [ -z "$SPECIALIST_PANES" ]; then
    echo "❌ 不明なDirector ID: $DIRECTOR_ID"
    exit 1
fi

echo "🎯 指示送信開始: $DIRECTOR_ID"

# 重複タスクチェック
check_duplicate_tasks() {
    local specialist="$1"
    local existing_tasks=$(find "$TASKS_DIR" -name "*-${specialist}.md" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$existing_tasks" -gt 0 ]; then
        echo "⚠️ $specialist: 既存タスク${existing_tasks}件検出"
        find "$TASKS_DIR" -name "*-${specialist}.md" -exec basename {} \; | sed 's/^/    - /'
        return 1
    fi
    return 0
}

# Specialist専門領域適合性チェック関数
check_specialist_expertise() {
    local specialist="$1"
    local instruction="$2"
    
    case "$specialist" in
        "amplify-gen2-specialist")
            if [[ "$instruction" =~ (PostCSS|CSS|UI|Frontend|React|Tauri) ]]; then
                echo "  ⚠️ $specialist: Frontend技術のため適合性低"
                return 1
            fi
            ;;
        "mvp-implementation-specialist")
            # MVP実装は汎用的のため制限なし
            ;;
        "position-execution-specialist"|"trail-management-specialist")
            if [[ "$instruction" =~ (PostCSS|CSS|UI|AWS|Amplify|GraphQL) ]]; then
                echo "  ⚠️ $specialist: Trading外技術のため適合性低"
                return 1
            fi
            ;;
        "mt5-connector-specialist"|"websocket-engineer")
            if [[ "$instruction" =~ (PostCSS|CSS|UI|GraphQL|React) ]]; then
                echo "  ⚠️ $specialist: Integration外技術のため適合性低"
                return 1
            fi
            ;;
        "react-specialist"|"desktop-app-engineer")
            if [[ "$instruction" =~ (GraphQL|DynamoDB|AWS|Backend|Database) ]]; then
                echo "  ⚠️ $specialist: Backend技術のため適合性低"
                return 1
            fi
            ;;
        "build-optimization-engineer"|"quality-assurance-engineer")
            # DevOps系は汎用的のため制限なし
            ;;
    esac
    
    return 0
}

# 各Specialistに指示送信
for pane in $SPECIALIST_PANES; do
    specialist_name=$(get_specialist_name "$pane")
    
    # 重複チェック実行
    if ! check_duplicate_tasks "$specialist_name"; then
        echo "🔄 $specialist_name: 重複タスクのため指示スキップ"
        echo "💡 完了後再実行または手動で古いタスクを完了済みに移動してください"
        continue
    fi
    
    # 専門領域適合性チェック
    if ! check_specialist_expertise "$specialist_name" "$INSTRUCTION"; then
        echo "🔄 $specialist_name: 専門領域外のため指示スキップ"
        echo "💡 適切な専門Specialist、または汎用Specialistへの指示を推奨"
        continue
    fi
    
    task_file="$TASKS_DIR/task-${TIMESTAMP}-${specialist_name}.md"
    
    # 基本タスクファイル作成
    cat > "$task_file" << EOF
# Director指示: $specialist_name

## タスク情報
- 作成者: $DIRECTOR_ID
- 担当者: $specialist_name  
- 作成日時: $(date '+%Y-%m-%d %H:%M:%S')

## 指示内容
$INSTRUCTION

## 基本原則
- MVP準拠絶対
- forbidden-edits.md禁止事項遵守
- 必要最小限実装

**作業詳細はSpecialist判断**
EOF

    # 完全自動指示送信（CEO同様の完全指示システム）
    SPECIALIST_INSTRUCTION="【Director完全自動指示 v2.0】$specialist_name

💎 品質最優先方針: 時間制限なし・完璧性重視・妥協禁止
🎯 Claude Code実行品質・精度・完成度を最優先
🏛️ Director ($DIRECTOR_ID) → Specialist ($specialist_name) 完全自動指示

🎯 Director指示内容:
$INSTRUCTION

📋 タスクファイル: $task_file
🔧 必ず上記タスクファイルで詳細確認・結果記録

🛡️【MVP絶対準拠・Over-Engineering完全防止】
• MVPシステム設計.md記載の必須実装のみ（100%準拠）
• forbidden-edits.md の禁止事項は死んでも実装禁止
• Over-Engineering絶対禁止・必要最小限実装
• 品質重視・時間制限なし・完璧性最優先

🔧【Claude Code必須活用】
• Read・Glob・Grep・Edit・MultiEdit等のツールを最大活用
• 実装前の詳細分析・品質確認を徹底実行
• テスト・lint・typecheck等の品質保証を確実実行

🏛️【Specialist責任システム】
• 実装判断: 完全にSpecialist判断・責任
• 品質保証: lint・typecheck・test実行
• 結果記録: タスクファイルに詳細記録
• 完了報告: Director確認用の完了記録

Specialist作業開始してください。ultrathink"

    # 完全指示送信実行
    tmux send-keys -t "$SESSION_NAME:$pane" "clear" Enter
    sleep 1
    tmux send-keys -t "$SESSION_NAME:$pane" "$SPECIALIST_INSTRUCTION" Enter
    sleep 1
    
    echo "✅ 指示送信完了: $specialist_name"
done

echo ""
echo "✅ 指示送信完了: $(echo $SPECIALIST_PANES | wc -w | tr -d ' ')名のSpecialist"