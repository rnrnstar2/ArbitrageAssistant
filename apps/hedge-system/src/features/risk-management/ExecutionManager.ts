import { EventEmitter } from 'events';
import { RebalanceStrategy, RebalanceExecutionResult, SafetySettings } from './CrossAccountRebalancer';
import { CrossAccountHedge, CrossHedgeResult } from '../trading/hedge/CrossAccountHedge';

/**
 * 実行ステップ
 */
export interface ExecutionStep {
  stepId: string;
  strategyId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped' | 'rolled_back';
  startTime?: Date;
  endTime?: Date;
  result?: CrossHedgeResult;
  error?: string;
  rollbackData?: RollbackData;
  dependencies: string[]; // 依存するステップのID
  retryCount: number;
  maxRetries: number;
}

/**
 * ロールバックデータ
 */
export interface RollbackData {
  rollbackId: string;
  originalPositions: Array<{
    accountId: string;
    positionId: string;
    symbol: string;
    direction: 'BUY' | 'SELL';
    lotSize: number;
    openPrice: number;
  }>;
  rollbackActions: Array<{
    action: 'close_position' | 'open_position' | 'adjust_position';
    accountId: string;
    parameters: Record<string, any>;
  }>;
  createdAt: Date;
  isExecuted: boolean;
}

/**
 * 実行監視メトリクス
 */
export interface ExecutionMetrics {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  averageExecutionTime: number;
  successRate: number;
  currentThroughput: number; // steps per minute
  estimatedCompletionTime?: Date;
}

/**
 * 安全チェック結果
 */
export interface SafetyCheckResult {
  checkId: string;
  timestamp: Date;
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    currentValue?: number;
    threshold?: number;
  }>;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  recommendation: 'proceed' | 'proceed_with_caution' | 'delay' | 'abort';
}

/**
 * 緊急停止条件
 */
export interface EmergencyStopCondition {
  id: string;
  name: string;
  condition: (metrics: ExecutionMetrics, safetyCheck: SafetyCheckResult) => boolean;
  action: 'pause' | 'rollback' | 'emergency_stop';
  enabled: boolean;
}

/**
 * 実行管理クラス
 */
export class ExecutionManager extends EventEmitter {
  private crossAccountHedge: CrossAccountHedge;
  private safetySettings: SafetySettings;
  private emergencyStopConditions: EmergencyStopCondition[] = [];

  private activeExecutions = new Map<string, RebalanceExecutionResult>();
  private executionSteps = new Map<string, ExecutionStep[]>();
  private rollbackHistory = new Map<string, RollbackData[]>();
  
  private readonly maxConcurrentSteps = 3;
  private currentlyExecutingSteps = 0;
  private isPaused = false;
  private isEmergencyStopped = false;

  constructor(
    crossAccountHedge: CrossAccountHedge,
    safetySettings: SafetySettings
  ) {
    super();
    
    this.crossAccountHedge = crossAccountHedge;
    this.safetySettings = safetySettings;
    
    this.initializeEmergencyStopConditions();
    this.startSafetyMonitoring();
  }

  /**
   * リバランス実行の開始
   */
  async executeRebalance(
    rebalanceId: string,
    strategies: RebalanceStrategy[],
    skipSafetyChecks = false
  ): Promise<void> {
    if (this.isEmergencyStopped) {
      throw new Error('Execution is emergency stopped');
    }

    // 実行前安全チェック
    if (!skipSafetyChecks) {
      const safetyCheck = await this.performSafetyCheck(strategies);
      if (!safetyCheck.passed) {
        throw new Error(`Safety check failed: ${safetyCheck.checks.filter(c => !c.passed).map(c => c.message).join(', ')}`);
      }

      if (safetyCheck.recommendation === 'abort') {
        throw new Error('Safety check recommends aborting execution');
      }

      if (safetyCheck.recommendation === 'delay') {
        this.emit('executionDelayed', { rebalanceId, reason: 'Safety check recommends delay' });
        return;
      }
    }

    // 実行ステップの生成
    const steps = this.generateExecutionSteps(rebalanceId, strategies);
    this.executionSteps.set(rebalanceId, steps);

    // 実行開始
    this.emit('executionStarted', { rebalanceId, totalSteps: steps.length });

    try {
      await this.executeStepsSequentially(rebalanceId, steps);
      this.emit('executionCompleted', { rebalanceId });
    } catch (error) {
      this.emit('executionFailed', { rebalanceId, error });
      
      // 自動ロールバック
      if (this.safetySettings.emergencyStopConditions.maxLossThreshold > 0) {
        await this.initiateRollback(rebalanceId, 'execution_failure');
      }
      
      throw error;
    }
  }

