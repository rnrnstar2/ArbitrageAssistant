import { AmplifyGraphQLClient } from './amplify-client';
import { WebSocketHandler } from './websocket-handler';
import { ActionManager } from './action-manager';
import { TrailEngine } from './trail-engine';
import { AccountManager } from './account-manager';
import { PositionManager } from './position-manager';
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
 * MVPシステム設計の6つのコア機能のみに集約
 */
export class HedgeSystemCore {
  // MVPシステム設計の6つのコア機能
  private accountManager: AccountManager;
  private positionExecutionEngine: PositionManager;
  private trailEngine: TrailEngine;
  private actionSyncEngine: ActionManager;
  private wsServer: WebSocketHandler;
  
  // Core components
  private amplifyClient: AmplifyGraphQLClient;
  
  // System state
  private isInitialized = false;
  private isRunning = false;
  private systemConfig?: SystemConfig;

  constructor() {
    // MVPシステム設計の6つのコア機能を初期化
    this.amplifyClient = new AmplifyGraphQLClient();
    this.accountManager = new AccountManager(this.amplifyClient, {} as WebSocketHandler);
    this.positionExecutionEngine = new PositionManager();
    this.actionSyncEngine = new ActionManager({} as WebSocketHandler);
    this.trailEngine = new TrailEngine();
    this.wsServer = new WebSocketHandler();
    
    console.log('🏗️ Hedge System Core - 6つのコア機能を初期化完了');
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
      
      // 3. WebSocket サーバー開始
      await this.wsServer.initializeServer();
      
      // 4. Trail Engine開始
      await this.trailEngine.start();
      
      // 5. 既存のトレール監視対象を復旧
      await this.trailEngine.startAllTrailMonitoring();
      
      this.isInitialized = true;
      
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
    
    this.isRunning = true;
    console.log('🟢 Hedge System Core started successfully');
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
   * システム統計取得（簡素版）
   */
  getSystemStats() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      accountManagerStats: this.accountManager.getStats(),
      trailEngineStats: this.trailEngine.getStats()
    };
  }

  /**
   * システム状態取得（簡素版）
   */
  getSystemStatus(): SystemStatus {
    const accountStats = this.accountManager.getStats();
    
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      connectedAccounts: accountStats.connectedAccounts,
      totalAccounts: accountStats.assignedAccounts,
      activeSubscriptions: 0, // 簡素化
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
      this.trailEngine.stopAllTrailMonitoring();
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
   * WebSocketサーバー取得（外部アクセス用）
   */
  getWebSocketHandler(): WebSocketHandler {
    return this.wsServer;
  }

  /**
   * ポジション実行エンジン取得（外部アクセス用）
   */
  getPositionExecutionEngine(): PositionManager {
    return this.positionExecutionEngine;
  }
}