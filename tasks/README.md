# shared-amplify統一完了タスク実行手順

## 🎯 目標
shared-amplifyパッケージの統一を完了し、admin・hedge-systemアプリからの一元化されたAmplify利用を実現する。

## 📋 タスク概要

### 🚨 緊急タスク
- **task-1.md**: amplify_outputs.json統一完了 (必須先行)

### ⚡ 並列タスク
- **task-2-1.md**: admin app型エラー解決 (75個)
- **task-2-2.md**: hedge-system app型エラー解決 (29個)

### 🔧 後続タスク  
- **task-3.md**: hooks実装復元 (17個)
- **task-4.md**: その他問題解決・最適化
- **task-5.md**: 最終検証と完了確認

## 🚀 実行手順

### Step 1: 緊急対応 (必須先行)
```bash
# Claude Codeで実行
"MVPシステム設計.mdをしっかり理解してから実装を開始すること。tasks/README.mdも確認しておくこと。tasks/task-1.md を実行して。ultrathink"
```

### Step 2: 並列型エラー解決 (同時実行推奨)
```bash
# 以下を同時実行（Claude Code複数タブ推奨）
"MVPシステム設計.mdをしっかり理解してから実装を開始すること。tasks/README.mdも確認しておくこと。tasks/task-2-1.md を実行して。ultrathink"
"MVPシステム設計.mdをしっかり理解してから実装を開始すること。tasks/README.mdも確認しておくこと。tasks/task-2-2.md を実行して。ultrathink"
```

### Step 3: hooks実装 (Step 2完了後)
```bash
# Claude Codeで実行
"MVPシステム設計.mdをしっかり理解してから実装を開始すること。tasks/README.mdも確認しておくこと。tasks/task-3.md を実行して。ultrathink"
```

### Step 4: 最適化 (Step 3完了後)
```bash
# Claude Codeで実行  
"MVPシステム設計.mdをしっかり理解してから実装を開始すること。tasks/README.mdも確認しておくこと。tasks/task-4.md を実行して。ultrathink"
```

### Step 5: 最終検証 (Step 4完了後)
```bash
# Claude Codeで実行
"MVPシステム設計.mdをしっかり理解してから実装を開始すること。tasks/README.mdも確認しておくこと。tasks/task-5.md を実行して。ultrathink"
```

### Step 6: クリーンアップ (全完了後)
```bash
# 全タスク完了確認後
rm -rf tasks/
```

## 📊 現状問題点 (調査結果)

### 🔴 緊急対応必要
- amplify_outputs.json参照エラー (apps配下の重複ファイル)
- admin app: 75個の型エラー
- hedge-system app: 29個の型エラー

### 🟡 中優先対応
- hooks実装: 17個のhookがコメントアウト状態
- モジュール不存在エラー: 削除されたファイルの復元必要

### 🟢 低優先対応
- 循環依存の最適化
- パフォーマンス改善
- エラーハンドリング統一

## ⚠️ 重要な注意事項

### 依存関係
1. **task-1は他の全タスクの前提条件**
2. task-2-1とtask-2-2は並列実行可能
3. task-3はtask-2完了後に実行
4. task-4はtask-3完了後に実行
5. task-5はtask-4完了後に実行

### 実行時の注意
- 各タスク完了時は必ずファイル削除
- 並列実行時は異なるタブ・セッションを使用
- エラー発生時は該当タスクファイルで詳細手順確認

### 品質チェック
各タスク完了時に以下を確認：
```bash
npm run lint --max-warnings 0
cd apps/admin && npm run check-types
cd apps/hedge-system && npm run check-types
```

## 🎯 最終目標状態

### ✅ 達成すべき状態
- 型エラー0個 (全パッケージ・アプリ)
- ビルドエラー0個
- amplify_outputs.json一元化完了
- shared-amplifyからのみのAmplify利用
- 17個のhookが利用可能
- MVP設計書準拠の実装

### 📈 期待される効果
- **開発効率向上**: 重複コード削除、統一API
- **保守性向上**: 設定一元化、型安全性
- **拡張性向上**: 共通サービス、hook再利用
- **信頼性向上**: エラーハンドリング統一

## 🚨 トラブルシューティング

### 型エラーが残る場合
1. shared-amplifyの型定義を確認
2. import文がshared-amplify経由か確認  
3. 循環依存がないか確認

