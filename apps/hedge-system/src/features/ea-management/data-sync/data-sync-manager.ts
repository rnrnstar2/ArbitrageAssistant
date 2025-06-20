import { EventEmitter } from 'events';
import { GraphQLSyncClient, ConflictError } from './graphql-sync';
import {
  SyncOperation,
  SyncBatch,
  SyncStats,
  SyncError,
  SyncConfiguration,
  DataChangeset,
  SyncState,
  ConflictItem,
  SyncEvent,
} from './types';
import { Position, Account, EAConnection } from '../types';

export class DataSyncManager extends EventEmitter {
  private graphqlClient: GraphQLSyncClient;
  private config: SyncConfiguration;
  private state: SyncState;
  private stats: SyncStats;
  private batchTimer?: NodeJS.Timeout;
  private retryTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(
    graphqlEndpoint: string,
    authToken?: string,
    config?: Partial<SyncConfiguration>
  ) {
    super();
    
    this.graphqlClient = new GraphQLSyncClient(graphqlEndpoint, authToken);
    this.config = {
      batchSize: 10,
      batchInterval: 5000,
      maxRetries: 3,
      retryDelay: 2000,
      enableConflictResolution: true,
      enableOptimisticUpdates: false,
      syncMode: 'hybrid',
      ...config,
    };
    
    this.state = {
      lastSyncTimestamp: new Map(),
      pendingOperations: new Map(),
      conflictQueue: [],
    };
    
    this.stats = {
      totalOperations: 0,
      pendingOperations: 0,
      completedOperations: 0,
      failedOperations: 0,
      averageProcessingTime: 0,
      syncErrors: [],
    };
  }

