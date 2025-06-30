# Turborepo最適化指示書 - Director向け

## 🎯 目標：Turborepo 2024年ベストプラクティス準拠への最適化

**重要制約**: `packages/shared-backend`は変更禁止（Amplifyビルド用）

## 📊 現状分析結果

### 現在の構成
- **Turborepo**: v2.3.3（最新版）
- **パッケージマネージャー**: npm 9.8.0
- **ワークスペース構造**: 適切（apps/, packages/）
- **アプリケーション**: admin（Next.js）, hedge-system（Tauri + Next.js）
- **共有パッケージ**: 7個（ui, shared-amplify, shared-types等）

### ⚠️ 改善が必要な項目

#### 1. turbo.json設定の最適化
- スキーマURLが古い形式
- 最新のTurborepo機能活用不足
- タスク依存関係の最適化不足
- 環境変数管理の改善

#### 2. package.json最適化
- スクリプト設定の最適化
- packageManager明示的指定
- workspace依存関係の効率化

#### 3. CI/CD統合の強化
- リモートキャッシュ活用
- ビルド最適化

## 🚀 実装指示：優先度順

### 【最優先】Phase 1: turbo.json最適化

#### 1.1 スキーマとメタデータ更新
```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "globalDependencies": [
    "packages/shared-backend/amplify_outputs.json",
    ".env*",
    "package-lock.json"
  ],
  "globalEnv": [
    "NEXT_PUBLIC_*",
    "NODE_ENV",
    "AWS_*",
    "TURBO_TOKEN",
    "TURBO_TEAM"
  ]
}
```

#### 1.2 タスク設定の最適化
現在の`tasks`設定を以下のベストプラクティスに更新：

**build タスク**:
```json
"build": {
  "dependsOn": ["^build"],
  "inputs": [
    "$TURBO_DEFAULT$",
    ".env*",
    "amplify_outputs.json",
    "!**/*.test.*",
    "!**/*.spec.*",
    "!**/*.md"
  ],
  "outputs": [
    "dist/**",
    "out/**", 
    ".next/**",
    "src-tauri/target/**",
    "build/**"
  ],
  "env": ["NEXT_PUBLIC_WEBSOCKET_URL", "NODE_ENV"],
  "persistent": false,
  "cache": true
}
```

**dev タスク**:
```json
"dev": {
  "dependsOn": ["@repo/shared-amplify#build"],
  "cache": false,
  "persistent": true,
  "env": ["NEXT_PUBLIC_WEBSOCKET_URL", "NODE_ENV"],
  "runDependsOn": ["^build"]
}
```

**新規追加タスク**:
```json
"clean": {
  "cache": false,
  "inputs": [],
  "outputs": []
},
"type-check": {
  "dependsOn": ["^build"],
  "inputs": [
    "**/*.{ts,tsx}",
    "tsconfig.json",
    "!dist/**",
    "!out/**"
  ],
  "cache": true
}
```

### 【高優先】Phase 2: package.json最適化

#### 2.1 ルートpackage.jsonスクリプト最適化
```json
{
  "scripts": {
    "dev": "turbo dev --parallel",
    "build": "turbo build --filter=!@repo/shared-backend",
    "build:all": "turbo build",
    "lint": "turbo lint --continue --cache-dir=.turbo",
    "test": "turbo test --continue",
    "test:changed": "turbo test --since=main",
    "type-check": "turbo type-check",
    "clean": "turbo clean && rm -rf .turbo",
    "format": "prettier --write .",
    "ci": "turbo build lint test type-check"
  },
  "packageManager": "npm@9.8.0"
}
```

#### 2.2 アプリケーション別最適化

