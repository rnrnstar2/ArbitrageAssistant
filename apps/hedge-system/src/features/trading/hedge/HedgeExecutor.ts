import { v4 as uuidv4 } from 'uuid';
import { WebSocketEntryService, EntryCommandResult } from '../websocket-entry';
import { HedgePositionDetector, HedgePosition, PotentialHedge } from './HedgePositionDetector';
import { PositionRelationManager } from './PositionRelationManager';
import { HedgePositionValidator } from './HedgePositionValidator';
import { 
  EntryCommand,
  Position,
  WebSocketClient 
} from '../../../../lib/websocket/message-types';

/**
 * 両建て実行条件
 */
export interface HedgeExecutionCriteria {
  symbol: string;
  hedgeType: 'perfect' | 'partial' | 'cross_account';
  accounts: string[];
  lotSizes: {
    buy: number;
    sell: number;
  };
  executionMode: 'simultaneous' | 'sequential';
  timing: {
    maxDelay: number; // ミリ秒
    sequentialDelay?: number; // 順次実行時の遅延（ミリ秒）
  };
  priceSettings: {
    orderType: 'market' | 'limit';
    buyPrice?: number;
    sellPrice?: number;
    maxSlippage?: number; // pips
  };
  riskManagement: {
    stopLoss?: number;
    takeProfit?: number;
    trailStop?: {
      distance: number; // pips
      step: number; // pips
    };
  };
}

/**
 * 両建て実行結果
 */
export interface HedgeResult {
  executionId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'partial';
  hedgePosition?: HedgePosition;
  results: {
    buy?: EntryCommandResult;
    sell?: EntryCommandResult;
  };
  error?: string;
  executedAt?: Date;
  completedAt?: Date;
  rollbackRequired: boolean;
}

/**
 * 実行状態
 */
export interface ExecutionStatus {
  executionId: string;
  status: HedgeResult['status'];
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  startTime: Date;
  lastUpdate: Date;
  estimatedCompletion?: Date;
}

/**
 * 実行キューアイテム
 */
interface QueuedExecution {
  id: string;
  criteria: HedgeExecutionCriteria;
  priority: number;
  queuedAt: Date;
  attempts: number;
  maxAttempts: number;
}

/**
 * 両建て実行エンジン
 */
export class HedgeExecutor {
  private wsClient: WebSocketClient;
  private entryService: WebSocketEntryService;
  private detector: HedgePositionDetector;
  private relationManager: PositionRelationManager;
  private validator: HedgePositionValidator;
  
  private activeExecutions = new Map<string, HedgeResult>();
  private executionQueue: QueuedExecution[] = [];
  private maxConcurrentExecutions = 3;
  private currentExecutions = 0;
  
  private executionTimeouts = new Map<string, NodeJS.Timeout>();
  private defaultTimeout = 30000; // 30秒

  constructor(
    wsClient: WebSocketClient,
    detector: HedgePositionDetector,
    relationManager: PositionRelationManager,
    validator: HedgePositionValidator
  ) {
    this.wsClient = wsClient;
    this.entryService = new WebSocketEntryService(wsClient);
    this.detector = detector;
    this.relationManager = relationManager;
    this.validator = validator;
  }

  /**
   * 両建てを実行
   */
  async executeHedge(criteria: HedgeExecutionCriteria): Promise<HedgeResult> {
    const executionId = this.generateExecutionId();
    
    // 実行前バリデーション
    const validation = this.validateExecutionCriteria(criteria);
    if (!validation.isValid) {
      const result: HedgeResult = {
        executionId,
        status: 'failed',
        results: {},
        error: `Validation failed: ${validation.issues.map(i => i.description).join(', ')}`,
        rollbackRequired: false
      };
      this.activeExecutions.set(executionId, result);
      return result;
    }

    // 実行制限チェック
    if (this.currentExecutions >= this.maxConcurrentExecutions) {
      return this.queueExecution(criteria);
    }

    return this.executeHedgeInternal(executionId, criteria);
  }

