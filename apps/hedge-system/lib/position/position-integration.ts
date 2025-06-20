import { 
  type PositionDataReceiver, 
  type SystemPosition, 
  type PositionError 
} from '../websocket/position-receiver';
import { type PositionManager } from './position-manager';
import { positionManager } from './position-manager';
import { positionDataReceiver } from '../websocket/position-receiver';

/**
 * ポジション統合設定
 */
export interface PositionIntegrationConfig {
  enableWebSocketReceiver?: boolean;
  enableGraphQLSync?: boolean;
  conflictResolutionStrategy?: 'websocket_priority' | 'graphql_priority' | 'timestamp_priority';
  autoSyncToGraphQL?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * ポジション統合状態
 */
export interface PositionIntegrationState {
  isConnected: boolean;
  receiverStats: any;
  managerStats: any;
  lastError?: PositionError;
  syncStatus: 'idle' | 'syncing' | 'error';
}

/**
 * WebSocketポジション受信とGraphQL同期を統合する処理
 */
export class PositionIntegration {
  private config: Required<PositionIntegrationConfig>;
  private receiver: PositionDataReceiver;
  private manager: PositionManager;
  private graphqlMutationQueue: Array<{ position: SystemPosition; retryCount: number }> = [];
  private isProcessingQueue = false;

  constructor(
    config: PositionIntegrationConfig = {},
    receiver?: PositionDataReceiver,
    manager?: PositionManager
  ) {
    this.config = {
      enableWebSocketReceiver: true,
      enableGraphQLSync: true,
      conflictResolutionStrategy: 'timestamp_priority',
      autoSyncToGraphQL: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };

    this.receiver = receiver || positionDataReceiver;
    this.manager = manager || positionManager;

    this.setupEventHandlers();
  }

  /**
   * イベントハンドラーの設定
   */
  private setupEventHandlers(): void {
    // WebSocket受信イベント
    this.receiver.on('position_updated', (position: SystemPosition) => {
      this.handleWebSocketPositionUpdate(position);
    });

    this.receiver.on('error', (error: PositionError) => {
      console.error('Position receiver error:', error);
    });

    // ポジションマネージャーイベント
    this.manager.on('position_updated', (position: SystemPosition) => {
      if (this.config.autoSyncToGraphQL) {
        this.queueGraphQLSync(position);
      }
    });

    this.manager.on('conflict_resolved', (conflict: any) => {
      console.log('Position conflict resolved:', conflict);
    });

    this.manager.on('graphql_sync_required', (position: SystemPosition) => {
      this.queueGraphQLSync(position);
    });

    this.manager.on('full_sync_required', () => {
      this.performFullGraphQLSync();
    });
  }

  /**
   * WebSocketポジション更新の処理
   */
  private async handleWebSocketPositionUpdate(position: SystemPosition): Promise<void> {
    try {
      // ポジションマネージャーで管理
      await this.manager.updateFromWebSocket(position);
    } catch (error) {
      console.error('Failed to handle WebSocket position update:', error);
    }
  }

  /**
   * GraphQL同期をキューに追加
   */
  private queueGraphQLSync(position: SystemPosition): void {
    if (!this.config.enableGraphQLSync) return;

    // 既存のキューから同じポジションを削除（最新の情報で更新）
    this.graphqlMutationQueue = this.graphqlMutationQueue.filter(
      item => item.position.id !== position.id
    );

    // 新しいエントリを追加
    this.graphqlMutationQueue.push({
      position: { ...position },
      retryCount: 0,
    });

    // キューの処理を開始
    this.processGraphQLQueue();
  }

