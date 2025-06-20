import { EventEmitter } from 'events';
import { type SystemPosition, type PositionError } from '../websocket/position-receiver';

/**
 * ポジション管理設定
 */
export interface PositionManagerConfig {
  enableSynchronization?: boolean;
  enableConflictResolution?: boolean;
  maxPositions?: number;
  syncInterval?: number;
  persistChanges?: boolean;
  enableRealTimeUpdates?: boolean;
  conflictResolutionStrategy?: 'websocket_priority' | 'graphql_priority' | 'timestamp_priority';
}

/**
 * ポジション競合情報
 */
export interface PositionConflict {
  positionId: string;
  websocketData: SystemPosition;
  graphqlData: any;
  conflictType: 'data_mismatch' | 'timing_conflict' | 'status_conflict';
  timestamp: number;
  resolved: boolean;
  resolution?: 'websocket_won' | 'graphql_won' | 'merged';
}

/**
 * ポジション管理統計
 */
export interface PositionManagerStats {
  totalPositions: number;
  activePositions: number;
  closedPositions: number;
  pendingPositions: number;
  syncConflicts: number;
  resolvedConflicts: number;
  lastSyncTimestamp?: number;
  graphqlUpdates: number;
  websocketUpdates: number;
  averageProcessingTime: number;
}

/**
 * ポジション同期結果
 */
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  conflictCount: number;
  errorCount: number;
  errors: PositionError[];
  conflicts: PositionConflict[];
  duration: number;
}

/**
 * ポジション管理を統括するクラス
 * WebSocketからのリアルタイムデータとGraphQLからのデータの整合性を管理
 */
export class PositionManager extends EventEmitter {
  private config: Required<PositionManagerConfig>;
  private positions: Map<string, SystemPosition> = new Map();
  private conflicts: Map<string, PositionConflict> = new Map();
  private stats: PositionManagerStats;
  private syncTimer: NodeJS.Timeout | null = null;
  private processingTimes: number[] = [];

  constructor(config: PositionManagerConfig = {}) {
    super();

    this.config = {
      enableSynchronization: true,
      enableConflictResolution: true,
      maxPositions: 10000,
      syncInterval: 60000, // 1分間隔
      persistChanges: true,
      enableRealTimeUpdates: true,
      conflictResolutionStrategy: 'timestamp_priority',
      ...config,
    };

    this.stats = {
      totalPositions: 0,
      activePositions: 0,
      closedPositions: 0,
      pendingPositions: 0,
      syncConflicts: 0,
      resolvedConflicts: 0,
      graphqlUpdates: 0,
      websocketUpdates: 0,
      averageProcessingTime: 0,
    };

    this.startSyncTimer();
  }

  /**
   * WebSocketからのポジション更新を処理
   */
  async updateFromWebSocket(position: SystemPosition): Promise<void> {
    const startTime = Date.now();

    try {
      const existingPosition = this.positions.get(position.id);
      
      // 競合チェック
      if (existingPosition && this.config.enableConflictResolution) {
        const conflict = this.detectConflict(position, existingPosition);
        if (conflict) {
          await this.handleConflict(conflict);
          return;
        }
      }

      // ポジション更新
      this.positions.set(position.id, position);
      this.updateStats(position);
      this.stats.websocketUpdates++;

      // リアルタイム更新の通知
      if (this.config.enableRealTimeUpdates) {
        this.emit('position_updated', position);
      }

      // GraphQL同期（必要に応じて）
      if (this.config.persistChanges) {
        await this.syncToGraphQL(position);
      }

      this.updateProcessingTime(Date.now() - startTime);

    } catch (error) {
      this.emit('error', {
        positionId: position.id,
        messageId: 'websocket_update',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        errorType: 'processing',
      } as PositionError);
    }
  }

  /**
   * GraphQLからのポジション更新を処理
   */
  async updateFromGraphQL(graphqlData: any): Promise<void> {
    const startTime = Date.now();

    try {
      const positionId = graphqlData.id;
      const existingPosition = this.positions.get(positionId);

      // WebSocketデータとの競合チェック
      if (existingPosition && this.config.enableConflictResolution) {
        const conflict = this.detectGraphQLConflict(existingPosition, graphqlData);
        if (conflict) {
          await this.handleConflict(conflict);
          return;
        }
      }

      // GraphQLデータをSystemPosition形式に変換
      const systemPosition = this.convertGraphQLToSystemPosition(graphqlData);
      
      this.positions.set(positionId, systemPosition);
      this.updateStats(systemPosition);
      this.stats.graphqlUpdates++;

      this.emit('position_updated', systemPosition);
      this.updateProcessingTime(Date.now() - startTime);

    } catch (error) {
      this.emit('error', {
        positionId: graphqlData.id || 'unknown',
        messageId: 'graphql_update',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        errorType: 'processing',
      } as PositionError);
    }
  }

