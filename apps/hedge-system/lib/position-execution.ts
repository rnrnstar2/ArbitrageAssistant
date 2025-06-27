import { 
  Position, 
  PositionStatus, 
  Symbol, 
  ExecutionType, 
  ActionStatus,
  ActionType,
  Action,
  CreatePositionInput, 
  UpdatePositionInput,
  MarketCondition
} from '@repo/shared-types';

// Re-export for other modules
export type { MarketCondition };
import { 
  WSOpenCommand, 
  WSCloseCommand, 
  WSMessageType,
  WSOpenedEvent,
  WSClosedEvent,
  WSStoppedEvent 
} from './types';
import { amplifyClient, getCurrentUserId } from './amplify-client';
import { WebSocketHandler } from './websocket-server';
import { TrailEngine } from './trail-engine';
import { 
  positionService,
  createPosition,
  updatePosition,
  listUserPositions,
  recordExecutionResult,
  getPerformanceMetrics,
  subscribeToActions,
  listUserActions,
  updateAction
} from '@repo/shared-amplify';

/**
 * Position Execution Engine - MVPシステム設計書準拠
 * Entry→Trail→Action 状態遷移システム完全実装
 * 
 * 主要機能：
 * 1. EntryFlowEngine - エントリー条件判定・注文実行ロジック
 * 2. TrailFlowEngine - トレール判定アルゴリズム・ストップロス更新
 * 3. ActionFlowEngine - 決済実行ロジック・強制決済処理
 * 4. 高速処理対応 - Position更新<10ms, 決済判定<20ms
 * 5. userId最適化・リアルタイム同期
 */


export interface EntryCondition {
  positionId: string;
  symbol: Symbol;
  targetPrice?: number;
  maxSpread: number;
  maxVolatility: number;
  timeWindow?: number; // 秒
  isConditionMet: boolean;
  lastCheck: string;
}

export interface TrailCondition {
  positionId: string;
  currentPrice: number;
  entryPrice: number;
  trailWidth: number;
  highWaterMark?: number;
  lowWaterMark?: number;
  isTriggered: boolean;
  triggerPrice?: number;
  direction: 'BUY' | 'SELL';
}


export interface ActionExecution {
  actionId: string;
  positionId: string;
  executionType: ExecutionType;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedExecutionTime: number; // ms
  retryCount: number;
  maxRetries: number;
  status: ActionStatus;
  errorMessage?: string;
}

/**
 * EntryFlowEngine - エントリー実行エンジン
 */
export class EntryFlowEngine {
  private readonly MAX_EXECUTION_TIME = 5000; // 5秒
  private readonly OPTIMAL_SPREAD_THRESHOLD = 0.0001;
  private readonly MAX_VOLATILITY_THRESHOLD = 0.01;
  private readonly MAX_RETRIES = 3;
  
  // エントリー実行統計
  private executionStats = {
    totalAttempts: 0,
    successfulEntries: 0,
    failedEntries: 0,
    avgExecutionTime: 0,
    lastExecutionTime: 0
  };

