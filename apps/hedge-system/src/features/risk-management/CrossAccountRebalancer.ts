import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { HedgeBalanceCalculator, HedgeBalance, RebalanceAction } from '../trading/hedge/HedgeBalanceCalculator';
import { CrossAccountHedge, CrossHedgeResult, AccountExecution, BalanceValidation } from '../trading/hedge/CrossAccountHedge';
import { HedgeExecutor, HedgeExecutionCriteria } from '../trading/hedge/HedgeExecutor';
import { HedgePositionValidator } from '../trading/hedge/HedgePositionValidator';
import { HedgePosition } from '../trading/hedge/types';
import { WebSocketClient } from '../../../lib/websocket/message-types';

/**
 * 口座バランス情報
 */
export interface AccountBalance {
  accountId: string;
  totalEquity: number;
  usedMargin: number;
  marginLevel: number;
  riskExposure: number;
  positions: PositionSummary[];
  bonusAmount: number;
  lastUpdate: Date;
  status: 'active' | 'warning' | 'critical' | 'offline';
}

/**
 * ポジション要約
 */
export interface PositionSummary {
  positionId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  unrealizedPnL: number;
  marginUsed: number;
}

/**
 * リバランス戦略
 */
export interface RebalanceStrategy {
  sourceAccount: string;
  targetAccount: string;
  action: 'transfer_position' | 'close_and_reopen' | 'hedge_create' | 'reduce_exposure';
  amount: number;
  priority: number;
  estimatedBenefit: number;
  estimatedCost: number;
  riskImpact: number;
  reason: string;
  dependencies: string[]; // 他の戦略への依存関係
}

/**
 * リバランス実行結果
 */
export interface RebalanceExecutionResult {
  rebalanceId: string;
  strategies: RebalanceStrategy[];
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  success: boolean;
  error?: string;
  metrics: {
    totalBenefit: number;
    totalCost: number;
    riskReduction: number;
    balanceImprovement: number;
    executionTime: number;
    strategiesExecuted: number;
    strategiesFailed: number;
  };
  executionResults: Map<string, CrossHedgeResult>;
  compensationActions: AccountExecution[];
}

/**
 * 最適化設定
 */
export interface OptimizationSettings {
  riskTolerance: number; // 0-1
  costTolerance: number; // 最大許容コスト
  balanceTarget: number; // 目標バランス比率 0-1
  maxStrategiesPerRebalance: number;
  considerExecutionCost: boolean;
  considerSlippage: boolean;
  emergencyMode: boolean; // 緊急時は制約を緩める
}

/**
 * 安全確認設定
 */
export interface SafetySettings {
  requireManualApproval: boolean;
  maxPositionSizeChange: number; // 1回の変更で許容する最大ポジションサイズ変更比率
  maxMarginUsageIncrease: number; // 最大証拠金使用量増加比率
  blacklistAccounts: string[]; // リバランス対象外アカウント
  emergencyStopConditions: {
    maxLossThreshold: number;
    marginLevelThreshold: number;
    networkLatencyThreshold: number;
  };
}

/**
 * 効果分析結果
 */
export interface EffectAnalysis {
  analysisId: string;
  timestamp: Date;
  beforeState: {
    totalRisk: number;
    balanceScore: number;
    marginEfficiency: number;
    accountsAtRisk: number;
  };
  afterState: {
    totalRisk: number;
    balanceScore: number;
    marginEfficiency: number;
    accountsAtRisk: number;
  };
  improvements: {
    riskReduction: number;
    balanceImprovement: number;
    marginEfficiencyGain: number;
    costBenefit: number;
  };
  recommendations: string[];
}

/**
 * 口座間バランス調整機能メインクラス
 */
export class CrossAccountRebalancer extends EventEmitter {
  private balanceCalculator: HedgeBalanceCalculator;
  private crossAccountHedge: CrossAccountHedge;
  private hedgeExecutor: HedgeExecutor;
  private validator: HedgePositionValidator;
  private wsClient: WebSocketClient;

