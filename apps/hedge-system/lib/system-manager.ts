/**
 * System Manager - 完全リアルタイム連携システム統合版
 * MVPシステム設計書準拠の統一システム管理
 * 
 * 主要機能：
 * 1. リアルタイム統合システムの管理
 * 2. 各コンポーネントの状態監視
 * 3. システム全体の初期化・停止
 * 4. ヘルスチェック・自動回復
 */

import { getCurrentUserId } from '@repo/shared-amplify/client';
import { 
  RealtimeIntegrationSystem,
  realtimeIntegrationSystem,
  RealtimeIntegrationConfig,
  IntegrationStats,
  SystemHealthStatus
} from './realtime-integration';

export interface SystemStatus {
  isRunning: boolean;
  userId?: string;
  integrationStats: IntegrationStats;
  healthStatus: SystemHealthStatus;
  startTime?: Date;
  uptime: number;
}

export class SystemManager {
  private isRunning = false;
  private isInitialized = false;
  private startTime?: Date;
  private currentUserId?: string;
  private realtimeIntegration: RealtimeIntegrationSystem;
  
  constructor() {
    this.realtimeIntegration = realtimeIntegrationSystem;
  }
  
  /**
   * システム初期化
   */
  async initialize(config?: Partial<RealtimeIntegrationConfig>): Promise<boolean> {
    try {
      console.log('🔧 Initializing System Manager...');
      
      // ユーザーID取得
      this.currentUserId = await getCurrentUserId();
      if (!this.currentUserId) {
        throw new Error('User not authenticated');
      }
      
      // リアルタイム統合システム設定更新
      if (config) {
        this.realtimeIntegration.updateConfig(config);
      }
      
      this.isInitialized = true;
      console.log(`✅ System Manager initialized for user: ${this.currentUserId}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ System Manager initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }
  
  /**
   * システム開始（完全リアルタイム連携）
   */
  async start(): Promise<boolean> {
    try {
      if (this.isRunning) {
        console.log('🔄 System Manager is already running');
        return true;
      }
      
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('System initialization failed');
        }
      }
      
      console.log('🚀 Starting System Manager with full realtime integration...');
      this.startTime = new Date();
      
      // リアルタイム統合システム開始
      await this.realtimeIntegration.start();
      
      this.isRunning = true;
      
      console.log('✅ System Manager started successfully');
      console.log('📊 All systems operational - realtime integration active');
      
      // 開始後のヘルスチェック
      const health = await this.getHealthStatus();
      console.log(`❤️ System health: ${health.overall}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ System Manager start failed:', error);
      this.isRunning = false;
      return false;
    }
  }
  
  /**
   * システム停止
   */
  async stop(): Promise<boolean> {
    try {
      if (!this.isRunning) {
        console.log('⏹️ System Manager is already stopped');
        return true;
      }
      
      console.log('⏹️ Stopping System Manager...');
      
      // リアルタイム統合システム停止
      await this.realtimeIntegration.stop();
      
      this.isRunning = false;
      this.startTime = undefined;
      
      console.log('✅ System Manager stopped successfully');
      
      return true;
      
    } catch (error) {
      console.error('❌ System Manager stop failed:', error);
      return false;
    }
  }
  
  /**
   * 緊急停止
   */
  async emergencyStop(): Promise<boolean> {
    try {
      console.warn('🚨 Emergency stop initiated...');
      
      // リアルタイム統合システム緊急停止
      await this.realtimeIntegration.emergencyStop();
      
      this.isRunning = false;
      this.startTime = undefined;
      
      console.warn('🚨 Emergency stop completed');
      
      return true;
      
    } catch (error) {
      console.error('❌ Emergency stop failed:', error);
      return false;
    }
  }
  
  /**
   * システム再起動
   */
  async restart(config?: Partial<RealtimeIntegrationConfig>): Promise<boolean> {
    try {
      console.log('🔄 Restarting System Manager...');
      
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
      
      if (config) {
        this.realtimeIntegration.updateConfig(config);
      }
      
      return await this.start();
      
    } catch (error) {
      console.error('❌ System restart failed:', error);
      return false;
    }
  }
  
  /**
   * システム状態取得
   */
  async getStatus(): Promise<SystemStatus> {
    try {
      const integrationStats = this.realtimeIntegration.getStats();
      const healthStatus = await this.realtimeIntegration.getSystemHealth();
      
      return {
        isRunning: this.isRunning,
        userId: this.currentUserId,
        integrationStats,
        healthStatus,
        startTime: this.startTime,
        uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0
      };
      
    } catch (error) {
      console.error('❌ Failed to get system status:', error);
      
      // フォールバック状態
      return {
        isRunning: this.isRunning,
        userId: this.currentUserId,
        integrationStats: {
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
        },
        healthStatus: {
          overall: 'CRITICAL',
          components: {
            websocket: 'DOWN',
            actionSync: 'DOWN',
            trailEngine: 'DOWN',
            priceMonitor: 'DOWN',
            subscriptions: 'DOWN'
          },
          recommendations: ['System status check failed']
        },
        startTime: this.startTime,
        uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0
      };
    }
  }
  
  /**
   * 簡易状態取得（後方互換性）
   */
  getSimpleStatus(): 'RUNNING' | 'STOPPED' | 'ERROR' {
    if (!this.isRunning) return 'STOPPED';
    
    try {
      const integrationRunning = this.realtimeIntegration.isSystemRunning();
      return integrationRunning ? 'RUNNING' : 'ERROR';
    } catch {
      return 'ERROR';
    }
  }
  
  /**
   * ヘルス状態取得
   */
  async getHealthStatus(): Promise<SystemHealthStatus> {
    return this.realtimeIntegration.getSystemHealth();
  }
  
  /**
   * 統計情報取得
   */
  getIntegrationStats(): IntegrationStats {
    return this.realtimeIntegration.getStats();
  }
  
  /**
   * 現在のユーザーID取得
   */
  async getCurrentUserId(): Promise<string | undefined> {
    if (!this.currentUserId) {
      this.currentUserId = await getCurrentUserId();
    }
    return this.currentUserId;
  }
  
  /**
   * リアルタイム統合システム取得
   */
  getRealtimeIntegration(): RealtimeIntegrationSystem {
    return this.realtimeIntegration;
  }
  
  /**
   * 個別コンポーネント取得
   */
  getWebSocketHandler() {
    return this.realtimeIntegration.getWebSocketHandler();
  }
  
  getActionSync() {
    return this.realtimeIntegration.getActionSync();
  }
  
  getTrailEngine() {
    return this.realtimeIntegration.getTrailEngine();
  }
  
  getPriceMonitor() {
    return this.realtimeIntegration.getPriceMonitor();
  }
  
  /**
   * システム設定更新
   */
  updateConfig(config: Partial<RealtimeIntegrationConfig>): void {
    this.realtimeIntegration.updateConfig(config);
    console.log('🔧 System configuration updated');
  }
  
  /**
   * 初期化状態確認
   */
  isSystemInitialized(): boolean {
    return this.isInitialized;
  }
  
  /**
   * 実行状態確認
   */
  isSystemRunning(): boolean {
    return this.isRunning && this.realtimeIntegration.isSystemRunning();
  }
  
  /**
   * パフォーマンス監視レポート生成
   */
  async generatePerformanceReport(): Promise<string> {
    try {
      const status = await this.getStatus();
      const timestamp = new Date().toISOString();
      
      const report = {
        timestamp,
        systemStatus: {
          isRunning: status.isRunning,
          uptime: status.uptime,
          userId: status.userId
        },
        integrationStats: status.integrationStats,
        healthStatus: status.healthStatus,
        summary: {
          overallHealth: status.healthStatus.overall,
          totalConnections: status.integrationStats.totalEAConnections,
          actionsProcessed: status.integrationStats.totalActionsProcessed,
          positionsManaged: status.integrationStats.totalPositionsManaged,
          errorRate: status.integrationStats.performance.errorRate,
          recommendations: status.healthStatus.recommendations
        }
      };
      
      console.log('📊 Performance report generated');
      return JSON.stringify(report, null, 2);
      
    } catch (error) {
      console.error('❌ Failed to generate performance report:', error);
      return JSON.stringify({ error: 'Report generation failed', timestamp: new Date().toISOString() });
    }
  }
}

export const systemManager = new SystemManager();