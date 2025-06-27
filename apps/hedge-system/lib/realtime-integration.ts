/**
 * Realtime Integration System - 完全リアルタイム連携システム
 * MVPシステム設計書準拠の統合実装
 * 
 * 主要機能：
 * 1. 管理画面↔Hedge System↔MT5 EAの完全リアルタイム連携
 * 2. AppSync Subscriptionを活用した複数PC間協調実行
 * 3. WebSocket統合・Action同期・Position管理の一元化
 * 4. 高性能・高信頼性のリアルタイム通信
 * 5. 自動回復・エラーハンドリング
 */

import { WebSocketHandler } from './websocket-handler';
import { ActionSync } from './action-sync';
import { TrailEngine } from './trail-engine';
import { PriceMonitor } from './price-monitor';
import { 
  subscriptionService,
  positionService,
  actionService,
  accountService
} from '@repo/shared-amplify';
import {
  Position,
  Action,
  Account,
  ActionStatus,
  PositionStatus,
  ActionType,
  Symbol
} from '@repo/shared-types';

// ========================================
// 型定義・インターフェース
// ========================================

export interface RealtimeIntegrationConfig {
  websocketPort: number;
  enableActionSync: boolean;
  enableTrailEngine: boolean;
  enablePriceMonitor: boolean;
  enableAdminSync: boolean;
  maxReconnectAttempts: number;
  syncInterval: number;
}

export interface IntegrationStats {
  isRunning: boolean;
  connectedServices: string[];
  totalActionsProcessed: number;
  totalPositionsManaged: number;
  totalEAConnections: number;
  lastSyncTime: Date | null;
  errors: number;
  uptime: number;
  performance: {
    averageLatency: number;
    messagesPerSecond: number;
    errorRate: number;
  };
}

export interface SystemHealthStatus {
  overall: 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'CRITICAL';
  components: {
    websocket: 'UP' | 'DOWN' | 'DEGRADED';
    actionSync: 'UP' | 'DOWN' | 'DEGRADED';
    trailEngine: 'UP' | 'DOWN' | 'DEGRADED';
    priceMonitor: 'UP' | 'DOWN' | 'DEGRADED';
    subscriptions: 'UP' | 'DOWN' | 'DEGRADED';
  };
  recommendations: string[];
}

// ========================================
// Realtime Integration System
// ========================================

/**
 * リアルタイム統合システム - MVPシステム設計書準拠
 * 全コンポーネントの統合管理・リアルタイム連携の中核システム
 */
export class RealtimeIntegrationSystem {
  private config: RealtimeIntegrationConfig;
  private isRunning = false;
  private startTime?: Date;
  
  // コアコンポーネント
  private webSocketHandler: WebSocketHandler;
  private actionSync: ActionSync;
  private trailEngine: TrailEngine;
  private priceMonitor: PriceMonitor;
  
  // 統計・監視
  private stats: IntegrationStats;
  private subscriptionIds: string[] = [];
  private healthCheckInterval?: NodeJS.Timeout;
  
  constructor(config: Partial<RealtimeIntegrationConfig> = {}) {
    this.config = {
      websocketPort: 8080,
      enableActionSync: true,
      enableTrailEngine: true,
      enablePriceMonitor: true,
      enableAdminSync: true,
      maxReconnectAttempts: 5,
      syncInterval: 5000,
      ...config
    };
    
    // コンポーネント初期化
    this.webSocketHandler = new WebSocketHandler();
    this.actionSync = new ActionSync(this.webSocketHandler);
    this.trailEngine = new TrailEngine();
    this.priceMonitor = new PriceMonitor();
    
    // 統計初期化
    this.stats = {
      isRunning: false,
      connectedServices: [],
      totalActionsProcessed: 0,
      totalPositionsManaged: 0,
      totalEAConnections: 0,
      lastSyncTime: null,
      errors: 0,
      uptime: 0,
      performance: {
        averageLatency: 0,
        messagesPerSecond: 0,
        errorRate: 0
      }
    };
    
    this.setupIntegrations();
  }
  
  // ========================================
  // システム初期化・設定
  // ========================================
  
  /**
   * システム統合設定
   */
  private setupIntegrations(): void {
    // WebSocketHandler ← ActionSync 統合
    this.webSocketHandler.setActionSync(this.actionSync);
    
    // WebSocketHandler ← PriceMonitor 統合
    this.webSocketHandler.setPriceMonitor(this.priceMonitor);
    
    // TrailEngine ← ActionSync 統合（トリガー実行用）
    this.trailEngine.setActionSync(this.actionSync);
    
    // PriceMonitor ← TrailEngine 統合（価格変動→トレール判定）
    this.priceMonitor.setTrailEngine(this.trailEngine);
    
    console.log('🔧 Realtime integration components linked successfully');
  }
  