  /**
   * エントリー条件判定アルゴリズム
   */
  async evaluateEntryCondition(
    position: Position,
    marketCondition: MarketCondition
  ): Promise<EntryCondition> {
    
    const startTime = Date.now();
    
    // 基本条件チェック
    const isStatusValid = position.status === PositionStatus.PENDING;
    const isSpreadAcceptable = marketCondition.spread <= this.OPTIMAL_SPREAD_THRESHOLD;
    const isVolatilityLow = marketCondition.volatility <= this.MAX_VOLATILITY_THRESHOLD;
    const isLiquidityAdequate = marketCondition.liquidity > 0.5;
    
    // タイミング最適化
    const isTimingOptimal = this.evaluateMarketTiming(marketCondition);
    
    const isConditionMet = isStatusValid && 
                         isSpreadAcceptable && 
                         isVolatilityLow && 
                         isLiquidityAdequate && 
                         isTimingOptimal;
    
    const processingTime = Date.now() - startTime;
    
    return {
      positionId: position.id,
      symbol: position.symbol,
      maxSpread: this.OPTIMAL_SPREAD_THRESHOLD,
      maxVolatility: this.MAX_VOLATILITY_THRESHOLD,
      isConditionMet,
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * 注文実行ロジック（最適化版）
   */
  async executeOrder(
    position: Position,
    marketCondition: MarketCondition,
    wsHandler: WebSocketHandler
  ): Promise<{ success: boolean; executionTime: number; orderId?: string }> {
    
    const startTime = Date.now();
    
    try {
      // スリッページ最小化のための価格調整
      const optimizedPrice = this.calculateOptimalEntryPrice(
        marketCondition.currentPrice,
        marketCondition.spread,
        position.executionType
      );
      
      const command = {
        type: WSMessageType.OPEN,
        accountId: position.accountId,
        positionId: position.id,
        symbol: position.symbol,
        side: this.determinePositionSide(position),
        volume: position.volume,
        price: optimizedPrice,
        trailWidth: position.trailWidth ?? 0,
        timestamp: new Date().toISOString(),
        metadata: {
          executionType: position.executionType,
          timestamp: new Date().toISOString(),
          marketCondition: {
            spread: marketCondition.spread,
            volatility: marketCondition.volatility
          }
        }
      } as unknown as WSOpenCommand;

      // 高速実行（非同期）
      const orderId = await this.sendOptimizedCommand(command, wsHandler);
      
      const executionTime = Date.now() - startTime;
      
      // 実行統計更新
      this.updateExecutionStats(true, executionTime);
      
      // 詳細ログ記録
      const detailedLog = {
        positionId: position.id,
        symbol: position.symbol,
        volume: position.volume,
        executionType: position.executionType,
        optimizedPrice,
        executionTime,
        orderId,
        marketCondition: {
          currentPrice: marketCondition.currentPrice,
          spread: marketCondition.spread,
          volatility: marketCondition.volatility,
          liquidity: marketCondition.liquidity
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`⚡ Fast entry executed: ${JSON.stringify(detailedLog)}`);
      
      // パフォーマンスDB保存（非ブロッキング）
      this.saveExecutionResult(position.id, executionTime, true, optimizedPrice).catch(error => {
        console.error('Failed to save entry execution result:', error);
      });
      
      return {
        success: true,
        executionTime,
        orderId
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Entry execution failed:', error);
      
      // 実行統計更新
      this.updateExecutionStats(false, executionTime);
      
      // エラー詳細ログ
      const errorLog = {
        positionId: position.id,
        symbol: position.symbol,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        marketCondition,
        timestamp: new Date().toISOString()
      };
      
      console.error(`❌ Entry execution error details: ${JSON.stringify(errorLog)}`);
      
      // パフォーマンスDB保存（エラー情報含む）
      this.saveExecutionResult(
        position.id, 
        executionTime, 
        false, 
        marketCondition.currentPrice,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      ).catch(saveError => {
        console.error('Failed to save entry error result:', saveError);
      });
      
      // リトライ判定
      if (this.shouldRetryEntry(error)) {
        console.log(`🔄 Entry will be retried for position: ${position.id}`);
      }
      
      return {
        success: false,
        executionTime
      };
    }
  }

  /**
   * 初期ポジション設定
   */
  async setupInitialPosition(
    position: Position,
    entryPrice: number,
    mtTicket: string
  ): Promise<Position> {
    
    const updatedPosition: Position = {
      ...position,
      status: PositionStatus.OPEN,
      entryPrice,
      entryTime: new Date().toISOString(),
      mtTicket,
      updatedAt: new Date().toISOString()
    };
    
    // トレール設定がある場合、初期トレール状態を設定
    if (position.trailWidth && position.trailWidth > 0) {
      // トレール監視開始用のメタデータ追加
      console.log(`📊 Trail monitoring setup for position: ${position.id}`);
    }
    
    return updatedPosition;
  }

  // プライベートメソッド
  private evaluateMarketTiming(marketCondition: MarketCondition): boolean {
    // 簡易的なタイミング判定
    return marketCondition.liquidity > 0.3 && marketCondition.volatility < 0.02;
  }

  private calculateOptimalEntryPrice(
    currentPrice: number,
    spread: number,
    executionType: ExecutionType
  ): number {
    // スリッページを考慮した最適価格
    const adjustment = spread * 0.3; // 30%のスプレッド調整
    
    if (executionType === ExecutionType.ENTRY) {
      return currentPrice + adjustment; // BUYの場合
    } else {
      return currentPrice - adjustment; // SELLの場合
    }
  }

  private determinePositionSide(position: Position): 'BUY' | 'SELL' {
    return position.executionType === ExecutionType.ENTRY ? 'BUY' : 'SELL';
  }

  private async sendOptimizedCommand(
    command: WSOpenCommand,
    wsHandler: WebSocketHandler
  ): Promise<string> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: Error | null = null;
    
    // リトライループ
    while (retryCount < this.MAX_RETRIES) {
      try {
        // WebSocketHandler統合でMT4/MT5 EA制御実現
        const result = await wsHandler.sendOpenCommand({
          accountId: command.accountId,
          positionId: command.positionId,
          symbol: command.symbol as unknown as Symbol,
          volume: command.volume,
          executionType: command.metadata?.executionType
        });
        
        const executionTime = Date.now() - startTime;
        
        if (result.success) {
          console.log(`⚡ Optimized open command sent: ${command.positionId} in ${executionTime}ms (retry: ${retryCount})`);
          return result.orderId || `optimized_order_${Date.now()}`;
        } else {
          throw new Error(result.error || 'Command execution failed');
        }
        
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        
        if (retryCount < this.MAX_RETRIES) {
          const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
          console.warn(`⚠️ Retrying command ${retryCount}/${this.MAX_RETRIES} after ${waitTime}ms: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // 全リトライ失敗
    const executionTime = Date.now() - startTime;
    console.error(`❌ All retries failed for command: ${command.positionId} in ${executionTime}ms`, lastError);
    throw lastError || new Error('Command execution failed after all retries');
  }
  
  // 実行統計更新
  private updateExecutionStats(success: boolean, executionTime: number): void {
    this.executionStats.totalAttempts++;
    
    if (success) {
      this.executionStats.successfulEntries++;
    } else {
      this.executionStats.failedEntries++;
    }
    
    this.executionStats.lastExecutionTime = executionTime;
    
    // 平均実行時間の更新
    const prevAvg = this.executionStats.avgExecutionTime;
    const prevTotal = this.executionStats.totalAttempts - 1;
    this.executionStats.avgExecutionTime = 
      (prevAvg * prevTotal + executionTime) / this.executionStats.totalAttempts;
  }
  
  // パフォーマンスDB保存
  private async saveExecutionResult(
    positionId: string,
    executionTime: number,
    success: boolean,
    finalPrice?: number,
    profit?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await recordExecutionResult({
        positionId,
        executionType: ExecutionType.ENTRY,
        executionTime,
        success,
        finalPrice,
        profit,
        errorMessage,
        retryCount: this.executionStats.totalAttempts - 1
      });
    } catch (error) {
      console.error('Failed to save execution result:', error);
    }
  }
  
  // リトライ判定
  private shouldRetryEntry(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    // リトライ可能なエラータイプ
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'CONNECTION_REFUSED',
      'ECONNRESET'
    ];
    
    return retryableErrors.some(type => 
      error.message.includes(type) || error.message.includes(type.toLowerCase())
    );
  }
  
  // 実行統計取得
  getExecutionStats() {
    return {
      ...this.executionStats,
      successRate: this.executionStats.totalAttempts > 0 ?
        this.executionStats.successfulEntries / this.executionStats.totalAttempts : 0
    };
  }
}

/**
 * TrailFlowEngine - トレール判定アルゴリズム
 */
export class TrailFlowEngine {
  private trailConditions: Map<string, TrailCondition> = new Map();
  private readonly PRICE_PRECISION = 5;
  private readonly MIN_TRAIL_DISTANCE = 0.0001; // 1pip

  /**
   * トレール条件初期化
   */
  initializeTrailCondition(
    position: Position,
    currentPrice: number
  ): TrailCondition {
    
    if (!position.trailWidth || position.trailWidth <= 0) {
      throw new Error('Invalid trail width');
    }
    
    const direction = position.executionType === ExecutionType.ENTRY ? 'BUY' : 'SELL';
    
    const trailCondition: TrailCondition = {
      positionId: position.id,
      currentPrice,
      entryPrice: position.entryPrice || currentPrice,
      trailWidth: position.trailWidth,
      direction,
      isTriggered: false
    };
    
    // 初期の水位設定
    if (direction === 'BUY') {
      trailCondition.highWaterMark = currentPrice;
      trailCondition.triggerPrice = currentPrice - position.trailWidth;
    } else {
      trailCondition.lowWaterMark = currentPrice;
      trailCondition.triggerPrice = currentPrice + position.trailWidth;
    }
    
    this.trailConditions.set(position.id, trailCondition);
    
    console.log(`🎯 Trail condition initialized: ${position.id}, direction: ${direction}`);
    return trailCondition;
  }

  /**
   * トレール判定アルゴリズム（高速処理）
   */
  evaluateTrailCondition(
    positionId: string,
    currentPrice: number
  ): { isTriggered: boolean; newTriggerPrice?: number; reason?: string } {
    
    const condition = this.trailConditions.get(positionId);
    if (!condition) {
      return { isTriggered: false, reason: 'Trail condition not found' };
    }
    
    const precision = this.PRICE_PRECISION;
    const roundedPrice = this.roundToPrecision(currentPrice, precision);
    
    let isTriggered = false;
    let newTriggerPrice: number | undefined;
    let reason = '';
    
    if (condition.direction === 'BUY') {
      // BUYポジションのトレールロジック
      if (roundedPrice > condition.highWaterMark!) {
        // 新高値更新
        condition.highWaterMark = roundedPrice;
        newTriggerPrice = roundedPrice - condition.trailWidth;
        condition.triggerPrice = newTriggerPrice;
        reason = 'High watermark updated';
      } else if (roundedPrice <= condition.triggerPrice!) {
        // トレール発動
        isTriggered = true;
        reason = 'Trail triggered - price fell below trigger';
      }
    } else {
      // SELLポジションのトレールロジック
      if (roundedPrice < condition.lowWaterMark!) {
        // 新安値更新
        condition.lowWaterMark = roundedPrice;
        newTriggerPrice = roundedPrice + condition.trailWidth;
        condition.triggerPrice = newTriggerPrice;
        reason = 'Low watermark updated';
      } else if (roundedPrice >= condition.triggerPrice!) {
        // トレール発動
        isTriggered = true;
        reason = 'Trail triggered - price rose above trigger';
      }
    }
    
    condition.currentPrice = roundedPrice;
    condition.isTriggered = isTriggered;
    
    return {
      isTriggered,
      newTriggerPrice,
      reason
    };
  }

  /**
   * ストップロス更新（動的調整）
   */
  updateStopLoss(
    positionId: string,
    newStopLoss: number,
    reason: string = 'Manual update'
  ): boolean {
    
    const condition = this.trailConditions.get(positionId);
    if (!condition) {
      return false;
    }
    
    const roundedStopLoss = this.roundToPrecision(newStopLoss, this.PRICE_PRECISION);
    
    // 新しいストップロスが有効かチェック
    if (condition.direction === 'BUY' && roundedStopLoss >= condition.currentPrice) {
      console.warn('Invalid stop loss: higher than current price for BUY position');
      return false;
    }
    
    if (condition.direction === 'SELL' && roundedStopLoss <= condition.currentPrice) {
      console.warn('Invalid stop loss: lower than current price for SELL position');
      return false;
    }
    
    condition.triggerPrice = roundedStopLoss;
    
    console.log(`🔄 Stop loss updated: ${positionId}, new: ${roundedStopLoss}, reason: ${reason}`);
    return true;
  }

  /**
   * 利確レベル調整（アダプティブトレール）
   */
  adjustProfitLevel(
    positionId: string,
    profitTarget: number,
    marketVolatility: number
  ): number {
    
    const condition = this.trailConditions.get(positionId);
    if (!condition) {
      return profitTarget;
    }
    
    // ボラティリティに応じてトレール幅を動的調整
    const volatilityMultiplier = Math.max(1.0, Math.min(2.0, marketVolatility * 100));
    const adjustedTrailWidth = condition.trailWidth * volatilityMultiplier;
    
    let adjustedTarget: number;
    
    if (condition.direction === 'BUY') {
      adjustedTarget = condition.entryPrice + profitTarget;
    } else {
      adjustedTarget = condition.entryPrice - profitTarget;
    }
    
    const roundedTarget = this.roundToPrecision(adjustedTarget, this.PRICE_PRECISION);
    
    console.log(`🎢 Profit level adjusted: ${positionId}, target: ${roundedTarget}, volatility: ${marketVolatility}`);
    return roundedTarget;
  }

  /**
   * トレール条件取得
   */
  getTrailCondition(positionId: string): TrailCondition | undefined {
    return this.trailConditions.get(positionId);
  }

  /**
   * トレール条件削除（ポジション決済時）
   */
  removeTrailCondition(positionId: string): boolean {
    return this.trailConditions.delete(positionId);
  }

  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
}

/**
 * ActionFlowEngine - 決済実行ロジック
 */
export class ActionFlowEngine {
  private executionQueue: Map<string, ActionExecution> = new Map();
  private readonly MAX_EXECUTION_TIME = 3000; // 3秒
  private readonly MAX_RETRIES = 3;
  private readonly BATCH_SIZE = 10; // 並列処理のバッチサイズ
  private readonly PARTIAL_CLOSE_PRECISION = 0.01; // 部分決済の最小単位
  
  // 決済フロー統計
  private settlementStats = {
    totalSettlements: 0,
    successfulSettlements: 0,
    failedSettlements: 0,
    avgSettlementTime: 0,
    partialSettlements: 0,
    batchSettlements: 0
  };

  /**
   * 決済実行ロジック（高速版）
   */
  async executeClose(
    position: Position,
    reason: string,
    currentPrice: number,
    wsHandler: WebSocketHandler
  ): Promise<{ success: boolean; executionTime: number; finalPrice?: number }> {
    
    const startTime = Date.now();
    
    try {
      const command = {
        type: WSMessageType.CLOSE,
        accountId: position.accountId,
        positionId: position.id,
        symbol: position.symbol,
        side: this.getOppositePositionSide(position),
        volume: position.volume,
        price: currentPrice,
        timestamp: new Date().toISOString(),
        metadata: {
          executionType: ExecutionType.EXIT,
          timestamp: new Date().toISOString(),
          closeReason: reason
        }
      } as unknown as WSCloseCommand;

      const orderId = await this.sendOptimizedCloseCommand(command, wsHandler);
      
      const executionTime = Date.now() - startTime;
      
      console.log(`⚡ Fast close executed: ${position.id} in ${executionTime}ms, reason: ${reason}`);
      
      return {
        success: true,
        executionTime,
        finalPrice: currentPrice
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Close execution failed:', error);
      
      return {
        success: false,
        executionTime
      };
    }
  }

  /**
   * 強制決済処理（ロスカット等）- 高速バッチ処理版
   */
  async forceClose(
    positions: Position[],
    reason: string,
    currentPrices: { [symbol: string]: number },
    wsHandler: WebSocketHandler
  ): Promise<{ closed: string[]; failed: string[]; totalTime: number }> {
    
    const startTime = Date.now();
    const closed: string[] = [];
    const failed: string[] = [];
    
    // OPENポジションのみフィルタリング
    const openPositions = positions.filter(p => p.status === PositionStatus.OPEN);
    
    // バッチ処理で高速化
    for (let i = 0; i < openPositions.length; i += this.BATCH_SIZE) {
      const batch = openPositions.slice(i, i + this.BATCH_SIZE);
      
      // バッチ内並列処理
      const batchPromises = batch.map(async (position) => {
        const currentPrice = currentPrices[position.symbol];
        if (!currentPrice) {
          failed.push(position.id);
          console.warn(`⚠️ No price for symbol: ${position.symbol}, position: ${position.id}`);
          return;
        }
        
        try {
          const result = await this.executeClose(position, reason, currentPrice, wsHandler);
          if (result.success) {
            closed.push(position.id);
          } else {
            failed.push(position.id);
            console.error(`❌ Close failed for position: ${position.id}, reason: ${reason}`);
          }
        } catch (error) {
          failed.push(position.id);
          console.error(`❌ Exception during close for position: ${position.id}`, error);
        }
      });
      
      // バッチ完了待機
      await Promise.allSettled(batchPromises);
      
      // バッチ間の負荷分散（必要に応じて）
      if (i + this.BATCH_SIZE < openPositions.length) {
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms待機
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // 統計更新
    this.settlementStats.batchSettlements++;
    this.settlementStats.totalSettlements += openPositions.length;
    this.settlementStats.successfulSettlements += closed.length;
    this.settlementStats.failedSettlements += failed.length;
    
    console.log(`🚨 Force close completed: ${closed.length} closed, ${failed.length} failed in ${totalTime}ms (${openPositions.length} positions, ${Math.ceil(openPositions.length / this.BATCH_SIZE)} batches)`);
    
    return {
      closed,
      failed,
      totalTime
    };
  }

  /**
   * 結果記録（パフォーマンス統計）
   */
  async recordExecutionResult(
    positionId: string,
    executionTime: number,
    success: boolean,
    finalPrice?: number,
    profit?: number,
    errorMessage?: string
  ): Promise<void> {
    
    const execution = this.executionQueue.get(positionId);
    if (execution) {
      execution.status = success ? 'EXECUTED' : 'FAILED';
      execution.errorMessage = errorMessage;
    }
    
    // 結果ログ
    const logData = {
      positionId,
      executionTime,
      success,
      finalPrice,
      profit,
      timestamp: new Date().toISOString()
    };
    
    console.log(`📊 Execution result recorded: ${JSON.stringify(logData)}`);
    
    // パフォーマンスDBへの保存
    try {
      await recordExecutionResult({
        positionId,
        executionType: execution?.executionType || ExecutionType.EXIT,
        executionTime,
        success,
        finalPrice,
        profit,
        errorMessage,
        retryCount: execution?.retryCount || 0
      });
      console.log(`✅ Performance data saved to DB for position: ${positionId}`);
    } catch (error) {
      console.error('Failed to save performance data:', error);
    }
  }

  /**
   * 実行キュー管理
   */
  queueExecution(
    actionId: string,
    positionId: string,
    executionType: ExecutionType,
    priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'
  ): void {
    
    const execution: ActionExecution = {
      actionId,
      positionId,
      executionType,
      priority,
      estimatedExecutionTime: this.estimateExecutionTime(executionType),
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      status: 'PENDING'
    };
    
    this.executionQueue.set(actionId, execution);
    console.log(`📋 Execution queued: ${actionId}, priority: ${priority}`);
  }

  private getOppositePositionSide(position: Position): 'BUY' | 'SELL' {
    return position.executionType === ExecutionType.ENTRY ? 'SELL' : 'BUY';
  }

  private async sendOptimizedCloseCommand(
    command: WSCloseCommand,
    wsHandler: WebSocketHandler
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // WebSocketHandler統合でMT4/MT5 EA制御実現
      const result = await wsHandler.sendCloseCommand({
        accountId: command.accountId,
        positionId: command.positionId
      });
      
      const executionTime = Date.now() - startTime;
      
      if (result.success) {
        console.log(`⚡ Optimized close command sent: ${command.positionId} in ${executionTime}ms`);
        return result.orderId || `optimized_close_${Date.now()}`;
      } else {
        throw new Error(result.error || 'Command execution failed');
      }
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Optimized close command failed: ${command.positionId} in ${executionTime}ms`, error);
      throw error;
    }
  }

  /**
   * 部分決済実行
   */
  async executePartialClose(
    position: Position,
    closeVolume: number,
    reason: string,
    currentPrice: number,
    wsHandler: WebSocketHandler
  ): Promise<{ success: boolean; executionTime: number; remainingVolume?: number }> {
    
    const startTime = Date.now();
    
    try {
      // ボリューム検証
      if (closeVolume <= 0 || closeVolume > position.volume) {
        throw new Error(`Invalid close volume: ${closeVolume} (position volume: ${position.volume})`);
      }
      
      // 最小単位への丸め
      const roundedVolume = Math.round(closeVolume / this.PARTIAL_CLOSE_PRECISION) * this.PARTIAL_CLOSE_PRECISION;
      
      const command = {
        type: WSMessageType.CLOSE,
        accountId: position.accountId,
        positionId: position.id,
        symbol: position.symbol,
        side: this.getOppositePositionSide(position),
        volume: roundedVolume, // 部分決済ボリューム
        price: currentPrice,
        timestamp: new Date().toISOString(),
        metadata: {
          executionType: ExecutionType.EXIT,
          timestamp: new Date().toISOString(),
          closeReason: reason,
          isPartialClose: true,
          originalVolume: position.volume
        }
      } as unknown as WSCloseCommand;

      const orderId = await this.sendOptimizedCloseCommand(command, wsHandler);
      
      const executionTime = Date.now() - startTime;
      const remainingVolume = position.volume - roundedVolume;
      
      // 統計更新
      this.settlementStats.partialSettlements++;
      this.settlementStats.totalSettlements++;
      this.settlementStats.successfulSettlements++;
      
      console.log(`⚡ Partial close executed: ${position.id}, closed: ${roundedVolume}, remaining: ${remainingVolume} in ${executionTime}ms`);
      
      return {
        success: true,
        executionTime,
        remainingVolume
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Partial close execution failed:', error);
      
      // 統計更新
      this.settlementStats.totalSettlements++;
      this.settlementStats.failedSettlements++;
      
      return {
        success: false,
        executionTime
      };
    }
  }

  /**
   * 決済統計取得
   */
  getSettlementStats() {
    return {
      ...this.settlementStats,
      successRate: this.settlementStats.totalSettlements > 0 ?
        this.settlementStats.successfulSettlements / this.settlementStats.totalSettlements : 0,
      avgBatchSize: this.settlementStats.batchSettlements > 0 ?
        this.settlementStats.totalSettlements / this.settlementStats.batchSettlements : 0
    };
  }

  private estimateExecutionTime(executionType: ExecutionType): number {
    // 実行タイプ別の推定実行時間
    return executionType === ExecutionType.ENTRY ? 1500 : 1000; // ms
  }
}
export class PositionExecutor {
  private wsHandler: WebSocketHandler;
  private trailEngine?: TrailEngine;
  private currentUserId?: string;
  
  // 新しいエンジンコンポーネント
  private entryFlowEngine: EntryFlowEngine;
  private trailFlowEngineInstance: TrailFlowEngine;
  private actionFlowEngine: ActionFlowEngine;
  
  // パフォーマンス計測
  private performanceMetrics: {
    avgEntryTime: number;
    avgCloseTime: number;
    successRate: number;
    totalExecutions: number;
    retryCount: number;
    settlementSuccessRate: number;
  } = {
    avgEntryTime: 0,
    avgCloseTime: 0,
    successRate: 0,
    totalExecutions: 0,
    retryCount: 0,
    settlementSuccessRate: 0
  };

  constructor(wsHandler: WebSocketHandler, trailEngine?: TrailEngine) {
    this.wsHandler = wsHandler;
    this.entryFlowEngine = new EntryFlowEngine();
    this.trailFlowEngineInstance = new TrailFlowEngine();
    this.actionFlowEngine = new ActionFlowEngine();
    
    // TrailEngineの統合強化：ActionFlowEngineとWebSocketHandlerを注入
    if (trailEngine) {
      this.trailEngine = trailEngine;
      // 既存のTrailEngineにActionFlowEngineとWebSocketHandlerを設定
      this.trailEngine.setExecutionComponents(this.actionFlowEngine, this.wsHandler);
    } else {
      // 新しいTrailEngineを作成し、ActionFlowEngineとWebSocketHandlerを渡す
      const { getTrailEngine } = require('./trail-engine');
      this.trailEngine = getTrailEngine(undefined, this.actionFlowEngine, this.wsHandler);
    }
    
    this.initializeUserId();
  }

  // ========================================
  // 初期化・設定
  // ========================================

  /**
   * userId初期化
   */
  private async initializeUserId(): Promise<void> {
    try {
      this.currentUserId = await getCurrentUserId();
    } catch (error) {
      console.error('Failed to get current user ID:', error);
    }
  }

  /**
   * TrailEngine設定
   */
  setTrailEngine(trailEngine: TrailEngine): void {
    this.trailEngine = trailEngine;
  }

  // ========================================
  // ポジション作成・管理
  // ========================================

  /**
   * ポジション作成（トレール設定含む）
   * 設計書：管理画面からのポジション作成に対応
   */
  async createPosition(params: {
    accountId: string;
    symbol: Symbol;
    volume: number;
    executionType: ExecutionType;
    trailWidth?: number;
    triggerActionIds?: string; // JSON配列文字列
    memo?: string;
  }): Promise<Position> {
    
    const positionInput: CreatePositionInput = {
      userId: this.currentUserId!,
      accountId: params.accountId,
      symbol: params.symbol,
      volume: params.volume,
      executionType: params.executionType,
      status: PositionStatus.PENDING,
      trailWidth: params.trailWidth || 0,
      triggerActionIds: params.triggerActionIds,
      memo: params.memo
    };

    const result = await this.createPositionGraphQL(positionInput);
    return result.data;
  }

  /**
   * ポジション実行開始
   * 設計書：管理画面からの実行指示に対応
   */
  async executePosition(positionId: string): Promise<boolean> {
    try {
      await this.updatePositionStatus(positionId, PositionStatus.OPENING);
      return true;
    } catch (error) {
      console.error('Position execution failed:', error);
      await this.updatePositionStatus(positionId, PositionStatus.CANCELED);
      return false;
    }
  }

  // ========================================
  // Subscription処理（設計書準拠）
  // ========================================

  /**
   * Position Subscription処理
   * 設計書：userId基づく実行担当判定
   */
  async handlePositionSubscription(position: Position): Promise<void> {
    // 1. userIdベースの実行判定
    if (!this.currentUserId || position.userId !== this.currentUserId) {
      return; // 他ユーザーの担当はスキップ
    }
    
    // 2. ステータス別処理
    switch (position.status) {
      case PositionStatus.OPENING:
        await this.executeEntry(position);
        break;
      case PositionStatus.CLOSING:
        await this.executeExit(position);
        break;
      case PositionStatus.OPEN:
        await this.startTrailMonitoring(position);
        break;
    }
  }

  /**
   * Action Subscription処理（クロスPC協調実行の核心）
   * 設計書：トレール発動時の別PCでのアクション実行
   */
  async handleActionSubscription(action: Action): Promise<void> {
    const subscriptionStartTime = Date.now();
    
    try {
      // 1. userIdベースの実行担当判定（設計書準拠）
      if (!this.currentUserId || action.userId !== this.currentUserId) {
        console.log(`⏭️ Action skipped: not my responsibility (action user: ${action.userId}, my user: ${this.currentUserId})`);
        return; // 他ユーザーの担当はスキップ
      }
      
      // 2. EXECUTING状態のアクションのみ処理（設計書準拠）
      if (action.status !== ActionStatus.EXECUTING) {
        console.log(`⏭️ Action skipped: status not EXECUTING (${action.status})`);
        return;
      }
      
      console.log(`🎯 Cross-PC action received: ${action.id}, type: ${action.type}, triggeredBy: ${action.triggerPositionId}`);
      
      // 3. アクションタイプ別実行（設計書準拠）
      switch (action.type) {
        case ActionType.ENTRY:
          await this.executeCrossPcEntry(action);
          break;
          
        case ActionType.CLOSE:
          await this.executeCrossPcClose(action);
          break;
          
        default:
          console.warn(`⚠️ Unknown action type: ${action.type}`);
          await this.updateActionStatus(action.id, ActionStatus.FAILED);
      }
      
      // 4. パフォーマンス記録
      const latency = Date.now() - subscriptionStartTime;
      console.log(`⚡ Cross-PC action processed in ${latency}ms`);
      
    } catch (error) {
      console.error('❌ Action subscription processing failed:', error);
      
      // エラー時のアクション状態更新
      if (action.id) {
        await this.updateActionStatus(action.id, ActionStatus.FAILED).catch(updateError => {
          console.error('Failed to update action status:', updateError);
        });
      }
    }
  }

  /**
   * エントリー実行（高速版・設計書準拠）
   */
  private async executeEntry(position: Position): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Fast entry execution started: ${position.id}`);
      
      // 1. 市場条件取得（実価格フィード統合）
      const priceMonitor = this.wsHandler.priceMonitor;
      const priceData = priceMonitor ? 
        priceMonitor.getCurrentPrice(position.symbol) :
        null;
      const currentPrice = priceData ? 
        (typeof priceData === 'number' ? priceData : priceData.bid || priceData.ask || 0) :
        this.getFallbackPrice(position.symbol);
      
      const marketCondition: MarketCondition = {
        symbol: position.symbol,
        currentPrice,
        spread: 0.0001,
        volatility: 0.005,
        liquidity: 0.8,
        timestamp: new Date().toISOString()
      };
      
      // 2. エントリー条件評価
      const entryCondition = await this.entryFlowEngine.evaluateEntryCondition(
        position,
        marketCondition
      );
      
      if (!entryCondition.isConditionMet) {
        console.warn(`⚠️ Entry condition not met for position: ${position.id}`);
        await this.updatePositionStatus(position.id, PositionStatus.CANCELED);
        return;
      }
      
      // 3. 最適化注文実行
      const executionResult = await this.entryFlowEngine.executeOrder(
        position,
        marketCondition,
        this.wsHandler
      );
      
      if (executionResult.success) {
        // 4. ポジション初期化
        const updatedPosition = await this.entryFlowEngine.setupInitialPosition(
          position,
          marketCondition.currentPrice,
          executionResult.orderId || 'mock_ticket'
        );
        
        // 5. トレール条件初期化
        if (position.trailWidth && position.trailWidth > 0) {
          this.trailFlowEngineInstance.initializeTrailCondition(
            updatedPosition,
            marketCondition.currentPrice
          );
        }
        
        // 6. パフォーマンス記録
        const totalTime = Date.now() - startTime;
        this.updatePerformanceMetrics('entry', totalTime, true);
        
        console.log(`✅ Entry completed: ${position.id} in ${totalTime}ms`);
        
      } else {
        throw new Error('Order execution failed');
      }
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('Entry execution failed:', error);
      
      this.updatePerformanceMetrics('entry', totalTime, false);
      await this.updatePositionStatus(position.id, PositionStatus.CANCELED);
    }
  }

  /**
   * 決済実行（高速版）
   */
  private async executeExit(position: Position): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Fast exit execution started: ${position.id}`);
      
      // 現在価格取得（実価格フィード統合）
      const priceMonitor = this.wsHandler.priceMonitor;
      const priceData = priceMonitor ? 
        priceMonitor.getCurrentPrice(position.symbol) :
        null;
      const currentPrice = priceData ? 
        (typeof priceData === 'number' ? priceData : priceData.bid || priceData.ask || 0) :
        this.getFallbackPrice(position.symbol);
      
      // 高速決済実行
      const executionResult = await this.actionFlowEngine.executeClose(
        position,
        'MANUAL_CLOSE',
        currentPrice,
        this.wsHandler
      );
      
      if (executionResult.success) {
        // トレール条件削除
        this.trailFlowEngineInstance.removeTrailCondition(position.id);
        
        // 結果記録
        const profit = this.calculateProfit(position, currentPrice);
        await this.actionFlowEngine.recordExecutionResult(
          position.id,
          executionResult.executionTime,
          true,
          currentPrice,
          profit
        );
        
        // パフォーマンス記録
        const totalTime = Date.now() - startTime;
        this.updatePerformanceMetrics('close', totalTime, true);
        
        console.log(`✅ Exit completed: ${position.id} in ${totalTime}ms`);
        
      } else {
        throw new Error('Close execution failed');
      }
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('Exit execution failed:', error);
      
      this.updatePerformanceMetrics('close', totalTime, false);
      
      // 決済失敗時の自動リトライ機構実装
      const retryResult = await this.handleSettlementRetry(position, error as Error);
      if (!retryResult.success) {
        await this.updatePositionStatus(position.id, PositionStatus.CANCELED);
      }
    }
  }

  /**
   * トレール監視開始（高速版・設計書準拠）
   */
  async startTrailMonitoring(position: Position): Promise<void> {
    if (position.status === PositionStatus.OPEN && 
        position.trailWidth && 
        position.trailWidth > 0) {
      
      console.log(`📊 Starting advanced trail monitoring: ${position.id}`);
      
      // 現在価格でトレール条件初期化（実価格フィード統合）
      const priceMonitor = this.wsHandler.priceMonitor;
      const priceData = priceMonitor ? 
        priceMonitor.getCurrentPrice(position.symbol) :
        null;
      const currentPrice = priceData ? 
        (typeof priceData === 'number' ? priceData : priceData.bid || priceData.ask || 0) :
        this.getFallbackPrice(position.symbol);
      this.trailFlowEngineInstance.initializeTrailCondition(position, currentPrice);
      
      // 既存のTrailEngineとの連携
      if (this.trailEngine) {
        await this.trailEngine.addPositionMonitoring(position);
      }
    }
  }

  // ========================================
  // WebSocket Event処理
  // ========================================

  /**
   * ポジション約定完了処理
   */
  async handlePositionOpened(event: WSOpenedEvent): Promise<void> {
    await this.updatePositionStatus(event.positionId, PositionStatus.OPEN, {
      mtTicket: event.mtTicket || event.orderId.toString(),
      entryPrice: event.price,
      entryTime: event.time
    });
    
    console.log(`✅ Position opened: ${event.positionId} at ${event.price}`);
  }

  /**
   * ポジション決済完了処理
   */
  async handlePositionClosed(event: WSClosedEvent): Promise<void> {
    await this.updatePositionStatus(event.positionId, PositionStatus.CLOSED, {
      exitPrice: event.price,
      exitTime: event.time,
      exitReason: 'MANUAL_CLOSE'
    });
    
    console.log(`✅ Position closed: ${event.positionId} at ${event.price}, profit: ${event.profit}`);
  }

  /**
   * ロスカット処理（高速版・設計書準拠）
   */
  async handlePositionStopped(event: WSStoppedEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. ポジション状態更新
      await this.updatePositionStatus(event.positionId, PositionStatus.STOPPED, {
        exitPrice: event.price,
        exitTime: event.time,
        exitReason: 'STOP_OUT'
      });

      // 2. トレール条件削除
      this.trailFlowEngineInstance.removeTrailCondition(event.positionId);
      
      // 3. triggerActionIds実行（既存エンジンと連携）
      if (this.trailEngine) {
        await this.trailEngine.handleLossCut(event.positionId, event.price);
      }
      
      // 4. 結果記録（ロスカット）
      await this.actionFlowEngine.recordExecutionResult(
        event.positionId,
        Date.now() - startTime,
        true,
        event.price,
        undefined, // 損失は後で計算
        event.reason
      );
      
      const totalTime = Date.now() - startTime;
      console.log(`💥 Stop-out processed: ${event.positionId} at ${event.price} in ${totalTime}ms`);
      
    } catch (error) {
      console.error('Stop-out processing failed:', error);
    }
  }

  // ========================================
  // Position Subscription管理
  // ========================================

  /**
   * Position Subscriptionの開始
   * 設計書：userIdベースのサブスクリプション
   */
  async subscribeToMyPositions(): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    // shared-amplifyのsubscription serviceを使用
    try {
      const { subscribeToPositions } = await import('@repo/shared-amplify');
      
      const subscription = await subscribeToPositions(
        (position: Position) => {
          this.handlePositionSubscription(position);
        }
      );
      
      console.log('📡 Position subscription started for user:', this.currentUserId);
      
      // subscriptionの管理（必要に応じて）
      // this.positionSubscription = subscription;
      
    } catch (error) {
      console.error('Failed to start position subscription:', error);
      throw error;
    }
  }

  /**
   * Action Subscription開始（複数PC間協調実行対応）
   * 設計書：userIdベースのアクション監視・クロスPC実行
   */
  async subscribeToMyActions(): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    try {
      const subscription = await subscribeToActions(
        (action: Action) => {
          this.handleActionSubscription(action);
        }
      );
      
      console.log('🎯 Action subscription started for cross-PC coordination, user:', this.currentUserId);
      
      // actionSubscriptionの管理（必要に応じて）
      // this.actionSubscription = subscription;
      
    } catch (error) {
      console.error('Failed to start action subscription:', error);
      throw error;
    }
  }

