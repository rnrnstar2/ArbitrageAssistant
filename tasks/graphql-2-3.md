# GraphQL移行タスク2-3: Subscriptions移行

## 概要
手動定義のsubscriptions.tsをAmplify Gen2標準パターン（amplifyClient.models.observeQuery）に移行します。

## 前提条件
- graphql-1.md（調査タスク）が完了していること
- shared-amplifyクライアントが正常に動作していること

## 移行対象
- `apps/hedge-system/lib/graphql/subscriptions.ts`
- `apps/admin/lib/graphql/subscriptions.ts`
- これらのsubscriptionsを使用している全ファイル

## 移行内容

### 現在の手動実装（削除対象）
```typescript
// 手動GraphQL文字列定義
export const onActionStatusChanged = `
  subscription OnActionStatusChanged($userId: ID!) {
    onUpdateAction(filter: { userId: { eq: $userId } }) {
      id
      userId
      status
      // ...全フィールド手動記述
    }
  }
`;

// クライアントでの使用
const subscription = client.graphql({
  query: onActionStatusChanged,
  variables: { userId }
}).subscribe({
  next: (result) => {
    console.log('Action updated:', result.data.onUpdateAction);
  }
});
```

### 移行後のAmplify Gen2標準実装
```typescript
// shared-amplifyクライアント使用
import { amplifyClient } from '@repo/shared-amplify';

// 型安全な標準API
const subscription = amplifyClient.models.Action.observeQuery({
  filter: { userId: { eq: userId } }
}).subscribe({
  next: ({ items, isSynced }) => {
    console.log('Actions updated:', items);
  }
});
```

## 実装手順

### 1. 現在のsubscriptions使用箇所を特定
```bash
echo "=== Subscriptions使用箇所特定 ==="

# subscriptions.tsのimport検索
grep -r "subscriptions" apps/ --include="*.ts" --include="*.tsx" -n

# 個別subscription使用検索
grep -r "onActionStatusChanged\|onPositionStatusChanged\|onActionCreated\|onAccountUpdated" apps/ --include="*.ts" --include="*.tsx" -n

# GraphQL subscription使用検索
grep -r "\.subscribe\|\.unsubscribe" apps/ --include="*.ts" --include="*.tsx" -n
```

### 2. Action Subscriptions移行

#### onActionStatusChanged
```typescript
// Before: 手動GraphQL
import { onActionStatusChanged } from '../lib/graphql/subscriptions';

const subscribeToActionChanges = (userId: string) => {
  const subscription = client.graphql({
    query: onActionStatusChanged,
    variables: { userId }
  }).subscribe({
    next: (result) => {
      const action = result.data.onUpdateAction;
      console.log('Action status changed:', action);
      // 状態更新処理
    },
    error: (error) => console.error('Subscription error:', error)
  });
  
  return subscription;
};

// After: Amplify Gen2標準
import { amplifyClient } from '@repo/shared-amplify';

const subscribeToActionChanges = (userId: string) => {
  const subscription = amplifyClient.models.Action.observeQuery({
    filter: { userId: { eq: userId } }
  }).subscribe({
    next: ({ items, isSynced }) => {
      if (isSynced) {
        console.log('Actions updated:', items);
        // 状態更新処理
      }
    },
    error: (error) => console.error('Subscription error:', error)
  });
  
  return subscription;
};
```

#### onActionCreated
```typescript
// Before: 手動GraphQL
export const onActionCreated = `
  subscription OnActionCreated($userId: ID!) {
    onCreateAction(filter: { userId: { eq: $userId } }) {
      id
      userId
      type
      status
      createdAt
    }
  }
`;

// After: Amplify Gen2標準（onCreate専用のsubscription）
const subscribeToNewActions = (userId: string) => {
  const subscription = amplifyClient.models.Action.onCreate({
    filter: { userId: { eq: userId } }
  }).subscribe({
    next: (action) => {
      console.log('New action created:', action);
      // 新規アクション処理
    }
  });
  
  return subscription;
};
```

### 3. Position Subscriptions移行

