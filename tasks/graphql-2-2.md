# GraphQL移行タスク2-2: Queries移行

## 概要
手動定義のqueries.tsをAmplify Gen2標準パターン（amplifyClient.models）に移行します。

## 前提条件
- graphql-1.md（調査タスク）が完了していること
- shared-amplifyクライアントが正常に動作していること

## 移行対象
- `apps/hedge-system/lib/graphql/queries.ts`
- `apps/admin/lib/graphql/queries.ts`
- これらのqueriesを使用している全ファイル

## 移行内容

### 現在の手動実装（削除対象）
```typescript
// 手動GraphQL文字列定義
export const listPositionsByUserId = `
  query ListPositionsByUserId($userId: ID!, $filter: ModelPositionFilterInput) {
    listPositions(filter: { 
      userId: { eq: $userId }
      and: [$filter]
    }) {
      items {
        id
        userId
        // ...全フィールド手動記述
      }
      nextToken
    }
  }
`;

// クライアントでの使用
const result = await client.graphql({
  query: listPositionsByUserId,
  variables: { userId, filter }
});
```

### 移行後のAmplify Gen2標準実装
```typescript
// shared-amplifyクライアント使用
import { amplifyClient } from '@repo/shared-amplify';

// 型安全な標準API
const result = await amplifyClient.models.Position.list({
  filter: {
    userId: { eq: userId },
    ...additionalFilters
  },
  limit: 100
});
```

## 実装手順

### 1. 現在のqueries使用箇所を特定
```bash
echo "=== Queries使用箇所特定 ==="

# queries.tsのimport検索
grep -r "queries" apps/ --include="*.ts" --include="*.tsx" -n

# 個別query使用検索
grep -r "listPositionsByUserId\|listTrailPositions\|listOpenPositions\|listActionsByUserId\|listAccountsByUserId" apps/ --include="*.ts" --include="*.tsx" -n
```

### 2. Position Queries移行

#### listPositionsByUserId
```typescript
// Before: 手動GraphQL
import { listPositionsByUserId } from '../lib/graphql/queries';

const getUserPositions = async (userId: string, filters?: any) => {
  const result = await client.graphql({
    query: listPositionsByUserId,
    variables: { userId, filter: filters }
  });
  return result.data.listPositions.items;
};

// After: Amplify Gen2標準
import { amplifyClient } from '@repo/shared-amplify';

const getUserPositions = async (userId: string, filters?: any) => {
  const result = await amplifyClient.models.Position.list({
    filter: {
      userId: { eq: userId },
      ...filters
    }
  });
  return result.data;
};
```

#### listTrailPositions（特殊フィルタ）
```typescript
// Before: 手動GraphQL
export const listTrailPositions = `
  query ListTrailPositions($userId: ID!) {
    listPositions(filter: { 
      userId: { eq: $userId }
      trailWidth: { gt: 0 }
      status: { eq: OPEN }
    }) {
      items { ... }
    }
  }
`;

// After: Amplify Gen2標準
const getTrailPositions = async (userId: string) => {
  const result = await amplifyClient.models.Position.list({
    filter: {
      userId: { eq: userId },
      trailWidth: { gt: 0 },
      status: { eq: 'OPEN' }
    }
  });
  return result.data;
};
```

#### listOpenPositions
```typescript
// Before: 手動GraphQL
export const listOpenPositions = `
  query ListOpenPositions($userId: ID!) {
    listPositions(filter: { 
      userId: { eq: $userId }
      status: { eq: OPEN }
    }) { ... }
  }
`;

// After: Amplify Gen2標準
const getOpenPositions = async (userId: string) => {
  const result = await amplifyClient.models.Position.list({
    filter: {
      userId: { eq: userId },
      status: { eq: 'OPEN' }
    }
  });
  return result.data;
};
```

### 3. Action Queries移行

#### listActionsByUserId
```typescript
// Before: 手動GraphQL
import { listActionsByUserId } from '../lib/graphql/queries';

const getUserActions = async (userId: string, filters?: any) => {
  const result = await client.graphql({
    query: listActionsByUserId,
    variables: { userId, filter: filters }
  });
  return result.data.listActions.items;
};

// After: Amplify Gen2標準
import { amplifyClient } from '@repo/shared-amplify';

const getUserActions = async (userId: string, filters?: any) => {
  const result = await amplifyClient.models.Action.list({
    filter: {
      userId: { eq: userId },
      ...filters
    }
  });
  return result.data;
};
```

#### listExecutingActions
```typescript
// Before: 手動GraphQL
export const listExecutingActions = `
  query ListExecutingActions($userId: ID!) {
    listActions(filter: { 
      userId: { eq: $userId }
      status: { eq: EXECUTING }
    }) { ... }
  }
`;

// After: Amplify Gen2標準
const getExecutingActions = async (userId: string) => {
  const result = await amplifyClient.models.Action.list({
    filter: {
      userId: { eq: userId },
      status: { eq: 'EXECUTING' }
    }
  });
  return result.data;
};
```

#### listPendingActions
```typescript
// Before: 手動GraphQL
export const listPendingActions = `
  query ListPendingActions($userId: ID!) {
    listActions(filter: { 
      userId: { eq: $userId }
      status: { eq: PENDING }
    }) { ... }
  }
`;

// After: Amplify Gen2標準
const getPendingActions = async (userId: string) => {
  const result = await amplifyClient.models.Action.list({
    filter: {
      userId: { eq: userId },
      status: { eq: 'PENDING' }
    }
  });
  return result.data;
};
```

