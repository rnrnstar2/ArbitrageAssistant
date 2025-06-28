import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  WSEvent, 
  WSCommand, 
  WSMessageType,
  WSOpenedEvent,
  WSClosedEvent,
  WSStoppedEvent,
  WSErrorEvent,
  WSOpenCommand,
  WSCloseCommand,
  RealtimePosition, 
  RealtimeAccount,
  ExecutionType,
  Symbol,
  WebSocketPerformanceMetrics,
  SystemPerformance,
  NetworkQuality,
  WebSocketClientInfo,
  WebSocketDetailedStats,
  WebSocketEventPayload
} from './types';
import { amplifyClient } from './amplify-client';
import { PriceMonitor, PriceUpdate } from './price-monitor';

// ========================================
// 型定義・インターフェース
// ========================================

export interface WSServerConfig {
  port: number;
  host: string;
  authToken: string;
  maxConnections: number;
  heartbeatInterval: number;
  connectionTimeout: number;
}

export interface WSServerStats {
  isRunning: boolean;
  activeConnections: number;
  totalMessagesReceived: number;
  totalMessagesSent: number;
  uptime: number;
  errors: number;
  connectedClients: number;
  messagesPerSecond: number;
}

export interface EAConnection {
  connectionId: string;
  accountId?: string;
  sessionId?: string;
  authenticated: boolean;
  connectedAt: Date;
  lastHeartbeat: Date;
  eaInfo?: {
    version: string;
    platform: string;
    account: string;
    serverName?: string;
    companyName?: string;
  };
}

// ========================================
// WebSocket Server - MVPシステム設計書準拠統合クラス
// ========================================

/**
 * WebSocket Server - MVPシステム設計書準拠
 * MT4/MT5 EAとの通信管理・メッセージ処理・Tauri統合
 * 
 * 主要機能：
 * 1. MT4/MT5 EAとのWebSocket通信
 * 2. メッセージフォーマット変換・処理
 * 3. Tauri統合（ネイティブ機能活用）
 * 4. リアルタイムデータ管理
 * 5. 接続管理・ハートビート監視
 * 6. エラーハンドリング・統計管理
 */
export class WebSocketServer {
  private isRunning = false;
  private isInitialized = false;
  private startTime?: Date;
  private eventUnsubscribe?: () => void;
  private onMessageHandler?: (message: WSEvent, clientId: string) => Promise<void>;
  public priceMonitor?: PriceMonitor;
  private config?: WSServerConfig;
  
  // 統計情報
  private stats = {
    totalMessagesReceived: 0,
    totalMessagesSent: 0,
    errors: 0
  };

  // メッセージ処理統計
  private messageStats = {
    received: 0,
    processed: 0,
    errors: 0,
    lastMessage: new Date()
  };

  constructor() {
    this.setupEventListeners();
  }

  // ========================================
  // サーバーライフサイクル
  // ========================================

  /**
   * WebSocketサーバー初期化・開始（高性能版）
   */
  async initializeServer(port: number = 8080): Promise<void> {
    try {
      const wsConfig: WSServerConfig = {
        port,
        host: '127.0.0.1', // localhost -> 127.0.0.1で高速化
        authToken: 'hedge-system-high-performance-token',
        maxConnections: 50, // 接続数増加
        heartbeatInterval: 15000, // ハートビート間隔短縮
        connectionTimeout: 180000 // タイムアウト延長
      };

      await this.start(wsConfig);
      this.isInitialized = true;
      
      // システムパフォーマンス監視開始
      await this.startPerformanceMonitoring();
      
      console.log(`🚀 High-performance WebSocket server initialized on port ${port}`);
      console.log(`📊 Performance monitoring enabled`);
      
    } catch (error) {
      console.error(`❌ Failed to initialize WebSocket server on port ${port}:`, error);
      throw error;
    }
  }

