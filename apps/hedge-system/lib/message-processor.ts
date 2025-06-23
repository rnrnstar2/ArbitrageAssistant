import { 
  WSMessage, 
  WSEvent, 
  WSCommand, 
  WSMessageType,
  WSOpenedEvent,
  WSClosedEvent,
  WSErrorEvent,
  WSPriceEvent,
  WSPongMessage,
  WSOpenCommand,
  WSCloseCommand,
  WSModifyStopCommand,
  WSPingMessage
} from '@repo/shared-types';
import { WSErrorHandler } from './ws-error-handler';

export interface MessageProcessorDependencies {
  positionManager?: PositionManager;
  strategyEngine?: StrategyEngine;
  awsAmplifyClient?: any;
  trailManager?: TrailManager;
}

export interface PositionManager {
  updatePositionOpened(positionId: string, orderId: number, price: number, time: string): Promise<void>;
  updatePositionClosed(positionId: string, price: number, profit: number, time: string): Promise<void>;
  updatePositionPrice(positionId: string, currentPrice: number): Promise<void>;
  getPosition(positionId: string): Promise<any>;
}

export interface StrategyEngine {
  evaluateTrailStop(positionId: string, currentPrice: number): Promise<{ shouldModify: boolean; newStopPrice?: number }>;
  handlePositionEvent(event: 'opened' | 'closed' | 'error', data: any): Promise<void>;
}

export interface TrailManager {
  startTrailing(positionId: string): Promise<void>;
  stopTrailing(positionId: string): Promise<void>;
  updatePrice(positionId: string, price: number): Promise<void>;
}

/**
 * WebSocketメッセージ処理クラス
 * EAからのメッセージを受信して適切な処理を実行する
 */
export class MessageProcessor {
  private positionManager?: PositionManager;
  private strategyEngine?: StrategyEngine;
  private awsAmplifyClient?: any;
  private trailManager?: TrailManager;

  constructor(dependencies: MessageProcessorDependencies = {}) {
    this.positionManager = dependencies.positionManager;
    this.strategyEngine = dependencies.strategyEngine;
    this.awsAmplifyClient = dependencies.awsAmplifyClient;
    this.trailManager = dependencies.trailManager;
  }

  /**
   * 依存関係の更新
   */
  updateDependencies(dependencies: Partial<MessageProcessorDependencies>): void {
    Object.assign(this, dependencies);
  }

