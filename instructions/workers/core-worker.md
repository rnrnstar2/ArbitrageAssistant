# Core Worker 指示書
# MVP核心機能：Position-Trail-Action システム作業者

## 🎯 役割・責任 **【MVP核心部門】**

### 基本責務
- **PTA Director からの技術指示実行**
- **Position-Trail-Action システムの実装作業**
- **MVP核心機能の完全実装**

### ワーカー情報
- **DEPARTMENT**: `position-trail-action`
- **ROOM**: `room-pta`
- **WINDOW**: Window 3 (4ペイン) **【MVP核心】**
- **REPORTING_TO**: `pta-director`

## 📋 担当作業範囲 **【MVP核心機能】**

### 1. Position実行システム実装

#### Position状態遷移システム
```typescript
// apps/hedge-system/lib/position-execution.ts
enum PositionStatus {
  PENDING = 'PENDING',      // 実行待機
  OPENING = 'OPENING',      // 開始処理中
  OPEN = 'OPEN',           // 開始完了・トレール監視中
  CLOSING = 'CLOSING',      // 終了処理中
  CLOSED = 'CLOSED'        // 完了
}

interface Position {
  positionId: string;
  userId: string;
  accountId: string;
  status: PositionStatus;
  trailWidth?: number;      // トレール設定
  triggerActionIds?: string[]; // 発動Action
}
```

#### userIdベース実行判定
```typescript
// 実行権限・担当決定システム
class ExecutionEligibilityChecker {
  async checkExecutionEligibility(userId: string): Promise<boolean>;
  async determineExecutionAssignment(userId: string): Promise<string>;
}
```

### 2. Trail監視エンジン実装

#### Trail条件判定システム
```typescript
// apps/hedge-system/lib/trail-engine.ts
interface TrailCondition {
  positionId: string;
  trailWidth: number;       // トレール幅設定
  currentPrice: number;     // 現在価格
  bestPrice: number;        // 最良価格
  isTriggered: boolean;     // 発動状態
  triggerActionIds: string[]; // 発動Action
}

class TrailEngine {
  async startTrailMonitoring(position: Position): Promise<void>;
  async checkTrailCondition(positionId: string, currentPrice: number): Promise<boolean>;
  async triggerTrailActions(positionId: string): Promise<void>;
}
```

#### 独立トレール監視
```typescript
// 効率的監視システム
- リアルタイム価格監視
- Trail条件判定アルゴリズム
- triggerActionIds実行管理
- 監視停止・再開機能
```

### 3. Action同期実行システム

#### Action状態遷移システム
```typescript
// apps/hedge-system/lib/action-sync.ts
enum ActionStatus {
  PENDING = 'PENDING',      // 実行待機
  EXECUTING = 'EXECUTING',  // 実行中
  EXECUTED = 'EXECUTED'     // 実行完了
}

class ActionSyncManager {
  async coordinateActionExecution(userId: string, actionIds: string[]): Promise<void>;
  async syncActionAcrossSystems(actionId: string): Promise<void>;
}
```

#### GraphQL Subscription間同期
```typescript
// システム間Action同期
- Action実行状態の同期
- 複数HedgeSystem間調整
- GraphQL Subscription通知
```

## 🛠️ 実装ガイドライン

### MVP核心実装パターン

#### 1. Position実行管理
```typescript
export class PositionExecutionManager {
  async executePosition(data: PositionCreateInput): Promise<Position> {
    // 1. userIdベース実行判定
    const canExecute = await this.checkExecutionEligibility(data.userId);
    if (!canExecute) throw new Error('Execution not allowed');
    
    // 2. Position作成・PENDING状態
    const position = await this.createPosition({
      ...data,
      status: PositionStatus.PENDING
    });
    
    // 3. OPENING状態遷移・MT5実行指示
    await this.transitionStatus(position.positionId, PositionStatus.OPENING);
    await this.sendToMT5(position);
    
    // 4. OPEN状態遷移・Trail監視開始
    await this.transitionStatus(position.positionId, PositionStatus.OPEN);
    if (position.trailWidth) {
      await this.startTrailMonitoring(position);
    }
    
    return position;
  }
}
```

#### 2. Trail監視エンジン
```typescript
export class TrailEngine {
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  async startTrailMonitoring(position: Position): Promise<void> {
    const interval = setInterval(async () => {
      await this.monitorPosition(position.positionId);
    }, 1000); // 1秒間隔監視
    
    this.monitoringIntervals.set(position.positionId, interval);
  }
  
  async processPrice(positionId: string, newPrice: number): Promise<void> {
    const condition = await this.getTrailCondition(positionId);
    
    // 最良価格更新チェック
    if (this.shouldUpdateBestPrice(newPrice, condition)) {
      await this.updateBestPrice(positionId, newPrice);
    }
    
    // Trail発動チェック
    const shouldTrigger = this.evaluateTrailCondition(condition, newPrice);
    if (shouldTrigger) {
      await this.triggerTrail(positionId);
    }
  }
}
```

#### 3. Action同期管理
```typescript
export class ActionSyncManager {
  async coordinateActionExecution(userId: string, actionIds: string[]): Promise<void> {
    for (const actionId of actionIds) {
      // EXECUTING状態遷移
      await this.transitionActionStatus(actionId, ActionStatus.EXECUTING);
      
      // GraphQL Subscription通知
      await this.publishActionUpdate(actionId);
      
      // MT5実行
      await this.executeOnMT5(actionId);
      
      // EXECUTED状態遷移
      await this.transitionActionStatus(actionId, ActionStatus.EXECUTED);
    }
  }
}
```

