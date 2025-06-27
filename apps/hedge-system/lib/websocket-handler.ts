/**
 * WebSocket Handler - Tauri v2統合実装
 * MT4/MT5 EA制御・リアルタイム通信管理
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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
  WSOpenCommand,
  WSCloseCommand
} from './types';
import { Symbol, ExecutionType } from '@repo/shared-types';
import { PriceMonitor } from './price-monitor';

// ========================================
// インターフェース定義
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
  connectedClients: number;
  totalMessagesReceived: number;
  totalMessagesSent: number;
  errors: number;
  uptime: number;
}

export interface EAConnection {
  connectionId: string;
  accountId?: string;
  authenticated: boolean;
  connectedAt: Date;
  lastHeartbeat: Date;
  eaInfo?: {
    version: string;
    platform: string;
    account: string;
  };
}


// ========================================
// WebSocketHandler - 高性能実装
// ========================================

/**
 * WebSocketHandler - Rust WebSocketサーバー統合
 * 主要機能：
 * 1. Tauri IPC経由でRust WebSocketサーバーと通信
 * 2. MT4/MT5 コマンド送信（OPEN, CLOSE, MODIFY）
 * 3. イベント受信・処理（OPENED, CLOSED, PRICE更新）
 * 4. トレール監視エンジン統合
 * 5. エラーハンドリング・自動再接続
 */
export class WebSocketHandler {
  private connected = false;
  private isInitialized = false;
  private startTime?: Date;
  private config?: WSServerConfig;
  private eventUnsubscribe?: () => void;
  public priceMonitor?: PriceMonitor;
  
  // イベントハンドラー
  private onOpenedHandler?: (event: WSOpenedEvent) => Promise<void>;
  private onClosedHandler?: (event: WSClosedEvent) => Promise<void>;
  private onStoppedHandler?: (event: WSStoppedEvent) => Promise<void>;
  private onErrorHandler?: (event: WSErrorEvent) => Promise<void>;
  private onPriceHandler?: (event: WSPriceEvent) => Promise<void>;
  
  // 統計情報
  private stats = {
    totalMessagesReceived: 0,
    totalMessagesSent: 0,
    errors: 0,
    latency: 0
  };
  
  // 接続管理
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // ミリ秒
  
  private actionSync?: any; // ActionSyncとの統合用
  
  constructor() {
    this.setupEventListeners();
  }
  
  /**
   * ActionSyncとの統合設定
   */
  setActionSync(actionSync: any): void {
    this.actionSync = actionSync;
    console.log('🔧 ActionSync integration enabled');
  }
  
  // ========================================
  // 接続管理
  // ========================================
  
  /**
   * WebSocket接続（Rust サーバー起動）
   */
  async connect(port: number = 8080): Promise<void> {
    if (this.connected) {
      console.warn('⚠️ WebSocket already connected');
      return;
    }
    
    try {
      this.config = {
        port,
        host: '127.0.0.1', // 高速化のため直接IPアドレス使用
        authToken: 'hedge-system-high-performance-token',
        maxConnections: 50,
        heartbeatInterval: 15000,
        connectionTimeout: 180000
      };
      
      // Rust WebSocketサーバーを起動
      await invoke('start_websocket_server', {
        port: this.config.port,
        host: this.config.host,
        authToken: this.config.authToken
      });
      
      this.connected = true;
      this.isInitialized = true;
      this.startTime = new Date();
      this.reconnectAttempts = 0;
      
      console.log(`✅ WebSocket connected on ${this.config.host}:${this.config.port}`);
      
      // パフォーマンス監視開始
      this.startPerformanceMonitoring();
      
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      throw error;
    }
  }
  
