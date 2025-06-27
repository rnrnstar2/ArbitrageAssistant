#!/bin/bash

# Director Execution Check System
# Director配下指示送信実行確認システム

set -e

# 使用方法チェック
if [ $# -eq 0 ]; then
    echo "使用方法: $0 [option]"
    echo ""
    echo "オプション:"
    echo "  --check-all                # 全Director配下指示送信状況確認"
    echo "  --check-director <id>      # 特定Director確認"
    echo "  --monitor                  # リアルタイム監視モード"
    echo "  --last-activity            # 直近の配下指示送信活動確認"
    echo ""
    echo "例:"
    echo "  $0 --check-all"
    echo "  $0 --check-director trading-flow-director"
    echo "  $0 --monitor"
    exit 1
fi

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Director→ペイン番号マッピング
get_director_pane() {
    case "$1" in
        "backend-director") echo "1.0" ;;
        "trading-flow-director") echo "2.0" ;;
        "integration-director") echo "3.0" ;;
        "frontend-director") echo "4.0" ;;
        "devops-director") echo "5.0" ;;
        *) echo "" ;;
    esac
}

# Director→Specialists マッピング
get_director_specialists() {
    case "$1" in
        "backend-director") echo "1.1,1.2:amplify-gen2-specialist,cognito-auth-expert" ;;
        "trading-flow-director") echo "2.1,2.2:entry-flow-specialist,settlement-flow-specialist" ;;
        "integration-director") echo "3.1,3.2:mt5-connector-specialist,websocket-engineer" ;;
        "frontend-director") echo "4.1,4.2:react-specialist,desktop-app-engineer" ;;
        "devops-director") echo "5.1,5.2:build-optimization-engineer,quality-assurance-engineer" ;;
        *) echo "" ;;
    esac
}

