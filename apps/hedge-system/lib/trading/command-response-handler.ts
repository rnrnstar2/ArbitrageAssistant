import {
  WebSocketMessage,
  EntryResultMessage,
  CloseResultMessage,
  AckMessage,
  ErrorMessage,
  isEntryResultMessage,
  isCloseResultMessage,
  isAckMessage,
  isErrorMessage,
} from '../websocket/message-types';

export interface CommandResponse {
  commandId: string;
  status: 'success' | 'error' | 'timeout' | 'partial';
  result?: any;
  error?: string;
  executionTime?: number;
  timestamp: Date;
  messageType: string;
}

export interface ResponseMetrics {
  totalResponses: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  averageResponseTime: number;
  lastResponseTime?: Date;
}

export interface CommandResponseHandlerOptions {
  onCommandSuccess?: (response: CommandResponse) => Promise<void> | void;
  onCommandError?: (response: CommandResponse) => Promise<void> | void;
  onCommandTimeout?: (commandId: string) => Promise<void> | void;
  onPartialResponse?: (response: CommandResponse) => Promise<void> | void;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics?: boolean;
}

export class CommandResponseHandler {
  private options: CommandResponseHandlerOptions;
  private pendingCommands: Map<string, {
    commandType: string;
    sentAt: Date;
    timeoutId?: NodeJS.Timeout;
  }> = new Map();
  private metrics: ResponseMetrics = {
    totalResponses: 0,
    successCount: 0,
    errorCount: 0,
    timeoutCount: 0,
    averageResponseTime: 0,
  };
  private responseTimes: number[] = [];

  constructor(options: CommandResponseHandlerOptions = {}) {
    this.options = {
      logLevel: 'info',
      enableMetrics: true,
      ...options,
    };
  }

  /**
   * コマンドの追跡を開始
   */
  trackCommand(commandId: string, commandType: string, timeoutMs?: number): void {
    this.pendingCommands.set(commandId, {
      commandType,
      sentAt: new Date(),
      timeoutId: timeoutMs ? setTimeout(() => {
        this.handleTimeout(commandId);
      }, timeoutMs) : undefined,
    });

    this.log('debug', `Tracking command: ${commandId} (${commandType})`);
  }

  /**
   * WebSocketメッセージの処理
   */
  async handleMessage(message: WebSocketMessage): Promise<boolean> {
    try {
      if (isEntryResultMessage(message)) {
        await this.handleEntryResult(message);
        return true;
      } else if (isCloseResultMessage(message)) {
        await this.handleCloseResult(message);
        return true;
      } else if (isAckMessage(message)) {
        await this.handleAckMessage(message);
        return true;
      } else if (isErrorMessage(message)) {
        await this.handleErrorMessage(message);
        return true;
      }

      return false; // このハンドラーでは処理されなかった
    } catch (error) {
      this.log('error', `Error handling message: ${error}`);
      return false;
    }
  }

  /**
   * エントリー結果の処理
   */
  private async handleEntryResult(message: EntryResultMessage): Promise<void> {
    const { commandId, success, positionId, error, executedPrice, executedTime } = message.payload;
    
    const response: CommandResponse = {
      commandId,
      status: success ? 'success' : 'error',
      result: success ? {
        positionId,
        executedPrice,
        executedTime,
        accountId: message.payload.accountId,
        symbol: message.payload.symbol,
        direction: message.payload.direction,
        lotSize: message.payload.lotSize,
      } : undefined,
      error: success ? undefined : error,
      timestamp: new Date(),
      messageType: 'entry_result',
    };

    await this.processResponse(response);
  }

  /**
   * クローズ結果の処理
   */
  private async handleCloseResult(message: CloseResultMessage): Promise<void> {
    const { commandId, success, positionId, error, executedPrice, executedTime } = message.payload;
    
    const response: CommandResponse = {
      commandId,
      status: success ? 'success' : 'error',
      result: success ? {
        positionId,
        executedPrice,
        executedTime,
        actualClosedVolume: message.payload.actualClosedVolume,
        remainingVolume: message.payload.remainingVolume,
        profit: message.payload.profit,
        accountId: message.payload.accountId,
        symbol: message.payload.symbol,
      } : undefined,
      error: success ? undefined : error,
      timestamp: new Date(),
      messageType: 'close_result',
    };

    // 部分決済の場合
    if (success && message.payload.remainingVolume && message.payload.remainingVolume > 0) {
      response.status = 'partial';
    }

    await this.processResponse(response);
  }

  /**
   * ACK メッセージの処理
   */
  private async handleAckMessage(message: AckMessage): Promise<void> {
    const { messageId, success, error } = message.payload;
    
    const response: CommandResponse = {
      commandId: messageId,
      status: success ? 'success' : 'error',
      error: success ? undefined : error,
      timestamp: new Date(),
      messageType: 'ack',
    };

    await this.processResponse(response);
  }

  /**
   * エラーメッセージの処理
   */
  private async handleErrorMessage(message: ErrorMessage): Promise<void> {
    const { code, message: errorMessage, details } = message.payload;
    
    // エラーメッセージからコマンドIDを抽出（可能であれば）
    let commandId = 'unknown';
    if (details && typeof details === 'object' && 'commandId' in details) {
      commandId = (details as any).commandId;
    }

    const response: CommandResponse = {
      commandId,
      status: 'error',
      error: `${code}: ${errorMessage}`,
      timestamp: new Date(),
      messageType: 'error',
    };

    await this.processResponse(response);
  }

