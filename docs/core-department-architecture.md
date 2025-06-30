# Core部門設計書（包括版）

## 📋 MVP核心機能概要

### Position-Trail-Action実行フロー（PTA Engine）
**基本責任範囲**: `userId.startsWith('user_core_')`担当ユーザーの全Positionトレード管理

**核心実行ステップ**:
1. **Entry Phase**: Arbitrage機会検出 → Position Size計算 → Entry Point決定 → 実行
2. **Trail Phase**: Position監視開始 → Trail条件チェック → 動的調整実行
3. **Action Phase**: 条件判定 → Cross-PC同期実行 → 結果統合

**パフォーマンス目標**:
- Entry実行: <10ms（市場機会逸失防止）
- Trail監視: <5ms（利益最大化・損失最小化）
- Action同期: <20ms（複数PC協調実行）

### 技術実装基盤
```typescript
// パフォーマンス定数
const PERFORMANCE_TARGETS = {
  positionEntry: 10,    // ms - Entry実行制限時間
  trailCheck: 5,        // ms - Trail監視間隔
  actionSync: 20,       // ms - Action同期実行制限
  recoveryTimeout: 100, // ms - Recovery処理制限
  healthCheck: 1000     // ms - ヘルスチェック間隔
} as const;

// ユーザー責任判定
const isResponsibleForUser = (userId: string): boolean => {
  return userId.startsWith('user_core_');
};

// エラー分類
enum CoreErrorType {
  ENTRY_TIMEOUT = 'ENTRY_TIMEOUT',
  TRAIL_FAILURE = 'TRAIL_FAILURE', 
  ACTION_SYNC_FAIL = 'ACTION_SYNC_FAIL',
  MT5_CONNECTION = 'MT5_CONNECTION',
  DATABASE_ERROR = 'DATABASE_ERROR'
}
```

## ⚙️ エンジン詳細設計

### 1. Position Execution Engine

#### Entry計算モジュール
**責任**: Arbitrage機会検出からPosition Entry実行まで

**主要機能**:
- **Market Data分析**: 複数Broker価格比較・Spread計算・実行可能性判定
- **Position Size計算**: リスク管理・資金配分・最適ロット算出
- **Entry Point決定**: 最適実行価格・タイミング・実行順序決定
- **Pre-execution検証**: Order有効性・口座残高・Market状況確認

**技術仕様**:
```typescript
interface PositionEntry {
  readonly userId: string;
  readonly symbol: string;
  readonly volume: number;
  readonly entryPrice: number;
  readonly stopLoss: number;
  readonly takeProfit: number;
  readonly timestamp: Date;
  readonly executionTime: number; // ms
}

class PositionExecutionEngine {
  async executeEntry(opportunity: ArbitrageOpportunity): Promise<PositionEntry> {
    const startTime = performance.now();
    
    // 1. Pre-execution検証
    await this.validateExecution(opportunity);
    
    // 2. Position Size計算
    const volume = await this.calculateOptimalVolume(opportunity);
    
    // 3. Entry実行
    const result = await this.sendMT5Order(opportunity, volume);
    
    // 4. 実行時間検証
    const executionTime = performance.now() - startTime;
    if (executionTime > PERFORMANCE_TARGETS.positionEntry) {
      throw new CoreError(CoreErrorType.ENTRY_TIMEOUT, `Entry took ${executionTime}ms`);
    }
    
    return result;
  }
}
```

### 2. Trail Engine（トレール条件監視システム）

#### 監視ループシステム
**責任**: Position状態監視・Trail条件管理・Exit判定

**5ms監視循環プロセス**:
1. **Position状態取得**: 現在価格・未実現損益・実行時間取得
2. **Trail条件検査**: Trailing Stop・Take Profit・Exit条件判定
3. **Trail実行判断**: 条件達成時即座Action実行・Market状況考慮
4. **動的調整**: Trail条件リアルタイム調整・利益最大化実行

