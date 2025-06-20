/**
 * 決済システム専用ログ出力機能
 * 
 * 決済操作、エラー、バリデーション、パフォーマンス、デバッグログを提供
 */

import { CloseFormData, CloseResult, BatchCloseInput, BatchCloseResult } from "./types";
import { CloseError, CloseErrorSeverity } from "./error-handler";
import { ValidationResult } from "./validation";
import { PreCloseCheckResult } from "./pre-close-checker";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export enum LogCategory {
  CLOSE_OPERATION = "close_operation",
  VALIDATION = "validation",
  PRE_CHECK = "pre_check",
  ERROR_HANDLING = "error_handling",
  PERFORMANCE = "performance",
  WEBSOCKET = "websocket",
  USER_ACTION = "user_action",
  SYSTEM = "system",
  AUDIT = "audit",
  DEBUG = "debug",
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: Record<string, any>;
  sessionId?: string;
  userId?: string;
  positionId?: string;
  batchId?: string;
  correlationId?: string;
  source: string;
  performanceData?: PerformanceData;
}

export interface PerformanceData {
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  operationCount?: number;
  throughput?: number;
}

export interface LoggerConfig {
  level: LogLevel;
  enabledCategories: LogCategory[];
  maxLogEntries: number;
  enablePerformanceLogging: boolean;
  enableAuditLogging: boolean;
  logToConsole: boolean;
  logToFile?: boolean;
  logFilePath?: string;
  structuredLogging: boolean;
  includeStackTrace: boolean;
}

export interface LogFilter {
  level?: LogLevel;
  category?: LogCategory;
  timeRange?: {
    start: Date;
    end: Date;
  };
  positionId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
}

export interface LogExportOptions {
  format: "json" | "csv" | "text";
  filter?: LogFilter;
  includeMetadata: boolean;
  maxEntries?: number;
}

