# CLAUDE.md

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

### Haconiwa自律実行
```bash
npm run start:haconiwa   # tmux環境構築（既存セッション保護）
npm run setup:claude     # 全ウィンドウClaude Code設定統一
npm run auto:haconiwa    # Claude Code起動 + 自律指示配信
```

**重要**: 既存Claude Codeセッション完全保護機能実装済み

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