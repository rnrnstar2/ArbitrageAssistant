import { Position, PositionStatus, Symbol, ExecutionType, CreatePositionInput, WSOpenCommand, WSMessageType } from './types';
import { PositionService } from './position-service.js';
import { amplifyClient, getCurrentUserId } from './amplify-client';
import { WebSocketHandler } from './websocket-handler';
import { trailEngine } from './trail-engine';

/**
 * Position Manager - Position中心のCore機能実装
 * MVPシステム設計書に基づく核心機能
 */
export class PositionManager {
  private amplifyClient = amplifyClient;
  private wsHandler: WebSocketHandler;
  private currentUserId?: string;
  
  constructor() {
    this.wsHandler = new WebSocketHandler();
    this.initializeUserId();
  }

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
   * Position Subscription処理（設計書準拠）
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
      // EA命令送信
      const result = await this.wsHandler.sendOpenCommand({
        accountId: position.accountId,
        positionId: position.id,
        symbol: position.symbol,
        volume: position.volume,
        executionType: position.executionType
      });
      
      // 結果更新
      await this.updatePositionResult(position.id, result);
    } catch (error) {
      console.error('Entry execution failed:', error);
      // 失敗時はCANCELEDに
      await this.updatePositionStatus(position.id, PositionStatus.CANCELED);
    }
  }

  /**
   * 決済実行
   */
  private async executeExit(position: Position): Promise<void> {
    try {
      // EA決済命令送信
      await this.wsHandler.sendCloseCommand({
        accountId: position.accountId,
        positionId: position.id
      });
      
    } catch (error) {
      console.error('Exit execution failed:', error);
      await this.updatePositionStatus(position.id, PositionStatus.CANCELED);
    }
  }

  /**
   * トレール監視開始（設計書準拠）
   */
  async startTrailMonitoring(position: Position): Promise<void> {
    if (position.status === PositionStatus.OPEN && position.trailWidth && position.trailWidth > 0) {
      // TrailEngineに監視依頼
      trailEngine.addTrailPosition(position);
    }
  }

  /**
   * ポジション作成（トレール設定含む）
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
      accountId: params.accountId,
      symbol: params.symbol,
      volume: params.volume,
      executionType: params.executionType,
      status: PositionStatus.PENDING,
      trailWidth: params.trailWidth || 0,
      triggerActionIds: params.triggerActionIds,
      memo: params.memo
    };

    const result = await PositionService.create(positionInput);
    return result.data.createPosition;
  }

  /**
   * ポジション実行開始
   */
  async executePosition(positionId: string): Promise<boolean> {
    try {
      await PositionService.updateStatus(positionId, PositionStatus.OPENING);
      return true;
    } catch (error) {
      console.error('Position execution failed:', error);
      await PositionService.updateStatus(positionId, PositionStatus.CANCELED);
      return false;
    }
  }

  /**
   * ポジション約定完了処理
   */
  async positionOpened(params: {
    positionId: string;
    mtTicket: string;
    entryPrice: number;
    entryTime: string;
  }): Promise<void> {
    await PositionService.updateStatus(params.positionId, PositionStatus.OPEN, {
      mtTicket: params.mtTicket,
      entryPrice: params.entryPrice,
      entryTime: params.entryTime
    });
  }

  /**
   * ポジション決済完了処理
   */
  async positionClosed(params: {
    positionId: string;
    exitPrice: number;
    exitTime: string;
    exitReason?: string;
  }): Promise<void> {
    await PositionService.updateStatus(params.positionId, PositionStatus.CLOSED, {
      exitPrice: params.exitPrice,
      exitTime: params.exitTime,
      exitReason: params.exitReason
    });
  }

  /**
   * ロスカット処理
   */
  async positionStopped(params: {
    positionId: string;
    exitPrice: number;
    exitTime: string;
  }): Promise<void> {
    await PositionService.updateStatus(params.positionId, PositionStatus.STOPPED, {
      exitPrice: params.exitPrice,
      exitTime: params.exitTime,
      exitReason: 'STOP_OUT'
    });

    // triggerActionIds実行（トレールエンジンに委譲）
    await this.triggerStopOutActions(params.positionId);
  }

  /**
   * オープンポジション一覧取得
   */
  async getOpenPositions(): Promise<Position[]> {
    const result = await PositionService.listOpen();
    return result.data.listPositions.items;
  }

  /**
   * トレール設定済みポジション一覧取得
   */
  async getTrailPositions(): Promise<Position[]> {
    const result = await PositionService.listTrailPositions();
    return result.data.listPositions.items;
  }

  /**
   * ロスカット時のアクション実行（トレールエンジンと連携）
   */
  private async triggerStopOutActions(positionId: string): Promise<void> {
    // 実装はtrail-engineで行う
    await trailEngine.triggerStopOutActions(positionId);
  }

  /**
   * ポジション結果更新
   */
  private async updatePositionResult(positionId: string, result: any): Promise<void> {
    // 実装: ポジション結果を更新
    console.log(`Position result updated: ${positionId}`, result);
  }

  /**
   * ポジション状態更新
   */
  private async updatePositionStatus(positionId: string, status: PositionStatus): Promise<void> {
    await PositionService.updateStatus(positionId, status);
  }

  /**
   * 自分担当のポジション取得
   */
  async getMyPositions(status?: PositionStatus): Promise<Position[]> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    // userIdフィルタリングを実装
    const result = await PositionService.listOpen();
    const allPositions = result.data.listPositions.items;
    
    return allPositions.filter((position: Position) => {
      return position.userId === this.currentUserId && 
             (!status || position.status === status);
    });
  }

  /**
   * Position Subscriptionの開始
   */
  async subscribeToMyPositions(): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    // userIdベースのサブスクリプション
    const subscription = this.amplifyClient.models.Position.observeQuery({
      filter: { userId: { eq: this.currentUserId } }
    }).subscribe({
      next: (data) => {
        data.items.forEach(position => {
          this.handlePositionSubscription(position);
        });
      },
      error: (error) => {
        console.error('Position subscription error:', error);
      }
    });
    
    console.log('Position subscription started for user:', this.currentUserId);
  }
}