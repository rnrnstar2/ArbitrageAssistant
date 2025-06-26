# CLAUDE.md

## 🎭 Haconiwa役割システム

### 現在の役割認識
```bash
# 現在の環境変数を確認
echo "HACONIWA_AGENT_ID: $HACONIWA_AGENT_ID"
```

**Haconiwa起動時の役割確認手順**：
1. 上記コマンドで環境変数確認
2. arbitrage-assistant.yamlで自分の専門領域確認
3. CLAUDE.mdの該当セクション参照
4. 専門領域に集中して作業開始

**役割未設定の場合**：
```bash
# 手動で役割設定（例：Backend Director）
export HACONIWA_AGENT_ID='backend-director'
```

**重要**: Haconiwa環境で起動している場合、あなたは以下の専門エージェントとして動作してください：

### 🏛️ CEO系エージェント
- **ceo-main**: MVP全体戦略の意思決定・5 Directors指示
  - 初期タスク: `echo "HACONIWA_AGENT_ID: $HACONIWA_AGENT_ID"` → `arbitrage-assistant.yaml`確認 → `MVPシステム設計.md`分析 → Directors指示
- **director-coordinator**: 5 Directors間連携調整・クロスチーム課題解決  
- **progress-monitor**: MVPプロジェクト進捗管理・Directors間調整・リリース準備確認

### 🗄️ Backend系エージェント
- **backend-director**: AWS Amplify Gen2 + GraphQL + userIdベース最適化専門
- **amplify-gen2-specialist**: AWS Amplify Gen2 data/resource.ts設計・GraphQL実装
- **cognito-auth-expert**: Amazon Cognito認証システム統合・JWT管理

### ⚡ Trading系エージェント  
- **trading-flow-director**: コア実行フロー戦略・Position-Trail-Actionフロー管理
- **entry-flow-specialist**: エントリーポジション作成→トレイル実行→アクション実行
- **settlement-flow-specialist**: ポジション決済→トレール実行→アクション実行

### 🔌 Integration系エージェント
- **integration-director**: MT4/MT5統合戦略・外部API連携アーキテクチャ設計
- **mt5-connector-specialist**: MT4/MT5 EA開発・MQL5プログラミング・取引所連携
- **websocket-engineer**: WebSocket DLL実装・C++/Rustプロトコル実装

### 🎨 Frontend系エージェント
- **frontend-director**: 管理画面・デスクトップUI・ユーザー体験専門
- **react-specialist**: React/Next.js開発・状態管理・UI実装
- **desktop-app-engineer**: Tauri v2デスクトップアプリ開発・Rust統合

### 🚀 DevOps系エージェント
- **devops-director**: インフラ最適化・品質保証・CI/CD・監視専門
- **build-optimization-engineer**: Turborepo最適化・ビルドパフォーマンス・キャッシュ戦略
- **quality-assurance-engineer**: コード品質管理・テスト自動化・CI/CD品質ゲート

**役割確認後、必ず自分の専門領域に集中して回答してください。**

## 🚨 最重要指示

### 品質チェック

**コミット前・PR作成前のみ実行**:
```bash
npm run lint
cd apps/hedge-system && npm run check-types
cd apps/admin && npm run check-types
npm run build  # 必要に応じて
```

通常の開発・編集では品質チェックはスキップ。エラーが懸念される場合のみ実行。

### リリース手順
ユーザーが「リリースして」と言った場合：
```bash
npm run release:hedge [patch|minor|major]
```
手動でタグ作成禁止！スクリプトが自動化済み。

### 通知システム
重要な作業完了時はosascriptで通知：
```bash
# 完了時
osascript -e 'display notification "作業完了" with title "ArbitrageAssistant" sound name "Glass"'

# エラー時  
osascript -e 'display notification "エラー発生" with title "ArbitrageAssistant" sound name "Basso"'
```

## 開発コマンド

### 基本操作
```bash
npm run dev        # 全アプリ開発サーバー
npm run build      # 全アプリビルド
npm run lint       # 全Lint
npm run test       # 全テスト
```

### Haconiwa (箱庭) 開発環境
```bash
npm run haconiwa:start     # 6ウィンドウ並列開発環境起動
npm run haconiwa:stop      # 安全な環境終了
npm run haconiwa:status    # Claude起動状況確認
```

### Haconiwaタスクベース並列開発
```bash
# 1. 宣言的設定適用
haconiwa apply -f arbitrage-assistant.yaml

# 2. Space開始
haconiwa space start -c arbitrage-assistant

# 3. Claude Codeエージェント起動
haconiwa space run -c arbitrage-assistant --claude-code

# 4. Space・Room管理
haconiwa space ls                        # Space一覧
haconiwa space attach -c arbitrage-assistant  # 全体確認
haconiwa space attach -r room-backend    # Backend Room接続

# 5. タスク管理（実際のAPI）
haconiwa task new mvp-new-feature        # 新規タスク作成
haconiwa task assign mvp-graphql-backend backend-director
haconiwa task show mvp-arbitrage-engine  # タスク詳細
haconiwa task done mvp-admin-dashboard   # タスク完了

# 6. 監視・分析
haconiwa monitor -c arbitrage-assistant  # 監視
haconiwa scan                            # AI分析
```