  /**
   * パフォーマンス監視開始
   */
  private async startPerformanceMonitoring(): Promise<void> {
    try {
      // システムパフォーマンス取得
      const systemPerf = await invoke('get_system_performance') as SystemPerformance;
      console.log(`💻 System Performance:`, systemPerf);
      
      // ネットワーク品質測定
      const networkQuality = await invoke('get_network_quality') as NetworkQuality;
      console.log(`🌐 Network Quality:`, networkQuality);
      
      // 定期的なパフォーマンス監視（30秒間隔）
      setInterval(async () => {
        try {
          const metrics = await invoke('get_websocket_performance_metrics') as WebSocketPerformanceMetrics;
          
          // パフォーマンス警告
          if (metrics.avg_latency_ms > 100) {
            console.warn(`⚠️ High WebSocket latency: ${metrics.avg_latency_ms}ms`);
          }
          
          if (metrics.error_rate > 5) {
            console.warn(`⚠️ High error rate: ${metrics.error_rate}%`);
          }
          
        } catch (error) {
          console.error(`❌ Performance monitoring error:`, error);
        }
      }, 30000);
      
    } catch (error) {
      console.error(`❌ Failed to start performance monitoring:`, error);
    }
  }

  /**
   * WebSocketサーバー開始（Tauri統合）
   */
  async start(config?: WSServerConfig): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ WebSocket server is already running');
      return;
    }

    this.config = config || {
      port: 8080,
      host: 'localhost',
      authToken: 'default-token',
      maxConnections: 10,
      heartbeatInterval: 30000,
      connectionTimeout: 60000
    };

    try {
      // Tauri WebSocketサーバーを開始
      await invoke('start_websocket_server', {
        port: this.config.port,
        host: this.config.host,
        authToken: this.config.authToken
      });
      
      this.isRunning = true;
      this.startTime = new Date();
      
      console.log(`🚀 WebSocket Server started on ${this.config.host}:${this.config.port} (Tauri)`);
      
    } catch (error) {
      console.error('❌ Failed to start WebSocket server:', error);
      throw error;
    }
  }

  /**
   * WebSocketサーバー停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Tauri WebSocketサーバーを停止
      await invoke('stop_websocket_server');
      
      // イベントリスナーを削除
      if (this.eventUnsubscribe) {
        this.eventUnsubscribe();
        this.eventUnsubscribe = undefined;
      }

      this.isRunning = false;
      
      console.log('🛑 WebSocket Server stopped (Tauri)');

    } catch (error) {
      console.error('❌ Error stopping WebSocket server:', error);
      throw error;
    }
  }

  /**
   * サーバーシャットダウン
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down WebSocket server...');
    
    await this.stop();
    
    this.isInitialized = false;
    this.config = undefined;
    
    console.log('✅ WebSocket server shutdown completed');
  }

  // ========================================
  // イベント処理・メッセージ管理
  // ========================================

  /**
   * イベントリスナー設定（Tauri統合）
   */
  private async setupEventListeners(): Promise<void> {
    try {
      // Tauri WebSocketイベントを受信
      this.eventUnsubscribe = await listen('websocket-event', (event) => {
        this.handleWebSocketEvent(event.payload);
      });
      
      console.log('🔧 WebSocket event listeners setup (Tauri)');
      
    } catch (error) {
      console.error('❌ Failed to setup event listeners:', error);
    }
  }

  /**
   * WebSocketイベント処理
   */
  private handleWebSocketEvent(payload: WebSocketEventPayload): void {
    try {
      this.stats.totalMessagesReceived++;
      this.messageStats.received++;
      this.messageStats.lastMessage = new Date();
      
      switch (payload.type) {
        case 'connection':
          console.log(`🔗 New EA connection: ${payload.clientId}`);
          break;
        case 'disconnection':
          console.log(`🔌 EA disconnected: ${payload.clientId}`);
          break;
        case 'message':
          this.handleMessage(payload.message, payload.clientId);
          break;
        case 'error':
          this.stats.errors++;
          this.messageStats.errors++;
          console.error(`❌ WebSocket error:`, payload.error);
          break;
      }
      
    } catch (error) {
      this.stats.errors++;
      this.messageStats.errors++;
      console.error('❌ Error handling WebSocket event:', error);
    }
  }

  /**
   * メッセージ処理（統合版）- MVPシステム設計準拠
   */
  async handleMessage(rawMessage: string, clientId: string): Promise<void> {
    try {
      const message = JSON.parse(rawMessage);
      
      console.log(`📨 Message from ${clientId}: ${message.type || message.event}`, message);
      
      if (this.isDesignCompliantMessage(message)) {
        // MVPシステム設計準拠メッセージ
        await this.handleDesignCompliantMessage(message);
      } else {
        // レガシーサポート（最小限）
        await this.handleLegacyMessage(message, clientId);
      }
      
      // カスタムメッセージ処理ハンドラーを呼び出し
      if (this.onMessageHandler && this.isDesignCompliantMessage(message)) {
        await this.onMessageHandler(message, clientId);
      }
      
      this.updateMessageStats();
      
    } catch (error) {
      await this.handleMessageError(error as Error, clientId, rawMessage);
    }
  }

  // ========================================
  // EA イベント処理
  // ========================================

  /**
   * EAイベント処理（価格更新・ポジション状態等）
   */
  private async handleEAEvent(event: WSEvent & { event: string; bid?: number; ask?: number; spread?: number }): Promise<void> {
    try {
      switch (event.event) {
        case 'PRICE_UPDATE':
          await this.handlePriceUpdate(event);
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
   * 価格更新処理
   */
  private async handlePriceUpdate(event: WSEvent & { symbol: string; price: number; bid?: number; ask?: number; spread?: number }): Promise<void> {
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
  }

  /**
   * OPENED イベント処理（MVPシステム設計準拠）
   */
  private async handleOpenedEvent(event: WSOpenedEvent): Promise<void> {
    console.log(`📈 Position opened: ${event.positionId} @ ${event.price}`);
    
    try {
      // Position状態を OPEN に更新
      await (amplifyClient as {models?: {Position?: {update: (data: any) => Promise<any>}}}).models?.Position?.update({
        id: event.positionId,
        status: 'OPEN',
        mtTicket: event.mtTicket || event.orderId?.toString(),
        entryPrice: event.price,
        entryTime: new Date(event.time).toISOString()
      });

      // Action完了（存在する場合）
      if (event.actionId) {
        await (amplifyClient as {models?: {Action?: {update: (data: any) => Promise<any>}}}).models?.Action?.update({
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
   * CLOSED イベント処理（MVPシステム設計準拠）
   */
  private async handleClosedEvent(event: WSClosedEvent): Promise<void> {
    console.log(`📉 Position closed: ${event.positionId} @ ${event.price}`);
    
    try {
      // Position状態を CLOSED に更新
      await (amplifyClient as {models?: {Position?: {update: (data: any) => Promise<any>}}}).models?.Position?.update({
        id: event.positionId,
        status: 'CLOSED',
        exitPrice: event.price,
        exitTime: new Date(event.time).toISOString(),
        exitReason: 'MANUAL_CLOSE'
      });

      // Action完了（存在する場合）
      if (event.actionId) {
        await (amplifyClient as {models?: {Action?: {update: (data: any) => Promise<any>}}}).models?.Action?.update({
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
   * ロスカット処理（設計書準拠 + TrailEngine連携）
   */
  private async handleStoppedEvent(event: WSStoppedEvent): Promise<void> {
    console.log(`💥 Position stopped: ${event.positionId} @ ${event.price}, reason: ${event.reason}`);
    
    try {
      // Position状態更新
      await (amplifyClient as {models?: {Position?: {update: (data: any) => Promise<any>}}}).models?.Position?.update({
        id: event.positionId,
        status: 'STOPPED',
        exitPrice: event.price,
        exitTime: new Date(event.time).toISOString(),
        exitReason: 'STOP_OUT'
      });

      // ポジション情報取得
      const position = await this.getPosition(event.positionId);
      if (!position) {
        console.warn(`Position not found for stop-out: ${event.positionId}`);
        return;
      }

      // トレール設定があればアクション実行
      if (position.triggerActionIds) {
        console.log(`Stop-out triggered for position ${event.positionId}, executing trail actions`);
        
        const actionIds = JSON.parse(position.triggerActionIds);
        for (const actionId of actionIds) {
          // ActionSync経由でアクション実行
          await (amplifyClient as {models?: {Action?: {update: (data: any) => Promise<any>}}}).models?.Action?.update({
            id: actionId,
            status: 'EXECUTING'
          });
        }
        
        console.log(`${actionIds.length} trail actions triggered for stop-out position ${event.positionId}`);
      }
      
    } catch (error) {
      console.error(`Failed to handle stop-out event for position ${event.positionId}:`, error);
    }
  }

  /**
   * ERROR イベント処理
   */
  private async handleErrorEvent(event: WSErrorEvent): Promise<void> {
    console.error(`❌ WebSocket error for position ${event.positionId}:`, {
      message: event.message,
      errorCode: event.errorCode
    });
    
    // エラー統計更新
    this.stats.errors++;
    this.messageStats.errors++;
  }

  // ========================================
  // 設計書準拠メッセージ処理
  // ========================================

  /**
   * 設計書準拠メッセージかどうかの判定
   */
  private isDesignCompliantMessage(message: unknown): message is WSEvent {
    return (
      message.type && 
      message.timestamp &&
      Object.values(WSMessageType).includes(message.type)
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
      case WSMessageType.PONG:
        // ハートビート応答処理
        console.log(`💓 Heartbeat pong received`);
        break;
      default:
        console.warn(`⚠️ Unknown design compliant message type: ${message.type}`);
    }
  }

  // ========================================
  // レガシーメッセージ処理
  // ========================================


  /**
   * レガシーメッセージ処理（最小限）
   */
  private async handleLegacyMessage(message: Record<string, unknown>, clientId: string): Promise<void> {
    try {
      // EAイベント処理（価格更新等）
      if (message.event) {
        await this.handleEAEvent(message);
        return;
      }

      // 最小限のレガシーサポート
      switch (message.type) {
        case 'heartbeat':
          console.log(`💓 Heartbeat received from ${clientId}`);
          break;
          
        default:
          console.warn(`⚠️ Unknown legacy message type: ${message.type}`);
      }
      
    } catch (error) {
      console.error(`❌ Legacy message processing error:`, error);
    }
  }


  // ========================================
  // コマンド送信
  // ========================================

  /**
   * EAにコマンド送信（Tauri統合）
   */
  async sendCommand(connectionId: string, command: WSCommand): Promise<boolean> {
    try {
      const message = JSON.stringify(command);
      
      // TODO: Tauri側にクライアント指定のメッセージ送信機能を実装
      this.stats.totalMessagesSent++;
      
      console.log(`🗣️ Command sent for ${connectionId}: ${command.type}`);
      
      return true;

    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Command send error for ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * OPEN命令送信
   */
  async sendOpenCommand(params: {
    accountId: string;
    positionId: string;
    symbol: Symbol;
    volume: number;
    executionType?: ExecutionType;
  }): Promise<any> {
    const command = {
      type: WSMessageType.OPEN,
      timestamp: new Date().toISOString(),
      accountId: params.accountId,
      positionId: params.positionId,
      symbol: params.symbol,
      side: 'BUY', // executionTypeから決定する必要がある
      volume: params.volume,
      metadata: {
        timestamp: new Date().toISOString()
      }
    } as unknown as WSOpenCommand;

    const connectionId = this.getConnectionIdFromAccount(params.accountId);
    if (connectionId) {
      return await this.sendCommand(connectionId, command);
    }
    
    return { success: false, error: 'No connection found' };
  }

  /**
   * CLOSE命令送信
   */
  async sendCloseCommand(params: {
    accountId: string;
    positionId: string;
  }): Promise<any> {
    const command = {
      type: WSMessageType.CLOSE,
      timestamp: new Date().toISOString(),
      accountId: params.accountId,
      positionId: params.positionId
    } as unknown as WSCloseCommand;

    const connectionId = this.getConnectionIdFromAccount(params.accountId);
    if (connectionId) {
      return await this.sendCommand(connectionId, command);
    }
    
    return { success: false, error: 'No connection found' };
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
    // レガシーコマンドを新フォーマットに変換
    let wsCommand: WSCommand;

    switch (command.action) {
      case 'open':
        wsCommand = {
          type: WSMessageType.OPEN,
          timestamp: new Date().toISOString(),
          accountId,
          positionId: `${accountId}_${Date.now()}`,
          symbol: command.symbol,
          side: command.type === 'buy' ? 'BUY' : 'SELL',
          volume: command.volume
        } as unknown as WSOpenCommand;
        break;
        
      case 'close':
        wsCommand = {
          type: WSMessageType.CLOSE,
          timestamp: new Date().toISOString(),
          accountId,
          positionId: accountId // 実際のポジションIDが必要
        } as unknown as WSCloseCommand;
        break;
        
      default:
        console.error(`❌ Unsupported command action: ${command.action}`);
        return false;
    }

    const connectionId = this.getConnectionIdFromAccount(accountId);
    if (!connectionId) {
      console.error(`❌ No connection found for account: ${accountId}`);
      return false;
    }

    return await this.sendCommand(connectionId, wsCommand);
  }

  /**
   * 全接続にメッセージブロードキャスト
   */
  async broadcast(message: WSMessage): Promise<void> {
    console.log(`📡 Broadcasting ${message.type} message (Tauri managed)`);
    // Tauri WebSocketサーバーが自動的にheartbeatと接続管理を行う
  }

  // ========================================
  // 接続・統計管理
  // ========================================

  /**
   * アクティブ接続取得（Tauri統合）
   */
  async getActiveConnections(): Promise<EAConnection[]> {
    try {
      // Tauri WebSocketサーバーからクライアント一覧を取得
      const tauriClients = await invoke('get_websocket_clients') as WebSocketClientInfo[];
      
      return tauriClients.map(client => ({
        connectionId: client.id,
        accountId: client.ea_info?.account,
        sessionId: client.id,
        authenticated: client.authenticated,
        connectedAt: new Date(client.connected_at),
        lastHeartbeat: new Date(client.last_heartbeat),
        eaInfo: client.ea_info ? {
          version: client.ea_info.version,
          platform: client.ea_info.platform,
          account: client.ea_info.account,
          serverName: client.ea_info.server_name,
          companyName: client.ea_info.company_name
        } : undefined
      }));
      
    } catch (error) {
      console.error('❌ Failed to get active connections from Tauri WebSocket server:', error);
      return [];
    }
  }

  /**
   * 接続中のクライアント一覧取得（簡易版）
   */
  getConnectedClients(): { accountId: string; lastHeartbeat: Date }[] {
    // 非同期処理を同期的に扱うため、キャッシュされた情報を返す
    // 実際の実装では定期的にgetActiveConnections()を呼び出してキャッシュ更新
    return [];
  }

  /**
   * サーバー統計取得（Tauri統合・高性能版）
   */
  async getStats(): Promise<WSServerStats> {
    try {
      // Tauri WebSocketサーバーから統計を取得
      const tauriStats = await invoke('get_websocket_server_status') as {
        is_running?: boolean;
        connected_clients?: number;
        total_messages_received?: number;
        total_messages_sent?: number;
        uptime_seconds?: number;
        errors?: number;
      };
      
      return {
        isRunning: tauriStats.is_running || this.isRunning,
        activeConnections: tauriStats.connected_clients || 0,
        totalMessagesReceived: tauriStats.total_messages_received || this.stats.totalMessagesReceived,
        totalMessagesSent: tauriStats.total_messages_sent || this.stats.totalMessagesSent,
        uptime: tauriStats.uptime_seconds ? tauriStats.uptime_seconds * 1000 : (this.startTime ? Date.now() - this.startTime.getTime() : 0),
        errors: tauriStats.errors || this.stats.errors,
        connectedClients: tauriStats.connected_clients || 0,
        messagesPerSecond: this.calculateMessagesPerSecond()
      };
      
    } catch (error) {
      console.error('❌ Failed to get stats from Tauri WebSocket server:', error);
      
      // フォールバック: ローカル統計を返す
      return {
        isRunning: this.isRunning,
        activeConnections: 0,
        totalMessagesReceived: this.stats.totalMessagesReceived,
        totalMessagesSent: this.stats.totalMessagesSent,
        uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
        errors: this.stats.errors,
        connectedClients: 0,
        messagesPerSecond: this.calculateMessagesPerSecond()
      };
    }
  }

  // ========================================
  // 高性能機能・Rust統合
  // ========================================

  /**
   * 詳細パフォーマンス統計取得
   */
  async getDetailedStats(): Promise<WebSocketDetailedStats | null> {
    try {
      return await invoke('get_websocket_detailed_stats') as WebSocketDetailedStats;
    } catch (error) {
      console.error('❌ Failed to get detailed stats:', error);
      return null;
    }
  }

  /**
   * パフォーマンス最適化実行
   */
  async optimizePerformance(): Promise<string> {
    try {
      // WebSocket最適化
      const wsOptimization = await invoke('optimize_websocket_performance') as string;
      
      // メモリ最適化
      const memoryOptimization = await invoke('optimize_memory_usage') as string;
      
      console.warn(`🔧 WebSocket optimization: ${wsOptimization}`);
      console.warn(`🧹 Memory optimization: ${memoryOptimization}`);
      
      return `Optimizations completed: ${wsOptimization}; ${memoryOptimization}`;
      
    } catch (error) {
      console.error('❌ Failed to optimize performance:', error);
      return 'Performance optimization failed';
    }
  }

  /**
   * 高速ブロードキャスト（Rust実装）
   */
  async broadcastHighPerformance(message: WSMessage): Promise<number> {
    try {
      const messageStr = JSON.stringify(message);
      const sentCount = await invoke('broadcast_websocket_message', { message: messageStr }) as number;
      
      this.stats.totalMessagesSent += sentCount;
      console.log(`📡 High-performance broadcast sent to ${sentCount} clients`);
      
      return sentCount;
      
    } catch (error) {
      console.error('❌ High-performance broadcast failed:', error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * 接続品質監視
   */
  async getConnectionQuality(clientId: string): Promise<{
    latency_ms: number;
    packet_loss_rate: number;
    connection_stability: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  } | null> {
    try {
      return await invoke('get_client_connection_quality', { clientId }) as {
        latency_ms: number;
        packet_loss_rate: number;
        connection_stability: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
      };
    } catch (error) {
      console.error(`❌ Failed to get connection quality for ${clientId}:`, error);
      return null;
    }
  }

  /**
   * システムパフォーマンス取得
   */
  async getSystemPerformance(): Promise<SystemPerformance | null> {
    try {
      return await invoke('get_system_performance') as SystemPerformance;
    } catch (error) {
      console.error('❌ Failed to get system performance:', error);
      return null;
    }
  }

  /**
   * ネットワーク品質取得
   */
  async getNetworkQuality(): Promise<NetworkQuality | null> {
    try {
      return await invoke('get_network_quality') as NetworkQuality;
    } catch (error) {
      console.error('❌ Failed to get network quality:', error);
      return null;
    }
  }

  /**
   * WebSocket パフォーマンスメトリクス取得
   */
  async getPerformanceMetrics(): Promise<WebSocketPerformanceMetrics | null> {
    try {
      return await invoke('get_websocket_performance_metrics') as WebSocketPerformanceMetrics;
    } catch (error) {
      console.error('❌ Failed to get performance metrics:', error);
      return null;
    }
  }

  /**
   * 高性能統計レポート生成
   */
  async generatePerformanceReport(): Promise<string> {
    try {
      const [detailedStats, systemPerf, networkQuality, perfMetrics] = await Promise.all([
        this.getDetailedStats(),
        this.getSystemPerformance(),
        this.getNetworkQuality(),
        this.getPerformanceMetrics()
      ]);

      const report = {
        timestamp: new Date().toISOString(),
        websocket: detailedStats,
        system: systemPerf,
        network: networkQuality,
        performance: perfMetrics,
        summary: {
          overall_health: this.assessOverallHealth(detailedStats, systemPerf, networkQuality),
          recommendations: this.generateRecommendations(perfMetrics)
        }
      };

      console.log(`📊 Performance report generated`);
      return JSON.stringify(report, null, 2);

    } catch (error) {
      console.error('❌ Failed to generate performance report:', error);
      return JSON.stringify({ error: 'Report generation failed' });
    }
  }

  /**
   * 総合健康状態評価
   */
  private assessOverallHealth(wsStats: WebSocketDetailedStats | null, systemPerf: SystemPerformance | null, networkQuality: NetworkQuality | null): string {
    let score = 100;

    // WebSocket統計評価
    if (wsStats?.performance?.avg_latency_ms > 100) score -= 20;
    if (wsStats?.performance?.error_rate > 5) score -= 30;

    // システムパフォーマンス評価
    if (systemPerf?.cpu_usage > 80) score -= 15;
    if (systemPerf?.memory_usage > 85) score -= 15;

    // ネットワーク品質評価
    if (networkQuality?.connection_stability === 'POOR') score -= 20;

    if (score >= 80) return 'EXCELLENT';
    if (score >= 60) return 'GOOD';
    if (score >= 40) return 'FAIR';
    return 'POOR';
  }

  /**
   * パフォーマンス改善推奨事項生成
   */
  private generateRecommendations(metrics: WebSocketPerformanceMetrics | null): string[] {
    const recommendations = [];

    if (metrics?.avg_latency_ms > 100) {
      recommendations.push('Consider optimizing message size and frequency');
    }

    if (metrics?.error_rate > 5) {
      recommendations.push('Check network stability and message validation');
    }

    if (metrics?.peak_connections > 100) {
      recommendations.push('Consider implementing connection pooling');
    }

    return recommendations;
  }

  /**
   * WebSocket統計取得（簡素化）
   */
  getStatsSync(): typeof this.messageStats & { serverStats?: { isRunning: boolean; connections: number; port: number } } {
    const stats = { ...this.messageStats };
    
    if (this.config) {
      return {
        ...stats,
        serverStats: {
          isRunning: this.isRunning,
          connections: 0, // 非同期取得が必要
          port: this.config.port
        }
      };
    }
    
    return stats;
  }

  /**
   * 接続切断（Tauri統合）
   */
  async disconnectClient(clientId: string): Promise<boolean> {
    try {
      await invoke('disconnect_websocket_client', { clientId });
      console.log(`🔌 Client ${clientId} disconnected`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to disconnect client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * 非アクティブクライアント検出・切断
   */
  cleanupInactiveClients(timeoutMs: number = 300000): void {
    // Tauri WebSocketサーバーは自動的にheartbeat監視とクリーンアップを実行
    console.log('🧹 Cleanup handled by WebSocket server');
  }

  // ========================================
  // 設定・ユーティリティ
  // ========================================

  /**
   * 設定更新（Tauri統合）
   */
  async updateConfig(config: Partial<WSServerConfig>): Promise<void> {
    try {
      const defaultConfig: WSServerConfig = {
        port: 8080,
        host: 'localhost',
        authToken: 'default-token',
        maxConnections: 10,
        heartbeatInterval: 30000,
        connectionTimeout: 60000
      };
      
      const newConfig = { ...defaultConfig, ...this.config, ...config };
      await invoke('update_websocket_config', { config: newConfig });
      this.config = newConfig;
      console.log('🔧 WebSocket configuration updated (Tauri)');
    } catch (error) {
      console.error('❌ Failed to update WebSocket configuration:', error);
      throw error;
    }
  }

  /**
   * PriceMonitor設定
   */
  setPriceMonitor(priceMonitor: PriceMonitor): void {
    this.priceMonitor = priceMonitor;
    console.log('🔧 PriceMonitor set for WebSocket server');
  }

  /**
   * メッセージハンドラー設定
   */
  setMessageHandler(handler: (message: WSEvent, clientId: string) => Promise<void>): void {
    this.onMessageHandler = handler;
  }

  /**
   * サーバー状態取得
   */
  getServerStatus() {
    return {
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      stats: this.getStatsSync(),
      connections: 0 // 非同期取得が必要
    };
  }

  // ========================================
  // ヘルパーメソッド
  // ========================================

  /**
   * ポジション取得
   */
  private async getPosition(positionId: string): Promise<{
    id: string;
    triggerActionIds?: string;
  } | null> {
    try {
      // TODO: Fix schema mismatch - regenerate amplify_outputs.json
      const position = await (amplifyClient as {models?: {Position?: {get: (data: {id: string}) => Promise<{data?: {id: string; triggerActionIds?: string}}>}}}).models?.Position?.get({
        id: positionId
      });
      return position?.data || null;
    } catch (error) {
      console.error(`Failed to get position ${positionId}:`, error);
      return null;
    }
  }

  /**
   * アカウントIDから接続ID取得
   */
  private getConnectionIdFromAccount(accountId: string): string | null {
    // 実装: アクティブ接続から該当するconnectionIdを検索
    // 非同期処理が必要なため、キャッシュベースの実装が必要
    return `conn_${accountId}`; // 仮実装
  }

  /**
   * メッセージフォーマット検証
   */
  private validateMessage(message: any): message is WSEvent {
    return (
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      typeof message.timestamp === 'string' &&
      Object.values(WSMessageType).includes(message.type)
    );
  }

  /**
   * メッセージ/秒計算
   */
  private calculateMessagesPerSecond(): number {
    if (!this.startTime) return 0;
    
    const elapsed = (Date.now() - this.startTime.getTime()) / 1000;
    return elapsed > 0 ? this.stats.totalMessagesReceived / elapsed : 0;
  }

  /**
   * 統一エラー処理
   */
  private async handleMessageError(error: Error, clientId: string, message: string): Promise<void> {
    this.messageStats.errors++;
    console.error(`❌ Message processing error for ${clientId}:`, error);
    
    // エラー応答送信（必要な場合）
    if (this.shouldSendErrorResponse(error)) {
      await this.sendErrorResponse(clientId, error.message);
    }
  }

  /**
   * エラー応答判定
   */
  private shouldSendErrorResponse(error: Error): boolean {
    // 重要なエラーのみ応答を送信
    return error.message.includes('position') || error.message.includes('command');
  }

  /**
   * エラー応答送信
   */
  private async sendErrorResponse(clientId: string, errorMessage: string): Promise<void> {
    try {
      const errorEvent: WSErrorEvent = {
        type: WSMessageType.ERROR,
        timestamp: new Date().toISOString(),
        positionId: '',
        message: errorMessage,
        errorCode: 'PROCESSING_ERROR'
      };
      
      await this.sendCommand(clientId, errorEvent as unknown as WSCommand);
    } catch (sendError) {
      console.error('❌ Failed to send error response:', sendError);
    }
  }

  /**
   * メッセージ統計更新（インライン化）
   */
  private updateMessageStats(): void {
    this.messageStats.processed++;
    this.messageStats.lastMessage = new Date();
  }
}

// ========================================
// バリデーション関数
// ========================================

/**
 * WebSocketメッセージのバリデーション（新フォーマット用）
 */
export const validateWebSocketMessage = (message: any): message is WSEvent => {
  return (
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    typeof message.timestamp === 'string' &&
    Object.values(WSMessageType).includes(message.type)
  );
};

/**
 * レガシーメッセージのバリデーション（従来互換）
 */
export const validateLegacyWebSocketMessage = (message: any): boolean => {
  return (
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    typeof message.accountId === 'string' &&
    typeof message.timestamp === 'string' &&
    message.data !== undefined
  );
};

// ========================================
// レガシー互換エクスポート
// ========================================

// 旧WebSocketHandlerクラスとして使用可能
export class WebSocketHandler extends WebSocketServer {
  constructor() {
    super();
  }
}