### 4. Account Queries移行

#### listAccountsByUserId
```typescript
// Before: 手動GraphQL
import { listAccountsByUserId } from '../lib/graphql/queries';

const getUserAccounts = async (userId: string) => {
  const result = await client.graphql({
    query: listAccountsByUserId,
    variables: { userId }
  });
  return result.data.listAccounts.items;
};

// After: Amplify Gen2標準
import { amplifyClient } from '@repo/shared-amplify';

const getUserAccounts = async (userId: string) => {
  const result = await amplifyClient.models.Account.list({
    filter: {
      userId: { eq: userId },
      isActive: { eq: true }
    }
  });
  return result.data;
};
```

### 5. ページネーション対応
```typescript
// 手動GraphQLのnextToken対応
const getAllPositionsWithPagination = async (userId: string) => {
  let allPositions = [];
  let nextToken = null;
  
  do {
    const result = await amplifyClient.models.Position.list({
      filter: { userId: { eq: userId } },
      limit: 100,
      nextToken
    });
    
    allPositions.push(...result.data);
    nextToken = result.nextToken;
  } while (nextToken);
  
  return allPositions;
};
```

### 6. サービス層での統一実装
既存のshared-amplify/src/services/を活用：

```typescript
// Position Service
import { positionService } from '@repo/shared-amplify/services';

// 統一されたクエリAPI
const positions = await positionService.listUserPositions(filters);
const trailPositions = await positionService.listTrailPositions();
const openPositions = await positionService.listOpenPositions();

// Action Service
import { actionService } from '@repo/shared-amplify/services';

const actions = await actionService.listUserActions(filters);
const executingActions = await actionService.listExecutingActions();
const pendingActions = await actionService.listPendingActions();

// Account Service
import { accountService } from '@repo/shared-amplify/services';

const accounts = await accountService.listUserAccounts();
```

## 対象ファイルの具体的な修正

### apps/hedge-system/features/ での修正
1. **dashboard/hooks/useSystemStatus.ts**
   - position、action、accountクエリの移行

2. **dashboard/components/TrailMonitor.tsx**
   - `listTrailPositions` → `positionService.listTrailPositions`

3. **dashboard/components/ActionQueue.tsx**
   - `listPendingActions` → `actionService.listPendingActions`

### apps/admin/features/ での修正
1. **positions/hooks/usePositions.ts**
   - `listPositionsByUserId` → `positionService.listUserPositions`

2. **actions/hooks/useActions.ts**
   - `listActionsByUserId` → `actionService.listUserActions`

3. **accounts/hooks/useAccounts.ts**
   - `listAccountsByUserId` → `accountService.listUserAccounts`

## パフォーマンス最適化

### 1. 必要フィールドのみ選択
```typescript
// 最適化されたクエリ
const result = await amplifyClient.models.Position.list({
  filter: { userId: { eq: userId } },
  selectionSet: ['id', 'symbol', 'status', 'volume', 'entryPrice']
});
```

### 2. インデックス活用
```typescript
// userIdベースの効率的なクエリ（GSI活用）
const result = await amplifyClient.models.Position.listPositionByUserIdAndStatus({
  userId,
  status: 'OPEN'
});
```

### 3. キャッシュ戦略
```typescript
// React Query等との組み合わせ
const { data: positions } = useQuery({
  queryKey: ['positions', userId],
  queryFn: () => positionService.listUserPositions(),
  staleTime: 30000 // 30秒キャッシュ
});
```

## 検証方法

### 1. 型チェック
```bash
cd apps/hedge-system && npm run check-types
cd apps/admin && npm run check-types
```

### 2. クエリ動作テスト
```typescript
// テスト用スクリプト
import { amplifyClient } from '@repo/shared-amplify';

async function testQueries() {
  try {
    const userId = 'test-user';

    // Position一覧取得テスト
    const positions = await amplifyClient.models.Position.list({
      filter: { userId: { eq: userId } }
    });
    console.log('✅ Positions:', positions.data.length);

    // Action一覧取得テスト
    const actions = await amplifyClient.models.Action.list({
      filter: { userId: { eq: userId } }
    });
    console.log('✅ Actions:', actions.data.length);

    // Account一覧取得テスト
    const accounts = await amplifyClient.models.Account.list({
      filter: { userId: { eq: userId } }
    });
    console.log('✅ Accounts:', accounts.data.length);

  } catch (error) {
    console.error('❌ Query test failed:', error);
  }
}
```

### 3. パフォーマンステスト
```bash
# クエリ応答時間の測定
time node test-queries.js
```

## 完了条件
- [ ] apps/hedge-system内のqueries使用箇所を全て移行
- [ ] apps/admin内のqueries使用箇所を全て移行
- [ ] 手動GraphQL文字列を全て削除
- [ ] 型チェック・ビルドが成功
- [ ] 基本的なlist/filter動作確認完了
- [ ] ページネーション動作確認完了

## 注意事項
- **並列実行**: mutations、subscriptions移行と同時実行可能
- **パフォーマンス**: userIdベースのフィルタリングを維持
- **型安全性**: Amplify Gen2の型定義を最大限活用
- **ページネーション**: nextTokenの適切な処理

## 次のタスク
- graphql-2-1.md（mutations移行）と並列実行
- graphql-2-3.md（subscriptions移行）と並列実行
- 全て完了後、graphql-3.md（クリーンアップ）を実行