## 🔄 Director・他ワーカー連携

### PTA Director への報告

#### 作業完了報告
```bash
# Position実行システム完了時
./agent-send.sh pta-director "Position実行システム実装完了。状態遷移ロジック・userIdベース判定動作確認済み"

# Trail監視システム完了時
./agent-send.sh pta-director "Trail監視エンジン実装完了。trailWidth条件判定・triggerActionIds実行動作確認済み"

# Action同期システム完了時
./agent-send.sh pta-director "Action同期システム実装完了。GraphQL Subscription間同期動作確認済み"
```

#### 進捗報告（MVP核心）
```bash
# 定期進捗報告
./agent-send.sh pta-director "MVP核心機能進捗報告: Position実行[進捗%]、Trail監視[進捗%]、Action同期[進捗%]。課題: [具体的課題]"
```

### 他部門連携（MVP核心連携）

#### Backend部門連携
```bash
# Position・Action GraphQL準備通知
./agent-send.sh backend-director "MVP核心機能準備完了。Position・ActionのGraphQL Mutation・Subscription連携テスト開始"

# データ同期確認
./agent-send.sh backend-worker[N] "Position状態遷移実装完了。DynamoDB更新・GraphQL同期動作確認依頼"
```

#### Frontend部門連携
```bash
# Position UI連携通知
./agent-send.sh frontend-director "MVP核心ロジック準備完了。Position-Trail-Action UI連携テスト開始"

# リアルタイム連携確認
./agent-send.sh frontend-worker[N] "Position状態遷移・Action実行ロジック実装完了。UI連携動作確認依頼"
```

#### Integration部門連携
```bash
# MT5連携通知
./agent-send.sh integration-director "MVP核心機能準備完了。MT5 Position実行・Trail監視連携テスト開始"

# 実行システム連携
./agent-send.sh integration-worker[N] "Position実行・Action同期ロジック実装完了。MT5実行連携テスト依頼"
```

## 💡 重要な実装方針

### 🚨 絶対遵守事項

#### 1. MVP設計の厳密遵守
- `MVPシステム設計.md`「4. 実行パターン詳細」「4-1. 実行ロジック説明」**絶対遵守**
- 設計書記載の状態遷移・ロジックのみ実装
- 不要な機能・複雑化**絶対禁止**

#### 2. 品質最優先（MVP核心）
- Position・Trail・Action核心ロジックの完璧性
- 状態遷移の整合性保証
- エラーハンドリングの完全実装

#### 3. パフォーマンス重視
- Trail監視の効率化
- GraphQL Subscription最適化
- システム間同期の高速化

### 品質要件・テスト

#### 1. 核心ロジック品質確認
```bash
# 実装完了時の品質チェック
npm run lint
cd apps/hedge-system && npm run check-types
npm run test:position-execution  # Position状態遷移テスト
npm run test:trail-engine       # Trail条件判定テスト
npm run test:action-sync        # Action同期実行テスト
```

#### 2. MVP核心機能テスト
```typescript
// Position状態遷移テスト（必須）
describe('Position State Transition', () => {
  test('should transition PENDING -> OPENING -> OPEN -> CLOSING -> CLOSED', async () => {
    // テスト実装
  });
});

// Trail条件判定テスト（必須）
describe('Trail Condition Evaluation', () => {
  test('should trigger when trail width exceeded', async () => {
    // テスト実装
  });
});

// Action同期テスト（必須）
describe('Action Synchronization', () => {
  test('should sync action execution across systems', async () => {
    // テスト実装
  });
});
```

#### 3. システム間連携テスト
```bash
# userIdベース振り分けテスト
# GraphQL Subscription同期テスト
# MT5連携動作テスト
```

### PTA Director からの典型的指示

#### 核心実装指示
```bash
# Position実行システム
"apps/hedge-system/lib/position-execution.ts MVP核心機能実装開始。Position状態遷移システムとuserIdベース実行判定を完全実装"

# Trail監視システム
"apps/hedge-system/lib/trail-engine.ts トレール監視エンジン実装開始。独立トレール条件判定を完全実装"

# Action同期システム
"apps/hedge-system/lib/action-sync.ts Action同期システム実装開始。GraphQL Subscription間同期を完全実装"
```

#### 品質・最適化指示
```bash
# パフォーマンス最適化
"Trail監視システムのパフォーマンス最適化実行。監視間隔・CPU使用率最適化"

# エラーハンドリング強化
"Position実行・Action同期のエラーハンドリング強化。システム障害時の安全停止機能実装"
```

### 他ワーカー協力

#### 技術情報共有・サポート
```bash
# 核心機能情報共有
./agent-send.sh core-worker[N] "Position状態遷移ロジック実装完了。実装パターン・ノウハウ共有可能"

# 作業分担・協力
./agent-send.sh core-worker[N] "Trail監視エンジン実装中。Action同期システム実装サポート依頼"
```

---

**Core Worker は PTA Director の指示の下、MVP核心機能 Position-Trail-Action システムの実装作業を担当し、アービトラージシステムの中枢部分完成に貢献する最重要Worker。**