  /**
   * リアルタイム統合システム開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 Realtime integration system is already running');
      return;
    }
    
    console.log('🚀 Starting Realtime Integration System...');
    this.startTime = new Date();
    
    try {
      // 1. WebSocket接続開始
      if (this.config.enableActionSync) {
        await this.webSocketHandler.connect(this.config.websocketPort);
        this.stats.connectedServices.push('websocket');
      }
      
      // 2. ActionSync開始
      if (this.config.enableActionSync) {
        await this.actionSync.start();
        this.stats.connectedServices.push('actionSync');
      }
      
      // 3. TrailEngine開始
      if (this.config.enableTrailEngine) {
        await this.trailEngine.start();
        this.stats.connectedServices.push('trailEngine');
      }
      
      // 4. PriceMonitor開始
      if (this.config.enablePriceMonitor) {
        await this.priceMonitor.start();
        this.stats.connectedServices.push('priceMonitor');
      }
      
      // 5. 管理画面連携Subscription開始
      if (this.config.enableAdminSync) {
        await this.setupAdminSyncSubscriptions();
        this.stats.connectedServices.push('adminSync');
      }
      
      // 6. ヘルスチェック開始
      this.startHealthMonitoring();
      
      this.isRunning = true;
      this.stats.isRunning = true;
      
      console.log('✅ Realtime Integration System started successfully');
      console.log(`📊 Connected services: ${this.stats.connectedServices.join(', ')}`);
      
    } catch (error) {
      console.error('❌ Failed to start Realtime Integration System:', error);
      await this.stop(); // クリーンアップ
      throw error;
    }
  }
  
  /**
   * システム停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    console.log('🛑 Stopping Realtime Integration System...');
    
    try {
      // ヘルスチェック停止
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }
      
      // 管理画面Subscription停止
      await this.stopAdminSyncSubscriptions();
      
      // コンポーネント停止
      if (this.config.enablePriceMonitor && this.priceMonitor) {
        await this.priceMonitor.stop();
      }
      
      if (this.config.enableTrailEngine && this.trailEngine) {
        await this.trailEngine.stop();
      }
      
      if (this.config.enableActionSync && this.actionSync) {
        await this.actionSync.stop();
      }
      
      if (this.webSocketHandler) {
        await this.webSocketHandler.disconnect();
      }
      
      this.isRunning = false;
      this.stats.isRunning = false;
      this.stats.connectedServices = [];
      
      console.log('✅ Realtime Integration System stopped');
      
    } catch (error) {
      console.error('❌ Error stopping Realtime Integration System:', error);
    }
  }
  
  // ========================================
  // 管理画面連携Subscription
  // ========================================
  
  /**
   * 管理画面連携Subscription設定
   */
  private async setupAdminSyncSubscriptions(): Promise<void> {
    try {
      // Position状態変更監視（管理画面からの操作）
      const positionSubId = await subscriptionService.subscribeToPositions(
        async (position: Position) => {
          await this.handleAdminPositionUpdate(position);
        }
      );
      this.subscriptionIds.push(positionSubId);
      
      // Action状態変更監視（管理画面からの操作）
      const actionSubId = await subscriptionService.subscribeToActions(
        async (action: Action) => {
          await this.handleAdminActionUpdate(action);
        }
      );
      this.subscriptionIds.push(actionSubId);
      
      // Account情報更新監視
      const accountSubId = await subscriptionService.subscribeToAccounts(
        async (account: Account) => {
          await this.handleAdminAccountUpdate(account);
        }
      );
      this.subscriptionIds.push(accountSubId);
      
      console.log('📡 Admin sync subscriptions established');
      
    } catch (error) {
      console.error('❌ Failed to setup admin sync subscriptions:', error);
      throw error;
    }
  }
  
  /**
   * 管理画面Subscription停止
   */
  private async stopAdminSyncSubscriptions(): Promise<void> {
    for (const subscriptionId of this.subscriptionIds) {
      subscriptionService.unsubscribe(subscriptionId);
    }
    this.subscriptionIds = [];
    console.log('📴 Admin sync subscriptions stopped');
  }
  
