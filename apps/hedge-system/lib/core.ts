import { amplifyClient, getCurrentUserId } from './amplify-client';
import { WebSocketHandler } from './websocket-server';
import { ActionSync } from './action-sync';
import { PositionExecutor } from './position-execution';
import { TrailEngine, getTrailEngine } from './trail-engine';
import { AccountManager } from './account-manager';
import { HedgeManager } from './hedge-manager';
import { PriceMonitor, getPriceMonitor } from './price-monitor';
import { Position, Account } from '@repo/shared-types';
// TODO: amplify_outputs.json参照はtask-1で修正予定
// import amplifyOutputs from '@repo/shared-amplify/amplify_outputs.json';

// ========================================
// 型定義・インターフェース
// ========================================

interface SystemConfig {
  assignedAccounts: string[];
  pcId?: string;
  autoStart?: boolean;
  websocketPort?: number;
}

interface SystemStatus {
  isInitialized: boolean;
  isRunning: boolean;
  connectedAccounts: number;
  totalAccounts: number;
  activeSubscriptions: number;
  lastUpdate: Date;
  hedgeRatio: number;
  creditUtilization: number;
}

interface SystemStats {
  core: {
    isInitialized: boolean;
    isRunning: boolean;
    uptime: number;
  };
  accounts: {
    assigned: number;
    connected: number;
    total: number;
  };
  positions: {
    open: number;
    trailing: number;
    executed: number;
  };
  actions: {
    executing: number;
    pending: number;
    completed: number;
    failed: number;
  };
  hedge: {
    ratio: number;
    fullyHedged: number;
    totalAccounts: number;
  };
  websocket: {
    connections: number;
    messagesPerSecond: number;
  };
}

// ========================================
// Hedge System Core - MVPシステム設計書準拠統合クラス
// ========================================

/**
 * Hedge System Core - MVPシステム設計書準拠
 * システムの全コア機能を統合管理
 * 
 * 設計書の6つのコア機能：
 * 1. 口座管理（AccountManager）
 * 2. ポジション実行エンジン（PositionExecutor）
 * 3. 両建て管理（HedgeManager）
 * 4. トレール判定エンジン（TrailEngine）
 * 5. アクション同期実行（ActionSync）
 * 6. WebSocket通信（WebSocketHandler）
 * 
 * 追加機能：
 * - クラウド同期（AmplifyClient）
 * - 価格監視（PriceMonitor）
 * - システム状態管理
 * - リアルタイムデータ管理
 */
export class HedgeSystemCore {
  // MVPシステム設計の6つのコア機能
  private accountManager: AccountManager;
  private positionExecutor: PositionExecutor;
  private hedgeManager: HedgeManager;
  private trailEngine: TrailEngine;
  private actionSync: ActionSync;
  private wsServer: WebSocketHandler;
  
  // 追加コンポーネント
  private priceMonitor: PriceMonitor;
  
  // システム状態
  private isInitialized = false;
  private isRunning = false;
  private systemConfig?: SystemConfig;
  private startTime?: Date;
  
  // インメモリデータストア（Admin Webアプリ用）
  private positionsCache = new Map<string, Position>();
  private accountsCache = new Map<string, Account>();
  private lastUpdate = new Date();
  
  // 定期処理
  private periodicIntervals: NodeJS.Timeout[] = [];

