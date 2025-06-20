import { EventEmitter } from 'events';
import {
  EAConnection,
  EAMessage,
  EACommand,
  EAConnectionStats,
  EAError,
  EASettings,
  PositionUpdateData,
  AccountUpdateData,
  HeartbeatData,
  CommandResponse,
} from './types';

export class EAConnectionManager extends EventEmitter {
  private connections: Map<string, EAConnection> = new Map();
  private pendingCommands: Map<string, EACommand> = new Map();
  private stats: EAConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    uptime: 0,
    messagesReceived: 0,
    messagesSent: 0,
    averageLatency: 0,
  };
  private errors: EAError[] = [];
  private settings: EASettings = {
    autoReconnect: true,
    reconnectInterval: 5000,
    heartbeatInterval: 30000,
    commandTimeout: 10000,
    maxRetries: 3,
    logLevel: 'info',
    enableMetrics: true,
  };
  private heartbeatInterval?: NodeJS.Timeout;
  private commandTimeoutInterval?: NodeJS.Timeout;
  private startTime: Date = new Date();

  constructor(settings?: Partial<EASettings>) {
    super();
    if (settings) {
      this.settings = { ...this.settings, ...settings };
    }
    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    // ハートビート監視
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, this.settings.heartbeatInterval);

    // コマンドタイムアウト監視
    this.commandTimeoutInterval = setInterval(() => {
      this.checkCommandTimeouts();
    }, 1000);
  }

  /**
   * EA接続を登録
   */
  registerConnection(accountId: string, connectionInfo: Partial<EAConnection>): void {
    const existingConnection = this.connections.get(accountId);
    
    const connection: EAConnection = {
      accountId,
      clientPCId: connectionInfo.clientPCId || '',
      status: 'connected',
      lastSeen: new Date(),
      version: connectionInfo.version || 'unknown',
      broker: connectionInfo.broker || 'unknown',
      accountNumber: connectionInfo.accountNumber || 'unknown',
      connectionInfo: {
        ipAddress: connectionInfo.connectionInfo?.ipAddress || 'unknown',
        userAgent: connectionInfo.connectionInfo?.userAgent || 'unknown',
        connectedAt: new Date(),
      },
    };

    this.connections.set(accountId, connection);
    
    if (!existingConnection) {
      this.stats.totalConnections++;
    }
    
    this.updateStats();
    this.emit('connectionRegistered', connection);
    this.log('info', `EA connected: ${accountId}`);
  }

  /**
   * EA接続を削除
   */
  unregisterConnection(accountId: string): void {
    const connection = this.connections.get(accountId);
    if (connection) {
      connection.status = 'disconnected';
      this.connections.delete(accountId);
      this.updateStats();
      this.emit('connectionUnregistered', connection);
      this.log('info', `EA disconnected: ${accountId}`);
    }
  }

  /**
   * メッセージを処理
   */
  handleMessage(accountId: string, message: EAMessage): void {
    const connection = this.connections.get(accountId);
    if (!connection) {
      this.log('warn', `Message from unknown EA: ${accountId}`);
      return;
    }

    // 接続状態を更新
    connection.lastSeen = new Date();
    connection.status = 'connected';

    this.stats.messagesReceived++;

    switch (message.type) {
      case 'position_update':
        this.handlePositionUpdate(accountId, message);
        break;
      case 'account_update':
        this.handleAccountUpdate(accountId, message);
        break;
      case 'heartbeat':
        this.handleHeartbeat(accountId, message);
        break;
      case 'command_response':
        this.handleCommandResponse(accountId, message);
        break;
      default:
        this.log('warn', `Unknown message type: ${(message as any).type}`);
    }
  }

  /**
   * コマンドを送信
   */
  async sendCommand(accountId: string, command: Omit<EACommand, 'id' | 'timestamp' | 'status' | 'retryCount'>): Promise<string> {
    const connection = this.connections.get(accountId);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`EA not connected: ${accountId}`);
    }

    const fullCommand: EACommand = {
      ...command,
      id: this.generateCommandId(),
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
      maxRetries: command.maxRetries || this.settings.maxRetries,
    };

    this.pendingCommands.set(fullCommand.id, fullCommand);
    
    try {
      await this.sendMessageToEA(accountId, fullCommand);
      fullCommand.status = 'sent';
      this.stats.messagesSent++;
      this.emit('commandSent', fullCommand);
      return fullCommand.id;
    } catch (error) {
      fullCommand.status = 'failed';
      this.emit('commandFailed', fullCommand, error);
      throw error;
    }
  }

  /**
   * 接続状態を取得
   */
  getConnection(accountId: string): EAConnection | undefined {
    return this.connections.get(accountId);
  }

  /**
   * 全接続を取得
   */
  getAllConnections(): EAConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * 統計情報を取得
   */
  getStats(): EAConnectionStats {
    return { ...this.stats };
  }

  /**
   * エラー履歴を取得
   */
  getErrors(): EAError[] {
    return [...this.errors];
  }

  /**
   * WebSocketメッセージを処理
   */
  handleMessage(accountId: string, message: EAMessage): void {
    const connection = this.connections.get(accountId);
    if (!connection) {
      this.logError(accountId, 'message', 'medium', 'Message received from unregistered connection');
      return;
    }

    // 接続状態を更新
    connection.lastSeen = new Date();
    if (connection.status === 'disconnected') {
      connection.status = 'connected';
      this.emit('connectionRestored', connection);
    }

    // 統計を更新
    this.stats.messagesReceived++;

    try {
      // メッセージタイプに応じて処理
      switch (message.type) {
        case 'position_update':
          this.handlePositionUpdate(accountId, message.data as PositionUpdateData);
          break;
        case 'account_update':
          this.handleAccountUpdate(accountId, message.data as AccountUpdateData);
          break;
        case 'heartbeat':
          this.handleHeartbeat(accountId, message.data as HeartbeatData);
          break;
        case 'market_data':
          this.emit('marketData', accountId, message.data);
          break;
        case 'losscut_alert':
          this.emit('losscutAlert', accountId, message.data);
          break;
        default:
          this.logError(accountId, 'message', 'low', `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logError(accountId, 'message', 'high', 'Failed to process message', {
        messageType: message.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 設定を更新
   */
  updateSettings(newSettings: Partial<EASettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settingsUpdated', this.settings);
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.commandTimeoutInterval) {
      clearInterval(this.commandTimeoutInterval);
    }
    this.removeAllListeners();
  }

  private handlePositionUpdate(accountId: string, data: PositionUpdateData): void {
    this.emit('positionUpdate', accountId, data);
  }

  private handleAccountUpdate(accountId: string, data: AccountUpdateData): void {
    this.emit('accountUpdate', accountId, data);
  }

  private handleHeartbeat(accountId: string, data: HeartbeatData): void {
    this.emit('heartbeat', accountId, data);
  }

  private handleCommandResponse(accountId: string, response: CommandResponse): void {
    const command = this.pendingCommands.get(response.commandId);
    if (command) {
      command.status = response.status === 'success' ? 'completed' : 'failed';
      this.pendingCommands.delete(response.commandId);
      this.emit('commandResponse', command, response);
    }
  }

  private checkHeartbeats(): void {
    const now = new Date();
    const timeoutThreshold = this.settings.heartbeatInterval * 2;

    for (const [accountId, connection] of this.connections) {
      const timeSinceLastSeen = now.getTime() - connection.lastSeen.getTime();
      
      if (timeSinceLastSeen > timeoutThreshold && connection.status === 'connected') {
        connection.status = 'disconnected';
        this.logError(accountId, 'connection', 'medium', 'Heartbeat timeout');
        this.emit('connectionTimeout', connection);
        
        if (this.settings.autoReconnect) {
          this.attemptReconnection(accountId);
        }
      }
    }
  }

  private checkCommandTimeouts(): void {
    const now = new Date();
    const timeoutThreshold = this.settings.commandTimeout;

    for (const [commandId, command] of this.pendingCommands) {
      const timeSinceCommand = now.getTime() - command.timestamp.getTime();
      
      if (timeSinceCommand > timeoutThreshold && command.status === 'sent') {
        if (command.retryCount < command.maxRetries) {
          command.retryCount++;
          command.status = 'pending';
          this.retryCommand(command);
        } else {
          command.status = 'failed';
          this.pendingCommands.delete(commandId);
          this.emit('commandTimeout', command);
        }
      }
    }
  }

  private async retryCommand(command: EACommand): Promise<void> {
    try {
      await this.sendMessageToEA(command.accountId, command);
      command.status = 'sent';
      this.emit('commandRetried', command);
    } catch (error) {
      command.status = 'failed';
      this.emit('commandFailed', command, error);
    }
  }

  private attemptReconnection(accountId: string): void {
    const connection = this.connections.get(accountId);
    if (connection) {
      connection.status = 'reconnecting';
      this.stats.lastReconnectAttempt = new Date();
      this.emit('reconnectionAttempt', connection);
    }
  }

  private async sendMessageToEA(accountId: string, message: any): Promise<void> {
    // WebSocketClient経由でメッセージを送信
    // この実装は実際のWebSocketクライアントと連携する必要がある
    this.emit('sendMessage', accountId, message);
  }

  private updateStats(): void {
    this.stats.activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'connected').length;
    this.stats.failedConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'error').length;
    this.stats.uptime = new Date().getTime() - this.startTime.getTime();
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logError(accountId: string, type: EAError['type'], severity: EAError['severity'], message: string, details?: Record<string, any>): void {
    const error: EAError = {
      accountId,
      timestamp: new Date(),
      type,
      severity,
      message,
      details,
      resolved: false,
    };

    this.errors.push(error);
    
    // エラー履歴を最新1000件に制限
    if (this.errors.length > 1000) {
      this.errors.splice(0, this.errors.length - 1000);
    }

    this.emit('error', error);
  }

  private log(level: EASettings['logLevel'], message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.settings.logLevel);
    const messageLevel = levels.indexOf(level);

    if (messageLevel >= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }
}