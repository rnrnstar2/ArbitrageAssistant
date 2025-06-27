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
  - **自律動作**: Haconiwa起動時に初期プロンプト自動実行（CEOからの指示不要）
- **progress-monitor**: MVPプロジェクト進捗管理・Directors間調整・リリース準備確認
  - **自律動作**: Haconiwa起動時に初期プロンプト自動実行（CEOからの指示不要）

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
npm run haconiwa:start       # 6ウィンドウ並列開発環境起動（ローカルClaude保持対応）
npm run haconiwa:clean-start # 完全クリーン起動（推奨）
npm run haconiwa:clean-tmux  # TMUX内のみクリーン起動（ローカルClaude保持）
npm run haconiwa:stop        # 安全な環境終了
npm run haconiwa:status      # Claude起動状況確認
```

**✅ ローカルClaude保持機能統合完了**:
- `npm run haconiwa:start` が自動的にローカルClaudeを保持
- 認証画面からのスタート問題を解決
- `--dangerously-skip-permissions` オプション維持

#### 🚀 起動モード選択（パフォーマンス最適化）
Haconiwa起動時に以下から選択可能：

1. **順次起動（安全・確実）** - 約60秒
   - 一つずつ確実に起動
   - 認証・競合問題ゼロ
   - 安定性最優先

2. **並列起動（高速・並列3個）** - 約20秒 **【推奨】**
   - 3ペインずつ並列起動
   - 安全性と速度のバランス
   - 認証競合回避機能付き

3. **並列起動（最高速・並列6個）** - 約15秒
   - 6ペインずつ並列起動  
   - 最高速度優先
   - 高性能環境推奨

#### 環境変数での自動化
```bash
# 環境変数で起動モード固定（対話なし）
export HACONIWA_PARALLEL_MODE=parallel_safe   # 並列3個（推奨）
export HACONIWA_PARALLEL_MODE=parallel_fast   # 並列6個（高速）
export HACONIWA_PARALLEL_MODE=sequential      # 順次起動
npm run haconiwa:start
```

#### 🎯 ワンコマンド起動（開発効率化）
```bash
npm run haconiwa:fast    # 並列3個起動（対話なし・推奨）- 約20秒
npm run haconiwa:ultra   # 並列6個起動（対話なし・最高速）- 約15秒  
npm run haconiwa:safe    # 順次起動（対話なし・安全）- 約60秒
```

**推奨使用法**:
- **日常開発**: `npm run haconiwa:fast`
- **高性能環境**: `npm run haconiwa:ultra`  
- **問題発生時**: `npm run haconiwa:safe`

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

### 🔧 Haconiwa認証問題対処法

**Claude認証ループ・初期登録問題の解決**:

```bash
# 1. 認証診断・修復
npm run haconiwa:auth-fix

# 2. 問題が続く場合の手動対処
claude auth logout && claude auth login

# 3. 完全リセット（最終手段）
pkill claude                    # 全Claudeプロセス終了
rm -rf ~/.claude               # 認証設定削除
claude auth login              # 再認証
npm run haconiwa:start         # Haconiwa再起動
```

**✅ 認証問題の解決**:
- **haconiwa:start** にローカルClaude保持機能を統合完了
- TMUX内Claudeプロセスのみを特定・終了するスマートクリーンアップ実装
- Claude認証情報（~/.claude）を自動保持
- 認証ループ・初期登録画面問題を根本解決

**改善された仕組み**:
- TMUXペインPIDベースのClaudeプロセス特定
- TMUX環境変数を持つプロセスのみ終了
- ローカルClaudeプロセスの完全保持
- 認証状態の自動継承

### 🔧 環境変数設定問題対処法

**環境変数未設定・部分的失敗の解決**:

```bash
# 1. 起動中セッションの環境変数修復
npm run haconiwa:env-fix

# 2. プロセス過多の場合のクリーンアップ
pkill claude                    # 全Claudeプロセス終了
npm run haconiwa:start         # クリーン起動

# 3. 環境変数設定確認
npm run haconiwa:debug         # 詳細診断
```

**環境変数問題の原因**:
- 20個の過多なClaudeプロセスが認証・メモリを圧迫 → **解決済み**
- tmux環境変数設定の不備 → **修正済み**
- 起動済みプロセスへの環境変数反映失敗 → **修復ツール提供**

**改善内容**:
- `tmux set-environment`による直接設定追加
- 環境変数ファイル作成の並行実行
- 起動済みセッションへの修復コマンド提供

### 🎭 エージェント役割確認・初期化

**各ペインでの役割確認・初期化**:

```bash
# 個別ペインでの役割確認
npm run agent:role              # ./scripts/role のショートカット

