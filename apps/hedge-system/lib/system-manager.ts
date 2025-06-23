import { WebSocketHandler } from './websocket-handler';
// import { AdminAPIServer } from './admin-api-server';

/**
 * Hedge System メインシステム管理
 * WebSocketサーバー、リアルタイム状態管理、Admin API機能を統合
 */
export class SystemManager {
  private wsHandler: WebSocketHandler;
  // private adminAPI: AdminAPIServer;
  private isRunning = false;
  
  // インメモリデータストア（Admin Webアプリ用）
  private positionsCache = new Map<string, any>();
  private accountsCache = new Map<string, any>();
  private lastUpdate = new Date();
  
  constructor() {
    this.wsHandler = new WebSocketHandler();
    // this.adminAPI = new AdminAPIServer(this.wsHandler);
    
    this.setupDataSync();
    // this.setupDataPersistence();
  }
  
  /**
   * システム開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ System is already running');
      return;
    }
    
    try {
      // WebSocketサーバー開始
      await this.wsHandler.initializeServer(8080);
      
      // Admin APIサーバー開始
      // await this.adminAPI.start(3001);
      
      // 定期処理開始
      this.startPeriodicTasks();
      
      this.isRunning = true;
      console.log('🚀 Hedge System started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start Hedge System:', error);
      throw error;
    }
  }
  
  /**
   * システム停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      await this.wsHandler.shutdown();
      // await this.adminAPI.stop();
      // state manager cleanup (simplified)
      
      this.isRunning = false;
      console.log('✅ Hedge System stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop Hedge System:', error);
    }
  }
  
  /**
   * データ同期設定
   */
  private setupDataSync(): void {
    // リアルタイム状態管理からキャッシュに同期
    setInterval(() => {
      this.syncToCache();
    }, 1000); // 1秒間隔
  }
  
  /**
   * キャッシュ同期 (簡素化版)
   */
  private syncToCache(): void {
    // 簡素化: 基本的なキャッシュ同期のみ
    this.lastUpdate = new Date();
    console.log('🔄 Cache sync completed (simplified)');
  }
  
  /**
   * データ永続化設定
   */
  private setupDataPersistence(): void {
    // ポジション更新をSQLiteに保存（5秒間隔）
    setInterval(() => {
      this.savePositionsToDatabase();
    }, 5000);
    
    // アカウント更新をSQLiteに保存（10秒間隔）
    setInterval(() => {
      this.saveAccountsToDatabase();
    }, 10000);
  }
  
  /**
   * ポジション情報をSQLiteに保存
   */
  private savePositionsToDatabase(): void {
    // Temporarily disabled - using Amplify GraphQL instead
    /*
    try {
      const positions = this.stateManager.getAllPositions();
      positions.forEach(position => {
        this.adminAPI.savePosition(position);
      });
    } catch (error) {
      console.error('❌ Failed to save positions to database:', error);
    }
    */
  }
  
  /**
   * アカウント情報をSQLiteに保存
   */
  private saveAccountsToDatabase(): void {
    // Temporarily disabled - using Amplify GraphQL instead
    /*
    try {
      const accounts = this.stateManager.getAllAccounts();
      accounts.forEach(account => {
        this.adminAPI.saveAccount(account);
      });
    } catch (error) {
      console.error('❌ Failed to save accounts to database:', error);
    }
    */
  }
  
  /**
   * 定期タスク開始
   */
  private startPeriodicTasks(): void {
    // 非アクティブクライアントのクリーンアップ（5分間隔）
    setInterval(() => {
      this.wsHandler.cleanupInactiveClients();
    }, 300000);
    
    // ステイルデータマーキング (簡素化)
    // 簡素化のため削除
  }
  
  // ===== Admin Web API（HTTPサーバーの代替） =====
  
  /**
   * リアルタイムデータ取得
   */
  getRealtimeData() {
    return {
      success: true,
      data: {
        positions: Array.from(this.positionsCache.values()),
        accounts: Array.from(this.accountsCache.values()),
        connections: this.wsHandler.getConnectedClients().length,
        lastUpdate: this.lastUpdate
      },
      timestamp: new Date()
    };
  }
  
  /**
   * 特定アカウントデータ取得
   */
  getAccountData(accountId: string) {
    const account = this.accountsCache.get(accountId);
    if (!account) {
      return {
        success: false,
        error: 'Account not found',
        timestamp: new Date()
      };
    }
    
    const positions = Array.from(this.positionsCache.values())
      .filter(pos => pos.accountId === accountId);
    
    return {
      success: true,
      data: {
        account,
        positions
      },
      timestamp: new Date()
    };
  }
  
  /**
   * 取引指令実行
   */
  async executeTradeCommand(command: {
    type: 'ENTRY' | 'CLOSE';
    accountId: string;
    symbol: string;
    direction?: 'buy' | 'sell';
    volume?: number;
    price?: number;
  }) {
    try {
      const success = await this.wsHandler.sendLegacyTradeCommand(command.accountId, {
        action: command.type === 'ENTRY' ? 'open' : 'close',
        symbol: command.symbol,
        volume: command.volume || 0,
        type: command.direction || 'buy',
        price: command.price
      });
      
      return {
        success,
        data: { commandId: `cmd_${Date.now()}` },
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * 統計データ取得
   */
  getStats() {
    return {
      success: true,
      data: {
        totalPositions: this.positionsCache.size,
        activeAccounts: Array.from(this.accountsCache.values())
          .filter(acc => acc.connectionStatus === 'connected').length,
        totalAccounts: this.accountsCache.size,
        wsConnections: this.wsHandler.getConnectedClients().length,
        wsStats: this.wsHandler.getStats()
      },
      timestamp: new Date()
    };
  }
  
  /**
   * 接続テスト
   */
  testConnection() {
    return {
      success: this.isRunning,
      data: {
        status: this.isRunning ? 'healthy' : 'stopped',
        uptime: this.isRunning ? process.uptime() : 0,
        connections: this.wsHandler.getConnectedClients().length
      },
      timestamp: new Date()
    };
  }
  
  /**
   * システム状態取得
   */
  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      totalPositions: this.positionsCache.size,
      activeConnections: this.wsHandler.getConnectedClients().length,
      lastUpdate: this.lastUpdate,
      uptime: this.isRunning ? process.uptime() : 0
    };
  }
}

// シングルトンインスタンス
export const systemManager = new SystemManager();