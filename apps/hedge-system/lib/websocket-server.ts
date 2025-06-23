import { WebSocketServer, WebSocket } from 'ws';
import { 
  WSMessage, 
  WSCommand, 
  WSEvent, 
  WSMessageType,
  WSPingMessage,
  WSPongMessage 
} from '@repo/shared-types';
import { EAConnectionManager, EAConnection } from './ea-connection-manager';
import { MessageProcessor } from './message-processor';
import { WSErrorHandler } from './ws-error-handler';

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

/**
 * Hedge System WebSocket Server
 * MT4/MT5 EAとの通信を管理するWebSocketサーバー
 */
export class HedgeWebSocketServer {
  private wss?: WebSocketServer;
  private connectionManager: EAConnectionManager;
  private messageProcessor: MessageProcessor;
  private isRunning = false;
  private startTime?: Date;
  private heartbeatTimer?: NodeJS.Timeout;
  
  // 統計情報
  private stats = {
    totalMessagesReceived: 0,
    totalMessagesSent: 0,
    errors: 0
  };

  constructor(
    private config: WSServerConfig,
    messageProcessor?: MessageProcessor
  ) {
    this.connectionManager = new EAConnectionManager(config);
    this.messageProcessor = messageProcessor || new MessageProcessor();
  }

  /**
   * WebSocketサーバー開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('WebSocket server is already running');
    }

    try {
      this.wss = new WebSocketServer({
        port: this.config.port,
        host: this.config.host,
        maxPayload: 64 * 1024 // 64KB max message size
      });

      this.setupEventHandlers();
      this.startHeartbeat();
      
      this.isRunning = true;
      this.startTime = new Date();
      
      WSErrorHandler.logEvent('SERVER_STARTED', { 
        port: this.config.port, 
        host: this.config.host 
      });

      console.log(`🚀 Hedge WebSocket Server started on ${this.config.host}:${this.config.port}`);
      
    } catch (error) {
      WSErrorHandler.handleConnectionError(error as Error, 'SERVER_START');
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
      this.stopHeartbeat();
      await this.connectionManager.disconnectAll();
      
      if (this.wss) {
        this.wss.close();
        this.wss = undefined;
      }

      this.isRunning = false;
      
      WSErrorHandler.logEvent('SERVER_STOPPED', {});
      console.log('🛑 Hedge WebSocket Server stopped');

    } catch (error) {
      WSErrorHandler.handleConnectionError(error as Error, 'SERVER_STOP');
      throw error;
    }
  }

  /**
   * イベントハンドラー設定
   */
  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', (error) => {
      WSErrorHandler.handleConnectionError(error, 'WSS_ERROR');
    });
    
    // 接続数制限チェック
    this.wss.on('connection', (ws, request) => {
      if (this.connectionManager.getConnectionCount() >= this.config.maxConnections) {
        ws.close(1013, 'Server overloaded');
        WSErrorHandler.logEvent('CONNECTION_REJECTED', { 
          reason: 'max_connections_exceeded',
          maxConnections: this.config.maxConnections 
        });
      }
    });
  }

  /**
   * 新規接続処理（設計書6-2準拠の認証・接続シーケンス）
   */
  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const connectionId = this.generateConnectionId();
    const clientIP = request.socket.remoteAddress;
    
    try {
      // 1. 認証情報確認
      const authToken = this.extractAuthToken(request);
      if (!authToken || !await this.validateAuthToken(authToken)) {
        ws.close(4001, 'Authentication failed');
        WSErrorHandler.logEvent('AUTH_FAILED', { connectionId, clientIP });
        return;
      }

      // 2. 接続情報抽出
      const accountId = this.extractAccountId(request);
      const sessionId = this.generateSessionId();

      // 3. 接続受諾メッセージ送信
      const acceptMessage = {
        type: 'ACCEPT',
        sessionId,
        timestamp: new Date().toISOString()
      };
      ws.send(JSON.stringify(acceptMessage));

      // 4. 口座状態更新
      await this.updateAccountStatus(accountId, {
        pcId: sessionId,
        status: 'ONLINE',
        lastUpdated: new Date()
      });

      // 接続をマネージャーに追加
      const connection = await this.connectionManager.addConnection(connectionId, ws);
      
      // 追加情報を接続に設定
      if (connection) {
        connection.sessionId = sessionId;
        connection.accountId = accountId;
        connection.authenticated = true;
      }
      
      // WebSocketイベントリスナー設定
      ws.on('message', (data) => this.handleMessage(data, connectionId));
      ws.on('close', () => this.handleDisconnection(connectionId, accountId));
      ws.on('error', (error) => this.handleConnectionError(error, connectionId));
      ws.on('pong', () => this.handlePong(connectionId));

      WSErrorHandler.logEvent('CONNECTION_ESTABLISHED', { 
        connectionId, 
        accountId,
        sessionId,
        clientIP,
        totalConnections: this.connectionManager.getConnectionCount()
      });

      console.log(`🔗 EA connected: ${accountId} (${sessionId})`);

    } catch (error) {
      WSErrorHandler.handleConnectionError(error as Error, connectionId);
      ws.close(1011, 'Unexpected error');
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
   * メッセージ受信処理
   */
  private async handleMessage(data: any, connectionId: string): Promise<void> {
    this.stats.totalMessagesReceived++;
    
    try {
      const message: WSEvent = JSON.parse(data.toString());
      
      // メッセージバリデーション
      if (!this.validateMessage(message)) {
        throw new Error('Invalid message format');
      }

      // 接続認証状態チェック
      const connection = this.connectionManager.getConnection(connectionId);
      if (!connection?.authenticated && message.type !== WSMessageType.INFO) {
        throw new Error('Connection not authenticated');
      }

      // heartbeat更新
      this.connectionManager.updateHeartbeat(connectionId);

      // メッセージ処理
      await this.messageProcessor.processIncomingMessage(connectionId, message);

      WSErrorHandler.logEvent('MESSAGE_PROCESSED', { 
        connectionId, 
        messageType: message.type 
      });

    } catch (error) {
      this.stats.errors++;
      WSErrorHandler.handleMessageError(error as Error, { connectionId, data });
      
      // エラー応答送信
      await this.sendError(connectionId, 'Message processing failed');
    }
  }

  /**
   * 接続切断処理
   */
  private handleDisconnection(connectionId: string, accountId?: string): void {
    this.connectionManager.removeConnection(connectionId);
    
    // 口座状態をオフラインに更新
    if (accountId) {
      this.updateAccountStatus(accountId, {
        pcId: '',
        status: 'OFFLINE',
        lastUpdated: new Date()
      }).catch(error => {
        WSErrorHandler.logEvent('ACCOUNT_STATUS_UPDATE_FAILED', { accountId, error });
      });
    }
    
    WSErrorHandler.logEvent('CONNECTION_CLOSED', { 
      connectionId,
      accountId,
      remainingConnections: this.connectionManager.getConnectionCount()
    });
  }

  /**
   * 接続エラー処理
   */
  private handleConnectionError(error: Error, connectionId: string): void {
    this.stats.errors++;
    WSErrorHandler.handleConnectionError(error, connectionId);
    this.connectionManager.removeConnection(connectionId);
  }

  /**
   * Pong応答処理
   */
  private handlePong(connectionId: string): void {
    this.connectionManager.updateHeartbeat(connectionId);
  }

  /**
   * EAにコマンド送信
   */
  async sendCommand(connectionId: string, command: WSCommand): Promise<boolean> {
    try {
      const connection = this.connectionManager.getConnection(connectionId);
      if (!connection || !connection.authenticated) {
        throw new Error(`Connection not found or not authenticated: ${connectionId}`);
      }

      const message = JSON.stringify(command);
      connection.ws.send(message);
      
      this.stats.totalMessagesSent++;
      
      WSErrorHandler.logEvent('COMMAND_SENT', { 
        connectionId, 
        commandType: command.type 
      });

      return true;

    } catch (error) {
      this.stats.errors++;
      WSErrorHandler.handleMessageError(error as Error, { connectionId, command });
      return false;
    }
  }

  /**
   * 全接続にメッセージブロードキャスト
   */
  broadcast(message: WSMessage): void {
    const connections = this.connectionManager.getActiveConnections();
    const messageStr = JSON.stringify(message);
    
    let sentCount = 0;
    connections.forEach(connection => {
      try {
        connection.ws.send(messageStr);
        sentCount++;
      } catch (error) {
        WSErrorHandler.handleConnectionError(error as Error, connection.connectionId);
      }
    });

    this.stats.totalMessagesSent += sentCount;
    WSErrorHandler.logEvent('MESSAGE_BROADCAST', { 
      messageType: message.type, 
      sentTo: sentCount 
    });
  }

  /**
   * エラー応答送信
   */
  private async sendError(connectionId: string, errorMessage: string): Promise<void> {
    const errorEvent: WSEvent = {
      type: WSMessageType.ERROR,
      timestamp: new Date().toISOString(),
      message: errorMessage
    };

    await this.sendCommand(connectionId, errorEvent as any);
  }

  /**
   * heartbeat開始
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.pingAllConnections();
      this.connectionManager.checkHeartbeats();
    }, this.config.heartbeatInterval);
  }

  /**
   * heartbeat停止  
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 全接続にPing送信
   */
  private pingAllConnections(): void {
    const pingMessage: WSPingMessage = {
      type: WSMessageType.PING,
      timestamp: new Date().toISOString()
    };

    const connections = this.connectionManager.getActiveConnections();
    connections.forEach(connection => {
      try {
        connection.ws.ping();
        this.sendCommand(connection.connectionId, pingMessage);
      } catch (error) {
        WSErrorHandler.handleConnectionError(error as Error, connection.connectionId);
      }
    });
  }

  /**
   * サーバー統計取得
   */
  getStats(): WSServerStats {
    return {
      isRunning: this.isRunning,
      activeConnections: this.connectionManager.getConnectionCount(),
      totalMessagesReceived: this.stats.totalMessagesReceived,
      totalMessagesSent: this.stats.totalMessagesSent,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      errors: this.stats.errors
    };
  }

  /**
   * アクティブ接続取得
   */
  getActiveConnections(): EAConnection[] {
    return this.connectionManager.getActiveConnections();
  }

  /**
   * ユーティリティメソッド
   */
  private generateConnectionId(): string {
    return `ea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractAuthToken(request: any): string | null {
    return request.headers.authorization?.replace('Bearer ', '') || null;
  }

  private validateAuthTokenSync(token: string | null): boolean {
    return token === this.config.authToken;
  }

  private validateMessage(message: any): message is WSEvent {
    return (
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      typeof message.timestamp === 'string' &&
      Object.values(WSMessageType).includes(message.type)
    );
  }
}