import { 
  Position, 
  PositionStatus, 
  Symbol, 
  ExecutionType, 
  CreatePositionInput, 
  UpdatePositionInput 
} from '@repo/shared-types';
import { 
  WSOpenCommand, 
  WSCloseCommand, 
  WSMessageType,
  WSOpenedEvent,
  WSClosedEvent,
  WSStoppedEvent 
} from './types';
import { amplifyClient, getCurrentUserId } from './amplify-client';
import { WebSocketHandler } from './websocket-server';
import { TrailEngine } from './trail-engine';
import { 
  positionService,
  createPosition,
  updatePosition,
  listUserPositions
} from '@repo/shared-amplify';

/**
 * Position Execution Engine - MVPシステム設計書準拠
 * ポジション管理・実行・サービス機能を統合
 * 
 * 主要機能：
 * 1. ポジション作成・実行管理
 * 2. userIdベース実行担当判定
 * 3. WebSocket経由のMT4/MT5制御
 * 4. トレール監視との連携
 * 5. GraphQL操作のヘルパー機能
 */
export class PositionExecutor {
  private wsHandler: WebSocketHandler;
  private trailEngine?: TrailEngine;
  private currentUserId?: string;

  constructor(wsHandler: WebSocketHandler, trailEngine?: TrailEngine) {
    this.wsHandler = wsHandler;
    this.trailEngine = trailEngine;
    this.initializeUserId();
  }

  // ========================================
  // 初期化・設定
  // ========================================

  /**
   * userId初期化
   */
  private async initializeUserId(): Promise<void> {
    try {
      this.currentUserId = await getCurrentUserId();
    } catch (error) {
      console.error('Failed to get current user ID:', error);
    }
  }

  /**
   * TrailEngine設定
   */
  setTrailEngine(trailEngine: TrailEngine): void {
    this.trailEngine = trailEngine;
  }

  // ========================================
  // ポジション作成・管理
  // ========================================

  /**
   * ポジション作成（トレール設定含む）
   * 設計書：管理画面からのポジション作成に対応
   */
  async createPosition(params: {
    accountId: string;
    symbol: Symbol;
    volume: number;
    executionType: ExecutionType;
    trailWidth?: number;
    triggerActionIds?: string; // JSON配列文字列
    memo?: string;
  }): Promise<Position> {
    
    const positionInput: CreatePositionInput = {
      userId: this.currentUserId!,
      accountId: params.accountId,
      symbol: params.symbol,
      volume: params.volume,
      executionType: params.executionType,
      status: PositionStatus.PENDING,
      trailWidth: params.trailWidth || 0,
      triggerActionIds: params.triggerActionIds,
      memo: params.memo
    };

    const result = await this.createPositionGraphQL(positionInput);
    return result.data;
  }

  /**
   * ポジション実行開始
   * 設計書：管理画面からの実行指示に対応
   */
  async executePosition(positionId: string): Promise<boolean> {
    try {
      await this.updatePositionStatus(positionId, PositionStatus.OPENING);
      return true;
    } catch (error) {
      console.error('Position execution failed:', error);
      await this.updatePositionStatus(positionId, PositionStatus.CANCELED);
      return false;
    }
  }

  // ========================================
  // Subscription処理（設計書準拠）
  // ========================================

  /**
   * Position Subscription処理
   * 設計書：userId基づく実行担当判定
   */
  async handlePositionSubscription(position: Position): Promise<void> {
    // 1. userIdベースの実行判定
    if (!this.currentUserId || position.userId !== this.currentUserId) {
      return; // 他ユーザーの担当はスキップ
    }
    
    // 2. ステータス別処理
    switch (position.status) {
      case PositionStatus.OPENING:
        await this.executeEntry(position);
        break;
      case PositionStatus.CLOSING:
        await this.executeExit(position);
        break;
      case PositionStatus.OPEN:
        await this.startTrailMonitoring(position);
        break;
    }
  }

  /**
   * エントリー実行（設計書準拠）
   */
  private async executeEntry(position: Position): Promise<void> {
    try {
      console.log(`🚀 Executing entry for position: ${position.id}`);
      
      const command = {
        type: WSMessageType.OPEN,
        accountId: position.accountId,
        positionId: position.id,
        symbol: position.symbol,
        side: this.determinePositionSide(position),
        volume: position.volume,
        trailWidth: position.trailWidth ?? 0,
        timestamp: new Date().toISOString(),
        metadata: {
          executionType: position.executionType,
          timestamp: new Date().toISOString()
        }
      } as unknown as WSOpenCommand;

      await this.sendWSCommand(command);
      console.log(`✅ Entry command sent for position: ${position.id}`);
      
    } catch (error) {
      console.error('Entry execution failed:', error);
      await this.updatePositionStatus(position.id, PositionStatus.CANCELED);
    }
  }

