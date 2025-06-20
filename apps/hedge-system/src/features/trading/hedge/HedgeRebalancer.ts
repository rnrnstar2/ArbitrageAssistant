import { EventEmitter } from 'events';
import { HedgePosition, HedgeDetectionCriteria } from './types';
import { HedgeBalanceCalculator, RebalanceAction, RebalanceStep } from './HedgeBalanceCalculator';
import { HedgeExecutor, HedgeExecutionCriteria, HedgeResult } from './HedgeExecutor';
import { HedgePositionValidator } from './HedgePositionValidator';
import { WebSocketClient } from '../../../../lib/websocket/message-types';

/**
 * リバランス対象設定
 */
export interface RebalanceTarget {
  hedgeId: string;
  targetBalance: {
    buy: number;
    sell: number;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  maxCost: number;
  maxRisk: number;
  reason: string;
}

/**
 * リバランススケジュール
 */
export interface RebalanceSchedule {
  hedgeId: string;
  type: 'time_based' | 'condition_based' | 'manual';
  interval?: number; // 分単位
  conditions?: RebalanceCondition[];
  enabled: boolean;
  nextExecution?: Date;
  lastExecution?: Date;
  maxExecutionsPerDay: number;
  executionCount: number;
}

/**
 * リバランス条件
 */
export interface RebalanceCondition {
  type: 'imbalance_threshold' | 'risk_threshold' | 'profit_threshold' | 'time_window';
  threshold: number;
  comparator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  enabled: boolean;
}

/**
 * リバランス結果
 */
export interface RebalanceResult {
  rebalanceId: string;
  hedgeId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  type: 'auto' | 'manual' | 'scheduled';
  target: RebalanceTarget;
  actions: RebalanceStep[];
  executions: HedgeResult[];
  startTime: Date;
  endTime?: Date;
  success: boolean;
  error?: string;
  metrics: {
    costIncurred: number;
    riskReduction: number;
    balanceImprovement: number;
    executionTime: number;
  };
}

/**
 * リバランス統計
 */
export interface RebalanceStatistics {
  hedgeId: string;
  totalRebalances: number;
  successRate: number;
  averageCost: number;
  averageRiskReduction: number;
  lastRebalance?: Date;
  nextScheduledRebalance?: Date;
  performanceMetrics: {
    totalCostSaved: number;
    totalRiskReduced: number;
    averageExecutionTime: number;
  };
}

/**
 * リバランス設定
 */
export interface RebalanceSettings {
  autoRebalanceEnabled: boolean;
  maxDailyRebalances: number;
  costThreshold: number;
  riskThreshold: number;
  minIntervalMinutes: number;
  emergencyRebalanceEnabled: boolean;
  notifications: {
    onRebalanceStart: boolean;
    onRebalanceComplete: boolean;
    onRebalanceFailure: boolean;
  };
}

/**
 * 両建てリバランス機能
 */
export class HedgeRebalancer extends EventEmitter {
  private balanceCalculator: HedgeBalanceCalculator;
  private executor: HedgeExecutor;
  private validator: HedgePositionValidator;
  
  private activeRebalances = new Map<string, RebalanceResult>();
  private schedules = new Map<string, RebalanceSchedule>();
  private settings: RebalanceSettings;
  private statistics = new Map<string, RebalanceStatistics>();
  
  private scheduleTimers = new Map<string, NodeJS.Timeout>();
  private maxConcurrentRebalances = 3;
  private currentRebalances = 0;

  constructor(
    balanceCalculator: HedgeBalanceCalculator,
    executor: HedgeExecutor,
    validator: HedgePositionValidator,
    settings?: Partial<RebalanceSettings>
  ) {
    super();
    
    this.balanceCalculator = balanceCalculator;
    this.executor = executor;
    this.validator = validator;
    
    this.settings = {
      autoRebalanceEnabled: true,
      maxDailyRebalances: 10,
      costThreshold: 0.001, // 0.1%
      riskThreshold: 50,
      minIntervalMinutes: 15,
      emergencyRebalanceEnabled: true,
      notifications: {
        onRebalanceStart: true,
        onRebalanceComplete: true,
        onRebalanceFailure: true
      },
      ...settings
    };
  }

  /**
   * 自動リバランスを実行
   */
  async executeAutoRebalance(hedge: HedgePosition): Promise<RebalanceResult> {
    if (!this.settings.autoRebalanceEnabled) {
      throw new Error('Auto rebalance is disabled');
    }

    // 日次制限チェック
    const stats = this.getStatistics(hedge.id);
    if (stats && this.isDailyLimitExceeded(hedge.id)) {
      throw new Error('Daily rebalance limit exceeded');
    }

    // リバランス必要性の判定
    const requirement = this.balanceCalculator.calculateRebalanceRequirement(hedge);
    if (!requirement.required) {
      throw new Error('No rebalance required');
    }

    // 自動リバランス対象の生成
    const target = this.generateAutoRebalanceTarget(hedge, requirement);
    
    return this.executeRebalanceInternal(hedge, target, 'auto');
  }

