// Removed unused import
import { WebSocketHandler } from './websocket-server';

interface ConnectionInfo {
  accountId: string;
  status: 'connected' | 'disconnected' | 'connecting';
  lastUpdate: Date;
  errorCount: number;
  lastError?: string;
  pcId: string;
}

interface AccountAssignment {
  accountId: string;
  pcId: string;
  assignedAt: Date;
  priority: number;
}

/**
 * 口座管理マネージャー
 * 分散アーキテクチャでの口座担当管理・接続状態管理
 */
export class AccountManager {
  private amplifyClient: unknown; // amplifyClientの型
  private websocketHandler: WebSocketHandler;
  private assignedAccounts: Set<string> = new Set();
  private accountConnections: Map<string, ConnectionInfo> = new Map();
  private pcId: string;
  
  // 設定
  private maxErrorCount = 5;
  private reconnectInterval = 30000; // 30秒
  private heartbeatInterval = 10000;  // 10秒
  
  // 統計
  private stats = {
    totalAssigned: 0,
    totalConnected: 0,
    totalDisconnected: 0,
    totalErrors: 0,
    lastAssignment: new Date()
  };

  constructor(
    client: unknown, // amplifyClientの型
    websocketHandler: WebSocketHandler,
    pcId?: string
  ) {
    this.amplifyClient = client;
    this.websocketHandler = websocketHandler;
    this.pcId = pcId || this.generatePCId();
    
    // 定期ヘルスチェック開始
    this.startHeartbeat();
  }

  /**
   * 担当口座の設定
   * 分散環境での口座担当割り当て
   */
  async assignAccounts(accountIds: string[]): Promise<void> {
    // 🔧 Assigning accounts to PC
    
    try {
      // 既存の割り当てをクリア
      await this.clearCurrentAssignments();
      
      // 新しい口座を割り当て
      this.assignedAccounts = new Set(accountIds);
      this.stats.totalAssigned = accountIds.length;
      this.stats.lastAssignment = new Date();
      
      // 口座別WebSocket接続確立
      const connectionPromises = accountIds.map(accountId => 
        this.establishAccountConnection(accountId)
      );
      
      await Promise.allSettled(connectionPromises);
      
      // AppSyncに担当状況を報告
      await this.reportAssignmentStatus();
      
      // ✅ Successfully assigned accounts
      
    } catch (error) {
      console.error('❌ Failed to assign accounts:', error);
      throw error;
    }
  }

  /**
   * 現在の割り当て状況をクリア
   */
  private async clearCurrentAssignments(): Promise<void> {
    for (const accountId of this.assignedAccounts) {
      await this.disconnectAccountConnection(accountId);
    }
    
    this.assignedAccounts.clear();
    this.accountConnections.clear();
  }

