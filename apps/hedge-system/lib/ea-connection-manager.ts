import { WebSocket } from 'ws';

export interface EAInfo {
  version: string;
  platform: 'MT4' | 'MT5';
  account: string;
  serverName?: string;
  companyName?: string;
}

export interface EAConnection {
  connectionId: string;
  ws: WebSocket;
  authenticated: boolean;
  lastHeartbeat: Date;
  connectedAt: Date;
  eaInfo?: EAInfo;
  clientIP?: string;
  isActive: boolean;
  sessionId?: string;
  accountId?: string;
}

export interface ConnectionManagerConfig {
  maxConnections: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  authToken: string;
}

/**
 * EA接続管理クラス
 * WebSocket接続の管理、認証、heartbeat監視を担当
 */
export class EAConnectionManager {
  private connections: Map<string, EAConnection> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private connectionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(private config: ConnectionManagerConfig) {}

  /**
   * 新規EA接続追加
   */
  async addConnection(connectionId: string, ws: WebSocket, clientIP?: string): Promise<EAConnection> {
    if (this.connections.has(connectionId)) {
      throw new Error(`Connection already exists: ${connectionId}`);
    }

    if (this.connections.size >= this.config.maxConnections) {
      throw new Error('Maximum connections exceeded');
    }

    const connection: EAConnection = {
      connectionId,
      ws,
      authenticated: false,
      lastHeartbeat: new Date(),
      connectedAt: new Date(),
      clientIP,
      isActive: true
    };

    this.connections.set(connectionId, connection);

    // 接続タイムアウト設定
    this.setConnectionTimeout(connectionId);

    console.log(`🔗 Connection added: ${connectionId}`, { 
      clientIP,
      totalConnections: this.connections.size 
    });

    return connection;
  }