  /**
   * 手動リバランスを実行
   */
  async executeManualRebalance(hedge: HedgePosition, target: RebalanceTarget): Promise<RebalanceResult> {
    // 手動リバランスのバリデーション
    const validation = this.validateRebalanceTarget(hedge, target);
    if (!validation.isValid) {
      throw new Error(`Invalid rebalance target: ${validation.issues.map(i => i.description).join(', ')}`);
    }

    return this.executeRebalanceInternal(hedge, target, 'manual');
  }

  /**
   * リバランスアクションを計算
   */
  calculateRebalanceActions(hedge: HedgePosition): RebalanceAction {
    return this.balanceCalculator.calculateRebalanceRequirement(hedge);
  }

  /**
   * リバランススケジュールを設定
   */
  scheduleRebalance(hedge: HedgePosition, schedule: RebalanceSchedule): void {
    // 既存スケジュールのクリア
    this.clearSchedule(hedge.id);
    
    // 新しいスケジュールの設定
    this.schedules.set(hedge.id, {
      ...schedule,
      executionCount: 0,
      lastExecution: undefined
    });

    // タイマーの設定
    if (schedule.enabled && schedule.type === 'time_based' && schedule.interval) {
      this.setupScheduleTimer(hedge.id, schedule);
    }

    this.emit('scheduleUpdated', { hedgeId: hedge.id, schedule });
  }

  /**
   * スケジュールを停止
   */
  clearSchedule(hedgeId: string): void {
    const timer = this.scheduleTimers.get(hedgeId);
    if (timer) {
      clearInterval(timer);
      this.scheduleTimers.delete(hedgeId);
    }
    
    this.schedules.delete(hedgeId);
    this.emit('scheduleCleared', { hedgeId });
  }

  /**
   * リバランスをキャンセル
   */
  async cancelRebalance(rebalanceId: string): Promise<void> {
    const rebalance = this.activeRebalances.get(rebalanceId);
    if (!rebalance) {
      throw new Error(`Rebalance ${rebalanceId} not found`);
    }

    if (rebalance.status === 'completed' || rebalance.status === 'failed') {
      throw new Error(`Cannot cancel rebalance in status: ${rebalance.status}`);
    }

    // 実行中のアクションをキャンセル
    for (const execution of rebalance.executions) {
      if (execution.status === 'executing' || execution.status === 'pending') {
        try {
          await this.executor.cancelHedgeExecution(execution.executionId);
        } catch (error) {
          console.warn(`Failed to cancel execution ${execution.executionId}:`, error);
        }
      }
    }

    rebalance.status = 'cancelled';
    rebalance.endTime = new Date();
    rebalance.success = false;
    rebalance.error = 'Cancelled by user';

    this.currentRebalances = Math.max(0, this.currentRebalances - 1);
    this.emit('rebalanceCancelled', rebalance);
  }

  /**
   * リバランス結果を取得
   */
  getRebalanceResult(rebalanceId: string): RebalanceResult | null {
    return this.activeRebalances.get(rebalanceId) || null;
  }

  /**
   * アクティブなリバランス一覧を取得
   */
  getActiveRebalances(): RebalanceResult[] {
    return Array.from(this.activeRebalances.values())
      .filter(r => r.status === 'pending' || r.status === 'executing');
  }

  /**
   * 統計情報を取得
   */
  getStatistics(hedgeId: string): RebalanceStatistics | null {
    return this.statistics.get(hedgeId) || null;
  }

  /**
   * 設定を更新
   */
  updateSettings(newSettings: Partial<RebalanceSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settingsUpdated', this.settings);
  }

  /**
   * 条件ベースの自動チェック
   */
  checkConditionBasedRebalances(hedge: HedgePosition): boolean {
    const schedule = this.schedules.get(hedge.id);
    if (!schedule || !schedule.enabled || schedule.type !== 'condition_based') {
      return false;
    }

    // 最小間隔チェック
    if (schedule.lastExecution) {
      const timeSinceLastExecution = Date.now() - schedule.lastExecution.getTime();
      const minInterval = this.settings.minIntervalMinutes * 60 * 1000;
      if (timeSinceLastExecution < minInterval) {
        return false;
      }
    }

    // 条件チェック
    const balance = this.balanceCalculator.calculateHedgeBalance(hedge);
    const risk = this.balanceCalculator.calculateRiskMetrics(hedge);
    
    for (const condition of schedule.conditions || []) {
      if (!condition.enabled) continue;
      
      let value: number;
      switch (condition.type) {
        case 'imbalance_threshold':
          value = balance.imbalancePercentage;
          break;
        case 'risk_threshold':
          value = balance.riskScore;
          break;
        case 'profit_threshold':
          value = balance.totalProfit;
          break;
        default:
          continue;
      }
      
      if (this.evaluateCondition(value, condition.threshold, condition.comparator)) {
        // 条件が満たされた場合、自動リバランスを実行
        this.executeAutoRebalance(hedge).catch(error => {
          console.error(`Auto rebalance failed for hedge ${hedge.id}:`, error);
          this.emit('rebalanceError', { hedgeId: hedge.id, error });
        });
        return true;
      }
    }
    
    return false;
  }