  /**
   * 決済実行
   */
  private async executeExit(position: Position): Promise<void> {
    try {
      console.log(`🔄 Executing exit for position: ${position.id}`);
      
      const command = {
        type: WSMessageType.CLOSE,
        accountId: position.accountId,
        positionId: position.id,
        symbol: position.symbol,
        side: this.getOppositePositionSide(position),
        volume: position.volume,
        timestamp: new Date().toISOString(),
        metadata: {
          executionType: ExecutionType.EXIT,
          timestamp: new Date().toISOString()
        }
      } as unknown as WSCloseCommand;

      await this.sendWSCommand(command);
      console.log(`✅ Exit command sent for position: ${position.id}`);
      
    } catch (error) {
      console.error('Exit execution failed:', error);
      await this.updatePositionStatus(position.id, PositionStatus.CANCELED);
    }
  }

  /**
   * トレール監視開始（設計書準拠）
   */
  async startTrailMonitoring(position: Position): Promise<void> {
    if (position.status === PositionStatus.OPEN && 
        position.trailWidth && 
        position.trailWidth > 0 && 
        this.trailEngine) {
      
      console.log(`📊 Starting trail monitoring for position: ${position.id}`);
      await this.trailEngine.addPositionMonitoring(position);
    }
  }

  // ========================================
  // WebSocket Event処理
  // ========================================

  /**
   * ポジション約定完了処理
   */
  async handlePositionOpened(event: WSOpenedEvent): Promise<void> {
    await this.updatePositionStatus(event.positionId, PositionStatus.OPEN, {
      mtTicket: event.mtTicket || event.orderId.toString(),
      entryPrice: event.price,
      entryTime: event.time
    });
    
    console.log(`✅ Position opened: ${event.positionId} at ${event.price}`);
  }

  /**
   * ポジション決済完了処理
   */
  async handlePositionClosed(event: WSClosedEvent): Promise<void> {
    await this.updatePositionStatus(event.positionId, PositionStatus.CLOSED, {
      exitPrice: event.price,
      exitTime: event.time,
      exitReason: 'MANUAL_CLOSE'
    });
    
    console.log(`✅ Position closed: ${event.positionId} at ${event.price}, profit: ${event.profit}`);
  }

  /**
   * ロスカット処理（設計書準拠）
   */
  async handlePositionStopped(event: WSStoppedEvent): Promise<void> {
    await this.updatePositionStatus(event.positionId, PositionStatus.STOPPED, {
      exitPrice: event.price,
      exitTime: event.time,
      exitReason: 'STOP_OUT'
    });

    // triggerActionIds実行（トレールエンジンに委譲）
    if (this.trailEngine) {
      await this.trailEngine.handleLossCut(event.positionId, event.price);
    }
    
    console.log(`💥 Position stopped: ${event.positionId} at ${event.price}, reason: ${event.reason}`);
  }

  // ========================================
  // Position Subscription管理
  // ========================================

  /**
   * Position Subscriptionの開始
   * 設計書：userIdベースのサブスクリプション
   */
  async subscribeToMyPositions(): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    const subscription = (amplifyClient as any).models?.Position?.observeQuery({
      filter: { userId: { eq: this.currentUserId } }
    })?.subscribe({
      next: (data: any) => {
        data?.items?.forEach((position: any) => {
          this.handlePositionSubscription(position);
        });
      },
      error: (error: any) => {
        console.error('Position subscription error:', error);
      }
    });
    
