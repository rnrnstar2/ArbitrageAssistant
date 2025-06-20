import { EventEmitter } from 'events';
import {
  type EAMessage,
  type PositionUpdateData,
  type BaseMessage,
  PositionUpdateDataSchema,
  isEAMessage,
  createMessageId,
} from './message-types';

/**
 * ポジション受信処理の設定
 */
export interface PositionReceiverConfig {
  enableValidation?: boolean;
  enableMetrics?: boolean;
  enablePersistence?: boolean;
  maxBufferSize?: number;
  processingTimeout?: number;
  retryAttempts?: number;
  debounceInterval?: number;
  throttleInterval?: number;
  enableCalculations?: boolean;
}

/**
 * ポジション処理統計
 */
export interface PositionStats {
  totalReceived: number;
  successfullyProcessed: number;
  validationFailures: number;
  processingErrors: number;
  averageProcessingTime: number;
  lastReceivedTimestamp?: number;
  bufferSize: number;
  throttledMessages: number;
  calculationErrors: number;
}

/**
 * システム形式のポジション情報
 */
export interface SystemPosition {
  id: string;
  accountId: string;
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  profitRate: number;        // 利益率
  swapPoints: number;
  commission: number;
  marginUsed: number;        // 証拠金使用額
  marginRate: number;        // 証拠金使用率
  status: 'open' | 'closed' | 'pending';
  openTime: Date;
  closeTime?: Date;
  lastUpdate: Date;
  rawData: PositionUpdateData; // 元データを保持
}

/**
 * 処理中のポジション情報
 */
interface ProcessingPosition {
  positionId: string;
  data: PositionUpdateData;
  timestamp: number;
  messageId: string;
  retryCount: number;
  processingStartTime: number;
}

/**
 * ポジション受信エラー
 */
export interface PositionError {
  positionId: string;
  messageId: string;
  error: string;
  timestamp: number;
  originalMessage?: any;
  validationErrors?: string[];
  errorType: 'validation' | 'processing' | 'calculation' | 'network';
}

/**
 * EAからのポジション情報受信処理を管理するクラス
 */
export class PositionDataReceiver extends EventEmitter {
  private config: Required<PositionReceiverConfig>;
  private stats: PositionStats;
  private processingBuffer: Map<string, ProcessingPosition> = new Map();
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastProcessedData: Map<string, SystemPosition> = new Map();
  private errors: PositionError[] = [];
  private processingTimes: number[] = [];

  constructor(config: PositionReceiverConfig = {}) {
    super();
    
    this.config = {
      enableValidation: true,
      enableMetrics: true,
      enablePersistence: false,
      maxBufferSize: 1000,
      processingTimeout: 5000,
      retryAttempts: 3,
      debounceInterval: 100,
      throttleInterval: 50,
      enableCalculations: true,
      ...config,
    };

    this.stats = {
      totalReceived: 0,
      successfullyProcessed: 0,
      validationFailures: 0,
      processingErrors: 0,
      averageProcessingTime: 0,
      bufferSize: 0,
      throttledMessages: 0,
      calculationErrors: 0,
    };

    // 定期的なバッファークリーンアップ
    setInterval(() => this.cleanupProcessingBuffer(), 60000);
  }

  /**
   * メインメッセージ処理エントリーポイント
   */
  async processMessage(message: BaseMessage): Promise<void> {
    if (!isEAMessage(message) || message.type !== 'position_update') {
      return;
    }

    this.stats.totalReceived++;
    this.stats.lastReceivedTimestamp = Date.now();

    const messageId = (message as any).messageId || createMessageId();

    try {
      const positionData = message.data as PositionUpdateData;
      
      // バリデーション
      if (this.config.enableValidation) {
        const validation = PositionUpdateDataSchema.safeParse(positionData);
        if (!validation.success) {
          await this.handleValidationError(messageId, validation.error.errors);
          return;
        }
      }

      // スロットリング処理
      if (this.config.throttleInterval > 0) {
        await this.throttlePositionUpdate(positionData, messageId);
      } else {
        await this.processPositionUpdate(positionData, messageId);
      }
    } catch (error) {
      await this.handleProcessingError(messageId, error as Error);
    }
  }

