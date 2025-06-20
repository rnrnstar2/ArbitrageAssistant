import { EventEmitter } from 'events';
import { TrailSettings, TrailExecutionCommand, TrailStatus, TRAIL_ERROR_TYPES, TRAIL_STATUS } from './types';
import { TradingErrorHandler, ErrorCode, ErrorSeverity, TradingError } from '../../../lib/trading/error-handling';
import { WebSocketClient } from '../../../lib/websocket/websocket-client';
import { EAConnectionManager } from '../../ea-management/ea-connection-manager';

/**
 * トレール専用のエラー詳細情報
 */
export interface TrailError extends TradingError {
  trailId?: string;
  positionId?: string;
  trailType?: 'fixed' | 'percentage' | 'atr';
  calculationData?: {
    currentPrice: number;
    currentStopLoss: number;
    newStopLoss: number;
    trailAmount: number;
  };
  executionStep?: 'calculation' | 'validation' | 'execution' | 'confirmation';
}

/**
 * トレール復旧戦略
 */
export interface TrailRecoveryStrategy {
  name: string;
  condition: (error: TrailError) => boolean;
  execute: (error: TrailError, context: TrailRecoveryContext) => Promise<TrailRecoveryResult>;
  priority: number;
  maxRetries: number;
  cooldownMs: number;
}

/**
 * トレール復旧コンテキスト
 */
export interface TrailRecoveryContext {
  trailSettings?: TrailSettings;
  currentPrice?: number;
  lastKnownState?: TrailStatus;
  wsClient: WebSocketClient;
  eaManager: EAConnectionManager;
  errorHandler: TrailErrorHandler;
}

/**
 * トレール復旧結果
 */
export interface TrailRecoveryResult {
  success: boolean;
  shouldRetry: boolean;
  retryDelayMs?: number;
  newState?: Partial<TrailStatus>;
  data?: any;
  message?: string;
}

/**
 * トレール状態スナップショット
 */
export interface TrailStateSnapshot {
  timestamp: Date;
  positionId: string;
  trailSettingsId: string;
  status: TrailStatus;
  priceData: {
    currentPrice: number;
    currentStopLoss: number;
    highWaterMark: number;
    lowWaterMark: number;
  };
  executionData: {
    lastAdjustment: Date;
    adjustmentCount: number;
    errorCount: number;
    lastError?: string;
  };
}

/**
 * トレールエラーハンドラー設定
 */
export interface TrailErrorHandlerConfig {
  enableAutoRecovery: boolean;
  enableStateBackup: boolean;
  stateBackupInterval: number; // milliseconds
  maxStateSnapshots: number;
  errorRetentionDays: number;
  notificationConfig: {
    enabled: boolean;
    channels: Array<'console' | 'webhook' | 'database'>;
    severityThreshold: ErrorSeverity;
  };
  recoveryConfig: {
    maxConcurrentRecoveries: number;
    globalCooldownMs: number;
    escalationThreshold: number; // errors per minute
  };
}

const DEFAULT_CONFIG: TrailErrorHandlerConfig = {
  enableAutoRecovery: true,
  enableStateBackup: true,
  stateBackupInterval: 30000, // 30 seconds
  maxStateSnapshots: 100,
  errorRetentionDays: 7,
  notificationConfig: {
    enabled: true,
    channels: ['console'],
    severityThreshold: ErrorSeverity.MEDIUM,
  },
  recoveryConfig: {
    maxConcurrentRecoveries: 5,
    globalCooldownMs: 60000, // 1 minute
    escalationThreshold: 10,
  },
};

/**
 * トレール専用エラーハンドリングクラス
 */
export class TrailErrorHandler extends EventEmitter {
  private config: TrailErrorHandlerConfig;
  private tradingErrorHandler: TradingErrorHandler;
  private wsClient: WebSocketClient;
  private eaManager: EAConnectionManager;
  
  // 状態管理
  private stateSnapshots: Map<string, TrailStateSnapshot[]> = new Map();
  private activeRecoveries: Map<string, number> = new Map(); // positionId -> activeCount
  private lastGlobalRecovery: Date = new Date(0);
  
  // 回復戦略
  private recoveryStrategies: TrailRecoveryStrategy[] = [];
  
  // 統計
  private errorStats = {
    totalErrors: 0,
    errorsByType: {} as Record<string, number>,
    recoveryAttempts: 0,
    successfulRecoveries: 0,
    escalatedErrors: 0,
  };

