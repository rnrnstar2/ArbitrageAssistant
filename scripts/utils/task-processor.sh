#!/bin/bash

# 🎯 Task Processing System
# 参考: Claude-Code-Communication
# 機能: 指示受信→自動実行→完了報告の自動化

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/agent_communication.log"
TASK_DIR="$PROJECT_ROOT/tmp/tasks"
DONE_DIR="$PROJECT_ROOT/tmp/done"

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# ディレクトリ作成
mkdir -p "$TASK_DIR" "$DONE_DIR"

# エージェント情報取得
get_agent_info() {
    echo "${AGENT_ID:-unknown},${DEPARTMENT:-unknown},${ROLE:-unknown}"
}

# 最新指示取得（改良版・重複防止）
get_latest_instruction() {
    local agent_id="${AGENT_ID:-unknown}"
    
    if [ ! -f "$LOG_FILE" ]; then
        echo ""
        return 1
    fi
    
    # 自分宛ての指示のみを取得（完了報告など除外）
    # 【President指示】や【Director経由】などの指示を対象とする
    local latest_instruction=$(grep -E "^\[.*\] $agent_id: 【(President指示|Director経由)】" "$LOG_FILE" | tail -1)
    
    # 上記で見つからない場合は、一般的な指示形式も確認
    if [ -z "$latest_instruction" ]; then
        latest_instruction=$(grep -E "^\[.*\] $agent_id: [^【]" "$LOG_FILE" | grep -v "完了報告" | tail -1)
    fi
    
    if [ -n "$latest_instruction" ]; then
        # タイムスタンプと指示内容を分離
        local timestamp=$(echo "$latest_instruction" | sed -n 's/^\[\([^]]*\)\].*/\1/p')
        local instruction=$(echo "$latest_instruction" | sed -n 's/^\[[^]]*\] [^:]*: \(.*\)/\1/p')
        
        # 完了報告は除外
        if [[ "$instruction" == *"完了報告"* ]]; then
            echo ""
            return 1
        fi
        
        echo "$timestamp|$instruction"
    else
        echo ""
    fi
}

# 指示処理済みかチェック（改良版）
is_instruction_processed() {
    local timestamp="$1"
    local instruction="$2"
    local agent_id="${AGENT_ID:-unknown}"
    
    # 安全なファイル名生成（特殊文字をアンダースコアに置換）
    local safe_timestamp=$(echo "$timestamp" | sed 's/[^a-zA-Z0-9]/_/g')
    local done_file="$DONE_DIR/${agent_id}_${safe_timestamp}.done"
    
    # ファイル存在確認
    if [ -f "$done_file" ]; then
        return 0
    fi
    
    # 同じ指示内容が最近処理されたかチェック
    local instruction_hash=$(echo "$instruction" | md5 2>/dev/null || echo "$instruction" | sha256sum 2>/dev/null | cut -d' ' -f1 || echo "unknown")
    local hash_file="$DONE_DIR/${agent_id}_${instruction_hash}.done"
    
    [ -f "$hash_file" ]
}

# tmuxターゲット取得関数（agent-send.shから複製）
get_agent_target() {
    local agent="$1"
    case "$agent" in
        # President Terminal
        "president") echo "president:0" ;;
        
        # Backend Department
        "backend-director") echo "team:backend.0" ;;
        "backend-worker1") echo "team:backend.1" ;;
        "backend-worker2") echo "team:backend.2" ;;
        "backend-worker3") echo "team:backend.3" ;;
        
        # Frontend Department
        "frontend-director") echo "team:frontend.0" ;;
        "frontend-worker1") echo "team:frontend.1" ;;
        "frontend-worker2") echo "team:frontend.2" ;;
        "frontend-worker3") echo "team:frontend.3" ;;
        
        # Integration Department
        "integration-director") echo "team:integration.0" ;;
        "integration-worker1") echo "team:integration.1" ;;
        "integration-worker2") echo "team:integration.2" ;;
        "integration-worker3") echo "team:integration.3" ;;
        
        # Core Department
        "core-director") echo "team:core.0" ;;
        "core-worker1") echo "team:core.1" ;;
        "core-worker2") echo "team:core.2" ;;
        "core-worker3") echo "team:core.3" ;;
        
        # Quality Department
        "quality-director") echo "team:quality.0" ;;
        "quality-worker1") echo "team:quality.1" ;;
        "quality-worker2") echo "team:quality.2" ;;
        "quality-worker3") echo "team:quality.3" ;;
        
        *) echo "" ;;
    esac
}