  /**
   * 実行ステップの順次実行
   */
  private async executeStepsSequentially(rebalanceId: string, steps: ExecutionStep[]): Promise<void> {
    const pendingSteps = [...steps];
    const completedSteps = new Set<string>();

    while (pendingSteps.length > 0 && !this.isEmergencyStopped) {
      // 一時停止チェック
      if (this.isPaused) {
        this.emit('executionPaused', { rebalanceId });
        await this.waitForResume();
      }

      // 実行可能なステップを特定
      const executableSteps = pendingSteps.filter(step => 
        step.dependencies.every(depId => completedSteps.has(depId)) &&
        this.currentlyExecutingSteps < this.maxConcurrentSteps
      );

      if (executableSteps.length === 0) {
        // デッドロックまたは依存関係の問題
        const waitingSteps = pendingSteps.filter(step => step.status === 'pending');
        if (waitingSteps.length > 0 && this.currentlyExecutingSteps === 0) {
          throw new Error('Deadlock detected in execution dependencies');
        }
        
        // 実行中のステップの完了を待つ
        await this.delay(1000);
        continue;
      }

      // ステップの並列実行
      const promises = executableSteps.slice(0, this.maxConcurrentSteps - this.currentlyExecutingSteps)
        .map(step => this.executeStep(rebalanceId, step));

      await Promise.allSettled(promises);

      // 完了したステップを確認
      for (const step of executableSteps) {
        if (step.status === 'completed' || step.status === 'failed' || step.status === 'skipped') {
          completedSteps.add(step.stepId);
          const index = pendingSteps.findIndex(s => s.stepId === step.stepId);
          if (index >= 0) {
            pendingSteps.splice(index, 1);
          }
        }
      }

      // 失敗したステップの処理
      const failedSteps = executableSteps.filter(step => step.status === 'failed');
      for (const failedStep of failedSteps) {
        if (failedStep.retryCount < failedStep.maxRetries) {
          // リトライ
          failedStep.retryCount++;
          failedStep.status = 'pending';
          failedStep.error = undefined;
          
          this.emit('stepRetry', {
            rebalanceId,
            stepId: failedStep.stepId,
            retryCount: failedStep.retryCount
          });
        } else {
          // 最大リトライ回数に達した場合、依存するステップをスキップ
          this.markDependentStepsAsSkipped(steps, failedStep.stepId);
        }
      }

      // 進捗レポート
      const metrics = this.calculateExecutionMetrics(steps);
      this.emit('executionProgress', { rebalanceId, metrics });

      // 緊急停止条件チェック
      await this.checkEmergencyStopConditions(rebalanceId, metrics);
    }

    // 最終チェック
    const failedSteps = steps.filter(step => step.status === 'failed');
    if (failedSteps.length > 0) {
      throw new Error(`Execution failed with ${failedSteps.length} failed steps`);
    }
  }

  /**
   * 個別ステップの実行
   */
  private async executeStep(rebalanceId: string, step: ExecutionStep): Promise<void> {
    this.currentlyExecutingSteps++;
    step.status = 'executing';
    step.startTime = new Date();

    this.emit('stepStarted', { rebalanceId, stepId: step.stepId });

    try {
      // ロールバックデータの準備
      step.rollbackData = await this.prepareRollbackData(step.strategyId);

      // 戦略の実行
      const strategy = this.findStrategyById(rebalanceId, step.strategyId);
      if (!strategy) {
        throw new Error(`Strategy ${step.strategyId} not found`);
      }

      step.result = await this.executeStrategy(strategy);
      
      step.status = 'completed';
      step.endTime = new Date();

      this.emit('stepCompleted', { 
        rebalanceId, 
        stepId: step.stepId, 
        executionTime: step.endTime.getTime() - step.startTime.getTime() 
      });

    } catch (error) {
      step.status = 'failed';
      step.endTime = new Date();
      step.error = error instanceof Error ? error.message : 'Unknown error';

      this.emit('stepFailed', { 
        rebalanceId, 
        stepId: step.stepId, 
        error: step.error 
      });

    } finally {
      this.currentlyExecutingSteps = Math.max(0, this.currentlyExecutingSteps - 1);
    }
  }

