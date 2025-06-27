#!/bin/bash

# Haconiwa起動スクリプト一括修正ツール
# 全ペインの環境変数設定を新しい関数に統一

SCRIPT_FILE="/Users/rnrnstar/github/ArbitrageAssistant/scripts/haconiwa-start.sh"

echo "🔧 Haconiwa起動スクリプト環境変数設定修正中..."

# Backend Window (1.0-1.2)修正
sed -i '' '/# Pane 1.0: Backend Director/,/claude --dangerously-skip-permissions/c\
# Pane 1.0: Backend Director\
start_agent "1.0" "backend-director" "Backend Director (backend-director) - AWS Amplify Gen2 + GraphQL + userIdベース最適化専門" "$BASE_DIR"
' "$SCRIPT_FILE"

sed -i '' '/# Pane 1.1: Amplify Gen2 Specialist/,/claude --dangerously-skip-permissions/c\
# Pane 1.1: Amplify Gen2 Specialist\
tmux split-window -t $SESSION_NAME:1.0 -h\
sleep 3\
start_agent "1.1" "amplify-gen2-specialist" "Amplify Gen2 Specialist (amplify-gen2-specialist) - AWS Amplify Gen2 data/resource.ts設計・User/Account/Position/Action CRUD実装"
' "$SCRIPT_FILE"

sed -i '' '/# Pane 1.2: Cognito Authentication Expert/,/claude --dangerously-skip-permissions/c\
# Pane 1.2: Cognito Authentication Expert\
tmux split-window -t $SESSION_NAME:1.0 -v\
sleep 3\
start_agent "1.2" "cognito-auth-expert" "Cognito Authentication Expert (cognito-auth-expert) - Amazon Cognito認証システム統合・JWT トークン管理"
' "$SCRIPT_FILE"

# Trading Window (2.0-2.2)修正
sed -i '' '/# Pane 2.0: Trading Flow Director/,/claude --dangerously-skip-permissions/c\
# Pane 2.0: Trading Flow Director\
start_agent "2.0" "trading-flow-director" "Trading Flow Director (trading-flow-director) - コア実行フロー戦略・Position-Trail-Actionフロー管理" "$BASE_DIR"
' "$SCRIPT_FILE"

sed -i '' '/# Pane 2.1: Entry Flow Specialist/,/claude --dangerously-skip-permissions/c\
# Pane 2.1: Entry Flow Specialist\
tmux split-window -t $SESSION_NAME:2.0 -h\
sleep 3\
start_agent "2.1" "entry-flow-specialist" "Entry Flow Specialist (entry-flow-specialist) - エントリーポジション作成→トレイル実行→アクション実行"
' "$SCRIPT_FILE"

sed -i '' '/# Pane 2.2: Settlement Flow Specialist/,/claude --dangerously-skip-permissions/c\
# Pane 2.2: Settlement Flow Specialist\
tmux split-window -t $SESSION_NAME:2.0 -v\
sleep 3\
start_agent "2.2" "settlement-flow-specialist" "Settlement Flow Specialist (settlement-flow-specialist) - ポジション選択→ロスカット時トレール実行→アクション実行"
' "$SCRIPT_FILE"

# Integration Window (3.0-3.2)修正
sed -i '' '/# Pane 3.0: Integration Director/,/claude --dangerously-skip-permissions/c\
# Pane 3.0: Integration Director\
start_agent "3.0" "integration-director" "Integration Director (integration-director) - MT4/MT5統合戦略・外部API連携アーキテクチャ設計" "$BASE_DIR"
' "$SCRIPT_FILE"

sed -i '' '/# Pane 3.1: MT5 Connector Specialist/,/claude --dangerously-skip-permissions/c\
# Pane 3.1: MT5 Connector Specialist\
tmux split-window -t $SESSION_NAME:3.0 -h\
sleep 3\
start_agent "3.1" "mt5-connector-specialist" "MT5 Connector Specialist (mt5-connector-specialist) - MT4/MT5 EA開発・MQL5プログラミング・取引所連携"
' "$SCRIPT_FILE"

sed -i '' '/# Pane 3.2: WebSocket Engineer/,/claude --dangerously-skip-permissions/c\
# Pane 3.2: WebSocket Engineer\
tmux split-window -t $SESSION_NAME:3.0 -v\
sleep 3\
start_agent "3.2" "websocket-engineer" "WebSocket Engineer (websocket-engineer) - WebSocket DLL実装・C++/Rustプロトコル実装"
' "$SCRIPT_FILE"

# Frontend Window (4.0-4.2)修正
sed -i '' '/# Pane 4.0: Frontend Director/,/claude --dangerously-skip-permissions/c\
# Pane 4.0: Frontend Director\
start_agent "4.0" "frontend-director" "Frontend Director (frontend-director) - 管理画面・デスクトップUI・ユーザー体験専門" "$BASE_DIR"
' "$SCRIPT_FILE"

sed -i '' '/# Pane 4.1: React Specialist/,/claude --dangerously-skip-permissions/c\
# Pane 4.1: React Specialist\
tmux split-window -t $SESSION_NAME:4.0 -h\
sleep 3\
start_agent "4.1" "react-specialist" "React Specialist (react-specialist) - React/Next.js開発・状態管理・UI実装"
' "$SCRIPT_FILE"

sed -i '' '/# Pane 4.2: Desktop App Engineer/,/claude --dangerously-skip-permissions/c\
# Pane 4.2: Desktop App Engineer\
tmux split-window -t $SESSION_NAME:4.0 -v\
sleep 3\
start_agent "4.2" "desktop-app-engineer" "Desktop App Engineer (desktop-app-engineer) - Tauri v2デスクトップアプリ開発・Rust統合"
' "$SCRIPT_FILE"

# DevOps Window (5.0-5.2)修正
sed -i '' '/# Pane 5.0: DevOps Director/,/claude --dangerously-skip-permissions/c\
# Pane 5.0: DevOps Director\
start_agent "5.0" "devops-director" "DevOps Director (devops-director) - インフラ最適化・品質保証・CI/CD・監視専門" "$BASE_DIR"
' "$SCRIPT_FILE"

sed -i '' '/# Pane 5.1: Build Optimization Engineer/,/claude --dangerously-skip-permissions/c\
# Pane 5.1: Build Optimization Engineer\
tmux split-window -t $SESSION_NAME:5.0 -h\
sleep 3\
start_agent "5.1" "build-optimization-engineer" "Build Optimization Engineer (build-optimization-engineer) - Turborepo最適化・ビルドパフォーマンス・キャッシュ戦略"
' "$SCRIPT_FILE"

sed -i '' '/# Pane 5.2: Quality Assurance Engineer/,/claude --dangerously-skip-permissions/c\
# Pane 5.2: Quality Assurance Engineer\
tmux split-window -t $SESSION_NAME:5.0 -v\
sleep 3\
start_agent "5.2" "quality-assurance-engineer" "Quality Assurance Engineer (quality-assurance-engineer) - コード品質管理・テスト自動化・CI/CD品質ゲート"
' "$SCRIPT_FILE"

echo "✅ Haconiwa起動スクリプト修正完了！"
echo "🔧 全18ペインの環境変数設定を新しい関数で統一しました"
echo ""
echo "💡 テスト実行:"
echo "  npm run haconiwa:stop && npm run haconiwa:start"