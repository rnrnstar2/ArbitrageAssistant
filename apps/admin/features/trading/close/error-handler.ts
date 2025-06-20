/**
 * 決済システム専用エラーハンドリング
 * 
 * 決済プロセス中のエラー処理、復旧戦略、ログ記録を提供
 */

import { CloseFormData, CloseResult, BatchCloseInput, BatchCloseResult } from "./types";

export enum CloseErrorCode {
  // バリデーションエラー
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_POSITION_ID = "INVALID_POSITION_ID",
  INVALID_CLOSE_PRICE = "INVALID_CLOSE_PRICE",
  INVALID_LOT_SIZE = "INVALID_LOT_SIZE",
  
  // ポジション状態エラー
  POSITION_NOT_FOUND = "POSITION_NOT_FOUND",
  POSITION_ALREADY_CLOSED = "POSITION_ALREADY_CLOSED",
  POSITION_LOCKED = "POSITION_LOCKED",
  INSUFFICIENT_VOLUME = "INSUFFICIENT_VOLUME",
  
  // 市場状態エラー
  MARKET_CLOSED = "MARKET_CLOSED",
  HIGH_SPREAD = "HIGH_SPREAD",
  LIQUIDITY_INSUFFICIENT = "LIQUIDITY_INSUFFICIENT",
  PRICE_DEVIATION = "PRICE_DEVIATION",
  
  // アカウントエラー
  INSUFFICIENT_MARGIN = "INSUFFICIENT_MARGIN",
  ACCOUNT_DISABLED = "ACCOUNT_DISABLED",
  TRADING_DISABLED = "TRADING_DISABLED",
  MARGIN_CALL = "MARGIN_CALL",
  
  // 接続エラー
  CONNECTION_LOST = "CONNECTION_LOST",
  WEBSOCKET_ERROR = "WEBSOCKET_ERROR",
  EA_DISCONNECTED = "EA_DISCONNECTED",
  TIMEOUT = "TIMEOUT",
  
  // サーバーエラー
  SERVER_ERROR = "SERVER_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  
  // 決済固有エラー
  CLOSE_REJECTED = "CLOSE_REJECTED",
  PARTIAL_CLOSE_FAILED = "PARTIAL_CLOSE_FAILED",
  TRAIL_SETUP_FAILED = "TRAIL_SETUP_FAILED",
  LINKED_ACTION_FAILED = "LINKED_ACTION_FAILED",
  
  // バッチ処理エラー
  BATCH_SIZE_EXCEEDED = "BATCH_SIZE_EXCEEDED",
  BATCH_PARTIAL_FAILURE = "BATCH_PARTIAL_FAILURE",
  BATCH_TIMEOUT = "BATCH_TIMEOUT",
  CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION",
}

export enum CloseErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum RecoveryAction {
  RETRY = "retry",
  SKIP = "skip",
  ABORT = "abort",
  FALLBACK = "fallback",
  MANUAL_INTERVENTION = "manual_intervention",
}

export interface CloseError {
  code: CloseErrorCode;
  message: string;
  severity: CloseErrorSeverity;
  positionId?: string;
  batchId?: string;
  timestamp: Date;
  context?: Record<string, any>;
  originalError?: Error;
  retryable: boolean;
  recoveryAction: RecoveryAction;
}

export interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxRetryDelay: number;
  enableFallback: boolean;
  notifyUser: boolean;
}

export interface ErrorRecoveryResult {
  success: boolean;
  action: RecoveryAction;
  retryCount: number;
  finalError?: CloseError;
  recoveredData?: any;
}

export interface ErrorStatistics {
  totalErrors: number;
  errorsByCode: Record<CloseErrorCode, number>;
  errorsBySeverity: Record<CloseErrorSeverity, number>;
  errorRate: number;
  lastErrorTime?: Date;
  meanTimeBetweenErrors?: number;
}

export class CloseErrorHandler {
  private errorHistory: CloseError[] = [];
  private retryAttempts: Map<string, number> = new Map();
  private recoveryConfig: ErrorRecoveryConfig;
  private errorCallbacks: Array<(error: CloseError) => void> = [];
  private recoveryCallbacks: Array<(result: ErrorRecoveryResult) => void> = [];

