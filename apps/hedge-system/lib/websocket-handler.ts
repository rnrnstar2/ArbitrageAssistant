import { RealtimeStateManager } from './realtime-state-manager';
import { HedgeWebSocketServer, WSServerConfig } from './websocket-server';
import { MessageProcessor, MessageProcessorDependencies } from './message-processor';
import { loadConfig } from './websocket-config';
import { WSErrorHandler } from './ws-error-handler';
import { 
  WSMessage, 
  WSEvent, 
  WSCommand, 
  WSMessageType,
  WSOpenedEvent,
  WSClosedEvent,
  WSStoppedEvent,
  WSErrorEvent,
  WSPriceEvent,
  WSPongMessage,
  WSOpenCommand,
  WSCloseCommand,
  WSModifyStopCommand 
} from '@repo/shared-types';
import type { RealtimePosition, RealtimeAccount } from '@repo/shared-types';

/**
 * 統合WebSocketハンドラー
 * 新しいWebSocketサーバーと既存のRealtimeStateManagerを統合
 */
export class WebSocketHandler {
  private stateManager: RealtimeStateManager;
  private wsServer?: HedgeWebSocketServer;
  private messageProcessor: MessageProcessor;
  private isInitialized = false;
  
  // 統計
  private messageStats = {
    received: 0,
    processed: 0,
    errors: 0,
    lastMessage: new Date()
  };
  
  constructor(stateManager: RealtimeStateManager) {
    this.stateManager = stateManager;
    
    // MessageProcessorに依存関係を注入
    const dependencies: MessageProcessorDependencies = {
      positionManager: this.createPositionManager(),
      // strategyEngine と awsAmplifyClient は必要に応じて後で注入
    };
    
    this.messageProcessor = new MessageProcessor(dependencies);
  }
  
  /**
   * エントリー実行シーケンス（設計書準拠）
   */
  async executeEntrySequence(action: any): Promise<void> {
    // 1. 口座確認・実行判定
    if (!this.isAccountAssigned(action.accountId)) {
      return;
    }

    // 2. OPEN命令送信（トレール幅含む）
    const command: WSOpenCommand = {
      type: WSMessageType.OPEN,
      timestamp: new Date().toISOString(),
      accountId: action.accountId,
      positionId: action.positionId,
      actionId: action.id,
      symbol: action.parameters.symbol,
      side: action.parameters.side,
      volume: action.parameters.volume,
      trailWidth: action.trailWidth,
      metadata: {
        strategyId: action.strategyId,
        timestamp: new Date().toISOString()
      }
    };

    await this.sendCommand(action.accountId, command);
  }

  /**
   * OPENED イベント処理（設計書準拠）
   */
  private async handleOpenedEvent(event: WSOpenedEvent): Promise<void> {
    // 1. Position更新（mtTicket設定）
    await this.updatePosition(event.positionId, {
      status: 'OPEN',
      mtTicket: event.mtTicket,
      entryPrice: event.price,
      entryTime: new Date(event.time)
    });

    // 2. Action完了
    await this.updateAction(event.actionId, {
      status: 'EXECUTED',
      result: {
        mtTicket: event.mtTicket,
        price: event.price,
        time: event.time
      }
    });
  }

  /**
   * ロスカット処理（設計書3-3準拠）
   */
  private async handleStoppedEvent(event: WSStoppedEvent): Promise<void> {
    // 1. Position状態更新
    await this.updatePosition(event.positionId, {
      status: 'STOPPED',
      exitPrice: event.price,
      exitTime: new Date(event.time),
      exitReason: event.reason
    });

    // 2. トレール設定確認
    const position = await this.getPosition(event.positionId);
    if (position && position.trailWidth && position.trailWidth > 0) {
      // 3. トレール実行Action作成
      await this.createTrailAction(position, event.price);
    }
  }

  /**
   * 口座割当確認
   */
  private isAccountAssigned(accountId: string): boolean {
    // 実装: 口座が現在のインスタンスに割り当てられているかチェック
    return true; // 実装待ち
  }