#### onPositionStatusChanged
```typescript
// Before: 手動GraphQL
import { onPositionStatusChanged } from '../lib/graphql/subscriptions';

const subscribeToPositionChanges = (userId: string) => {
  const subscription = client.graphql({
    query: onPositionStatusChanged,
    variables: { userId }
  }).subscribe({
    next: (result) => {
      const position = result.data.onUpdatePosition;
      // Trail監視、状態更新処理
    }
  });
  
  return subscription;
};

// After: Amplify Gen2標準
import { amplifyClient } from '@repo/shared-amplify';

const subscribeToPositionChanges = (userId: string) => {
  const subscription = amplifyClient.models.Position.observeQuery({
    filter: { userId: { eq: userId } }
  }).subscribe({
    next: ({ items, isSynced }) => {
      if (isSynced) {
        // Trail監視、状態更新処理
        items.forEach(position => {
          if (position.trailWidth && position.status === 'OPEN') {
            // トレール処理
          }
        });
      }
    }
  });
  
  return subscription;
};
```

### 4. Account Subscriptions移行

#### onAccountUpdated
```typescript
// Before: 手動GraphQL
export const onAccountUpdated = `
  subscription OnAccountUpdated($userId: ID!) {
    onUpdateAccount(filter: { userId: { eq: $userId } }) {
      id
      userId
      balance
      credit
      equity
      lastUpdated
    }
  }
`;

// After: Amplify Gen2標準
const subscribeToAccountUpdates = (userId: string) => {
  const subscription = amplifyClient.models.Account.observeQuery({
    filter: { userId: { eq: userId } }
  }).subscribe({
    next: ({ items, isSynced }) => {
      if (isSynced) {
        items.forEach(account => {
          // 残高・信用情報の更新処理
          console.log('Account updated:', {
            id: account.id,
            balance: account.balance,
            equity: account.equity
          });
        });
      }
    }
  });
  
  return subscription;
};
```

### 5. React Hooksでのsubscription統合

#### useRealtimeActions Hook
```typescript
// shared-amplify/src/hooks/useRealtimeActions.ts
import { useState, useEffect } from 'react';
import { amplifyClient } from '../client';
import type { Action } from '../types';

export function useRealtimeActions(userId: string) {
  const [actions, setActions] = useState<Action[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const subscription = amplifyClient.models.Action.observeQuery({
      filter: { userId: { eq: userId } }
    }).subscribe({
      next: ({ items, isSynced }) => {
        setActions(items);
        setIsConnected(isSynced);
      },
      error: (error) => {
        console.error('Action subscription error:', error);
        setIsConnected(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  return { actions, isConnected };
}
```

#### useRealtimePositions Hook
```typescript
// shared-amplify/src/hooks/useRealtimePositions.ts
import { useState, useEffect } from 'react';
import { amplifyClient } from '../client';
import type { Position } from '../types';

export function useRealtimePositions(userId: string) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const subscription = amplifyClient.models.Position.observeQuery({
      filter: { userId: { eq: userId } }
    }).subscribe({
      next: ({ items, isSynced }) => {
        setPositions(items);
        setIsConnected(isSynced);
      },
      error: (error) => {
        console.error('Position subscription error:', error);
        setIsConnected(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  return { positions, isConnected };
}
```

### 6. システム間連携subscription

#### useSystemCoordination Hook
```typescript
// shared-amplify/src/hooks/useSystemCoordination.ts
import { useState, useEffect } from 'react';
import { amplifyClient } from '../client';

export function useSystemCoordination(userId: string) {
  const [systemState, setSystemState] = useState({
    actions: [],
    positions: [],
    accounts: []
  });

  useEffect(() => {
    // 複数のsubscriptionを統合管理
    const actionSub = amplifyClient.models.Action.observeQuery({
      filter: { userId: { eq: userId } }
    }).subscribe({
      next: ({ items }) => {
        setSystemState(prev => ({ ...prev, actions: items }));
      }
    });

    const positionSub = amplifyClient.models.Position.observeQuery({
      filter: { userId: { eq: userId } }
    }).subscribe({
      next: ({ items }) => {
        setSystemState(prev => ({ ...prev, positions: items }));
      }
    });

    const accountSub = amplifyClient.models.Account.observeQuery({
      filter: { userId: { eq: userId } }
    }).subscribe({
      next: ({ items }) => {
        setSystemState(prev => ({ ...prev, accounts: items }));
      }
    });

    return () => {
      actionSub.unsubscribe();
      positionSub.unsubscribe();
      accountSub.unsubscribe();
    };
  }, [userId]);

  return systemState;
}
```