  /**
   * 内部的なリバランス実行
   */
  private async executeRebalanceInternal(
    hedge: HedgePosition, 
    target: RebalanceTarget, 
    type: 'auto' | 'manual' | 'scheduled'
  ): Promise<RebalanceResult> {
    if (this.currentRebalances >= this.maxConcurrentRebalances) {
      throw new Error('Maximum concurrent rebalances reached');
    }

    const rebalanceId = this.generateRebalanceId();
    this.currentRebalances++;

    const result: RebalanceResult = {
      rebalanceId,
      hedgeId: hedge.id,
      status: 'pending',
      type,
      target,
      actions: [],
      executions: [],
      startTime: new Date(),
      success: false,
      metrics: {
        costIncurred: 0,
        riskReduction: 0,
        balanceImprovement: 0,
        executionTime: 0
      }
    };

    this.activeRebalances.set(rebalanceId, result);

    try {
      // リバランスアクションの計算
      const rebalanceAction = this.balanceCalculator.calculateRebalanceRequirement(hedge);
      result.actions = rebalanceAction.actions;
      result.status = 'executing';

      this.emit('rebalanceStarted', result);

      // アクションの実行
      for (const action of rebalanceAction.actions) {
        const executionCriteria = this.convertActionToExecutionCriteria(hedge, action);
        const hedgeResult = await this.executor.executeHedge(executionCriteria);
        result.executions.push(hedgeResult);

        // 実行結果の評価
        if (!hedgeResult.status || hedgeResult.status === 'failed') {
          throw new Error(`Action execution failed: ${hedgeResult.error}`);
        }
      }

      // 実行完了
      result.status = 'completed';
      result.success = true;
      result.endTime = new Date();

      // メトリクス計算
      result.metrics = this.calculateRebalanceMetrics(hedge, result);

      // 統計更新
      this.updateStatistics(hedge.id, result);

      this.emit('rebalanceCompleted', result);

    } catch (error) {
      result.status = 'failed';
      result.success = false;
      result.endTime = new Date();
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.metrics.executionTime = Date.now() - result.startTime.getTime();

      this.emit('rebalanceFailed', result);
      throw error;

    } finally {
      this.currentRebalances = Math.max(0, this.currentRebalances - 1);
    }

    return result;
  }

  /**
   * 自動リバランス対象を生成
   */
  private generateAutoRebalanceTarget(hedge: HedgePosition, requirement: RebalanceAction): RebalanceTarget {
    const balance = this.balanceCalculator.calculateHedgeBalance(hedge);
    
    return {
      hedgeId: hedge.id,
      targetBalance: {
        buy: Math.max(balance.totalBuyLots, balance.totalSellLots),
        sell: Math.max(balance.totalBuyLots, balance.totalSellLots)
      },
      priority: requirement.urgency === 'high' ? 'critical' : 
                requirement.urgency === 'medium' ? 'high' : 'medium',
      maxCost: requirement.estimatedCost * 1.5,
      maxRisk: this.settings.riskThreshold,
      reason: 'Automatic rebalance based on risk analysis'
    };
  }

