export enum ErrorCode {
  // 接続エラー
  CONNECTION_LOST = 'CONNECTION_LOST',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  
  // 認証エラー
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_DENIED = 'AUTHORIZATION_DENIED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // 取引エラー
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_MARGIN = 'INSUFFICIENT_MARGIN',
  INVALID_LOT_SIZE = 'INVALID_LOT_SIZE',
  MARKET_CLOSED = 'MARKET_CLOSED',
  PRICE_DEVIATION = 'PRICE_DEVIATION',
  POSITION_NOT_FOUND = 'POSITION_NOT_FOUND',
  DUPLICATE_ORDER = 'DUPLICATE_ORDER',
  
  // システムエラー
  COMMAND_TIMEOUT = 'COMMAND_TIMEOUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // EA エラー
  EA_NOT_CONNECTED = 'EA_NOT_CONNECTED',
  EA_EXECUTION_ERROR = 'EA_EXECUTION_ERROR',
  EA_INVALID_RESPONSE = 'EA_INVALID_RESPONSE',
  
  // 設定エラー
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RetryStrategy {
  NONE = 'none',
  IMMEDIATE = 'immediate',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  CUSTOM = 'custom',
}

export interface TradingError {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  timestamp: Date;
  commandId?: string;
  accountId?: string;
  retryable: boolean;
  originalError?: Error;
}

export interface RetryConfig {
  strategy: RetryStrategy;
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number; // for exponential strategy
  jitterPercent: number; // 0-100, adds randomness to delay
}

export interface ErrorRecoveryAction {
  type: 'retry' | 'fallback' | 'abort' | 'escalate';
  config?: RetryConfig;
  fallbackAction?: () => Promise<void>;
  escalationHandler?: (error: TradingError) => Promise<void>;
}

export interface ErrorHandlerOptions {
  defaultRetryConfig: RetryConfig;
  errorRecoveryMap: Map<ErrorCode, ErrorRecoveryAction>;
  onError?: (error: TradingError) => Promise<void>;
  onRecovery?: (error: TradingError, action: ErrorRecoveryAction) => Promise<void>;
  maxErrorsPerMinute?: number;
  enableErrorAggregation?: boolean;
}

export class TradingErrorHandler {
  private options: ErrorHandlerOptions;
  private errorHistory: TradingError[] = [];
  private retryAttempts: Map<string, number> = new Map();
  private errorCounts: Map<ErrorCode, number> = new Map();
  private lastErrorTime: Map<ErrorCode, Date> = new Map();
  private errorRateLimiter: Map<string, number[]> = new Map(); // accountId -> timestamps

  constructor(options: Partial<ErrorHandlerOptions> = {}) {
    this.options = {
      defaultRetryConfig: {
        strategy: RetryStrategy.EXPONENTIAL,
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitterPercent: 10,
      },
      errorRecoveryMap: this.createDefaultRecoveryMap(),
      maxErrorsPerMinute: 20,
      enableErrorAggregation: true,
      ...options,
    };
  }