  constructor() {
    // Initializing Hedge System Core
    
    // WebSocketサーバー初期化
    this.wsServer = new WebSocketHandler();
    
    // 口座管理初期化
    this.accountManager = new AccountManager(amplifyClient, this.wsServer);
    
    // ポジション実行エンジン初期化
    this.positionExecutor = new PositionExecutor(this.wsServer);
    
    // 両建て管理初期化
    this.hedgeManager = new HedgeManager();
    
    // アクション同期初期化
    this.actionSync = new ActionSync(this.wsServer);
    
    // TrailEngineとPriceMonitorの相互依存関係を解決
    // 統合強化：ActionFlowEngineとWebSocketHandlerを渡してトレール→自動実行を実現
    this.trailEngine = getTrailEngine(
      undefined, // PriceMonitorは後で設定
      this.positionExecutor.actionEngine, // ActionFlowEngine
      this.wsServer // WebSocketHandler
    );
    this.priceMonitor = getPriceMonitor(this.trailEngine);
    
    // PositionExecutorにTrailEngineを設定
    this.positionExecutor.setTrailEngine(this.trailEngine);
    
    // データ同期設定
    this.setupDataSync();
    
    // Hedge System Core components initialized
  }

  // ========================================
  // システムライフサイクル
  // ========================================

  /**
   * システム初期化
   * AWS Amplify接続・WebSocket設定・担当口座割り当て
   */
  async initialize(config: SystemConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('⚠️ System already initialized');
      return;
    }

    // Initializing Hedge System Core
    this.systemConfig = config;
    this.startTime = new Date();

    try {
      // 1. AWS Amplify接続
      await this.initializeAmplify();
      
      // 2. 担当口座設定
      await this.accountManager.assignAccounts(config.assignedAccounts);
      
      // 3. WebSocket サーバー開始
      await this.wsServer.initializeServer(config.websocketPort || 8080);
      
      // 4. Trail Engine開始
      await this.trailEngine.start();
      
      // 5. ActionSync Engine開始
      await this.actionSync.start();
      
      // 6. 両建て管理開始
      await this.hedgeManager.startMonitoring(config.assignedAccounts);
      
      // 7. 既存のトレール監視対象を復旧
      await this.loadExistingTrailPositions();
      
      // 8. Position Subscription開始
      await this.positionExecutor.subscribeToMyPositions();
      
      // 9. 定期処理開始
      this.startPeriodicTasks();
      
      this.isInitialized = true;
      
      // Hedge System Core initialized successfully
      
      if (config.autoStart) {
        await this.start();
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize Hedge System Core:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * システム開始
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      console.warn('⚠️ System is already running');
      return;
    }

    // Starting Hedge System Core
    
    this.isRunning = true;
    this.lastUpdate = new Date();
    
    // Hedge System Core started successfully
  }

  /**
   * システム停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('⚠️ System not running');
      return;
    }

    // Stopping Hedge System Core
    
    try {
      // 定期処理停止
      this.stopPeriodicTasks();
      
      // 各コンポーネントの停止処理
      await this.actionSync.stop();
      await this.hedgeManager.stopMonitoring();
      this.trailEngine.stopAllTrailMonitoring();
      await this.accountManager.shutdown();
      await this.wsServer.shutdown();
      
      this.isRunning = false;
      // Hedge System Core stopped
      
    } catch (error) {
      console.error('❌ Error during system stop:', error);
      throw error;
    }
  }

  /**
   * システムシャットダウン
   */
  async shutdown(): Promise<void> {
    // Shutting down Hedge System Core
    
    if (this.isRunning) {
      await this.stop();
    }
    
    // クリーンアップ処理
    this.isInitialized = false;
    this.systemConfig = undefined;
    this.startTime = undefined;
    this.positionsCache.clear();
    this.accountsCache.clear();
    
    // Hedge System Core shutdown completed
  }

  /**
   * システム再起動
   */
  async restart(): Promise<void> {
    // Restarting Hedge System Core
    
    if (this.isRunning) {
      await this.stop();
    }
    
    if (this.systemConfig) {
      await this.initialize(this.systemConfig);
    } else {
      throw new Error('No system configuration available for restart');
    }
  }

  // ========================================
  // 初期化・設定
  // ========================================

  /**
   * AWS Amplify初期化
   */
  private async initializeAmplify(): Promise<void> {
    // Initializing AWS Amplify connection
    
    try {
      // Amplify client is auto-initialized via configuration
      // AWS Amplify connected successfully
    } catch (error) {
      console.error('❌ Failed to initialize AWS Amplify:', error);
      throw error;
    }
  }