  /**
   * 口座接続確立
   */
  async establishAccountConnection(accountId: string): Promise<void> {
    // 🔌 Establishing connection for account
    
    try {
      // 接続情報初期化
      const connectionInfo: ConnectionInfo = {
        accountId,
        status: 'connecting',
        lastUpdate: new Date(),
        errorCount: 0,
        pcId: this.pcId
      };
      
      this.accountConnections.set(accountId, connectionInfo);
      
      // WebSocket接続確立（実装依存）
      await this.connectToAccount(accountId);
      
      // 接続成功
      await this.updateAccountConnection(accountId, 'connected');
      
      // ✅ Account connection established
      
    } catch (error) {
      console.error(`❌ Failed to establish connection for ${accountId}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateAccountConnection(accountId, 'disconnected', errorMessage);
      throw error;
    }
  }

  /**
   * 口座WebSocket接続（実装依存部分）
   */
  private async connectToAccount(_accountId: string): Promise<void> {
    // 実際の実装ではWebSocketHandlerやMT4接続ロジックを使用
    // ここではサンプル実装
    // 📡 Connecting to WebSocket for account
    
    // WebSocketHandler経由での接続確立
    // 実装は既存のWebSocketHandlerのAPIに依存
    
    // サンプル：接続成功として処理
    return Promise.resolve();
  }

  /**
   * 口座担当判定
   * 分散環境での担当制御
   */
  isAccountAssigned(accountId: string): boolean {
    return this.assignedAccounts.has(accountId);
  }

  /**
   * 口座接続状態管理
   * 接続状態の監視・報告
   */
  async updateAccountConnection(
    accountId: string, 
    status: 'connected' | 'disconnected',
    errorMessage?: string
  ): Promise<void> {
    const connection = this.accountConnections.get(accountId);
    
    if (!connection) {
      console.warn(`Connection info not found for account: ${accountId}`);
      return;
    }

    // 接続情報更新
    connection.status = status;
    connection.lastUpdate = new Date();
    
    if (status === 'disconnected') {
      connection.errorCount++;
      connection.lastError = errorMessage;
      this.stats.totalDisconnected++;
      
      // エラー回数が上限を超えた場合の処理
      if (connection.errorCount >= this.maxErrorCount) {
        console.error(`❌ Account ${accountId} exceeded max error count, removing assignment`);
        await this.removeAccountAssignment(accountId);
        return;
      }
      
      // 自動再接続スケジュール
      this.scheduleReconnection(accountId);
      
    } else if (status === 'connected') {
      connection.errorCount = 0;
      connection.lastError = undefined;
      this.stats.totalConnected++;
    }

    // AppSyncに口座状態を報告
    await this.reportAccountStatus(accountId, status);
    
    // 📊 Account status updated
  }

  /**
   * AppSyncに口座状態報告
   */
  async reportAccountStatus(accountId: string, _status: string): Promise<void> {
    try {
      // AmplifyClient経由でAccount状態更新
      await (this.amplifyClient as unknown as { updateAccount: (id: string, data: { lastUpdated: string }) => Promise<void> }).updateAccount(accountId, {
        lastUpdated: new Date().toISOString()
      });
      
      // 旧GraphQL実装をコメントアウト
      /*
      await this.amplifyClient.client.graphql({
        query: REPORT_ACCOUNT_STATUS,
        variables: { 
          accountId, 
          status, 
          pcId: this.pcId 
        }
      });
      */
    } catch (error) {
      console.error(`Failed to report account status for ${accountId}:`, error);
      // 報告エラーは致命的ではないので継続
    }
  }

  /**
   * 担当状況の報告
   */
  private async reportAssignmentStatus(): Promise<void> {
    const _assignments: AccountAssignment[] = Array.from(this.assignedAccounts).map(accountId => ({
      accountId,
      pcId: this.pcId,
      assignedAt: new Date(),
      priority: 1
    }));

    // 実際の実装では担当状況をAppSyncに報告
    // 📋 Assignment report
  }

  /**
   * 自動再接続スケジュール
   */
  private scheduleReconnection(accountId: string): void {
    // ⏰ Scheduling reconnection for account
    
    setTimeout(async () => {
      if (this.assignedAccounts.has(accountId)) {
        // 🔄 Attempting reconnection for account
        try {
          await this.establishAccountConnection(accountId);
        } catch (_error) {
          console.error(`Reconnection failed for ${accountId}:`, _error);
        }
      }
    }, this.reconnectInterval);
  }

  /**
   * 口座割り当て削除
   */
  async removeAccountAssignment(accountId: string): Promise<void> {
    if (!this.assignedAccounts.has(accountId)) {
      return;
    }

    // 🗑️ Removing account assignment
    
    // 接続を切断
    await this.disconnectAccountConnection(accountId);
    
    // 割り当てから削除
    this.assignedAccounts.delete(accountId);
    this.accountConnections.delete(accountId);
    
    // AppSyncに報告
    await this.reportAccountStatus(accountId, 'unassigned');
    
    // ✅ Account assignment removed
  }

  /**
   * 口座接続切断
   */
  private async disconnectAccountConnection(accountId: string): Promise<void> {
    const connection = this.accountConnections.get(accountId);
    if (connection && connection.status === 'connected') {
      // WebSocket接続切断処理
      // 🔌 Disconnecting account
      
      // 実際の実装ではWebSocketHandlerの切断メソッドを呼び出し
      await this.updateAccountConnection(accountId, 'disconnected');
    }
  }

  /**
   * 定期ヘルスチェック開始
   */
  private startHeartbeat(): void {
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.heartbeatInterval);
  }

  /**
   * ヘルスチェック実行
   */
  private async performHealthCheck(): Promise<void> {
    for (const [accountId, connection] of this.accountConnections) {
      // 最後の更新から一定時間経過している場合は再接続
      const timeSinceUpdate = Date.now() - connection.lastUpdate.getTime();
      
      if (timeSinceUpdate > this.heartbeatInterval * 3 && connection.status === 'connected') {
        console.warn(`⚠️ Account ${accountId} heartbeat timeout, checking connection`);
        
        // 接続チェック・再接続
        try {
          await this.checkAccountConnection(accountId);
        } catch (_error) {
          await this.updateAccountConnection(accountId, 'disconnected', 'Heartbeat timeout');
        }
      }
    }
  }

  /**
   * 口座接続チェック
   */
  private async checkAccountConnection(_accountId: string): Promise<void> {
    // 実際の実装では接続状態をチェック
    // WebSocketのpingなど
    // 🏥 Checking connection health for account
  }

  /**
   * PC ID生成
   */
  private generatePCId(): string {
    return `PC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 担当口座一覧取得
   */
  getAssignedAccounts(): string[] {
    return Array.from(this.assignedAccounts);
  }

  /**
   * 接続状態一覧取得
   */
  getConnectionStates(): ConnectionInfo[] {
    return Array.from(this.accountConnections.values());
  }

  /**
   * 統計情報取得
   */
  getStats() {
    return {
      ...this.stats,
      pcId: this.pcId,
      assignedAccounts: this.assignedAccounts.size,
      connectedAccounts: Array.from(this.accountConnections.values())
        .filter(c => c.status === 'connected').length,
      disconnectedAccounts: Array.from(this.accountConnections.values())
        .filter(c => c.status === 'disconnected').length
    };
  }

  /**
   * ヘルスチェック
   */
  isHealthy(): boolean {
    const connectedCount = Array.from(this.accountConnections.values())
      .filter(c => c.status === 'connected').length;
    
    return connectedCount > 0 && connectedCount >= this.assignedAccounts.size * 0.8;
  }

  /**
   * シャットダウン処理
   */
  async shutdown(): Promise<void> {
    // 🛑 Shutting down Account Manager
    
    // 全接続を切断
    for (const accountId of this.assignedAccounts) {
      await this.disconnectAccountConnection(accountId);
    }
    
    this.assignedAccounts.clear();
    this.accountConnections.clear();
    
    // ✅ Account Manager shutdown completed
  }
}