# 全ペイン一括初期化（ワンコマンド）
npm run agent:init              # 全18ペインに初期化コマンド送信

# 手動での役割確認
./scripts/role                  # 環境変数から役割を自動認識・表示
```

**Director専用の高精度作業ガイド**:
- `scripts/directors/backend-director-guide.md` - Backend Director専用
- `scripts/directors/trading-director-guide.md` - Trading Director専用
- `scripts/directors/integration-director-guide.md` - Integration Director専用
- `scripts/directors/frontend-director-guide.md` - Frontend Director専用
- `scripts/directors/devops-director-guide.md` - DevOps Director専用

**共通リソース**:
- `scripts/directors/common/forbidden-edits.md` - 編集禁止ファイルリスト
- `scripts/directors/common/code-snippets.md` - 共通コードスニペット集
- `scripts/directors/common/collaboration-rules.md` - コラボレーションルール

**高精度作業の基本原則**:
- **実装計画ファースト**: 複雑タスクでは最初にコードではなく詳細実装計画を作成
- **コラボレーション >> YOLO**: 推測実装せず、不明点は即座に再プロンプト
- **1Mコンテキスト活用**: 多数ファイルを一括読み込みで精度向上
- **コード→テスト→コミットループ**: 品質保証の徹底実行

**役割確認自動システム**:
- `npm run haconiwa:start`でClaude起動後、各ペインに`./scripts/role`コマンドが自動予め入力
- 指示出し時は既存の役割確認コマンドの下に` && echo "指示内容" ultrathink`形式で追加
- 実行時は「役割確認→指示実行」の順序で自動処理され、プロンプト節約・精度向上を実現

**CEO動的戦略判断システム（v2.0）**:
- `npm run ceo:dynamic` - CEO動的戦略判断システム（**推奨・メイン**）
- `npm run ceo:guide` - CEO Main専用ガイド（戦略的思考フレームワーク）
- `npm run ceo:strategic` - CEO戦略的分析システム（旧システム・参考用）
- `npm run ceo:directive` - CEO統一指示システム（旧システム・参考用）
- `npm run ceo:improvements` - CEO改良サマリー表示
- `npm run ceo:coordinator` - Director Coordinator初期プロンプト表示
- `npm run ceo:monitor` - Progress Monitor初期プロンプト表示

**🧠 CEO動的戦略判断フロー（v2.0）**:
1. **詳細現状分析**: MVPシステム設計.md要件 vs 現在実装状況の詳細比較
2. **戦略的ギャップ分析**: ビジネス価値・技術依存関係・リスク評価による戦略判断
3. **動的指示作成**: 分析結果に基づくDirector別具体的指示の自律作成
4. **戦略的指示実行**: CEO自身が作成した指示をDirectorに送信
5. **実行管理**: Director配下指示送信・完了報告の確実な管理

**🚨 重要変更: 固定指示システム廃止**:
- **固定指示禁止**: 従来の画一的指示テンプレートは廃止
- **動的判断必須**: CEOが現状分析→戦略判断→指示作成を自律実行
- **CEO系自律エージェント**: director-coordinator・progress-monitorは起動時に初期プロンプト自動実行（CEOからの手動指示不要）

**Director自動指示送信システム**:
- `npm run director:delegate [director-id] [task-description]` - Director配下への自動指示送信
- CEO→Director指示時に自動的に配下Specialistへの指示送信を実行
- Director手動指示時: `./scripts/director-auto-delegate.sh backend-director "タスク概要"`
- 全18ペインでCEO→Director→Specialist の完全自動指示送信フローを実現

**🚨 Director責任範囲の明確化**:
- **Director必須タスク**: 指示受信→配下指示送信→進捗確認→CEO報告
- **配下指示送信は必須**: `./scripts/director-auto-delegate.sh [director-id] "[task]"` 実行まで責任範囲
- **全Director専用ガイド更新済み**: `scripts/directors/common/director-core-responsibility.md` 参照必須
- **失敗例**: 指示受信だけで終了（配下への指示送信スキップは禁止）

**Director実行確認システム**:
- `npm run director:check` - 全Director配下指示送信状況確認
- `npm run director:monitor` - リアルタイム監視ダッシュボード
- `./scripts/director-execution-check.sh --check-director [director-id]` - 個別Director確認
- `./scripts/director-execution-check.sh --last-activity` - 直近の配下指示送信活動確認

### 🧹 入力バッファ残留問題対処法

**Claude入力ボックスにコマンド残留問題の解決**:

```bash
# 1. 完全クリーン起動（推奨）
npm run haconiwa:clean-start   # 全プロセス・セッション・ファイルクリーンアップ後起動