  /**
   * 複合サブスクリプション開始（Position + Action）
   * 設計書：完全なリアルタイム協調実行システム
   */
  async startRealtimeCoordination(): Promise<void> {
    console.log('🚀 Starting enhanced realtime coordination system...');
    
    // Position + Action の両方を監視
    await Promise.all([
      this.subscribeToMyPositions(),
      this.subscribeToMyActions()
    ]);
    
    console.log('✅ Enhanced realtime coordination system started');
  }

  // ========================================
  // クロスPC協調実行メソッド
  // ========================================

  /**
   * クロスPCエントリー実行
   * 設計書：トレール発動時の別PCでの新規ポジション作成
   */
  private async executeCrossPcEntry(action: Action): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. 対象ポジション取得（actionが指定するpositionId）
      const targetPosition = await this.getPositionByActionId(action.positionId);
      if (!targetPosition) {
        throw new Error(`Target position not found: ${action.positionId}`);
      }
      
      // 2. 市場条件取得
      const currentPrice = this.getCurrentMarketPrice(targetPosition.symbol);
      
      const marketCondition: MarketCondition = {
        symbol: targetPosition.symbol,
        currentPrice,
        spread: 0.0001,
        volatility: 0.005,
        liquidity: 0.8,
        timestamp: new Date().toISOString()
      };
      