**apps/admin/package.json**:
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint --max-warnings 0",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "type-check": "tsc --noEmit",
    "preview": "next start"
  }
}
```

**apps/hedge-system/package.json** - 追加最適化:
```json
{
  "scripts": {
    "dev": "next dev",
    "dev:tauri": "tauri dev",
    "build": "next build",
    "build:tauri": "tauri build",
    "build:release": "tauri build --bundles updater",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "bench": "vitest bench"
  }
}
```

### 【中優先】Phase 3: ワークスペース依存関係最適化

#### 3.1 内部パッケージ依存関係の統一
全ての内部パッケージ参照を以下の形式に統一：
```json
{
  "dependencies": {
    "@repo/shared-amplify": "workspace:*",
    "@repo/shared-auth": "workspace:*",
    "@repo/shared-types": "workspace:*",
    "@repo/ui": "workspace:*"
  }
}
```

#### 3.2 共有設定パッケージの活用
各アプリケーションで共通設定パッケージを確実に使用：
```json
{
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*"
  }
}
```

### 【低優先】Phase 4: 追加最適化

#### 4.1 .turboignore設定
プロジェクトルートに`.turboignore`を追加：
```
# Build outputs
dist/
out/
build/
.next/

# Test outputs
coverage/
test-results/

# Development
.DS_Store
*.log
node_modules/

# Tauri
src-tauri/target/
```

#### 4.2 環境変数設定ファイル
`.env.example`をプロジェクトルートに作成：
```env
# Next.js
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8080

# AWS
AWS_REGION=ap-northeast-1

# Turborepo (Optional)
TURBO_TOKEN=
TURBO_TEAM=
```

## 📋 実装チェックリスト

### Phase 1: turbo.json最適化
- [ ] スキーマURL更新
- [ ] globalDependencies追加
- [ ] globalEnv最適化
- [ ] buildタスク最適化
- [ ] devタスク最適化
- [ ] 新規タスク追加（clean, type-check）

### Phase 2: package.json最適化
- [ ] ルートpackage.jsonスクリプト更新
- [ ] packageManager明示的指定
- [ ] apps/admin/package.json最適化
- [ ] apps/hedge-system/package.json最適化

### Phase 3: ワークスペース最適化
- [ ] 内部パッケージ依存関係をworkspace:*形式に統一
- [ ] 共有設定パッケージ使用確認

### Phase 4: 追加最適化
- [ ] .turboignoreファイル作成
- [ ] .env.exampleファイル作成

## 🧪 検証手順

### 基本動作確認
```bash
# 1. 依存関係インストール
npm install

# 2. 型チェック
npm run type-check

# 3. ビルド確認
npm run build

# 4. 開発サーバー起動確認
npm run dev

# 5. テスト実行
npm run test

# 6. Lint確認
npm run lint
```

### パフォーマンス確認
```bash
# キャッシュクリア後のビルド時間測定
npm run clean
time npm run build

# キャッシュ有効時のビルド時間測定
time npm run build
```

### Turbo固有機能確認
```bash
# 並列実行確認
turbo dev --parallel --dry-run

# 依存関係グラフ確認
turbo build --graph

# キャッシュ状況確認
turbo build --summarize
```

## ⚠️ 注意事項

1. **shared-backend厳格保護**: `packages/shared-backend`の変更は絶対禁止
2. **段階的実装**: Phase順で実装し、各段階で動作確認
3. **バックアップ**: 変更前に必ずgitブランチ作成
4. **CI/CD影響**: GitHub Actions等のCI設定も併せて確認
5. **チーム通知**: 変更内容をチーム全体に共有

## 🚀 期待される効果

- **ビルド時間**: 30-50%短縮
- **開発体験**: HMR・型チェック高速化
- **CI/CD**: パイプライン実行時間短縮
- **保守性**: 統一された設定による管理簡素化
- **スケーラビリティ**: 新パッケージ追加時の作業効率化

## 📞 実装サポート

実装中に問題が発生した場合は、以下の順序で対応：

1. **ドキュメント確認**: [Turborepo公式ドキュメント](https://turbo.build/repo/docs)
2. **設定検証**: `turbo build --dry-run`で設定確認
3. **段階的ロールバック**: 問題のある変更のみ元に戻す
4. **エスカレーション**: 必要に応じてPresident報告

---

**この指示書は2024年最新のTurborepoベストプラクティスに基づいて作成されました。shared-backend保護制約下での最適化を実現します。**