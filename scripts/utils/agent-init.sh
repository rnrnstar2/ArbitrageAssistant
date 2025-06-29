#!/bin/bash

# 🎭 Agent Role Recognition System
# 参考: Claude-Code-Communication
# 機能: 環境変数に基づくエージェント役割認識・インストラクション表示

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTRUCTIONS_DIR="$PROJECT_ROOT/instructions"

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# ロール別アイコン
get_role_icon() {
    case "$1" in
        "president") echo "🏛️" ;;
        "director") echo "🎯" ;;
        "worker") echo "⚡" ;;
        *) echo "🤖" ;;
    esac
}

# 部門別アイコン
get_department_icon() {
    case "$1" in
        "executive") echo "🏛️" ;;
        "backend") echo "🗄️" ;;
        "frontend") echo "🖥️" ;;
        "integration") echo "🔗" ;;
        "core") echo "💎" ;;
        "quality") echo "🛡️" ;;
        *) echo "📁" ;;
    esac
}

# 環境変数確認・表示
show_agent_info() {
    local agent_id="${AGENT_ID:-未設定}"
    local department="${DEPARTMENT:-未設定}"
    local role="${ROLE:-未設定}"
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}🤖 エージェント情報${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📋 AGENT_ID:${NC} $(get_role_icon "$role") ${agent_id}"
    echo -e "${YELLOW}🏢 DEPARTMENT:${NC} $(get_department_icon "$department") ${department}"
    echo -e "${YELLOW}👤 ROLE:${NC} $(get_role_icon "$role") ${role}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# インストラクションファイル取得
get_instruction_file() {
    local role="${ROLE:-unknown}"
    local department="${DEPARTMENT:-unknown}"
    local agent_id="${AGENT_ID:-unknown}"
    
    # プロジェクトルートとINSTRUCTIONS_DIRを設定
    # PWDがプロジェクトルートの場合はそれを使用、そうでなければ計算
    local instructions_dir
    if [ -d "$PWD/instructions" ]; then
        instructions_dir="$PWD/instructions"
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

# インストラクション表示
show_instructions() {
    local instruction_file=$(get_instruction_file)
    
    if [ -z "$instruction_file" ]; then
        echo -e "${RED}❌ 役割が未設定です${NC}"
        echo -e "${YELLOW}💡 環境変数を確認してください:${NC}"
        echo -e "   export AGENT_ID=<エージェントID>"
        echo -e "   export DEPARTMENT=<部門名>"
        echo -e "   export ROLE=<役割>"
        return 1
    fi
    
    if [ ! -f "$instruction_file" ]; then
        echo -e "${RED}❌ インストラクションファイルが見つかりません: $instruction_file${NC}"
        return 1
    fi
    
    echo -e "${GREEN}📖 インストラクション表示中...${NC}"
    echo ""
    
    # Markdown内容を色付きで表示
    if command -v bat >/dev/null 2>&1; then
        # batが利用可能な場合
        bat --style=numbers,header --theme="Monokai Extended" "$instruction_file"
    elif command -v pygmentize >/dev/null 2>&1; then
        # pygmentizeが利用可能な場合
        pygmentize -l markdown "$instruction_file"
    else
        # フォールバック: 基本的な色付け
        while IFS= read -r line; do
            if [[ "$line" =~ ^#+ ]]; then
                echo -e "${BLUE}${line}${NC}"
            elif [[ "$line" =~ ^\*\* ]]; then
                echo -e "${YELLOW}${line}${NC}"
            elif [[ "$line" =~ ^\- ]]; then
                echo -e "${GREEN}${line}${NC}"
            else
                echo "$line"
            fi
        done < "$instruction_file"
    fi
}

# Claude Code手動起動ヘルパー（環境変数明示版）
start_claude_with_role() {
    local role="${ROLE:-unknown}"
    local department="${DEPARTMENT:-unknown}"
    local agent_id="${AGENT_ID:-unknown}"
    local instruction_file=$(get_instruction_file)
    
    echo -e "${BLUE}🤖 Claude Code手動起動（役割認識付き・環境変数明示）${NC}"
    echo -e "${YELLOW}📋 実行コマンド（環境変数付き）:${NC}"
    echo ""
    echo -e "${CYAN}AGENT_ID='${agent_id}' ROLE='${role}' DEPARTMENT='${department}' claude --dangerously-skip-permissions${NC}"
    echo ""
    
    if [ -f "$instruction_file" ]; then
        local role_instruction=$(cat "$instruction_file")
        
        # 役割別説明を生成
        local role_description=""
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
        
        echo -e "${YELLOW}📝 起動後に送信する自動役割認識プロンプト:${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "CLAUDE.md自動役割認識システム有効。

🎯 自動認識完了:
- エージェントID: ${agent_id}
- 部門: ${department}
- 役割: ${role}

📋 役割詳細: ${role_description}

重要: 毎回役割を聞く必要なし。環境変数から自動認識済み。指示待機中です。"
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${PURPLE}💡 使用方法:${NC}"
        echo -e "${WHITE}1. 上記の環境変数付きコマンドでClaude Code起動${NC}"
        echo -e "${WHITE}2. 起動後に上記内容をコピー&ペースト${NC}"
        echo -e "${WHITE}3. または「あなたの役割は？」で役割確認${NC}"
    else
        echo -e "${RED}❌ インストラクションファイルが見つかりません: $instruction_file${NC}"
        echo -e "${YELLOW}💡 簡単な役割起動:${NC}"
        echo -e "${CYAN}AGENT_ID='${agent_id}' ROLE='${role}' DEPARTMENT='${department}' claude --dangerously-skip-permissions${NC}"
        echo ""
        echo -e "${YELLOW}起動後に送信:${NC}"
        echo "あなたは${role}です。${department}部門で活動してください。"
    fi
    
    echo ""
    echo -e "${GREEN}🔧 自動実行版（即座にClaude Code起動）:${NC}"
    echo -e "${YELLOW}quick_claude_start${NC} - 即座に役割認識付きClaude Code起動"
}

# クイック起動機能（即座にClaude Code起動）
quick_claude_start() {
    local role="${ROLE:-unknown}"
    local department="${DEPARTMENT:-unknown}"
    local agent_id="${AGENT_ID:-unknown}"
    local instruction_file=$(get_instruction_file)
    
    # 役割別説明を生成
    local role_description=""
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

    echo -e "${BLUE}🚀 即座にClaude Code自動役割認識起動中...${NC}"
    
    # 環境変数付きでClaude Code起動
    AGENT_ID="$agent_id" ROLE="$role" DEPARTMENT="$department" claude --dangerously-skip-permissions &
    local claude_pid=$!
    
    echo -e "${GREEN}✅ Claude Code自動役割認識起動完了${NC} (PID: $claude_pid)"
    echo -e "${YELLOW}🎯 エージェントID:${NC} $agent_id"
    echo -e "${YELLOW}🏢 部門:${NC} $department"
    echo -e "${YELLOW}👤 役割:${NC} $role"
    echo -e "${YELLOW}📋 詳細:${NC} ${role_description}"
    echo -e "${GREEN}🔄 自動認識:${NC} 毎回役割確認不要"
    
    if [ -f "$instruction_file" ]; then
        echo -e "${GREEN}📖 インストラクション:${NC} 自動読み込み済み"
    else
        echo -e "${YELLOW}⚠️ インストラクション:${NC} フォールバック役割設定"
    fi
}

# 役割認識確認
check_role_recognition() {
    local role="${ROLE:-未設定}"
    local department="${DEPARTMENT:-未設定}"
    local agent_id="${AGENT_ID:-未設定}"
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}🔍 役割認識確認${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📋 AGENT_ID:${NC} $agent_id"
    echo -e "${YELLOW}🏢 DEPARTMENT:${NC} $department"
    echo -e "${YELLOW}👤 ROLE:${NC} $role"
    
    local instruction_file=$(get_instruction_file)
    if [ -f "$instruction_file" ]; then
        echo -e "${YELLOW}📖 インストラクション:${NC} ${GREEN}✅ 存在${NC} ($instruction_file)"
    else
        echo -e "${YELLOW}📖 インストラクション:${NC} ${RED}❌ 未発見${NC} ($instruction_file)"
    fi
    
    if [ "$role" != "未設定" ] && [ "$department" != "未設定" ] && [ "$agent_id" != "未設定" ]; then
        echo -e "${GREEN}✅ 役割認識: 完全設定済み${NC}"
    else
        echo -e "${RED}❌ 役割認識: 設定不足${NC}"
        echo -e "${YELLOW}💡 設定方法:${NC}"
        echo "export AGENT_ID=<エージェントID>"
        echo "export DEPARTMENT=<部門名>"
        echo "export ROLE=<役割>"
    fi
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Claude Code起動メッセージ
show_claude_ready() {
    local role="${ROLE:-unknown}"
    local department="${DEPARTMENT:-unknown}"
    local role_icon=$(get_role_icon "$role")
    local dept_icon=$(get_department_icon "$department")
    
    # 役割別説明を生成
    local role_description=""
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

    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Claude Code 自動役割認識システム準備完了${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}${role_icon} エージェントID:${NC} ${AGENT_ID:-未設定}"
    echo -e "${WHITE}🏢 部門:${NC} ${department}"
    echo -e "${WHITE}👤 役割:${NC} ${role}"
    echo -e "${WHITE}📋 詳細:${NC} ${role_description}"
    echo -e "${WHITE}🎯 状態:${NC} 自動役割認識済み・指示待機中"
    echo -e "${WHITE}💬 通信:${NC} ./agent-send.sh 経由"
    echo -e "${WHITE}🔄 機能:${NC} 自動指示実行・ultrathink付加・重複防止"
    echo ""
    echo -e "${YELLOW}🚀 Claude Code Ready! (毎回役割確認不要)${NC}"
    echo -e "${PURPLE}   手動起動案内: start_claude_with_role${NC}"
    echo -e "${PURPLE}   即座起動: quick_claude_start${NC}"
    echo -e "${PURPLE}   役割確認: check_role_recognition${NC}"
    echo ""
}

# タスクプロセッサー起動
start_task_processor() {
    local role="${ROLE:-unknown}"
    
    # President以外は指示監視・自動実行を開始
    if [ "$role" != "president" ]; then
        echo -e "${BLUE}🔄 指示監視・自動実行システム起動中...${NC}"
        
        # バックグラウンドでタスクプロセッサー開始
        nohup "$SCRIPT_DIR/task-processor.sh" monitor > /dev/null 2>&1 &
        local processor_pid=$!
        
        echo -e "${GREEN}✅ タスクプロセッサー起動完了${NC} (PID: $processor_pid)"
        echo -e "${YELLOW}📋 機能:${NC} 指示受信→ultrathink付加→自動実行→完了報告"
        echo ""
    else
        echo -e "${YELLOW}🏛️ President: 指示送信専用モード${NC}"
        echo -e "${BLUE}💬 使用方法:${NC} ./agent-send.sh [agent] \"[指示]\" で指示送信"
        echo ""
    fi
}

# メイン処理
main() {
    clear
    
    # エージェント情報表示
    show_agent_info
    
    # インストラクション表示
    if ! show_instructions; then
        echo -e "${RED}❌ インストラクション表示に失敗しました${NC}"
        return 1
    fi
    
    # Claude Code準備完了メッセージ
    show_claude_ready
    
    # タスクプロセッサー起動
    start_task_processor
    
    return 0
}

# 関数をエクスポート（他のシェルでも利用可能）
export -f start_claude_with_role
export -f quick_claude_start
export -f check_role_recognition
export -f get_role_icon
export -f get_department_icon
export -f get_instruction_file

# スクリプトが直接実行された場合
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
else
    # ソースされた場合の追加機能表示
    echo -e "${BLUE}🔧 追加機能が利用可能になりました:${NC}"
    echo -e "${YELLOW}  start_claude_with_role${NC} - Claude Code手動起動案内（環境変数明示）"
    echo -e "${YELLOW}  quick_claude_start${NC} - Claude Code即座起動（役割認識付き）"
    echo -e "${YELLOW}  check_role_recognition${NC} - 役割認識状況確認"
fi