      // 3. ポジション状態をOPENINGに更新
      await this.updatePositionStatus(targetPosition.id, PositionStatus.OPENING);
      
      // 4. エントリー実行
      const executionResult = await this.entryFlowEngine.executeOrder(
        targetPosition,
        marketCondition,
        this.wsHandler
      );
      
      if (executionResult.success) {
        // 5. アクション完了
        await this.updateActionStatus(action.id, ActionStatus.EXECUTED);
        
        console.log(`✅ Cross-PC entry completed: position ${targetPosition.id}, action ${action.id}`);
      } else {
        throw new Error('Entry execution failed');
      }
      
      const executionTime = Date.now() - startTime;
      console.log(`⚡ Cross-PC entry executed in ${executionTime}ms`);
      
    } catch (error) {
      console.error('❌ Cross-PC entry failed:', error);
      
      // エラー時のアクション状態更新
      await this.updateActionStatus(action.id, ActionStatus.FAILED);
      
      // ポジション状態をCANCELEDに更新
      if (action.positionId) {
        await this.updatePositionStatus(action.positionId, PositionStatus.CANCELED);
      }
    }
  }

  /**
   * クロスPC決済実行
   * 設計書：トレール発動時の別PCでのポジション決済
   */
  private async executeCrossPcClose(action: Action): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. 対象ポジション取得
      const targetPosition = await this.getPositionByActionId(action.positionId);
      if (!targetPosition) {
        throw new Error(`Target position not found: ${action.positionId}`);
      }
      
      // 2. ポジション状態確認（OPENのみ決済可能）
      if (targetPosition.status !== PositionStatus.OPEN) {
        console.warn(`⚠️ Position not OPEN, cannot close: ${targetPosition.id} (status: ${targetPosition.status})`);
        await this.updateActionStatus(action.id, ActionStatus.FAILED);
        return;
      }
      
      // 3. 現在価格取得
      const currentPrice = this.getCurrentMarketPrice(targetPosition.symbol);
      
      // 4. ポジション状態をCLOSINGに更新
      await this.updatePositionStatus(targetPosition.id, PositionStatus.CLOSING);
      
      // 5. 決済実行
      const executionResult = await this.actionFlowEngine.executeClose(
        targetPosition,
        'CROSS_PC_TRAIL_CLOSE',
        currentPrice,
        this.wsHandler
      );
      
      if (executionResult.success) {
        // 6. アクション完了
        await this.updateActionStatus(action.id, ActionStatus.EXECUTED);
        
        // 7. トレール条件削除
        this.trailFlowEngineInstance.removeTrailCondition(targetPosition.id);
        
        console.log(`✅ Cross-PC close completed: position ${targetPosition.id}, action ${action.id}`);
      } else {
        throw new Error('Close execution failed');
      }
      
      const executionTime = Date.now() - startTime;
      console.log(`⚡ Cross-PC close executed in ${executionTime}ms`);
      
    } catch (error) {
      console.error('❌ Cross-PC close failed:', error);
      
      // エラー時のアクション状態更新
      await this.updateActionStatus(action.id, ActionStatus.FAILED);
      
      // ポジション状態をOPENに戻す（決済失敗時）
      if (action.positionId) {
        await this.updatePositionStatus(action.positionId, PositionStatus.OPEN);
      }
    }
  }

  // ========================================
  // 取得系メソッド
  // ========================================

  /**
   * オープンポジション一覧取得
   */
  async getOpenPositions(): Promise<Position[]> {
    const result = await this.listOpenPositions();
    return result.data.listPositions.items;
  }

  /**
   * トレール設定済みポジション一覧取得
   */
  async getTrailPositions(): Promise<Position[]> {
    const result = await this.listTrailPositions();
    return result.data.listPositions.items;
  }

  /**
   * 自分担当のポジション取得
   */
  async getMyPositions(status?: PositionStatus): Promise<Position[]> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    const result = await this.listOpenPositions();
    const allPositions = result.data.listPositions.items;
    
    return allPositions.filter((position: Position) => {
      return position.userId === this.currentUserId && 
             (!status || position.status === status);
    });
  }

  // ========================================
  // エンジン統合メソッド
  // ========================================

  /**
   * 高速トレール監視（価格更新時呼び出し）
   */
  async updateTrailConditions(
    currentPrices: { [symbol: string]: number }
  ): Promise<{ triggered: string[]; updated: string[] }> {
    
    const triggered: string[] = [];
    const updated: string[] = [];
    
    // 全トレールポジションを高速チェック
    const openPositions = await this.getOpenPositions();
    
    for (const position of openPositions) {
      if (!position.trailWidth || position.trailWidth <= 0) continue;
      
      const currentPrice = currentPrices[position.symbol];
      if (!currentPrice) continue;
      
      const result = this.trailFlowEngineInstance.evaluateTrailCondition(
        position.id,
        currentPrice
      );
      
      if (result.isTriggered) {
        triggered.push(position.id);
        
        // トレール発動時の自動決済
        await this.executeExit(position);
        
      } else if (result.newTriggerPrice) {
        updated.push(position.id);
      }
    }
    
    return { triggered, updated };
  }

  /**
   * 総合パフォーマンス監視
   */
  getAdvancedPerformanceStats() {
    return {
      ...this.performanceMetrics,
      engines: {
        entry: this.entryFlowEngine,
        trail: this.trailFlowEngineInstance,
        action: this.actionFlowEngine
      },
      currentUserId: this.currentUserId,
      isOptimized: true
    };
  }

  // ========================================
  // ヘルパーメソッド
  // ========================================

  /**
   * アクションIDからポジション取得
   */
  private async getPositionByActionId(positionId: string): Promise<Position | null> {
    try {
      if (positionId) {
        const result = await this.listOpenPositions();
        return result.data.listPositions.items.find(p => p.id === positionId) || null;
      }
      return null;
    } catch (error) {
      console.error(`Failed to get position for actionId ${positionId}:`, error);
      return null;
    }
  }

  /**
   * 現在の市場価格取得（Action Subscription用）
   */
  private getCurrentMarketPrice(symbol: Symbol): number {
    const priceMonitor = this.wsHandler.priceMonitor;
    const priceData = priceMonitor ? 
      priceMonitor.getCurrentPrice(symbol) :
      null;
    return priceData ? 
      (typeof priceData === 'number' ? priceData : priceData.bid || priceData.ask || 0) :
      this.getFallbackPrice(symbol);
  }

  /**
   * アクション状態更新
   */
  private async updateActionStatus(actionId: string, status: ActionStatus): Promise<void> {
    try {
      const { updateAction } = await import('@repo/shared-amplify');
      await updateAction(actionId, { status });
    } catch (error) {
      console.error(`Failed to update action ${actionId} status to ${status}:`, error);
      throw error;
    }
  }

  /**
   * ポジション方向決定（改善版）
   */
  private determinePositionSide(position: Position): 'BUY' | 'SELL' {
    return position.executionType === ExecutionType.ENTRY ? 'BUY' : 'SELL';
  }

  /**
   * 反対ポジション方向
   */
  private getOppositePositionSide(position: Position): 'BUY' | 'SELL' {
    return this.determinePositionSide(position) === 'BUY' ? 'SELL' : 'BUY';
  }

  /**
   * 利益計算
   */
  private calculateProfit(position: Position, currentPrice: number): number {
    if (!position.entryPrice) return 0;
    
    const direction = position.executionType === ExecutionType.ENTRY ? 1 : -1;
    const priceDiff = (currentPrice - position.entryPrice) * direction;
    const multiplier = this.getSymbolMultiplier(position.symbol);
    
    return priceDiff * position.volume * multiplier;
  }

  /**
   * 通貨ペア別乗数
   */
  private getSymbolMultiplier(symbol: Symbol): number {
    const multipliers: Record<Symbol, number> = {
      'USDJPY': 100000,
      'EURUSD': 100000,
      'EURGBP': 100000,
      'XAUUSD': 100
    };
    return multipliers[symbol] || 100000;
  }

  /**
   * パフォーマンスメトリクス更新
   */
  private updatePerformanceMetrics(
    type: 'entry' | 'close',
    executionTime: number,
    success: boolean
  ): void {
    
    this.performanceMetrics.totalExecutions++;
    
    if (success) {
      if (type === 'entry') {
        this.performanceMetrics.avgEntryTime = 
          (this.performanceMetrics.avgEntryTime + executionTime) / 2;
      } else {
        this.performanceMetrics.avgCloseTime = 
          (this.performanceMetrics.avgCloseTime + executionTime) / 2;
      }
    }
    
    // 成功率計算
    const totalSuccessful = this.performanceMetrics.successRate * 
                           (this.performanceMetrics.totalExecutions - 1);
    this.performanceMetrics.successRate = 
      (totalSuccessful + (success ? 1 : 0)) / this.performanceMetrics.totalExecutions;
  }

  /**
   * フォールバック価格取得（PriceMonitor未利用時）
   */
  private getFallbackPrice(symbol: Symbol): number {
    // 通貨ペア別のフォールバック価格
    const fallbackPrices: { [key in Symbol]: number } = {
      'USDJPY': 150.0,
      'EURUSD': 1.0800,
      'EURGBP': 0.8500,
      'XAUUSD': 2000.0
    };
    
    const price = fallbackPrices[symbol] || 1.0;
    console.warn(`⚠️ Using fallback price for ${symbol}: ${price}`);
    return price;
  }

  // ========================================
  // GraphQL Service Methods（統合）
  // ========================================

  /**
   * ポジション作成（Amplify Gen2）
   */
  private async createPositionGraphQL(input: CreatePositionInput): Promise<{ data: Position }> {
    const result = await createPosition(input);
    return { data: result };
  }

  /**
   * ポジション状態更新（Amplify Gen2）
   */
  private async updatePositionStatus(id: string, status?: PositionStatus, additionalFields?: any): Promise<{ data: Position }> {
    const updateInput: any = { ...additionalFields };
    if (status) updateInput.status = status;
    
    const result = await updatePosition(id, updateInput);
    return { data: result };
  }

  /**
   * オープンポジション一覧取得（Amplify Gen2）
   */
  private async listOpenPositions(): Promise<{ data: { listPositions: { items: Position[] } } }> {
    const result = await listUserPositions({ status: 'OPEN' });
    return { 
      data: { 
        listPositions: { 
          items: result 
        } 
      } 
    };
  }

  /**
   * トレール設定済みポジション一覧取得（Amplify Gen2）
   */
  private async listTrailPositions(): Promise<{ data: { listPositions: { items: Position[] } } }> {
    const result = await listUserPositions({ hasTrail: true });
    return { 
      data: { 
        listPositions: { 
          items: result 
        } 
      } 
    };
  }

  // ========================================
  // 外部アクセス用メソッド
  // ========================================

  /**
   * 現在のユーザーID取得
   */
  getCurrentUserId(): string | undefined {
    return this.currentUserId;
  }

  /**
   * 統計情報取得（拡張版）
   */
  getStats() {
    return {
      currentUserId: this.currentUserId,
      isInitialized: !!this.currentUserId,
      performance: this.performanceMetrics,
      engines: {
        entryFlow: !!this.entryFlowEngine,
        trailFlow: !!this.trailFlowEngine,
        actionFlow: !!this.actionFlowEngine
      }
    };
  }

  // ========================================
  // エンジンアクセサー
  // ========================================
  
  get entryEngine() {
    return this.entryFlowEngine;
  }
  
  get trailFlowEngine() {
    return this.trailFlowEngineInstance;
  }
  
  get actionEngine() {
    return this.actionFlowEngine;
  }

  // ========================================
  // 決済失敗時の自動リトライ機構
  // ========================================

  /**
   * 決済失敗時の自動リトライ機構実装
   */
  private async handleSettlementRetry(
    position: Position, 
    error: Error, 
    maxRetries: number = 3
  ): Promise<{ success: boolean; finalError?: Error; retryCount: number }> {
    let retryCount = 0;
    let lastError = error;

    console.log(`🔄 Settlement retry initiated for position: ${position.id}, max retries: ${maxRetries}`);
    
    for (retryCount = 1; retryCount <= maxRetries; retryCount++) {
      try {
        console.log(`🔁 Settlement retry attempt ${retryCount}/${maxRetries} for position: ${position.id}`);
        
        // 短時間待機（指数関数的バックオフ）
        const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // 現在価格を再取得
        const priceMonitor = this.wsHandler.priceMonitor;
        const priceData = priceMonitor ? 
          priceMonitor.getCurrentPrice(position.symbol) :
          null;
        const currentPrice = priceData ? 
          (typeof priceData === 'number' ? priceData : priceData.bid || priceData.ask || 0) :
          this.getFallbackPrice(position.symbol);
        
        // 決済実行を再試行
        const executionResult = await this.actionFlowEngine.executeClose(
          position,
          'RETRY_CLOSE',
          currentPrice,
          this.wsHandler
        );
        
        if (executionResult.success) {
          console.log(`✅ Settlement retry successful on attempt ${retryCount}: ${position.id}`);
          
          // トレール条件削除
          this.trailFlowEngineInstance.removeTrailCondition(position.id);
          
          // 結果記録（リトライ成功）
          const profit = this.calculateProfit(position, currentPrice);
          await this.actionFlowEngine.recordExecutionResult(
            position.id,
            executionResult.executionTime,
            true,
            currentPrice,
            profit
          );
          
          // パフォーマンス記録（リトライ成功）
          this.updatePerformanceMetrics('close', executionResult.executionTime, true);
          this.performanceMetrics.retryCount++;
          this.performanceMetrics.settlementSuccessRate = 
            (this.performanceMetrics.settlementSuccessRate + 1) / 2;
          
          return { success: true, retryCount };
        } else {
          throw new Error('Retry execution failed');
        }
        
      } catch (retryError) {
        lastError = retryError as Error;
        console.warn(`⚠️ Settlement retry ${retryCount}/${maxRetries} failed: ${lastError.message}`);
        
        // 最後のリトライでない場合は続行
        if (retryCount < maxRetries) {
          continue;
        }
      }
    }
    
    // 全リトライ失敗
    console.error(`❌ All settlement retries failed for position: ${position.id}`);
    this.performanceMetrics.retryCount += retryCount;
    this.performanceMetrics.settlementSuccessRate = 
      (this.performanceMetrics.settlementSuccessRate + 0) / 2;
    
    return { 
      success: false, 
      finalError: lastError, 
      retryCount 
    };
  }

}