  /**
   * ポジション競合の検出
   */
  private detectConflict(newPosition: SystemPosition, existingPosition: SystemPosition): PositionConflict | null {
    // データ不整合チェック
    if (this.hasDataMismatch(newPosition, existingPosition)) {
      return {
        positionId: newPosition.id,
        websocketData: newPosition,
        graphqlData: existingPosition,
        conflictType: 'data_mismatch',
        timestamp: Date.now(),
        resolved: false,
      };
    }

    // タイミング競合チェック
    if (this.hasTimingConflict(newPosition, existingPosition)) {
      return {
        positionId: newPosition.id,
        websocketData: newPosition,
        graphqlData: existingPosition,
        conflictType: 'timing_conflict',
        timestamp: Date.now(),
        resolved: false,
      };
    }

    // ステータス競合チェック
    if (newPosition.status !== existingPosition.status) {
      return {
        positionId: newPosition.id,
        websocketData: newPosition,
        graphqlData: existingPosition,
        conflictType: 'status_conflict',
        timestamp: Date.now(),
        resolved: false,
      };
    }

    return null;
  }

  /**
   * GraphQLとの競合検出
   */
  private detectGraphQLConflict(websocketPosition: SystemPosition, graphqlData: any): PositionConflict | null {
    // WebSocketデータの方が新しい場合は競合とみなす
    const graphqlTimestamp = new Date(graphqlData.updatedAt || graphqlData.lastUpdate).getTime();
    const websocketTimestamp = websocketPosition.lastUpdate.getTime();

    if (websocketTimestamp > graphqlTimestamp) {
      return {
        positionId: websocketPosition.id,
        websocketData: websocketPosition,
        graphqlData: graphqlData,
        conflictType: 'timing_conflict',
        timestamp: Date.now(),
        resolved: false,
      };
    }

    return null;
  }

  /**
   * データ不整合のチェック
   */
  private hasDataMismatch(pos1: SystemPosition, pos2: SystemPosition): boolean {
    const tolerance = 0.00001; // 価格の許容誤差

    return (
      Math.abs(pos1.currentPrice - pos2.currentPrice) > tolerance ||
      Math.abs(pos1.profit - pos2.profit) > tolerance ||
      pos1.lots !== pos2.lots
    );
  }

  /**
   * タイミング競合のチェック
   */
  private hasTimingConflict(pos1: SystemPosition, pos2: SystemPosition): boolean {
    const timeDiff = Math.abs(pos1.lastUpdate.getTime() - pos2.lastUpdate.getTime());
    return timeDiff < 1000; // 1秒以内の更新は競合とみなす
  }

  /**
   * 競合の解決
   */
  private async handleConflict(conflict: PositionConflict): Promise<void> {
    this.conflicts.set(conflict.positionId, conflict);
    this.stats.syncConflicts++;

    let resolvedPosition: SystemPosition;

    switch (this.config.conflictResolutionStrategy) {
      case 'websocket_priority':
        resolvedPosition = conflict.websocketData;
        conflict.resolution = 'websocket_won';
        break;

      case 'graphql_priority':
        resolvedPosition = this.convertGraphQLToSystemPosition(conflict.graphqlData);
        conflict.resolution = 'graphql_won';
        break;

      case 'timestamp_priority':
      default:
        // より新しいタイムスタンプを優先
        const wsTime = conflict.websocketData.lastUpdate.getTime();
        const gqlTime = typeof conflict.graphqlData.lastUpdate === 'string' 
          ? new Date(conflict.graphqlData.lastUpdate).getTime()
          : conflict.graphqlData.lastUpdate?.getTime() || 0;

        if (wsTime >= gqlTime) {
          resolvedPosition = conflict.websocketData;
          conflict.resolution = 'websocket_won';
        } else {
          resolvedPosition = this.convertGraphQLToSystemPosition(conflict.graphqlData);
          conflict.resolution = 'graphql_won';
        }
        break;
    }

    // 解決結果を適用
    this.positions.set(conflict.positionId, resolvedPosition);
    conflict.resolved = true;
    this.stats.resolvedConflicts++;

    this.emit('conflict_resolved', conflict);
    this.emit('position_updated', resolvedPosition);
  }