  /**
   * 戦略の実行
   */
  private async executeStrategy(strategy: RebalanceStrategy): Promise<CrossHedgeResult> {
    switch (strategy.action) {
      case 'transfer_position':
        return this.crossAccountHedge.executeCrossAccountHedge(
          [strategy.sourceAccount, strategy.targetAccount],
          'EURUSD', // 実際の実装では動的に決定
          strategy.amount / 100000,
          1.0
        );

      case 'close_and_reopen':
        // 簡易実装
        return {
          crossHedgeId: `mock_${Date.now()}`,
          status: 'completed',
          accounts: [strategy.sourceAccount, strategy.targetAccount],
          symbol: 'EURUSD',
          totalLots: { buy: 0.1, sell: 0.1 },
          executionResults: new Map(),
          startTime: new Date(),
          completionTime: new Date(),
          compensationRequired: false,
          compensationActions: []
        };

      default:
        throw new Error(`Unsupported strategy action: ${strategy.action}`);
    }
  }

  /**
   * 安全チェックの実行
   */
  async performSafetyCheck(strategies: RebalanceStrategy[]): Promise<SafetyCheckResult> {
    const checkId = this.generateCheckId();
    const checks: SafetyCheckResult['checks'] = [];

    // 最大損失チェック
    const totalCost = strategies.reduce((sum, s) => sum + s.estimatedCost, 0);
    checks.push({
      name: 'max_loss_check',
      passed: totalCost <= this.safetySettings.emergencyStopConditions.maxLossThreshold,
      severity: totalCost > this.safetySettings.emergencyStopConditions.maxLossThreshold ? 'critical' : 'info',
      message: `Total estimated cost: ${totalCost}`,
      currentValue: totalCost,
      threshold: this.safetySettings.emergencyStopConditions.maxLossThreshold
    });

    // ポジションサイズチェック
    for (const strategy of strategies) {
      const sizeCheck = strategy.amount <= this.safetySettings.maxPositionSizeChange * 100000;
      checks.push({
        name: 'position_size_check',
        passed: sizeCheck,
        severity: sizeCheck ? 'info' : 'error',
        message: `Strategy ${strategy.sourceAccount}->${strategy.targetAccount} amount: ${strategy.amount}`,
        currentValue: strategy.amount,
        threshold: this.safetySettings.maxPositionSizeChange * 100000
      });
    }

    // ブラックリストチェック
    for (const strategy of strategies) {
      const isBlacklisted = this.safetySettings.blacklistAccounts.includes(strategy.sourceAccount) ||
                           this.safetySettings.blacklistAccounts.includes(strategy.targetAccount);
      checks.push({
        name: 'blacklist_check',
        passed: !isBlacklisted,
        severity: isBlacklisted ? 'critical' : 'info',
        message: `Account blacklist check for ${strategy.sourceAccount}->${strategy.targetAccount}`
      });
    }

    const failedChecks = checks.filter(c => !c.passed);
    const criticalFailures = failedChecks.filter(c => c.severity === 'critical');
    const errorFailures = failedChecks.filter(c => c.severity === 'error');

    let overallRisk: SafetyCheckResult['overallRisk'] = 'low';
    let recommendation: SafetyCheckResult['recommendation'] = 'proceed';

    if (criticalFailures.length > 0) {
      overallRisk = 'critical';
      recommendation = 'abort';
    } else if (errorFailures.length > 0) {
      overallRisk = 'high';
      recommendation = 'delay';
    } else if (failedChecks.length > 0) {
      overallRisk = 'medium';
      recommendation = 'proceed_with_caution';
    }

    return {
      checkId,
      timestamp: new Date(),
      passed: failedChecks.length === 0,
      checks,
      overallRisk,
      recommendation
    };
  }