# インストラクションファイル取得（agent-init.shから移植・改良）
get_instruction_file() {
    local role="${ROLE:-unknown}"
    local department="${DEPARTMENT:-unknown}"
    local agent_id="${AGENT_ID:-unknown}"
    
    # プロジェクトルート動的取得（agent-init.shと同じロジック）
    local instructions_dir
    if [ -d "$PWD/instructions" ]; then
        instructions_dir="$PWD/instructions"
    elif [ -n "$PROJECT_ROOT" ] && [ -d "$PROJECT_ROOT/instructions" ]; then
        instructions_dir="$PROJECT_ROOT/instructions"
    else
        # フォールバック: スクリプトディレクトリから計算
        local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        local project_root="$(cd "$script_dir/../.." && pwd)"
        instructions_dir="$project_root/instructions"
    fi
    
    # 役割に基づいてインストラクションファイルを決定
    case "$role" in
        "president")
            echo "$instructions_dir/president.md"
            ;;
        "director")
            # 部門別Directorファイルがあるかチェック
            local dept_file="$instructions_dir/directors/${department}-director.md"
            if [ -f "$dept_file" ]; then
                echo "$dept_file"
            else
                echo "$instructions_dir/director.md"
            fi
            ;;
        "worker")
            # 部門別Workerファイルがあるかチェック
            local dept_file="$instructions_dir/workers/${department}-worker.md"
            if [ -f "$dept_file" ]; then
                echo "$dept_file"
            else
                echo "$instructions_dir/worker.md"
            fi
            ;;
        *)
            echo ""
            ;;
    esac
}

# Claude Code実行トリガー（簡素化版・重複防止）
trigger_claude_code() {
    local instruction="$1"
    local agent_id="${AGENT_ID:-unknown}"
    local role="${ROLE:-unknown}"
    local department="${DEPARTMENT:-unknown}"
    
    # tmuxターゲット取得
    local target=$(get_agent_target "$agent_id")
    
    if [ -n "$target" ]; then
        echo -e "${BLUE}🤖 Claude Code起動中...${NC}"
        echo -e "${YELLOW}📍 ターゲット:${NC} $target"
        echo -e "${YELLOW}👤 役割:${NC} $role ($department)"
        
        # 詳細な自動役割認識プロンプト作成
        local instruction_file=$(get_instruction_file)
        local role_description=""
        
        # 役割別説明を生成
        case "$role" in
            "president")
                role_description="🏛️ President: 戦略立案・指示振り分け専用。./agent-send.shによる指示送信のみ。実装作業禁止。"
                ;;
            "director")
                role_description="🎯 Director: ${department}部門統括・アーキテクチャ設計・Worker指導・品質管理・技術的実装。"
                ;;
            "worker")
                role_description="⚡ Worker: ${department}部門専門実装・高品質コード・上位への自動報告・専門技術領域実装。"
                ;;
            *)
                role_description="🤖 Agent: ${department}部門で${role}として活動。"
                ;;
        esac
        
        # 環境変数情報を含む自動役割認識プロンプト
        local auto_role_prompt="CLAUDE.md自動役割認識システム有効。

🎯 自動認識完了:
- エージェントID: ${agent_id}
- 部門: ${department}
- 役割: ${role}

📋 役割詳細: ${role_description}

🔄 指示実行: ${instruction}