**技術仕様**:
```typescript
interface TrailCondition {
  readonly positionId: string;
  readonly trailType: 'TRAILING_STOP' | 'TAKE_PROFIT' | 'BREAK_EVEN';
  readonly currentValue: number;
  readonly targetValue: number;
  readonly activationThreshold: number;
  readonly lastUpdate: Date;
}

class TrailEngine {
  private monitoringInterval: NodeJS.Timeout;
  private activeTrails: Map<string, TrailCondition[]> = new Map();
  
  startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      const startTime = performance.now();
      
      // 全アクティブPositionをチェック
      for (const [positionId, conditions] of this.activeTrails) {
        await this.checkTrailConditions(positionId, conditions);
      }
      
      // 監視時間制限確認
      const checkTime = performance.now() - startTime;
      if (checkTime > PERFORMANCE_TARGETS.trailCheck) {
        console.warn(`Trail check exceeded target: ${checkTime}ms`);
      }
    }, PERFORMANCE_TARGETS.trailCheck);
  }
  
  private async checkTrailConditions(
    positionId: string, 
    conditions: TrailCondition[]
  ): Promise<void> {
    const position = await this.getPositionData(positionId);
    
    for (const condition of conditions) {
      if (this.shouldExecuteTrail(position, condition)) {
        await this.executeTrailAction(position, condition);
      }
    }
  }
}
```

### 3. Action Sync Engine（複数システム協調）

#### Cross-PC同期実行システム
**責任**: 複数PC間でのPosition Action協調実行

**並行実行フロー**:
1. **準備確認Phase**: 全PC接続状況・実行可能性確認
2. **同期開始信号Phase**: Master PC指示・Slave PC準備完了確認
3. **並行実行Phase**: 同時Action実行・リアルタイム監視
4. **結果統合Phase**: 実行結果収集・成功/失敗判定・Recovery実行

**技術仕様**:
```typescript
interface SyncAction {
  readonly actionId: string;
  readonly actionType: 'ENTRY' | 'EXIT' | 'MODIFY';
  readonly targetPCs: string[];
  readonly executionTime: Date;
  readonly timeout: number;
}

class ActionSyncEngine {
  private connectedPCs: Map<string, WebSocket> = new Map();
  private pendingActions: Map<string, SyncAction> = new Map();
  
  async executeSyncAction(action: SyncAction): Promise<boolean> {
    const startTime = performance.now();
    
    try {
      // 1. 準備確認
      const readyPCs = await this.confirmPCReadiness(action.targetPCs);
      if (readyPCs.length !== action.targetPCs.length) {
        throw new Error(`Not all PCs ready: ${readyPCs.length}/${action.targetPCs.length}`);
      }
      
      // 2. 同期開始信号
      await this.sendSyncSignal(action);
      
      // 3. 並行実行
      const results = await Promise.allSettled(
        action.targetPCs.map(pcId => this.executeOnPC(pcId, action))
      );
      
      // 4. 結果統合
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const isSuccess = successCount === action.targetPCs.length;
      
      // 実行時間確認
      const executionTime = performance.now() - startTime;
      if (executionTime > PERFORMANCE_TARGETS.actionSync) {
        console.warn(`Sync action took ${executionTime}ms (target: ${PERFORMANCE_TARGETS.actionSync}ms)`);
      }
      
      return isSuccess;
      
    } catch (error) {
      await this.handleSyncFailure(action, error);
      return false;
    }
  }
}
```

## 🔄 実行パターン詳細

### Entry実行パターン

#### 標準Entry実行フロー
1. **Market Data分析**:
   - 複数Broker価格取得・比較
   - Spread計算・実行コスト算出
   - Market状況判定・流動性確認

2. **Arbitrage Gap検出**:
   - 価格差閾値判定
   - 実行可能時間算出
   - 利益期待値計算

3. **Position Size計算**:
   - リスク管理適用
   - 口座残高確認
   - 最大レバレッジ制限

4. **Entry Point決定**:
   - 最適実行価格算出
   - 実行タイミング最適化
   - Slippage考慮

5. **MT5 Order送信・確認**:
   - Order検証・送信
   - 実行確認・結果取得
   - Database更新・ログ記録