export class CloseSystemLogger {
  private logs: LogEntry[] = [];
  private config: LoggerConfig;
  private logCounter: number = 0;
  private sessionId: string;
  private performanceTimers: Map<string, number> = new Map();

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      enabledCategories: Object.values(LogCategory),
      maxLogEntries: 10000,
      enablePerformanceLogging: true,
      enableAuditLogging: true,
      logToConsole: true,
      structuredLogging: true,
      includeStackTrace: false,
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.info(LogCategory.SYSTEM, "Logger initialized", { config: this.config });
  }

  /**
   * 決済操作ログ
   */
  logCloseOperation(
    operation: "start" | "success" | "failure",
    closeData: CloseFormData,
    result?: CloseResult,
    error?: CloseError,
    duration?: number
  ): void {
    const message = this.getCloseOperationMessage(operation, closeData, result, error);
    const level = operation === "failure" ? LogLevel.ERROR : LogLevel.INFO;

    this.log(level, LogCategory.CLOSE_OPERATION, message, {
      operation,
      closeData: this.sanitizeCloseData(closeData),
      result,
      error,
      positionId: closeData.positionId,
    }, duration ? { duration } : undefined);
  }

  /**
   * 一括決済操作ログ
   */
  logBatchCloseOperation(
    operation: "start" | "progress" | "success" | "failure",
    batchData: BatchCloseInput,
    result?: BatchCloseResult,
    error?: CloseError,
    progress?: { completed: number; total: number },
    duration?: number
  ): void {
    const message = this.getBatchCloseOperationMessage(operation, batchData, result, progress);
    const level = operation === "failure" ? LogLevel.ERROR : LogLevel.INFO;

    this.log(level, LogCategory.CLOSE_OPERATION, message, {
      operation,
      batchData: this.sanitizeBatchData(batchData),
      result,
      error,
      progress,
      batchSize: batchData.positionIds.length,
    }, duration ? { duration } : undefined);
  }

  /**
   * バリデーションログ
   */
  logValidation(
    validationType: "input" | "pre_check" | "business_logic",
    validationResult: ValidationResult,
    context?: Record<string, any>,
    duration?: number
  ): void {
    const hasErrors = validationResult.errors.length > 0;
    const level = hasErrors ? LogLevel.WARN : LogLevel.INFO;
    const message = `${validationType} validation ${hasErrors ? 'failed' : 'passed'} - Errors: ${validationResult.errors.length}, Warnings: ${validationResult.warnings.length}`;

    this.log(level, LogCategory.VALIDATION, message, {
      validationType,
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length,
      score: validationResult.score,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      context,
    }, duration ? { duration } : undefined);
  }

  /**
   * 事前チェックログ
   */
  logPreCheck(
    checkResult: PreCloseCheckResult,
    checkType: "single" | "batch",
    context?: Record<string, any>,
    duration?: number
  ): void {
    const hasBlockers = checkResult.blockers.length > 0;
    const level = hasBlockers ? LogLevel.ERROR : 
                  checkResult.warnings.length > 0 ? LogLevel.WARN : LogLevel.INFO;
    
    const message = `Pre-close ${checkType} check ${hasBlockers ? 'blocked' : 'passed'} - Blockers: ${checkResult.blockers.length}, Warnings: ${checkResult.warnings.length}`;

    this.log(level, LogCategory.PRE_CHECK, message, {
      checkType,
      canProceed: checkResult.canProceed,
      blockerCount: checkResult.blockers.length,
      warningCount: checkResult.warnings.length,
      recommendationCount: checkResult.recommendations.length,
      blockers: checkResult.blockers,
      warnings: checkResult.warnings,
      recommendations: checkResult.recommendations,
      context,
    }, duration ? { duration } : undefined);
  }

  /**
   * エラーハンドリングログ
   */
  logErrorHandling(
    error: CloseError,
    recoveryAction: string,
    recoveryResult: "success" | "failure" | "retry",
    context?: Record<string, any>
  ): void {
    const level = recoveryResult === "failure" ? LogLevel.ERROR : LogLevel.WARN;
    const message = `Error handling: ${error.code} - Recovery action: ${recoveryAction} (${recoveryResult})`;

    this.log(level, LogCategory.ERROR_HANDLING, message, {
      errorCode: error.code,
      errorSeverity: error.severity,
      recoveryAction,
      recoveryResult,
      errorMessage: error.message,
      positionId: error.positionId,
      batchId: error.batchId,
      retryable: error.retryable,
      context: { ...error.context, ...context },
    });
  }

  /**
   * WebSocket通信ログ
   */
  logWebSocketOperation(
    operation: "send" | "receive" | "connect" | "disconnect" | "error",
    message?: string,
    data?: Record<string, any>,
    duration?: number
  ): void {
    const level = operation === "error" ? LogLevel.ERROR : LogLevel.DEBUG;
    const logMessage = `WebSocket ${operation}${message ? `: ${message}` : ''}`;

    this.log(level, LogCategory.WEBSOCKET, logMessage, {
      operation,
      data,
    }, duration ? { duration } : undefined);
  }

  /**
   * ユーザーアクションログ
   */
  logUserAction(
    action: string,
    userId?: string,
    data?: Record<string, any>
  ): void {
    this.log(LogLevel.INFO, LogCategory.USER_ACTION, `User action: ${action}`, {
      action,
      userId,
      data,
    });
  }

  /**
   * パフォーマンス計測開始
   */
  startPerformanceTimer(operationId: string): void {
    if (this.config.enablePerformanceLogging) {
      this.performanceTimers.set(operationId, performance.now());
      this.debug(LogCategory.PERFORMANCE, `Performance timer started: ${operationId}`);
    }
  }

  /**
   * パフォーマンス計測終了
   */
  endPerformanceTimer(
    operationId: string,
    additionalData?: Record<string, any>
  ): number {
    if (!this.config.enablePerformanceLogging) return 0;

    const startTime = this.performanceTimers.get(operationId);
    if (!startTime) {
      this.warn(LogCategory.PERFORMANCE, `Performance timer not found: ${operationId}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.performanceTimers.delete(operationId);

    this.log(LogLevel.INFO, LogCategory.PERFORMANCE, `Performance: ${operationId} completed`, {
      operationId,
      ...additionalData,
    }, { duration });

    return duration;
  }

  /**
   * 監査ログ
   */
  audit(
    event: string,
    userId?: string,
    data?: Record<string, any>
  ): void {
    if (this.config.enableAuditLogging) {
      this.log(LogLevel.INFO, LogCategory.AUDIT, `Audit: ${event}`, {
        event,
        userId,
        data,
      });
    }
  }

  /**
   * レベル別ログメソッド
   */
  debug(category: LogCategory, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: LogCategory, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: LogCategory, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: LogCategory, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  fatal(category: LogCategory, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.FATAL, category, message, data);
  }

  /**
   * メインログメソッド
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: Record<string, any>,
    performanceData?: PerformanceData
  ): void {
    // レベル・カテゴリフィルタリング
    if (level < this.config.level || !this.config.enabledCategories.includes(category)) {
      return;
    }

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level,
      category,
      message,
      data,
      sessionId: this.sessionId,
      source: "close-system",
      performanceData,
      ...this.extractIds(data),
    };

    // ログエントリの追加
    this.addLogEntry(logEntry);

    // コンソール出力
    if (this.config.logToConsole) {
      this.logToConsole(logEntry);
    }

    // ファイル出力（実装は環境依存）
    if (this.config.logToFile && this.config.logFilePath) {
      this.logToFile(logEntry);
    }
  }

  /**
   * ログエントリの追加（メモリ管理付き）
   */
  private addLogEntry(entry: LogEntry): void {
    this.logs.unshift(entry);

    // ログサイズの制限
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(0, this.config.maxLogEntries);
    }
  }

  /**
   * コンソール出力
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const prefix = `[${timestamp}] ${levelName} [${entry.category}]`;

    if (this.config.structuredLogging) {
      const consoleMethod = this.getConsoleMethod(entry.level);
      consoleMethod(`${prefix} ${entry.message}`, entry);
    } else {
      const formattedMessage = this.formatLogMessage(entry);
      const consoleMethod = this.getConsoleMethod(entry.level);
      consoleMethod(formattedMessage);
    }
  }

  /**
   * ファイル出力（プレースホルダー）
   */
  private logToFile(entry: LogEntry): void {
    // ファイル出力の実装（Node.js環境など）
    console.log("File logging not implemented:", entry);
  }

  /**
   * ログメッセージのフォーマット
   */
  private formatLogMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level].padEnd(5);
    const category = entry.category.padEnd(15);
    
    let message = `[${timestamp}] ${levelName} [${category}] ${entry.message}`;
    
    if (entry.positionId) {
      message += ` [Position: ${entry.positionId}]`;
    }
    
    if (entry.performanceData) {
      message += ` [Duration: ${entry.performanceData.duration.toFixed(2)}ms]`;
    }

    return message;
  }

  /**
   * レベル別コンソールメソッドの取得
   */
  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return console.error;
      default:
        return console.log;
    }
  }

  /**
   * データからIDの抽出
   */
  private extractIds(data?: Record<string, any>): Partial<LogEntry> {
    if (!data) return {};

    return {
      positionId: data.positionId || data.position?.id,
      batchId: data.batchId,
      userId: data.userId,
      correlationId: data.correlationId,
    };
  }

  /**
   * センシティブデータのサニタイズ
   */
  private sanitizeCloseData(closeData: CloseFormData): Partial<CloseFormData> {
    return {
      positionId: closeData.positionId,
      closeType: closeData.closeType,
      closePrice: closeData.closePrice,
      // センシティブデータは除外
    };
  }

  private sanitizeBatchData(batchData: BatchCloseInput): Partial<BatchCloseInput> {
    return {
      positionIds: batchData.positionIds,
      closeType: batchData.closeType,
      priority: batchData.priority,
    };
  }

  /**
   * メッセージ生成メソッド
   */
  private getCloseOperationMessage(
    operation: string,
    closeData: CloseFormData,
    result?: CloseResult,
    error?: CloseError
  ): string {
    switch (operation) {
      case "start":
        return `Close operation started for position ${closeData.positionId} (${closeData.closeType})`;
      case "success":
        return `Close operation completed successfully for position ${closeData.positionId}${result ? ` (Profit: ${result.profit})` : ''}`;
      case "failure":
        return `Close operation failed for position ${closeData.positionId}${error ? `: ${error.message}` : ''}`;
      default:
        return `Close operation ${operation} for position ${closeData.positionId}`;
    }
  }

  private getBatchCloseOperationMessage(
    operation: string,
    batchData: BatchCloseInput,
    result?: BatchCloseResult,
    progress?: { completed: number; total: number }
  ): string {
    const positionCount = batchData.positionIds.length;
    
    switch (operation) {
      case "start":
        return `Batch close operation started for ${positionCount} positions`;
      case "progress":
        return `Batch close progress: ${progress?.completed || 0}/${progress?.total || positionCount} completed`;
      case "success":
        return `Batch close completed - Success: ${result?.successful || 0}, Failed: ${result?.failed || 0}`;
      case "failure":
        return `Batch close operation failed for ${positionCount} positions`;
      default:
        return `Batch close operation ${operation} for ${positionCount} positions`;
    }
  }

  /**
   * ログ検索
   */
  searchLogs(filter: LogFilter): LogEntry[] {
    return this.logs.filter(entry => {
      if (filter.level !== undefined && entry.level < filter.level) return false;
      if (filter.category && entry.category !== filter.category) return false;
      if (filter.positionId && entry.positionId !== filter.positionId) return false;
      if (filter.userId && entry.userId !== filter.userId) return false;
      if (filter.sessionId && entry.sessionId !== filter.sessionId) return false;
      if (filter.correlationId && entry.correlationId !== filter.correlationId) return false;
      
      if (filter.timeRange) {
        const entryTime = entry.timestamp.getTime();
        if (entryTime < filter.timeRange.start.getTime() || 
            entryTime > filter.timeRange.end.getTime()) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * ログエクスポート
   */
  exportLogs(options: LogExportOptions): string {
    const filteredLogs = options.filter ? this.searchLogs(options.filter) : this.logs;
    const logsToExport = options.maxEntries ? 
      filteredLogs.slice(0, options.maxEntries) : filteredLogs;

    switch (options.format) {
      case "json":
        return JSON.stringify(logsToExport, null, 2);
      case "csv":
        return this.exportToCsv(logsToExport, options.includeMetadata);
      case "text":
        return this.exportToText(logsToExport);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * CSV形式でのエクスポート
   */
  private exportToCsv(logs: LogEntry[], includeMetadata: boolean): string {
    const headers = includeMetadata ?
      ["timestamp", "level", "category", "message", "positionId", "userId", "sessionId", "duration", "data"] :
      ["timestamp", "level", "category", "message"];

    const rows = logs.map(entry => {
      const basicData = [
        entry.timestamp.toISOString(),
        LogLevel[entry.level],
        entry.category,
        `"${entry.message.replace(/"/g, '""')}"`,
      ];

      if (includeMetadata) {
        basicData.push(
          entry.positionId || "",
          entry.userId || "",
          entry.sessionId || "",
          entry.performanceData?.duration?.toString() || "",
          entry.data ? `"${JSON.stringify(entry.data).replace(/"/g, '""')}"` : ""
        );
      }

      return basicData;
    });

    return [headers, ...rows].map(row => row.join(",")).join("\n");
  }

  /**
   * テキスト形式でのエクスポート
   */
  private exportToText(logs: LogEntry[]): string {
    return logs.map(entry => this.formatLogMessage(entry)).join("\n");
  }

  /**
   * ログ統計の取得
   */
  getLogStatistics(): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    logsByCategory: Record<string, number>;
    averageLogsPerMinute: number;
    sessionDuration: number;
  } {
    const logsByLevel: Record<string, number> = {};
    const logsByCategory: Record<string, number> = {};

    this.logs.forEach(entry => {
      const levelName = LogLevel[entry.level];
      logsByLevel[levelName] = (logsByLevel[levelName] || 0) + 1;
      logsByCategory[entry.category] = (logsByCategory[entry.category] || 0) + 1;
    });

    const sessionDuration = Date.now() - new Date(this.sessionId).getTime();
    const averageLogsPerMinute = this.logs.length / (sessionDuration / 60000);

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      logsByCategory,
      averageLogsPerMinute,
      sessionDuration,
    };
  }

  /**
   * ID生成メソッド
   */
  private generateLogId(): string {
    return `log-${++this.logCounter}-${Date.now()}`;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.info(LogCategory.SYSTEM, "Logger config updated", { config: this.config });
  }

  /**
   * ログのクリア
   */
  clearLogs(): void {
    const previousCount = this.logs.length;
    this.logs = [];
    this.info(LogCategory.SYSTEM, `Logs cleared (${previousCount} entries removed)`);
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.info(LogCategory.SYSTEM, "Logger disposing", { 
      totalLogs: this.logs.length,
      sessionDuration: Date.now() - new Date(this.sessionId).getTime(),
    });
    
    this.clearLogs();
    this.performanceTimers.clear();
  }
}

/**
 * ロガーのファクトリー関数
 */
export function createCloseLogger(config?: Partial<LoggerConfig>): CloseSystemLogger {
  return new CloseSystemLogger(config);
}