  /**
   * GraphQL同期キューの処理
   */
  private async processGraphQLQueue(): Promise<void> {
    if (this.isProcessingQueue || this.graphqlMutationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.graphqlMutationQueue.length > 0) {
        const item = this.graphqlMutationQueue.shift();
        if (!item) continue;

        try {
          await this.syncPositionToGraphQL(item.position);
        } catch (error) {
          console.error('GraphQL sync failed for position:', item.position.id, error);
          
          // リトライ処理
          if (item.retryCount < this.config.maxRetries) {
            item.retryCount++;
            setTimeout(() => {
              this.graphqlMutationQueue.push(item);
              this.processGraphQLQueue();
            }, this.config.retryDelay * Math.pow(2, item.retryCount));
          } else {
            console.error('Max retries exceeded for position:', item.position.id);
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * ポジションをGraphQLに同期
   */
  private async syncPositionToGraphQL(position: SystemPosition): Promise<void> {
    try {
      // ポジションの状態に応じてGraphQL操作を選択
      if (position.status === 'open') {
        await this.createOrUpdatePosition(position);
      } else if (position.status === 'closed') {
        await this.updatePositionStatus(position);
      }
    } catch (error) {
      throw new Error(`GraphQL sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ポジションの作成または更新
   */
  private async createOrUpdatePosition(position: SystemPosition): Promise<void> {
    try {
      // まず既存のポジションを確認
      const existingPosition = await this.fetchPositionFromGraphQL(position.id);

      if (existingPosition) {
        // 更新
        await this.updatePositionInGraphQL(position);
      } else {
        // 新規作成
        await this.createPositionInGraphQL(position);
      }
    } catch (error) {
      console.error('Failed to create or update position in GraphQL:', error);
      throw error;
    }
  }

  /**
   * GraphQLからポジションを取得
   */
  private async fetchPositionFromGraphQL(positionId: string): Promise<any> {
    try {
      // TODO: GraphQL getPosition クエリを実装
      // AWS Amplify GraphQL クライアントを使用
      console.log('Fetching position from GraphQL:', positionId);
      return null; // プレースホルダー
    } catch (error) {
      console.error('Failed to fetch position from GraphQL:', error);
      return null;
    }
  }

  /**
   * GraphQLでポジションを作成
   */
  private async createPositionInGraphQL(position: SystemPosition): Promise<void> {
    try {
      // TODO: GraphQL createPosition ミューテーションを実装
      // const input = this.convertSystemPositionToGraphQLInput(position);
      // await client.graphql({
      //   query: createPosition,
      //   variables: { input }
      // });
      console.log('Creating position in GraphQL:', position.id);
    } catch (error) {
      console.error('Failed to create position in GraphQL:', error);
      throw error;
    }
  }

  /**
   * GraphQLでポジションを更新
   */
  private async updatePositionInGraphQL(position: SystemPosition): Promise<void> {
    try {
      // TODO: GraphQL updatePosition ミューテーションを実装
      // const input = this.convertSystemPositionToGraphQLInput(position);
      // await client.graphql({
      //   query: updatePosition,
      //   variables: { 
      //     input: {
      //       id: position.id,
      //       ...input
      //     }
      //   }
      // });
      console.log('Updating position in GraphQL:', position.id);
    } catch (error) {
      console.error('Failed to update position in GraphQL:', error);
      throw error;
    }
  }

  /**
   * ポジションステータスの更新
   */
  private async updatePositionStatus(position: SystemPosition): Promise<void> {
    try {
      // TODO: GraphQL updatePosition ミューテーションでステータスのみ更新
      console.log('Updating position status in GraphQL:', position.id, position.status);
    } catch (error) {
      console.error('Failed to update position status in GraphQL:', error);
      throw error;
    }
  }

  /**
   * SystemPositionをGraphQL入力形式に変換
   */
  private convertSystemPositionToGraphQLInput(position: SystemPosition): any {
    return {
      accountId: position.accountId,
      symbol: position.symbol,
      type: position.type,
      lots: position.lots,
      openPrice: position.openPrice,
      currentPrice: position.currentPrice,
      profit: position.profit,
      profitRate: position.profitRate,
      swapPoints: position.swapPoints,
      commission: position.commission,
      marginUsed: position.marginUsed,
      marginRate: position.marginRate,
      status: position.status,
      openTime: position.openTime.toISOString(),
      closeTime: position.closeTime?.toISOString(),
      lastUpdate: position.lastUpdate.toISOString(),
      rawData: JSON.stringify(position.rawData),
    };
  }

  /**
   * フル同期の実行
   */
  private async performFullGraphQLSync(): Promise<void> {
    try {
      console.log('Performing full GraphQL sync...');
      
      // 全ポジションを取得してGraphQLと同期
      const allPositions = this.manager.getAllPositions();
      
      for (const position of allPositions) {
        this.queueGraphQLSync(position);
      }
      
      console.log(`Queued ${allPositions.length} positions for GraphQL sync`);
    } catch (error) {
      console.error('Full GraphQL sync failed:', error);
    }
  }

  /**
   * 統合の開始
   */
  start(): void {
    if (this.config.enableWebSocketReceiver) {
      console.log('Position integration started');
    }
  }

  /**
   * 統合の停止
   */
  stop(): void {
    this.receiver.removeAllListeners();
    this.manager.removeAllListeners();
    this.graphqlMutationQueue = [];
    this.isProcessingQueue = false;
    console.log('Position integration stopped');
  }

  /**
   * 統計情報の取得
   */
  getStats(): PositionIntegrationState {
    return {
      isConnected: true,
      receiverStats: this.receiver.getStats(),
      managerStats: this.manager.getStats(),
      syncStatus: this.isProcessingQueue ? 'syncing' : 'idle',
    };
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: Partial<PositionIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // マネージャーの設定も更新
    this.manager.updateConfig({
      conflictResolutionStrategy: this.config.conflictResolutionStrategy,
    });
  }
}

/**
 * ポジション統合の簡単な初期化関数
 */
export function createPositionIntegration(config?: PositionIntegrationConfig): PositionIntegration {
  return new PositionIntegration(config);
}

/**
 * グローバルインスタンス
 */
export const positionIntegration = new PositionIntegration();