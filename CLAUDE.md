# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 最重要指示

### Tauri アプリのリリース
ユーザーが「リリースして」「Tauriをリリースして」などと言った場合、**必ず** 以下の手順を実行すること：

1. **先に変更をコミット・プッシュする**
   ```bash
   git add .
   git commit -m "変更内容"
   git push
   ```

2. **その後、リリーススクリプトを実行**
   ```bash
   npm run release:hedge-system
   ```

手動でタグを作成したりプッシュしたりしないこと！スクリプトが全て自動化している。

## Development Commands

### Common Operations
```bash
# Start all apps in development mode
npm run dev

# Build all apps and packages
npm run build

# Lint all code
npm run lint

# Format code
npm run format
```

### App-Specific Commands
```bash
# Admin web app (apps/admin)
cd apps/admin
npm run dev          # Next.js dev server with Turbopack
npm run build        # Production build
npm run check-types  # TypeScript validation
npm run lint         # ESLint validation
npm run test         # Run vitest tests

# Hedge system desktop app (apps/hedge-system)
cd apps/hedge-system
npm run dev          # Next.js dev server
npm run tauri:dev    # Tauri desktop app development
npm run tauri:build  # Build desktop app
npm run tauri:release # Build with updater artifacts
npm run check-types  # TypeScript validation
npm run lint         # ESLint validation
npm run test         # Run vitest tests
```

### Release Commands
```bash
# 🚨 重要: Tauri アプリのリリース時は必ずこのコマンドを使用すること！
# 「リリースして」と言われたら、このコマンド一発で全て実行
npm run release:hedge-system

# このスクリプトが自動的に以下を実行:
# 1. バージョン番号の更新 (patch/minor/major を選択)
# 2. package.json と tauri.conf.json の同期
# 3. 変更のコミット
# 4. リリースタグの作成とプッシュ
# 5. GitHub Actions による自動ビルド・S3アップロードの開始

# 手動実行（非推奨 - スクリプトを使うこと！）
cd apps/hedge-system
npm version patch  # or minor, major
git tag hedge-system-v0.1.1
git push origin hedge-system-v0.1.1
```

### S3 Distribution Setup
```bash
# S3バケットのパブリックアクセス設定（初回のみ実行）
./scripts/setup-s3-bucket-policy.sh

# S3配布URL:
# - バケット: amplify-arbitrageassistantreleases
# - アップデーターエンドポイント: https://amplify-arbitrageassistantreleases.s3.ap-northeast-1.amazonaws.com/releases/hedge-system/latest.json
# - バージョン別配布: https://amplify-arbitrageassistantreleases.s3.ap-northeast-1.amazonaws.com/releases/hedge-system/v{version}/
```

### AWS環境変数設定
GitHub Actions でのS3アップロードに必要な環境変数：
- `AWS_ACCESS_KEY_ID`: AWS IAMユーザーのアクセスキーID
- `AWS_SECRET_ACCESS_KEY`: AWS IAMユーザーのシークレットアクセスキー

詳細な設定方法は `docs/AWS_SECRETS_SETUP.md` を参照してください。

### Local Testing
```bash
# Test GitHub Actions locally (requires act)
./scripts/test-ci-local.sh

# Manual build and test sequence
npm ci
cd packages/ui && npm run build && cd ../..
npm run lint
cd apps/hedge-system && npm run check-types
npm run build

# Run tests
npm run test        # Run all tests
npm run test:watch  # Watch mode
npm run test:coverage # Coverage report
```

## Architecture Overview

### Monorepo Structure
- **Turborepo-based** with npm workspaces
- **Two main apps**: `admin` (web), `hedge-system` (Tauri desktop)
- **Shared packages**: UI components, configs, and AWS Amplify backend

### AWS Amplify Backend (`packages/shared-backend`)
- **Framework**: AWS Amplify Gen2 with GraphQL
- **Authentication**: Email-based authentication system
- **Data layer**: GraphQL schema defined in `amplify/data/resource.ts`
- **Authorization**: Public API key mode with auth rules
- **Entry point**: `amplify/backend.ts`
- **Build output**: TypeScript definitions in `dist/` directory

### Tauri Desktop App (`apps/hedge-system`)
- **Hybrid architecture**: Next.js frontend + Rust backend
- **Development**: Next.js dev server at localhost:3000
- **Production**: Static export to `out/` directory for Tauri bundling
- **Window config**: 800x600 resizable, system theme integration
- **Build output**: Platform-specific desktop executables

### Shared Components (`packages/ui`)
- **UI Library**: Radix UI + shadcn/ui patterns with Tailwind CSS
- **Build system**: TypeScript compilation + Tailwind CSS build
- **Export structure**: Named exports for components, hooks, and utilities
- **Testing**: Vitest with React Testing Library
- **Dependencies**: React 19, Radix UI components, Lucide React icons

### Configuration Packages
- **ESLint config** (`packages/eslint-config`): Shared linting rules
- **TypeScript config** (`packages/typescript-config`): Base, Next.js, and library configs
- **Tailwind config** (`packages/tailwind-config`): Shared styles and PostCSS setup
- **Package dependencies**: React 19, Next.js 15.3.2, TypeScript 5.x

## Code Quality Standards
- **Zero warnings policy**: ESLint runs with `--max-warnings 0`
- **Type safety**: TypeScript strict mode across all packages
- **Formatting**: Prettier for consistent code style
- **Build validation**: Type checking required before builds

## Key Development Notes
- **Package manager**: npm@9.8.0 (specified in package.json)
- **Node version**: >=20 required
- **Turbo caching**: Enabled for builds, disabled for dev mode
- **Theme support**: Dark mode implementation in hedge-system app using next-themes
- **Auto-updater**: Tauri updater plugin with S3 distribution
- **Testing framework**: Vitest with jsdom environment
- **Build tools**: Tailwind CSS v4, ESLint v9, TypeScript 5.8

## Claude Code Action Integration
- **Trigger**: Use `@claude` in issues, PRs, or comments to activate Claude Code assistant
- **Workflow**: `.github/workflows/claude-code.yml` handles automated code assistance
- **Validation**: Automatic linting, type checking, and build validation after changes
- **Permissions**: Full repository access for code modifications and PR/issue management

## Pull Request Documentation Language
- **Language**: All PR titles, descriptions, and commit messages should be written in Japanese
- **Format**: Use clear and concise Japanese technical writing
- **PR Title**: 日本語で簡潔に変更内容を記述
- **PR Description**: 以下の形式で日本語で記載:
  - ## 概要
  - ## 変更内容
  - ## テスト計画
  - ## その他の注意事項（必要に応じて）

## Pull Request Auto Documentation
PR作成時には、以下の内容を含む詳細なドキュメントをPR本文に自動的に含めること：

### 必須項目
1. **変更ファイル一覧**: 変更されたファイルのリストと変更行数
2. **主要な変更点**: コードの重要な変更内容を箇条書きで記載
3. **技術的詳細**: 
   - 使用した技術やライブラリ
   - アーキテクチャの変更点
   - パフォーマンスへの影響
4. **破壊的変更**: 既存の機能に影響を与える変更がある場合は明記
5. **依存関係**: 新規追加または更新された依存関係

### PR本文フォーマット例
```markdown
## 概要
[変更の概要を1-2文で記載]

## 変更内容
### 変更ファイル
- `path/to/file1.ts` (+50, -10)
- `path/to/file2.tsx` (+120, -30)
- `path/to/file3.css` (+20, -5)

### 主要な変更点
- ✨ 新機能: [機能の説明]
- 🐛 バグ修正: [修正内容]
- ♻️ リファクタリング: [リファクタリング内容]
- 📝 ドキュメント: [ドキュメント更新内容]

### 技術的詳細
- **新規ライブラリ**: 
  - `library-name@version` - [使用目的]
- **アーキテクチャ変更**: 
  - [変更内容の詳細]
- **パフォーマンス**: 
  - [影響の詳細]

### 破壊的変更
- ⚠️ [破壊的変更の内容]（ある場合のみ）

## テスト計画
- [ ] ユニットテストの追加/更新
- [ ] 統合テストの実行
- [ ] 手動テストのシナリオ

## スクリーンショット
[UI変更がある場合は必ずスクリーンショットを添付]

## その他の注意事項
[レビュアーへの特記事項など]
```

### 重要な指示
- PR作成時は必ず上記フォーマットに従って詳細なドキュメントを含めること
- 変更内容は具体的かつ技術的に記載すること
- UIに関する変更がある場合は必ずスクリーンショットを含めること
- 単なる「更新しました」のような曖昧な表現は避けること

## Testing Guidelines
コスパの高いテストのみを作成する方針です。

### テストを書くべきケース
- **ビジネスロジック**: 複雑な計算や条件分岐を含むコンポーネント
- **金額計算**: アービトラージ計算、利益計算など金銭に関わる処理
- **重要なデータ処理**: データの変換、フィルタリング、集計処理
- **共通コンポーネント**: 複数箇所で使用される再利用性の高いコンポーネント
- **バグ頻発箇所**: 過去にバグが発生した、または発生しやすい箇所

### テストを書かないケース
- **単純な表示コンポーネント**: プロップスをそのまま表示するだけのコンポーネント
- **外部ライブラリのラッパー**: AWS Amplify認証など、外部サービスの薄いラッパー
- **UIの見た目**: スタイルやレイアウトのみのテスト
- **モック過多**: テストのためにモックだらけになってしまうケース
- **フォームUI**: バリデーションロジックがない単純な入力フォーム