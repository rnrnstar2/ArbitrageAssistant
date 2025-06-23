# パッケージ構成改善

## 🎯 目標
基本的なパッケージ構成を最適化し、exports/imports効率性を向上させる。

## 🔍 現状の問題点
- exports設定の非効率性
- 依存関係の最適化不足
- 命名規則の不統一

## 🛠️ 実行タスク

### Task 1: UIパッケージexports最適化

**ファイル**: `packages/ui/package.json`

```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./styles.css": "./dist/index.css"
  },
  "files": ["dist"]
}
```

### Task 2: shared-typesパッケージ最適化

**ファイル**: `packages/shared-types/package.json`

```json
{
  "name": "@repo/shared-types",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"]
}
```

### Task 3: 設定パッケージ統一

**ファイル**: `packages/eslint-config/package.json`

```json
{
  "name": "@repo/eslint-config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./base": "./base.js"
  },
  "files": ["*.js"]
}
```

## ✅ 完了確認

- [ ] UIパッケージexports最適化完了
- [ ] shared-typesパッケージ最適化完了
- [ ] 設定パッケージ統一完了
- [ ] ビルド成功確認

## 📋 実行後のアクション

```bash
# 動作確認
npm run build

# 完了通知
osascript -e 'display notification "パッケージ構成改善完了" with title "ArbitrageAssistant" sound name "Glass"'

# ファイル削除
rm tasks/package-architecture-refinement.md
```