  /**
   * ポジション更新のスロットリング処理
   */
  private async throttlePositionUpdate(data: PositionUpdateData, messageId: string): Promise<void> {
    const positionId = data.positionId;

    // 既存のタイマーをクリア
    if (this.throttleTimers.has(positionId)) {
      clearTimeout(this.throttleTimers.get(positionId)!);
      this.stats.throttledMessages++;
    }

    // 新しいタイマーを設定
    const timer = setTimeout(async () => {
      await this.processPositionUpdate(data, messageId);
      this.throttleTimers.delete(positionId);
    }, this.config.throttleInterval);

    this.throttleTimers.set(positionId, timer);
  }

  /**
   * ポジション更新の実際の処理
   */
  private async processPositionUpdate(data: PositionUpdateData, messageId: string): Promise<void> {
    const processingStartTime = Date.now();
    const processingItem: ProcessingPosition = {
      positionId: data.positionId,
      data,
      timestamp: Date.now(),
      messageId,
      retryCount: 0,
      processingStartTime,
    };

    try {
      // バッファーに追加
      this.processingBuffer.set(data.positionId, processingItem);
      this.updateBufferStats();

      // システム形式に変換
      const systemPosition = await this.convertToSystemFormat(data);

      // 前回のデータと比較（重複チェック）
      if (this.isDuplicateUpdate(systemPosition)) {
        this.processingBuffer.delete(data.positionId);
        return;
      }

      // 状態管理の更新
      await this.updatePositionState(systemPosition);

      // GraphQL Subscriptionで通知
      await this.notifyPositionUpdate(systemPosition);

      // 最新データとして保存
      this.lastProcessedData.set(data.positionId, systemPosition);

      // 統計の更新
      this.stats.successfullyProcessed++;
      this.updateProcessingTime(Date.now() - processingStartTime);

      // イベント発火
      this.emit('position_updated', systemPosition);

    } catch (error) {
      await this.handleProcessingError(messageId, error as Error, data.positionId);
    } finally {
      this.processingBuffer.delete(data.positionId);
      this.updateBufferStats();
    }
  }