# 2. TMUX内のみクリーン起動（ローカルClaude保持）
npm run haconiwa:clean-tmux    # TMUX内Claudeのみクリーンアップ、ローカルClaude保持

# 3. 通常起動（改善済み）
npm run haconiwa:start         # 自動入力バッファクリア機能付き

# 4. 問題発生時の手動対処
# 各ペインで: Ctrl+C → Ctrl+U → Enter → clear → claude
```

**入力バッファ問題の原因**:
- 前回セッションのコマンドがClaudeに残留 → **解決済み**
- tmux終了時の入力バッファクリア不備 → **修正済み**
- Claudeプロセス終了時のデータ保持 → **完全クリーンアップ機能追加**

**改善内容**:
- 起動前の`Ctrl+C` + `Ctrl+U` + `clear`によるバッファクリア
- 段階的起動（終了→クリア→環境変数設定→起動）
- 完全クリーンアップ起動オプション提供
- セッション終了時の入力バッファクリア強化

### 🎯 ローカルClaude保持クリーンアップ

**TMUX内Claudeのみクリーンアップする新機能**:

```bash
# ローカルで開いているClaude Codeを保持したまま、TMUX内のみクリーンアップ
npm run haconiwa:clean-tmux
```

**対象と保持対象**:
- **クリーンアップ対象**: TMUX内で動作するClaudeプロセス（Haconiwa環境）
- **保持対象**: ローカルで個別に開いているClaude Code
- **自動削除**: tmuxセッション、環境変数ファイル、TMUX関連一時ファイル

**使用場面**:
- ローカルでClaude Codeを使いながらHaconiwa環境をリセットしたい時
- 開発中の作業を中断せずにHaconiwa環境だけクリーンアップしたい時
- TMUX内の認証問題やプロセス競合を解決したい時

**動作仕組み（TTYベース最確実識別）**:
1. TMUXペインが使用するTTY名を取得（例: /dev/ttys001, /dev/ttys006-025）
2. TTYベースでClaudeプロセスを特定（例: s001, s006-s025で動作するClaude）
3. ローカルTTY（例: s003, s005）で動作するClaudeプロセスは自動保持
4. 補完的にTMUX環境変数を持つプロセスも検索
5. 特定されたTMUX内Claudeプロセスのみを安全に終了
6. ローカルClaudeプロセスは100%保持したままHaconiwa環境を再起動

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

## 🎯 Tasks Directory連携システム（v2.0）

### 🚀 新システム概要
Director → Specialist連携を永続化されたタスクファイルで管理する革新的システム

### 🔄 連携フロー
1. **Director → タスク作成**: Tasks Directoryにマークダウン形式で指示書作成
2. **Specialist → 実行・記録**: タスクファイル読み取り → 実行 → 結果記録
3. **Director → 確認・追加指示**: 結果確認後、段階的に追加指示
4. **永続化・追跡**: 全作業履歴の完全な記録・可視化

### 📁 ディレクトリ構造
```
tasks/
├── directors/                    # Director発行タスク（進行中）
│   ├── backend/                 # Backend Directorタスク
│   ├── trading/                 # Trading Directorタスク
│   ├── integration/             # Integration Directorタスク
│   ├── frontend/                # Frontend Directorタスク
│   └── devops/                  # DevOps Directorタスク
├── completed/                   # 完了済みタスク（アーカイブ）
├── templates/                   # タスクテンプレート
└── README.md                    # システム説明
```

### 🛠️ 利用可能コマンド

#### Director用（指示・管理）
```bash
# タスク作成
./scripts/task-create.sh backend "AWS Amplify基盤構築" amplify-gen2-specialist

# 自動指示送信（v2.0）
./scripts/director-auto-delegate-v2.sh backend-director "MVP基盤システム構築"

# 追加指示・フィードバック
./scripts/task-update.sh tasks/directors/backend/task-001-amplify.md add-instruction "GraphQLスキーマ最適化を追加"
./scripts/task-update.sh tasks/directors/backend/task-001-amplify.md feedback "実装内容確認、パフォーマンステストも実行してください"

# タスク承認・完了
./scripts/task-update.sh tasks/directors/backend/task-001-amplify.md approve
```

#### Specialist用（実行・記録）
```bash
# タスク実行・結果記録
./scripts/task-execute.sh tasks/directors/backend/task-001-amplify.md start
./scripts/task-execute.sh tasks/directors/backend/task-001-amplify.md progress
./scripts/task-execute.sh tasks/directors/backend/task-001-amplify.md complete