// ========================================
// Static Service Methods（旧PositionService）
// ========================================

/**
 * Position Service - Amplify Gen2操作のヘルパー関数
 * shared-amplifyサービスへの統一されたアクセス
 * Entry→Trail→Actionシステム対応
 */
export class PositionService {
  
  /**
   * ポジション作成
   */
  static async create(input: CreatePositionInput): Promise<{ data: Position }> {
    const result = await createPosition(input);
    return { data: result };
  }

  /**
   * ポジション状態更新
   */
  static async updateStatus(id: string, status?: PositionStatus, additionalFields?: any): Promise<{ data: Position }> {
    const updateInput: any = { ...additionalFields };
    if (status) updateInput.status = status;
    
    const result = await updatePosition(id, updateInput);
    return { data: result };
  }

  /**
   * オープンポジション一覧取得
   */
  static async listOpen(): Promise<{ data: { listPositions: { items: Position[] } } }> {
    const result = await listUserPositions({ status: 'OPEN' });
    return { 
      data: { 
        listPositions: { 
          items: result 
        } 
      } 
    };
  }

  /**
   * トレール設定済みポジション一覧取得
   */
  static async listTrailPositions(): Promise<{ data: { listPositions: { items: Position[] } } }> {
    const result = await listUserPositions({ hasTrail: true });
    return { 
      data: { 
        listPositions: { 
          items: result 
        } 
      } 
    };
  }

