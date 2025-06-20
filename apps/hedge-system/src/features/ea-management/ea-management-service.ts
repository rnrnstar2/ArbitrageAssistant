import { EventEmitter } from 'events';
import { EAConnectionManager } from './ea-connection-manager';
import { 
  AccountInfoReceiver, 
  AccountInfoReceiverConfig,
  AccountInfoStats,
  AccountInfoError
} from '../../lib/websocket/account-info-receiver';
import {
  EAConnection,
  Account,
  Position,
  EACommand,
  OpenPositionCommand,
  ClosePositionCommand,
  ModifyPositionCommand,
  SetTrailCommand,
  EAMessage,
  EAConnectionStats,
  EAError,
  EASettings,
} from './types';

export interface EAManagementServiceOptions {
  settings?: Partial<EASettings>;
  enableDataPersistence?: boolean;
  enableMetrics?: boolean;
  accountInfoReceiverConfig?: Partial<AccountInfoReceiverConfig>;
}

export class EAManagementService extends EventEmitter {
  private connectionManager: EAConnectionManager;
  private accountInfoReceiver: AccountInfoReceiver;
  private accounts: Map<string, Account> = new Map();
  private options: EAManagementServiceOptions;

  constructor(options: EAManagementServiceOptions = {}) {
    super();
    this.options = options;
    this.connectionManager = new EAConnectionManager(options.settings);
    
    // AccountInfoReceiverを初期化
    this.accountInfoReceiver = new AccountInfoReceiver({
      enablePersistence: options.enableDataPersistence,
      enableMetrics: options.enableMetrics,
      ...options.accountInfoReceiverConfig,
    });
    
    this.setupEventHandlers();
    this.setupAccountInfoReceiverHandlers();
  }

  private setupEventHandlers(): void {
    this.connectionManager.on('connectionRegistered', (connection: EAConnection) => {
      this.emit('eaConnected', connection);
    });

    this.connectionManager.on('connectionUnregistered', (connection: EAConnection) => {
      this.emit('eaDisconnected', connection);
    });

    this.connectionManager.on('positionUpdate', (accountId: string, data: any) => {
      this.handlePositionUpdate(accountId, data);
    });

    this.connectionManager.on('accountUpdate', (accountId: string, data: any) => {
      this.handleAccountUpdate(accountId, data);
    });

    this.connectionManager.on('commandResponse', (command: EACommand, response: any) => {
      this.emit('commandCompleted', command, response);
    });

    this.connectionManager.on('commandFailed', (command: EACommand, error: any) => {
      this.emit('commandFailed', command, error);
    });

    this.connectionManager.on('error', (error: EAError) => {
      this.emit('eaError', error);
    });

    // WebSocketクライアントとの連携
    this.connectionManager.on('sendMessage', (accountId: string, message: any) => {
      this.sendWebSocketMessage(accountId, message);
    });
  }

  /**
   * EA接続を監視開始
   */
  startMonitoring(): void {
    this.emit('monitoringStarted');
  }

  /**
   * EA接続を監視停止
   */
  stopMonitoring(): void {
    this.connectionManager.dispose();
    this.emit('monitoringStopped');
  }

  /**
   * WebSocketメッセージを処理
   */
  handleWebSocketMessage(accountId: string, message: EAMessage): void {
    // AccountInfoReceiverでアカウント情報メッセージを処理
    this.accountInfoReceiver.handleMessage(message);
    
    // 既存の処理も継続
    this.connectionManager.handleMessage(accountId, message);
  }

  /**
   * EAを登録
   */
  registerEA(accountId: string, connectionInfo: Partial<EAConnection>): void {
    this.connectionManager.registerConnection(accountId, connectionInfo);
  }

  /**
   * EAの登録を解除
   */
  unregisterEA(accountId: string): void {
    this.connectionManager.unregisterConnection(accountId);
    this.accounts.delete(accountId);
  }

  /**
   * 新規ポジションを開く
   */
  async openPosition(accountId: string, command: OpenPositionCommand): Promise<string> {
    this.validateConnection(accountId);
    
    return await this.connectionManager.sendCommand(accountId, {
      accountId,
      type: 'open_position',
      payload: command,
      maxRetries: 3,
    });
  }

  /**
   * ポジションを決済
   */
  async closePosition(accountId: string, command: ClosePositionCommand): Promise<string> {
    this.validateConnection(accountId);
    
    return await this.connectionManager.sendCommand(accountId, {
      accountId,
      type: 'close_position',
      payload: command,
      maxRetries: 3,
    });
  }

  /**
   * ポジションを修正
   */
  async modifyPosition(accountId: string, command: ModifyPositionCommand): Promise<string> {
    this.validateConnection(accountId);
    
    return await this.connectionManager.sendCommand(accountId, {
      accountId,
      type: 'modify_position',
      payload: command,
      maxRetries: 3,
    });
  }