### ビルドエラーの場合
1. node_modules削除・再インストール
2. TypeScriptキャッシュクリア
3. Turborepoキャッシュクリア

### 実行時エラーの場合
1. amplify_outputs.json設定確認
2. 認証状態確認
3. GraphQLスキーマ整合性確認

---

**⚡ 実行準備完了 - task-1.md から開始してください！**

---

# 📱 GraphQL移行タスク（Amplify Gen2標準化）

## 🎯 目標
手動GraphQL定義（mutations/queries/subscriptions）をAmplify Gen2標準パターンに移行し、型安全性と保守性を向上させる。

## 📋 GraphQL移行タスク概要

### 🔍 Phase 1: 調査
- **graphql-1.md**: 手動GraphQL使用箇所調査・移行計画策定

### ⚡ Phase 2: 並列移行 (同時実行推奨)
- **graphql-2-1.md**: Mutations移行（Position/Action/Account CRUD）
- **graphql-2-2.md**: Queries移行（list/filter操作）
- **graphql-2-3.md**: Subscriptions移行（リアルタイム更新）

### 🧹 Phase 3: クリーンアップ
- **graphql-3.md**: 手動GraphQLファイル削除・最終確認

## 🚀 GraphQL移行実行手順

### Step 1: 調査・計画 (必須先行)
MVPシステム設計.mdをしっかり理解してから実装を開始すること。tasks/graphql-2-1.md を実行して。ultrathink

MVPシステム設計.mdをしっかり理解してから実装を開始すること。tasks/graphql-2-2.md を実行して。ultrathink

MVPシステム設計.mdをしっかり理解してから実装を開始すること。tasks/graphql-2-3.md を実行して。ultrathink

MVPシステム設計.mdをしっかり理解してから実装を開始すること。tasks/graphql-3.md を実行して。ultrathink

## 📊 移行前後の比較

### Before: 手動GraphQL定義
```typescript
// ❌ 手動GraphQL文字列
export const createPosition = `
  mutation CreatePosition($input: CreatePositionInput!) {
    createPosition(input: $input) { ... }
  }
`;

const result = await client.graphql({
  query: createPosition,
  variables: { input }
});
```

### After: Amplify Gen2標準
```typescript
// ✅ 型安全なAmplify Gen2 API
import { amplifyClient } from '@repo/shared-amplify';

const result = await amplifyClient.models.Position.create(input);
```

## 🎯 期待される改善効果

### 1. 品質向上
- **型安全性**: 100% - 手動文字列から自動生成型へ
- **保守性**: スキーマ変更の自動同期
- **可読性**: 標準的なAmplify Gen2パターン

### 2. 開発効率向上
- **重複コード削除**: 6個の重複GraphQLファイル削除
- **Import簡素化**: shared-amplify統一
- **エラー削減**: GraphQL構文エラーリスク排除

### 3. パフォーマンス向上
- **バンドルサイズ削減**: 手動GraphQL文字列削除
- **型チェック高速化**: 不要な手動定義排除

## ⚠️ GraphQL移行時の注意事項

### 依存関係
1. **graphql-1は必須先行条件**
2. graphql-2-X系は並列実行可能
3. graphql-3はgraphql-2-X完了後に実行

### 実行時の注意
- 各タスク完了時は必ずファイル削除
- 並列実行時は異なるタブ・セッションを使用
- エラー発生時は該当タスクファイルで詳細手順確認

### 品質チェック
各タスク完了時に以下を確認：
```bash
npm run lint --max-warnings 0
cd apps/admin && npm run check-types
cd apps/hedge-system && npm run check-types
```

## 🎯 最終目標状態

### ✅ 達成すべき状態
- 手動GraphQLファイル0個（完全削除）
- 型エラー0個（全パッケージ・アプリ）
- ビルドエラー0個
- Amplify Gen2標準パターン100%適用
- shared-amplifyからのみのGraphQL利用

### 📈 GraphQL標準化達成率: 100%
手動GraphQL定義の完全削除により、Amplify Gen2の標準パターンを100%実現します。

---

**🔄 タスク選択ガイド:**
- **shared-amplify統一**: task-1.md から開始
- **GraphQL移行**: graphql-1.md から開始