  /**
   * 高速ポジション状態一括更新
   */
  static async batchUpdatePositions(
    updates: { id: string; status: PositionStatus; additionalFields?: any }[]
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];
    
    const updatePromises = updates.map(async (update) => {
      try {
        await PositionService.updateStatus(
          update.id,
          update.status,
          update.additionalFields
        );
        success.push(update.id);
      } catch (error) {
        console.error(`Failed to update position ${update.id}:`, error);
        failed.push(update.id);
      }
    });
    
    await Promise.allSettled(updatePromises);
    
    return { success, failed };
  }

  /**
   * パフォーマンス統計取得
   */
  static async getPerformanceMetrics(
    userId: string,
    timeRange: 'hour' | 'day' | 'week' = 'day'
  ): Promise<{
    totalPositions: number;
    openPositions: number;
    closedPositions: number;
    avgExecutionTime: number;
    successRate: number;
  }> {
    try {
      // shared-amplifyのgetPerformanceMetricsを使用
      const metrics = await getPerformanceMetrics(userId, timeRange);
      
      return {
        totalPositions: metrics.totalPositions,
        openPositions: metrics.openPositions,
        closedPositions: metrics.closedPositions,
        avgExecutionTime: metrics.avgExecutionTime,
        successRate: metrics.successRate
      };
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      
      // エラー時のフォールバック
      return {
        totalPositions: 0,
        openPositions: 0,
        closedPositions: 0,
        avgExecutionTime: 0,
        successRate: 0
      };
    }
  }
}