重要: 毎回役割を聞く必要なし。環境変数から自動認識済み。即座に指示実行してください。"
        
        # Claude Code起動コマンドを環境変数付きで該当ペインに送信
        local claude_cmd="AGENT_ID='${agent_id}' ROLE='${role}' DEPARTMENT='${department}' claude --dangerously-skip-permissions"
        tmux send-keys -t "$target" "$claude_cmd" C-m
        
        # Claude Code起動を十分に待機
        echo -e "${YELLOW}⏳ Claude Code起動待機中...${NC}"
        sleep 8
        
        # 自動役割認識プロンプト送信（重複防止）
        echo -e "${YELLOW}📤 自動役割認識プロンプト送信中...${NC}"
        tmux send-keys -t "$target" "$auto_role_prompt" C-m
        
        echo -e "${GREEN}✅ Claude Code起動・自動役割認識完了${NC}"
        echo -e "${PURPLE}🎯 送信内容: 詳細役割認識 + 環境変数情報 + 指示${NC}"
        return 0
    else
        echo -e "${RED}❌ tmuxターゲットが見つかりません: $agent_id${NC}"
        return 1
    fi
}

# 指示実行処理
execute_instruction() {
    local timestamp="$1"
    local instruction="$2"
    local agent_id="${AGENT_ID:-unknown}"
    local done_file="$DONE_DIR/${agent_id}_${timestamp//[: -]/_}.done"
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📋 指示実行開始${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}🎯 エージェント:${NC} $agent_id"
    echo -e "${YELLOW}⏰ 受信時刻:${NC} $timestamp"
    echo -e "${YELLOW}📝 指示内容:${NC} $instruction"
    echo ""
    
    # ultrathink品質指示への変換
    local enhanced_instruction="$instruction この指示をultrathink品質で徹底的に分析・実装してください。"
    
    echo -e "${BLUE}🚀 実行開始: Claude Codeに指示送信${NC}"
    echo -e "${PURPLE}📤 送信内容:${NC} $enhanced_instruction"
    echo ""
    
    # 実際のClaude Code実行
    if trigger_claude_code "$enhanced_instruction"; then
        echo -e "${GREEN}✨ Claude Code実行成功${NC}"
        
        # 実行完了ファイル作成（改良版）
        local safe_timestamp=$(echo "$timestamp" | sed 's/[^a-zA-Z0-9]/_/g')
        local done_file="$DONE_DIR/${agent_id}_${safe_timestamp}.done"
        local instruction_hash=$(echo "$instruction" | md5 2>/dev/null || echo "$instruction" | sha256sum 2>/dev/null | cut -d' ' -f1 || echo "unknown")
        local hash_file="$DONE_DIR/${agent_id}_${instruction_hash}.done"
        
        # タイムスタンプベースの完了ファイル
        echo "Task: $instruction" > "$done_file"
        echo "Timestamp: $timestamp" >> "$done_file"
        echo "Agent: $agent_id" >> "$done_file"
        echo "Status: COMPLETED" >> "$done_file"
        echo "Enhancement: ultrathink quality applied" >> "$done_file"
        echo "Claude_Triggered: true" >> "$done_file"
        
        # ハッシュベースの重複防止ファイル
        echo "Task_Hash: $instruction_hash" > "$hash_file"
        echo "Original_Task: $instruction" >> "$hash_file"
        echo "Completed_At: $(date '+%Y-%m-%d %H:%M:%S')" >> "$hash_file"
        
        echo -e "${GREEN}✅ タスク実行完了・完了ファイル作成済み${NC}"
        echo -e "${BLUE}📁 完了ファイル:${NC} $done_file"
        
        # 完了報告送信
        report_completion "$instruction"
        
        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}🎉 指示処理完了${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    else
        echo -e "${RED}❌ Claude Code実行に失敗しました${NC}"
        return 1
    fi
}