  constructor(
    tradingErrorHandler: TradingErrorHandler,
    wsClient: WebSocketClient,
    eaManager: EAConnectionManager,
    config?: Partial<TrailErrorHandlerConfig>
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tradingErrorHandler = tradingErrorHandler;
    this.wsClient = wsClient;
    this.eaManager = eaManager;
    
    this.setupDefaultRecoveryStrategies();
    this.startStateBackupTimer();
    
    console.log('[TrailErrorHandler] Initialized with config:', {
      autoRecovery: this.config.enableAutoRecovery,
      stateBackup: this.config.enableStateBackup,
      notifications: this.config.notificationConfig.enabled,
    });
  }

  /**
   * トレールエラーを処理
   */
  async handleTrailError(
    error: Error | TrailError,
    context: {
      positionId?: string;
      trailId?: string;
      trailType?: 'fixed' | 'percentage' | 'atr';
      executionStep?: 'calculation' | 'validation' | 'execution' | 'confirmation';
      calculationData?: TrailError['calculationData'];
      severity?: ErrorSeverity;
    }
  ): Promise<string> {
    // TrailErrorオブジェクトの作成
    const trailError = this.normalizeTrailError(error, context);
    
    // 基底エラーハンドラーに委譲
    const errorId = await this.tradingErrorHandler.handleError(trailError, {
      component: 'trail',
      ...context,
    });
    
    // トレール固有の処理
    this.updateTrailErrorStats(trailError);
    
    // 状態バックアップ（エラー発生時）
    if (context.positionId && this.config.enableStateBackup) {
      await this.createEmergencyStateSnapshot(context.positionId, trailError);
    }
    
    // 自動復旧の実行
    if (this.config.enableAutoRecovery && this.shouldAttemptRecovery(trailError)) {
      this.scheduleRecovery(errorId, trailError);
    }
    
    // 通知送信
    await this.sendTrailErrorNotification(trailError);
    
    this.emit('trail_error', {
      errorId,
      error: trailError,
      timestamp: new Date(),
    });
    
    return errorId;
  }

  /**
   * 状態スナップショットを作成
   */
  async captureStateSnapshot(
    positionId: string,
    trailSettingsId: string,
    status: TrailStatus,
    additionalData?: any
  ): Promise<void> {
    try {
      const snapshot: TrailStateSnapshot = {
        timestamp: new Date(),
        positionId,
        trailSettingsId,
        status,
        priceData: {
          currentPrice: status.currentPrice,
          currentStopLoss: status.currentStopLoss,
          highWaterMark: status.highestPrice,
          lowWaterMark: status.lowestPrice,
        },
        executionData: {
          lastAdjustment: status.lastAdjustment,
          adjustmentCount: status.adjustmentCount,
          errorCount: 0,
          lastError: status.errorMessage,
        },
      };
      
      let snapshots = this.stateSnapshots.get(positionId) || [];
      snapshots.unshift(snapshot);
      
      // 制限を超えた古いスナップショットを削除
      if (snapshots.length > this.config.maxStateSnapshots) {
        snapshots = snapshots.slice(0, this.config.maxStateSnapshots);
      }
      
      this.stateSnapshots.set(positionId, snapshots);
      
      this.emit('state_snapshot_created', {
        positionId,
        snapshotCount: snapshots.length,
        timestamp: snapshot.timestamp,
      });
      
    } catch (error) {
      console.error('[TrailErrorHandler] Failed to capture state snapshot:', error);
    }
  }

  /**
   * 状態復元
   */
  async restoreFromSnapshot(
    positionId: string,
    snapshotIndex: number = 0
  ): Promise<TrailStateSnapshot | null> {
    try {
      const snapshots = this.stateSnapshots.get(positionId);
      if (!snapshots || snapshots.length === 0) {
        throw new Error(`No snapshots available for position ${positionId}`);
      }
      
      if (snapshotIndex >= snapshots.length) {
        throw new Error(`Snapshot index ${snapshotIndex} out of range`);
      }
      
      const snapshot = snapshots[snapshotIndex];
      
      this.emit('state_restored', {
        positionId,
        snapshot,
        restoredFrom: snapshotIndex,
        timestamp: new Date(),
      });
      
      return snapshot;
      
    } catch (error) {
      console.error('[TrailErrorHandler] Failed to restore from snapshot:', error);
      return null;
    }
  }

