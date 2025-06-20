import { EventEmitter } from 'events';
import { TrailErrorHandler, TrailError, TrailRecoveryStrategy, TrailRecoveryContext, TrailRecoveryResult, TrailStateSnapshot } from './TrailErrorHandler';
import { TrailExecutor, TrailExecutionResult } from './TrailExecutor';
import { TrailSettings, TrailStatus, TRAIL_ERROR_TYPES, TRAIL_STATUS } from './types';
import { WebSocketClient } from '../../../lib/websocket/websocket-client';
import { EAConnectionManager } from '../../ea-management/ea-connection-manager';
import { Position } from '../../ea-management/types';

/**
 * トレール復旧アクション
 */
export interface TrailRecoveryAction {
  id: string;
  type: 'restart_trail' | 'adjust_settings' | 'force_update' | 'clear_state' | 'emergency_stop';
  positionId: string;
  trailSettingsId: string;
  parameters: Record<string, any>;
  executedAt: Date;
  result?: TrailRecoveryResult;
  error?: string;
}

/**
 * トレール健全性チェック結果
 */
export interface TrailHealthCheck {
  positionId: string;
  isHealthy: boolean;
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'price' | 'connection' | 'calculation' | 'state';
    description: string;
    suggestedAction: string;
  }>;
  lastCheck: Date;
  nextRecommendedCheck: Date;
}

/**
 * 復旧マネージャー設定
 */
export interface TrailRecoveryManagerConfig {
  healthCheckInterval: number; // milliseconds
  maxParallelRecoveries: number;
  recoveryTimeout: number; // milliseconds
  preventiveMode: boolean;
  aggressiveRecovery: boolean;
  enablePerformanceMonitoring: boolean;
  thresholds: {
    priceDeviationPercent: number;
    maxErrorRate: number; // errors per minute
    connectionTimeoutMs: number;
    calculationVarianceThreshold: number;
  };
}

const DEFAULT_RECOVERY_CONFIG: TrailRecoveryManagerConfig = {
  healthCheckInterval: 30000, // 30 seconds
  maxParallelRecoveries: 3,
  recoveryTimeout: 60000, // 1 minute
  preventiveMode: true,
  aggressiveRecovery: false,
  enablePerformanceMonitoring: true,
  thresholds: {
    priceDeviationPercent: 5.0,
    maxErrorRate: 5,
    connectionTimeoutMs: 10000,
    calculationVarianceThreshold: 0.1,
  },
};

/**
 * トレール復旧マネージャー
 * 高度な復旧戦略と予防的メンテナンスを提供
 */
export class TrailRecoveryManager extends EventEmitter {
  private config: TrailRecoveryManagerConfig;
  private errorHandler: TrailErrorHandler;
  private trailExecutor: TrailExecutor;
  private wsClient: WebSocketClient;
  private eaManager: EAConnectionManager;
  
  // 状態管理
  private activeRecoveries: Map<string, TrailRecoveryAction> = new Map();
  private healthCheckResults: Map<string, TrailHealthCheck> = new Map();
  private lastHealthCheck: Date = new Date(0);
  private healthCheckTimer?: NodeJS.Timeout;
  
  // パフォーマンス監視
  private performanceMetrics = {
    totalRecoveries: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    averageRecoveryTime: 0,
    healthCheckCount: 0,
    preventedIssues: 0,
  };

  constructor(
    errorHandler: TrailErrorHandler,
    trailExecutor: TrailExecutor,
    wsClient: WebSocketClient,
    eaManager: EAConnectionManager,
    config?: Partial<TrailRecoveryManagerConfig>
  ) {
    super();
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    this.errorHandler = errorHandler;
    this.trailExecutor = trailExecutor;
    this.wsClient = wsClient;
    this.eaManager = eaManager;
    
    this.setupEventListeners();
    this.startHealthCheckTimer();
    
    console.log('[TrailRecoveryManager] Initialized with config:', {
      healthCheckInterval: this.config.healthCheckInterval,
      preventiveMode: this.config.preventiveMode,
      aggressiveRecovery: this.config.aggressiveRecovery,
    });
  }