  /**
   * コマンド送信
   */
  private async sendCommand(accountId: string, command: WSCommand): Promise<void> {
    const connectionId = this.getConnectionIdFromAccount(accountId);
    if (connectionId && this.wsServer) {
      await this.wsServer.sendCommand(connectionId, command);
    }
  }

  /**
   * Position更新
   */
  private async updatePosition(positionId: string, updates: any): Promise<void> {
    // 実装: Position更新ロジック
    console.log(`📊 Position updated: ${positionId}`, updates);
  }

  /**
   * Action更新
   */
  private async updateAction(actionId: string, updates: any): Promise<void> {
    // 実装: Action更新ロジック
    console.log(`🎯 Action updated: ${actionId}`, updates);
  }

  /**
   * Position取得
   */
  private async getPosition(positionId: string): Promise<any> {
    // 実装: Position取得ロジック
    return null; // 実装待ち
  }

  /**
   * トレールAction作成
   */
  private async createTrailAction(position: any, currentPrice: number): Promise<void> {
    // 実装: トレールAction作成ロジック
    console.log(`🔄 Trail action created for position: ${position.id} at price: ${currentPrice}`);
  }

  /**
   * WebSocketサーバー初期化
   */
  async initializeServer(port: number = 8080): Promise<void> {
    try {
      const config = loadConfig();
      
      const wsConfig: WSServerConfig = {
        port,
        host: config.websocket.host,
        authToken: config.websocket.authToken,
        maxConnections: config.websocket.maxConnections,
        heartbeatInterval: config.websocket.heartbeatInterval,
        connectionTimeout: config.websocket.connectionTimeout
      };

      this.wsServer = new HedgeWebSocketServer(wsConfig, this.messageProcessor);
      
      // カスタムメッセージ処理ハンドラーを設定
      this.setupMessageProcessorCallbacks();
      
      await this.wsServer.start();
      this.isInitialized = true;
      
      WSErrorHandler.logEvent('WEBSOCKET_HANDLER_INITIALIZED', { port });
      console.log(`🚀 WebSocket server started on port ${port}`);
      
    } catch (error) {
      WSErrorHandler.handleCriticalError(error as Error, {
        action: 'websocket_handler_initialize',
        port
      });
      throw error;
    }
  }

  /**
   * MessageProcessorにカスタムコールバックを設定
   */
  private setupMessageProcessorCallbacks(): void {
    // MessageProcessorの依存関係を更新
    this.messageProcessor.updateDependencies({
      positionManager: this.createPositionManager(),
      strategyEngine: this.createStrategyEngine(),
      // awsAmplifyClient: クライアント実装時に追加
    });
  }

  /**
   * PositionManager適合オブジェクトを作成
   */
  private createPositionManager() {
    return {
      updatePositionOpened: async (positionId: string, orderId: number, price: number, time: string) => {
        // RealtimeStateManagerと連携したポジション更新
        const position: Omit<RealtimePosition, 'lastUpdate' | 'isStale'> = {
          id: positionId,
          accountId: this.extractAccountFromPositionId(positionId),
          symbol: this.extractSymbolFromPositionId(positionId),
          type: 'buy', // EA からのデータで判定
          volume: 1.0, // EA からのデータで取得
          openPrice: price,
          currentPrice: price,
          profit: 0,
          openTime: new Date(time)
        };
        
        this.stateManager.updatePositionFromWebSocket(position);
        console.log(`📊 Position opened: ${positionId} @ ${price}`);
      },

      updatePositionClosed: async (positionId: string, price: number, profit: number, time: string) => {
        // ポジションクローズ処理
        console.log(`📊 Position closed: ${positionId} @ ${price}, profit: ${profit}`);
        // 必要に応じてRealtimeStateManagerでポジションステータスを更新
      },

      updatePositionPrice: async (positionId: string, currentPrice: number) => {
        // 現在価格更新
        const accountId = this.extractAccountFromPositionId(positionId);
        // RealtimeStateManagerで価格更新
      },

      getPosition: async (positionId: string) => {
        // ポジション取得（実装が必要な場合）
        return null;
      }
    };
  }