  /**
   * EA形式からシステム形式への変換
   */
  private async convertToSystemFormat(data: PositionUpdateData): Promise<SystemPosition> {
    try {
      const systemPosition: SystemPosition = {
        id: data.positionId,
        accountId: 'unknown', // PositionUpdateDataにaccountIdが含まれていない場合のデフォルト値
        symbol: data.symbol,
        type: data.type,
        lots: data.lots,
        openPrice: data.openPrice,
        currentPrice: data.currentPrice,
        profit: data.profit,
        profitRate: this.calculateProfitRate(data.profit, data.lots, data.openPrice),
        swapPoints: data.swapPoints || 0,
        commission: data.commission || 0,
        marginUsed: this.calculateMarginUsed(data.lots, data.openPrice, data.symbol),
        marginRate: 0, // アカウント情報が必要なため後で計算
        status: data.status,
        openTime: new Date(data.openTime),
        closeTime: data.closeTime ? new Date(data.closeTime) : undefined,
        lastUpdate: new Date(),
        rawData: data,
      };

      return systemPosition;
    } catch (error) {
      this.stats.calculationErrors++;
      throw new Error(`Position conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 利益率の計算
   */
  private calculateProfitRate(profit: number, lots: number, openPrice: number): number {
    if (lots === 0 || openPrice === 0) return 0;
    const investment = lots * openPrice * 100000; // 標準的なロット計算
    return investment > 0 ? (profit / investment) * 100 : 0;
  }

  /**
   * 証拠金使用額の計算
   */
  private calculateMarginUsed(lots: number, price: number, symbol: string): number {
    // シンボルに応じたレバレッジ設定が必要
    // ここでは仮で100倍レバレッジとして計算
    const leverage = 100;
    const contractSize = 100000; // 1ロット = 10万通貨
    return (lots * price * contractSize) / leverage;
  }

  /**
   * ポジション状態のマッピング
   */
  private mapPositionStatus(status: string): 'open' | 'closed' | 'pending' {
    return status as 'open' | 'closed' | 'pending';
  }

  /**
   * 重複更新のチェック
   */
  private isDuplicateUpdate(systemPosition: SystemPosition): boolean {
    const lastData = this.lastProcessedData.get(systemPosition.id);
    if (!lastData) return false;

    // 重要フィールドが同じかチェック
    return (
      lastData.currentPrice === systemPosition.currentPrice &&
      lastData.profit === systemPosition.profit &&
      lastData.status === systemPosition.status
    );
  }

  /**
   * 状態管理の更新（実装時に具体的な状態管理ライブラリと連携）
   */
  private async updatePositionState(position: SystemPosition): Promise<void> {
    // TODO: Redux/Zustand等の状態管理と連携
    this.emit('state_update_required', position);
  }

  /**
   * GraphQL Subscriptionでの通知
   */
  private async notifyPositionUpdate(position: SystemPosition): Promise<void> {
    // TODO: GraphQL Subscriptionとの連携
    this.emit('graphql_notification_required', position);
  }

  /**
   * バリデーションエラーの処理
   */
  private async handleValidationError(messageId: string, errors: any[]): Promise<void> {
    this.stats.validationFailures++;
    
    const error: PositionError = {
      positionId: 'unknown',
      messageId,
      error: 'Validation failed',
      timestamp: Date.now(),
      validationErrors: errors.map(e => e.message),
      errorType: 'validation',
    };

    this.errors.push(error);
    this.emit('error', error);
  }

  /**
   * 処理エラーの処理
   */
  private async handleProcessingError(messageId: string, error: Error, positionId?: string): Promise<void> {
    this.stats.processingErrors++;

    const errorInfo: PositionError = {
      positionId: positionId || 'unknown',
      messageId,
      error: error.message,
      timestamp: Date.now(),
      errorType: 'processing',
    };

    this.errors.push(errorInfo);
    this.emit('error', errorInfo);

    // リトライ処理
    if (positionId) {
      const processingItem = this.processingBuffer.get(positionId);
      if (processingItem && processingItem.retryCount < this.config.retryAttempts) {
        processingItem.retryCount++;
        setTimeout(() => {
          this.processPositionUpdate(processingItem.data, processingItem.messageId);
        }, 1000 * Math.pow(2, processingItem.retryCount)); // 指数バックオフ
      }
    }
  }

  /**
   * 処理時間の統計更新
   */
  private updateProcessingTime(processingTime: number): void {
    this.processingTimes.push(processingTime);
    
    // 直近100件の平均を保持
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }

    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }

  /**
   * バッファー統計の更新
   */
  private updateBufferStats(): void {
    this.stats.bufferSize = this.processingBuffer.size;
  }

  /**
   * 処理バッファーのクリーンアップ
   */
  private cleanupProcessingBuffer(): void {
    const now = Date.now();
    const timeout = this.config.processingTimeout;
    const entriesToDelete: string[] = [];

    this.processingBuffer.forEach((item, positionId) => {
      if (now - item.processingStartTime > timeout) {
        entriesToDelete.push(positionId);
        this.handleProcessingError(
          item.messageId,
          new Error('Processing timeout'),
          positionId
        );
      }
    });

    entriesToDelete.forEach(positionId => {
      this.processingBuffer.delete(positionId);
    });

    this.updateBufferStats();
  }

  /**
   * 統計情報の取得
   */
  getStats(): PositionStats {
    return { ...this.stats };
  }

  /**
   * エラー履歴の取得
   */
  getErrors(limit: number = 100): PositionError[] {
    return this.errors.slice(-limit);
  }

  /**
   * 現在の処理中ポジション数
   */
  getProcessingCount(): number {
    return this.processingBuffer.size;
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: Partial<PositionReceiverConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * リソースのクリーンアップ
   */
  destroy(): void {
    // タイマーをクリア
    this.throttleTimers.forEach(timer => clearTimeout(timer));
    this.throttleTimers.clear();

    // バッファーをクリア
    this.processingBuffer.clear();
    this.lastProcessedData.clear();

    // イベントリスナーを削除
    this.removeAllListeners();
  }
}

/**
 * グローバルインスタンス（シングルトン）
 */
export const positionDataReceiver = new PositionDataReceiver();