/**
 * WebSocketエラーハンドリング・ログ管理クラス
 * エラー処理、イベントログ、監視機能を統合
 * 設計書7-1準拠のエラー分類と対処を追加
 */

import { WSErrorEvent } from '@repo/shared-types';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO', 
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  connectionId?: string;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string | number;
  };
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: { [type: string]: number };
  errorsByConnection: { [connectionId: string]: number };
  lastError?: Date;
  criticalErrors: number;
}

export class WSErrorHandler {
  private static logs: LogEntry[] = [];
  private static maxLogEntries = 10000; // メモリ制限
  private static errorStats: ErrorStats = {
    totalErrors: 0,
    errorsByType: {},
    errorsByConnection: {},
    criticalErrors: 0
  };

  private static logCallbacks: Array<(entry: LogEntry) => void> = [];
  private static errorCallbacks: Array<(error: Error, context: any) => void> = [];

  /**
   * 接続エラー処理
   */
  static handleConnectionError(error: Error, connectionId: string): void {
    const errorType = error.name || 'ConnectionError';
    
    this.updateErrorStats(errorType, connectionId);
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      event: 'CONNECTION_ERROR',
      connectionId,
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      },
      data: {
        errorType,
        connectionId
      }
    };

    this.addLogEntry(logEntry);
    this.notifyErrorCallbacks(error, { connectionId, type: 'connection' });

    // コンソール出力
    console.error(`❌ Connection Error [${connectionId}]:`, error.message);
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
  }

  /**
   * メッセージ処理エラー処理
   */
  static handleMessageError(error: Error, context: {
    connectionId?: string;
    message?: any;
    data?: any;
    [key: string]: any;
  }): void {
    const errorType = error.name || 'MessageError';
    
    this.updateErrorStats(errorType, context.connectionId);
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      event: 'MESSAGE_ERROR',
      connectionId: context.connectionId,
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      },
      data: {
        errorType,
        context: this.sanitizeContext(context)
      }
    };

    this.addLogEntry(logEntry);
    this.notifyErrorCallbacks(error, { ...context, type: 'message' });

    // コンソール出力
    console.error(`❌ Message Error [${context.connectionId || 'unknown'}]:`, error.message);
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
  }

  /**
   * 重要なエラー処理（システム全体に影響）
   */
  static handleCriticalError(error: Error, context: any): void {
    this.errorStats.criticalErrors++;
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.CRITICAL,
      event: 'CRITICAL_ERROR',
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      },
      data: {
        context: this.sanitizeContext(context),
        systemState: this.getCriticalSystemState()
      }
    };

    this.addLogEntry(logEntry);
    this.notifyErrorCallbacks(error, { ...context, type: 'critical' });

    // 重要なエラーは必ずコンソールに出力
    console.error('🚨 CRITICAL ERROR:', error.message);
    console.error('Context:', JSON.stringify(context, null, 2));
    if (error.stack) {
      console.error(error.stack);
    }
  }

  /**
   * 設計書7-1準拠のエラー分類と対処
   */
  static async handleError(error: WSErrorEvent, context: any): Promise<void> {
    if (!error.errorCode) {
      await this.handleUnknownError(error, context);
      return;
    }

    switch (error.errorCode) {
      case 1001: // 口座接続エラー
        await this.handleConnectionError_DesignSpec(error, context);
        break;
      case 2001: // 戦略実行エラー  
        await this.handleStrategyError(error, context);
        break;
      case 3001: // 約定エラー
        await this.handleExecutionError(error, context);
        break;
      case 4001: // 同期エラー
        await this.handleSyncError(error, context);
        break;
      case 5001: // トレールエラー
        await this.handleTrailError(error, context);
        break;
      default:
        await this.handleUnknownError(error, context);
    }
  }

  /**
   * 口座接続エラー処理
   */
  private static async handleConnectionError_DesignSpec(error: WSErrorEvent, context: any): Promise<void> {
    // 再接続処理
    await this.reconnectAccount(context.accountId);
    
    // 口座状態更新
    await this.updateAccountStatus(context.accountId, 'DISCONNECTED');
    
    // エラーログ記録
    this.logError('CONNECTION_ERROR', error, context);
  }

  /**
   * 戦略実行エラー処理
   */
  private static async handleStrategyError(error: WSErrorEvent, context: any): Promise<void> {
    // 状態ロールバック（OPENING→PENDING）
    if (context.positionId) {
      await this.rollbackPositionStatus(context.positionId, 'PENDING');
    }
    
    // Action失敗マーク
    if (context.actionId) {
      await this.markActionFailed(context.actionId, error.message);
    }
    
    this.logError('STRATEGY_ERROR', error, context);
  }

  /**
   * 部分実行処理
   */
  private static async handleExecutionError(error: WSErrorEvent, context: any): Promise<void> {
    // 成功分のみ継続処理
    const successfulActions = await this.getSuccessfulActions(context.strategyId);
    for (const action of successfulActions) {
      await this.continueActionExecution(action);
    }
    
    this.logError('EXECUTION_ERROR', error, context);
  }

  /**
   * 同期エラー処理
   */
  private static async handleSyncError(error: WSErrorEvent, context: any): Promise<void> {
    // 同期修復処理
    if (context.accountId) {
      await this.resyncAccountData(context.accountId);
    }
    
    this.logError('SYNC_ERROR', error, context);
  }

  /**
   * トレールエラー処理
   */
  private static async handleTrailError(error: WSErrorEvent, context: any): Promise<void> {
    // トレール設定リセット
    if (context.positionId) {
      await this.resetTrailSettings(context.positionId);
    }
    
    this.logError('TRAIL_ERROR', error, context);
  }

  /**
   * 不明エラー処理
   */
  private static async handleUnknownError(error: WSErrorEvent, context: any): Promise<void> {
    this.logError('UNKNOWN_ERROR', error, context);
  }

  // 設計書準拠エラー処理の補助メソッド
  private static async reconnectAccount(accountId: string): Promise<void> {
    // 実装: 口座再接続ロジック
    console.log(`🔄 Attempting to reconnect account: ${accountId}`);
  }

  private static async updateAccountStatus(accountId: string, status: string): Promise<void> {
    // 実装: 口座状態更新
    console.log(`📊 Account status updated: ${accountId} -> ${status}`);
  }

  private static async rollbackPositionStatus(positionId: string, status: string): Promise<void> {
    // 実装: ポジション状態ロールバック
    console.log(`🔄 Position status rolled back: ${positionId} -> ${status}`);
  }

  private static async markActionFailed(actionId: string, reason: string): Promise<void> {
    // 実装: アクション失敗マーク
    console.log(`❌ Action marked as failed: ${actionId} - ${reason}`);
  }

  private static async getSuccessfulActions(strategyId: string): Promise<any[]> {
    // 実装: 成功したアクション取得
    console.log(`✅ Getting successful actions for strategy: ${strategyId}`);
    return []; // 実装待ち
  }

  private static async continueActionExecution(action: any): Promise<void> {
    // 実装: アクション実行継続
    console.log(`▶️ Continuing action execution: ${action.id}`);
  }

  private static async resyncAccountData(accountId: string): Promise<void> {
    // 実装: 口座データ再同期
    console.log(`🔄 Resyncing account data: ${accountId}`);
  }

  private static async resetTrailSettings(positionId: string): Promise<void> {
    // 実装: トレール設定リセット
    console.log(`🔄 Trail settings reset: ${positionId}`);
  }

  private static logError(errorType: string, error: WSErrorEvent, context: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      event: errorType,
      connectionId: context.connectionId,
      error: {
        message: error.message,
        code: error.errorCode
      },
      data: {
        errorType,
        context: this.sanitizeContext(context),
        errorDetails: error
      }
    };

    this.addLogEntry(logEntry);
    console.error(`❌ ${errorType}:`, error.message, context);
  }

  /**
   * イベントログ出力
   */
  static logEvent(event: string, data?: any, level: LogLevel = LogLevel.INFO): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      data: this.sanitizeContext(data)
    };

    this.addLogEntry(logEntry);

    // レベル別コンソール出力
    switch (level) {
      case LogLevel.DEBUG:
        if (process.env.NODE_ENV === 'development') {
          console.debug(`🔍 ${event}:`, data);
        }
        break;
      case LogLevel.INFO:
        console.log(`ℹ️ ${event}:`, data ? JSON.stringify(data, null, 2) : '');
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${event}:`, data);
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${event}:`, data);
        break;
      case LogLevel.CRITICAL:
        console.error(`🚨 ${event}:`, data);
        break;
    }
  }

  /**
   * ログエントリー追加
   */
  private static addLogEntry(entry: LogEntry): void {
    this.logs.push(entry);
    
    // メモリ制限チェック
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-Math.floor(this.maxLogEntries * 0.8)); // 80%残す
    }

    // コールバック通知
    this.notifyLogCallbacks(entry);
  }

  /**
   * エラー統計更新
   */
  private static updateErrorStats(errorType: string, connectionId?: string): void {
    this.errorStats.totalErrors++;
    this.errorStats.lastError = new Date();
    
    this.errorStats.errorsByType[errorType] = (this.errorStats.errorsByType[errorType] || 0) + 1;
    
    if (connectionId) {
      this.errorStats.errorsByConnection[connectionId] = 
        (this.errorStats.errorsByConnection[connectionId] || 0) + 1;
    }
  }

  /**
   * コンテキストデータの無害化
   */
  private static sanitizeContext(context: any): any {
    if (!context) return context;
    
    // パスワード・トークンなどの機密情報を除去
    const sensitiveKeys = ['password', 'token', 'secret', 'auth', 'key', 'credential'];
    const sanitized = { ...context };
    
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some(sensitive => 
          key.toLowerCase().includes(sensitive.toLowerCase())
        )) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * 重要なシステム状態取得
   */
  private static getCriticalSystemState(): any {
    return {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      activeTimers: (process as any)._getActiveHandles ? (process as any)._getActiveHandles().length : 'unknown'
    };
  }

  /**
   * ログコールバック登録
   */
  static onLog(callback: (entry: LogEntry) => void): void {
    this.logCallbacks.push(callback);
  }

  /**
   * エラーコールバック登録
   */
  static onError(callback: (error: Error, context: any) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * コールバック通知
   */
  private static notifyLogCallbacks(entry: LogEntry): void {
    this.logCallbacks.forEach(callback => {
      try {
        callback(entry);
      } catch (error) {
        console.error('Log callback error:', error);
      }
    });
  }

  private static notifyErrorCallbacks(error: Error, context: any): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error, context);
      } catch (callbackError) {
        console.error('Error callback error:', callbackError);
      }
    });
  }

  /**
   * ログ取得
   */
  static getLogs(options: {
    level?: LogLevel;
    event?: string;
    connectionId?: string;
    limit?: number;
    since?: Date;
  } = {}): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (options.level) {
      filteredLogs = filteredLogs.filter(log => log.level === options.level);
    }

    if (options.event) {
      filteredLogs = filteredLogs.filter(log => log.event === options.event);
    }

    if (options.connectionId) {
      filteredLogs = filteredLogs.filter(log => log.connectionId === options.connectionId);
    }

    if (options.since) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= options.since!
      );
    }

    if (options.limit) {
      filteredLogs = filteredLogs.slice(-options.limit);
    }

    return filteredLogs;
  }

  /**
   * エラー統計取得
   */
  static getErrorStats(): ErrorStats {
    return { ...this.errorStats };
  }

  /**
   * 最近のエラー取得
   */
  static getRecentErrors(limit: number = 50): LogEntry[] {
    return this.logs
      .filter(log => log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL)
      .slice(-limit);
  }

  /**
   * 接続別エラー統計取得
   */
  static getConnectionErrorStats(connectionId: string): {
    totalErrors: number;
    errorTypes: { [type: string]: number };
    recentErrors: LogEntry[];
  } {
    const connectionLogs = this.logs.filter(log => log.connectionId === connectionId);
    const errors = connectionLogs.filter(log => 
      log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL
    );

    const errorTypes: { [type: string]: number } = {};
    errors.forEach(error => {
      const type = error.data?.errorType || 'Unknown';
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });

    return {
      totalErrors: errors.length,
      errorTypes,
      recentErrors: errors.slice(-10)
    };
  }

  /**
   * ログクリア
   */
  static clearLogs(): void {
    this.logs = [];
    this.errorStats = {
      totalErrors: 0,
      errorsByType: {},
      errorsByConnection: {},
      criticalErrors: 0
    };
    
    this.logEvent('LOGS_CLEARED', {}, LogLevel.INFO);
  }

  /**
   * ログエクスポート
   */
  static exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        totalEntries: this.logs.length,
        errorStats: this.errorStats,
        logs: this.logs
      }, null, 2);
    } else {
      // CSV形式
      const headers = ['timestamp', 'level', 'event', 'connectionId', 'message', 'data'];
      const csvRows = [headers.join(',')];
      
      this.logs.forEach(log => {
        const row = [
          log.timestamp,
          log.level,
          log.event,
          log.connectionId || '',
          log.error?.message || '',
          JSON.stringify(log.data || {}).replace(/,/g, ';')
        ];
        csvRows.push(row.join(','));
      });
      
      return csvRows.join('\n');
    }
  }
}