  /**
   * StrategyEngine適合オブジェクトを作成
   */
  private createStrategyEngine() {
    return {
      evaluateTrailStop: async (positionId: string, currentPrice: number) => {
        // トレーリングストップ評価ロジック
        return { shouldModify: false };
      },

      handlePositionEvent: async (event: 'opened' | 'closed' | 'error', data: any) => {
        // ポジションイベント処理
        console.log(`🎯 Position event: ${event}`, data);
        
        // RealtimeStateManagerと連携
        if (event === 'opened' || event === 'closed') {
          this.updateMessageStats();
        }
      }
    };
  }

  /**
   * 従来互換のメッセージ処理（レガシーメッセージフォーマット用）
   */
  async handleMessage(rawMessage: string, clientId: string): Promise<void> {
    this.messageStats.received++;
    this.messageStats.lastMessage = new Date();
    
    try {
      const message = JSON.parse(rawMessage);
      
      // 設計書準拠のメッセージ処理
      if (this.isDesignCompliantMessage(message)) {
        await this.handleDesignCompliantMessage(message);
      } else {
        // レガシーメッセージを新フォーマットに変換
        const wsEvent = this.convertLegacyMessage(message);
        
        if (wsEvent) {
          // 新しいMessageProcessorで処理
          this.messageProcessor.processIncomingMessage(clientId, wsEvent);
        } else {
          // 従来のメッセージ処理
          this.handleLegacyMessage(message, clientId);
        }
      }
      
      this.messageStats.processed++;
      
    } catch (error) {
      console.error('❌ Failed to process WebSocket message:', error);
      this.messageStats.errors++;
      WSErrorHandler.handleMessageError(error as Error, { clientId, rawMessage });
    }
  }

  /**
   * 設計書準拠メッセージかどうかの判定
   */
  private isDesignCompliantMessage(message: any): boolean {
    return (
      message.type && 
      message.accountId && 
      message.timestamp &&
      (message.actionId || message.positionId)
    );
  }

  /**
   * 設計書準拠メッセージ処理
   */
  private async handleDesignCompliantMessage(message: WSEvent): Promise<void> {
    switch (message.type) {
      case WSMessageType.OPENED:
        await this.handleOpenedEvent(message as WSOpenedEvent);
        break;
      case WSMessageType.CLOSED:
        await this.handleClosedEvent(message as WSClosedEvent);
        break;
      case WSMessageType.STOPPED:
        await this.handleStoppedEvent(message as WSStoppedEvent);
        break;
      case WSMessageType.ERROR:
        await this.handleErrorEvent(message as WSErrorEvent);
        break;
      default:
        console.warn(`⚠️ Unknown design compliant message type: ${message.type}`);
    }
  }

  /**
   * CLOSED イベント処理（設計書準拠）
   */
  private async handleClosedEvent(event: WSClosedEvent): Promise<void> {
    // 1. Position状態更新
    await this.updatePosition(event.positionId, {
      status: 'CLOSED',
      exitPrice: event.price,
      profit: event.profit,
      exitTime: new Date(event.time)
    });

    // 2. Action完了
    await this.updateAction(event.actionId, {
      status: 'EXECUTED',
      result: {
        mtTicket: event.mtTicket,
        price: event.price,
        profit: event.profit,
        time: event.time
      }
    });
  }

  /**
   * ERROR イベント処理（設計書準拠）
   */
  private async handleErrorEvent(event: WSErrorEvent): Promise<void> {
    // エラーハンドラーに委譲
    await WSErrorHandler.handleError(event, {
      positionId: event.positionId,
      message: event.message,
      errorCode: event.errorCode
    });
  }

  /**
   * レガシーメッセージを新フォーマットに変換
   */
  private convertLegacyMessage(legacyMessage: any): WSEvent | null {
    switch (legacyMessage.type) {
      case 'position_update':
        if (legacyMessage.data?.id) {
          return {
            type: WSMessageType.OPENED,
            timestamp: legacyMessage.timestamp || new Date().toISOString(),
            positionId: legacyMessage.data.id,
            orderId: legacyMessage.data.orderId || 0,
            price: legacyMessage.data.openPrice || legacyMessage.data.currentPrice,
            time: legacyMessage.data.openTime || new Date().toISOString()
          } as WSOpenedEvent;
        }
        break;
        
      case 'heartbeat':
        return {
          type: WSMessageType.PONG,
          timestamp: legacyMessage.timestamp || new Date().toISOString()
        } as WSPongMessage;
        
      default:
        return null;
    }
    
    return null;
  }