  /**
   * トレール設定
   */
  async setTrail(accountId: string, command: SetTrailCommand): Promise<string> {
    this.validateConnection(accountId);
    
    return await this.connectionManager.sendCommand(accountId, {
      accountId,
      type: 'set_trail',
      payload: command,
      maxRetries: 3,
    });
  }

  /**
   * 緊急停止
   */
  async emergencyStop(accountId: string): Promise<string> {
    this.validateConnection(accountId);
    
    return await this.connectionManager.sendCommand(accountId, {
      accountId,
      type: 'emergency_stop',
      payload: {},
      maxRetries: 1,
    });
  }

  /**
   * 全ポジションを一括決済
   */
  async closeAllPositions(accountId: string): Promise<string[]> {
    const account = this.accounts.get(accountId);
    if (!account || !account.positions.length) {
      return [];
    }

    const commandIds: string[] = [];
    
    for (const position of account.positions) {
      try {
        const commandId = await this.closePosition(accountId, {
          ticket: position.ticket,
        });
        commandIds.push(commandId);
      } catch (error) {
        console.error(`Failed to close position ${position.ticket}:`, error);
      }
    }

    return commandIds;
  }

  /**
   * 複数口座の一括操作
   */
  async executeMultiAccountOperation(
    accountIds: string[],
    operation: (accountId: string) => Promise<any>
  ): Promise<Map<string, { success: boolean; result?: any; error?: any }>> {
    const results = new Map<string, { success: boolean; result?: any; error?: any }>();
    
    const promises = accountIds.map(async (accountId) => {
      try {
        const result = await operation(accountId);
        results.set(accountId, { success: true, result });
      } catch (error) {
        results.set(accountId, { success: false, error });
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * 接続状態を取得
   */
  getConnectionStatus(accountId: string): EAConnection | undefined {
    return this.connectionManager.getConnection(accountId);
  }

  /**
   * 全接続状態を取得
   */
  getAllConnectionStatuses(): EAConnection[] {
    return this.connectionManager.getAllConnections();
  }

  /**
   * アカウント情報を取得
   */
  getAccount(accountId: string): Account | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * 全アカウント情報を取得
   */
  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  /**
   * 統計情報を取得
   */
  getConnectionStats(): EAConnectionStats {
    return this.connectionManager.getStats();
  }

  /**
   * エラー履歴を取得
   */
  getErrors(): EAError[] {
    return this.connectionManager.getErrors();
  }

  /**
   * アカウント情報受信統計を取得
   */
  getAccountInfoStats(): AccountInfoStats {
    return this.accountInfoReceiver.getStats();
  }

  /**
   * アカウント情報受信エラーを取得
   */
  getAccountInfoErrors(): AccountInfoError[] {
    return this.accountInfoReceiver.getErrors();
  }

  /**
   * アカウント情報受信設定を更新
   */
  updateAccountInfoReceiverConfig(config: Partial<AccountInfoReceiverConfig>): void {
    this.accountInfoReceiver.updateConfig(config);
  }

  /**
   * 設定を更新
   */
  updateSettings(settings: Partial<EASettings>): void {
    this.connectionManager.updateSettings(settings);
  }

  /**
   * ヘルスチェック
   */
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      totalConnections: number;
      activeConnections: number;
      errorCount: number;
      uptime: number;
    };
  } {
    const stats = this.getConnectionStats();
    const errors = this.getErrors().filter(e => !e.resolved && e.timestamp.getTime() > Date.now() - 300000); // 5分以内のエラー

    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (errors.length === 0 && stats.activeConnections === stats.totalConnections) {
      status = 'healthy';
    } else if (errors.length < 5 && stats.activeConnections > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        totalConnections: stats.totalConnections,
        activeConnections: stats.activeConnections,
        errorCount: errors.length,
        uptime: stats.uptime,
      },
    };
  }

  private handlePositionUpdate(accountId: string, data: any): void {
    const account = this.accounts.get(accountId);
    if (account) {
      account.positions = data.positions;
      this.accounts.set(accountId, account);
    }
    
    this.emit('positionUpdated', accountId, data.positions);
    
    if (this.options.enableDataPersistence) {
      this.persistPositionData(accountId, data.positions);
    }
  }

  private handleAccountUpdate(accountId: string, data: any): void {
    let account = this.accounts.get(accountId);
    
    if (!account) {
      account = {
        accountId,
        balance: 0,
        equity: 0,
        margin: 0,
        marginFree: 0,
        marginLevel: 0,
        credit: 0,
        profit: 0,
        server: '',
        currency: '',
        leverage: 0,
        positions: [],
      };
    }

    // アカウント情報を更新
    Object.assign(account, {
      balance: data.balance,
      equity: data.equity,
      margin: data.margin,
      marginFree: data.marginFree,
      marginLevel: data.marginLevel,
      credit: data.credit,
      profit: data.profit,
      server: data.server,
      currency: data.currency,
    });

    this.accounts.set(accountId, account);
    this.emit('accountUpdated', accountId, account);
    
    if (this.options.enableDataPersistence) {
      this.persistAccountData(accountId, account);
    }
  }

  private validateConnection(accountId: string): void {
    const connection = this.connectionManager.getConnection(accountId);
    if (!connection) {
      throw new Error(`EA not registered: ${accountId}`);
    }
    if (connection.status !== 'connected') {
      throw new Error(`EA not connected: ${accountId} (status: ${connection.status})`);
    }
  }

  private async sendWebSocketMessage(accountId: string, message: any): Promise<void> {
    // WebSocketクライアントと連携してメッセージを送信
    // 実装は具体的なWebSocketクライアントによって異なる
    this.emit('sendWebSocketMessage', accountId, message);
  }

  private async persistPositionData(accountId: string, positions: Position[]): Promise<void> {
    // GraphQL APIを使用してポジションデータを永続化
    // 実装は具体的なGraphQLクライアントによって異なる
    try {
      this.emit('persistPositions', accountId, positions);
    } catch (error) {
      console.error('Failed to persist position data:', error);
    }
  }

  private async persistAccountData(accountId: string, account: Account): Promise<void> {
    // GraphQL APIを使用してアカウントデータを永続化
    // 実装は具体的なGraphQLクライアントによって異なる
    try {
      this.emit('persistAccount', accountId, account);
    } catch (error) {
      console.error('Failed to persist account data:', error);
    }
  }

  private setupAccountInfoReceiverHandlers(): void {
    // アカウント情報受信イベント
    this.accountInfoReceiver.on('account_info_received', (data) => {
      this.handleEnhancedAccountUpdate(data.accountId, data.data);
      this.emit('accountInfoReceived', data);
    });

    // 重要な変更通知
    this.accountInfoReceiver.on('margin_level_change', (data) => {
      this.emit('marginLevelWarning', data);
    });

    this.accountInfoReceiver.on('bonus_amount_change', (data) => {
      this.emit('bonusAmountChanged', data);
    });

    this.accountInfoReceiver.on('significant_balance_change', (data) => {
      this.emit('significantBalanceChange', data);
    });

    // エラーハンドリング
    this.accountInfoReceiver.on('validation_error', (error) => {
      this.emit('accountInfoValidationError', error);
    });

    this.accountInfoReceiver.on('processing_error', (error) => {
      this.emit('accountInfoProcessingError', error);
    });

    // データ永続化要求
    this.accountInfoReceiver.on('persist_account_info', (accountId, data) => {
      this.persistAccountData(accountId, this.convertToAccount(accountId, data));
    });
  }

  /**
   * 強化されたアカウント更新処理
   */
  private handleEnhancedAccountUpdate(accountId: string, data: any): void {
    let account = this.accounts.get(accountId);
    
    if (!account) {
      account = this.createDefaultAccount(accountId);
    }

    // AccountInfoDataから既存のAccount形式に変換
    Object.assign(account, {
      balance: data.balance,
      equity: data.equity,
      margin: data.marginUsed,
      marginFree: data.freeMargin,
      marginLevel: data.marginLevel,
      credit: data.credit,
      profit: data.profit,
      currency: data.currency,
    });

    this.accounts.set(accountId, account);
    this.emit('accountUpdated', accountId, account);
    
    if (this.options.enableDataPersistence) {
      this.persistAccountData(accountId, account);
    }
  }

  /**
   * デフォルトアカウントを作成
   */
  private createDefaultAccount(accountId: string): Account {
    return {
      accountId,
      balance: 0,
      equity: 0,
      margin: 0,
      marginFree: 0,
      marginLevel: 0,
      credit: 0,
      profit: 0,
      server: '',
      currency: '',
      leverage: 0,
      positions: [],
    };
  }

  /**
   * AccountInfoDataをAccount形式に変換
   */
  private convertToAccount(accountId: string, data: any): Account {
    const account = this.createDefaultAccount(accountId);
    
    Object.assign(account, {
      balance: data.balance,
      equity: data.equity,
      margin: data.marginUsed,
      marginFree: data.freeMargin,
      marginLevel: data.marginLevel,
      credit: data.credit,
      profit: data.profit,
      currency: data.currency,
    });

    return account;
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.connectionManager.dispose();
    this.accountInfoReceiver.dispose();
    this.removeAllListeners();
  }
}