  private optimizationSettings: OptimizationSettings;
  private safetySettings: SafetySettings;

  private activeRebalances = new Map<string, RebalanceExecutionResult>();
  private accountBalances = new Map<string, AccountBalance>();
  private lastAnalysis?: EffectAnalysis;
  
  private readonly maxConcurrentRebalances = 2;
  private currentRebalances = 0;
  private isEmergencyMode = false;

  constructor(
    balanceCalculator: HedgeBalanceCalculator,
    crossAccountHedge: CrossAccountHedge,
    hedgeExecutor: HedgeExecutor,
    validator: HedgePositionValidator,
    wsClient: WebSocketClient,
    optimizationSettings?: Partial<OptimizationSettings>,
    safetySettings?: Partial<SafetySettings>
  ) {
    super();

    this.balanceCalculator = balanceCalculator;
    this.crossAccountHedge = crossAccountHedge;
    this.hedgeExecutor = hedgeExecutor;
    this.validator = validator;
    this.wsClient = wsClient;

    this.optimizationSettings = {
      riskTolerance: 0.3,
      costTolerance: 100, // $100
      balanceTarget: 0.1, // 10%の不均衡まで許容
      maxStrategiesPerRebalance: 5,
      considerExecutionCost: true,
      considerSlippage: true,
      emergencyMode: false,
      ...optimizationSettings
    };

    this.safetySettings = {
      requireManualApproval: false,
      maxPositionSizeChange: 0.2, // 20%
      maxMarginUsageIncrease: 0.1, // 10%
      blacklistAccounts: [],
      emergencyStopConditions: {
        maxLossThreshold: 1000, // $1000
        marginLevelThreshold: 150, // 150%
        networkLatencyThreshold: 5000 // 5秒
      },
      ...safetySettings
    };
  }

  /**
   * 複数口座のバランス分析
   */
  async analyzeAccountBalances(accountIds: string[]): Promise<{
    accounts: AccountBalance[];
    overallRisk: number;
    balanceScore: number;
    recommendations: RebalanceStrategy[];
  }> {
    const accounts: AccountBalance[] = [];
    let totalEquity = 0;
    let totalRiskExposure = 0;
    let accountsAtRisk = 0;

    for (const accountId of accountIds) {
      if (this.safetySettings.blacklistAccounts.includes(accountId)) {
        continue;
      }

      const balance = await this.getAccountBalance(accountId);
      accounts.push(balance);
      
      totalEquity += balance.totalEquity;
      totalRiskExposure += balance.riskExposure;
      
      if (balance.status === 'warning' || balance.status === 'critical') {
        accountsAtRisk++;
      }
    }

    // 全体リスクの計算
    const overallRisk = totalEquity > 0 ? totalRiskExposure / totalEquity : 0;

    // バランススコアの計算（口座間の均等性）
    const averageEquity = totalEquity / accounts.length;
    const equityVariance = accounts.reduce((sum, acc) => {
      const diff = acc.totalEquity - averageEquity;
      return sum + (diff * diff);
    }, 0) / accounts.length;
    const balanceScore = 1 - Math.min(1, equityVariance / (averageEquity * averageEquity));

    // リバランス戦略の生成
    const recommendations = this.generateOptimalStrategies(accounts);

    this.emit('balanceAnalysisCompleted', {
      accounts,
      overallRisk,
      balanceScore,
      accountsAtRisk,
      totalEquity,
      recommendations: recommendations.slice(0, 5) // 上位5件
    });

    return {
      accounts,
      overallRisk,
      balanceScore,
      recommendations
    };
  }