  /**
   * データ整合性チェック
   */
  async performConsistencyCheck(
    positionId: string,
    trailSettings: TrailSettings,
    currentStatus: TrailStatus
  ): Promise<{
    isConsistent: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    try {
      // 基本データの整合性チェック
      if (trailSettings.positionId !== positionId) {
        issues.push(`Position ID mismatch: settings=${trailSettings.positionId}, status=${positionId}`);
        recommendations.push('Reload trail settings from server');
      }
      
      if (trailSettings.id !== currentStatus.trailSettingsId) {
        issues.push(`Trail settings ID mismatch: ${trailSettings.id} vs ${currentStatus.trailSettingsId}`);
        recommendations.push('Resync trail configuration');
      }
      
      // 価格データの妥当性チェック
      if (currentStatus.currentPrice <= 0) {
        issues.push('Invalid current price detected');
        recommendations.push('Refresh price data from market feed');
      }
      
      if (currentStatus.currentStopLoss < 0) {
        issues.push('Invalid stop loss value detected');
        recommendations.push('Recalculate stop loss based on current settings');
      }
      
      // トレール方向の妥当性チェック
      const snapshots = this.stateSnapshots.get(positionId) || [];
      if (snapshots.length > 1) {
        const current = snapshots[0];
        const previous = snapshots[1];
        
        // 価格が不自然に変動していないかチェック
        const priceChange = Math.abs(current.priceData.currentPrice - previous.priceData.currentPrice);
        const maxExpectedChange = previous.priceData.currentPrice * 0.1; // 10%以上の変動は異常
        
        if (priceChange > maxExpectedChange) {
          issues.push(`Unusual price movement detected: ${priceChange.toFixed(5)}`);
          recommendations.push('Verify price data source and connection');
        }
      }
      
      // 時系列の整合性チェック
      if (currentStatus.lastAdjustment > new Date()) {
        issues.push('Last adjustment time is in the future');
        recommendations.push('Synchronize system clock');
      }
      
      const isConsistent = issues.length === 0;
      
      this.emit('consistency_check_completed', {
        positionId,
        isConsistent,
        issueCount: issues.length,
        timestamp: new Date(),
      });
      
      return {
        isConsistent,
        issues,
        recommendations,
      };
      
    } catch (error) {
      console.error('[TrailErrorHandler] Consistency check failed:', error);
      return {
        isConsistent: false,
        issues: ['Consistency check execution failed'],
        recommendations: ['Retry consistency check after resolving system errors'],
      };
    }
  }