# 配下指示送信確認関数
check_director_execution() {
    local director_id="$1"
    local pane=$(get_director_pane "$director_id")
    
    if [ -z "$pane" ]; then
        echo -e "${RED}❌ 不正なDirector ID: $director_id${NC}"
        return 1
    fi
    
    echo -e "${CYAN}📊 $director_id 配下指示送信状況確認${NC}"
    echo "========================================"
    
    # TMUXセッション確認
    if ! tmux has-session -t arbitrage-assistant 2>/dev/null; then
        echo -e "${RED}❌ Haconiwa環境が起動していません${NC}"
        return 1
    fi
    
    # Directorペイン履歴確認
    echo -e "${BLUE}📋 Director Pane ($pane) 履歴確認${NC}"
    local director_history=$(tmux capture-pane -t arbitrage-assistant:$pane -p | tail -20)
    
    # 配下指示送信コマンド実行確認
    if echo "$director_history" | grep -q "director-auto-delegate.sh"; then
        echo -e "${GREEN}✅ 配下指示送信コマンド実行確認済み${NC}"
        
        # 最後の指示送信時刻確認
        local last_command=$(echo "$director_history" | grep "director-auto-delegate.sh" | tail -1)
        echo "最後の指示送信: $last_command"
        
        # 配下指示送信完了確認
        if echo "$director_history" | grep -q "配下指示送信完了"; then
            echo -e "${GREEN}✅ 配下指示送信完了確認済み${NC}"
        else
            echo -e "${YELLOW}⚠️  配下指示送信完了未確認${NC}"
        fi
        
    else
        echo -e "${RED}❌ 配下指示送信コマンド未実行${NC}"
        echo -e "${RED}Director責任未履行: ./scripts/director-auto-delegate.sh 実行必須${NC}"
    fi
    
    # 配下Specialist状況確認
    local specialists_info=$(get_director_specialists "$director_id")
    local panes=$(echo "$specialists_info" | cut -d':' -f1)
    local names=$(echo "$specialists_info" | cut -d':' -f2)
    
    echo ""
    echo -e "${BLUE}📊 配下Specialist状況${NC}"
    echo "----------------------------------------"
    
    IFS=',' read -ra PANE_ARRAY <<< "$panes"
    IFS=',' read -ra NAME_ARRAY <<< "$names"
    
    local specialist_active=0
    local total_specialists=${#PANE_ARRAY[@]}
    
    for i in "${!PANE_ARRAY[@]}"; do
        local spec_pane="${PANE_ARRAY[$i]}"
        local spec_name="${NAME_ARRAY[$i]}"
        
        echo -n "  $spec_name ($spec_pane): "
        
        # Specialistペイン活動確認
        if tmux list-panes -t "arbitrage-assistant:$spec_pane" >/dev/null 2>&1; then
            local spec_history=$(tmux capture-pane -t arbitrage-assistant:$spec_pane -p | tail -10)
            
            if echo "$spec_history" | grep -q "Director指示受信"; then
                echo -e "${GREEN}✅ 指示受信確認${NC}"
                specialist_active=$((specialist_active + 1))
            elif echo "$spec_history" | grep -q "ultrathink"; then
                echo -e "${BLUE}🔄 活動中${NC}"
                specialist_active=$((specialist_active + 1))
            else
                echo -e "${YELLOW}⚠️  指示受信未確認${NC}"
            fi
        else
            echo -e "${RED}❌ ペイン未確認${NC}"
        fi
    done
    
    echo ""
    echo -e "${CYAN}📊 配下指示送信率: $specialist_active/$total_specialists ($(( specialist_active * 100 / total_specialists ))%)${NC}"
    
    if [ $specialist_active -eq $total_specialists ]; then
        echo -e "${GREEN}✅ $director_id: Director責任完全履行${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  $director_id: Director責任部分履行（改善要）${NC}"
        return 1
    fi
}

# 全Director確認関数
check_all_directors() {
    echo -e "${CYAN}📊 全Director配下指示送信状況確認${NC}"
    echo "========================================"
    
    local directors=("backend-director" "trading-flow-director" "integration-director" "frontend-director" "devops-director")
    local total_compliant=0
    local total_directors=${#directors[@]}
    
    for director in "${directors[@]}"; do
        echo ""
        if check_director_execution "$director"; then
            total_compliant=$((total_compliant + 1))
        fi
        echo ""
    done
    
    echo "========================================"
    echo -e "${CYAN}📊 全Director責任履行率: $total_compliant/$total_directors ($(( total_compliant * 100 / total_directors ))%)${NC}"
    
    if [ $total_compliant -eq $total_directors ]; then
        echo -e "${GREEN}🎉 全Director責任完全履行！${NC}"
    else
        echo -e "${YELLOW}⚠️  未履行Director: $((total_directors - total_compliant))名${NC}"
        echo -e "${RED}要改善: 配下指示送信実行が必要${NC}"
    fi
}

# リアルタイム監視関数
monitor_directors() {
    echo -e "${CYAN}📊 Director配下指示送信リアルタイム監視${NC}"
    echo "========================================"
    echo "監視中... (Ctrl+C で終了)"
    
    while true; do
        clear
        echo -e "${CYAN}📊 Director監視ダッシュボード - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
        echo "========================================"
        
        local directors=("backend-director" "trading-flow-director" "integration-director" "frontend-director" "devops-director")
        
        for director in "${directors[@]}"; do
            local pane=$(get_director_pane "$director")
            echo -n "$director ($pane): "
            
            if tmux list-panes -t "arbitrage-assistant:$pane" >/dev/null 2>&1; then
                local recent_history=$(tmux capture-pane -t arbitrage-assistant:$pane -p | tail -5)
                
                if echo "$recent_history" | grep -q "director-auto-delegate.sh"; then
                    echo -e "${GREEN}✅ 配下指示送信実行中${NC}"
                elif echo "$recent_history" | grep -q "配下指示送信完了"; then
                    echo -e "${GREEN}✅ 配下指示送信完了${NC}"
                elif echo "$recent_history" | grep -q "ultrathink"; then
                    echo -e "${BLUE}🔄 思考中${NC}"
                else
                    echo -e "${YELLOW}⏸️  待機中${NC}"
                fi
            else
                echo -e "${RED}❌ 未接続${NC}"
            fi
        done
        
        echo ""
        echo "----------------------------------------"
        echo "次回更新: 5秒後"
        sleep 5
    done
}

# 直近活動確認関数
check_last_activity() {
    echo -e "${CYAN}📊 直近の配下指示送信活動確認${NC}"
    echo "========================================"
    
    local directors=("backend-director" "trading-flow-director" "integration-director" "frontend-director" "devops-director")
    local activity_found=false
    
    for director in "${directors[@]}"; do
        local pane=$(get_director_pane "$director")
        
        if tmux list-panes -t "arbitrage-assistant:$pane" >/dev/null 2>&1; then
            local history=$(tmux capture-pane -t arbitrage-assistant:$pane -p)
            
            # 配下指示送信活動検索
            local delegate_commands=$(echo "$history" | grep -n "director-auto-delegate.sh" | tail -3)
            
            if [ -n "$delegate_commands" ]; then
                activity_found=true
                echo ""
                echo -e "${GREEN}✅ $director 直近配下指示送信活動${NC}"
                echo "$delegate_commands"
            fi
        fi
    done
    
    if [ "$activity_found" = false ]; then
        echo -e "${YELLOW}⚠️  直近の配下指示送信活動なし${NC}"
        echo "Directorが指示を受信している場合、配下指示送信実行を確認してください"
    fi
    
    echo ""
    echo -e "${CYAN}💡 Director責任確認コマンド${NC}"
    echo "cat scripts/directors/common/director-core-responsibility.md"
}

# メイン処理
case "$1" in
    "--check-all")
        check_all_directors
        ;;
    "--check-director")
        if [ $# -lt 2 ]; then
            echo -e "${RED}❌ Director IDを指定してください${NC}"
            echo "利用可能: backend-director, trading-flow-director, integration-director, frontend-director, devops-director"
            exit 1
        fi
        check_director_execution "$2"
        ;;
    "--monitor")
        monitor_directors
        ;;
    "--last-activity")
        check_last_activity
        ;;
    *)
        echo -e "${RED}❌ 不正なオプション: $1${NC}"
        echo ""
        echo "利用可能オプション:"
        echo "  --check-all, --check-director <id>, --monitor, --last-activity"
        exit 1
        ;;
esac