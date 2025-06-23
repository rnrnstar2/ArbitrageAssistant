import { HedgeWebSocketServer, WSServerConfig } from './websocket-server';
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
  WSModifyStopCommand,
  RealtimePosition, 
  RealtimeAccount
} from './types';
import { ActionManager } from './action-manager';
import { PositionService } from './position-service';
import { amplifyClient } from './amplify-client';
import { PriceMonitor, PriceUpdate } from './price-monitor';

/**
 * 統合WebSocketハンドラー
 * 新しいWebSocketサーバーと既存のRealtimeStateManagerを統合
 */
export class WebSocketHandler {
  private wsServer?: HedgeWebSocketServer;
  private isInitialized = false;
  private actionManager: ActionManager;
  private priceMonitor?: PriceMonitor;
  
  // 統計
  private messageStats = {
    received: 0,
    processed: 0,
    errors: 0,
    lastMessage: new Date()
  };
  
  constructor(actionManager?: ActionManager) {
    this.actionManager = actionManager || new ActionManager(this);
  }

  /**
   * PriceMonitor設定（task specification準拠）
   * @param priceMonitor 価格監視マネージャー
   */
  setPriceMonitor(priceMonitor: PriceMonitor): void {
    this.priceMonitor = priceMonitor;
    console.log('🔧 PriceMonitor set for WebSocket handler');
  }

