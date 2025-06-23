import { AmplifyGraphQLClient } from './amplify-client';
import { WebSocketHandler } from './websocket-handler';
import { RealtimeStateManager } from './realtime-state-manager';
import { ActionSyncEngine } from './action-sync-engine';
import { StrategyExecutionEngine } from './strategy-execution-engine';
import { TrailEngine } from './trail-engine';
import { AccountManager } from './account-manager';
import { Strategy, EntryStrategy, ExitStrategy } from '@repo/shared-types';
import amplifyOutputs from '../amplify_outputs.json';

interface SystemConfig {
  assignedAccounts: string[];
  pcId?: string;
  autoStart?: boolean;
}

interface SystemStatus {
  isInitialized: boolean;
  isRunning: boolean;
  connectedAccounts: number;
  totalAccounts: number;
  activeSubscriptions: number;
  lastUpdate: Date;
}

/**
 * Hedge System Core
 * MVPデザイン仕様に基づく統合システム管理
 */
export class HedgeSystemCore {
  // Core components
  private amplifyClient: AmplifyGraphQLClient;
  private websocketHandler: WebSocketHandler;
  private realtimeStateManager: RealtimeStateManager;
  
  // Engine components  
  private actionSyncEngine: ActionSyncEngine;
  private strategyExecutionEngine: StrategyExecutionEngine;
  private trailEngine: TrailEngine;
  private accountManager: AccountManager;
  
  // System state
  private isInitialized = false;
  private isRunning = false;
  private systemConfig?: SystemConfig;
  
  // Statistics
  private stats = {
    initTime: new Date(),
    totalStrategiesExecuted: 0,
    totalActionsProcessed: 0,
    totalTrailsExecuted: 0,
    uptime: 0
  };

  constructor() {
    // Initialize core components
    this.amplifyClient = new AmplifyGraphQLClient();
    this.realtimeStateManager = new RealtimeStateManager();
    this.websocketHandler = new WebSocketHandler(this.realtimeStateManager);
    
    // Initialize engine components
    this.actionSyncEngine = new ActionSyncEngine(this.amplifyClient, this.websocketHandler);
    this.strategyExecutionEngine = new StrategyExecutionEngine(this.amplifyClient);
    this.trailEngine = new TrailEngine(this.amplifyClient);
    this.accountManager = new AccountManager(this.amplifyClient, this.websocketHandler);
    
    console.log('🏗️ Hedge System Core components initialized');
  }

  /**
   * システム初期化
   * AWS Amplify接続・WebSocket設定・担当口座割り当て
   */
  async initialize(config: SystemConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('System already initialized');
      return;
    }

    console.log('🚀 Initializing Hedge System Core...');
    this.systemConfig = config;

    try {
      // 1. AWS Amplify接続
      await this.initializeAmplify();
      
      // 2. 担当口座設定
      await this.accountManager.assignAccounts(config.assignedAccounts);
      
      // 3. Action Subscription開始
      await this.actionSyncEngine.startActionSubscription(config.assignedAccounts);
      
      // 4. WebSocket サーバー開始
      await this.websocketHandler.initializeServer();
      
      // 5. Trail Engine開始
      await this.trailEngine.start();
      
      this.isInitialized = true;
      this.stats.initTime = new Date();
      
      console.log('✅ Hedge System Core initialized successfully');
      
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
   * AWS Amplify初期化
   */
  private async initializeAmplify(): Promise<void> {
    console.log('🔧 Initializing AWS Amplify connection...');
    
    try {
      await this.amplifyClient.initialize(amplifyOutputs);
      console.log('✅ AWS Amplify connected successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AWS Amplify:', error);
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
      console.warn('System already running');
      return;
    }

    console.log('▶️ Starting Hedge System Core...');
    
    try {
      // 各コンポーネントの状態確認
      await this.performHealthCheck();
      
      this.isRunning = true;
      console.log('🟢 Hedge System Core started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start Hedge System Core:', error);
      throw error;
    }
  }

  /**
   * 戦略実行要求処理
   * Admin画面からの戦略実行要求を処理
   */
  async handleStrategyExecution(strategy: Strategy): Promise<void> {
    if (!this.isRunning) {
      throw new Error('System not running. Call start() first.');
    }

    console.log(`📋 Processing strategy execution: ${strategy.name} (${strategy.type})`);
    
    try {
      switch (strategy.type) {
        case 'ENTRY':
          await this.strategyExecutionEngine.executeEntryStrategy(strategy as EntryStrategy);
          break;
          
        case 'EXIT':
          await this.strategyExecutionEngine.executeExitStrategy(strategy as ExitStrategy);
          break;
          
        default:
          throw new Error(`Unknown strategy type: ${(strategy as any).type}`);
      }
      
      this.stats.totalStrategiesExecuted++;
      console.log(`✅ Strategy ${strategy.name} executed successfully`);
      
    } catch (error) {
      console.error(`❌ Strategy execution failed for ${strategy.name}:`, error);
      throw error;
    }
  }

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
      console.warn('System not running, loss cut handling skipped');
      return;
    }

