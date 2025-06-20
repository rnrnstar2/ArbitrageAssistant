import { EventEmitter } from 'events';
import {
  ErrorDetail,
  RecoveryStrategy,
  RecoveryResult,
  RecoveryAttempt,
  ErrorStatistics,
  AlertConfiguration,
  ErrorEvent,
  EAErrorContext,
  ERROR_CODES,
  ERROR_SEVERITY_LEVELS,
  AUTO_RECOVERABLE_CATEGORIES,
  RETRYABLE_ERROR_CODES,
} from './error-types';
import { RECOVERY_STRATEGIES, selectRecoveryStrategies } from './recovery-strategies';

export interface ErrorHandlerConfig {
  enableAutoRecovery: boolean;
  maxRecoveryAttempts: number;
  alertConfig: AlertConfiguration;
  errorRetentionDays: number;
  enableMetrics: boolean;
}

export class EAErrorHandler extends EventEmitter {
  private config: ErrorHandlerConfig;
  private errors: Map<string, ErrorDetail> = new Map();
  private recoveryAttempts: Map<string, RecoveryAttempt[]> = new Map();
  private stats: ErrorStatistics = {
    totalErrors: 0,
    errorsByCategory: {},
    errorsBySeverity: {},
    errorsByAccount: {},
    averageRecoveryTime: 0,
    recoverySuccessRate: 0,
    recentErrors: [],
  };
  private alertRateLimiter: Map<string, { count: number; lastReset: Date }> = new Map();

  constructor(config: ErrorHandlerConfig) {
    super();
    this.config = config;
  }

  /**
   * エラーを処理
   */
  async handleError(
    code: string,
    message: string,
    context: EAErrorContext,
    severity: ErrorDetail['severity'] = 'medium',
    category: ErrorDetail['category'] = 'system',
    metadata?: Record<string, any>
  ): Promise<string> {
    const errorId = this.generateErrorId();
    const error: ErrorDetail = {
      code,
      message,
      severity,
      category,
      context,
      metadata,
      retryable: (RETRYABLE_ERROR_CODES as readonly string[]).includes(code),
      autoRecoverable: (AUTO_RECOVERABLE_CATEGORIES as readonly string[]).includes(category),
      stackTrace: new Error().stack,
    };

    // エラーを記録
    this.errors.set(errorId, error);
    this.updateStatistics(error);

    // イベントを発火
    this.emitErrorEvent({
      type: 'error_occurred',
      error,
      timestamp: new Date(),
    });

    // アラートを送信
    await this.sendAlert(error);

    // 自動回復を試行
    if (this.config.enableAutoRecovery && error.autoRecoverable) {
      this.scheduleRecovery(errorId, error);
    }

    return errorId;
  }

  /**
   * 手動でエラー回復を実行
   */
  async recoverFromError(errorId: string, strategyName?: string): Promise<boolean> {
    const error = this.errors.get(errorId);
    if (!error) {
      throw new Error(`Error not found: ${errorId}`);
    }

    const strategies = strategyName 
      ? RECOVERY_STRATEGIES.filter(s => s.name === strategyName)
      : selectRecoveryStrategies(error);

    if (strategies.length === 0) {
      throw new Error(`No recovery strategies available for error: ${error.code}`);
    }

    for (const strategy of strategies) {
      const success = await this.executeRecoveryStrategy(errorId, error, strategy);
      if (success) {
        return true;
      }
    }

    return false;
  }

  /**
   * エラー統計を取得
   */
  getStatistics(): ErrorStatistics {
    return { ...this.stats };
  }

  /**
   * 特定のアカウントのエラーを取得
   */
  getErrorsByAccount(accountId: string): ErrorDetail[] {
    return Array.from(this.errors.values())
      .filter(error => error.context.accountId === accountId);
  }

  /**
   * 重要度別エラーを取得
   */
  getErrorsBySeverity(severity: ErrorDetail['severity']): ErrorDetail[] {
    return Array.from(this.errors.values())
      .filter(error => error.severity === severity);
  }