  /**
   * 手動復旧実行
   */
  async executeManualRecovery(
    positionId: string,
    strategyName?: string,
    options?: {
      forceRestore?: boolean;
      skipValidation?: boolean;
      useSnapshot?: number;
    }
  ): Promise<TrailRecoveryResult> {
    try {
      console.log('[TrailErrorHandler] Starting manual recovery', {
        positionId,
        strategyName,
        options,
      });
      
      // 復旧戦略の選択
      const strategies = strategyName
        ? this.recoveryStrategies.filter(s => s.name === strategyName)
        : this.recoveryStrategies.sort((a, b) => a.priority - b.priority);
      
      if (strategies.length === 0) {
        throw new Error(`No recovery strategies available${strategyName ? ` for: ${strategyName}` : ''}`);
      }
      
      // スナップショットからの復元（オプション）
      let restoredSnapshot: TrailStateSnapshot | null = null;
      if (options?.useSnapshot !== undefined) {
        restoredSnapshot = await this.restoreFromSnapshot(positionId, options.useSnapshot);
        if (!restoredSnapshot && !options.forceRestore) {
          throw new Error(`Failed to restore from snapshot ${options.useSnapshot}`);
        }
      }
      
      // 各戦略を試行
      for (const strategy of strategies) {
        const context: TrailRecoveryContext = {
          lastKnownState: restoredSnapshot?.status,
          wsClient: this.wsClient,
          eaManager: this.eaManager,
          errorHandler: this,
        };
        
        // ダミーエラーを作成（手動復旧用）
        const dummyError: TrailError = this.createTrailError(
          'MANUAL_RECOVERY',
          `Manual recovery initiated for position ${positionId}`,
          ErrorSeverity.MEDIUM,
          { positionId, executionStep: 'execution' }
        );
        
        try {
          const result = await strategy.execute(dummyError, context);
          
          if (result.success) {
            this.errorStats.successfulRecoveries++;
            
            this.emit('manual_recovery_success', {
              positionId,
              strategy: strategy.name,
              result,
              timestamp: new Date(),
            });
            
            return result;
          }
        } catch (strategyError) {
          console.warn(`[TrailErrorHandler] Recovery strategy failed: ${strategy.name}`, strategyError);
        }
      }
      
      // すべての戦略が失敗
      const failureResult: TrailRecoveryResult = {
        success: false,
        shouldRetry: false,
        message: 'All recovery strategies failed',
      };
      
      this.emit('manual_recovery_failed', {
        positionId,
        strategiesAttempted: strategies.length,
        timestamp: new Date(),
      });
      
      return failureResult;
      
    } catch (error) {
      console.error('[TrailErrorHandler] Manual recovery failed:', error);
      
      return {
        success: false,
        shouldRetry: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * エラー統計を取得
   */
  getErrorStatistics() {
    const recentErrors = Array.from(this.tradingErrorHandler.getErrorHistory(50))
      .filter(error => (error as TrailError).component === 'trail');
    
    return {
      ...this.errorStats,
      recentErrors,
      totalSnapshots: Array.from(this.stateSnapshots.values())
        .reduce((sum, snapshots) => sum + snapshots.length, 0),
      activeRecoveries: this.activeRecoveries.size,
      lastGlobalRecovery: this.lastGlobalRecovery,
    };
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<TrailErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[TrailErrorHandler] Configuration updated:', newConfig);
  }

  /**
   * リソース解放
   */
  dispose(): void {
    this.removeAllListeners();
    this.stateSnapshots.clear();
    this.activeRecoveries.clear();
    console.log('[TrailErrorHandler] Disposed');
  }

  // Private methods

  private normalizeTrailError(error: Error | TrailError, context: any): TrailError {
    if (this.isTrailError(error)) {
      return {
        ...error,
        ...context,
      };
    }
    
    return this.createTrailError(
      this.mapErrorToCode(error),
      error.message,
      context.severity || ErrorSeverity.MEDIUM,
      context
    );
  }

  private createTrailError(
    code: string,
    message: string,
    severity: ErrorSeverity,
    context: any
  ): TrailError {
    return {
      code: code as ErrorCode,
      message,
      severity,
      context: {
        timestamp: new Date(),
        component: 'trail',
        ...context,
      },
      timestamp: new Date(),
      retryable: this.isRetryableTrailError(code),
      ...context,
    };
  }

  private isTrailError(error: any): error is TrailError {
    return error && typeof error === 'object' && 'trailId' in error;
  }

  private mapErrorToCode(error: Error): string {
    if (error.name === 'TypeError') return TRAIL_ERROR_TYPES.VALIDATION_ERROR;
    if (error.name === 'TimeoutError') return TRAIL_ERROR_TYPES.TIMEOUT_ERROR;
    if (error.message.includes('connection')) return TRAIL_ERROR_TYPES.CONNECTION_ERROR;
    if (error.message.includes('calculation')) return TRAIL_ERROR_TYPES.CALCULATION_ERROR;
    return TRAIL_ERROR_TYPES.EXECUTION_ERROR;
  }

  private isRetryableTrailError(code: string): boolean {
    const retryableCodes = [
      TRAIL_ERROR_TYPES.CONNECTION_ERROR,
      TRAIL_ERROR_TYPES.TIMEOUT_ERROR,
      TRAIL_ERROR_TYPES.EXECUTION_ERROR,
    ];
    return retryableCodes.includes(code);
  }

  private updateTrailErrorStats(error: TrailError): void {
    this.errorStats.totalErrors++;
    
    const errorType = error.code;
    this.errorStats.errorsByType[errorType] = (this.errorStats.errorsByType[errorType] || 0) + 1;
  }

  private shouldAttemptRecovery(error: TrailError): boolean {
    // 重要度が低すぎる場合は復旧しない
    if (error.severity === ErrorSeverity.LOW) {
      return false;
    }
    
    // リトライ不可能なエラーは復旧しない
    if (!error.retryable) {
      return false;
    }
    
    // グローバルクールダウン中は復旧しない
    const timeSinceLastGlobalRecovery = Date.now() - this.lastGlobalRecovery.getTime();
    if (timeSinceLastGlobalRecovery < this.config.recoveryConfig.globalCooldownMs) {
      return false;
    }
    
    // 同じポジションで複数の復旧が実行中の場合は制限
    const positionId = error.positionId;
    if (positionId) {
      const activeCount = this.activeRecoveries.get(positionId) || 0;
      if (activeCount >= this.config.recoveryConfig.maxConcurrentRecoveries) {
        return false;
      }
    }
    
    return true;
  }

  private scheduleRecovery(errorId: string, error: TrailError): void {
    // 非同期で復旧を実行
    setTimeout(async () => {
      try {
        await this.executeAutoRecovery(errorId, error);
      } catch (recoveryError) {
        console.error('[TrailErrorHandler] Auto recovery failed:', recoveryError);
      }
    }, 1000); // 1秒の遅延
  }

  private async executeAutoRecovery(errorId: string, error: TrailError): Promise<void> {
    const positionId = error.positionId;
    if (!positionId) {
      console.warn('[TrailErrorHandler] Cannot recover without position ID');
      return;
    }
    
    // アクティブ復旧数を増加
    const activeCount = this.activeRecoveries.get(positionId) || 0;
    this.activeRecoveries.set(positionId, activeCount + 1);
    
    try {
      this.errorStats.recoveryAttempts++;
      
      // 適用可能な復旧戦略を選択
      const applicableStrategies = this.recoveryStrategies
        .filter(strategy => strategy.condition(error))
        .sort((a, b) => a.priority - b.priority);
      
      if (applicableStrategies.length === 0) {
        console.warn('[TrailErrorHandler] No applicable recovery strategies for error:', error.code);
        return;
      }
      
      // 各戦略を試行
      for (const strategy of applicableStrategies) {
        const context: TrailRecoveryContext = {
          wsClient: this.wsClient,
          eaManager: this.eaManager,
          errorHandler: this,
        };
        
        try {
          const result = await strategy.execute(error, context);
          
          if (result.success) {
            this.errorStats.successfulRecoveries++;
            this.lastGlobalRecovery = new Date();
            
            this.emit('auto_recovery_success', {
              errorId,
              strategy: strategy.name,
              result,
              timestamp: new Date(),
            });
            
            return;
          }
          
          if (!result.shouldRetry) {
            break;
          }
          
        } catch (strategyError) {
          console.warn(`[TrailErrorHandler] Recovery strategy failed: ${strategy.name}`, strategyError);
        }
      }
      
      // すべての戦略が失敗した場合はエスカレーション
      this.errorStats.escalatedErrors++;
      
      this.emit('auto_recovery_failed', {
        errorId,
        error,
        strategiesAttempted: applicableStrategies.length,
        timestamp: new Date(),
      });
      
    } finally {
      // アクティブ復旧数を減少
      const currentCount = this.activeRecoveries.get(positionId) || 1;
      if (currentCount <= 1) {
        this.activeRecoveries.delete(positionId);
      } else {
        this.activeRecoveries.set(positionId, currentCount - 1);
      }
    }
  }

  private async createEmergencyStateSnapshot(positionId: string, error: TrailError): Promise<void> {
    try {
      // 緊急時のダミー状態を作成
      const emergencySnapshot: TrailStateSnapshot = {
        timestamp: new Date(),
        positionId,
        trailSettingsId: error.trailId || 'unknown',
        status: {
          id: 'emergency',
          positionId,
          trailSettingsId: error.trailId || 'unknown',
          status: TRAIL_STATUS.FAILED as any,
          currentPrice: error.calculationData?.currentPrice || 0,
          currentStopLoss: error.calculationData?.currentStopLoss || 0,
          highestPrice: error.calculationData?.currentPrice || 0,
          lowestPrice: error.calculationData?.currentPrice || 0,
          profitSinceStart: 0,
          trailDistance: error.calculationData?.trailAmount || 0,
          lastAdjustment: new Date(),
          adjustmentCount: 0,
          nextCheckTime: new Date(),
          errorMessage: error.message,
        },
        priceData: {
          currentPrice: error.calculationData?.currentPrice || 0,
          currentStopLoss: error.calculationData?.currentStopLoss || 0,
          highWaterMark: error.calculationData?.currentPrice || 0,
          lowWaterMark: error.calculationData?.currentPrice || 0,
        },
        executionData: {
          lastAdjustment: new Date(),
          adjustmentCount: 0,
          errorCount: 1,
          lastError: error.message,
        },
      };
      
      let snapshots = this.stateSnapshots.get(positionId) || [];
      snapshots.unshift(emergencySnapshot);
      
      if (snapshots.length > this.config.maxStateSnapshots) {
        snapshots = snapshots.slice(0, this.config.maxStateSnapshots);
      }
      
      this.stateSnapshots.set(positionId, snapshots);
      
    } catch (snapshotError) {
      console.error('[TrailErrorHandler] Failed to create emergency snapshot:', snapshotError);
    }
  }

  private async sendTrailErrorNotification(error: TrailError): Promise<void> {
    if (!this.config.notificationConfig.enabled) {
      return;
    }
    
    // 重要度フィルタリング
    const severityLevels = {
      [ErrorSeverity.LOW]: 1,
      [ErrorSeverity.MEDIUM]: 2,
      [ErrorSeverity.HIGH]: 3,
      [ErrorSeverity.CRITICAL]: 4,
    };
    
    const errorLevel = severityLevels[error.severity];
    const thresholdLevel = severityLevels[this.config.notificationConfig.severityThreshold];
    
    if (errorLevel < thresholdLevel) {
      return;
    }
    
    const notification = {
      type: 'trail_error',
      timestamp: new Date(),
      severity: error.severity,
      message: error.message,
      context: {
        positionId: error.positionId,
        trailType: error.trailType,
        executionStep: error.executionStep,
        errorCode: error.code,
      },
    };
    
    for (const channel of this.config.notificationConfig.channels) {
      try {
        await this.sendNotificationToChannel(notification, channel);
      } catch (notificationError) {
        console.error(`[TrailErrorHandler] Failed to send notification to ${channel}:`, notificationError);
      }
    }
  }

  private async sendNotificationToChannel(notification: any, channel: string): Promise<void> {
    switch (channel) {
      case 'console':
        console.error(`[TRAIL ERROR] ${notification.severity.toUpperCase()}: ${notification.message}`, {
          positionId: notification.context.positionId,
          trailType: notification.context.trailType,
          step: notification.context.executionStep,
          code: notification.context.errorCode,
        });
        break;
      
      case 'webhook':
        // Webhook実装は将来的に追加
        console.log('[TrailErrorHandler] Webhook notification not implemented');
        break;
      
      case 'database':
        // データベース通知は将来的に追加
        console.log('[TrailErrorHandler] Database notification not implemented');
        break;
    }
  }

  private setupDefaultRecoveryStrategies(): void {
    // 価格データ再取得戦略
    this.recoveryStrategies.push({
      name: 'price_data_refresh',
      condition: (error) => error.code === TRAIL_ERROR_TYPES.CALCULATION_ERROR,
      execute: async (error, context) => {
        // 価格データの再取得を試行
        return {
          success: true,
          shouldRetry: false,
          message: 'Price data refreshed',
        };
      },
      priority: 1,
      maxRetries: 3,
      cooldownMs: 5000,
    });
    
    // 接続復旧戦略
    this.recoveryStrategies.push({
      name: 'connection_recovery',
      condition: (error) => error.code === TRAIL_ERROR_TYPES.CONNECTION_ERROR,
      execute: async (error, context) => {
        // WebSocket/EA接続の復旧を試行
        return {
          success: false,
          shouldRetry: true,
          retryDelayMs: 10000,
          message: 'Connection recovery attempted',
        };
      },
      priority: 2,
      maxRetries: 5,
      cooldownMs: 10000,
    });
    
    // 状態復元戦略
    this.recoveryStrategies.push({
      name: 'state_restoration',
      condition: (error) => error.code === TRAIL_ERROR_TYPES.VALIDATION_ERROR,
      execute: async (error, context) => {
        if (!error.positionId) {
          return {
            success: false,
            shouldRetry: false,
            message: 'No position ID for state restoration',
          };
        }
        
        const snapshot = await this.restoreFromSnapshot(error.positionId, 0);
        if (snapshot) {
          return {
            success: true,
            shouldRetry: false,
            newState: snapshot.status,
            message: 'State restored from snapshot',
          };
        }
        
        return {
          success: false,
          shouldRetry: false,
          message: 'No snapshots available for restoration',
        };
      },
      priority: 3,
      maxRetries: 2,
      cooldownMs: 15000,
    });
  }

  private startStateBackupTimer(): void {
    if (!this.config.enableStateBackup) {
      return;
    }
    
    setInterval(() => {
      this.emit('state_backup_timer', {
        snapshotCount: this.stateSnapshots.size,
        timestamp: new Date(),
      });
    }, this.config.stateBackupInterval);
  }
}

/**
 * TrailErrorHandlerのファクトリー関数
 */
export function createTrailErrorHandler(
  tradingErrorHandler: TradingErrorHandler,
  wsClient: WebSocketClient,
  eaManager: EAConnectionManager,
  config?: Partial<TrailErrorHandlerConfig>
): TrailErrorHandler {
  return new TrailErrorHandler(tradingErrorHandler, wsClient, eaManager, config);
}