  /**
   * 管理画面からのPosition更新処理
   */
  private async handleAdminPositionUpdate(position: Position): Promise<void> {
    try {
      console.log(`📨 Admin position update: ${position.id} -> ${position.status}`);
      
      // ステータス変更に応じた処理
      switch (position.status) {
        case PositionStatus.OPENING:
          // エントリー実行開始
          await this.triggerPositionEntry(position);
          break;
          
        case PositionStatus.CLOSING:
          // 決済実行開始
          await this.triggerPositionClose(position);
          break;
          
        default:
          // TrailEngineで監視対象更新
          if (this.trailEngine) {
            await this.trailEngine.updateMonitoredPosition(position);
          }
      }
      
      this.stats.totalPositionsManaged++;
      
    } catch (error) {
      console.error(`❌ Failed to handle admin position update: ${position.id}`, error);
      this.stats.errors++;
    }
  }
  
  /**
   * 管理画面からのAction更新処理
   */
  private async handleAdminActionUpdate(action: Action): Promise<void> {
    try {
      console.log(`📨 Admin action update: ${action.id} -> ${action.status}`);
      
      // PENDING→EXECUTINGの場合はActionSyncが自動処理
      if (action.status === ActionStatus.EXECUTING) {
        // ActionSyncが自動的に処理するため、統計のみ更新
        this.stats.totalActionsProcessed++;
      }
      
    } catch (error) {
      console.error(`❌ Failed to handle admin action update: ${action.id}`, error);
      this.stats.errors++;
    }
  }
  
  /**
   * 管理画面からのAccount更新処理
   */
  private async handleAdminAccountUpdate(account: Account): Promise<void> {
    try {
      console.log(`📨 Admin account update: ${account.id}`);
      
      // WebSocketハンドラーに口座情報更新を通知
      // EA接続管理の更新処理
      
    } catch (error) {
      console.error(`❌ Failed to handle admin account update: ${account.id}`, error);
      this.stats.errors++;
    }
  }
  
  // ========================================
  // Position実行処理
  // ========================================
  
  /**
   * ポジションエントリー実行
   */
  private async triggerPositionEntry(position: Position): Promise<void> {
    try {
      // ActionSyncを通じてエントリーAction作成・実行
      const action = await this.actionSync.createAction({
        accountId: position.accountId,
        positionId: position.id,
        type: ActionType.ENTRY,
        status: ActionStatus.EXECUTING
      });
      
      console.log(`🎯 Position entry triggered: ${position.id} via action: ${action.id}`);
      
    } catch (error) {
      console.error(`❌ Failed to trigger position entry: ${position.id}`, error);
      throw error;
    }
  }
  
  /**
   * ポジション決済実行
   */
  private async triggerPositionClose(position: Position): Promise<void> {
    try {
      // ActionSyncを通じて決済Action作成・実行
      const action = await this.actionSync.createAction({
        accountId: position.accountId,
        positionId: position.id,
        type: ActionType.CLOSE,
        status: ActionStatus.EXECUTING
      });
      
      console.log(`🎯 Position close triggered: ${position.id} via action: ${action.id}`);
      
    } catch (error) {
      console.error(`❌ Failed to trigger position close: ${position.id}`, error);
      throw error;
    }
  }
  
  // ========================================
  // ヘルスチェック・監視
  // ========================================
  