  /**
   * 部分両建てを実行
   */
  async executePartialHedge(position: Position, ratio: number): Promise<HedgeResult> {
    if (ratio <= 0 || ratio > 1) {
      throw new Error('Ratio must be between 0 and 1');
    }

    const oppositeType = position.type === 'buy' ? 'sell' : 'buy';
    const hedgeLotSize = position.lots * ratio;

    const criteria: HedgeExecutionCriteria = {
      symbol: position.symbol,
      hedgeType: 'partial',
      accounts: [position.accountId],
      lotSizes: {
        buy: position.type === 'buy' ? position.lots : hedgeLotSize,
        sell: position.type === 'sell' ? position.lots : hedgeLotSize
      },
      executionMode: 'sequential',
      timing: {
        maxDelay: 5000,
        sequentialDelay: 1000
      },
      priceSettings: {
        orderType: 'market'
      },
      riskManagement: {}
    };

    return this.executeHedge(criteria);
  }

  /**
   * 両建て実行をキャンセル
   */
  async cancelHedgeExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status === 'completed' || execution.status === 'failed') {
      throw new Error(`Cannot cancel execution in status: ${execution.status}`);
    }

    // タイムアウトをクリア
    const timeout = this.executionTimeouts.get(executionId);
    if (timeout) {
      clearTimeout(timeout);
      this.executionTimeouts.delete(executionId);
    }

    // キューから削除
    this.executionQueue = this.executionQueue.filter(q => q.id !== executionId);

    // アクティブ実行をキャンセル済みに更新
    execution.status = 'failed';
    execution.error = 'Execution cancelled by user';
    execution.completedAt = new Date();
    
    // 部分実行がある場合はロールバックを検討
    if (execution.results.buy?.success || execution.results.sell?.success) {
      execution.rollbackRequired = true;
    }

    this.currentExecutions = Math.max(0, this.currentExecutions - 1);
  }

  /**
   * 実行状態を取得
   */
  getExecutionStatus(executionId: string): ExecutionStatus | null {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return null;
    }

    const completedCount = Object.values(execution.results).filter(r => r?.success).length;
    const failedCount = Object.values(execution.results).filter(r => r && !r.success).length;
    const totalCount = Object.keys(execution.results).length || 2; // buy + sell

    return {
      executionId,
      status: execution.status,
      progress: {
        total: totalCount,
        completed: completedCount,
        failed: failedCount
      },
      startTime: execution.executedAt || new Date(),
      lastUpdate: new Date(),
      estimatedCompletion: this.estimateCompletion(execution)
    };
  }

  /**
   * アクティブな実行一覧を取得
   */
  getActiveExecutions(): HedgeResult[] {
    return Array.from(this.activeExecutions.values())
      .filter(e => e.status === 'pending' || e.status === 'executing');
  }

  /**
   * 実行キューの状態を取得
   */
  getExecutionQueue(): QueuedExecution[] {
    return [...this.executionQueue];
  }

  /**
   * 内部的な両建て実行
   */
  private async executeHedgeInternal(executionId: string, criteria: HedgeExecutionCriteria): Promise<HedgeResult> {
    this.currentExecutions++;
    
    const result: HedgeResult = {
      executionId,
      status: 'executing',
      results: {},
      rollbackRequired: false,
      executedAt: new Date()
    };
    
    this.activeExecutions.set(executionId, result);

    // タイムアウト設定
    const timeout = setTimeout(() => {
      this.handleExecutionTimeout(executionId);
    }, this.defaultTimeout);
    this.executionTimeouts.set(executionId, timeout);

    try {
      if (criteria.executionMode === 'simultaneous') {
        await this.executeSimultaneous(executionId, criteria, result);
      } else {
        await this.executeSequential(executionId, criteria, result);
      }

      // 実行完了の確認
      this.checkExecutionCompletion(executionId, result);
      
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.rollbackRequired = this.shouldRollback(result);
    } finally {
      result.completedAt = new Date();
      this.currentExecutions = Math.max(0, this.currentExecutions - 1);
      
      // タイムアウトをクリア
      const timeout = this.executionTimeouts.get(executionId);
      if (timeout) {
        clearTimeout(timeout);
        this.executionTimeouts.delete(executionId);
      }

      // 次のキューアイテムを処理
      this.processNextInQueue();
    }

    return result;
  }

  /**
   * 同時実行
   */
  private async executeSimultaneous(
    executionId: string, 
    criteria: HedgeExecutionCriteria, 
    result: HedgeResult
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // 買いポジション実行
    if (criteria.lotSizes.buy > 0) {
      promises.push(this.executeBuyPosition(executionId, criteria, result));
    }

    // 売りポジション実行
    if (criteria.lotSizes.sell > 0) {
      promises.push(this.executeSellPosition(executionId, criteria, result));
    }

    await Promise.allSettled(promises);
  }

  /**
   * 順次実行
   */
  private async executeSequential(
    executionId: string, 
    criteria: HedgeExecutionCriteria, 
    result: HedgeResult
  ): Promise<void> {
    // 買いポジションを先に実行
    if (criteria.lotSizes.buy > 0) {
      await this.executeBuyPosition(executionId, criteria, result);
      
      // 遅延設定がある場合は待機
      if (criteria.timing.sequentialDelay && criteria.timing.sequentialDelay > 0) {
        await this.delay(criteria.timing.sequentialDelay);
      }
    }

    // 売りポジションを実行
    if (criteria.lotSizes.sell > 0) {
      await this.executeSellPosition(executionId, criteria, result);
    }
  }

  /**
   * 買いポジション実行
   */
  private async executeBuyPosition(
    executionId: string, 
    criteria: HedgeExecutionCriteria, 
    result: HedgeResult
  ): Promise<void> {
    const entryCommand: EntryCommand = {
      symbol: criteria.symbol,
      direction: 'BUY',
      lotSize: criteria.lotSizes.buy,
      orderType: criteria.priceSettings.orderType === 'market' ? 'MARKET' : 'LIMIT',
      price: criteria.priceSettings.buyPrice,
      accountId: criteria.accounts[0], // 簡易実装：最初のアカウントを使用
      stopLoss: criteria.riskManagement.stopLoss,
      takeProfit: criteria.riskManagement.takeProfit
    };

    try {
      const entryResult = await this.entryService.sendEntryCommand(entryCommand);
      result.results.buy = entryResult;
    } catch (error) {
      result.results.buy = {
        success: false,
        error: error instanceof Error ? error.message : 'Buy position execution failed'
      };
    }
  }

  /**
   * 売りポジション実行
   */
  private async executeSellPosition(
    executionId: string, 
    criteria: HedgeExecutionCriteria, 
    result: HedgeResult
  ): Promise<void> {
    const entryCommand: EntryCommand = {
      symbol: criteria.symbol,
      direction: 'SELL',
      lotSize: criteria.lotSizes.sell,
      orderType: criteria.priceSettings.orderType === 'market' ? 'MARKET' : 'LIMIT',
      price: criteria.priceSettings.sellPrice,
      accountId: criteria.accounts[0], // 簡易実装：最初のアカウントを使用
      stopLoss: criteria.riskManagement.stopLoss,
      takeProfit: criteria.riskManagement.takeProfit
    };

    try {
      const entryResult = await this.entryService.sendEntryCommand(entryCommand);
      result.results.sell = entryResult;
    } catch (error) {
      result.results.sell = {
        success: false,
        error: error instanceof Error ? error.message : 'Sell position execution failed'
      };
    }
  }

  /**
   * 実行完了チェック
   */
  private checkExecutionCompletion(executionId: string, result: HedgeResult): void {
    const { buy, sell } = result.results;
    
    const buyCompleted = !result.results.buy || buy?.success === true || buy?.success === false;
    const sellCompleted = !result.results.sell || sell?.success === true || sell?.success === false;
    
    if (buyCompleted && sellCompleted) {
      const buySuccess = buy?.success ?? true;
      const sellSuccess = sell?.success ?? true;
      
      if (buySuccess && sellSuccess) {
        result.status = 'completed';
        
        // 両建てポジションを作成
        if (buy?.positionId && sell?.positionId) {
          result.hedgePosition = this.createHedgePositionFromResults(executionId, result);
        }
      } else if (buySuccess || sellSuccess) {
        result.status = 'partial';
        result.rollbackRequired = true;
      } else {
        result.status = 'failed';
      }
    }
  }

  /**
   * 実行キューに追加
   */
  private queueExecution(criteria: HedgeExecutionCriteria): Promise<HedgeResult> {
    const executionId = this.generateExecutionId();
    
    const queuedExecution: QueuedExecution = {
      id: executionId,
      criteria,
      priority: 0,
      queuedAt: new Date(),
      attempts: 0,
      maxAttempts: 3
    };
    
    this.executionQueue.push(queuedExecution);
    this.executionQueue.sort((a, b) => b.priority - a.priority);

    // キュー状態の結果を返す
    const result: HedgeResult = {
      executionId,
      status: 'pending',
      results: {},
      rollbackRequired: false
    };
    
    this.activeExecutions.set(executionId, result);
    return Promise.resolve(result);
  }

  /**
   * 次のキューアイテムを処理
   */
  private async processNextInQueue(): Promise<void> {
    if (this.currentExecutions >= this.maxConcurrentExecutions || this.executionQueue.length === 0) {
      return;
    }

    const next = this.executionQueue.shift();
    if (!next) {
      return;
    }

    try {
      await this.executeHedgeInternal(next.id, next.criteria);
    } catch (error) {
      console.error(`Failed to process queued execution ${next.id}:`, error);
      
      // リトライ可能かチェック
      if (next.attempts < next.maxAttempts) {
        next.attempts++;
        this.executionQueue.unshift(next); // 先頭に戻す
      } else {
        // 最大試行回数に達した場合は失敗とする
        const result = this.activeExecutions.get(next.id);
        if (result) {
          result.status = 'failed';
          result.error = `Max attempts (${next.maxAttempts}) exceeded`;
          result.completedAt = new Date();
        }
      }
    }
  }

  /**
   * 実行条件のバリデーション
   */
  private validateExecutionCriteria(criteria: HedgeExecutionCriteria): any {
    // 簡易バリデーション実装
    const issues: any[] = [];

    if (!criteria.symbol || criteria.symbol.length < 6) {
      issues.push({
        type: 'validation_error',
        description: 'Invalid symbol'
      });
    }

    if (criteria.lotSizes.buy <= 0 && criteria.lotSizes.sell <= 0) {
      issues.push({
        type: 'validation_error', 
        description: 'At least one lot size must be greater than 0'
      });
    }

    if (criteria.accounts.length === 0) {
      issues.push({
        type: 'validation_error',
        description: 'At least one account is required'
      });
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * 実行タイムアウト処理
   */
  private handleExecutionTimeout(executionId: string): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return;
    }

    execution.status = 'failed';
    execution.error = 'Execution timeout';
    execution.completedAt = new Date();
    execution.rollbackRequired = this.shouldRollback(execution);

    this.currentExecutions = Math.max(0, this.currentExecutions - 1);
    this.processNextInQueue();
  }

  /**
   * ロールバックが必要かチェック
   */
  private shouldRollback(result: HedgeResult): boolean {
    const { buy, sell } = result.results;
    return (buy?.success && !sell?.success) || (!buy?.success && sell?.success);
  }

  /**
   * 結果から両建てポジションを作成
   */
  private createHedgePositionFromResults(executionId: string, result: HedgeResult): HedgePosition {
    // 簡易実装
    return {
      id: `hedge_${executionId}`,
      positionIds: [result.results.buy?.positionId, result.results.sell?.positionId].filter(Boolean) as string[],
      symbol: '', // criteria から取得する必要がある
      hedgeType: 'perfect',
      accounts: [],
      totalLots: {
        buy: result.results.buy?.lotSize || 0,
        sell: result.results.sell?.lotSize || 0
      },
      totalProfit: 0,
      isBalanced: true,
      createdAt: new Date(),
      settings: {
        autoRebalance: false,
        maxImbalance: 0.05,
        maintainOnClose: true
      }
    };
  }

  /**
   * 完了予想時刻を推定
   */
  private estimateCompletion(execution: HedgeResult): Date | undefined {
    if (execution.status === 'completed' || execution.status === 'failed') {
      return execution.completedAt;
    }

    // 簡易推定：実行開始から30秒後
    if (execution.executedAt) {
      return new Date(execution.executedAt.getTime() + 30000);
    }

    return undefined;
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 実行IDを生成
   */
  private generateExecutionId(): string {
    return `hedge_exec_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    // タイムアウトをクリア
    this.executionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.executionTimeouts.clear();

    // アクティブ実行をクリア
    this.activeExecutions.clear();
    
    // キューをクリア
    this.executionQueue.length = 0;
  }
}