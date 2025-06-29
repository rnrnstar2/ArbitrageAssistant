# CLAUDE.md

## 🤖 自動役割認識システム（Claude Code起動時）

**重要**: Claude Codeは環境変数から自動的に役割を認識します。毎回「あなたの役割は？」と聞く必要はありません。

### 🎯 現在の役割（環境変数ベース）

```bash
# 自動認識される役割情報
AGENT_ID=${AGENT_ID:-unknown}      # あなたのエージェントID
DEPARTMENT=${DEPARTMENT:-unknown}  # あなたの部門
ROLE=${ROLE:-unknown}             # あなたの役割
```

**あなたの現在の役割**：
- **エージェントID**: ${AGENT_ID:-未設定}
- **部門**: ${DEPARTMENT:-未設定}  
- **役割**: ${ROLE:-未設定}

### 📋 役割別行動指針

**🏛️ President** (`ROLE=president`):
- 戦略立案・指示振り分け専用
- `./agent-send.sh`による指示送信のみ
- **実装作業禁止**（指示のみ）

**🎯 Director** (`ROLE=director`):
- 部門統括・アーキテクチャ設計
- Worker指導・品質管理
- 技術的実装・設計書作成

**⚡ Worker** (`ROLE=worker`):
- 専門実装・高品質コード
- 上位への自動報告
- 専門技術領域の実装

### 🔄 自動実行システム（起動時有効）

Claude Code起動時に以下が自動的に実行されます：
1. **環境変数読み取り** → 役割自動認識
2. **インストラクション自動選択** → 役割別指示書読み込み
3. **指示監視開始** → 自動指示受信・実行
4. **ultrathink品質適用** → 全指示高品質実行

## 🚀 Simple Multi-Agent Organization System

