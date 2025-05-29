# @repo/eslint-config

ArbitrageAssistantプロジェクト用のESLint設定パッケージ。モノレポ内の全プロジェクトで共通のリントルールを提供します。

## 提供している設定

### `base.js`
- ベースとなるESLint設定
- TypeScriptサポート
- コード品質のルール

### `next.js`
- Next.jsプロジェクト専用設定
- `@next/eslint-plugin-next`との統合
- App Router対応

### `react-internal.js`
- Reactコンポーネントライブラリ用
- 内部パッケージでの使用を想定

## 使用方法

### Next.jsプロジェクトでの使用

`eslint.config.js`:
```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(["@repo/eslint-config/next"]),
];

export default eslintConfig;
```

### Reactライブラリパッケージでの使用

`eslint.config.mjs`:
```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(["@repo/eslint-config/react-internal"]),
];

export default eslintConfig;
```

## 主なルール

- **警告ゼロポリシー**: `--max-warnings 0`で実行
- **TypeScript strict**: 型安全性を重視
- **React Hooks**: フックのルールを強制
- **Next.js**: パフォーマンスとSEOのベストプラクティス

## コマンド例

```bash
# リント実行
npm run lint

# 自動修正
npm run lint:fix

# 警告をエラーとして扱う
npm run lint -- --max-warnings 0
```

## 開発者向け

新しいルールを追加する場合は、対応する設定ファイルを編集してください。全プロジェクトに影響するため、慎重に検討してください。