  /**
   * 同期処理を開始
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.scheduleBatchProcessing();
    this.scheduleRetryProcessing();
    
    this.emit('sync_manager_started');
  }

  /**
   * 同期処理を停止
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    
    this.emit('sync_manager_stopped');
  }

  /**
   * ポジション更新を同期
   */
  async syncPositionUpdate(accountId: string, positions: Position[]): Promise<void> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'update',
      entity: 'position',
      accountId,
      data: positions,
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    await this.queueOperation(operation);
  }

  /**
   * アカウント更新を同期
   */
  async syncAccountUpdate(accountId: string, account: Account): Promise<void> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'update',
      entity: 'account',
      accountId,
      data: account,
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    await this.queueOperation(operation);
  }

  /**
   * 接続状態を同期
   */
  async syncConnectionUpdate(accountId: string, connection: EAConnection): Promise<void> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'update',
      entity: 'connection',
      accountId,
      data: connection,
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    await this.queueOperation(operation);
  }

  /**
   * 変更セットを同期
   */
  async syncChangeset(changeset: DataChangeset): Promise<void> {
    const operations: SyncOperation[] = [];

    // ポジション追加
    for (const position of changeset.positions.added) {
      operations.push({
        id: this.generateOperationId(),
        type: 'create',
        entity: 'position',
        accountId: changeset.accountId,
        data: position,
        timestamp: changeset.timestamp,
        status: 'pending',
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      });
    }

    // ポジション更新
    for (const position of changeset.positions.updated) {
      operations.push({
        id: this.generateOperationId(),
        type: 'update',
        entity: 'position',
        accountId: changeset.accountId,
        data: position,
        timestamp: changeset.timestamp,
        status: 'pending',
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      });
    }

    // ポジション削除
    for (const ticket of changeset.positions.removed) {
      operations.push({
        id: this.generateOperationId(),
        type: 'delete',
        entity: 'position',
        accountId: changeset.accountId,
        data: { ticket },
        timestamp: changeset.timestamp,
        status: 'pending',
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      });
    }

    // アカウント更新
    if (Object.keys(changeset.account.updated).length > 0) {
      operations.push({
        id: this.generateOperationId(),
        type: 'update',
        entity: 'account',
        accountId: changeset.accountId,
        data: changeset.account.updated,
        timestamp: changeset.timestamp,
        status: 'pending',
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      });
    }

    // 接続状態更新
    if (Object.keys(changeset.connection.updated).length > 0) {
      operations.push({
        id: this.generateOperationId(),
        type: 'update',
        entity: 'connection',
        accountId: changeset.accountId,
        data: changeset.connection.updated,
        timestamp: changeset.timestamp,
        status: 'pending',
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      });
    }

    for (const operation of operations) {
      await this.queueOperation(operation);
    }
  }

  /**
   * 統計情報を取得
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * コンフリクトキューを取得
   */
  getConflicts(): ConflictItem[] {
    return [...this.state.conflictQueue];
  }

  /**
   * コンフリクトを手動解決
   */
  async resolveConflict(conflictId: string, resolution: 'client' | 'server' | 'merge', mergedData?: any): Promise<void> {
    const conflict = this.state.conflictQueue.find(c => c.id === conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    let resolvedData: any;
    
    switch (resolution) {
      case 'client':
        resolvedData = conflict.clientData;
        break;
      case 'server':
        resolvedData = conflict.serverData;
        break;
      case 'merge':
        if (!mergedData) {
          throw new Error('Merged data is required for merge resolution');
        }
        resolvedData = mergedData;
        break;
      default:
        throw new Error(`Unknown resolution strategy: ${resolution}`);
    }

    // 解決されたデータで新しい操作を作成
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'update',
      entity: 'position', // conflict から取得する必要がある
      accountId: conflict.accountId,
      data: resolvedData,
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    // コンフリクトキューから削除
    this.state.conflictQueue = this.state.conflictQueue.filter(c => c.id !== conflictId);
    
    // 操作をキューに追加
    await this.queueOperation(operation);
    
    this.emit('conflict_resolved', conflict, resolution);
  }

  private async queueOperation(operation: SyncOperation): Promise<void> {
    const operations = this.state.pendingOperations.get(operation.accountId) || [];
    operations.push(operation);
    this.state.pendingOperations.set(operation.accountId, operations);
    
    this.stats.totalOperations++;
    this.stats.pendingOperations++;
    
    this.emitSyncEvent({
      type: 'operation_queued',
      accountId: operation.accountId,
      operationId: operation.id,
      timestamp: new Date(),
      data: operation,
    });

    // リアルタイムモードの場合は即座に処理
    if (this.config.syncMode === 'realtime') {
      await this.processOperation(operation);
    }
  }

  private scheduleBatchProcessing(): void {
    if (!this.isRunning) {
      return;
    }

    this.batchTimer = setTimeout(async () => {
      if (this.config.syncMode === 'batch' || this.config.syncMode === 'hybrid') {
        await this.processBatches();
      }
      this.scheduleBatchProcessing();
    }, this.config.batchInterval);
  }

  private scheduleRetryProcessing(): void {
    if (!this.isRunning) {
      return;
    }

    this.retryTimer = setTimeout(async () => {
      await this.processRetries();
      this.scheduleRetryProcessing();
    }, this.config.retryDelay);
  }

  private async processBatches(): Promise<void> {
    for (const [accountId, operations] of this.state.pendingOperations) {
      if (operations.length === 0) {
        continue;
      }

      const batch = operations.splice(0, this.config.batchSize);
      await this.processBatch(accountId, batch);
    }
  }

  private async processBatch(accountId: string, operations: SyncOperation[]): Promise<void> {
    const batch: SyncBatch = {
      id: this.generateBatchId(),
      operations,
      accountId,
      timestamp: new Date(),
      status: 'processing',
      completedCount: 0,
      failedCount: 0,
    };

    try {
      const results = await this.graphqlClient.executeBatch(operations);
      
      for (const operation of operations) {
        const result = results.get(operation.id);
        if (result?.success) {
          operation.status = 'completed';
          batch.completedCount++;
          this.stats.completedOperations++;
        } else {
          operation.status = 'failed';
          operation.error = result?.error || 'Unknown error';
          batch.failedCount++;
          this.stats.failedOperations++;
          
          if (operation.retryCount < operation.maxRetries) {
            this.requeueForRetry(operation);
          }
        }
        
        this.stats.pendingOperations--;
      }

      batch.status = batch.failedCount === 0 ? 'completed' : 'failed';
      
    } catch (error) {
      batch.status = 'failed';
      
      for (const operation of operations) {
        operation.status = 'failed';
        operation.error = error instanceof Error ? error.message : 'Unknown error';
        this.stats.failedOperations++;
        this.stats.pendingOperations--;
        
        if (operation.retryCount < operation.maxRetries) {
          this.requeueForRetry(operation);
        }
      }
    }

    this.emitSyncEvent({
      type: batch.status === 'completed' ? 'sync_completed' : 'sync_failed',
      accountId,
      timestamp: new Date(),
      data: batch,
    });
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    operation.status = 'processing';
    
    try {
      switch (operation.entity) {
        case 'position':
          await this.graphqlClient.syncPositions(operation.accountId, [operation.data]);
          break;
        case 'account':
          await this.graphqlClient.syncAccount(operation.accountId, operation.data);
          break;
        case 'connection':
          await this.graphqlClient.syncConnection(operation.accountId, operation.data);
          break;
      }
      
      operation.status = 'completed';
      this.stats.completedOperations++;
      this.stats.pendingOperations--;
      
      this.emitSyncEvent({
        type: 'operation_completed',
        accountId: operation.accountId,
        operationId: operation.id,
        timestamp: new Date(),
      });
      
    } catch (error) {
      if (error instanceof ConflictError) {
        await this.handleConflict(operation, error.conflictData);
      } else {
        operation.status = 'failed';
        operation.error = error instanceof Error ? error.message : 'Unknown error';
        this.stats.failedOperations++;
        this.stats.pendingOperations--;
        
        if (operation.retryCount < operation.maxRetries) {
          this.requeueForRetry(operation);
        }
        
        this.emitSyncEvent({
          type: 'operation_failed',
          accountId: operation.accountId,
          operationId: operation.id,
          timestamp: new Date(),
          error: operation.error,
        });
      }
    }
  }

  private async processRetries(): Promise<void> {
    const now = new Date();
    
    for (const [accountId, operations] of this.state.pendingOperations) {
      const retryOperations = operations.filter(
        op => op.status === 'failed' && 
             op.retryCount < op.maxRetries &&
             (now.getTime() - op.timestamp.getTime()) >= this.config.retryDelay
      );
      
      for (const operation of retryOperations) {
        operation.retryCount++;
        operation.status = 'pending';
        operation.timestamp = now;
        await this.processOperation(operation);
      }
    }
  }

  private requeueForRetry(operation: SyncOperation): void {
    operation.status = 'pending';
    operation.timestamp = new Date();
    this.stats.pendingOperations++;
  }

  private async handleConflict(operation: SyncOperation, conflictData: any): Promise<void> {
    if (!this.config.enableConflictResolution) {
      operation.status = 'failed';
      operation.error = 'Conflict detected and resolution is disabled';
      return;
    }

    const conflict: ConflictItem = {
      id: this.generateConflictId(),
      operationId: operation.id,
      accountId: operation.accountId,
      clientData: operation.data,
      serverData: conflictData,
      timestamp: new Date(),
    };

    this.state.conflictQueue.push(conflict);
    
    this.emitSyncEvent({
      type: 'conflict_detected',
      accountId: operation.accountId,
      operationId: operation.id,
      timestamp: new Date(),
      data: conflict,
    });
  }

  private emitSyncEvent(event: SyncEvent): void {
    this.emit(event.type, event);
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }
}