  /**
   * レガシーメッセージ処理
   */
  private handleLegacyMessage(message: any, clientId: string): void {
    const { accountId } = message;

    switch (message.type) {
      case 'position_update':
        this.handlePositionUpdate(message);
        break;
        
      case 'account_update':
        this.handleAccountUpdate(message);
        break;
        
      case 'heartbeat':
        this.handleHeartbeat(message, clientId);
        break;
        
      case 'connection_status':
        this.handleConnectionStatus(message);
        break;
        
      case 'trade_execution':
        this.handleTradeExecution(message);
        break;
        
      default:
        console.warn(`⚠️ Unknown legacy message type: ${message.type}`);
    }
  }

  /**
   * レガシーメッセージハンドラー（従来互換）
   */
  private handlePositionUpdate(message: any): void {
    const { accountId, data } = message;
    
    const position: Omit<RealtimePosition, 'lastUpdate' | 'isStale'> = {
      id: data.id,
      accountId,
      symbol: data.symbol,
      type: data.type,
      volume: data.volume,
      openPrice: data.openPrice,
      currentPrice: data.currentPrice,
      profit: data.profit,
      openTime: new Date(data.openTime)
    };
    
    this.stateManager.updatePositionFromWebSocket(position);
    console.log(`📊 Position update processed: ${data.symbol} (${accountId})`);
  }
  
  private handleAccountUpdate(message: any): void {
    const { accountId, data } = message;
    
    const account: Omit<RealtimeAccount, 'lastUpdate' | 'positions'> = {
      id: accountId,
      balance: data.balance,
      equity: data.equity,
      margin: data.margin,
      freeMargin: data.freeMargin,
      marginLevel: data.marginLevel,
      connectionStatus: 'connected'
    };
    
    this.stateManager.updateAccountFromWebSocket(account);
    console.log(`💰 Account update processed: ${accountId}`);
  }
  
  private handleHeartbeat(message: any, clientId: string): void {
    const { accountId } = message;
    
    this.stateManager.updateMT4Connection(accountId, 'connected');
    console.log(`💓 Heartbeat received from ${accountId}`);
  }
  
  private handleConnectionStatus(message: any): void {
    const { accountId, data } = message;
    
    this.stateManager.updateMT4Connection(accountId, data.status, data.endpoint);
    console.log(`🔗 Connection status updated: ${accountId} - ${data.status}`);
  }
  
  private handleTradeExecution(message: any): void {
    const { accountId, data } = message;
    
    if (data.success) {
      console.log(`✅ Trade executed successfully: ${data.symbol} ${data.type} ${data.volume} @ ${data.executionPrice}`);
    } else {
      console.error(`❌ Trade execution failed: ${data.error}`);
    }
  }

  /**
   * EAにコマンド送信（新実装）
   */
  async sendTradeCommand(connectionId: string, command: WSCommand): Promise<boolean> {
    if (!this.wsServer) {
      console.error('❌ WebSocket server not initialized');
      return false;
    }

    return await this.wsServer.sendCommand(connectionId, command);
  }

  /**
   * レガシー互換のコマンド送信
   */
  async sendLegacyTradeCommand(accountId: string, command: {
    action: 'open' | 'close' | 'modify';
    symbol: string;
    volume: number;
    type: 'buy' | 'sell';
    price?: number;
  }): Promise<boolean> {
    if (!this.wsServer) {
      console.error(`❌ WebSocket server not initialized`);
      return false;
    }

    // レガシーコマンドを新フォーマットに変換
    let wsCommand: WSCommand;

    switch (command.action) {
      case 'open':
        wsCommand = this.messageProcessor.createOpenCommand({
          positionId: `${accountId}_${Date.now()}`,
          symbol: command.symbol,
          side: command.type === 'buy' ? 'BUY' : 'SELL',
          volume: command.volume,
          // 必要に応じてstopLoss, takeProfitを設定
        });
        break;
        
      case 'close':
        wsCommand = this.messageProcessor.createCloseCommand({
          positionId: accountId // 実際のポジションIDが必要
        });
        break;
        
      default:
        console.error(`❌ Unsupported command action: ${command.action}`);
        return false;
    }

    // アカウントIDから接続IDを取得（実装が必要）
    const connectionId = this.getConnectionIdFromAccount(accountId);
    if (!connectionId) {
      console.error(`❌ No connection found for account: ${accountId}`);
      return false;
    }

    return await this.wsServer.sendCommand(connectionId, wsCommand);
  }