#### 高速Entry実行（<10ms）最適化
```typescript
class HighSpeedEntryExecutor {
  // Pre-computed値キャッシュ
  private precomputedSizes: Map<string, number> = new Map();
  private connectionPool: MT5ConnectionPool;
  
  async executeHighSpeedEntry(opportunity: ArbitrageOpportunity): Promise<PositionEntry> {
    // 事前計算値使用で計算時間短縮
    const volume = this.precomputedSizes.get(opportunity.symbol) || 
                   await this.calculateVolumeAsync(opportunity);
    
    // Connection Pool使用で接続時間短縮
    const connection = await this.connectionPool.acquire();
    
    try {
      // 並行実行で総時間短縮
      const [orderResult, dbUpdate] = await Promise.all([
        connection.sendOrder(opportunity, volume),
        this.prepareDatabaseUpdate(opportunity, volume)
      ]);
      
      // Database更新完了
      await this.commitDatabaseUpdate(dbUpdate, orderResult);
      
      return orderResult;
    } finally {
      this.connectionPool.release(connection);
    }
  }
}
```

### Trail発動パターン

#### 動的Trail調整システム
1. **Position監視（5ms間隔）**:
   - 現在価格取得
   - 未実現損益計算
   - Market状況確認

2. **Trail条件評価**:
   - Trailing Stop距離計算
   - Take Profit調整判定
   - Break Even移動判定

3. **動的調整実行**:
   - Trail条件リアルタイム更新
   - Market volatility考慮調整
   - 利益最大化追求

#### Trail条件管理
```typescript
class DynamicTrailManager {
  updateTrailConditions(position: Position, marketData: MarketData): TrailCondition[] {
    const conditions: TrailCondition[] = [];
    
    // Trailing Stop動的調整
    const trailDistance = this.calculateOptimalTrailDistance(position, marketData);
    conditions.push({
      type: 'TRAILING_STOP',
      distance: trailDistance,
      lastUpdate: new Date()
    });
    
    // Take Profit段階的調整
    if (position.unrealizedProfit > position.initialTarget * 0.5) {
      conditions.push({
        type: 'TAKE_PROFIT_PARTIAL',
        ratio: 0.5,
        price: position.currentPrice + (position.initialTarget * 0.3)
      });
    }
    
    return conditions;
  }
}
```

### Cross-PC Action実行パターン

#### Master-Slave協調実行
1. **準備Phase**:
   - 全PC接続確認
   - 実行可能性検証
   - Synchronization Point設定

2. **同期実行Phase**:
   - Master指示送信
   - Slave準備完了確認
   - 同時実行開始

3. **結果統合Phase**:
   - 実行結果収集
   - 成功/失敗判定
   - Recovery処理実行

#### 協調実行管理
```typescript
class CrossPCCoordinator {
  async coordinateExecution(action: CrossPCAction): Promise<ExecutionResult> {
    // 1. 準備確認
    const readyNodes = await this.checkAllNodesReady(action.targetNodes);
    
    // 2. 同期実行
    const syncPoint = new Date(Date.now() + 100); // 100ms後同期実行
    await this.scheduleSyncExecution(readyNodes, action, syncPoint);
    
    // 3. 結果監視
    const results = await this.monitorExecution(action.actionId);
    
    // 4. Recovery処理
    if (!results.allSuccessful) {
      await this.executeRecovery(action, results);
    }
    
    return results;
  }
}
```

## 🔗 部門間連携仕様

### Backend部門連携

#### GraphQL Subscription統合
**Position更新監視**:
```typescript
// Position状態変更Subscription
const POSITION_UPDATES = gql`
  subscription PositionUpdates($userId: String!) {
    positionUpdated(userId: $userId) {
      id
      symbol
      volume
      currentPrice
      unrealizedProfit
      status
      lastUpdate
    }
  }
`;

class BackendIntegration {
  subscribeToPositionUpdates(userId: string): Subscription {
    return this.apolloClient.subscribe({
      query: POSITION_UPDATES,
      variables: { userId }
    }).subscribe({
      next: (data) => {
        // Core Engine通知
        this.coreEngine.handlePositionUpdate(data.positionUpdated);
      },
      error: (error) => {
        console.error('Position subscription error:', error);
      }
    });
  }
}
```

#### Database同期管理
**Position状態同期**:
```typescript
interface PositionSyncData {
  positionId: string;
  status: PositionStatus;
  currentPrice: number;
  unrealizedProfit: number;
  trailConditions: TrailCondition[];
  lastSync: Date;
}

class DatabaseSyncManager {
  async syncPositionState(positionData: PositionSyncData): Promise<boolean> {
    try {
      // 1. Database更新
      await this.updatePositionInDB(positionData);
      
      // 2. 同期確認
      const verification = await this.verifySync(positionData.positionId);
      
      // 3. Conflict解決
      if (!verification.synchronized) {
        await this.resolveConflict(positionData, verification.dbData);
      }
      
      return true;
    } catch (error) {
      console.error('Database sync failed:', error);
      return false;
    }
  }
}
```