  /**
   * 既存トレール対象復旧
   */
  private async loadExistingTrailPositions(): Promise<void> {
    try {
      // Loading existing trail positions
      
      const userId = await getCurrentUserId();
      
      // TODO: Fix schema mismatch - regenerate amplify_outputs.json
      const positions = await (amplifyClient as any).models?.Position?.list({
        filter: {
          userId: { eq: userId },
          status: { eq: 'OPEN' },
          trailWidth: { gt: 0 }
        }
      });
      
      const positionList = positions?.data || [];
      // Found trail positions to monitor
      
      for (const position of positionList) {
        await this.trailEngine.addPositionMonitoring(position);
      }
      
      // Trail monitoring restored for positions
      
    } catch (error) {
      console.error('❌ Failed to load existing trail positions:', error);
      // エラーでもシステム初期化は継続
    }
  }

  // ========================================
  // データ同期・管理
  // ========================================

  /**
   * データ同期設定
   */
  private setupDataSync(): void {
    // リアルタイム状態管理からキャッシュに同期
    const syncInterval = setInterval(() => {
      this.syncToCache();
    }, 1000); // 1秒間隔
    
    this.periodicIntervals.push(syncInterval);
  }

  /**
   * キャッシュ同期
   */
  private async syncToCache(): Promise<void> {
    try {
      // ポジション情報をキャッシュに同期
      const positions = await this.positionExecutor.getOpenPositions();
      positions.forEach(position => {
        this.positionsCache.set(position.id, position);
      });
      
      // アカウント情報をキャッシュに同期
      const _accountStats = this.accountManager.getStats();
      // 簡素化のため基本情報のみ
      
      this.lastUpdate = new Date();
      
    } catch (error) {
      console.error('❌ Cache sync failed:', error);
    }
  }

  // ========================================
  // 定期処理
  // ========================================

  /**
   * 定期タスク開始
   */
  private startPeriodicTasks(): void {
    // 非アクティブクライアントのクリーンアップ（5分間隔）
    const cleanupInterval = setInterval(() => {
      this.wsServer.cleanupInactiveClients();
    }, 300000);
    
    // ヘルスチェック（30秒間隔）
    const healthInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    // 統計更新（10秒間隔）
    const statsInterval = setInterval(() => {
      this.updateStats();
    }, 10000);
    
    this.periodicIntervals.push(cleanupInterval, healthInterval, statsInterval);
  }

  /**
   * 定期処理停止
   */
  private stopPeriodicTasks(): void {
    this.periodicIntervals.forEach(interval => {
      clearInterval(interval);
    });
    this.periodicIntervals = [];
  }

  /**
   * ヘルスチェック実行
   */
  private performHealthCheck(): void {
    const issues: string[] = [];
    
    // 各コンポーネントのヘルスチェック
    if (!this.accountManager.isHealthy()) {
      issues.push('AccountManager unhealthy');
    }
    
    if (!this.actionSync.isHealthy()) {
      issues.push('ActionSync unhealthy');
    }
    
    if (!this.hedgeManager.isHealthy()) {
      issues.push('HedgeManager unhealthy');
    }
    
    if (issues.length > 0) {
      console.warn('⚠️ Health check issues:', issues);
    }
  }

  /**
   * 統計情報更新
   */
  private updateStats(): void {
    // 各コンポーネントの統計を収集
    // 実装は簡素化
    this.lastUpdate = new Date();
  }

  // ========================================
  // イベント処理
  // ========================================

  /**
   * 価格更新ハンドリング
   * WebSocketからの価格更新をTrailEngineに配信
   */
  async handlePriceUpdate(priceUpdate: any): Promise<void> {
    if (this.isRunning) {
      await this.trailEngine.handlePriceUpdate(priceUpdate);
    }
  }