  /**
   * ロールバックの開始
   */
  async initiateRollback(rebalanceId: string, reason: string): Promise<void> {
    const steps = this.executionSteps.get(rebalanceId);
    if (!steps) {
      throw new Error(`No execution steps found for rebalance ${rebalanceId}`);
    }

    this.emit('rollbackStarted', { rebalanceId, reason });

    const completedSteps = steps.filter(step => step.status === 'completed' && step.rollbackData);
    const rollbackActions: RollbackData[] = [];

    for (const step of completedSteps.reverse()) { // 逆順で実行
      if (step.rollbackData) {
        try {
          await this.executeRollbackData(step.rollbackData);
          step.status = 'rolled_back';
          rollbackActions.push(step.rollbackData);

          this.emit('stepRolledBack', { 
            rebalanceId, 
            stepId: step.stepId 
          });

        } catch (error) {
          this.emit('rollbackStepFailed', { 
            rebalanceId, 
            stepId: step.stepId, 
            error 
          });
        }
      }
    }

    this.rollbackHistory.set(rebalanceId, rollbackActions);
    this.emit('rollbackCompleted', { rebalanceId, actionsExecuted: rollbackActions.length });
  }

  /**
   * 緊急停止
   */
  async emergencyStop(reason: string): Promise<void> {
    this.isEmergencyStopped = true;
    this.emit('emergencyStop', { reason, timestamp: new Date() });

    // 実行中の全ステップを停止
    for (const [rebalanceId] of this.activeExecutions) {
      try {
        await this.initiateRollback(rebalanceId, `Emergency stop: ${reason}`);
      } catch (error) {
        console.error(`Failed to rollback ${rebalanceId} during emergency stop:`, error);
      }
    }
  }

  /**
   * 実行の一時停止
   */
  pause(): void {
    this.isPaused = true;
    this.emit('executionPaused', { timestamp: new Date() });
  }

  /**
   * 実行の再開
   */
  resume(): void {
    this.isPaused = false;
    this.emit('executionResumed', { timestamp: new Date() });
  }

  /**
   * 緊急停止の解除
   */
  clearEmergencyStop(): void {
    this.isEmergencyStopped = false;
    this.emit('emergencyStopCleared', { timestamp: new Date() });
  }

  // ユーティリティメソッド
  private generateExecutionSteps(rebalanceId: string, strategies: RebalanceStrategy[]): ExecutionStep[] {
    return strategies.map((strategy, index) => ({
      stepId: `${rebalanceId}_step_${index}`,
      strategyId: `strategy_${index}`,
      status: 'pending',
      dependencies: index > 0 ? [`${rebalanceId}_step_${index - 1}`] : [],
      retryCount: 0,
      maxRetries: 3
    }));
  }

  private async prepareRollbackData(strategyId: string): Promise<RollbackData> {
    return {
      rollbackId: `rollback_${Date.now()}`,
      originalPositions: [],
      rollbackActions: [],
      createdAt: new Date(),
      isExecuted: false
    };
  }

  private async executeRollbackData(rollbackData: RollbackData): Promise<void> {
    // ロールバックアクションの実行（簡易実装）
    for (const action of rollbackData.rollbackActions) {
      // 実際の実装では各アクションを実行
      await this.delay(100);
    }
    rollbackData.isExecuted = true;
  }

  private markDependentStepsAsSkipped(steps: ExecutionStep[], failedStepId: string): void {
    const dependentSteps = steps.filter(step => 
      step.dependencies.includes(failedStepId) && 
      step.status === 'pending'
    );

    for (const step of dependentSteps) {
      step.status = 'skipped';
      this.markDependentStepsAsSkipped(steps, step.stepId);
    }
  }

  private calculateExecutionMetrics(steps: ExecutionStep[]): ExecutionMetrics {
    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const failedSteps = steps.filter(s => s.status === 'failed').length;
    const skippedSteps = steps.filter(s => s.status === 'skipped').length;

    const executionTimes = steps
      .filter(s => s.startTime && s.endTime)
      .map(s => s.endTime!.getTime() - s.startTime!.getTime());

    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;

    const successRate = totalSteps > 0 ? completedSteps / totalSteps : 0;

    return {
      totalSteps,
      completedSteps,
      failedSteps,
      skippedSteps,
      averageExecutionTime,
      successRate,
      currentThroughput: 0 // TODO: 実装
    };
  }