  /**
   * EA接続削除
   */
  removeConnection(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // WebSocket接続を安全にクローズ
    try {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1000, 'Connection removed');
      }
    } catch (error) {
      console.error(`❌ Connection error for ${connectionId}:`, error);
    }

    // タイムアウトタイマーをクリア
    this.clearConnectionTimeout(connectionId);

    // 接続を削除
    this.connections.delete(connectionId);

    console.log(`🔌 Connection removed: ${connectionId}`, {
      remainingConnections: this.connections.size 
    });

    return true;
  }

  /**
   * EA接続認証処理
   */
  authenticateConnection(connectionId: string, authData: {
    token: string;
    eaInfo: EAInfo;
  }): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`🚫 Authentication failed for ${connectionId}: connection not found`);
      return false;
    }

    // トークン検証
    if (authData.token !== this.config.authToken) {
      console.warn(`🚫 Authentication failed for ${connectionId}: invalid token`);
      return false;
    }

    // EA情報検証
    if (!this.validateEAInfo(authData.eaInfo)) {
      console.warn(`🚫 Authentication failed for ${connectionId}: invalid EA info`);
      return false;
    }

    // 認証成功
    connection.authenticated = true;
    connection.eaInfo = authData.eaInfo;
    connection.lastHeartbeat = new Date();

    // 接続タイムアウトをクリア（認証完了）
    this.clearConnectionTimeout(connectionId);

    console.log(`✅ Connection authenticated: ${connectionId}`, {
      platform: authData.eaInfo.platform,
      account: authData.eaInfo.account,
      version: authData.eaInfo.version
    });

    return true;
  }

  /**
   * アクティブな接続一覧取得
   */
  getActiveConnections(): EAConnection[] {
    return Array.from(this.connections.values()).filter(conn => 
      conn.isActive && 
      conn.authenticated &&
      conn.ws.readyState === WebSocket.OPEN
    );
  }

  /**
   * 特定接続取得
   */
  getConnection(connectionId: string): EAConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * 接続数取得
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * アカウント別接続取得
   */
  getConnectionsByAccount(account: string): EAConnection[] {
    return this.getActiveConnections().filter(conn => 
      conn.eaInfo?.account === account
    );
  }

  /**
   * プラットフォーム別接続取得
   */
  getConnectionsByPlatform(platform: 'MT4' | 'MT5'): EAConnection[] {
    return this.getActiveConnections().filter(conn => 
      conn.eaInfo?.platform === platform
    );
  }

  /**
   * heartbeat監視開始
   */
  startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return; // 既に開始済み
    }

    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();
    }, this.config.heartbeatInterval);

    console.log(`💓 Heartbeat started with interval: ${this.config.heartbeatInterval}ms`);
  }

  /**
   * heartbeat監視停止
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
      
      console.log('💓 Heartbeat stopped');
    }
  }

  /**
   * heartbeat更新
   */
  updateHeartbeat(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastHeartbeat = new Date();
      connection.isActive = true;
    }
  }

  /**
   * 各接続のheartbeatチェック
   */
  checkHeartbeats(): void {
    const now = new Date();
    const timeoutMs = this.config.connectionTimeout;
    const toRemove: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      const timeSinceLastHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
      
      if (timeSinceLastHeartbeat > timeoutMs) {
        // heartbeatタイムアウト
        connection.isActive = false;
        toRemove.push(connectionId);
        
        console.warn(`💔 Heartbeat timeout for ${connectionId}`, {
          timeSinceLastHeartbeat,
          timeoutMs,
          account: connection.eaInfo?.account
        });
      }
    }

    // タイムアウトした接続を削除
    toRemove.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    if (toRemove.length > 0) {
      console.log(`🧹 Cleaned up ${toRemove.length} timed out connections, ${this.connections.size} remaining`);
    }
  }

  /**
   * 全接続を切断
   */
  async disconnectAll(): Promise<void> {
    const connectionIds = Array.from(this.connections.keys());
    
    // 全接続にクローズメッセージを送信
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.close(1001, 'Server shutting down');
        } catch (error) {
          console.error(`❌ Connection error for ${connectionId}:`, error);
        }
      }
    }

    // 少し待ってから強制削除
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 残った接続を強制削除
    connectionIds.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    this.stopHeartbeat();

    console.log(`🔌 All connections disconnected: ${connectionIds.length} connections`);
  }

  /**
   * 接続統計取得
   */
  getConnectionStats(): {
    total: number;
    authenticated: number;
    active: number;
    byPlatform: { MT4: number; MT5: number };
    byAccount: { [account: string]: number };
  } {
    const connections = Array.from(this.connections.values());
    const authenticated = connections.filter(c => c.authenticated);
    const active = connections.filter(c => c.isActive);
    
    const byPlatform = { MT4: 0, MT5: 0 };
    const byAccount: { [account: string]: number } = {};

    authenticated.forEach(conn => {
      if (conn.eaInfo) {
        byPlatform[conn.eaInfo.platform]++;
        byAccount[conn.eaInfo.account] = (byAccount[conn.eaInfo.account] || 0) + 1;
      }
    });

    return {
      total: connections.length,
      authenticated: authenticated.length,
      active: active.length,
      byPlatform,
      byAccount
    };
  }

  /**
   * 接続情報一覧取得（デバッグ用）
   */
  getConnectionsInfo(): Array<{
    connectionId: string;
    authenticated: boolean;
    isActive: boolean;
    lastHeartbeat: Date;
    connectedAt: Date;
    platform?: string;
    account?: string;
    version?: string;
    clientIP?: string;
  }> {
    return Array.from(this.connections.values()).map(conn => ({
      connectionId: conn.connectionId,
      authenticated: conn.authenticated,
      isActive: conn.isActive,
      lastHeartbeat: conn.lastHeartbeat,
      connectedAt: conn.connectedAt,
      platform: conn.eaInfo?.platform,
      account: conn.eaInfo?.account,
      version: conn.eaInfo?.version,
      clientIP: conn.clientIP
    }));
  }

  /**
   * プライベートメソッド
   */
  private validateEAInfo(eaInfo: EAInfo): boolean {
    return (
      typeof eaInfo.version === 'string' &&
      ['MT4', 'MT5'].includes(eaInfo.platform) &&
      typeof eaInfo.account === 'string' &&
      eaInfo.account.length > 0
    );
  }

  private setConnectionTimeout(connectionId: string): void {
    const timeout = setTimeout(() => {
      const connection = this.connections.get(connectionId);
      if (connection && !connection.authenticated) {
        console.warn(`⏰ Connection authentication timeout: ${connectionId}`);
        this.removeConnection(connectionId);
      }
    }, this.config.connectionTimeout);

    this.connectionTimeouts.set(connectionId, timeout);
  }

  private clearConnectionTimeout(connectionId: string): void {
    const timeout = this.connectionTimeouts.get(connectionId);
    if (timeout) {
      clearTimeout(timeout);
      this.connectionTimeouts.delete(connectionId);
    }
  }
}