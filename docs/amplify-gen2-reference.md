# Amplify Gen2 リファレンス

## Gen1 vs Gen2 主な違い

### データモデル定義
```typescript
// Gen2 (現在使用中) ✅
import { a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
    done: a.boolean()
  })
});

// Gen1 ❌
// GraphQL SDL形式でschema.graphqlファイルに記述
```

### バックエンド定義
```typescript
// Gen2 ✅
import { defineBackend } from '@aws-amplify/backend';
const backend = defineBackend({ auth, data });

// Gen1 ❌
// amplify/backend/フォルダ構造＋CloudFormationテンプレート
```

### 認可設定
```typescript
// Gen2 ✅
.authorization((allow) => [
  allow.owner(),
  allow.groups(['admin'])
])

// Gen1 ❌
// @auth ディレクティブをGraphQLスキーマに記述
```

## Gen2 主要API

### スキーマ定義
```typescript
const schema = a.schema({
  // 基本フィールド
  ModelName: a.model({
    stringField: a.string().required(),
    numberField: a.float(),
    boolField: a.boolean().default(false),
    enumField: a.ref('EnumName'),
    dateField: a.datetime()
  })
  
  // リレーション
  .hasMany('RelatedModel', 'foreignKey')
  .belongsTo('ParentModel', 'parentId')
  
  // インデックス
  .secondaryIndexes((index) => [
    index('field1').sortKeys(['field2'])
  ])
  
  // 認可
  .authorization((allow) => [
    allow.owner(),
    allow.groups(['admin']).to(['create', 'read', 'update', 'delete'])
  ])
});
```

### データリソース定義
```typescript
export const data = defineData({
  name: 'AppName-Data-Environment',
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool'
  }
});
```

## プロジェクト固有の実装パターン

### 現在の構成（正しいGen2実装）
- `/packages/shared-backend/amplify/backend.ts` - メインバックエンド定義
- `/packages/shared-backend/amplify/data/resource.ts` - データスキーマ
- `/packages/shared-backend/amplify/auth/resource.ts` - 認証設定

### 開発時の注意点
1. `packages/shared-backend`でスキーマ変更
2. 型生成は自動的に行われる
3. 認可はowner-based + groups-basedを併用
4. セカンダリインデックスで検索パフォーマンス最適化済み

## トラブルシューティング
- Claude Codeは常にGen2の最新パターンを参照
- DB設計時はa.schema()構文を使用
- 認可設定は.authorization()メソッドで設定
- リレーションはhasMany/belongsToで定義