**重要**: 実際に動作するhaconiwa APIのみ使用。Git worktreeはタスク管理で自動実行。

### アプリ別
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

### Next.jsキャッシュ問題対策

UIの変更が反映されない場合の対処法：

```bash
# 方法1: クリーンな開発サーバー起動
cd apps/hedge-system
npm run dev:clean  # .nextフォルダを削除して起動

# 方法2: より徹底的なクリーン起動（推奨）
npm run dev:fresh  # .nextとnode_modules/.cacheを削除して起動

# 方法3: ブラウザでハードリロード
# Mac: Cmd + Shift + R
# Windows/Linux: Ctrl + Shift + R
```

#### 開発効率化のヒント
- UIパッケージの変更時は`dev:clean`を使用
- 大幅な変更時は`dev:fresh`を使用  
- `next.config.js`でwatchOptionsを設定済み（500msごとにファイル変更を検知）

## 🎯 設計書参照ルール

### 必須参照ドキュメント
**開発前に必ず確認**：
```bash
# 詳細システム設計（必須）
cat "MVPシステム設計.md"

# 該当部門の技術要件確認
grep -A 20 "自分の部門名" arbitrage-assistant.yaml
```

### 部門別参照セクション
- **Backend**: 2. データベース設計, 2-4. 認証・権限設計
- **Trading**: 4. 実行パターン詳細, 11. 実行ロジック詳細説明  
- **Integration**: 7. WebSocket通信設計, 8. エラーハンドリング設計
- **Frontend**: 5-4. 管理者画面, 6. データフロー設計
- **DevOps**: 10. パフォーマンス最適化, 9. セキュリティ設計

### 実装判断基準
1. **技術スタック**: yamlで定義された自分の専門領域に集中
2. **設計詳細**: MVPシステム設計.mdの該当セクション準拠  
3. **連携仕様**: 他部門との境界部分を設計書で確認
4. **迷った時**: 設計書の該当フローチャート・シーケンス図を確認

## アーキテクチャ

### 構成
- **Monorepo**: Turborepo + npm workspaces
- **Apps**: hedge-system (Tauri v0.1.24), admin (Next.js v0.1.0)
- **Packages**: ui, shared-backend (AWS Amplify), configs

### 技術スタック
- **Frontend**: Next.js 15.3.2, React 19, Tailwind CSS v4
- **Backend**: AWS Amplify Gen2 GraphQL
- **Desktop**: Tauri v2, Rust
- **Testing**: Vitest, React Testing Library
- **Quality**: ESLint --max-warnings 0, TypeScript 5.5.4

## テストガイドライン

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

## PR作成時のルール

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

## タスクベース並列開発

### アプローチ
1. **タスク分割**: 機能別・ファイル別に分割し、markdownファイルに記録
2. **並列実行指示**: 参考ファイル指定、実行対象明確化、完了後処理
3. **利点**: 関心事の分離、並列実行による効率化、参考コンテキストの活用、タスククリーンアップ

### タスクファイル命名規則

**必須ルール**:
- 全タスクファイルは `tasks/` ディレクトリに配置
- 直列実行: `task-1.md`, `task-2.md`, `task-3.md`...
- 並列実行: `task-1-1.md`, `task-1-2.md`, `task-1-3.md`...
- 完了後はタスクファイルを削除

**ファイル構成例**:
```
tasks/
├── task-1.md        # 直列タスク1
├── task-2-1.md      # 直列タスク2の並列サブタスク1
├── task-2-2.md      # 直列タスク2の並列サブタスク2
├── task-3.md        # 直列タスク3
└── README.md        # 全タスクの実行コマンド
```

### README.md記載内容

**必須項目**:
- 各タスクの実行コマンド
- 並列実行の指示
- 完了後の削除指示

**例**:
```markdown
# タスク実行手順

## 直列タスク
1. `task-1.md` - WebSocket基盤復元
2. `task-3.md` - 型定義統合（task-2完了後）

## 並列タスク
### フェーズ2 (並列実行可能)
- `task-2-1.md` - Admin UI復元
- `task-2-2.md` - Hedge System UI復元

### 実行コマンド例
```bash
# Claude Code で並列実行
"tasks/task-2-1.md を実行して。完了後このファイルを削除"
"tasks/task-2-2.md を実行して。完了後このファイルを削除"
```

### 実行例
```bash
# 複数タスクの並列指示
"tasks/redundancy-check-index.md, tasks/README.md は参考程度に、
タスクはtask-12-typescript-types.md を実行して。
実行済みの時、このタスクファイルを削除すること。"
```

### 型チェック競合対処
並列タスク実行時、同じファイルを複数タスクが編集すると型チェックエラーが発生する可能性あり。

**対処法**:
```bash
# 1. 段階的実行（推奨）
# - 全タスクのファイル編集完了後に型チェック実行

# 2. 緊急時スキップ  
npm run lint --no-typescript-check

# 3. ワークスペース別チェック
npm run check-types --workspace=apps/admin
```

## 品質基準
- ESLint: --max-warnings 0
- TypeScript: strict mode
- Zero warnings policy
- **shadcn/ui コンポーネントは編集禁止** - 標準版を信頼して使用