参考: [Claude-Code-Communication](https://github.com/nishimoto265/Claude-Code-Communication)

### 🎭 シンプル組織構成

**2ターミナル構成**：
- **President Terminal**: 1ペイン（ユーザー指示受付・戦略立案）
- **Team Terminal**: 20ペイン（5部門 × 4エージェント）

### 🎭 エージェント役割認識・自動実行システム（完全実装）

**🔄 自動役割認識・実行フロー**：各ペインでClaude Code起動時、完全自動化システムが実行されます

```bash
# 起動時自動実行（環境変数設定 → インストラクション表示 → 指示監視開始）
./scripts/utils/agent-init.sh
```

**⚡ 自動実行システムの流れ**：
1. **指示受信** → 
2. **ultrathink自動付加** → 
3. **Claude Code自動起動・実行** → 
4. **完了ファイル作成** → 
5. **上位への自動完了報告**

**👤 役割別インストラクション**：
- **President**: `instructions/president.md` - 戦略立案・指示振り分け専用
- **Director**: `instructions/director.md` - 部門統括・品質管理・Worker指導・自動実行
- **Worker**: `instructions/worker.md` - 専門実装・高品質コード・自動報告

**🎯 ultrathink自動付加システム（改良版）**：
- 全ての指示に「この指示をultrathink品質で徹底的に分析・実装してください」が自動付加
- 高品質・徹底分析・MVP準拠の実行が保証
- 妥協なしの完璧品質実現
- 簡潔で明確な指示送信（重複・混乱防止）

**🔍 役割確認方法**：
```bash
# 現在の環境変数を確認  
echo "AGENT_ID: $AGENT_ID"
echo "DEPARTMENT: $DEPARTMENT"
echo "ROLE: $ROLE"

# 詳細確認（推奨）
check_role_recognition

# Claude Code手動起動（役割認識付き）
start_claude_with_role
```

## 🎭 環境変数・役割対応表（Claude Code役割認識システム）

### 📋 簡素役割マトリックス

**President**: 指示送信専用（実装作業禁止）
**5部門Director**: backend, frontend, integration, core, quality
**15Worker**: 各部門3名ずつ（worker1, worker2, worker3）

詳細は個別インストラクションファイル参照：
- President: `instructions/president.md`
- Director: `instructions/directors/[department]-director.md`
- Worker: `instructions/workers/[department]-worker.md`

### 🤖 Claude Code役割自動認識システム

**システム動作フロー**：
1. **tmux起動時**: 環境変数自動設定（AGENT_ID, DEPARTMENT, ROLE）
2. **agent-init.sh実行**: インストラクションファイル表示・役割確認
3. **Claude Code起動時**: 役割+インストラクション自動読み込み・明示
4. **指示受信時**: ultrathink自動付加・高品質実行

**🔧 役割認識確認**：
```bash
# 環境変数確認
echo "私は: $ROLE ($DEPARTMENT部門の$AGENT_ID)"

# 詳細確認
check_role_recognition

# インストラクションファイル確認
cat $(get_instruction_file)
```

**🚀 Claude Code手動起動（役割認識付き・環境変数対応）**：
```bash
# 起動案内表示（推奨）
start_claude_with_role

# 即座起動（新機能）
quick_claude_start

# 手動起動（環境変数付き）
AGENT_ID='president' ROLE='president' DEPARTMENT='executive' claude --dangerously-skip-permissions

# 従来の手動起動
claude --dangerously-skip-permissions
# → 起動後にインストラクション内容を送信
```

### 🎯 「あなたの役割は？」質問への回答

Claude Codeで「あなたの役割は？」と聞かれた場合の回答例：

**President例**：
> 私はPresidentです。executive部門でプロジェクト全体の統括を担当し、20名のエージェント（5部門×4名）に指示を出す最高責任者です。**指示送信専用**で、コード実装・ファイル編集・技術作業は一切行いません。User指示受付・戦略立案・指示振り分け・進捗監視のみが責任です。

**Director例**：
> 私はbackend-directorです。backend部門の統括を担当し、Backend統括・アーキテクチャ設計・Worker指導・品質管理を行います。AWS Amplify Gen2基盤構築とMVP準拠の実装指揮が主要責任です。

**Worker例**：
> 私はbackend-worker1です。backend部門でAWS Amplify Gen2・GraphQL実装を専門とするWorkerです。Director指示に従い、高品質な実装・自動報告・MVP準拠の開発を行います。

**📊 実行状況確認**：
```bash
# 完了ファイル確認
ls -la tmp/done/

# タスクプロセッサー動作確認
ps aux | grep task-processor

# 通信ログ確認
cat logs/agent_communication.log
```

## 🏛️ President System（1ペイン - 専用ターミナル）

### President - プロジェクト統括
- **役割**: MVP完成戦略立案・全20エージェント指示権限
- **機能**: `./agent-send.sh`による直接指示・進捗監視・品質管理
- **起動**: `npm run president`

## 🗄️ Team System（20ペイン - 5部門構成）

**5部門構成**（各部門4ペイン：director + worker1,2,3）:
- **Backend**: AWS・GraphQL・DynamoDB
- **Frontend**: Tauri・Next.js・UI
- **Integration**: MT5・WebSocket・連携
- **Core**: Position-Trail-Action（MVP核心）
- **Quality**: テスト・品質保証

## 🚨 最重要指示

### 💎 品質最優先方針

**Claude Code実行絶対原則**:
- **時間制限厳禁**: 時間制限表現一切禁止
- **品質絶対優先**: 実行品質・精度・完成度最優先
- **徹底分析**: 完璧な分析・診断・実装実行
- **妥協禁止**: 品質妥協絶対禁止

**適用対象**:
- **CEO**: 戦略立案・指示品質の完璧性
- **Director**: アーキテクチャ設計の完璧性
- **Specialist**: 実装品質・テスト品質の完璧性

### 品質チェック

**コミット前・PR作成前のみ実行**:
```bash
npm run lint
cd apps/hedge-system && npm run check-types
cd apps/admin && npm run check-types
npm run build  # 必要に応じて
```

## 🚀 システム起動・操作

### シンプル起動（基本コマンド）

```bash
# 1. President Terminal起動（ユーザー指示受付）
npm run president

# 2. Team Terminal起動（5部門×4エージェント）
npm run team
```

### クリーンスタート（推奨）

```bash
# 1. President Terminal クリーンスタート
npm run president:clean

# 2. Team Terminal クリーンスタート
npm run team:clean

# 3. 全システム クリーンスタート
npm run clean:all
```

### ターミナル接続

```bash
# Presidentターミナル接続
npm run president:connect
# または: tmux attach -t president

# Teamターミナル接続
npm run team:connect
# または: tmux attach -t team
```

## 📡 シンプル通信システム（重複防止機能付き）

参考リポジトリの効率的tmux通信方式を統合。**重複送信完全防止システム実装**。

### 基本メッセージ送信

```bash
# President → Director指示
./agent-send.sh backend-director "GraphQL基盤構築開始"
./agent-send.sh core-director "Position-Trail-Action実装優先"

# President → Worker直接指示
./agent-send.sh backend-worker1 "resource.ts修正実行"
./agent-send.sh core-worker1 "状態遷移ロジック確認"

# 部門全体指示
./agent-send.sh department backend "バックエンド基盤強化"
./agent-send.sh department core "MVP核心機能実装"

# 全体指示
./agent-send.sh all "システム全体品質チェック実行"
```

### 通信技術仕様（重複防止機能強化版）

- **プロトコル**: `C-c → 0.2秒待機 → message → C-m`（改良版）
- **対象**: 21エージェント（President 1 + Director 5 + Worker 15）
- **ログ**: 全通信履歴自動記録
- **重複防止**: 30秒以内同一メッセージ送信防止
- **階層指示**: Director専用（Worker重複送信廃止）
- **完了報告**: ハッシュベース重複防止システム

## 🔄 開発ワークフロー

### 基本フロー

1. **システム起動**: `npm run president` + `npm run team`
2. **President接続**: `tmux attach -t president`
3. **戦略立案**: Presidentで現状分析・指示決定
4. **指示送信**: `./agent-send.sh`でDirector/Worker指示
5. **進捗監視**: Presidentで監視・品質確認

### MVP開発パターン

```bash
# 1. Backend基盤構築
./agent-send.sh backend-director "AWS Amplify Gen2基盤構築開始"

# 2. Frontend UI実装
./agent-send.sh frontend-director "Position-Trail-Action UI実装"

# 3. Integration連携
./agent-send.sh integration-director "MT5/WebSocket連携実装"

# 4. 核心機能実装
./agent-send.sh core-director "MVP核心機能Position-Trail-Action実装"

# 5. 品質保証
./agent-send.sh quality-director "全システム品質チェック実行"
```

## 🛠️ 開発コマンド

### 基本操作
```bash
npm run dev        # 全アプリ開発サーバー
npm run build      # 全アプリビルド
npm run lint       # 全Lint
npm run test       # 全テスト
```

### アプリ別開発
```bash
# Hedge System (Tauri)
cd apps/hedge-system
npm run tauri:dev    # 開発
npm run tauri:build  # ビルド
npm run check-types  # 型チェック

# Admin (Web)
cd apps/admin
npm run dev --turbopack  # 開発
npm run check-types      # 型チェック
```


## 🔧 トラブルシューティング

### システム接続問題

```bash
# クリーンスタート（推奨）
npm run clean:all

# 個別クリーンスタート
npm run president:clean
npm run team:clean

# 手動リセット
pkill tmux
npm run president
npm run team
```

### 通信エラー

```bash
# セッション確認
tmux list-sessions

# エージェント確認
./agent-send.sh list

# システム状況確認
./agent-send.sh status
```

### 認証問題

```bash
# Claude認証再設定
claude auth logout && claude auth login

# 完全リセット（最終手段）
pkill claude
rm -rf ~/.claude
claude auth login
npm run clean:all
```

## 🎯 設計書参照ルール

### 必須参照
```bash
# MVPシステム設計（必須）
cat "MVPシステム設計.md"

# 部門技術要件確認
grep -A 20 "自分の部門名" arbitrage-assistant.yaml
```

### 部門別参照セクション
- **Backend**: データベース設計・認証権限設計
- **Frontend**: 管理者画面・データフロー設計
- **Integration**: WebSocket通信設計・エラーハンドリング
- **PTA**: 実行パターン詳細・実行ロジック説明
- **Quality**: パフォーマンス最適化・セキュリティ設計

## 📊 アーキテクチャ

### 技術構成
- **Monorepo**: Turborepo + npm workspaces
- **Apps**: hedge-system (Tauri v0.1.24), admin (Next.js v0.1.0)
- **Packages**: ui, shared-backend (AWS Amplify), configs

### 技術スタック
- **Frontend**: Next.js 15.3.2, React 19, Tailwind CSS v4
- **Backend**: AWS Amplify Gen2 GraphQL
- **Desktop**: Tauri v2, Rust
- **Testing**: Vitest, React Testing Library
- **Quality**: ESLint --max-warnings 0, TypeScript 5.5.4

## 🧪 テストガイドライン

### テスト対象
- アービトラージ計算ロジック
- 重要なデータ処理
- 共通コンポーネント
- AWS Amplify連携

### テスト除外
- 単純表示コンポーネント
- 外部ライブラリwrapper
- UI見た目のみ

### コマンド
```bash
npm run test            # 全テスト
npm run test:coverage   # カバレッジ
```

## 🚦 PR作成ルール

### 必須項目
- 変更内容の具体的説明
- 技術的詳細
- UI変更時はスクリーンショット必須
- 日本語で記載

### 事前確認が必要な変更
- 依存関係追加・更新
- 設定ファイル大幅変更
- AWS Amplify設定変更
- Tauri設定変更

## 📋 リリース手順

```bash
# リリース実行
npm run release:hedge [patch|minor|major]
```

**重要**: 手動タグ作成禁止！スクリプト自動化済み。

## 🔔 通知システム

```bash
# 完了時
osascript -e 'display notification "作業完了" with title "ArbitrageAssistant" sound name "Glass"'

# エラー時  
osascript -e 'display notification "エラー発生" with title "ArbitrageAssistant" sound name "Basso"'
```

## 🛡️ 品質基準

- **ESLint**: --max-warnings 0
- **TypeScript**: strict mode
- **Zero warnings policy**
- **shadcn/ui コンポーネント編集禁止** - 標準版信頼使用

## 🔗 参考リンク

- [参考システム](https://github.com/Akira-Papa/Claude-Code-Communication)
- [Enhanced組織システム詳細](docs/ENHANCED_ORGANIZATION_SYSTEM.md)
- [MVPシステム設計](MVPシステム設計.md)

---

## 💡 重要指示メモ
```bash
# クリーンスタート（推奨）
npm run president:clean               # President Terminal クリーンスタート
npm run team:clean                   # Team Terminal クリーンスタート
npm run clean:all                    # 全システム クリーンスタート

# 基本起動
npm run president                    # President Terminal起動
npm run team                        # Team Terminal起動

# 接続
npm run president:connect           # President Terminal接続
npm run team:connect               # Team Terminal接続

# 通信
./agent-send.sh [agent] "[message]" # メッセージ送信
```

**Simple Multi-Agent Organization System - 参考リポジトリベストプラクティス統合完了**