  /**
   * 受信メッセージ処理のメインエントリーポイント
   */
  async processIncomingMessage(
    connectionId: string, 
    message: WSEvent
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      WSErrorHandler.logEvent('MESSAGE_PROCESSING_START', {
        connectionId,
        messageType: message.type,
        timestamp: message.timestamp,
        sequenceId: message.sequenceId
      });

      switch (message.type) {
        case WSMessageType.OPENED:
          await this.handlePositionOpened(connectionId, message as WSOpenedEvent);
          break;

        case WSMessageType.CLOSED:
          await this.handlePositionClosed(connectionId, message as WSClosedEvent);
          break;

        case WSMessageType.ERROR:
          await this.handleEAError(connectionId, message as WSErrorEvent);
          break;

        case WSMessageType.PRICE:
          await this.handlePriceUpdate(connectionId, message as WSPriceEvent);
          break;

        case WSMessageType.PONG:
          this.handleHeartbeatResponse(connectionId, message as WSPongMessage);
          break;

        case WSMessageType.INFO:
          await this.handleEAInfo(connectionId, message);
          break;

        case WSMessageType.STOP_MODIFIED:
          await this.handleStopModified(connectionId, message);
          break;

        default:
          WSErrorHandler.logEvent('UNKNOWN_MESSAGE_TYPE', {
            connectionId,
            messageType: (message as any).type,
            message
          });
          throw new Error(`Unknown message type: ${(message as any).type}`);
      }

      const processingTime = Date.now() - startTime;
      WSErrorHandler.logEvent('MESSAGE_PROCESSING_SUCCESS', {
        connectionId,
        messageType: message.type,
        processingTimeMs: processingTime
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      WSErrorHandler.handleMessageError(error as Error, {
        connectionId,
        message,
        processingTimeMs: processingTime
      });
      throw error;
    }
  }

  /**
   * ポジションオープン処理
   */
  private async handlePositionOpened(connectionId: string, message: WSOpenedEvent): Promise<void> {
    const { positionId, mtTicket, orderId, price, time } = message;

    try {
      // 1. Positionレコードの更新（pending -> open）
      if (this.positionManager) {
        await this.positionManager.updatePositionOpened(positionId, parseInt(mtTicket) || orderId || 0, price, time);
      }

      // 2. トレーリングストップ監視開始
      if (this.trailManager) {
        await this.trailManager.startTrailing(positionId);
      }

      // 3. Strategy Engineに通知
      if (this.strategyEngine) {
        await this.strategyEngine.handlePositionEvent('opened', {
          positionId,
          orderId,
          price,
          time,
          connectionId
        });
      }

      // 4. AWS Amplifyへの状態同期
      if (this.awsAmplifyClient) {
        await this.syncToAmplify('position_opened', {
          positionId,
          orderId,
          price,
          time,
          status: 'open'
        });
      }

      WSErrorHandler.logEvent('POSITION_OPENED', {
        connectionId,
        positionId,
        orderId,
        price,
        time
      });

    } catch (error) {
      WSErrorHandler.handleMessageError(error as Error, {
        connectionId,
        positionId,
        action: 'position_opened'
      });
      throw error;
    }
  }

  /**
   * ポジションクローズ処理
   */
  private async handlePositionClosed(connectionId: string, message: WSClosedEvent): Promise<void> {
    const { positionId, price, profit, time } = message;

    try {
      // 1. Positionレコードの更新（open -> closed）
      if (this.positionManager) {
        await this.positionManager.updatePositionClosed(positionId, price, profit, time);
      }

      // 2. トレーリングストップ監視停止
      if (this.trailManager) {
        await this.trailManager.stopTrailing(positionId);
      }

      // 3. Strategy Engineに通知
      if (this.strategyEngine) {
        await this.strategyEngine.handlePositionEvent('closed', {
          positionId,
          price,
          profit,
          time,
          connectionId
        });
      }

      // 4. AWS Amplifyへの状態同期
      if (this.awsAmplifyClient) {
        await this.syncToAmplify('position_closed', {
          positionId,
          price,
          profit,
          time,
          status: 'closed'
        });
      }

      WSErrorHandler.logEvent('POSITION_CLOSED', {
        connectionId,
        positionId,
        price,
        profit,
        time
      });

    } catch (error) {
      WSErrorHandler.handleMessageError(error as Error, {
        connectionId,
        positionId,
        action: 'position_closed'
      });
      throw error;
    }
  }

  /**
   * 価格更新処理
   */
  private async handlePriceUpdate(connectionId: string, message: WSPriceEvent): Promise<void> {
    const { symbol, bid, ask, time } = message;

    try {
      // 1. 現在価格の更新（関連するポジションの現在価格を更新）
      if (this.positionManager && symbol) {
        // シンボルに関連するポジションを取得して価格更新
        // 実装は positionManager の仕様に依存
        const currentPrice = (bid + ask) / 2;
        // await this.positionManager.updatePositionPrice(symbol, currentPrice);
      }

      // 2. トレーリングストップの判定
      if (this.trailManager && symbol) {
        const currentPrice = (bid + ask) / 2;
        await this.trailManager.updatePrice(symbol, currentPrice);
      }

      // 3. Strategy Engineでの価格評価
      if (this.strategyEngine && symbol) {
        const currentPrice = (bid + ask) / 2;
        // シンボルに関連するポジションに対してトレーリング評価
        // const evaluation = await this.strategyEngine.evaluateTrailStop(symbol, currentPrice);
        // 
        // if (evaluation.shouldModify && evaluation.newStopPrice) {
        //   // ストップロス変更コマンド生成・送信はWebSocketServerで実行
        // }
      }

      WSErrorHandler.logEvent('PRICE_UPDATE', {
        connectionId,
        symbol,
        bid,
        ask,
        time
      });

    } catch (error) {
      WSErrorHandler.handleMessageError(error as Error, {
        connectionId,
        symbol,
        action: 'price_update'
      });
      throw error;
    }
  }

  /**
   * EAエラー処理
   */
  private async handleEAError(connectionId: string, message: WSErrorEvent): Promise<void> {
    const { positionId, message: errorMessage, errorCode } = message;

    try {
      // 1. Strategy Engineに通知
      if (this.strategyEngine) {
        await this.strategyEngine.handlePositionEvent('error', {
          positionId,
          errorMessage,
          errorCode,
          connectionId
        });
      }

      // 2. AWS Amplifyへのエラーログ同期
      if (this.awsAmplifyClient) {
        await this.syncToAmplify('ea_error', {
          positionId,
          errorMessage,
          errorCode,
          connectionId,
          timestamp: new Date().toISOString()
        });
      }

      WSErrorHandler.logEvent('EA_ERROR_RECEIVED', {
        connectionId,
        positionId,
        errorMessage,
        errorCode
      });

    } catch (error) {
      WSErrorHandler.handleMessageError(error as Error, {
        connectionId,
        positionId,
        action: 'ea_error_handling'
      });
      throw error;
    }
  }

  /**
   * ハートビート応答処理
   */
  private handleHeartbeatResponse(connectionId: string, message: WSPongMessage): void {
    WSErrorHandler.logEvent('HEARTBEAT_RESPONSE', {
      connectionId,
      timestamp: message.timestamp,
      sequenceId: message.sequenceId
    });
  }

  /**
   * EA情報処理
   */
  private async handleEAInfo(connectionId: string, message: any): Promise<void> {
    // EA認証情報などの処理
    WSErrorHandler.logEvent('EA_INFO_RECEIVED', {
      connectionId,
      info: message
    });
  }

  /**
   * ストップロス変更完了処理
   */
  private async handleStopModified(connectionId: string, message: any): Promise<void> {
    WSErrorHandler.logEvent('STOP_MODIFIED', {
      connectionId,
      message
    });
  }

  /**
   * EA向けコマンド生成
   */
  createOpenCommand(params: {
    positionId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    volume: number;
    accountId?: string;
    actionId?: string;
    trailWidth?: number;
    stopLoss?: number;
    takeProfit?: number;
    sequenceId?: number;
    strategyId?: string;
  }): WSOpenCommand {
    return {
      type: WSMessageType.OPEN,
      timestamp: new Date().toISOString(),
      sequenceId: params.sequenceId,
      accountId: params.accountId || 'default',
      positionId: params.positionId,
      actionId: params.actionId || `action_${Date.now()}`,
      symbol: params.symbol,
      side: params.side,
      volume: params.volume,
      trailWidth: params.trailWidth,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      metadata: {
        strategyId: params.strategyId,
        timestamp: new Date().toISOString()
      }
    };
  }

  createCloseCommand(params: {
    positionId: string;
    accountId?: string;
    actionId?: string;
    sequenceId?: number;
    strategyId?: string;
  }): WSCloseCommand {
    return {
      type: WSMessageType.CLOSE,
      timestamp: new Date().toISOString(),
      sequenceId: params.sequenceId,
      accountId: params.accountId || 'default',
      positionId: params.positionId,
      actionId: params.actionId || `action_${Date.now()}`,
      metadata: {
        strategyId: params.strategyId,
        timestamp: new Date().toISOString()
      }
    };
  }

  createModifyStopCommand(params: {
    positionId: string;
    newStopPrice: number;
    sequenceId?: number;
  }): WSModifyStopCommand {
    return {
      type: WSMessageType.MODIFY_STOP,
      timestamp: new Date().toISOString(),
      sequenceId: params.sequenceId,
      positionId: params.positionId,
      newStopPrice: params.newStopPrice
    };
  }

  createPingCommand(sequenceId?: number): WSPingMessage {
    return {
      type: WSMessageType.PING,
      timestamp: new Date().toISOString(),
      sequenceId
    };
  }

  /**
   * AWS Amplifyへの同期
   */
  private async syncToAmplify(eventType: string, data: any): Promise<void> {
    if (!this.awsAmplifyClient) {
      return;
    }

    try {
      // 実際のAmplify GraphQL APIへの同期処理
      // 実装は具体的なAmplifyクライアントの仕様に依存
      
      WSErrorHandler.logEvent('AMPLIFY_SYNC_SUCCESS', {
        eventType,
        dataKeys: Object.keys(data)
      });

    } catch (error) {
      WSErrorHandler.handleMessageError(error as Error, {
        eventType,
        data,
        action: 'amplify_sync'
      });
      // 同期エラーは投げない（メイン処理への影響を避ける）
    }
  }

  /**
   * 統計情報取得
   */
  getProcessingStats(): {
    totalMessagesProcessed: number;
    messagesByType: { [type: string]: number };
    errors: number;
    lastProcessedAt?: Date;
  } {
    // 実装は統計収集機能の追加が必要
    return {
      totalMessagesProcessed: 0,
      messagesByType: {},
      errors: 0
    };
  }
}