## 対象ファイルの具体的な修正

### apps/hedge-system/features/ での修正
1. **dashboard/components/ActionQueue.tsx**
   - `onActionStatusChanged` → `useRealtimeActions`

2. **dashboard/components/TrailMonitor.tsx**
   - `onPositionStatusChanged` → `useRealtimePositions`

3. **dashboard/context/SystemContext.tsx**
   - 複数subscription → `useSystemCoordination`

### apps/admin/features/ での修正
1. **positions/hooks/useRealtimePositions.ts**
   - 手動subscription → Amplify Gen2標準

2. **actions/components/ActionManager.tsx**
   - action状態監視の移行

3. **dashboard/hooks/useDashboardData.ts**
   - リアルタイム更新の統合

## パフォーマンス最適化

### 1. 適切なフィルタリング
```typescript
// 必要なデータのみSubscription
const subscription = amplifyClient.models.Action.observeQuery({
  filter: {
    userId: { eq: userId },
    status: { eq: 'EXECUTING' } // 実行中のもののみ
  }
});
```

### 2. Subscription管理の統一
```typescript
// subscription-manager.ts
class SubscriptionManager {
  private subscriptions: Map<string, any> = new Map();

  subscribe(key: string, subscription: any) {
    this.unsubscribe(key); // 既存をクリーンアップ
    this.subscriptions.set(key, subscription);
  }

  unsubscribe(key: string) {
    const sub = this.subscriptions.get(key);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(key);
    }
  }

  unsubscribeAll() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();
  }
}
```

### 3. 接続状態の監視
```typescript
// connection-monitor.ts
export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);

  useEffect(() => {
    // 複数subscriptionの接続状態を統合監視
    const monitor = setInterval(() => {
      // 接続状態チェック
    }, 5000);

    return () => clearInterval(monitor);
  }, []);

  return { isConnected, connectionCount };
}
```

## 検証方法

### 1. Subscription動作テスト
```typescript
// テスト用スクリプト
import { amplifyClient } from '@repo/shared-amplify';

async function testSubscriptions() {
  const userId = 'test-user';
  let receivedUpdates = 0;

  // Action subscription テスト
  const actionSub = amplifyClient.models.Action.observeQuery({
    filter: { userId: { eq: userId } }
  }).subscribe({
    next: ({ items, isSynced }) => {
      console.log('✅ Action subscription:', items.length, 'synced:', isSynced);
      receivedUpdates++;
    },
    error: (error) => console.error('❌ Action subscription error:', error)
  });

  // テスト用データ作成
  await amplifyClient.models.Action.create({
    userId,
    type: 'ENTRY',
    status: 'PENDING'
  });

  setTimeout(() => {
    actionSub.unsubscribe();
    console.log('Received updates:', receivedUpdates);
  }, 5000);
}
```

### 2. リアルタイム接続テスト
```bash
# WebSocket接続の確認
netstat -an | grep :443 | grep ESTABLISHED
```

### 3. メモリリーク確認
```typescript
// subscription cleanup テスト
const subscriptions = [];

// 大量subscription作成
for (let i = 0; i < 100; i++) {
  subscriptions.push(
    amplifyClient.models.Action.observeQuery().subscribe()
  );
}

// 適切なクリーンアップ
subscriptions.forEach(sub => sub.unsubscribe());
```

## 完了条件
- [ ] apps/hedge-system内のsubscriptions使用箇所を全て移行
- [ ] apps/admin内のsubscriptions使用箇所を全て移行
- [ ] 手動GraphQL文字列を全て削除
- [ ] React Hooksでのsubscription統合完了
- [ ] 型チェック・ビルドが成功
- [ ] リアルタイム更新動作確認完了
- [ ] Subscription接続・切断の適切な管理確認

## 注意事項
- **並列実行**: mutations、queries移行と同時実行可能
- **メモリ管理**: subscriptionの適切なunsubscribeが重要
- **接続管理**: WebSocket接続の安定性確保
- **エラーハンドリング**: 接続断に対する再接続処理

## 次のタスク
- graphql-2-1.md（mutations移行）と並列実行
- graphql-2-2.md（queries移行）と並列実行
- 全て完了後、graphql-3.md（クリーンアップ）を実行