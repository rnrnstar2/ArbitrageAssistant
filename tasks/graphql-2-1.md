# GraphQL移行タスク2-1: Mutations移行

## 概要
手動定義のmutations.tsをAmplify Gen2標準パターン（amplifyClient.models）に移行します。

## 前提条件
- graphql-1.md（調査タスク）が完了していること
- shared-amplifyクライアントが正常に動作していること

## 移行対象
- `apps/hedge-system/lib/graphql/mutations.ts`
- `apps/admin/lib/graphql/mutations.ts`
- これらのmutationsを使用している全ファイル

## 移行内容

### 現在の手動実装（削除対象）
```typescript
// 手動GraphQL文字列定義
export const createPosition = `
  mutation CreatePosition($input: CreatePositionInput!) {
    createPosition(input: $input) {
      id
      userId
      // ...全フィールド手動記述
    }
  }
`;

// クライアントでの使用
const result = await client.graphql({
  query: createPosition,
  variables: { input }
});
```

### 移行後のAmplify Gen2標準実装
```typescript
// shared-amplifyクライアント使用
import { amplifyClient } from '@repo/shared-amplify';

// 型安全な標準API
const result = await amplifyClient.models.Position.create(input);
const updated = await amplifyClient.models.Position.update(updateInput);
const deleted = await amplifyClient.models.Position.delete({ id });
```

## 実装手順

### 1. 現在のmutations使用箇所を特定
```bash
echo "=== Mutations使用箇所特定 ==="

# mutations.tsのimport検索
grep -r "mutations" apps/ --include="*.ts" --include="*.tsx" -n

# 個別mutation使用検索
grep -r "createPosition\|updatePosition\|createAction\|updateAction\|updateAccount" apps/ --include="*.ts" --include="*.tsx" -n
```

### 2. 各ファイルでの置き換え実装

#### Position Mutations
```typescript
// Before: 手動GraphQL
import { createPosition, updatePosition } from '../lib/graphql/mutations';

const createNewPosition = async (input: CreatePositionInput) => {
  const result = await client.graphql({
    query: createPosition,
    variables: { input }
  });
  return result.data.createPosition;
};

// After: Amplify Gen2標準
import { amplifyClient } from '@repo/shared-amplify';

const createNewPosition = async (input: CreatePositionInput) => {
  const result = await amplifyClient.models.Position.create(input);
  return result.data;
};
```

#### Action Mutations
```typescript
// Before: 手動GraphQL
import { createAction, updateAction } from '../lib/graphql/mutations';

const createNewAction = async (input: CreateActionInput) => {
  const result = await client.graphql({
    query: createAction,
    variables: { input }
  });
  return result.data.createAction;
};

// After: Amplify Gen2標準
import { amplifyClient } from '@repo/shared-amplify';

const createNewAction = async (input: CreateActionInput) => {
  const result = await amplifyClient.models.Action.create(input);
  return result.data;
};
```

#### Account Mutations
```typescript
// Before: 手動GraphQL
import { updateAccount } from '../lib/graphql/mutations';

const updateAccountData = async (input: UpdateAccountInput) => {
  const result = await client.graphql({
    query: updateAccount,
    variables: { input }
  });
  return result.data.updateAccount;
};

// After: Amplify Gen2標準
import { amplifyClient } from '@repo/shared-amplify';

const updateAccountData = async (input: UpdateAccountInput) => {
  const result = await amplifyClient.models.Account.update(input);
  return result.data;
};
```

### 3. 特殊なmutation（REPORT_ACCOUNT_STATUS）の移行
```typescript
// Before: 手動GraphQL
export const REPORT_ACCOUNT_STATUS = `
  mutation ReportAccountStatus(
    $accountId: String!,
    $status: String!,
    $pcId: String!
  ) {
    updateAccount(input: {
      id: $accountId,
      lastUpdated: "${new Date().toISOString()}"
    }) {
      id
      lastUpdated
    }
  }
`;

// After: Amplify Gen2標準
const reportAccountStatus = async (
  accountId: string, 
  status: string, 
  pcId: string
) => {
  const result = await amplifyClient.models.Account.update({
    id: accountId,
    lastUpdated: new Date().toISOString()
  });
  return result.data;
};
```

### 4. エラーハンドリングの統一
```typescript
// shared-amplifyの統一エラーハンドリングを使用
import { handleServiceError } from '@repo/shared-amplify/utils';

const safeCreatePosition = async (input: CreatePositionInput) => {
  try {
    const result = await amplifyClient.models.Position.create(input);
    return result.data;
  } catch (error) {
    throw handleServiceError(error, 'Create position');
  }
};
```

### 5. サービス層での統一実装
既存のshared-amplify/src/services/position.tsを活用：

```typescript
// 各アプリから直接呼び出し
import { positionService } from '@repo/shared-amplify/services';

// CRUD操作
const position = await positionService.createPosition(input);
const updated = await positionService.updatePosition(updateInput);
const deleted = await positionService.deletePosition(id);
```

## 対象ファイルの具体的な修正

### apps/hedge-system/features/ での修正
1. **position-manager.ts**
   - `createPosition` → `amplifyClient.models.Position.create`
   - `updatePosition` → `amplifyClient.models.Position.update`

2. **action-manager.ts**
   - `createAction` → `amplifyClient.models.Action.create`
   - `updateAction` → `amplifyClient.models.Action.update`

3. **account-manager.ts**
   - `updateAccount` → `amplifyClient.models.Account.update`

### apps/admin/features/ での修正
1. **positions/hooks/usePositionActions.ts**
   - mutations使用箇所をAmplify Gen2標準に変更

2. **accounts/components/AccountManager.tsx**
   - account更新処理の移行

## 検証方法

### 1. 型チェック
```bash
cd apps/hedge-system && npm run check-types
cd apps/admin && npm run check-types
```

### 2. ビルドテスト
```bash
npm run build
```

### 3. 動作テスト
```typescript
// テスト用スクリプト
import { amplifyClient } from '@repo/shared-amplify';

async function testMutations() {
  try {
    // Position作成テスト
    const position = await amplifyClient.models.Position.create({
      userId: 'test-user',
      accountId: 'test-account',
      symbol: 'USDJPY',
      volume: 0.1,
      status: 'PENDING',
      executionType: 'ENTRY'
    });
    console.log('✅ Position created:', position.data.id);

    // Position更新テスト
    const updated = await amplifyClient.models.Position.update({
      id: position.data.id,
      status: 'OPEN'
    });
    console.log('✅ Position updated:', updated.data.status);

  } catch (error) {
    console.error('❌ Mutation test failed:', error);
  }
}
```

## 完了条件
- [ ] apps/hedge-system内のmutations使用箇所を全て移行
- [ ] apps/admin内のmutations使用箇所を全て移行
- [ ] 手動GraphQL文字列を全て削除
- [ ] 型チェック・ビルドが成功
- [ ] 基本的なCRUD動作確認完了

## 注意事項
- **並列実行**: queries、subscriptions移行と同時実行可能
- **後方互換性**: 既存の動作を壊さないよう注意
- **型安全性**: Amplify Gen2の型定義を最大限活用
- **エラーハンドリング**: shared-amplifyの統一エラー処理を使用

## 次のタスク
- graphql-2-2.md（queries移行）と並列実行
- graphql-2-3.md（subscriptions移行）と並列実行
- 全て完了後、graphql-3.md（クリーンアップ）を実行