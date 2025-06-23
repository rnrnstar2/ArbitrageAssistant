# CSS/ビルド最適化

## 🎯 目標
PostCSS設定を統一し、CSS関連のビルド性能を向上させる。

## 🔍 現状の問題点
- PostCSS設定の重複
- CSS Import統一不足
- ビルド最適化設定が不統一

## 🛠️ 実行タスク

### Task 1: PostCSS設定統一

**ファイル**: `packages/tailwind-config/postcss.config.js`

```javascript
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    ...(process.env.NODE_ENV === 'production' ? {
      'cssnano': { preset: 'default' },
    } : {}),
  },
};
```

### Task 2: アプリレベル設定統一

**ファイル**: `apps/admin/postcss.config.mjs`

```javascript
import sharedConfig from '@repo/tailwind-config/postcss.config.js';

export default sharedConfig;
```

**ファイル**: `apps/hedge-system/postcss.config.mjs`

```javascript
import sharedConfig from '@repo/tailwind-config/postcss.config.js';

export default sharedConfig;
```

## ✅ 完了確認

- [ ] PostCSS設定統一完了
- [ ] アプリレベル設定統一完了
- [ ] ビルド成功確認

## 📋 実行後のアクション

```bash
# 動作確認
npm run build

# 完了通知
osascript -e 'display notification "CSS最適化完了" with title "ArbitrageAssistant" sound name "Glass"'

# ファイル削除
rm tasks/css-build-optimization.md
```