  /**
   * 接続中のクライアント一覧取得
   */
  getConnectedClients(): { accountId: string; lastHeartbeat: Date }[] {
    if (!this.wsServer) {
      return [];
    }

    const connections = this.wsServer.getActiveConnections();
    return connections.map(conn => ({
      accountId: conn.eaInfo?.account || conn.connectionId,
      lastHeartbeat: conn.lastHeartbeat
    }));
  }
  
  /**
   * WebSocket統計取得
   */
  getStats(): typeof this.messageStats & { serverStats?: any } {
    const stats = { ...this.messageStats };
    
    if (this.wsServer) {
      return {
        ...stats,
        serverStats: this.wsServer.getStats()
      };
    }
    
    return stats;
  }
  
  /**
   * 非アクティブクライアント検出・切断
   */
  cleanupInactiveClients(timeoutMs: number = 300000): void {
    // 新しいWebSocketサーバーは自動的にクリーンアップを実行
    if (this.wsServer) {
      // サーバー側でheartbeat監視が実装済み
      console.log('🧹 Cleanup handled by WebSocket server');
    }
  }
  
  /**
   * サーバーシャットダウン
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down WebSocket handler...');
    
    if (this.wsServer) {
      await this.wsServer.stop();
      this.wsServer = undefined;
    }
    
    this.isInitialized = false;
    console.log('✅ WebSocket handler shutdown completed');
  }

  /**
   * ヘルパーメソッド
   */
  private updateMessageStats(): void {
    this.messageStats.processed++;
    this.messageStats.lastMessage = new Date();
  }

  private extractAccountFromPositionId(positionId: string): string {
    // ポジションIDからアカウントIDを抽出
    return positionId.split('_')[0] || 'unknown';
  }

  private extractSymbolFromPositionId(positionId: string): string {
    // ポジションIDからシンボルを抽出
    return positionId.split('_')[1] || 'UNKNOWN';
  }

  private getConnectionIdFromAccount(accountId: string): string | null {
    if (!this.wsServer) return null;
    
    const connections = this.wsServer.getActiveConnections();
    const connection = connections.find(conn => conn.eaInfo?.account === accountId);
    return connection?.connectionId || null;
  }

  /**
   * 設定更新
   */
  async updateConfiguration(updates: Partial<WSServerConfig>): Promise<void> {
    if (!this.wsServer) {
      throw new Error('WebSocket server not initialized');
    }

    // サーバーを再起動して新しい設定を適用
    await this.wsServer.stop();
    
    const config = loadConfig();
    const newConfig: WSServerConfig = {
      ...config.websocket,
      ...updates
    };

    this.wsServer = new HedgeWebSocketServer(newConfig, this.messageProcessor);
    await this.wsServer.start();
    
    WSErrorHandler.logEvent('WEBSOCKET_CONFIG_UPDATED', updates);
  }

  /**
   * サーバー状態取得
   */
  getServerStatus() {
    if (!this.wsServer) {
      return { isRunning: false, error: 'Server not initialized' };
    }
    
    return {
      isRunning: this.isInitialized,
      stats: this.wsServer.getStats(),
      connections: this.wsServer.getActiveConnections().length
    };
  }
}

// WebSocketメッセージのバリデーション（新フォーマット用）
export const validateWebSocketMessage = (message: any): message is WSEvent => {
  return (
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    typeof message.timestamp === 'string' &&
    Object.values(WSMessageType).includes(message.type)
  );
};

// レガシーメッセージのバリデーション（従来互換）
export const validateLegacyWebSocketMessage = (message: any): boolean => {
  return (
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    typeof message.accountId === 'string' &&
    typeof message.timestamp === 'string' &&
    message.data !== undefined
  );
};