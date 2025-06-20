import { EventEmitter } from 'events';
import {
  EAMessage,
  AccountInfoData,
  BaseMessage,
  AccountInfoDataSchema,
  isEAMessage,
  parseEAMessage,
  safeParseEAMessage,
  createMessageId,
} from './message-types';

/**
 * アカウント情報受信処理の設定
 */
export interface AccountInfoReceiverConfig {
  enableValidation?: boolean;
  enableMetrics?: boolean;
  enablePersistence?: boolean;
  maxBufferSize?: number;
  processingTimeout?: number;
  retryAttempts?: number;
  debounceInterval?: number;
}

/**
 * アカウント情報処理統計
 */
export interface AccountInfoStats {
  totalReceived: number;
  successfullyProcessed: number;
  validationFailures: number;
  processingErrors: number;
  averageProcessingTime: number;
  lastReceivedTimestamp?: number;
  bufferSize: number;
}

/**
 * 処理中のアカウント情報
 */
interface ProcessingAccountInfo {
  accountId: string;
  data: AccountInfoData;
  timestamp: number;
  messageId: string;
  retryCount: number;
}

/**
 * アカウント情報受信エラー
 */
export interface AccountInfoError {
  accountId: string;
  messageId: string;
  error: string;
  timestamp: number;
  originalMessage?: any;
  validationErrors?: string[];
}

/**
 * EAからのアカウント情報受信処理を管理するクラス
 */
export class AccountInfoReceiver extends EventEmitter {
  private config: Required<AccountInfoReceiverConfig>;
  private stats: AccountInfoStats;
  private processingBuffer: Map<string, ProcessingAccountInfo> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastProcessedData: Map<string, AccountInfoData> = new Map();
  private errors: AccountInfoError[] = [];

  constructor(config: AccountInfoReceiverConfig = {}) {
    super();
    
    this.config = {
      enableValidation: true,
      enableMetrics: true,
      enablePersistence: false,
      maxBufferSize: 1000,
      processingTimeout: 5000,
      retryAttempts: 3,
      debounceInterval: 100,
      ...config,
    };

    this.stats = {
      totalReceived: 0,
      successfullyProcessed: 0,
      validationFailures: 0,
      processingErrors: 0,
      averageProcessingTime: 0,
      bufferSize: 0,
    };
  }

  /**
   * WebSocketメッセージからアカウント情報を処理
   */
  async handleMessage(message: any): Promise<void> {
    const startTime = Date.now();
    this.stats.totalReceived++;

    try {
      // 基本メッセージ形式の検証
      if (!this.isValidBaseMessage(message)) {
        throw new Error('Invalid base message format');
      }

      // EAメッセージの検証
      if (!isEAMessage(message)) {
        return; // アカウント情報以外のメッセージは無視
      }

      // アカウント情報メッセージかチェック
      if (message.type !== 'account_update') {
        return; // アカウント情報以外のメッセージは無視
      }

      // メッセージの安全な解析
      const parseResult = safeParseEAMessage(message);
      if (!parseResult.success) {
        this.recordValidationError(message.accountId || 'unknown', message.messageId || createMessageId(), 
          `Message parsing failed: ${parseResult.error}`, message);
        return;
      }

      const eaMessage = parseResult.data;
      await this.processAccountInfoMessage(eaMessage);

    } catch (error) {
      this.recordProcessingError(
        message.accountId || 'unknown',
        message.messageId || createMessageId(),
        error instanceof Error ? error.message : 'Unknown error',
        message
      );
    } finally {
      // パフォーマンス統計の更新
      if (this.config.enableMetrics) {
        this.updatePerformanceStats(Date.now() - startTime);
      }
    }
  }

  /**
   * アカウント情報メッセージを処理
   */
  private async processAccountInfoMessage(message: EAMessage): Promise<void> {
    const { accountId, messageId, data } = message;

    if (message.type !== 'account_update') {
      return;
    }

    try {
      // データの検証
      if (this.config.enableValidation) {
        const validationResult = this.validateAccountInfoData(data as AccountInfoData);
        if (!validationResult.isValid) {
          this.recordValidationError(accountId, messageId, 
            'Account info validation failed', message, validationResult.errors);
          return;
        }
      }

      const accountData = data as AccountInfoData;

      // 重複データのチェック
      if (this.isDuplicateData(accountId, accountData)) {
        this.emit('duplicate_data_ignored', accountId, accountData);
        return;
      }

      // デバウンス処理
      if (this.config.debounceInterval > 0) {
        this.debounceProcessing(accountId, messageId, accountData);
      } else {
        await this.processAccountInfo(accountId, messageId, accountData);
      }

    } catch (error) {
      this.recordProcessingError(accountId, messageId, 
        error instanceof Error ? error.message : 'Processing failed', message);
    }
  }