  /**
   * エラーの処理
   */
  async handleError(error: Error | TradingError, context?: Record<string, any>): Promise<boolean> {
    const tradingError = this.normalizeTradingError(error, context);
    
    // エラー履歴に追加
    this.addToHistory(tradingError);
    
    // レート制限チェック
    if (tradingError.accountId && !this.checkRateLimit(tradingError.accountId)) {
      const rateLimitError = this.createTradingError(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many errors per minute',
        ErrorSeverity.HIGH,
        { originalError: tradingError }
      );
      await this.escalateError(rateLimitError);
      return false;
    }

    // エラーログ出力
    this.logError(tradingError);

    // カスタムエラーハンドラー実行
    if (this.options.onError) {
      try {
        await this.options.onError(tradingError);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    // 復旧アクション実行
    return await this.executeRecoveryAction(tradingError);
  }

  /**
   * 復旧アクションの実行
   */
  private async executeRecoveryAction(error: TradingError): Promise<boolean> {
    const action = this.options.errorRecoveryMap.get(error.code) || {
      type: error.retryable ? 'retry' : 'abort',
      config: this.options.defaultRetryConfig,
    };

    if (this.options.onRecovery) {
      try {
        await this.options.onRecovery(error, action);
      } catch (recoveryError) {
        console.error('Error in recovery callback:', recoveryError);
      }
    }

    switch (action.type) {
      case 'retry':
        return await this.executeRetry(error, action.config || this.options.defaultRetryConfig);
      
      case 'fallback':
        return await this.executeFallback(error, action);
      
      case 'escalate':
        await this.escalateError(error, action);
        return false;
      
      case 'abort':
      default:
        this.logError({
          ...error,
          message: `Action aborted due to error: ${error.message}`,
          severity: ErrorSeverity.HIGH,
        });
        return false;
    }
  }

  /**
   * リトライの実行
   */
  private async executeRetry(error: TradingError, config: RetryConfig): Promise<boolean> {
    const retryKey = this.getRetryKey(error);
    const currentAttempts = this.retryAttempts.get(retryKey) || 0;

    if (currentAttempts >= config.maxAttempts) {
      this.logError({
        ...error,
        message: `Max retry attempts (${config.maxAttempts}) exceeded for ${retryKey}`,
        severity: ErrorSeverity.HIGH,
      });
      this.retryAttempts.delete(retryKey);
      return false;
    }

    this.retryAttempts.set(retryKey, currentAttempts + 1);

    const delay = this.calculateRetryDelay(config, currentAttempts);
    
    console.log(`Retrying in ${delay}ms (attempt ${currentAttempts + 1}/${config.maxAttempts})`);
    
    await this.delay(delay);
    
    // リトライ後の成功/失敗は呼び出し元で判断される
    return true;
  }

  /**
   * フォールバックアクションの実行
   */
  private async executeFallback(error: TradingError, action: ErrorRecoveryAction): Promise<boolean> {
    if (action.fallbackAction) {
      try {
        await action.fallbackAction();
        this.logError({
          ...error,
          message: `Fallback action executed for: ${error.message}`,
          severity: ErrorSeverity.MEDIUM,
        });
        return true;
      } catch (fallbackError) {
        this.logError({
          ...error,
          message: `Fallback action failed: ${fallbackError}`,
          severity: ErrorSeverity.HIGH,
        });
        return false;
      }
    }
    return false;
  }

  /**
   * エラーのエスカレーション
   */
  private async escalateError(error: TradingError, action?: ErrorRecoveryAction): Promise<void> {
    if (action?.escalationHandler) {
      try {
        await action.escalationHandler(error);
      } catch (escalationError) {
        console.error('Error in escalation handler:', escalationError);
      }
    }

    // 重要なエラーは必ずログに記録
    this.logError({
      ...error,
      message: `ESCALATED: ${error.message}`,
      severity: ErrorSeverity.CRITICAL,
    });
  }

  /**
   * エラーの正規化
   */
  private normalizeTradingError(error: Error | TradingError, context?: Record<string, any>): TradingError {
    if (this.isTradingError(error)) {
      return {
        ...error,
        context: { ...error.context, ...context },
      };
    }

    // 一般的なErrorからTradingErrorに変換
    return this.createTradingError(
      ErrorCode.INTERNAL_ERROR,
      error.message,
      ErrorSeverity.MEDIUM,
      { ...context, originalError: error }
    );
  }

  /**
   * TradingErrorの作成
   */
  createTradingError(
    code: ErrorCode,
    message: string,
    severity: ErrorSeverity,
    context?: Record<string, any>
  ): TradingError {
    return {
      code,
      message,
      severity,
      context,
      timestamp: new Date(),
      retryable: this.isRetryableError(code),
    };
  }

  /**
   * リトライ可能エラーの判定
   */
  private isRetryableError(code: ErrorCode): boolean {
    const retryableErrors = [
      ErrorCode.CONNECTION_LOST,
      ErrorCode.CONNECTION_TIMEOUT,
      ErrorCode.WEBSOCKET_ERROR,
      ErrorCode.COMMAND_TIMEOUT,
      ErrorCode.EA_NOT_CONNECTED,
      ErrorCode.RATE_LIMIT_EXCEEDED,
    ];
    return retryableErrors.includes(code);
  }

  /**
   * リトライ遅延の計算
   */
  private calculateRetryDelay(config: RetryConfig, attempt: number): number {
    let delay: number;

    switch (config.strategy) {
      case RetryStrategy.IMMEDIATE:
        delay = 0;
        break;
      
      case RetryStrategy.LINEAR:
        delay = config.baseDelay * (attempt + 1);
        break;
      
      case RetryStrategy.EXPONENTIAL:
        delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
        break;
      
      case RetryStrategy.NONE:
      default:
        return 0;
    }

    // 最大遅延時間の制限
    delay = Math.min(delay, config.maxDelay);

    // ジッターの追加
    if (config.jitterPercent > 0) {
      const jitter = delay * (config.jitterPercent / 100) * (Math.random() * 2 - 1);
      delay += jitter;
    }

    return Math.max(0, Math.round(delay));
  }

  /**
   * リトライキーの生成
   */
  private getRetryKey(error: TradingError): string {
    return `${error.code}_${error.commandId || 'unknown'}_${error.accountId || 'unknown'}`;
  }

  /**
   * レート制限チェック
   */
  private checkRateLimit(accountId: string): boolean {
    if (!this.options.maxErrorsPerMinute) return true;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    let timestamps = this.errorRateLimiter.get(accountId) || [];
    
    // 1分以上古いタイムスタンプを削除
    timestamps = timestamps.filter(timestamp => timestamp > oneMinuteAgo);
    
    // 新しいタイムスタンプを追加
    timestamps.push(now);
    
    this.errorRateLimiter.set(accountId, timestamps);
    
    return timestamps.length <= this.options.maxErrorsPerMinute;
  }

  /**
   * エラー履歴への追加
   */
  private addToHistory(error: TradingError): void {
    this.errorHistory.unshift(error);
    
    // 履歴サイズの制限（最新1000件）
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(0, 1000);
    }

    // エラー統計の更新
    const count = this.errorCounts.get(error.code) || 0;
    this.errorCounts.set(error.code, count + 1);
    this.lastErrorTime.set(error.code, error.timestamp);
  }

  /**
   * エラーログ出力
   */
  private logError(error: TradingError): void {
    const logLevel = this.getLogLevel(error.severity);
    const message = `[${error.code}] ${error.message}`;
    
    const logData = {
      ...error,
      retryAttempts: error.commandId ? this.retryAttempts.get(this.getRetryKey(error)) : undefined,
    };

    switch (logLevel) {
      case 'error':
        console.error(message, logData);
        break;
      case 'warn':
        console.warn(message, logData);
        break;
      case 'info':
      default:
        console.info(message, logData);
        break;
    }
  }

  /**
   * ログレベルの決定
   */
  private getLogLevel(severity: ErrorSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
      default:
        return 'error';
    }
  }