  /**
   * リバランス対象のバリデーション
   */
  private validateRebalanceTarget(hedge: HedgePosition, target: RebalanceTarget): any {
    const issues: any[] = [];

    if (target.hedgeId !== hedge.id) {
      issues.push({ description: 'Hedge ID mismatch' });
    }

    if (target.targetBalance.buy < 0 || target.targetBalance.sell < 0) {
      issues.push({ description: 'Target balance cannot be negative' });
    }

    if (target.maxCost < 0) {
      issues.push({ description: 'Max cost cannot be negative' });
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * アクションを実行条件に変換
   */
  private convertActionToExecutionCriteria(hedge: HedgePosition, action: RebalanceStep): HedgeExecutionCriteria {
    return {
      symbol: hedge.symbol,
      hedgeType: 'partial',
      accounts: hedge.accounts,
      lotSizes: {
        buy: action.positionType === 'buy' ? action.lots : 0,
        sell: action.positionType === 'sell' ? action.lots : 0
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
  }

  /**
   * リバランスメトリクスを計算
   */
  private calculateRebalanceMetrics(hedge: HedgePosition, result: RebalanceResult): RebalanceResult['metrics'] {
    const executionTime = result.endTime ? 
      result.endTime.getTime() - result.startTime.getTime() : 0;

    let costIncurred = 0;
    for (const execution of result.executions) {
      // 実行コストの概算（スプレッド等）
      costIncurred += (execution.results.buy?.lotSize || 0) * 0.001;
      costIncurred += (execution.results.sell?.lotSize || 0) * 0.001;
    }

    // リスク軽減度とバランス改善度の計算（簡易版）
    const newBalance = this.balanceCalculator.calculateHedgeBalance(hedge);
    const riskReduction = Math.max(0, 100 - newBalance.riskScore);
    const balanceImprovement = 100 - newBalance.imbalancePercentage;

    return {
      costIncurred,
      riskReduction,
      balanceImprovement,
      executionTime
    };
  }

  /**
   * 統計情報を更新
   */
  private updateStatistics(hedgeId: string, result: RebalanceResult): void {
    const existing = this.statistics.get(hedgeId) || {
      hedgeId,
      totalRebalances: 0,
      successRate: 0,
      averageCost: 0,
      averageRiskReduction: 0,
      performanceMetrics: {
        totalCostSaved: 0,
        totalRiskReduced: 0,
        averageExecutionTime: 0
      }
    };

    existing.totalRebalances++;
    existing.lastRebalance = result.endTime;
    
    // 成功率の更新
    const previousSuccesses = Math.round(existing.successRate * (existing.totalRebalances - 1) / 100);
    const newSuccesses = previousSuccesses + (result.success ? 1 : 0);
    existing.successRate = (newSuccesses / existing.totalRebalances) * 100;

    // 平均値の更新
    if (result.success) {
      existing.averageCost = this.updateRunningAverage(
        existing.averageCost, result.metrics.costIncurred, newSuccesses
      );
      existing.averageRiskReduction = this.updateRunningAverage(
        existing.averageRiskReduction, result.metrics.riskReduction, newSuccesses
      );
      existing.performanceMetrics.averageExecutionTime = this.updateRunningAverage(
        existing.performanceMetrics.averageExecutionTime, result.metrics.executionTime, newSuccesses
      );
      
      existing.performanceMetrics.totalRiskReduced += result.metrics.riskReduction;
    }

    this.statistics.set(hedgeId, existing);
  }

  /**
   * 実行時間平均の更新
   */
  private updateRunningAverage(currentAvg: number, newValue: number, count: number): number {
    return (currentAvg * (count - 1) + newValue) / count;
  }

  /**
   * 日次制限チェック
   */
  private isDailyLimitExceeded(hedgeId: string): boolean {
    const schedule = this.schedules.get(hedgeId);
    if (!schedule) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastExecution = schedule.lastExecution;
    if (!lastExecution) return false;

    const lastExecutionDate = new Date(lastExecution);
    lastExecutionDate.setHours(0, 0, 0, 0);

    // 同じ日の場合のみ実行回数をチェック
    if (today.getTime() === lastExecutionDate.getTime()) {
      return schedule.executionCount >= schedule.maxExecutionsPerDay;
    }

    return false;
  }

  /**
   * スケジュールタイマーの設定
   */
  private setupScheduleTimer(hedgeId: string, schedule: RebalanceSchedule): void {
    if (!schedule.interval) return;

    const timer = setInterval(async () => {
      if (!schedule.enabled) return;

      try {
        // 日次制限チェック
        if (this.isDailyLimitExceeded(hedgeId)) {
          return;
        }

        // ここでは実際のHedgePositionを取得する必要がある
        // 実装では外部からHedgePositionを取得するメソッドを呼び出す
        this.emit('scheduledRebalanceRequested', { hedgeId, schedule });
        
      } catch (error) {
        console.error(`Scheduled rebalance failed for hedge ${hedgeId}:`, error);
        this.emit('rebalanceError', { hedgeId, error });
      }
    }, schedule.interval * 60 * 1000); // 分を毫秒に変換

    this.scheduleTimers.set(hedgeId, timer);
  }

  /**
   * 条件評価
   */
  private evaluateCondition(value: number, threshold: number, comparator: string): boolean {
    switch (comparator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  /**
   * リバランスIDを生成
   */
  private generateRebalanceId(): string {
    return `rebalance_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    // スケジュールタイマーをクリア
    this.scheduleTimers.forEach(timer => clearInterval(timer));
    this.scheduleTimers.clear();

    // アクティブリバランスをクリア
    this.activeRebalances.clear();
    
    // スケジュールをクリア
    this.schedules.clear();
    
    // 統計をクリア
    this.statistics.clear();

    // イベントリスナーを削除
    this.removeAllListeners();
  }
}