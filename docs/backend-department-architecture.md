# Backend部門設計書（Amplify Gen2準拠版）

## 1. 技術構成（15行）

### 核心技術スタック
- **AWS Amplify Gen2**: TypeScript 5.5.4 + CDK v2
- **認証**: Amazon Cognito (JWT + Custom Attributes)
- **API**: GraphQL + AWS AppSync (Subscription対応)
- **データベース**: DynamoDB (userIdベースSecondaryIndex最適化)

### パフォーマンス目標
- **クエリ応答**: <100ms (userId SecondaryIndex活用)
- **Subscription遅延**: <50ms (リアルタイム同期)
- **スループット**: Read 1000RCU / Write 500WCU
- **実行判定**: 30ms以内 (責任者確定)

### userIdベース最適化設計
- **所有権ベース認可**: `.authorization(allow => [allow.owner()])`
- **高速フィルタ**: SecondaryIndex `byUserIdAndStatus` で状態別即座取得
- **責任分離**: userIdによる実行担当PC判定

## 2. データモデル（Amplify Gen2仕様）

### Schema定義（Gen2準拠）
```typescript
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  PositionStatus: a.enum(['PENDING', 'OPENING', 'OPEN', 'CLOSING', 'CLOSED', 'STOPPED', 'CANCELED']),
  ExecutionType: a.enum(['ENTRY', 'EXIT']),
  Symbol: a.enum(['USDJPY', 'EURUSD', 'EURGBP', 'XAUUSD']),
  ActionType: a.enum(['ENTRY', 'CLOSE']),
  ActionStatus: a.enum(['PENDING', 'EXECUTING', 'EXECUTED', 'FAILED']),

  Position: a.model({
    userId: a.id().required(),
    accountId: a.id().required(),
    status: a.ref('PositionStatus').required(),
    executionType: a.ref('ExecutionType').required(),
    symbol: a.ref('Symbol').required(),
    volume: a.float().required(),
    trailWidth: a.float().required().default(0),
    triggerActionIds: a.string(),
    entryPrice: a.float(),
    exitPrice: a.float(),
    mtTicket: a.string()
  })
  .secondaryIndex('byUserId', ['userId'])
  .secondaryIndex('byUserIdAndStatus', ['userId', 'status'])
  .secondaryIndex('byUserIdAndTrail', ['userId', 'trailWidth'])
  .authorization(allow => [allow.owner()]),

  Action: a.model({
    userId: a.id().required(),
    accountId: a.id().required(),
    positionId: a.id(),
    triggerPositionId: a.id(),
    type: a.ref('ActionType').required(),
    status: a.ref('ActionStatus').required()
  })
  .secondaryIndex('byUserId', ['userId'])
  .secondaryIndex('byUserIdAndStatus', ['userId', 'status'])
  .authorization(allow => [allow.owner()])
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema });
```

### 状態遷移パターン
- **Position**: `PENDING` → `OPENING` → `OPEN` → `CLOSING` → `CLOSED`
- **Action**: `PENDING` → `EXECUTING` → `EXECUTED` | `FAILED`
- **userId検証**: 実行前に`action.userId === currentUserId`で担当確認

## 3. 実装方針（Gen2仕様）

### GraphQL Subscriptions（自動生成活用）
```typescript
// Gen2で自動生成されるSubscription
import { generateClient } from 'aws-amplify/data';
import type { Schema } from './data/resource';

const client = generateClient<Schema>();

// リアルタイム監視（トレール判定用）
const positionSubscription = client.models.Position.onUpdate({
  filter: { userId: { eq: currentUserId } }
});

// 実行担当判定（Cross-PC調整）  
const actionSubscription = client.models.Action.onUpdate({
  filter: { 
    userId: { eq: currentUserId },
    status: { eq: 'EXECUTING' }
  }
});
```

### DynamoDB最適化手法（Gen2対応）
- **SecondaryIndex活用**: `byUserIdAndStatus` で高速状態フィルタ
- **並列クエリ**: Promise.allで複数Index同時アクセス
- **eventually consistent**: 読み取り整合性 < 速度優先
- **Batch操作**: 25件/Transaction制限内で一括更新

### エラーハンドリング基本方針
- **Optimistic Lock**: version比較で競合状態回避
- **Retry戦略**: 指数バックオフ（1s→2s→4s、最大3回）
- **タイムアウト**: 5秒制限、100ms超過でアラート送信

## 4. 部門間連携（Gen2準拠）

### Frontend連携
- **TypeScript型安全**: `generateClient<Schema>()` で完全型付け
- **リアルタイム監視**: `.onUpdate()` Subscriptionで状態変更即座反映

### Integration連携
- **WebSocket受信**: MT5データ → DynamoDB Position/Action更新
- **状態同期**: Integration → Backend → Frontend のデータフロー

### Core連携
- **Position-Trail-Action実行**: Core部門がBackend APIでトレール判定・Action実行  
- **実行権限**: userIdベースで担当PC特定、重複実行防止

---
*Amplify Gen2完全準拠 - ultrathink品質でMVP開発対応*