# 完了報告送信（重複防止版）
report_completion() {
    local instruction="$1"
    local agent_id="${AGENT_ID:-unknown}"
    local role="${ROLE:-unknown}"
    local department="${DEPARTMENT:-unknown}"
    
    # 報告先決定
    local report_target=""
    case "$role" in
        "worker")
            report_target="${department}-director"
            ;;
        "director")
            report_target="president"
            ;;
        *)
            # President や他の役割は報告不要
            return 0
            ;;
    esac
    
    if [ -n "$report_target" ]; then
        # 重複報告防止チェック
        local report_hash=$(echo "$agent_id:$instruction" | md5 2>/dev/null || echo "$agent_id:$instruction" | sha256sum 2>/dev/null | cut -d' ' -f1 || echo "unknown")
        local report_file="$DONE_DIR/report_${report_hash}.sent"
        
        if [ -f "$report_file" ]; then
            echo -e "${YELLOW}⚠️ 重複報告防止: 同一内容の完了報告が送信済み${NC}"
            return 0
        fi
        
        local report_message="【完了報告】$agent_id タスク実行完了

📋 実行内容: $instruction
✅ 実行状況: ultrathink品質適用完了
🎯 状態: 次指示待機中"
        
        echo -e "${YELLOW}📤 完了報告送信中...${NC}"
        echo -e "${BLUE}📍 報告先:${NC} $report_target"
        
        # 実際の報告送信
        if "$PROJECT_ROOT/agent-send.sh" "$report_target" "$report_message"; then
            # 送信成功時のみ重複防止ファイル作成
            echo "Reported_At: $(date '+%Y-%m-%d %H:%M:%S')" > "$report_file"
            echo "Agent: $agent_id" >> "$report_file"
            echo "Target: $report_target" >> "$report_file"
            echo "Instruction: $instruction" >> "$report_file"
            
            echo -e "${GREEN}✅ 完了報告送信完了${NC}"
        else
            echo -e "${RED}❌ 完了報告送信失敗${NC}"
        fi
    fi
}

# 指示監視・処理ループ
monitor_and_process() {
    local agent_id="${AGENT_ID:-unknown}"
    
    echo -e "${CYAN}🔄 指示監視開始${NC}"
    echo -e "${YELLOW}👤 エージェント:${NC} $agent_id"
    echo -e "${YELLOW}📂 監視ログ:${NC} $LOG_FILE"
    echo ""
    
    while true; do
        local latest=$(get_latest_instruction)
        
        if [ -n "$latest" ]; then
            local timestamp=$(echo "$latest" | cut -d'|' -f1)
            local instruction=$(echo "$latest" | cut -d'|' -f2)
            
            # 改良版：指示内容も引数として渡す
            if ! is_instruction_processed "$timestamp" "$instruction"; then
                echo -e "${YELLOW}📨 新規指示検出${NC}"
                echo -e "${CYAN}📋 指示内容:${NC} $(echo "$instruction" | cut -c1-50)..."
                execute_instruction "$timestamp" "$instruction"
            else
                # 処理済みの場合はサイレント（ログ出力なし）
                true
            fi
        fi
        
        # 監視間隔（5秒に延長、CPU負荷軽減）
        sleep 5
    done
}

# メイン処理
main() {
    local command="${1:-monitor}"
    local role="${ROLE:-unknown}"
    
    # President専用防御策: task-processorの実行を絶対禁止
    if [ "$role" = "president" ]; then
        echo -e "${RED}🚨 ERROR: Presidentによるtask-processor実行は禁止されています${NC}"
        echo -e "${YELLOW}📋 President役割:${NC} 指示送信専用（実装作業禁止）"
        echo -e "${BLUE}💡 正しい使用方法:${NC} ./agent-send.sh [agent] \"[指示]\" で指示送信"
        echo -e "${GREEN}✅ Presidentは実装作業を行わず、指示のみ送信してください${NC}"
        exit 1
    fi
    
    case "$command" in
        "monitor")
            monitor_and_process
            ;;
        "test")
            echo "タスクプロセッサテスト実行"
            execute_instruction "$(date '+%Y-%m-%d %H:%M:%S')" "テスト指示"
            ;;
        "status")
            echo "エージェント情報: $(get_agent_info)"
            echo "完了ファイル数: $(ls -1 "$DONE_DIR" 2>/dev/null | wc -l)"
            ;;
        *)
            echo "使用方法: $0 [monitor|test|status]"
            exit 1
            ;;
    esac
}

# スクリプトが直接実行された場合
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi