# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 最重要指示

### Tauri アプリのリリース
ユーザーが「リリースして」「Tauriをリリースして」などと言った場合、**必ず** 以下のコマンドを実行すること：
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
npm run dev          # Next.js dev server
npm run build        # Production build
npm run check-types  # TypeScript validation

# Hedge system desktop app (apps/hedge-system)
cd apps/hedge-system
npm run dev          # Next.js dev server
npm run tauri:dev    # Tauri desktop app development
npm run tauri:build  # Build desktop app
npm run tauri:release # Build with updater artifacts
npm run check-types  # TypeScript validation
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
# 5. GitHub Actions による自動ビルドの開始

# 手動実行（非推奨 - スクリプトを使うこと！）
cd apps/hedge-system
npm version patch  # or minor, major
git tag hedge-system-v0.1.1
git push origin hedge-system-v0.1.1
```

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
```

## Architecture Overview

### Monorepo Structure
- **Turborepo-based** with npm workspaces
- **Two main apps**: `admin` (web), `hedge-system` (Tauri desktop)
- **Shared packages**: UI components, configs, and AWS Amplify backend

### AWS Amplify Backend (`packages/shared-backend`)
- **Framework**: AWS Amplify Gen2 with GraphQL
- **Authentication**: Email-based auth (`ArbitrageAssistantAuth`)
- **Data layer**: Currently has Todo model structure (commented out)
- **Authorization**: Public API key mode, 365-day expiration
- **Entry point**: `amplify/backend.ts`

### Tauri Desktop App (`apps/hedge-system`)
- **Hybrid architecture**: Next.js frontend + Rust backend
- **Development**: Next.js dev server at localhost:3000
- **Production**: Static export to `out/` directory for Tauri bundling
- **Window config**: 800x600 resizable, system theme integration
- **Build output**: Platform-specific desktop executables

### Shared Components
- **UI Library**: Radix UI + shadcn/ui patterns with Tailwind CSS
- **Configuration**: Centralized ESLint, TypeScript, and Tailwind configs
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
- **Theme support**: Dark mode implementation in hedge-system app

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