  /**
   * WebSocket切断
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }
    
    try {
      // Rust WebSocketサーバーを停止
      await invoke('stop_websocket_server');
      
      // イベントリスナーを削除
      if (this.eventUnsubscribe) {
        this.eventUnsubscribe();
        this.eventUnsubscribe = undefined;
      }
      
      this.connected = false;
      console.log('🔌 WebSocket disconnected');
      
    } catch (error) {
      console.error('❌ Error disconnecting WebSocket:', error);
      throw error;
    }
  }
  
  /**
   * 接続状態確認
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * 自動再接続
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.connect(this.config?.port || 8080);
    } catch (error) {
      console.error('❌ Reconnect failed:', error);
      await this.handleReconnect();
    }
  }
  
  // ========================================
  // イベント処理
  // ========================================
  
  /**
   * イベントリスナー設定
   */
  private async setupEventListeners(): Promise<void> {
    try {
      // Tauri WebSocketイベントを受信
      this.eventUnsubscribe = await listen('websocket-event', (event) => {
        this.handleWebSocketEvent(event.payload);
      });
      
      console.log('🔧 WebSocket event listeners setup');
      
    } catch (error) {
      console.error('❌ Failed to setup event listeners:', error);
    }
  }
  
  /**
   * WebSocketイベント処理
   */
  private async handleWebSocketEvent(payload: any): Promise<void> {
    try {
      this.stats.totalMessagesReceived++;
      
      switch (payload.type) {
        case 'connection':
          console.log(`🔗 EA connected: ${payload.clientId}`);
          break;
          
        case 'disconnection':
          console.log(`🔌 EA disconnected: ${payload.clientId}`);
          break;
          
        case 'message':
          await this.handleMessage(payload.message, payload.clientId);
          break;
          
        case 'error':
          this.stats.errors++;
          console.error(`❌ WebSocket error:`, payload.error);
          
          // 接続エラーの場合は再接続
          if (payload.error.includes('connection') || payload.error.includes('disconnected')) {
            this.connected = false;
            await this.handleReconnect();
          }
          break;
      }
      
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Error handling WebSocket event:', error);
    }
  }
  
  /**
   * メッセージ処理
   */
  private async handleMessage(rawMessage: string, clientId: string): Promise<void> {
    try {
      const message = JSON.parse(rawMessage);
      
      // 設計書準拠メッセージ処理
      if (this.isDesignCompliantMessage(message)) {
        await this.handleDesignCompliantMessage(message);
      } else if (message.event) {
        // EAイベント処理
        await this.handleEAEvent(message);
      }
      
    } catch (error) {
      console.error('❌ Message processing error:', error);
      this.stats.errors++;
    }
  }
  