  /**
   * デバウンス処理
   */
  private debounceProcessing(accountId: string, messageId: string, data: AccountInfoData): void {
    // 既存のタイマーをクリア
    const existingTimer = this.debounceTimers.get(accountId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 新しいタイマーを設定
    const timer = setTimeout(async () => {
      await this.processAccountInfo(accountId, messageId, data);
      this.debounceTimers.delete(accountId);
    }, this.config.debounceInterval);

    this.debounceTimers.set(accountId, timer);
  }

  /**
   * アカウント情報を実際に処理
   */
  private async processAccountInfo(accountId: string, messageId: string, data: AccountInfoData): Promise<void> {
    try {
      // 処理済みデータとして記録
      this.lastProcessedData.set(accountId, data);
      
      // 統計更新
      this.stats.successfullyProcessed++;
      this.stats.lastReceivedTimestamp = Date.now();

      // アカウント情報更新イベントを発行
      this.emit('account_info_received', {
        accountId,
        messageId,
        data,
        timestamp: Date.now(),
      });

      // データ永続化（有効な場合）
      if (this.config.enablePersistence) {
        this.emit('persist_account_info', accountId, data);
      }

      // 残高関連の重要な変更を通知
      this.checkCriticalChanges(accountId, data);

    } catch (error) {
      this.recordProcessingError(accountId, messageId, 
        error instanceof Error ? error.message : 'Processing failed');
    }
  }

  /**
   * アカウント情報データの検証
   */
  private validateAccountInfoData(data: any): { isValid: boolean; errors?: string[] } {
    try {
      AccountInfoDataSchema.parse(data);
      return { isValid: true };
    } catch (error: any) {
      const errors = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || [error.message];
      return { isValid: false, errors };
    }
  }

  /**
   * 重複データのチェック
   */
  private isDuplicateData(accountId: string, newData: AccountInfoData): boolean {
    const lastData = this.lastProcessedData.get(accountId);
    if (!lastData) {
      return false;
    }

    // 主要な値が同じかチェック
    return (
      lastData.balance === newData.balance &&
      lastData.equity === newData.equity &&
      lastData.freeMargin === newData.freeMargin &&
      lastData.marginLevel === newData.marginLevel &&
      lastData.bonusAmount === newData.bonusAmount
    );
  }

  /**
   * 重要な変更をチェック
   */
  private checkCriticalChanges(accountId: string, data: AccountInfoData): void {
    const lastData = this.lastProcessedData.get(accountId);
    if (!lastData) {
      return;
    }

    // 証拠金維持率の大幅な変化
    if (Math.abs(data.marginLevel - lastData.marginLevel) > 50) {
      this.emit('margin_level_change', {
        accountId,
        previousLevel: lastData.marginLevel,
        currentLevel: data.marginLevel,
        data,
      });
    }

    // ボーナス額の変化
    if (data.bonusAmount !== lastData.bonusAmount) {
      this.emit('bonus_amount_change', {
        accountId,
        previousAmount: lastData.bonusAmount,
        currentAmount: data.bonusAmount,
        data,
      });
    }

    // 残高の大幅な変化（10%以上）
    const balanceChangePercent = Math.abs((data.balance - lastData.balance) / lastData.balance) * 100;
    if (balanceChangePercent > 10) {
      this.emit('significant_balance_change', {
        accountId,
        previousBalance: lastData.balance,
        currentBalance: data.balance,
        changePercent: balanceChangePercent,
        data,
      });
    }
  }

  /**
   * 基本メッセージ形式の検証
   */
  private isValidBaseMessage(message: any): message is BaseMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.version === 'string' &&
      typeof message.type === 'string' &&
      typeof message.timestamp === 'number' &&
      typeof message.messageId === 'string' &&
      typeof message.accountId === 'string'
    );
  }

  /**
   * 検証エラーを記録
   */
  private recordValidationError(
    accountId: string,
    messageId: string,
    error: string,
    originalMessage?: any,
    validationErrors?: string[]
  ): void {
    const errorRecord: AccountInfoError = {
      accountId,
      messageId,
      error,
      timestamp: Date.now(),
      originalMessage,
      validationErrors,
    };

    this.errors.push(errorRecord);
    this.stats.validationFailures++;

    // エラー履歴を制限
    if (this.errors.length > 1000) {
      this.errors.splice(0, this.errors.length - 1000);
    }

    this.emit('validation_error', errorRecord);
  }

  /**
   * 処理エラーを記録
   */
  private recordProcessingError(
    accountId: string,
    messageId: string,
    error: string,
    originalMessage?: any
  ): void {
    const errorRecord: AccountInfoError = {
      accountId,
      messageId,
      error,
      timestamp: Date.now(),
      originalMessage,
    };

    this.errors.push(errorRecord);
    this.stats.processingErrors++;

    // エラー履歴を制限
    if (this.errors.length > 1000) {
      this.errors.splice(0, this.errors.length - 1000);
    }

    this.emit('processing_error', errorRecord);
  }

  /**
   * パフォーマンス統計の更新
   */
  private updatePerformanceStats(processingTime: number): void {
    const currentAvg = this.stats.averageProcessingTime;
    const processedCount = this.stats.successfullyProcessed || 1;
    
    this.stats.averageProcessingTime = (currentAvg * (processedCount - 1) + processingTime) / processedCount;
    this.stats.bufferSize = this.processingBuffer.size;
  }

  /**
   * 統計情報を取得
   */
  getStats(): AccountInfoStats {
    return { ...this.stats };
  }

  /**
   * エラー履歴を取得
   */
  getErrors(): AccountInfoError[] {
    return [...this.errors];
  }

  /**
   * 最後に処理されたアカウント情報を取得
   */
  getLastProcessedData(accountId: string): AccountInfoData | undefined {
    return this.lastProcessedData.get(accountId);
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<AccountInfoReceiverConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config_updated', this.config);
  }

  /**
   * 統計をリセット
   */
  resetStats(): void {
    this.stats = {
      totalReceived: 0,
      successfullyProcessed: 0,
      validationFailures: 0,
      processingErrors: 0,
      averageProcessingTime: 0,
      bufferSize: 0,
    };
    this.emit('stats_reset');
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    // 全デバウンスタイマーをクリア
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // データをクリア
    this.processingBuffer.clear();
    this.lastProcessedData.clear();
    this.errors.length = 0;

    // イベントリスナーを削除
    this.removeAllListeners();
  }
}

/**
 * デフォルトのアカウント情報受信処理インスタンス
 */
export const accountInfoReceiver = new AccountInfoReceiver();