  /**
   * ロスカット処理
   * MT4からのロスカット通知処理
   */
  async handleLossCut(positionId: string, lossCutPrice: number): Promise<void> {
    if (!this.isRunning) {
      console.warn('⚠️ System not running, loss cut handling skipped');
      return;
    }

    // Processing loss cut
    
    try {
      await this.trailEngine.handleLossCut(positionId, lossCutPrice);
      // Loss cut processed for position
    } catch (error) {
      console.error(`❌ Failed to process loss cut for ${positionId}:`, error);
      throw error;
    }
  }

  // ========================================
  // Admin API機能（HTTPサーバーの代替）
  // ========================================

  /**
   * リアルタイムデータ取得
   */
  getRealtimeData() {
    return {
      success: true,
      data: {
        positions: Array.from(this.positionsCache.values()),
        accounts: Array.from(this.accountsCache.values()),
        connections: this.wsServer.getConnectedClients().length,
        lastUpdate: this.lastUpdate,
        hedgeAnalysis: this.hedgeManager.getLatestAnalysis(),
        systemStatus: this.getSystemStatus()
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
    
    const hedgeAnalysis = this.hedgeManager.getLatestAnalysis(accountId);
    
    return {
      success: true,
      data: {
        account,
        positions,
        hedgeAnalysis
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
      // PositionExecutor経由で実行
      if (command.type === 'ENTRY') {
        const position = await this.positionExecutor.createPosition({
          accountId: command.accountId,
          symbol: command.symbol as any,
          volume: command.volume || 1.0,
          executionType: 'ENTRY' as any,
          memo: `Manual entry via admin`
        });
        
        const success = await this.positionExecutor.executePosition(position.id);
        
        return {
          success,
          data: { positionId: position.id },
          timestamp: new Date()
        };
      }
      
      return {
        success: false,
        error: 'Unsupported command type',
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

  // ========================================
  // 状態・統計取得
  // ========================================

  /**
   * システム統計取得（詳細版）
   */
  async getSystemStats(): Promise<SystemStats> {
    const accountStats = this.accountManager.getStats();
    const actionStats = this.actionSync.getStats();
    const hedgeStats = this.hedgeManager.getStats();
    const wsStats = await this.wsServer.getStats();
    
    return {
      core: {
        isInitialized: this.isInitialized,
        isRunning: this.isRunning,
        uptime: this.startTime ? (Date.now() - this.startTime.getTime()) / 1000 : 0
      },
      accounts: {
        assigned: accountStats.assignedAccounts,
        connected: accountStats.connectedAccounts,
        total: accountStats.assignedAccounts
      },
      positions: {
        open: this.positionsCache.size,
        trailing: 0, // 簡素化
        executed: actionStats.totalExecuted
      },
      actions: {
        executing: actionStats.executingActions.length,
        pending: 0, // 簡素化
        completed: actionStats.totalExecuted,
        failed: actionStats.totalFailed
      },
      hedge: {
        ratio: 0, // 簡素化
        fullyHedged: hedgeStats.hedgedAccounts,
        totalAccounts: hedgeStats.totalAccounts
      },
      websocket: {
        connections: wsStats.connectedClients,
        messagesPerSecond: wsStats.messagesPerSecond || 0
      }
    };
  }

  /**
   * システム状態取得（簡素版）
   */
  getSystemStatus(): SystemStatus {
    const accountStats = this.accountManager.getStats();
    const hedgeStats = this.hedgeManager.getStats();
    
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      connectedAccounts: accountStats.connectedAccounts,
      totalAccounts: accountStats.assignedAccounts,
      activeSubscriptions: 0, // 簡素化
      lastUpdate: this.lastUpdate,
      hedgeRatio: 0, // 簡素化
      creditUtilization: 0 // 簡素化
    };
  }

  /**
   * 設定情報取得
   */
  getSystemConfig() {
    return {
      ...this.systemConfig,
      pcId: this.accountManager.getStats().pcId
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
        uptime: this.startTime ? (Date.now() - this.startTime.getTime()) / 1000 : 0,
        connections: this.wsServer.getConnectedClients().length,
        componentsHealth: {
          accountManager: this.accountManager.isHealthy(),
          actionSync: this.actionSync.isHealthy(),
          hedgeManager: this.hedgeManager.isHealthy()
        }
      },
      timestamp: new Date()
    };
  }

  // ========================================
  // 外部アクセス用メソッド
  // ========================================

  /**
   * WebSocketサーバー取得
   */
  getWebSocketHandler(): WebSocketHandler {
    return this.wsServer;
  }

  /**
   * ポジション実行エンジン取得
   */
  getPositionExecutor(): PositionExecutor {
    return this.positionExecutor;
  }

  /**
   * アクション同期エンジン取得
   */
  getActionSync(): ActionSync {
    return this.actionSync;
  }

  /**
   * 両建て管理取得
   */
  getHedgeManager(): HedgeManager {
    return this.hedgeManager;
  }

  /**
   * 口座管理取得
   */
  getAccountManager(): AccountManager {
    return this.accountManager;
  }

  /**
   * トレールエンジン取得
   */
  getTrailEngine(): TrailEngine {
    return this.trailEngine;
  }

  /**
   * 監視中ポジション取得
   */
  getMonitoredPositions() {
    return this.trailEngine.getMonitoredPositions();
  }

  /**
   * ActionSync統計取得
   */
  getActionSyncStats() {
    return this.actionSync.getStats();
  }

  /**
   * TrailEngine統計取得
   */
  getTrailEngineStats() {
    return this.trailEngine.getStats();
  }

  /**
   * 緊急停止（全コンポーネント強制停止）
   */
  async emergencyStop(): Promise<void> {
    console.warn('🚨 Emergency stopping Hedge System Core...');
    
    try {
      await this.actionSync.forceStop();
      await this.hedgeManager.emergencyStop();
      this.trailEngine.stopAllTrailMonitoring();
      await this.wsServer.shutdown();
      
      this.isRunning = false;
      console.warn('🚨 Emergency stop completed');
      
    } catch (error) {
      console.error('❌ Emergency stop failed:', error);
    }
  }

  /**
   * システム診断
   */
  async runDiagnostics(): Promise<{
    overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    components: Record<string, any>;
    recommendations: string[];
  }> {
    const components = {
      accountManager: {
        healthy: this.accountManager.isHealthy(),
        stats: this.accountManager.getStats()
      },
      actionSync: {
        healthy: this.actionSync.isHealthy(),
        stats: this.actionSync.getStats()
      },
      hedgeManager: {
        healthy: this.hedgeManager.isHealthy(),
        stats: this.hedgeManager.getStats()
      },
      trailEngine: {
        healthy: true, // 簡素化
        stats: this.trailEngine.getStats()
      },
      websocket: {
        healthy: this.wsServer.getConnectedClients().length > 0,
        stats: this.wsServer.getStats()
      }
    };
    
    const healthyComponents = Object.values(components).filter(c => c.healthy).length;
    const totalComponents = Object.keys(components).length;
    
    let overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    if (healthyComponents === totalComponents) {
      overall = 'HEALTHY';
    } else if (healthyComponents >= totalComponents * 0.7) {
      overall = 'WARNING';
    } else {
      overall = 'CRITICAL';
    }
    
    const recommendations: string[] = [];
    if (!components.accountManager.healthy) {
      recommendations.push('Check account connections');
    }
    if (!components.actionSync.healthy) {
      recommendations.push('Restart action sync engine');
    }
    if (!components.websocket.healthy) {
      recommendations.push('Verify EA connections');
    }
    
    return {
      overall,
      components,
      recommendations
    };
  }
}

// ========================================
// Singleton instance for global access
// ========================================

export const hedgeSystemCore = new HedgeSystemCore();
export default hedgeSystemCore;