  /**
   * 設計書準拠メッセージ判定
   */
  private isDesignCompliantMessage(message: any): boolean {
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
        if (this.onOpenedHandler) {
          await this.onOpenedHandler(message as WSOpenedEvent);
        }
        break;
        
      case WSMessageType.CLOSED:
        if (this.onClosedHandler) {
          await this.onClosedHandler(message as WSClosedEvent);
        }
        break;
        
      case WSMessageType.STOPPED:
        if (this.onStoppedHandler) {
          await this.onStoppedHandler(message as WSStoppedEvent);
        }
        break;
        
      case WSMessageType.ERROR:
        if (this.onErrorHandler) {
          await this.onErrorHandler(message as WSErrorEvent);
        }
        break;
        
      case WSMessageType.PONG:
        // レイテンシ計算
        this.updateLatency();
        break;
        
      default:
        console.warn(`⚠️ Unknown message type: ${message.type}`);
    }
  }
  
  /**
   * EAイベント処理
   */
  private async handleEAEvent(event: any): Promise<void> {
    switch (event.event) {
      case 'PRICE_UPDATE':
        await this.handlePriceUpdate(event);
        break;
        
      case 'POSITION_OPENED':
        if (this.onOpenedHandler) {
          await this.onOpenedHandler(this.convertToOpenedEvent(event));
        }
        break;
        
      case 'POSITION_CLOSED':
        if (this.onClosedHandler) {
          await this.onClosedHandler(this.convertToClosedEvent(event));
        }
        break;
        
      case 'POSITION_STOPPED':
        if (this.onStoppedHandler) {
          await this.onStoppedHandler(this.convertToStoppedEvent(event));
        }
        break;
        
      default:
        console.warn(`⚠️ Unknown EA event: ${event.event}`);
    }
  }
  
  /**
   * 価格更新処理
   */
  private async handlePriceUpdate(event: any): Promise<void> {
    if (this.priceMonitor) {
      await this.priceMonitor.handlePriceFromEA({
        symbol: event.symbol,
        price: event.price,
        timestamp: new Date(event.timestamp || Date.now()),
        bid: event.bid,
        ask: event.ask,
        spread: event.spread
      });
    }
    
    if (this.onPriceHandler) {
      await this.onPriceHandler({
        type: WSMessageType.INFO,
        symbol: event.symbol,
        price: event.price,
        timestamp: event.timestamp || new Date().toISOString()
      });
    }
  }
  
  // ========================================
  // コマンド送信
  // ========================================
  
  /**
   * OPEN命令送信
   */
  async sendOpenCommand(params: {
    accountId: string;
    positionId: string;
    symbol: Symbol;
    volume: number;
    executionType?: ExecutionType;
  }): Promise<{ success: boolean; orderId?: string; error?: string }> {
    const startTime = Date.now();
    
    try {
      if (!this.connected) {
        throw new Error('WebSocket not connected');
      }
      
      const command = {
        type: WSMessageType.OPEN,
        timestamp: new Date().toISOString(),
        accountId: params.accountId,
        positionId: params.positionId,
        symbol: params.symbol,
        side: params.executionType === ExecutionType.ENTRY ? 'BUY' : 'SELL',
        volume: params.volume,
        metadata: {
          executionType: params.executionType || ExecutionType.ENTRY,
          timestamp: new Date().toISOString()
        }
      } as unknown as WSOpenCommand;
      
      // コマンド送信（ブロードキャスト）
      const sentCount = await invoke('broadcast_websocket_message', { 
        message: JSON.stringify(command) 
      }) as number;
      
      if (sentCount === 0) {
        throw new Error('No EA connections available');
      }
      
      this.stats.totalMessagesSent++;
      this.updateLatency(Date.now() - startTime);
      
      const orderId = `order_${Date.now()}_${params.positionId}`;
      
      console.log(`⚡ OPEN command sent: ${params.positionId} in ${Date.now() - startTime}ms`);
      
      return {
        success: true,
        orderId
      };
      
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Failed to send OPEN command:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * CLOSE命令送信
   */
  async sendCloseCommand(params: {
    accountId: string;
    positionId: string;
  }): Promise<{ success: boolean; orderId?: string; error?: string }> {
    const startTime = Date.now();
    
    try {
      if (!this.connected) {
        throw new Error('WebSocket not connected');
      }
      
      const command: WSCloseCommand = {
        type: WSMessageType.CLOSE,
        timestamp: new Date().toISOString(),
        accountId: params.accountId,
        positionId: params.positionId
      };
      
      // コマンド送信（ブロードキャスト）
      const sentCount = await invoke('broadcast_websocket_message', { 
        message: JSON.stringify(command) 
      }) as number;
      
      if (sentCount === 0) {
        throw new Error('No EA connections available');
      }
      
      this.stats.totalMessagesSent++;
      this.updateLatency(Date.now() - startTime);
      
      const orderId = `close_${Date.now()}_${params.positionId}`;
      
      console.log(`⚡ CLOSE command sent: ${params.positionId} in ${Date.now() - startTime}ms`);
      
      return {
        success: true,
        orderId
      };
      
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Failed to send CLOSE command:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // ========================================
  // イベントハンドラー設定
  // ========================================
  
  /**
   * OPENEDイベントハンドラー設定
   */
  onOpened(handler: (event: WSOpenedEvent) => Promise<void>): void {
    this.onOpenedHandler = handler;
  }
  
  /**
   * CLOSEDイベントハンドラー設定
   */
  onClosed(handler: (event: WSClosedEvent) => Promise<void>): void {
    this.onClosedHandler = handler;
  }
  
  /**
   * STOPPEDイベントハンドラー設定
   */
  onStopped(handler: (event: WSStoppedEvent) => Promise<void>): void {
    this.onStoppedHandler = handler;
  }
  
  /**
   * ERRORイベントハンドラー設定
   */
  onError(handler: (event: WSErrorEvent) => Promise<void>): void {
    this.onErrorHandler = handler;
  }
  
  /**
   * 価格更新イベントハンドラー設定
   */
  onPrice(handler: (event: WSPriceEvent) => Promise<void>): void {
    this.onPriceHandler = handler;
  }
  
  // ========================================
  // パフォーマンス・統計
  // ========================================
  
  /**
   * パフォーマンス監視開始
   */
  private startPerformanceMonitoring(): void {
    // 定期的なパフォーマンスチェック（30秒間隔）
    setInterval(async () => {
      try {
        const metrics = await invoke('get_websocket_performance_metrics') as any;
        
        if (metrics.avg_latency_ms > 100) {
          console.warn(`⚠️ High latency detected: ${metrics.avg_latency_ms}ms`);
        }
        
        if (metrics.error_rate > 5) {
          console.warn(`⚠️ High error rate: ${metrics.error_rate}%`);
        }
        
      } catch (error) {
        console.error('❌ Performance monitoring error:', error);
      }
    }, 30000);
  }
  
  /**
   * レイテンシ更新
   */
  private updateLatency(latency?: number): void {
    if (latency !== undefined) {
      this.stats.latency = latency;
    } else {
      // PING-PONG間のレイテンシ計算
      // TODO: PING送信時刻を記録して正確な計算を行う
      this.stats.latency = 0;
    }
  }
  
  /**
   * 統計情報取得
   */
  async getStats(): Promise<WSServerStats> {
    try {
      const serverStats = await invoke('get_websocket_server_status') as any;
      
      return {
        isRunning: serverStats.is_running || this.connected,
        connectedClients: serverStats.connected_clients || 0,
        totalMessagesReceived: serverStats.total_messages_received || this.stats.totalMessagesReceived,
        totalMessagesSent: serverStats.total_messages_sent || this.stats.totalMessagesSent,
        errors: serverStats.errors || this.stats.errors,
        uptime: serverStats.uptime_seconds ? serverStats.uptime_seconds * 1000 : 
                (this.startTime ? Date.now() - this.startTime.getTime() : 0)
      };
      
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      
      return {
        isRunning: this.connected,
        connectedClients: 0,
        totalMessagesReceived: this.stats.totalMessagesReceived,
        totalMessagesSent: this.stats.totalMessagesSent,
        errors: this.stats.errors,
        uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0
      };
    }
  }
  
  /**
   * 接続品質取得
   */
  async getConnectionQuality(): Promise<{
    latency: number;
    quality: 'EXCELLENT' | 'GOOD' | 'POOR';
  }> {
    const quality = this.stats.latency < 50 ? 'EXCELLENT' :
                   this.stats.latency < 100 ? 'GOOD' : 'POOR';
    
    return {
      latency: this.stats.latency,
      quality
    };
  }
  
  // ========================================
  // ユーティリティ
  // ========================================
  
  /**
   * PriceMonitor設定
   */
  setPriceMonitor(priceMonitor: PriceMonitor): void {
    this.priceMonitor = priceMonitor;
    console.log('🔧 PriceMonitor set');
  }
  
  /**
   * EAイベントを標準フォーマットに変換
   */
  private convertToOpenedEvent(event: any): WSOpenedEvent {
    return {
      type: WSMessageType.OPENED,
      timestamp: event.timestamp || new Date().toISOString(),
      accountId: event.accountId,
      positionId: event.positionId,
      orderId: event.orderId || 0,
      price: event.price,
      time: event.time || new Date().toISOString(),
      mtTicket: event.mtTicket
    };
  }
  
  private convertToClosedEvent(event: any): WSClosedEvent {
    return {
      type: WSMessageType.CLOSED,
      timestamp: event.timestamp || new Date().toISOString(),
      accountId: event.accountId,
      positionId: event.positionId,
      price: event.price,
      profit: event.profit || 0,
      time: event.time || new Date().toISOString(),
      mtTicket: event.mtTicket
    };
  }
  
  private convertToStoppedEvent(event: any): WSStoppedEvent {
    return {
      type: WSMessageType.STOPPED,
      timestamp: event.timestamp || new Date().toISOString(),
      accountId: event.accountId,
      positionId: event.positionId,
      price: event.price,
      time: event.time || new Date().toISOString(),
      reason: event.reason || 'STOP_OUT'
    };
  }
}

// シングルトンインスタンス
export const webSocketHandler = new WebSocketHandler();