### Frontend部門連携

#### Real-time通知システム
**Position変更通知**:
```typescript
interface PositionNotification {
  type: 'POSITION_CHANGE' | 'PROFIT_UPDATE' | 'RISK_ALERT';
  positionId: string;
  userId: string;
  data: any;
  timestamp: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

class FrontendNotificationService {
  private webSocketConnection: WebSocket;
  
  sendPositionNotification(notification: PositionNotification): void {
    const message = {
      type: 'POSITION_NOTIFICATION',
      payload: notification
    };
    
    this.webSocketConnection.send(JSON.stringify(message));
  }
  
  notifyProfitChange(positionId: string, profit: number, change: number): void {
    this.sendPositionNotification({
      type: 'PROFIT_UPDATE',
      positionId,
      userId: this.getCurrentUserId(),
      data: { profit, change, percentage: (change / profit) * 100 },
      timestamp: new Date(),
      priority: Math.abs(change) > 1000 ? 'HIGH' : 'MEDIUM'
    });
  }
}
```

### Integration部門連携

#### MT5実行指示システム
**Command検証・実行**:
```typescript
interface MT5Command {
  commandType: 'OPEN_POSITION' | 'CLOSE_POSITION' | 'MODIFY_POSITION';
  symbol: string;
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionId?: string;
}

class MT5IntegrationService {
  async executeMT5Command(command: MT5Command): Promise<MT5ExecutionResult> {
    // 1. Command検証
    const validation = await this.validateCommand(command);
    if (!validation.isValid) {
      throw new Error(`Invalid MT5 command: ${validation.errors.join(', ')}`);
    }
    
    // 2. MT5接続確認
    const connection = await this.ensureConnection();
    if (!connection.isConnected) {
      throw new Error('MT5 connection not available');
    }
    
    // 3. 実行
    const result = await connection.executeCommand(command);
    
    // 4. 実行結果検証
    const verification = await this.verifyExecution(command, result);
    if (!verification.verified) {
      await this.handleExecutionFailure(command, result, verification);
    }
    
    return result;
  }
}
```

## 🔧 エラーハンドリング・Recovery

### エラー分類・対応
```typescript
class CoreErrorHandler {
  async handleError(error: CoreError): Promise<void> {
    switch (error.type) {
      case CoreErrorType.ENTRY_TIMEOUT:
        await this.handleEntryTimeout(error);
        break;
      
      case CoreErrorType.TRAIL_FAILURE:
        await this.handleTrailFailure(error);
        break;
      
      case CoreErrorType.ACTION_SYNC_FAIL:
        await this.handleSyncFailure(error);
        break;
      
      case CoreErrorType.MT5_CONNECTION:
        await this.handleMT5ConnectionError(error);
        break;
      
      case CoreErrorType.DATABASE_ERROR:
        await this.handleDatabaseError(error);
        break;
    }
  }
}
```

## 📊 パフォーマンス監視

### メトリクス収集
```typescript
interface CoreMetrics {
  entryExecutionTimes: number[];
  trailCheckTimes: number[];
  syncActionTimes: number[];
  errorCounts: Record<CoreErrorType, number>;
  throughput: {
    entriesPerSecond: number;
    trailChecksPerSecond: number;
    syncActionsPerSecond: number;
  };
}

class PerformanceMonitor {
  private metrics: CoreMetrics;
  
  recordEntryExecution(executionTime: number): void {
    this.metrics.entryExecutionTimes.push(executionTime);
    this.checkPerformanceThreshold('entry', executionTime, PERFORMANCE_TARGETS.positionEntry);
  }
  
  generatePerformanceReport(): PerformanceReport {
    return {
      averageEntryTime: this.calculateAverage(this.metrics.entryExecutionTimes),
      averageTrailTime: this.calculateAverage(this.metrics.trailCheckTimes),
      averageSyncTime: this.calculateAverage(this.metrics.syncActionTimes),
      errorRate: this.calculateErrorRate(),
      throughputMetrics: this.metrics.throughput
    };
  }
}
```

---
**Core部門 - MVP核心エンジン包括設計（Position-Trail-Action実行システム）**