  /**
   * GraphQLデータをSystemPosition形式に変換
   */
  private convertGraphQLToSystemPosition(graphqlData: any): SystemPosition {
    return {
      id: graphqlData.id,
      accountId: graphqlData.accountId,
      symbol: graphqlData.symbol,
      type: graphqlData.type,
      lots: graphqlData.lots,
      openPrice: graphqlData.openPrice,
      currentPrice: graphqlData.currentPrice,
      profit: graphqlData.profit,
      profitRate: graphqlData.profitRate || 0,
      swapPoints: graphqlData.swapPoints || 0,
      commission: graphqlData.commission || 0,
      marginUsed: graphqlData.marginUsed || 0,
      marginRate: graphqlData.marginRate || 0,
      status: graphqlData.status,
      openTime: new Date(graphqlData.openTime),
      closeTime: graphqlData.closeTime ? new Date(graphqlData.closeTime) : undefined,
      lastUpdate: new Date(graphqlData.updatedAt || graphqlData.lastUpdate || Date.now()),
      rawData: graphqlData.rawData || {},
    };
  }

  /**
   * GraphQLへの同期
   */
  private async syncToGraphQL(position: SystemPosition): Promise<void> {
    try {
      // TODO: GraphQL mutationの実行
      this.emit('graphql_sync_required', position);
    } catch (error) {
      this.emit('sync_error', {
        positionId: position.id,
        error: error instanceof Error ? error.message : 'Unknown sync error',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 定期同期処理
   */
  private async performFullSync(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      conflictCount: 0,
      errorCount: 0,
      errors: [],
      conflicts: [],
      duration: 0,
    };

    try {
      // TODO: GraphQLから全ポジションを取得して同期
      this.emit('full_sync_required');
      
      result.syncedCount = this.positions.size;
      this.stats.lastSyncTimestamp = Date.now();
      
    } catch (error) {
      result.success = false;
      result.errorCount++;
      result.errors.push({
        positionId: 'sync',
        messageId: 'full_sync',
        error: error instanceof Error ? error.message : 'Unknown sync error',
        timestamp: Date.now(),
        errorType: 'processing',
      });
    }

    result.duration = Date.now() - startTime;
    this.emit('sync_completed', result);
    
    return result;
  }

  /**
   * 統計の更新
   */
  private updateStats(position: SystemPosition): void {
    this.stats.totalPositions = this.positions.size;
    
    // ステータス別カウント
    this.stats.activePositions = 0;
    this.stats.closedPositions = 0;
    this.stats.pendingPositions = 0;

    this.positions.forEach(pos => {
      switch (pos.status) {
        case 'open':
          this.stats.activePositions++;
          break;
        case 'closed':
          this.stats.closedPositions++;
          break;
        case 'pending':
          this.stats.pendingPositions++;
          break;
      }
    });
  }

  /**
   * 処理時間の統計更新
   */
  private updateProcessingTime(processingTime: number): void {
    this.processingTimes.push(processingTime);
    
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }

    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }

  /**
   * 同期タイマーの開始
   */
  private startSyncTimer(): void {
    if (this.config.enableSynchronization && this.config.syncInterval > 0) {
      this.syncTimer = setInterval(() => {
        this.performFullSync();
      }, this.config.syncInterval);
    }
  }

  /**
   * ポジション取得
   */
  getPosition(positionId: string): SystemPosition | undefined {
    return this.positions.get(positionId);
  }

  /**
   * 全ポジション取得
   */
  getAllPositions(): SystemPosition[] {
    const positions: SystemPosition[] = [];
    this.positions.forEach(position => positions.push(position));
    return positions;
  }

  /**
   * アクティブポジション取得
   */
  getActivePositions(): SystemPosition[] {
    const activePositions: SystemPosition[] = [];
    this.positions.forEach(position => {
      if (position.status === 'open') {
        activePositions.push(position);
      }
    });
    return activePositions;
  }

  /**
   * アカウント別ポジション取得
   */
  getPositionsByAccount(accountId: string): SystemPosition[] {
    const accountPositions: SystemPosition[] = [];
    this.positions.forEach(position => {
      if (position.accountId === accountId) {
        accountPositions.push(position);
      }
    });
    return accountPositions;
  }

  /**
   * 統計情報取得
   */
  getStats(): PositionManagerStats {
    return { ...this.stats };
  }

  /**
   * 競合情報取得
   */
  getConflicts(): PositionConflict[] {
    const conflicts: PositionConflict[] = [];
    this.conflicts.forEach(conflict => conflicts.push(conflict));
    return conflicts;
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<PositionManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 同期タイマーの再設定
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.startSyncTimer();
  }

  /**
   * 手動同期実行
   */
  async forcSync(): Promise<SyncResult> {
    return await this.performFullSync();
  }

  /**
   * リソースクリーンアップ
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    this.positions.clear();
    this.conflicts.clear();
    this.removeAllListeners();
  }
}

/**
 * グローバルインスタンス（シングルトン）
 */
export const positionManager = new PositionManager();