  /**
   * 最適化アルゴリズムによる戦略生成
   */
  private generateOptimalStrategies(accounts: AccountBalance[]): RebalanceStrategy[] {
    const strategies: RebalanceStrategy[] = [];

    // 高リスク口座の特定
    const highRiskAccounts = accounts.filter(acc => 
      acc.status === 'warning' || acc.status === 'critical'
    );

    // 低リスク・余裕のある口座の特定
    const lowRiskAccounts = accounts.filter(acc => 
      acc.status === 'active' && acc.marginLevel > 300
    );

    // リスク分散戦略の生成
    for (const highRiskAccount of highRiskAccounts) {
      for (const lowRiskAccount of lowRiskAccounts) {
        const strategy = this.createRiskReductionStrategy(
          highRiskAccount,
          lowRiskAccount,
          accounts
        );
        
        if (strategy && this.validateStrategy(strategy, accounts)) {
          strategies.push(strategy);
        }
      }
    }

    // バランス改善戦略の生成
    const balanceStrategies = this.createBalanceOptimizationStrategies(accounts);
    strategies.push(...balanceStrategies);

    // 戦略の優先度付けとソート
    return this.prioritizeStrategies(strategies);
  }

  /**
   * リスク軽減戦略の作成
   */
  private createRiskReductionStrategy(
    sourceAccount: AccountBalance,
    targetAccount: AccountBalance,
    allAccounts: AccountBalance[]
  ): RebalanceStrategy | null {
    if (sourceAccount.riskExposure <= 0) return null;

    const transferAmount = Math.min(
      sourceAccount.riskExposure * 0.3, // 30%まで移管
      targetAccount.totalEquity * 0.2    // 受入先の20%まで
    );

    if (transferAmount < 100) return null; // 最小移管額

    const estimatedBenefit = this.calculateRiskReductionBenefit(
      sourceAccount,
      targetAccount,
      transferAmount
    );

    const estimatedCost = this.calculateTransferCost(
      sourceAccount,
      targetAccount,
      transferAmount
    );

    return {
      sourceAccount: sourceAccount.accountId,
      targetAccount: targetAccount.accountId,
      action: 'transfer_position',
      amount: transferAmount,
      priority: this.calculateStrategyPriority(sourceAccount, targetAccount),
      estimatedBenefit,
      estimatedCost,
      riskImpact: estimatedBenefit - estimatedCost,
      reason: `Risk reduction: ${sourceAccount.accountId} (${sourceAccount.status}) -> ${targetAccount.accountId}`,
      dependencies: []
    };
  }

  /**
   * バランス最適化戦略の作成
   */
  private createBalanceOptimizationStrategies(accounts: AccountBalance[]): RebalanceStrategy[] {
    const strategies: RebalanceStrategy[] = [];
    const totalEquity = accounts.reduce((sum, acc) => sum + acc.totalEquity, 0);
    const targetEquityPerAccount = totalEquity / accounts.length;

    for (const account of accounts) {
      const deviation = account.totalEquity - targetEquityPerAccount;
      
      if (Math.abs(deviation) > targetEquityPerAccount * this.optimizationSettings.balanceTarget) {
        if (deviation > 0) {
          // 過剰資金のある口座から他へ移管
          const targetAccounts = accounts.filter(acc => 
            acc.totalEquity < targetEquityPerAccount * 0.8 &&
            !this.safetySettings.blacklistAccounts.includes(acc.accountId)
          );

          for (const target of targetAccounts) {
            const transferAmount = Math.min(
              deviation * 0.5,
              (targetEquityPerAccount - target.totalEquity) * 0.8
            );

            if (transferAmount > 100) {
              strategies.push({
                sourceAccount: account.accountId,
                targetAccount: target.accountId,
                action: 'transfer_position',
                amount: transferAmount,
                priority: 2,
                estimatedBenefit: this.calculateBalanceBenefit(transferAmount),
                estimatedCost: this.calculateTransferCost(account, target, transferAmount),
                riskImpact: 0.1,
                reason: 'Balance optimization',
                dependencies: []
              });
            }
          }
        }
      }
    }

    return strategies;
  }

  /**
   * 戦略の優先度付け
   */
  private prioritizeStrategies(strategies: RebalanceStrategy[]): RebalanceStrategy[] {
    return strategies
      .filter(s => s.riskImpact > 0) // 正の効果があるもののみ
      .sort((a, b) => {
        // リスクインパクトと優先度による総合評価
        const scoreA = a.riskImpact * 10 + (10 - a.priority);
        const scoreB = b.riskImpact * 10 + (10 - b.priority);
        return scoreB - scoreA;
      });
  }