  private findStrategyById(rebalanceId: string, strategyId: string): RebalanceStrategy | null {
    const execution = this.activeExecutions.get(rebalanceId);
    if (!execution) return null;

    const index = parseInt(strategyId.split('_').pop() || '0');
    return execution.strategies[index] || null;
  }

  private async waitForResume(): Promise<void> {
    return new Promise<void>((resolve) => {
      const checkPause = () => {
        if (!this.isPaused) {
          resolve();
        } else {
          setTimeout(checkPause, 1000);
        }
      };
      checkPause();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeEmergencyStopConditions(): void {
    this.emergencyStopConditions = [
      {
        id: 'high_failure_rate',
        name: 'High Failure Rate',
        condition: (metrics) => metrics.successRate < 0.5 && metrics.totalSteps > 5,
        action: 'pause',
        enabled: true
      },
      {
        id: 'too_many_failures',
        name: 'Too Many Failures',
        condition: (metrics) => metrics.failedSteps > 3,
        action: 'rollback',
        enabled: true
      },
      {
        id: 'critical_safety_failure',
        name: 'Critical Safety Failure',
        condition: (_, safetyCheck) => safetyCheck.overallRisk === 'critical',
        action: 'emergency_stop',
        enabled: true
      }
    ];
  }

  private startSafetyMonitoring(): void {
    // 定期的な安全監視（簡易実装）
    setInterval(async () => {
      if (this.activeExecutions.size > 0) {
        for (const [rebalanceId] of this.activeExecutions) {
          const steps = this.executionSteps.get(rebalanceId);
          if (steps) {
            const metrics = this.calculateExecutionMetrics(steps);
            await this.checkEmergencyStopConditions(rebalanceId, metrics);
          }
        }
      }
    }, 5000); // 5秒間隔
  }

  private async checkEmergencyStopConditions(
    rebalanceId: string, 
    metrics: ExecutionMetrics
  ): Promise<void> {
    const mockSafetyCheck: SafetyCheckResult = {
      checkId: 'mock',
      timestamp: new Date(),
      passed: true,
      checks: [],
      overallRisk: 'low',
      recommendation: 'proceed'
    };

    for (const condition of this.emergencyStopConditions) {
      if (condition.enabled && condition.condition(metrics, mockSafetyCheck)) {
        switch (condition.action) {
          case 'pause':
            this.pause();
            break;
          case 'rollback':
            await this.initiateRollback(rebalanceId, condition.name);
            break;
          case 'emergency_stop':
            await this.emergencyStop(condition.name);
            break;
        }
        
        this.emit('emergencyConditionTriggered', {
          rebalanceId,
          conditionId: condition.id,
          action: condition.action
        });
      }
    }
  }

  private generateCheckId(): string {
    return `check_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 実行状況の取得
   */
  getExecutionStatus(rebalanceId: string): {
    steps: ExecutionStep[];
    metrics: ExecutionMetrics;
    isPaused: boolean;
    isEmergencyStopped: boolean;
  } | null {
    const steps = this.executionSteps.get(rebalanceId);
    if (!steps) return null;

    return {
      steps: [...steps],
      metrics: this.calculateExecutionMetrics(steps),
      isPaused: this.isPaused,
      isEmergencyStopped: this.isEmergencyStopped
    };
  }

  /**
   * ロールバック履歴の取得
   */
  getRollbackHistory(rebalanceId?: string): Map<string, RollbackData[]> {
    if (rebalanceId) {
      const history = this.rollbackHistory.get(rebalanceId);
      return new Map(history ? [[rebalanceId, history]] : []);
    }
    
    return new Map(this.rollbackHistory);
  }

  /**
   * 緊急停止条件の更新
   */
  updateEmergencyStopConditions(conditions: EmergencyStopCondition[]): void {
    this.emergencyStopConditions = [...conditions];
    this.emit('emergencyStopConditionsUpdated', this.emergencyStopConditions);
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.activeExecutions.clear();
    this.executionSteps.clear();
    this.rollbackHistory.clear();
    this.removeAllListeners();
  }
}