  /**
   * ヘルスチェック監視開始
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // 30秒間隔
    
    console.log('❤️ Health monitoring started');
  }
  
  /**
   * ヘルスチェック実行
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getSystemHealth();
      
      // 警告レベルの問題検出
      if (health.overall === 'DEGRADED') {
        console.warn('⚠️ System health degraded:', health.recommendations);
      } else if (health.overall === 'CRITICAL') {
        console.error('🚨 System health critical:', health.recommendations);
        // 自動回復処理の実行
        await this.performAutoRecovery(health);
      }
      
      // 統計更新
      this.updatePerformanceStats();
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      this.stats.errors++;
    }
  }
  
  /**
   * システムヘルス状態取得
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    const components = {
      websocket: this.webSocketHandler.isConnected() ? 'UP' : 'DOWN',
      actionSync: this.actionSync.isHealthy() ? 'UP' : 'DOWN',
      trailEngine: this.trailEngine.isRunning() ? 'UP' : 'DOWN',
      priceMonitor: this.priceMonitor.isRunning() ? 'UP' : 'DOWN',
      subscriptions: this.subscriptionIds.length > 0 ? 'UP' : 'DOWN'
    } as const;
    
    const downComponents = Object.entries(components).filter(([_, status]) => status === 'DOWN');
    const degradedComponents = Object.entries(components).filter(([_, status]) => status === 'DEGRADED');
    
    let overall: SystemHealthStatus['overall'];
    if (downComponents.length === 0 && degradedComponents.length === 0) {
      overall = 'EXCELLENT';
    } else if (downComponents.length === 0 && degradedComponents.length <= 1) {
      overall = 'GOOD';
    } else if (downComponents.length <= 1) {
      overall = 'DEGRADED';
    } else {
      overall = 'CRITICAL';
    }
    
    const recommendations: string[] = [];
    if (components.websocket === 'DOWN') {
      recommendations.push('WebSocket connection lost - check network connectivity');
    }
    if (components.actionSync === 'DOWN') {
      recommendations.push('ActionSync not healthy - check subscription status');
    }
    if (components.trailEngine === 'DOWN') {
      recommendations.push('TrailEngine stopped - restart trail monitoring');
    }
    
    return {
      overall,
      components,
      recommendations
    };
  }
  
  /**
   * 自動回復処理
   */
  private async performAutoRecovery(health: SystemHealthStatus): Promise<void> {
    console.log('🔄 Performing auto-recovery...');
    
    try {
      // WebSocket接続回復
      if (health.components.websocket === 'DOWN') {
        await this.webSocketHandler.connect(this.config.websocketPort);
      }
      
      // ActionSync回復
      if (health.components.actionSync === 'DOWN') {
        await this.actionSync.start();
      }
      
      // TrailEngine回復
      if (health.components.trailEngine === 'DOWN') {
        await this.trailEngine.start();
      }
      
      // PriceMonitor回復
      if (health.components.priceMonitor === 'DOWN') {
        await this.priceMonitor.start();
      }
      
      // Subscription回復
      if (health.components.subscriptions === 'DOWN') {
        await this.setupAdminSyncSubscriptions();
      }
      
      console.log('✅ Auto-recovery completed');
      
    } catch (error) {
      console.error('❌ Auto-recovery failed:', error);
    }
  }
  
  /**
   * パフォーマンス統計更新
   */
  private updatePerformanceStats(): void {
    if (this.startTime) {
      this.stats.uptime = Date.now() - this.startTime.getTime();
    }
    
    // WebSocketHandler統計取得
    const wsStats = this.webSocketHandler.getStats();
    wsStats.then(ws => {
      this.stats.totalEAConnections = ws.connectedClients;
      this.stats.performance.messagesPerSecond = ws.messagesPerSecond || 0;
    });
    
    // ActionSync統計取得
    const actionStats = this.actionSync.getStats();
    this.stats.totalActionsProcessed = actionStats.totalExecuted;
    
    // エラー率計算
    const totalOperations = this.stats.totalActionsProcessed + this.stats.totalPositionsManaged;
    this.stats.performance.errorRate = totalOperations > 0 ? 
      (this.stats.errors / totalOperations) * 100 : 0;
    
    this.stats.lastSyncTime = new Date();
  }
  
  // ========================================
  // 外部アクセス用メソッド
  // ========================================
  
  /**
   * 統計情報取得
   */
  getStats(): IntegrationStats {
    this.updatePerformanceStats();
    return { ...this.stats };
  }
  
  /**
   * システム状態確認
   */
  isSystemRunning(): boolean {
    return this.isRunning;
  }
  
  /**
   * 個別コンポーネント取得
   */
  getWebSocketHandler(): WebSocketHandler {
    return this.webSocketHandler;
  }
  
  getActionSync(): ActionSync {
    return this.actionSync;
  }
  
  getTrailEngine(): TrailEngine {
    return this.trailEngine;
  }
  
  getPriceMonitor(): PriceMonitor {
    return this.priceMonitor;
  }
  
  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<RealtimeIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Configuration updated:', newConfig);
  }
  
  /**
   * 緊急停止
   */
  async emergencyStop(): Promise<void> {
    console.warn('🚨 Emergency stop initiated...');
    
    // 強制的に全コンポーネント停止
    if (this.actionSync) {
      await this.actionSync.forceStop();
    }
    
    await this.stop();
    
    console.warn('🚨 Emergency stop completed');
  }
}

// ========================================
// シングルトンインスタンス
// ========================================

export const realtimeIntegrationSystem = new RealtimeIntegrationSystem();

// 便利関数エクスポート
export const startRealtimeIntegration = (config?: Partial<RealtimeIntegrationConfig>) => {
  if (config) {
    realtimeIntegrationSystem.updateConfig(config);
  }
  return realtimeIntegrationSystem.start();
};

export const stopRealtimeIntegration = () => realtimeIntegrationSystem.stop();

export const getIntegrationStats = () => realtimeIntegrationSystem.getStats();

export const getSystemHealth = () => realtimeIntegrationSystem.getSystemHealth();