# 対話モード（推奨）
./scripts/task-execute.sh tasks/directors/backend/task-001-amplify.md
```

#### 共通（監視・確認）
```bash
# 全タスク一覧
./scripts/task-list.sh --all

# 部門別確認
./scripts/task-list.sh --department backend

# 進行中タスクのみ
./scripts/task-list.sh --active

# 個別タスク詳細
./scripts/task-status.sh tasks/directors/backend/task-001-amplify.md

# 緊急事項確認
./scripts/task-list.sh --summary
```

### 🎯 Director指示フロー例

#### Backend Director → Amplify Gen2 Specialist
```bash
# 1. Director: 自動タスク作成・指示送信
./scripts/director-auto-delegate-v2.sh backend-director "AWS Amplify Gen2基盤構築"

# 2. システム: 自動実行される内容
# - tasks/directors/backend/task-XXX-amplify.md 作成
# - 詳細技術要件・完了条件を自動追記
# - amplify-gen2-specialist に通知送信

# 3. Specialist: タスク実行・結果記録
./scripts/task-execute.sh tasks/directors/backend/task-XXX-amplify.md

# 4. Director: 結果確認・追加指示
./scripts/task-update.sh tasks/directors/backend/task-XXX-amplify.md feedback "GraphQL最適化も追加してください"

# 5. Director: 最終承認
./scripts/task-update.sh tasks/directors/backend/task-XXX-amplify.md approve
```

### 📝 タスクファイル構造
各タスクファイルは以下の完全な構造を持ちます：

```markdown
# [タスク名]

## 📋 タスク情報
- **作成者**: backend-director
- **担当者**: amplify-gen2-specialist  
- **優先度**: high
- **状態**: in_progress
- **作成日時**: 2025-01-28 10:00

## 🎯 指示内容
[Director指示詳細・技術要件]

## 📊 実行結果
### 実行者: amplify-gen2-specialist
### 実行開始日時: 2025-01-28 10:30
### 実行完了日時: 2025-01-28 14:00

### 実装内容
[実装した機能・変更点の詳細]

### 成果物
- [x] ファイル作成: packages/shared-backend/amplify/data/resource.ts
- [x] テスト実行: GraphQL schema validation

### パフォーマンス・品質確認
- [x] Lint通過: ✅ 成功
- [x] 型チェック通過: ✅ 成功
- [x] テスト通過: ✅ 成功

## 🔄 進捗履歴
- 2025-01-28 10:00 **backend-director**: タスク作成・初期指示
- 2025-01-28 10:30 **amplify-gen2-specialist**: タスク実行開始
- 2025-01-28 14:00 **amplify-gen2-specialist**: 実行完了・結果記録
- 2025-01-28 14:30 **backend-director**: 確認・承認

## 💬 コミュニケーションログ
### Director → Specialist
2025-01-28 10:00 - backend-director: 初期指示
2025-01-28 14:30 - backend-director: 実装確認、品質も良好です

### Specialist → Director
2025-01-28 14:00 - amplify-gen2-specialist: 実装完了報告
```

### 🎯 メリット

1. **永続化**: 全指示・結果が永続的に記録され、履歴追跡が完全
2. **段階的指示**: Director結果確認後の段階的指示が可能
3. **可視化**: 全チーム作業状況の一元可視化・監視
4. **並列作業**: 複数Specialistの同時タスク実行・競合回避
5. **品質保証**: 実行結果・テスト結果の確実な記録・承認プロセス
6. **コミュニケーション**: Director ↔ Specialist間の完全なコミュニケーション記録

### 🚀 従来システムとの比較

| 項目 | 従来（tmux直接指示） | v2.0（Tasks Directory） |
|------|---------------------|------------------------|
| **指示記録** | 一時的・消失 | 永続的・完全記録 |
| **進捗確認** | 困難 | リアルタイム可視化 |
| **段階的指示** | 不可 | 結果確認後の段階的指示 |
| **品質管理** | 手動・不確実 | 自動チェック・承認プロセス |
| **履歴追跡** | 不可 | 完全な作業履歴 |
| **並列作業** | 競合発生 | 完全な競合回避 |

### 💡 ベストプラクティス

1. **Director**: 結果確認してから段階的に追加指示
2. **Specialist**: 実行後は必ずタスクファイルに詳細記録
3. **品質保証**: lint・typecheck・testを実行して結果記録
4. **コミュニケーション**: 疑問点はタスクファイルのコミュニケーションログに記録
5. **完了管理**: Director承認後はcompletedディレクトリに移動

## 品質基準
- ESLint: --max-warnings 0
- TypeScript: strict mode
- Zero warnings policy
- **shadcn/ui コンポーネントは編集禁止** - 標準版を信頼して使用