    console.log('📡 Position subscription started for user:', this.currentUserId);
  }

  // ========================================
  // 取得系メソッド
  // ========================================

  /**
   * オープンポジション一覧取得
   */
  async getOpenPositions(): Promise<Position[]> {
    const result = await this.listOpenPositions();
    return result.data.listPositions.items;
  }

  /**
   * トレール設定済みポジション一覧取得
   */
  async getTrailPositions(): Promise<Position[]> {
    const result = await this.listTrailPositions();
    return result.data.listPositions.items;
  }

  /**
   * 自分担当のポジション取得
   */
  async getMyPositions(status?: PositionStatus): Promise<Position[]> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    const result = await this.listOpenPositions();
    const allPositions = result.data.listPositions.items;
    
    return allPositions.filter((position: Position) => {
      return position.userId === this.currentUserId && 
             (!status || position.status === status);
    });
  }

  // ========================================
  // ヘルパーメソッド
  // ========================================

  /**
   * ポジション方向決定（簡易実装）
   */
  private determinePositionSide(position: Position): 'BUY' | 'SELL' {
    // MVPでは簡易的にENTRYは全てBUY、EXITは全てSELL
    return position.executionType === ExecutionType.ENTRY ? 'BUY' : 'SELL';
  }

  /**
   * 反対ポジション方向
   */
  private getOppositePositionSide(position: Position): 'BUY' | 'SELL' {
    return this.determinePositionSide(position) === 'BUY' ? 'SELL' : 'BUY';
  }

  /**
   * WebSocketコマンド送信
   */
  private async sendWSCommand(command: WSOpenCommand | WSCloseCommand): Promise<void> {
    console.log('📡 Sending WebSocket command:', command);
    
    // TODO: 実際のWebSocketハンドラーとの統合
    // await this.wsHandler.sendCommand(command.accountId, command);
  }

  // ========================================
  // GraphQL Service Methods（統合）
  // ========================================

  /**
   * ポジション作成（Amplify Gen2）
   */
  private async createPositionGraphQL(input: CreatePositionInput): Promise<{ data: Position }> {
    const result = await createPosition(input);
    return { data: result };
  }

  /**
   * ポジション状態更新（Amplify Gen2）
   */
  private async updatePositionStatus(id: string, status?: PositionStatus, additionalFields?: any): Promise<{ data: Position }> {
    const updateInput: any = { ...additionalFields };
    if (status) updateInput.status = status;
    
    const result = await updatePosition(id, updateInput);
    return { data: result };
  }

  /**
   * オープンポジション一覧取得（Amplify Gen2）
   */
  private async listOpenPositions(): Promise<{ data: { listPositions: { items: Position[] } } }> {
    const result = await listUserPositions({ status: 'OPEN' });
    return { 
      data: { 
        listPositions: { 
          items: result 
        } 
      } 
    };
  }

  /**
   * トレール設定済みポジション一覧取得（Amplify Gen2）
   */
  private async listTrailPositions(): Promise<{ data: { listPositions: { items: Position[] } } }> {
    const result = await listUserPositions({ hasTrail: true });
    return { 
      data: { 
        listPositions: { 
          items: result 
        } 
      } 
    };
  }

  // ========================================
  // 外部アクセス用メソッド
  // ========================================

  /**
   * 現在のユーザーID取得
   */
  getCurrentUserId(): string | undefined {
    return this.currentUserId;
  }

  /**
   * 統計情報取得
   */
  getStats() {
    return {
      currentUserId: this.currentUserId,
      isInitialized: !!this.currentUserId
    };
  }
}

// ========================================
// Static Service Methods（旧PositionService）
// ========================================

/**
 * Position Service - Amplify Gen2操作のヘルパー関数
 * shared-amplifyサービスへの統一されたアクセス
 */
export class PositionService {
  
  /**
   * ポジション作成
   */
  static async create(input: CreatePositionInput): Promise<{ data: Position }> {
    const result = await createPosition(input);
    return { data: result };
  }

  /**
   * ポジション状態更新
   */
  static async updateStatus(id: string, status?: PositionStatus, additionalFields?: any): Promise<{ data: Position }> {
    const updateInput: any = { ...additionalFields };
    if (status) updateInput.status = status;
    
    const result = await updatePosition(id, updateInput);
    return { data: result };
  }

  /**
   * オープンポジション一覧取得
   */
  static async listOpen(): Promise<{ data: { listPositions: { items: Position[] } } }> {
    const result = await listUserPositions({ status: 'OPEN' });
    return { 
      data: { 
        listPositions: { 
          items: result 
        } 
      } 
    };
  }

  /**
   * トレール設定済みポジション一覧取得
   */
  static async listTrailPositions(): Promise<{ data: { listPositions: { items: Position[] } } }> {
    const result = await listUserPositions({ hasTrail: true });
    return { 
      data: { 
        listPositions: { 
          items: result 
        } 
      } 
    };
  }
}