  constructor(config?: Partial<ErrorRecoveryConfig>) {
    this.recoveryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      maxRetryDelay: 10000,
      enableFallback: true,
      notifyUser: true,
      ...config,
    };
  }

  /**
   * エラーの処理と復旧試行
   */
  async handleError(
    error: Error | CloseError,
    context?: Record<string, any>
  ): Promise<ErrorRecoveryResult> {
    const closeError = this.normalizeError(error, context);
    
    // エラー履歴に追加
    this.addToHistory(closeError);
    
    // エラーコールバック実行
    this.notifyErrorCallbacks(closeError);
    
    // 復旧処理の実行
    const recoveryResult = await this.executeRecovery(closeError);
    
    // 復旧結果コールバック実行
    this.notifyRecoveryCallbacks(recoveryResult);
    
    return recoveryResult;
  }

  /**
   * 個別決済エラーの処理
   */
  async handleCloseError(
    closeData: CloseFormData,
    error: Error,
    context?: Record<string, any>
  ): Promise<ErrorRecoveryResult> {
    const enhancedContext = {
      ...context,
      operation: "single_close",
      positionId: closeData.positionId,
      closeType: closeData.closeType,
      closePrice: closeData.closePrice,
    };

    return this.handleError(error, enhancedContext);
  }

  /**
   * 一括決済エラーの処理
   */
  async handleBatchCloseError(
    batchData: BatchCloseInput,
    error: Error,
    partialResults?: CloseResult[],
    context?: Record<string, any>
  ): Promise<ErrorRecoveryResult> {
    const enhancedContext = {
      ...context,
      operation: "batch_close",
      batchSize: batchData.positionIds.length,
      completedCount: partialResults?.length || 0,
      failedPositions: batchData.positionIds.filter(id => 
        !partialResults?.some(r => r.positionId === id && r.status === "executed")
      ),
    };

    const closeError = this.normalizeError(error, enhancedContext);
    
    // バッチ処理の部分的失敗の場合は特別な処理
    if (partialResults && partialResults.length > 0) {
      closeError.code = CloseErrorCode.BATCH_PARTIAL_FAILURE;
      closeError.severity = CloseErrorSeverity.MEDIUM;
      closeError.recoveryAction = RecoveryAction.FALLBACK;
    }

    return this.handleError(closeError, enhancedContext);
  }

  /**
   * WebSocket関連エラーの処理
   */
  async handleWebSocketError(
    error: Error,
    operation: string,
    context?: Record<string, any>
  ): Promise<ErrorRecoveryResult> {
    const enhancedContext = {
      ...context,
      operation,
      connectionType: "websocket",
    };

    const closeError = this.createCloseError(
      CloseErrorCode.WEBSOCKET_ERROR,
      `WebSocket error during ${operation}: ${error.message}`,
      CloseErrorSeverity.HIGH,
      enhancedContext
    );

    closeError.retryable = true;
    closeError.recoveryAction = RecoveryAction.RETRY;

    return this.handleError(closeError, enhancedContext);
  }

  /**
   * タイムアウトエラーの処理
   */
  async handleTimeout(
    operation: string,
    timeoutMs: number,
    context?: Record<string, any>
  ): Promise<ErrorRecoveryResult> {
    const enhancedContext = {
      ...context,
      operation,
      timeoutMs,
    };

    const closeError = this.createCloseError(
      CloseErrorCode.TIMEOUT,
      `Operation ${operation} timed out after ${timeoutMs}ms`,
      CloseErrorSeverity.HIGH,
      enhancedContext
    );

    closeError.retryable = true;
    closeError.recoveryAction = RecoveryAction.RETRY;

    return this.handleError(closeError, enhancedContext);
  }

  /**
   * 復旧処理の実行
   */
  private async executeRecovery(error: CloseError): Promise<ErrorRecoveryResult> {
    const retryKey = this.getRetryKey(error);
    const retryCount = this.retryAttempts.get(retryKey) || 0;

    switch (error.recoveryAction) {
      case RecoveryAction.RETRY:
        return await this.executeRetry(error, retryCount);
      
      case RecoveryAction.FALLBACK:
        return await this.executeFallback(error);
      
      case RecoveryAction.SKIP:
        return this.executeSkip(error);
      
      case RecoveryAction.MANUAL_INTERVENTION:
        return this.requireManualIntervention(error);
      
      case RecoveryAction.ABORT:
      default:
        return this.executeAbort(error);
    }
  }

  /**
   * リトライ処理
   */
  private async executeRetry(error: CloseError, currentRetryCount: number): Promise<ErrorRecoveryResult> {
    if (currentRetryCount >= this.recoveryConfig.maxRetries) {
      return {
        success: false,
        action: RecoveryAction.ABORT,
        retryCount: currentRetryCount,
        finalError: {
          ...error,
          message: `Max retry attempts (${this.recoveryConfig.maxRetries}) exceeded`,
          severity: CloseErrorSeverity.CRITICAL,
        },
      };
    }

    const retryKey = this.getRetryKey(error);
    this.retryAttempts.set(retryKey, currentRetryCount + 1);

    const delay = this.calculateRetryDelay(currentRetryCount);
    
    console.log(`Retrying operation after ${delay}ms (attempt ${currentRetryCount + 1}/${this.recoveryConfig.maxRetries})`);
    
    await this.delay(delay);

    return {
      success: true,
      action: RecoveryAction.RETRY,
      retryCount: currentRetryCount + 1,
    };
  }

  /**
   * フォールバック処理
   */
  private async executeFallback(error: CloseError): Promise<ErrorRecoveryResult> {
    if (!this.recoveryConfig.enableFallback) {
      return this.executeAbort(error);
    }

    // フォールバック戦略の実装
    let fallbackAction: string = "unknown";
    let success = false;

    try {
      switch (error.code) {
        case CloseErrorCode.BATCH_PARTIAL_FAILURE:
          fallbackAction = "continue_with_successful_closes";
          success = true;
          break;
        
        case CloseErrorCode.HIGH_SPREAD:
          fallbackAction = "switch_to_limit_order";
          success = true;
          break;
        
        case CloseErrorCode.MARKET_CLOSED:
          fallbackAction = "schedule_for_market_open";
          success = true;
          break;
        
        case CloseErrorCode.WEBSOCKET_ERROR:
          fallbackAction = "use_alternative_connection";
          success = true;
          break;

        default:
          fallbackAction = "manual_review_required";
          success = false;
      }

      return {
        success,
        action: RecoveryAction.FALLBACK,
        retryCount: 0,
        recoveredData: { fallbackAction },
      };
    } catch (fallbackError) {
      return {
        success: false,
        action: RecoveryAction.ABORT,
        retryCount: 0,
        finalError: {
          ...error,
          message: `Fallback failed: ${fallbackError}`,
          severity: CloseErrorSeverity.CRITICAL,
        },
      };
    }
  }

  /**
   * スキップ処理
   */
  private executeSkip(error: CloseError): ErrorRecoveryResult {
    return {
      success: true,
      action: RecoveryAction.SKIP,
      retryCount: 0,
      recoveredData: { skippedReason: error.message },
    };
  }

  /**
   * 手動介入要求
   */
  private requireManualIntervention(error: CloseError): ErrorRecoveryResult {
    console.error("Manual intervention required:", error);
    
    return {
      success: false,
      action: RecoveryAction.MANUAL_INTERVENTION,
      retryCount: 0,
      finalError: {
        ...error,
        message: `Manual intervention required: ${error.message}`,
        severity: CloseErrorSeverity.CRITICAL,
      },
    };
  }

  /**
   * 中止処理
   */
  private executeAbort(error: CloseError): ErrorRecoveryResult {
    return {
      success: false,
      action: RecoveryAction.ABORT,
      retryCount: 0,
      finalError: error,
    };
  }

  /**
   * エラーの正規化
   */
  private normalizeError(error: Error | CloseError, context?: Record<string, any>): CloseError {
    if (this.isCloseError(error)) {
      return {
        ...error,
        context: { ...error.context, ...context },
      };
    }

    // 一般的なErrorからCloseErrorに変換
    const errorCode = this.classifyError(error);
    return this.createCloseError(
      errorCode,
      error.message,
      this.getSeverityByCode(errorCode),
      { ...context, originalError: error }
    );
  }

  /**
   * エラーの分類
   */
  private classifyError(error: Error): CloseErrorCode {
    const message = error.message.toLowerCase();
    
    if (message.includes("timeout")) return CloseErrorCode.TIMEOUT;
    if (message.includes("connection")) return CloseErrorCode.CONNECTION_LOST;
    if (message.includes("websocket")) return CloseErrorCode.WEBSOCKET_ERROR;
    if (message.includes("position not found")) return CloseErrorCode.POSITION_NOT_FOUND;
    if (message.includes("market closed")) return CloseErrorCode.MARKET_CLOSED;
    if (message.includes("insufficient margin")) return CloseErrorCode.INSUFFICIENT_MARGIN;
    if (message.includes("validation")) return CloseErrorCode.VALIDATION_ERROR;
    
    return CloseErrorCode.INTERNAL_ERROR;
  }

  /**
   * CloseErrorの作成
   */
  private createCloseError(
    code: CloseErrorCode,
    message: string,
    severity: CloseErrorSeverity,
    context?: Record<string, any>
  ): CloseError {
    return {
      code,
      message,
      severity,
      timestamp: new Date(),
      context,
      retryable: this.isRetryableError(code),
      recoveryAction: this.getDefaultRecoveryAction(code),
    };
  }

  /**
   * エラーコード別のデフォルト復旧アクション
   */
  private getDefaultRecoveryAction(code: CloseErrorCode): RecoveryAction {
    switch (code) {
      case CloseErrorCode.CONNECTION_LOST:
      case CloseErrorCode.WEBSOCKET_ERROR:
      case CloseErrorCode.TIMEOUT:
      case CloseErrorCode.EA_DISCONNECTED:
        return RecoveryAction.RETRY;
      
      case CloseErrorCode.HIGH_SPREAD:
      case CloseErrorCode.MARKET_CLOSED:
      case CloseErrorCode.BATCH_PARTIAL_FAILURE:
        return RecoveryAction.FALLBACK;
      
      case CloseErrorCode.POSITION_NOT_FOUND:
      case CloseErrorCode.POSITION_ALREADY_CLOSED:
        return RecoveryAction.SKIP;
      
      case CloseErrorCode.INSUFFICIENT_MARGIN:
      case CloseErrorCode.ACCOUNT_DISABLED:
      case CloseErrorCode.MARGIN_CALL:
        return RecoveryAction.MANUAL_INTERVENTION;
      
      default:
        return RecoveryAction.ABORT;
    }
  }

  /**
   * リトライ可能エラーの判定
   */
  private isRetryableError(code: CloseErrorCode): boolean {
    const retryableErrors = [
      CloseErrorCode.CONNECTION_LOST,
      CloseErrorCode.WEBSOCKET_ERROR,
      CloseErrorCode.TIMEOUT,
      CloseErrorCode.EA_DISCONNECTED,
      CloseErrorCode.SERVER_ERROR,
      CloseErrorCode.RATE_LIMIT_EXCEEDED,
      CloseErrorCode.SERVICE_UNAVAILABLE,
    ];
    return retryableErrors.includes(code);
  }

  /**
   * エラーコード別の重要度取得
   */
  private getSeverityByCode(code: CloseErrorCode): CloseErrorSeverity {
    switch (code) {
      case CloseErrorCode.ACCOUNT_DISABLED:
      case CloseErrorCode.MARGIN_CALL:
      case CloseErrorCode.INTERNAL_ERROR:
        return CloseErrorSeverity.CRITICAL;
      
      case CloseErrorCode.CONNECTION_LOST:
      case CloseErrorCode.WEBSOCKET_ERROR:
      case CloseErrorCode.INSUFFICIENT_MARGIN:
      case CloseErrorCode.CLOSE_REJECTED:
        return CloseErrorSeverity.HIGH;
      
      case CloseErrorCode.MARKET_CLOSED:
      case CloseErrorCode.HIGH_SPREAD:
      case CloseErrorCode.BATCH_PARTIAL_FAILURE:
      case CloseErrorCode.TRAIL_SETUP_FAILED:
        return CloseErrorSeverity.MEDIUM;
      
      default:
        return CloseErrorSeverity.LOW;
    }
  }

  /**
   * リトライ遅延の計算
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = this.recoveryConfig.retryDelay * 
      Math.pow(this.recoveryConfig.backoffMultiplier, retryCount);
    
    return Math.min(delay, this.recoveryConfig.maxRetryDelay);
  }

  /**
   * リトライキーの生成
   */
  private getRetryKey(error: CloseError): string {
    return `${error.code}_${error.positionId || error.batchId || 'global'}`;
  }

  /**
   * CloseErrorの型ガード
   */
  private isCloseError(error: any): error is CloseError {
    return error && typeof error === 'object' && 'code' in error && 'severity' in error;
  }

  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * エラー履歴への追加
   */
  private addToHistory(error: CloseError): void {
    this.errorHistory.unshift(error);
    
    // 履歴サイズの制限
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(0, 1000);
    }
  }

  /**
   * エラーコールバックの通知
   */
  private notifyErrorCallbacks(error: CloseError): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error("Error in error callback:", callbackError);
      }
    });
  }

  /**
   * 復旧結果コールバックの通知
   */
  private notifyRecoveryCallbacks(result: ErrorRecoveryResult): void {
    this.recoveryCallbacks.forEach(callback => {
      try {
        callback(result);
      } catch (callbackError) {
        console.error("Error in recovery callback:", callbackError);
      }
    });
  }

  /**
   * エラーコールバックの登録
   */
  onError(callback: (error: CloseError) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * 復旧結果コールバックの登録
   */
  onRecovery(callback: (result: ErrorRecoveryResult) => void): void {
    this.recoveryCallbacks.push(callback);
  }

  /**
   * エラー統計の取得
   */
  getErrorStatistics(): ErrorStatistics {
    const totalErrors = this.errorHistory.length;
    
    const errorsByCode = {} as Record<CloseErrorCode, number>;
    const errorsBySeverity = {} as Record<CloseErrorSeverity, number>;
    
    this.errorHistory.forEach(error => {
      errorsByCode[error.code] = (errorsByCode[error.code] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentErrors = this.errorHistory.filter(e => e.timestamp > oneHourAgo);
    const errorRate = recentErrors.length / 60; // errors per minute

    return {
      totalErrors,
      errorsByCode,
      errorsBySeverity,
      errorRate,
      lastErrorTime: this.errorHistory[0]?.timestamp,
    };
  }

  /**
   * エラー履歴の取得
   */
  getErrorHistory(limit?: number): CloseError[] {
    return limit ? this.errorHistory.slice(0, limit) : [...this.errorHistory];
  }

  /**
   * リトライ状態のリセット
   */
  resetRetryState(positionId?: string): void {
    if (positionId) {
      for (const [key] of this.retryAttempts) {
        if (key.includes(positionId)) {
          this.retryAttempts.delete(key);
        }
      }
    } else {
      this.retryAttempts.clear();
    }
  }

  /**
   * エラー履歴のクリア
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<ErrorRecoveryConfig>): void {
    this.recoveryConfig = { ...this.recoveryConfig, ...config };
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.clearErrorHistory();
    this.resetRetryState();
    this.errorCallbacks = [];
    this.recoveryCallbacks = [];
  }
}

/**
 * 決済エラーハンドラーのファクトリー関数
 */
export function createCloseErrorHandler(config?: Partial<ErrorRecoveryConfig>): CloseErrorHandler {
  return new CloseErrorHandler(config);
}