  /**
   * TradingErrorの型ガード
   */
  private isTradingError(error: any): error is TradingError {
    return error && typeof error === 'object' && 'code' in error && 'severity' in error;
  }

  /**
   * 遅延の実行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * デフォルト復旧マップの作成
   */
  private createDefaultRecoveryMap(): Map<ErrorCode, ErrorRecoveryAction> {
    const map = new Map<ErrorCode, ErrorRecoveryAction>();

    // 接続エラー - リトライ
    map.set(ErrorCode.CONNECTION_LOST, { type: 'retry' });
    map.set(ErrorCode.CONNECTION_TIMEOUT, { type: 'retry' });
    map.set(ErrorCode.WEBSOCKET_ERROR, { type: 'retry' });

    // 認証エラー - エスカレーション
    map.set(ErrorCode.AUTHENTICATION_FAILED, { type: 'escalate' });
    map.set(ErrorCode.AUTHORIZATION_DENIED, { type: 'escalate' });
    map.set(ErrorCode.SESSION_EXPIRED, { type: 'escalate' });

    // 取引エラー - 中止
    map.set(ErrorCode.INSUFFICIENT_BALANCE, { type: 'abort' });
    map.set(ErrorCode.INSUFFICIENT_MARGIN, { type: 'abort' });
    map.set(ErrorCode.INVALID_LOT_SIZE, { type: 'abort' });

    // システムエラー - リトライ
    map.set(ErrorCode.COMMAND_TIMEOUT, { type: 'retry' });
    map.set(ErrorCode.EA_NOT_CONNECTED, { type: 'retry' });

    return map;
  }

  /**
   * エラー統計の取得
   */
  getErrorStatistics() {
    return {
      totalErrors: this.errorHistory.length,
      errorCounts: Object.fromEntries(this.errorCounts),
      lastErrorTimes: Object.fromEntries(
        Array.from(this.lastErrorTime.entries()).map(([code, time]) => [code, time.toISOString()])
      ),
      activeRetries: this.retryAttempts.size,
    };
  }

  /**
   * エラー履歴の取得
   */
  getErrorHistory(limit?: number): TradingError[] {
    return limit ? this.errorHistory.slice(0, limit) : [...this.errorHistory];
  }

  /**
   * 特定アカウントのエラー履歴取得
   */
  getErrorHistoryByAccount(accountId: string, limit?: number): TradingError[] {
    const accountErrors = this.errorHistory.filter(error => error.accountId === accountId);
    return limit ? accountErrors.slice(0, limit) : accountErrors;
  }

  /**
   * リトライ状態のリセット
   */
  resetRetryState(commandId?: string): void {
    if (commandId) {
      // 特定コマンドのリトライ状態をリセット
      for (const [key] of this.retryAttempts) {
        if (key.includes(commandId)) {
          this.retryAttempts.delete(key);
        }
      }
    } else {
      // 全リトライ状態をリセット
      this.retryAttempts.clear();
    }
  }

  /**
   * エラー履歴のクリア
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    this.errorCounts.clear();
    this.lastErrorTime.clear();
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.clearErrorHistory();
    this.resetRetryState();
    this.errorRateLimiter.clear();
  }
}