  /**
   * 未解決のエラーを取得
   */
  getUnresolvedErrors(): ErrorDetail[] {
    const unresolvedIds = new Set(this.errors.keys());
    
    // 成功した回復試行があるエラーを除外
    for (const [errorId, attempts] of this.recoveryAttempts) {
      if (attempts.some(attempt => attempt.result.success)) {
        unresolvedIds.delete(errorId);
      }
    }

    return Array.from(unresolvedIds).map(id => this.errors.get(id)!);
  }

  /**
   * エラーを解決済みとしてマーク
   */
  markErrorAsResolved(errorId: string, resolution?: string): void {
    const error = this.errors.get(errorId);
    if (error) {
      this.emitErrorEvent({
        type: 'error_resolved',
        error: {
          ...error,
          metadata: {
            ...error.metadata,
            resolved: true,
            resolution,
            resolvedAt: new Date(),
          },
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * 古いエラーをクリーンアップ
   */
  cleanupOldErrors(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.errorRetentionDays);

    const toDelete: string[] = [];
    
    for (const [errorId, error] of this.errors) {
      if (error.context.timestamp < cutoffDate) {
        toDelete.push(errorId);
      }
    }

    for (const errorId of toDelete) {
      this.errors.delete(errorId);
      this.recoveryAttempts.delete(errorId);
    }
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  private async scheduleRecovery(errorId: string, error: ErrorDetail): Promise<void> {
    // 回復戦略を選択
    const strategies = selectRecoveryStrategies(error);
    
    if (strategies.length === 0) {
      return;
    }

    // 最優先の戦略から順に実行
    for (const strategy of strategies) {
      const success = await this.executeRecoveryStrategy(errorId, error, strategy);
      if (success) {
        break;
      }
    }
  }

  private async executeRecoveryStrategy(
    errorId: string,
    error: ErrorDetail,
    strategy: RecoveryStrategy
  ): Promise<boolean> {
    const existingAttempts = this.recoveryAttempts.get(errorId) || [];
    const strategyAttempts = existingAttempts.filter(a => a.strategyName === strategy.name);
    
    if (strategyAttempts.length >= strategy.maxAttempts) {
      return false;
    }

    const attemptNumber = strategyAttempts.length + 1;
    const attemptId = this.generateAttemptId();
    const startTime = Date.now();

    this.emitErrorEvent({
      type: 'recovery_started',
      error,
      timestamp: new Date(),
    });

    try {
      const result = await strategy.execute(error, attemptNumber);
      const duration = Date.now() - startTime;

      const attempt: RecoveryAttempt = {
        id: attemptId,
        errorId,
        strategyName: strategy.name,
        attemptNumber,
        timestamp: new Date(),
        result,
        duration,
      };

      existingAttempts.push(attempt);
      this.recoveryAttempts.set(errorId, existingAttempts);

      if (result.success) {
        this.emitErrorEvent({
          type: 'recovery_completed',
          error,
          recoveryAttempt: attempt,
          timestamp: new Date(),
        });
        
        this.updateRecoveryStats(true, duration);
        return true;
      } else {
        this.emitErrorEvent({
          type: 'recovery_failed',
          error,
          recoveryAttempt: attempt,
          timestamp: new Date(),
        });

        // 再試行が必要で可能な場合はスケジュール
        if (result.shouldRetry && attemptNumber < strategy.maxAttempts) {
          setTimeout(() => {
            this.executeRecoveryStrategy(errorId, error, strategy);
          }, result.retryDelayMs || strategy.delayMs);
        }

        this.updateRecoveryStats(false, duration);
        return false;
      }
    } catch (strategyError) {
      const duration = Date.now() - startTime;
      
      const attempt: RecoveryAttempt = {
        id: attemptId,
        errorId,
        strategyName: strategy.name,
        attemptNumber,
        timestamp: new Date(),
        result: {
          success: false,
          shouldRetry: false,
          newError: {
            ...error,
            message: `Recovery strategy failed: ${strategyError}`,
            metadata: {
              ...error.metadata,
              strategyError: strategyError instanceof Error ? strategyError.message : strategyError,
            },
          },
        },
        duration,
      };

      existingAttempts.push(attempt);
      this.recoveryAttempts.set(errorId, existingAttempts);

      this.emitErrorEvent({
        type: 'recovery_failed',
        error,
        recoveryAttempt: attempt,
        timestamp: new Date(),
      });

      this.updateRecoveryStats(false, duration);
      return false;
    }
  }

  private async sendAlert(error: ErrorDetail): Promise<void> {
    if (!this.config.alertConfig.enabled) {
      return;
    }

    // 重要度フィルタリング
    const severityLevel = ERROR_SEVERITY_LEVELS[error.severity.toUpperCase() as keyof typeof ERROR_SEVERITY_LEVELS];
    const thresholdLevel = ERROR_SEVERITY_LEVELS[this.config.alertConfig.severityThreshold.toUpperCase() as keyof typeof ERROR_SEVERITY_LEVELS];
    
    if (severityLevel < thresholdLevel) {
      return;
    }

    // カテゴリフィルタリング
    if (!this.config.alertConfig.categories.includes(error.category)) {
      return;
    }

    // レート制限チェック
    if (!this.checkAlertRateLimit(error)) {
      return;
    }

    // 各チャンネルにアラート送信
    for (const channel of this.config.alertConfig.channels) {
      if (channel.enabled) {
        try {
          await this.sendAlertToChannel(error, channel);
        } catch (alertError) {
          console.error(`Failed to send alert to ${channel.type}:`, alertError);
        }
      }
    }
  }

  private checkAlertRateLimit(error: ErrorDetail): boolean {
    const now = new Date();
    const key = `${error.context.accountId}_${error.category}`;
    const limiter = this.alertRateLimiter.get(key) || { count: 0, lastReset: now };

    // 1時間経過でリセット
    if (now.getTime() - limiter.lastReset.getTime() > 3600000) {
      limiter.count = 0;
      limiter.lastReset = now;
    }

    limiter.count++;
    this.alertRateLimiter.set(key, limiter);

    return limiter.count <= this.config.alertConfig.rateLimit.maxAlertsPerHour;
  }

  private async sendAlertToChannel(error: ErrorDetail, channel: any): Promise<void> {
    switch (channel.type) {
      case 'console':
        console.error(`[EA ERROR] ${error.severity.toUpperCase()}: ${error.message}`, {
          code: error.code,
          accountId: error.context.accountId,
          category: error.category,
        });
        break;
      
      case 'webhook':
        // Webhook実装
        break;
      
      case 'email':
        // Email実装
        break;
      
      case 'slack':
        // Slack実装
        break;
    }
  }

  private updateStatistics(error: ErrorDetail): void {
    this.stats.totalErrors++;
    
    // カテゴリ別
    this.stats.errorsByCategory[error.category] = 
      (this.stats.errorsByCategory[error.category] || 0) + 1;
    
    // 重要度別
    this.stats.errorsBySeverity[error.severity] = 
      (this.stats.errorsBySeverity[error.severity] || 0) + 1;
    
    // アカウント別
    this.stats.errorsByAccount[error.context.accountId] = 
      (this.stats.errorsByAccount[error.context.accountId] || 0) + 1;
    
    // 最近のエラー
    this.stats.recentErrors.unshift(error);
    if (this.stats.recentErrors.length > 100) {
      this.stats.recentErrors.pop();
    }
  }

  private updateRecoveryStats(success: boolean, duration: number): void {
    const totalAttempts = Array.from(this.recoveryAttempts.values())
      .reduce((total, attempts) => total + attempts.length, 0);
    
    const successfulAttempts = Array.from(this.recoveryAttempts.values())
      .reduce((total, attempts) => 
        total + attempts.filter(a => a.result.success).length, 0);
    
    this.stats.recoverySuccessRate = totalAttempts > 0 ? 
      (successfulAttempts / totalAttempts) * 100 : 0;
    
    // 平均回復時間の更新
    const allDurations = Array.from(this.recoveryAttempts.values())
      .flat()
      .map(a => a.duration);
    
    this.stats.averageRecoveryTime = allDurations.length > 0 ?
      allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length : 0;
  }

  private emitErrorEvent(event: ErrorEvent): void {
    this.emit(event.type, event);
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.removeAllListeners();
    this.errors.clear();
    this.recoveryAttempts.clear();
    this.alertRateLimiter.clear();
  }
}