  /**
   * リバランス実行
   */
  async executeRebalance(
    strategies: RebalanceStrategy[],
    approvalRequired = false
  ): Promise<RebalanceExecutionResult> {
    if (this.currentRebalances >= this.maxConcurrentRebalances) {
      throw new Error('Maximum concurrent rebalances reached');
    }

    const rebalanceId = this.generateRebalanceId();
    this.currentRebalances++;

    const result: RebalanceExecutionResult = {
      rebalanceId,
      strategies: strategies.slice(0, this.optimizationSettings.maxStrategiesPerRebalance),
      status: 'pending',
      startTime: new Date(),
      success: false,
      metrics: {
        totalBenefit: 0,
        totalCost: 0,
        riskReduction: 0,
        balanceImprovement: 0,
        executionTime: 0,
        strategiesExecuted: 0,
        strategiesFailed: 0
      },
      executionResults: new Map(),
      compensationActions: []
    };

    this.activeRebalances.set(rebalanceId, result);

    try {
      // 安全性チェック
      const safetyValidation = await this.validateSafetyConditions(result.strategies);
      if (!safetyValidation.isValid) {
        throw new Error(`Safety validation failed: ${safetyValidation.issues.join(', ')}`);
      }

      // 手動承認待ち
      if (approvalRequired || this.safetySettings.requireManualApproval) {
        this.emit('rebalanceApprovalRequired', result);
        return result; // 承認待ちで返す
      }

      result.status = 'executing';
      this.emit('rebalanceStarted', result);

      // 戦略の順次実行
      for (const strategy of result.strategies) {
        try {
          const executionResult = await this.executeStrategy(strategy);
          result.executionResults.set(strategy.sourceAccount, executionResult);
          
          if (executionResult.status === 'completed') {
            result.metrics.strategiesExecuted++;
            result.metrics.totalBenefit += strategy.estimatedBenefit;
            result.metrics.totalCost += strategy.estimatedCost;
          } else {
            result.metrics.strategiesFailed++;
          }

        } catch (error) {
          console.error(`Strategy execution failed:`, error);
          result.metrics.strategiesFailed++;
        }
      }

      // 実行完了
      result.status = 'completed';
      result.success = result.metrics.strategiesExecuted > 0;
      result.endTime = new Date();
      result.metrics.executionTime = result.endTime.getTime() - result.startTime.getTime();

      // 効果分析
      await this.analyzeRebalanceEffect(result);

      this.emit('rebalanceCompleted', result);

    } catch (error) {
      result.status = 'failed';
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
   * 個別戦略の実行
   */
  private async executeStrategy(strategy: RebalanceStrategy): Promise<CrossHedgeResult> {
    switch (strategy.action) {
      case 'transfer_position':
        return this.executePositionTransfer(strategy);
      case 'close_and_reopen':
        return this.executeCloseAndReopen(strategy);
      case 'hedge_create':
        return this.executeHedgeCreation(strategy);
      case 'reduce_exposure':
        return this.executeExposureReduction(strategy);
      default:
        throw new Error(`Unknown strategy action: ${strategy.action}`);
    }
  }

  /**
   * ポジション移管の実行
   */
  private async executePositionTransfer(strategy: RebalanceStrategy): Promise<CrossHedgeResult> {
    // クロスアカウントヘッジを使用してポジション移管を実行
    const accounts = [strategy.sourceAccount, strategy.targetAccount];
    const symbol = 'EURUSD'; // 実際の実装では動的に決定
    const lots = strategy.amount / 100000; // 仮の計算

    return this.crossAccountHedge.executeCrossAccountHedge(
      accounts,
      symbol,
      lots,
      1.0
    );
  }

  /**
   * 決済・再オープンの実行
   */
  private async executeCloseAndReopen(strategy: RebalanceStrategy): Promise<CrossHedgeResult> {
    // 実装詳細は要件に応じて調整
    const mockResult: CrossHedgeResult = {
      crossHedgeId: uuidv4(),
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

    return mockResult;
  }

  /**
   * ヘッジ作成の実行
   */
  private async executeHedgeCreation(strategy: RebalanceStrategy): Promise<CrossHedgeResult> {
    const accounts = [strategy.sourceAccount, strategy.targetAccount];
    const symbol = 'EURUSD';
    const lots = strategy.amount / 100000;

    return this.crossAccountHedge.executeCrossAccountHedge(
      accounts,
      symbol,
      lots,
      1.0
    );
  }

  /**
   * エクスポージャー削減の実行
   */
  private async executeExposureReduction(strategy: RebalanceStrategy): Promise<CrossHedgeResult> {
    // 簡易実装
    const mockResult: CrossHedgeResult = {
      crossHedgeId: uuidv4(),
      status: 'completed',
      accounts: [strategy.sourceAccount],
      symbol: 'EURUSD',
      totalLots: { buy: 0, sell: 0 },
      executionResults: new Map(),
      startTime: new Date(),
      completionTime: new Date(),
      compensationRequired: false,
      compensationActions: []
    };

    return mockResult;
  }

  /**
   * 安全性チェック
   */
  private async validateSafetyConditions(strategies: RebalanceStrategy[]): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // 緊急停止条件のチェック
    if (!this.isEmergencyMode) {
      for (const condition of Object.entries(this.safetySettings.emergencyStopConditions)) {
        // 実際の実装では現在の市況をチェック
      }
    }

    // 戦略の妥当性チェック
    for (const strategy of strategies) {
      if (this.safetySettings.blacklistAccounts.includes(strategy.sourceAccount)) {
        issues.push(`Source account ${strategy.sourceAccount} is blacklisted`);
      }
      
      if (this.safetySettings.blacklistAccounts.includes(strategy.targetAccount)) {
        issues.push(`Target account ${strategy.targetAccount} is blacklisted`);
      }

      if (strategy.amount > strategy.estimatedBenefit * 10) {
        issues.push(`Strategy risk/benefit ratio too high: ${strategy.sourceAccount}`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * リバランス効果の分析
   */
  private async analyzeRebalanceEffect(result: RebalanceExecutionResult): Promise<void> {
    const beforeAccounts = Array.from(this.accountBalances.values());
    
    // 実行後の状態を再取得（簡易実装）
    const afterAccounts = await Promise.all(
      result.strategies.map(s => this.getAccountBalance(s.sourceAccount))
    );

    const beforeState = this.calculateOverallState(beforeAccounts);
    const afterState = this.calculateOverallState(afterAccounts);

    this.lastAnalysis = {
      analysisId: uuidv4(),
      timestamp: new Date(),
      beforeState,
      afterState,
      improvements: {
        riskReduction: beforeState.totalRisk - afterState.totalRisk,
        balanceImprovement: afterState.balanceScore - beforeState.balanceScore,
        marginEfficiencyGain: afterState.marginEfficiency - beforeState.marginEfficiency,
        costBenefit: result.metrics.totalBenefit - result.metrics.totalCost
      },
      recommendations: this.generatePostRebalanceRecommendations(beforeState, afterState)
    };

    this.emit('effectAnalysisCompleted', this.lastAnalysis);
  }

  /**
   * 口座バランスの取得
   */
  private async getAccountBalance(accountId: string): Promise<AccountBalance> {
    // 実際の実装ではWebSocket経由で取得
    // ここでは簡易的なモック実装
    const mockBalance: AccountBalance = {
      accountId,
      totalEquity: Math.random() * 10000 + 5000,
      usedMargin: Math.random() * 3000 + 1000,
      marginLevel: Math.random() * 200 + 200,
      riskExposure: Math.random() * 2000 + 500,
      positions: [],
      bonusAmount: Math.random() * 1000,
      lastUpdate: new Date(),
      status: 'active'
    };

    this.accountBalances.set(accountId, mockBalance);
    return mockBalance;
  }

  /**
   * 全体状態の計算
   */
  private calculateOverallState(accounts: AccountBalance[]) {
    const totalEquity = accounts.reduce((sum, acc) => sum + acc.totalEquity, 0);
    const totalRisk = accounts.reduce((sum, acc) => sum + acc.riskExposure, 0);
    const totalMarginUsed = accounts.reduce((sum, acc) => sum + acc.usedMargin, 0);
    
    return {
      totalRisk: totalEquity > 0 ? totalRisk / totalEquity : 0,
      balanceScore: this.calculateBalanceScore(accounts),
      marginEfficiency: totalEquity > 0 ? (totalEquity - totalMarginUsed) / totalEquity : 0,
      accountsAtRisk: accounts.filter(acc => acc.status !== 'active').length
    };
  }

  /**
   * バランススコアの計算
   */
  private calculateBalanceScore(accounts: AccountBalance[]): number {
    if (accounts.length === 0) return 0;

    const averageEquity = accounts.reduce((sum, acc) => sum + acc.totalEquity, 0) / accounts.length;
    const variance = accounts.reduce((sum, acc) => {
      const diff = acc.totalEquity - averageEquity;
      return sum + (diff * diff);
    }, 0) / accounts.length;

    return 1 - Math.min(1, variance / (averageEquity * averageEquity));
  }

  // ユーティリティメソッド
  private calculateRiskReductionBenefit(source: AccountBalance, target: AccountBalance, amount: number): number {
    return amount * 0.1; // 簡易計算
  }

  private calculateTransferCost(source: AccountBalance, target: AccountBalance, amount: number): number {
    return amount * 0.001; // 0.1%のコスト
  }

  private calculateBalanceBenefit(amount: number): number {
    return amount * 0.05; // 5%の改善効果
  }

  private calculateStrategyPriority(source: AccountBalance, target: AccountBalance): number {
    if (source.status === 'critical') return 1;
    if (source.status === 'warning') return 2;
    return 3;
  }

  private validateStrategy(strategy: RebalanceStrategy, accounts: AccountBalance[]): boolean {
    return strategy.estimatedBenefit > strategy.estimatedCost;
  }

  private generatePostRebalanceRecommendations(beforeState: any, afterState: any): string[] {
    const recommendations: string[] = [];
    
    if (afterState.totalRisk > beforeState.totalRisk) {
      recommendations.push('Consider additional risk reduction measures');
    }
    
    if (afterState.balanceScore < 0.8) {
      recommendations.push('Further balance optimization recommended');
    }

    return recommendations;
  }

  private generateRebalanceId(): string {
    return `rebalance_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * 設定の更新
   */
  updateOptimizationSettings(settings: Partial<OptimizationSettings>): void {
    this.optimizationSettings = { ...this.optimizationSettings, ...settings };
    this.emit('optimizationSettingsUpdated', this.optimizationSettings);
  }

  updateSafetySettings(settings: Partial<SafetySettings>): void {
    this.safetySettings = { ...this.safetySettings, ...settings };
    this.emit('safetySettingsUpdated', this.safetySettings);
  }

  /**
   * 緊急モードの切り替え
   */
  setEmergencyMode(enabled: boolean): void {
    this.isEmergencyMode = enabled;
    if (enabled) {
      this.optimizationSettings.emergencyMode = true;
      this.safetySettings.requireManualApproval = false;
    }
    this.emit('emergencyModeChanged', enabled);
  }

  /**
   * アクティブなリバランス一覧を取得
   */
  getActiveRebalances(): RebalanceExecutionResult[] {
    return Array.from(this.activeRebalances.values())
      .filter(r => r.status === 'pending' || r.status === 'executing');
  }

  /**
   * 最新の効果分析を取得
   */
  getLastEffectAnalysis(): EffectAnalysis | undefined {
    return this.lastAnalysis;
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.activeRebalances.clear();
    this.accountBalances.clear();
    this.removeAllListeners();
  }
}