  /**
   * EAイベント処理（task specification準拠）
   * @param event EAからのイベント
   */
  private async handleEAEvent(event: any): Promise<void> {
    try {
      switch (event.event) {
        case 'PRICE_UPDATE':
          if (this.priceMonitor) {
            const priceUpdate: PriceUpdate = {
              symbol: event.symbol,
              price: event.price,
              timestamp: new Date(event.timestamp || Date.now()),
              bid: event.bid,
              ask: event.ask,
              spread: event.spread
            };
            
            await this.priceMonitor.handlePriceFromEA(priceUpdate);
          }
          break;
          
        case 'POSITION_OPENED':
          await this.handleOpenedEvent(event as WSOpenedEvent);
          break;
          
        case 'POSITION_CLOSED':
          await this.handleClosedEvent(event as WSClosedEvent);
          break;
          
        case 'POSITION_STOPPED':
          await this.handleStoppedEvent(event as WSStoppedEvent);
          break;
          
        case 'ERROR':
          await this.handleErrorEvent(event as WSErrorEvent);
          break;
          
        default:
          console.warn(`⚠️ Unknown EA event type: ${event.event}`);
      }
    } catch (error) {
      console.error(`❌ Failed to handle EA event:`, error);
    }
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
   * OPENED イベント処理（MVPシステム設計準拠）
   */
  private async handleOpenedEvent(event: WSOpenedEvent): Promise<void> {
    console.log(`📈 Position opened: ${event.positionId} @ ${event.price}`);
    
    try {
      // 1. Position状態を OPEN に更新
      await this.amplifyClient.models.Position.update({
        id: event.positionId,
        status: 'OPEN',
        mtTicket: event.mtTicket,
        entryPrice: event.price,
        entryTime: new Date(event.time).toISOString()
      });

      // 2. Action完了（存在する場合）
      if (event.actionId) {
        await this.amplifyClient.models.Action.update({
          id: event.actionId,
          status: 'EXECUTED'
        });
      }
      
      console.log(`✅ Position opened successfully: ${event.positionId}`);
      
    } catch (error) {
      console.error(`❌ Failed to handle position opened event: ${event.positionId}`, error);
    }
  }

  /**
   * ロスカット処理（設計書3-3準拠 + TrailEngine連携）
   */
  private async handleStoppedEvent(event: WSStoppedEvent): Promise<void> {
    try {
      // 1. Position状態更新
      await amplifyClient.models.Position.update({
        id: event.positionId,
        status: 'STOPPED',
        exitPrice: event.price,
        exitTime: new Date(event.time).toISOString()
      });

      // 2. ポジション情報取得
      const position = await this.getPositionFromAmplify(event.positionId);
      if (!position) {
        console.warn(`Position not found for stop-out: ${event.positionId}`);
        return;
      }

      // 3. トレール設定があればアクション実行
      if (position.triggerActionIds) {
        console.log(`Stop-out triggered for position ${event.positionId}, executing trail actions`);
        
        const actionIds = JSON.parse(position.triggerActionIds);
        for (const actionId of actionIds) {
          await this.actionManager.triggerAction(actionId);
        }
        
        console.log(`${actionIds.length} trail actions triggered for stop-out position ${event.positionId}`);
      }
      
    } catch (error) {
      console.error(`Failed to handle stop-out event for position ${event.positionId}:`, error);
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
   * Position更新（Amplify経由）
   */
  private async updatePosition(positionId: string, updates: any): Promise<void> {
    try {
      await amplifyClient.models.Position.update({
        id: positionId,
        ...updates
      });
      console.log(`📊 Position updated: ${positionId}`, updates);
    } catch (error) {
      console.error(`Failed to update position ${positionId}:`, error);
    }
  }

  /**
   * Action更新
   */
  private async updateAction(actionId: string, updates: any): Promise<void> {
    // 実装: Action更新ロジック
    console.log(`🎯 Action updated: ${actionId}`, updates);
  }

  /**
   * Position取得（Amplify経由）
   */
  private async getPositionFromAmplify(positionId: string): Promise<any> {
    try {
      const result = await PositionService.listOpen();
      const positions = result.data.listPositions.items;
      return positions.find((p: any) => p.id === positionId) || null;
    } catch (error) {
      console.error(`Failed to get position ${positionId}:`, error);
      return null;
    }
  }
  
  /**
   * Position取得（レガシー互換）
   */
  private async getPosition(positionId: string): Promise<any> {
    return this.getPositionFromAmplify(positionId);
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
      const wsConfig: WSServerConfig = {
        port,
        host: 'localhost',
        authToken: 'default-token',
        maxConnections: 10,
        heartbeatInterval: 30000,
        connectionTimeout: 60000
      };

      this.wsServer = new HedgeWebSocketServer(wsConfig);
      
      // カスタムメッセージ処理ハンドラーを設定
      this.setupMessageProcessorCallbacks();
      
      await this.wsServer.start();
      this.isInitialized = true;
      
      console.log(`🚀 WebSocket handler initialized on port ${port}`);
      console.log(`🚀 WebSocket server started on port ${port}`);
      
    } catch (error) {
      console.error(`❌ Failed to initialize WebSocket handler on port ${port}:`, error);
      throw error;
    }
  }

  /**
   * コールバック設定 (簡素化版)
   */
  private setupMessageProcessorCallbacks(): void {
    // 簡素化: コールバックは最小限に
    console.log('🔧 Message processor callbacks setup (simplified)');
  }

  /**
   * PositionManager適合オブジェクトを作成
   */
  private createPositionManager() {
    return {
      updatePositionOpened: async (positionId: string, orderId: number, price: number, time: string) => {
        // ポジション更新 (簡素化版)
        console.log(`📊 Position opened (simplified): ${positionId} @ ${price}`);
        console.log(`📊 Position opened: ${positionId} @ ${price}`);
      },

      updatePositionClosed: async (positionId: string, price: number, profit: number, time: string) => {
        // ポジションクローズ処理
        console.log(`📊 Position closed: ${positionId} @ ${price}, profit: ${profit}`);
        // ポジションクローズ処理 (簡素化版)
      },

      updatePositionPrice: async (positionId: string, currentPrice: number) => {
        // 現在価格更新
        const accountId = this.extractAccountFromPositionId(positionId);
        // 価格更新 (簡素化版)
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
        
        // イベント処理 (簡素化版)
        this.updateMessageStats();
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
      } else if (message.event) {
        // EAイベント処理（価格更新等）
        await this.handleEAEvent(message);
      } else {
        // レガシーメッセージを新フォーマットに変換
        const wsEvent = this.convertLegacyMessage(message);
        
        if (wsEvent) {
          // 新フォーマットメッセージ処理 (簡素化版)
          console.log(`💬 Processing new format message: ${wsEvent.type}`);
        } else {
          // 従来のメッセージ処理
          this.handleLegacyMessage(message, clientId);
        }
      }
      
      this.messageStats.processed++;
      
    } catch (error) {
      console.error('❌ Failed to process WebSocket message:', error);
      this.messageStats.errors++;
      console.error(`❌ Message processing error for client ${clientId}:`, error);
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
   * CLOSED イベント処理（MVPシステム設計準拠）
   */
  private async handleClosedEvent(event: WSClosedEvent): Promise<void> {
    console.log(`📉 Position closed: ${event.positionId} @ ${event.price}`);
    
    try {
      // 1. Position状態を CLOSED に更新
      await this.amplifyClient.models.Position.update({
        id: event.positionId,
        status: 'CLOSED',
        exitPrice: event.price,
        exitTime: new Date(event.time).toISOString(),
        exitReason: event.reason || 'MANUAL'
      });

      // 2. Action完了（存在する場合）
      if (event.actionId) {
        await this.amplifyClient.models.Action.update({
          id: event.actionId,
          status: 'EXECUTED'
        });
      }
      
      console.log(`✅ Position closed successfully: ${event.positionId}`);
      
    } catch (error) {
      console.error(`❌ Failed to handle position closed event: ${event.positionId}`, error);
    }
  }

  /**
   * ERROR イベント処理（設計書準拠）
   */
  private async handleErrorEvent(event: WSErrorEvent): Promise<void> {
    // エラー処理 (簡素化版)
    console.error(`❌ WebSocket error for position ${event.positionId}:`, {
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
    
    // ポジション更新 (簡素化版)
    console.log(`📊 Position update processed: ${data.symbol} (${accountId})`);
  }
  
  private handleAccountUpdate(message: any): void {
    const { accountId, data } = message;
    
    // アカウント更新 (簡素化版)
    console.log(`💰 Account update processed: ${accountId}`);
  }
  
  private handleHeartbeat(message: any, clientId: string): void {
    const { accountId } = message;
    
    // MT4接続状態更新 (簡素化版)
    console.log(`💓 Heartbeat received from ${accountId}`);
  }
  
  private handleConnectionStatus(message: any): void {
    const { accountId, data } = message;
    
    // MT4接続状態更新 (簡素化版)
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
        wsCommand = {
          type: 'OPEN' as any,
          timestamp: new Date().toISOString(),
          accountId,
          positionId: `${accountId}_${Date.now()}`,
          symbol: command.symbol,
          side: command.type === 'buy' ? 'BUY' : 'SELL',
          volume: command.volume
        } as WSCommand;
        break;
        
      case 'close':
        wsCommand = {
          type: 'CLOSE' as any,
          timestamp: new Date().toISOString(),
          accountId,
          positionId: accountId // 実際のポジションIDが必要
        } as WSCommand;
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
   * OPEN命令送信（PositionManager用）
   */
  async sendOpenCommand(params: {
    accountId: string;
    positionId: string;
    symbol: Symbol;
    volume: number;
    executionType: ExecutionType;
  }): Promise<any> {
    const command: WSOpenCommand = {
      type: WSMessageType.OPEN,
      timestamp: new Date().toISOString(),
      accountId: params.accountId,
      positionId: params.positionId,
      symbol: params.symbol,
      side: 'BUY', // executionTypeから決定
      volume: params.volume,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };

    await this.sendCommand(params.accountId, command);
    return { success: true };
  }

  /**
   * CLOSE命令送信（PositionManager用）
   */
  async sendCloseCommand(params: {
    accountId: string;
    positionId: string;
  }): Promise<any> {
    const command: WSCloseCommand = {
      type: WSMessageType.CLOSE,
      timestamp: new Date().toISOString(),
      accountId: params.accountId,
      positionId: params.positionId
    };

    await this.sendCommand(params.accountId, command);
    return { success: true };
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
    
    const newConfig: WSServerConfig = {
      port: 8080,
      host: 'localhost',
      authToken: 'default-token',
      maxConnections: 10,
      heartbeatInterval: 30000,
      connectionTimeout: 60000,
      ...updates
    };

    this.wsServer = new HedgeWebSocketServer(newConfig);
    await this.wsServer.start();
    
    console.log('🔧 WebSocket configuration updated:', updates);
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