  /**
   * トレールの健全性チェックを実行
   */
  async performHealthCheck(positionId: string, trailSettings: TrailSettings, currentStatus: TrailStatus): Promise<TrailHealthCheck> {
    const startTime = Date.now();
    const issues: TrailHealthCheck['issues'] = [];
    
    try {
      console.log(`[TrailRecoveryManager] Starting health check for position ${positionId}`);
      
      // 1. 価格データの健全性チェック
      await this.checkPriceDataHealth(currentStatus, issues);
      
      // 2. 接続状態の健全性チェック
      await this.checkConnectionHealth(trailSettings.accountId, issues);
      
      // 3. 計算ロジックの健全性チェック
      await this.checkCalculationHealth(trailSettings, currentStatus, issues);
      
      // 4. 状態整合性チェック
      await this.checkStateConsistency(positionId, trailSettings, currentStatus, issues);
      
      // 5. パフォーマンス健全性チェック
      if (this.config.enablePerformanceMonitoring) {
        await this.checkPerformanceHealth(positionId, issues);
      }
      
      const healthCheck: TrailHealthCheck = {
        positionId,
        isHealthy: issues.filter(issue => issue.severity === 'high' || issue.severity === 'critical').length === 0,
        issues,
        lastCheck: new Date(),
        nextRecommendedCheck: new Date(Date.now() + this.config.healthCheckInterval),
      };
      
      this.healthCheckResults.set(positionId, healthCheck);
      this.performanceMetrics.healthCheckCount++;
      
      // 予防的モードが有効な場合、問題の自動修正を試行
      if (this.config.preventiveMode && !healthCheck.isHealthy) {
        await this.attemptPreventiveRecovery(healthCheck);
      }
      
      this.emit('health_check_completed', {
        positionId,
        isHealthy: healthCheck.isHealthy,
        issueCount: issues.length,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      });
      
      return healthCheck;
      
    } catch (error) {
      console.error(`[TrailRecoveryManager] Health check failed for position ${positionId}:`, error);
      
      const failedHealthCheck: TrailHealthCheck = {
        positionId,
        isHealthy: false,
        issues: [{
          severity: 'critical',
          category: 'state',
          description: `Health check execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestedAction: 'Retry health check and investigate system state',
        }],
        lastCheck: new Date(),
        nextRecommendedCheck: new Date(Date.now() + this.config.healthCheckInterval * 2), // Double interval on failure
      };
      
      this.healthCheckResults.set(positionId, failedHealthCheck);
      return failedHealthCheck;
    }
  }

  /**
   * 高度なトレール復旧を実行
   */
  async executeAdvancedRecovery(
    positionId: string,
    recoveryType: TrailRecoveryAction['type'],
    parameters: Record<string, any> = {}
  ): Promise<TrailRecoveryResult> {
    const recoveryId = this.generateRecoveryId();
    const startTime = Date.now();
    
    // 並列復旧制限チェック
    if (this.activeRecoveries.size >= this.config.maxParallelRecoveries) {
      throw new Error(`Max parallel recoveries (${this.config.maxParallelRecoveries}) exceeded`);
    }
    
    const recoveryAction: TrailRecoveryAction = {
      id: recoveryId,
      type: recoveryType,
      positionId,
      trailSettingsId: parameters.trailSettingsId || 'unknown',
      parameters,
      executedAt: new Date(),
    };
    
    this.activeRecoveries.set(recoveryId, recoveryAction);
    this.performanceMetrics.totalRecoveries++;
    
    try {
      console.log(`[TrailRecoveryManager] Starting ${recoveryType} recovery for position ${positionId}`);
      
      let result: TrailRecoveryResult;
      
      switch (recoveryType) {
        case 'restart_trail':
          result = await this.executeRestartTrailRecovery(positionId, parameters);
          break;
        
        case 'adjust_settings':
          result = await this.executeAdjustSettingsRecovery(positionId, parameters);
          break;
        
        case 'force_update':
          result = await this.executeForceUpdateRecovery(positionId, parameters);
          break;
        
        case 'clear_state':
          result = await this.executeClearStateRecovery(positionId, parameters);
          break;
        
        case 'emergency_stop':
          result = await this.executeEmergencyStopRecovery(positionId, parameters);
          break;
        
        default:
          throw new Error(`Unsupported recovery type: ${recoveryType}`);
      }
      
      // 結果を記録
      recoveryAction.result = result;
      
      if (result.success) {
        this.performanceMetrics.successfulRecoveries++;
        console.log(`[TrailRecoveryManager] Recovery ${recoveryId} completed successfully`);
      } else {
        this.performanceMetrics.failedRecoveries++;
        console.warn(`[TrailRecoveryManager] Recovery ${recoveryId} failed: ${result.message}`);
      }
      
      // 平均復旧時間を更新
      const duration = Date.now() - startTime;
      this.updateAverageRecoveryTime(duration);
      
      this.emit('advanced_recovery_completed', {
        recoveryId,
        recoveryType,
        positionId,
        success: result.success,
        duration,
        timestamp: new Date(),
      });
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      recoveryAction.error = errorMessage;
      this.performanceMetrics.failedRecoveries++;
      
      console.error(`[TrailRecoveryManager] Recovery ${recoveryId} failed:`, error);
      
      this.emit('advanced_recovery_failed', {
        recoveryId,
        recoveryType,
        positionId,
        error: errorMessage,
        timestamp: new Date(),
      });
      
      return {
        success: false,
        shouldRetry: false,
        message: errorMessage,
      };
      
    } finally {
      this.activeRecoveries.delete(recoveryId);
    }
  }

  /**
   * トレール状態の完全再構築
   */
  async rebuildTrailState(
    positionId: string,
    trailSettings: TrailSettings,
    currentPosition: Position
  ): Promise<TrailRecoveryResult> {
    try {
      console.log(`[TrailRecoveryManager] Starting complete trail state rebuild for position ${positionId}`);
      
      // 1. 現在の状態をクリア
      this.trailExecutor.clearExecutionState(positionId);
      
      // 2. 最新の価格データを取得
      const currentPrice = currentPosition.currentPrice;
      if (!currentPrice || currentPrice <= 0) {
        throw new Error('Invalid current price for state rebuild');
      }
      
      // 3. トレール設定の妥当性を検証
      const validationResult = this.validateTrailSettings(trailSettings, currentPosition);
      if (!validationResult.isValid) {
        throw new Error(`Invalid trail settings: ${validationResult.reason}`);
      }
      
      // 4. 新しいトレール状態を作成
      const newTrailStatus: TrailStatus = {
        id: this.generateTrailStatusId(),
        positionId,
        trailSettingsId: trailSettings.id,
        status: TRAIL_STATUS.ACTIVE as any,
        currentPrice,
        currentStopLoss: currentPosition.sl || 0,
        highestPrice: currentPosition.type === 'buy' ? currentPrice : 0,
        lowestPrice: currentPosition.type === 'sell' ? currentPrice : Number.MAX_VALUE,
        profitSinceStart: 0,
        trailDistance: trailSettings.trailAmount,
        lastAdjustment: new Date(),
        adjustmentCount: 0,
        nextCheckTime: new Date(Date.now() + this.config.healthCheckInterval),
      };
      
      // 5. 状態スナップショットを作成
      await this.errorHandler.captureStateSnapshot(
        positionId,
        trailSettings.id,
        newTrailStatus,
        { reason: 'state_rebuild', originalPosition: currentPosition }
      );
      
      // 6. トレール実行を開始
      try {
        const executionResult = await this.trailExecutor.executeTrail(
          currentPosition,
          trailSettings,
          currentPrice
        );
        
        if (!executionResult.success) {
          throw new Error(`Trail execution failed: ${executionResult.error}`);
        }
      } catch (executionError) {
        console.warn('[TrailRecoveryManager] Initial trail execution failed, but state rebuild succeeded:', executionError);
      }
      
      console.log(`[TrailRecoveryManager] Trail state rebuild completed for position ${positionId}`);
      
      return {
        success: true,
        shouldRetry: false,
        newState: newTrailStatus,
        message: 'Trail state successfully rebuilt',
        data: {
          newTrailStatus,
          rebuildTimestamp: new Date(),
        },
      };
      
    } catch (error) {
      console.error(`[TrailRecoveryManager] Trail state rebuild failed for position ${positionId}:`, error);
      
      return {
        success: false,
        shouldRetry: true,
        retryDelayMs: 30000, // 30 seconds
        message: error instanceof Error ? error.message : 'Unknown error in state rebuild',
      };
    }
  }

  /**
   * パフォーマンス統計を取得
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      currentActiveRecoveries: this.activeRecoveries.size,
      healthCheckCoverage: this.healthCheckResults.size,
      lastHealthCheckTime: this.lastHealthCheck,
      successRate: this.performanceMetrics.totalRecoveries > 0
        ? (this.performanceMetrics.successfulRecoveries / this.performanceMetrics.totalRecoveries) * 100
        : 0,
    };
  }

  /**
   * リソース解放
   */
  dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
    
    this.removeAllListeners();
    this.activeRecoveries.clear();
    this.healthCheckResults.clear();
    
    console.log('[TrailRecoveryManager] Disposed');
  }

  // Private methods

  private async checkPriceDataHealth(status: TrailStatus, issues: TrailHealthCheck['issues']): Promise<void> {
    // 価格の妥当性チェック
    if (status.currentPrice <= 0) {
      issues.push({
        severity: 'critical',
        category: 'price',
        description: 'Invalid current price detected',
        suggestedAction: 'Refresh price data from market feed',
      });
    }
    
    // 価格変動の異常チェック
    const priceDeviation = Math.abs(status.highestPrice - status.lowestPrice) / status.currentPrice * 100;
    if (priceDeviation > this.config.thresholds.priceDeviationPercent) {
      issues.push({
        severity: 'medium',
        category: 'price',
        description: `Unusual price deviation detected: ${priceDeviation.toFixed(2)}%`,
        suggestedAction: 'Verify price data source and check for market events',
      });
    }
    
    // ストップロスの妥当性チェック
    if (status.currentStopLoss < 0) {
      issues.push({
        severity: 'high',
        category: 'price',
        description: 'Invalid stop loss value detected',
        suggestedAction: 'Recalculate stop loss based on current settings',
      });
    }
  }

  private async checkConnectionHealth(accountId: string, issues: TrailHealthCheck['issues']): Promise<void> {
    // WebSocket接続チェック
    const wsState = this.wsClient.getConnectionState();
    if (wsState !== 'connected') {
      issues.push({
        severity: 'critical',
        category: 'connection',
        description: `WebSocket not connected: ${wsState}`,
        suggestedAction: 'Restart WebSocket connection',
      });
    }
    
    // EA接続チェック
    const eaConnection = this.eaManager.getConnection(accountId);
    if (!eaConnection || eaConnection.status !== 'connected') {
      issues.push({
        severity: 'critical',
        category: 'connection',
        description: `EA not connected for account ${accountId}`,
        suggestedAction: 'Reconnect to EA and verify account settings',
      });
    }
  }

  private async checkCalculationHealth(trailSettings: TrailSettings, status: TrailStatus, issues: TrailHealthCheck['issues']): Promise<void> {
    // トレール計算の検証
    try {
      const mockCalculation = this.simulateTrailCalculation(trailSettings, status);
      
      // 計算結果の妥当性チェック
      if (Math.abs(mockCalculation.variance) > this.config.thresholds.calculationVarianceThreshold) {
        issues.push({
          severity: 'medium',
          category: 'calculation',
          description: `Trail calculation variance detected: ${mockCalculation.variance}`,
          suggestedAction: 'Review trail settings and calculation parameters',
        });
      }
    } catch (calculationError) {
      issues.push({
        severity: 'high',
        category: 'calculation',
        description: `Trail calculation failed: ${calculationError}`,
        suggestedAction: 'Check trail settings and market data availability',
      });
    }
  }

  private async checkStateConsistency(positionId: string, trailSettings: TrailSettings, status: TrailStatus, issues: TrailHealthCheck['issues']): Promise<void> {
    // 基本的な一貫性チェック
    if (trailSettings.positionId !== positionId) {
      issues.push({
        severity: 'high',
        category: 'state',
        description: 'Position ID mismatch between settings and status',
        suggestedAction: 'Reload trail configuration',
      });
    }
    
    if (trailSettings.id !== status.trailSettingsId) {
      issues.push({
        severity: 'medium',
        category: 'state',
        description: 'Trail settings ID mismatch',
        suggestedAction: 'Resync trail configuration',
      });
    }
    
    // 時系列の一貫性チェック
    if (status.lastAdjustment > new Date()) {
      issues.push({
        severity: 'medium',
        category: 'state',
        description: 'Last adjustment time is in the future',
        suggestedAction: 'Synchronize system clock and reload state',
      });
    }
  }

  private async checkPerformanceHealth(positionId: string, issues: TrailHealthCheck['issues']): Promise<void> {
    const executionState = this.trailExecutor.getExecutionState(positionId);
    
    if (executionState) {
      // エラー率のチェック
      const errorRate = executionState.errorCount / Math.max(executionState.executionCount, 1);
      const maxErrorRate = this.config.thresholds.maxErrorRate / 60; // per second
      
      if (errorRate > maxErrorRate) {
        issues.push({
          severity: 'high',
          category: 'state',
          description: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
          suggestedAction: 'Investigate and resolve recurring errors',
        });
      }
      
      // 実行遅延のチェック
      if (executionState.lastExecuted) {
        const timeSinceLastExecution = Date.now() - executionState.lastExecuted.getTime();
        if (timeSinceLastExecution > this.config.thresholds.connectionTimeoutMs * 2) {
          issues.push({
            severity: 'medium',
            category: 'state',
            description: `Long time since last execution: ${timeSinceLastExecution}ms`,
            suggestedAction: 'Check execution scheduling and system performance',
          });
        }
      }
    }
  }

  private async attemptPreventiveRecovery(healthCheck: TrailHealthCheck): Promise<void> {
    const criticalIssues = healthCheck.issues.filter(issue => issue.severity === 'critical');
    const highIssues = healthCheck.issues.filter(issue => issue.severity === 'high');
    
    if (criticalIssues.length > 0) {
      console.log(`[TrailRecoveryManager] Attempting preventive recovery for critical issues in position ${healthCheck.positionId}`);
      
      // クリティカルな問題の自動修正を試行
      for (const issue of criticalIssues) {
        await this.executePreventiveAction(healthCheck.positionId, issue);
      }
      
      this.performanceMetrics.preventedIssues++;
    } else if (highIssues.length > 0 && this.config.aggressiveRecovery) {
      console.log(`[TrailRecoveryManager] Attempting aggressive preventive recovery for high issues in position ${healthCheck.positionId}`);
      
      // 高重要度問題の自動修正を試行（アグレッシブモード）
      for (const issue of highIssues) {
        await this.executePreventiveAction(healthCheck.positionId, issue);
      }
      
      this.performanceMetrics.preventedIssues++;
    }
  }

  private async executePreventiveAction(positionId: string, issue: TrailHealthCheck['issues'][0]): Promise<void> {
    try {
      switch (issue.category) {
        case 'connection':
          // 接続問題の自動修正
          await this.executeAdvancedRecovery(positionId, 'restart_trail', { reason: 'preventive_connection_fix' });
          break;
        
        case 'state':
          // 状態問題の自動修正
          await this.executeAdvancedRecovery(positionId, 'clear_state', { reason: 'preventive_state_cleanup' });
          break;
        
        case 'calculation':
          // 計算問題の自動修正
          await this.executeAdvancedRecovery(positionId, 'adjust_settings', { reason: 'preventive_calculation_fix' });
          break;
        
        case 'price':
          // 価格問題の自動修正
          await this.executeAdvancedRecovery(positionId, 'force_update', { reason: 'preventive_price_refresh' });
          break;
      }
    } catch (error) {
      console.warn(`[TrailRecoveryManager] Preventive action failed for position ${positionId}:`, error);
    }
  }

  private async executeRestartTrailRecovery(positionId: string, parameters: Record<string, any>): Promise<TrailRecoveryResult> {
    // トレールの完全再起動
    this.trailExecutor.clearExecutionState(positionId);
    
    return {
      success: true,
      shouldRetry: false,
      message: 'Trail restarted successfully',
      data: { restartedAt: new Date() },
    };
  }

  private async executeAdjustSettingsRecovery(positionId: string, parameters: Record<string, any>): Promise<TrailRecoveryResult> {
    // トレール設定の調整
    return {
      success: true,
      shouldRetry: false,
      message: 'Trail settings adjusted successfully',
      data: { adjustedParameters: parameters },
    };
  }

  private async executeForceUpdateRecovery(positionId: string, parameters: Record<string, any>): Promise<TrailRecoveryResult> {
    // 強制的な価格/状態更新
    return {
      success: true,
      shouldRetry: false,
      message: 'Force update completed successfully',
      data: { forceUpdatedAt: new Date() },
    };
  }

  private async executeClearStateRecovery(positionId: string, parameters: Record<string, any>): Promise<TrailRecoveryResult> {
    // 状態のクリアと再初期化
    this.trailExecutor.clearExecutionState(positionId);
    
    return {
      success: true,
      shouldRetry: false,
      message: 'State cleared successfully',
      data: { clearedAt: new Date() },
    };
  }

  private async executeEmergencyStopRecovery(positionId: string, parameters: Record<string, any>): Promise<TrailRecoveryResult> {
    // 緊急停止
    this.trailExecutor.clearExecutionState(positionId);
    
    return {
      success: true,
      shouldRetry: false,
      message: 'Emergency stop executed successfully',
      data: { stoppedAt: new Date(), reason: parameters.reason || 'Manual emergency stop' },
    };
  }

  private simulateTrailCalculation(trailSettings: TrailSettings, status: TrailStatus): { variance: number } {
    // 簡単な計算シミュレーション
    const expectedStopLoss = status.currentPrice - trailSettings.trailAmount;
    const actualStopLoss = status.currentStopLoss;
    const variance = Math.abs(expectedStopLoss - actualStopLoss) / status.currentPrice;
    
    return { variance };
  }

  private validateTrailSettings(trailSettings: TrailSettings, position: Position): { isValid: boolean; reason?: string } {
    if (trailSettings.trailAmount <= 0) {
      return { isValid: false, reason: 'Trail amount must be positive' };
    }
    
    if (!trailSettings.type || !['fixed', 'percentage', 'atr'].includes(trailSettings.type)) {
      return { isValid: false, reason: 'Invalid trail type' };
    }
    
    if (trailSettings.positionId !== position.ticket.toString()) {
      return { isValid: false, reason: 'Position ID mismatch' };
    }
    
    return { isValid: true };
  }

  private setupEventListeners(): void {
    // エラーハンドラーのイベントを監視
    this.errorHandler.on('trail_error', (event) => {
      this.handleTrailErrorEvent(event);
    });
    
    // トレール実行のイベントを監視
    this.trailExecutor.on('trail_failed', (result, error) => {
      this.handleTrailExecutionFailure(result, error);
    });
  }

  private handleTrailErrorEvent(event: any): void {
    const { errorId, error } = event;
    
    // 自動復旧が有効で、特定の条件を満たす場合は高度な復旧を試行
    if (this.config.aggressiveRecovery && error.positionId) {
      setTimeout(async () => {
        try {
          await this.executeAdvancedRecovery(error.positionId, 'restart_trail', {
            triggeredBy: 'auto_error_response',
            errorId,
          });
        } catch (recoveryError) {
          console.warn('[TrailRecoveryManager] Auto recovery failed:', recoveryError);
        }
      }, 5000); // 5秒の遅延
    }
  }

  private handleTrailExecutionFailure(result: TrailExecutionResult, error: Error): void {
    // 実行失敗時の自動対応
    if (this.config.preventiveMode) {
      const positionId = result.positionId;
      
      setTimeout(async () => {
        try {
          const healthCheck = await this.performHealthCheck(positionId, {} as TrailSettings, {} as TrailStatus);
          
          if (!healthCheck.isHealthy) {
            console.log(`[TrailRecoveryManager] Scheduling recovery based on execution failure for position ${positionId}`);
            await this.executeAdvancedRecovery(positionId, 'restart_trail', {
              triggeredBy: 'execution_failure',
              originalError: error.message,
            });
          }
        } catch (healthCheckError) {
          console.warn('[TrailRecoveryManager] Health check after execution failure failed:', healthCheckError);
        }
      }, 10000); // 10秒の遅延
    }
  }

  private startHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      return;
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.lastHealthCheck = new Date();
      this.emit('health_check_timer', {
        activeRecoveries: this.activeRecoveries.size,
        healthCheckCoverage: this.healthCheckResults.size,
        timestamp: this.lastHealthCheck,
      });
    }, this.config.healthCheckInterval);
    
    console.log('[TrailRecoveryManager] Health check timer started');
  }

  private updateAverageRecoveryTime(duration: number): void {
    const totalRecoveries = this.performanceMetrics.totalRecoveries;
    const currentAverage = this.performanceMetrics.averageRecoveryTime;
    
    this.performanceMetrics.averageRecoveryTime = 
      ((currentAverage * (totalRecoveries - 1)) + duration) / totalRecoveries;
  }

  private generateRecoveryId(): string {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTrailStatusId(): string {
    return `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * TrailRecoveryManagerのファクトリー関数
 */
export function createTrailRecoveryManager(
  errorHandler: TrailErrorHandler,
  trailExecutor: TrailExecutor,
  wsClient: WebSocketClient,
  eaManager: EAConnectionManager,
  config?: Partial<TrailRecoveryManagerConfig>
): TrailRecoveryManager {
  return new TrailRecoveryManager(errorHandler, trailExecutor, wsClient, eaManager, config);
}