  /**
   * レスポンスの共通処理
   */
  private async processResponse(response: CommandResponse): Promise<void> {
    const pendingCommand = this.pendingCommands.get(response.commandId);
    
    if (pendingCommand) {
      // 実行時間の計算
      response.executionTime = Date.now() - pendingCommand.sentAt.getTime();
      
      // タイムアウトタイマーのクリア
      if (pendingCommand.timeoutId) {
        clearTimeout(pendingCommand.timeoutId);
      }
      
      // ペンディングリストから削除（部分決済の場合は削除しない）
      if (response.status !== 'partial') {
        this.pendingCommands.delete(response.commandId);
      }
    }

    // メトリクスの更新
    if (this.options.enableMetrics) {
      this.updateMetrics(response);
    }

    // ログ出力
    this.logResponse(response);

    // コールバック実行
    try {
      switch (response.status) {
        case 'success':
          if (this.options.onCommandSuccess) {
            await this.options.onCommandSuccess(response);
          }
          break;
        case 'error':
          if (this.options.onCommandError) {
            await this.options.onCommandError(response);
          }
          break;
        case 'partial':
          if (this.options.onPartialResponse) {
            await this.options.onPartialResponse(response);
          }
          break;
      }
    } catch (error) {
      this.log('error', `Error in response callback: ${error}`);
    }
  }

  /**
   * タイムアウトの処理
   */
  private async handleTimeout(commandId: string): Promise<void> {
    const pendingCommand = this.pendingCommands.get(commandId);
    
    if (pendingCommand) {
      this.pendingCommands.delete(commandId);
      
      this.log('warn', `Command timeout: ${commandId} (${pendingCommand.commandType})`);
      
      if (this.options.enableMetrics) {
        this.metrics.timeoutCount++;
        this.metrics.totalResponses++;
      }

      if (this.options.onCommandTimeout) {
        try {
          await this.options.onCommandTimeout(commandId);
        } catch (error) {
          this.log('error', `Error in timeout callback: ${error}`);
        }
      }
    }
  }

  /**
   * メトリクスの更新
   */
  private updateMetrics(response: CommandResponse): void {
    this.metrics.totalResponses++;
    this.metrics.lastResponseTime = response.timestamp;

    switch (response.status) {
      case 'success':
      case 'partial':
        this.metrics.successCount++;
        break;
      case 'error':
        this.metrics.errorCount++;
        break;
    }

    // レスポンス時間の追跡
    if (response.executionTime !== undefined) {
      this.responseTimes.push(response.executionTime);
      
      // 最新100件の平均を計算
      if (this.responseTimes.length > 100) {
        this.responseTimes = this.responseTimes.slice(-100);
      }
      
      this.metrics.averageResponseTime = 
        this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    }
  }

  /**
   * レスポンスのログ出力
   */
  private logResponse(response: CommandResponse): void {
    const { commandId, status, executionTime, error, messageType } = response;
    
    let logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
    let message = `Command ${commandId} (${messageType}): ${status}`;
    
    if (executionTime !== undefined) {
      message += ` in ${executionTime}ms`;
    }
    
    if (status === 'error') {
      logLevel = 'error';
      message += ` - ${error}`;
    } else if (status === 'partial') {
      logLevel = 'warn';
      message += ' (partial)';
    }

    this.log(logLevel, message);
  }

  /**
   * ログ出力
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const shouldLog = this.shouldLog(level);
    
    if (shouldLog) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [CommandResponseHandler] ${message}`;
      
      switch (level) {
        case 'debug':
          console.debug(logMessage);
          break;
        case 'info':
          console.info(logMessage);
          break;
        case 'warn':
          console.warn(logMessage);
          break;
        case 'error':
          console.error(logMessage);
          break;
      }
    }
  }

  /**
   * ログレベルチェック
   */
  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.options.logLevel || 'info');
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * ペンディングコマンドの取得
   */
  getPendingCommands(): Array<{ commandId: string; commandType: string; sentAt: Date }> {
    return Array.from(this.pendingCommands.entries()).map(([commandId, command]) => ({
      commandId,
      commandType: command.commandType,
      sentAt: command.sentAt,
    }));
  }

  /**
   * メトリクスの取得
   */
  getMetrics(): ResponseMetrics {
    return { ...this.metrics };
  }

  /**
   * メトリクスのリセット
   */
  resetMetrics(): void {
    this.metrics = {
      totalResponses: 0,
      successCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      averageResponseTime: 0,
    };
    this.responseTimes = [];
  }

  /**
   * 特定のコマンドの追跡を停止
   */
  stopTracking(commandId: string): boolean {
    const pendingCommand = this.pendingCommands.get(commandId);
    
    if (pendingCommand) {
      if (pendingCommand.timeoutId) {
        clearTimeout(pendingCommand.timeoutId);
      }
      this.pendingCommands.delete(commandId);
      this.log('debug', `Stopped tracking command: ${commandId}`);
      return true;
    }
    
    return false;
  }

  /**
   * 全てのペンディングコマンドの追跡を停止
   */
  stopAllTracking(): void {
    for (const [commandId, command] of this.pendingCommands.entries()) {
      if (command.timeoutId) {
        clearTimeout(command.timeoutId);
      }
    }
    
    this.pendingCommands.clear();
    this.log('info', 'Stopped tracking all commands');
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.stopAllTracking();
    this.resetMetrics();
  }
}