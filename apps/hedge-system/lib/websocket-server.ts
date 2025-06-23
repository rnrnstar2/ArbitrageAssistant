import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  WSMessage, 
  WSCommand, 
  WSEvent, 
  WSMessageType,
  WSPingMessage,
  WSPongMessage 
} from './types';

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

/**
 * Hedge System WebSocket Server (Tauri Integration)
 * MT4/MT5 EAとの通信を管理するWebSocketサーバー（Tauri統合版）
 */
export class HedgeWebSocketServer {
  private isRunning = false;
  private startTime?: Date;
  private eventUnsubscribe?: () => void;
  private onMessageHandler?: (message: WSEvent, clientId: string) => Promise<void>;
  
  // 統計情報（ローカルキャッシュ）
  private stats = {
    totalMessagesReceived: 0,
    totalMessagesSent: 0,
    errors: 0
  };

  constructor(
    private config: WSServerConfig
  ) {
    this.setupEventListeners();
  }

  /**
   * WebSocketサーバー開始（Tauri統合）
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('WebSocket server is already running');
    }

    try {
      // Tauri WebSocketサーバーを開始
      await invoke('start_websocket_server', {
        port: this.config.port,
        host: this.config.host,
        authToken: this.config.authToken
      });
      
      this.isRunning = true;
      this.startTime = new Date();
      
      console.log(`🚀 Hedge WebSocket Server started on ${this.config.host}:${this.config.port} (Tauri)`);
      
    } catch (error) {
      console.error('❌ Failed to start WebSocket server:', error);
      throw error;
    }
  }

  /**
   * WebSocketサーバー停止（Tauri統合）
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
      
      console.log('🛑 Hedge WebSocket Server stopped (Tauri)');

    } catch (error) {
      console.error('❌ Error stopping WebSocket server:', error);
      throw error;
    }
  }

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
  private handleWebSocketEvent(payload: any): void {
    try {
      this.stats.totalMessagesReceived++;
      
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
          console.error(`❌ WebSocket error:`, payload.error);
          break;
      }
      
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Error handling WebSocket event:', error);
    }
  }

  /**
   * メッセージ処理（MVPシステム設計準拠）
   */
  private async handleMessage(message: string, clientId: string): Promise<void> {
    try {
      const parsedMessage = JSON.parse(message);
      
      // MVPシステム設計準拠のメッセージフォーマット検証
      if (!this.validateMessage(parsedMessage)) {
        console.warn(`⚠️ Invalid message format from ${clientId}:`, parsedMessage);
        return;
      }

      console.log(`📨 Message from ${clientId}: ${parsedMessage.type}`, parsedMessage);
      
      // TODO: カスタムメッセージ処理ハンドラーを呼び出し
      if (this.onMessageHandler) {
        await this.onMessageHandler(parsedMessage, clientId);
      }
      
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Message processing error for ${clientId}:`, error);
    }
  }

  /**
   * アカウントID抽出
   */
  private extractAccountId(request: any): string {
    // URLパラメータまたはヘッダーからアカウントIDを抽出
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    return url.searchParams.get('accountId') || 
           request.headers['x-account-id'] || 
           'unknown';
  }

  /**
   * セッションID生成
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  /**
   * 口座状態更新
   */
  private async updateAccountStatus(accountId: string, status: {
    pcId: string;
    status: string;
    lastUpdated: Date;
  }): Promise<void> {
    // 実装: AWS Amplify または データベースで口座状態を更新
    console.log(`📊 Account status updated: ${accountId}`, status);
    // TODO: 実際のデータストレージとの連携実装
  }

  /**
   * 認証トークン検証（非同期対応）
   */
  private async validateAuthToken(token: string): Promise<boolean> {
    // 設計書準拠の認証処理（拡張可能）
    if (token === this.config.authToken) {
      return true;
    }
    
    // TODO: より高度な認証（JWT検証、データベース照会等）
    return false;
  }

  /**
   * エラー応答送信（Tauri統合では簡素化）
   */
  private async sendError(connectionId: string, errorMessage: string): Promise<void> {
    console.error(`❌ Error for client ${connectionId}: ${errorMessage}`);
    // Tauri統合版では、エラーは主にログ出力のみ
    // TODO: 必要に応じてTauri経由でエラー応答送信を実装
  }

  /**
   * EAにコマンド送信（Tauri統合）
   */
  async sendCommand(connectionId: string, command: WSCommand): Promise<boolean> {
    try {
      // Tauri経由でコマンドを送信（実装待ち - 現在は直接送信不可）
      // TODO: Tauri側にクライアント指定のメッセージ送信機能を実装
      
      const message = JSON.stringify(command);
      
      this.stats.totalMessagesSent++;
      
      console.log(`🗣️ Command queued for ${connectionId}: ${command.type}`);
      console.warn(`⚠️ Direct client messaging not yet implemented in Tauri WebSocket server`);

      return true;

    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Command send error for ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * 全接続にメッセージブロードキャスト（Tauri統合版では簡素化）
   */
  async broadcast(message: WSMessage): Promise<void> {
    console.log(`📡 Broadcasting ${message.type} message (Tauri managed)`);
    // Tauri WebSocketサーバーが自動的にheartbeatと接続管理を行うため
    // ブロードキャスト機能は必要に応じて後で実装
  }

  /**
   * サーバー統計取得（Tauri統合）
   */
  async getStats(): Promise<WSServerStats> {
    try {
      // Tauri WebSocketサーバーから統計を取得
      const tauriStats = await invoke('get_websocket_server_status') as any;
      
      return {
        isRunning: tauriStats.is_running || this.isRunning,
        activeConnections: tauriStats.connected_clients || 0,
        totalMessagesReceived: tauriStats.total_messages_received || this.stats.totalMessagesReceived,
        totalMessagesSent: tauriStats.total_messages_sent || this.stats.totalMessagesSent,
        uptime: tauriStats.uptime_seconds ? tauriStats.uptime_seconds * 1000 : (this.startTime ? Date.now() - this.startTime.getTime() : 0),
        errors: tauriStats.errors || this.stats.errors
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
        errors: this.stats.errors
      };
    }
  }

  /**
   * アクティブ接続取得（Tauri統合）
   */
  async getActiveConnections(): Promise<EAConnection[]> {
    try {
      // Tauri WebSocketサーバーからクライアント一覧を取得
      const tauriClients = await invoke('get_websocket_clients') as any[];
      
      return tauriClients.map(client => ({
        connectionId: client.id,
        accountId: client.ea_info?.account,
        sessionId: client.id, // セッションIDとしてclient IDを使用
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
   * メッセージハンドラー設定
   */
  setMessageHandler(handler: (message: WSEvent, clientId: string) => Promise<void>): void {
    this.onMessageHandler = handler;
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
   * ユーティリティメソッド
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
   * 設定更新（Tauri統合）
   */
  async updateConfig(config: Partial<WSServerConfig>): Promise<void> {
    try {
      const newConfig = { ...this.config, ...config };
      await invoke('update_websocket_config', { config: newConfig });
      this.config = newConfig;
      console.log('🔧 WebSocket configuration updated (Tauri)');
    } catch (error) {
      console.error('❌ Failed to update WebSocket configuration:', error);
      throw error;
    }
  }
}