    console.log(`💥 Processing loss cut: ${positionId} at ${lossCutPrice}`);
    
    try {
      await this.trailEngine.handleLossCut(positionId, lossCutPrice);
      console.log(`✅ Loss cut processed for position: ${positionId}`);
    } catch (error) {
      console.error(`❌ Failed to process loss cut for ${positionId}:`, error);
      throw error;
    }
  }

  /**
   * ヘルスチェック実行
   */
  async performHealthCheck(): Promise<boolean> {
    const checks = {
      amplify: this.amplifyClient.isConnected(),
      actionEngine: this.actionSyncEngine.isHealthy(),
      accountManager: this.accountManager.isHealthy(),
      websocket: true // WebSocketHandlerのヘルスチェック実装依存
    };

    const isHealthy = Object.values(checks).every(check => check);
    
    if (!isHealthy) {
      console.warn('⚠️ System health check failed:', checks);
    } else {
      console.log('💚 System health check passed');
    }

    return isHealthy;
  }

  /**
   * システム統計取得
   */
  getSystemStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.initTime.getTime(),
      actionSyncStats: this.actionSyncEngine.getStats(),
      trailEngineStats: this.trailEngine.getStats(),
      accountManagerStats: this.accountManager.getStats(),
      systemStatus: this.getSystemStatus()
    };
  }

  /**
   * システム状態取得
   */
  getSystemStatus(): SystemStatus {
    const accountStats = this.accountManager.getStats();
    const actionStats = this.actionSyncEngine.getStats();
    
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      connectedAccounts: accountStats.connectedAccounts,
      totalAccounts: accountStats.assignedAccounts,
      activeSubscriptions: actionStats.activeSubscriptions || 0,
      lastUpdate: new Date()
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
   * システム停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('System not running');
      return;
    }

    console.log('⏹️ Stopping Hedge System Core...');
    
    try {
      // 各コンポーネントの停止処理
      await this.actionSyncEngine.stopAllSubscriptions();
      await this.trailEngine.stopAllTrailMonitoring();
      await this.accountManager.shutdown();
      
      this.isRunning = false;
      console.log('🔴 Hedge System Core stopped');
      
    } catch (error) {
      console.error('❌ Error during system stop:', error);
      throw error;
    }
  }

  /**
   * システムシャットダウン
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Hedge System Core...');
    
    if (this.isRunning) {
      await this.stop();
    }
    
    // クリーンアップ処理
    this.isInitialized = false;
    this.systemConfig = undefined;
    
    console.log('✅ Hedge System Core shutdown completed');
  }

  /**
   * システム再起動
   */
  async restart(): Promise<void> {
    console.log('🔄 Restarting Hedge System Core...');
    
    if (this.isRunning) {
      await this.stop();
    }
    
    if (this.systemConfig) {
      await this.initialize(this.systemConfig);
    } else {
      throw new Error('No system configuration available for restart');
    }
  }

  /**
   * リアルタイム状態マネージャー取得（外部アクセス用）
   */
  getRealtimeStateManager(): RealtimeStateManager {
    return this.realtimeStateManager;
  }

  /**
   * WebSocketハンドラー取得（外部アクセス用）
   */
  getWebSocketHandler(): WebSocketHandler {
    return this.websocketHandler;
  }
}