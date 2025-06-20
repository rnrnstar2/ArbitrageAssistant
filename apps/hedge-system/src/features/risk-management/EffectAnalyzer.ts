import { EventEmitter } from 'events';
import { AccountBalance, RebalanceExecutionResult, EffectAnalysis } from './CrossAccountRebalancer';

/**
 * パフォーマンス指標
 */
export interface PerformanceMetrics {
  riskMetrics: {
    totalRisk: number;
    concentrationRisk: number;
    correlationRisk: number;
    marginRisk: number;
  };
  balanceMetrics: {
    equityBalance: number;
    riskBalance: number;
    positionBalance: number;
    marginBalance: number;
  };
  efficiencyMetrics: {
    marginEfficiency: number;
    riskAdjustedReturn: number;
    diversificationRatio: number;
    utilizationRate: number;
  };
  stabilityMetrics: {
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    recoveryTime: number;
  };
}

/**
 * 比較分析結果
 */
export interface ComparisonAnalysis {
  timeframe: string;
  beforeSnapshot: PerformanceMetrics;
  afterSnapshot: PerformanceMetrics;
  improvements: {
    riskReduction: number;
    balanceImprovement: number;
    efficiencyGain: number;
    stabilityImprovement: number;
  };
  degradations: {
    riskIncrease: number;
    balanceDeterioration: number;
    efficiencyLoss: number;
    stabilityLoss: number;
  };
  netBenefit: number;
  confidenceLevel: number;
}

/**
 * トレンド分析
 */
export interface TrendAnalysis {
  period: 'day' | 'week' | 'month' | 'quarter';
  dataPoints: Array<{
    timestamp: Date;
    metrics: PerformanceMetrics;
    rebalanceEvent?: {
      id: string;
      strategiesCount: number;
      totalCost: number;
    };
  }>;
  trends: {
    riskTrend: 'improving' | 'stable' | 'deteriorating';
    balanceTrend: 'improving' | 'stable' | 'deteriorating';
    efficiencyTrend: 'improving' | 'stable' | 'deteriorating';
    stabilityTrend: 'improving' | 'stable' | 'deteriorating';
  };
  projections: {
    nextWeek: PerformanceMetrics;
    nextMonth: PerformanceMetrics;
    confidence: number;
  };
}

/**
 * ROI分析
 */
export interface ROIAnalysis {
  analysisId: string;
  timeframe: {
    start: Date;
    end: Date;
  };
  investments: {
    totalCost: number;
    executionCosts: number;
    opportunityCosts: number;
    maintenanceCosts: number;
  };
  returns: {
    riskReductionValue: number;
    efficiencyGains: number;
    stabilityBenefits: number;
    avoidedLosses: number;
  };
  roi: {
    absolute: number;
    percentage: number;
    annualized: number;
  };
  paybackPeriod: number; // days
  breakEvenPoint?: Date;
}

/**
 * 効果分析エンジン
 */
export class EffectAnalyzer extends EventEmitter {
  private performanceHistory: Array<{
    timestamp: Date;
    accounts: AccountBalance[];
    metrics: PerformanceMetrics;
    rebalanceId?: string;
  }> = [];

  private rebalanceHistory: Map<string, RebalanceExecutionResult> = new Map();
  private readonly maxHistoryLength = 1000;
  private readonly samplingInterval = 300000; // 5分間隔

  constructor() {
    super();
    this.startPerformanceMonitoring();
  }

  /**
   * リバランス効果の分析
   */
  async analyzeRebalanceEffect(
    rebalanceResult: RebalanceExecutionResult,
    beforeAccounts: AccountBalance[],
    afterAccounts: AccountBalance[]
  ): Promise<EffectAnalysis> {
    const analysisId = this.generateAnalysisId();
    const timestamp = new Date();

    // リバランス前後のメトリクス計算
    const beforeMetrics = this.calculatePerformanceMetrics(beforeAccounts);
    const afterMetrics = this.calculatePerformanceMetrics(afterAccounts);

    // 改善度の計算
    const improvements = this.calculateImprovements(beforeMetrics, afterMetrics);

    // 推奨事項の生成
    const recommendations = this.generateRecommendations(
      rebalanceResult,
      beforeMetrics,
      afterMetrics,
      improvements
    );

    const analysis: EffectAnalysis = {
      analysisId,
      timestamp,
      beforeState: {
        totalRisk: beforeMetrics.riskMetrics.totalRisk,
        balanceScore: beforeMetrics.balanceMetrics.equityBalance,
        marginEfficiency: beforeMetrics.efficiencyMetrics.marginEfficiency,
        accountsAtRisk: this.countAccountsAtRisk(beforeAccounts)
      },
      afterState: {
        totalRisk: afterMetrics.riskMetrics.totalRisk,
        balanceScore: afterMetrics.balanceMetrics.equityBalance,
        marginEfficiency: afterMetrics.efficiencyMetrics.marginEfficiency,
        accountsAtRisk: this.countAccountsAtRisk(afterAccounts)
      },
      improvements: {
        riskReduction: improvements.riskReduction,
        balanceImprovement: improvements.balanceImprovement,
        marginEfficiencyGain: improvements.efficiencyGain,
        costBenefit: rebalanceResult.metrics.totalBenefit - rebalanceResult.metrics.totalCost
      },
      recommendations
    };

    // 履歴に記録
    this.rebalanceHistory.set(rebalanceResult.rebalanceId, rebalanceResult);
    this.recordPerformanceSnapshot(afterAccounts, afterMetrics, rebalanceResult.rebalanceId);

    this.emit('effectAnalysisCompleted', analysis);

    return analysis;
  }

  /**
   * 比較分析の実行
   */
  performComparisonAnalysis(
    period1: { start: Date; end: Date },
    period2: { start: Date; end: Date }
  ): ComparisonAnalysis {
    const period1Data = this.getHistoricalData(period1.start, period1.end);
    const period2Data = this.getHistoricalData(period2.start, period2.end);

    if (period1Data.length === 0 || period2Data.length === 0) {
      throw new Error('Insufficient data for comparison analysis');
    }

    const period1Avg = this.calculateAverageMetrics(period1Data);
    const period2Avg = this.calculateAverageMetrics(period2Data);

    const improvements = this.calculateImprovements(period1Avg, period2Avg);
    const degradations = this.calculateDegradations(period1Avg, period2Avg);

    const netBenefit = this.calculateNetBenefit(improvements, degradations);
    const confidenceLevel = this.calculateConfidenceLevel(period1Data, period2Data);

    return {
      timeframe: `${period1.start.toISOString()} to ${period2.end.toISOString()}`,
      beforeSnapshot: period1Avg,
      afterSnapshot: period2Avg,
      improvements,
      degradations,
      netBenefit,
      confidenceLevel
    };
  }

  /**
   * トレンド分析の実行
   */
  analyzeTrends(period: 'day' | 'week' | 'month' | 'quarter'): TrendAnalysis {
    const endDate = new Date();
    const startDate = this.getStartDateForPeriod(endDate, period);
    
    const historicalData = this.getHistoricalData(startDate, endDate);
    
    if (historicalData.length < 3) {
      throw new Error('Insufficient data for trend analysis');
    }

    const dataPoints = historicalData.map(entry => ({
      timestamp: entry.timestamp,
      metrics: entry.metrics,
      rebalanceEvent: entry.rebalanceId ? {
        id: entry.rebalanceId,
        strategiesCount: this.rebalanceHistory.get(entry.rebalanceId)?.strategies.length || 0,
        totalCost: this.rebalanceHistory.get(entry.rebalanceId)?.metrics.totalCost || 0
      } : undefined
    }));

    const trends = this.calculateTrends(dataPoints);
    const projections = this.generateProjections(dataPoints);

    return {
      period,
      dataPoints,
      trends,
      projections
    };
  }

  /**
   * ROI分析の実行
   */
  calculateROI(timeframe: { start: Date; end: Date }): ROIAnalysis {
    const analysisId = this.generateAnalysisId();
    
    // 期間内のリバランス実行を取得
    const rebalances = Array.from(this.rebalanceHistory.values())
      .filter(r => r.startTime >= timeframe.start && r.startTime <= timeframe.end);

    // 投資コストの計算
    const investments = {
      totalCost: rebalances.reduce((sum, r) => sum + r.metrics.totalCost, 0),
      executionCosts: rebalances.reduce((sum, r) => sum + r.metrics.totalCost * 0.8, 0),
      opportunityCosts: rebalances.reduce((sum, r) => sum + r.metrics.totalCost * 0.1, 0),
      maintenanceCosts: rebalances.reduce((sum, r) => sum + r.metrics.totalCost * 0.1, 0)
    };

    // リターンの計算
    const returns = {
      riskReductionValue: rebalances.reduce((sum, r) => sum + r.metrics.riskReduction * 1000, 0),
      efficiencyGains: rebalances.reduce((sum, r) => sum + r.metrics.totalBenefit, 0),
      stabilityBenefits: rebalances.reduce((sum, r) => sum + r.metrics.balanceImprovement * 500, 0),
      avoidedLosses: this.calculateAvoidedLosses(timeframe, rebalances)
    };

    const totalReturns = Object.values(returns).reduce((sum, value) => sum + value, 0);
    const totalInvestments = investments.totalCost;

    const roi = {
      absolute: totalReturns - totalInvestments,
      percentage: totalInvestments > 0 ? ((totalReturns - totalInvestments) / totalInvestments) * 100 : 0,
      annualized: this.calculateAnnualizedROI(totalReturns, totalInvestments, timeframe)
    };

    const paybackPeriod = this.calculatePaybackPeriod(investments, returns, timeframe);
    const breakEvenPoint = this.calculateBreakEvenPoint(investments, returns, timeframe);

    return {
      analysisId,
      timeframe,
      investments,
      returns,
      roi,
      paybackPeriod,
      breakEvenPoint
    };
  }

  /**
   * パフォーマンス指標の計算
   */
  private calculatePerformanceMetrics(accounts: AccountBalance[]): PerformanceMetrics {
    const totalEquity = accounts.reduce((sum, acc) => sum + acc.totalEquity, 0);
    const totalRiskExposure = accounts.reduce((sum, acc) => sum + acc.riskExposure, 0);
    const totalMarginUsed = accounts.reduce((sum, acc) => sum + acc.usedMargin, 0);

    // リスク指標
    const riskMetrics = {
      totalRisk: totalEquity > 0 ? totalRiskExposure / totalEquity : 0,
      concentrationRisk: this.calculateConcentrationRisk(accounts),
      correlationRisk: this.calculateCorrelationRisk(accounts),
      marginRisk: this.calculateMarginRisk(accounts)
    };

    // バランス指標
    const balanceMetrics = {
      equityBalance: this.calculateEquityBalance(accounts),
      riskBalance: this.calculateRiskBalance(accounts),
      positionBalance: this.calculatePositionBalance(accounts),
      marginBalance: this.calculateMarginBalance(accounts)
    };

    // 効率性指標
    const efficiencyMetrics = {
      marginEfficiency: totalEquity > 0 ? (totalEquity - totalMarginUsed) / totalEquity : 0,
      riskAdjustedReturn: this.calculateRiskAdjustedReturn(accounts),
      diversificationRatio: this.calculateDiversificationRatio(accounts),
      utilizationRate: this.calculateUtilizationRate(accounts)
    };

    // 安定性指標
    const stabilityMetrics = {
      volatility: this.calculateVolatility(accounts),
      sharpeRatio: this.calculateSharpeRatio(accounts),
      maxDrawdown: this.calculateMaxDrawdown(accounts),
      recoveryTime: this.calculateRecoveryTime(accounts)
    };

    return {
      riskMetrics,
      balanceMetrics,
      efficiencyMetrics,
      stabilityMetrics
    };
  }

  /**
   * 改善度の計算
   */
  private calculateImprovements(
    beforeMetrics: PerformanceMetrics,
    afterMetrics: PerformanceMetrics
  ) {
    return {
      riskReduction: Math.max(0, beforeMetrics.riskMetrics.totalRisk - afterMetrics.riskMetrics.totalRisk),
      balanceImprovement: Math.max(0, afterMetrics.balanceMetrics.equityBalance - beforeMetrics.balanceMetrics.equityBalance),
      efficiencyGain: Math.max(0, afterMetrics.efficiencyMetrics.marginEfficiency - beforeMetrics.efficiencyMetrics.marginEfficiency),
      stabilityImprovement: Math.max(0, afterMetrics.stabilityMetrics.sharpeRatio - beforeMetrics.stabilityMetrics.sharpeRatio)
    };
  }

  // ユーティリティメソッド（簡易実装）
  private calculateConcentrationRisk(accounts: AccountBalance[]): number {
    const riskValues = accounts.map(acc => acc.riskExposure);
    const total = riskValues.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;

    const normalizedValues = riskValues.map(val => val / total);
    return normalizedValues.reduce((sum, val) => sum + val * val, 0);
  }

  private calculateCorrelationRisk(accounts: AccountBalance[]): number {
    return Math.random() * 0.5; // 簡易実装
  }

  private calculateMarginRisk(accounts: AccountBalance[]): number {
    const criticalAccounts = accounts.filter(acc => acc.marginLevel < 200).length;
    return criticalAccounts / accounts.length;
  }

  private calculateEquityBalance(accounts: AccountBalance[]): number {
    const equityValues = accounts.map(acc => acc.totalEquity);
    return 1 - this.calculateVariationCoefficient(equityValues);
  }

  private calculateRiskBalance(accounts: AccountBalance[]): number {
    const riskValues = accounts.map(acc => acc.riskExposure);
    return 1 - this.calculateVariationCoefficient(riskValues);
  }

  private calculatePositionBalance(accounts: AccountBalance[]): number {
    const positionCounts = accounts.map(acc => acc.positions.length);
    return 1 - this.calculateVariationCoefficient(positionCounts);
  }

  private calculateMarginBalance(accounts: AccountBalance[]): number {
    const marginValues = accounts.map(acc => acc.marginLevel);
    return 1 - this.calculateVariationCoefficient(marginValues);
  }

  private calculateRiskAdjustedReturn(accounts: AccountBalance[]): number {
    return Math.random() * 0.3; // 簡易実装
  }

  private calculateDiversificationRatio(accounts: AccountBalance[]): number {
    return Math.min(1, accounts.length / 10); // 10口座で最大多様化
  }

  private calculateUtilizationRate(accounts: AccountBalance[]): number {
    const totalEquity = accounts.reduce((sum, acc) => sum + acc.totalEquity, 0);
    const totalUsedMargin = accounts.reduce((sum, acc) => sum + acc.usedMargin, 0);
    return totalEquity > 0 ? totalUsedMargin / totalEquity : 0;
  }

  private calculateVolatility(accounts: AccountBalance[]): number {
    return Math.random() * 0.2; // 簡易実装
  }

  private calculateSharpeRatio(accounts: AccountBalance[]): number {
    return Math.random() * 2; // 簡易実装
  }

  private calculateMaxDrawdown(accounts: AccountBalance[]): number {
    return Math.random() * 0.1; // 簡易実装
  }

  private calculateRecoveryTime(accounts: AccountBalance[]): number {
    return Math.random() * 30; // 日数
  }

  private calculateVariationCoefficient(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (mean === 0) return 0;

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean;
  }

  private countAccountsAtRisk(accounts: AccountBalance[]): number {
    return accounts.filter(acc => acc.status === 'warning' || acc.status === 'critical').length;
  }

  private generateRecommendations(
    rebalanceResult: RebalanceExecutionResult,
    beforeMetrics: PerformanceMetrics,
    afterMetrics: PerformanceMetrics,
    improvements: any
  ): string[] {
    const recommendations: string[] = [];

    if (improvements.riskReduction > 0.1) {
      recommendations.push('Significant risk reduction achieved - continue similar strategies');
    }

    if (improvements.balanceImprovement > 0.1) {
      recommendations.push('Balance improvement successful - monitor for sustained improvement');
    }

    if (afterMetrics.riskMetrics.totalRisk > 0.8) {
      recommendations.push('Risk levels still high - consider additional risk reduction measures');
    }

    if (rebalanceResult.metrics.totalCost > rebalanceResult.metrics.totalBenefit) {
      recommendations.push('Cost exceeded benefits - review strategy efficiency');
    }

    return recommendations;
  }

  private recordPerformanceSnapshot(
    accounts: AccountBalance[],
    metrics: PerformanceMetrics,
    rebalanceId?: string
  ): void {
    this.performanceHistory.push({
      timestamp: new Date(),
      accounts: [...accounts],
      metrics,
      rebalanceId
    });

    if (this.performanceHistory.length > this.maxHistoryLength) {
      this.performanceHistory.shift();
    }
  }

  private getHistoricalData(start: Date, end: Date) {
    return this.performanceHistory.filter(
      entry => entry.timestamp >= start && entry.timestamp <= end
    );
  }

  private calculateAverageMetrics(data: typeof this.performanceHistory): PerformanceMetrics {
    if (data.length === 0) {
      throw new Error('No data available for average calculation');
    }

    // 簡易実装：最新のメトリクスを返す
    return data[data.length - 1].metrics;
  }

  private calculateDegradations(before: PerformanceMetrics, after: PerformanceMetrics) {
    return {
      riskIncrease: Math.max(0, after.riskMetrics.totalRisk - before.riskMetrics.totalRisk),
      balanceDeterioration: Math.max(0, before.balanceMetrics.equityBalance - after.balanceMetrics.equityBalance),
      efficiencyLoss: Math.max(0, before.efficiencyMetrics.marginEfficiency - after.efficiencyMetrics.marginEfficiency),
      stabilityLoss: Math.max(0, before.stabilityMetrics.sharpeRatio - after.stabilityMetrics.sharpeRatio)
    };
  }

  private calculateNetBenefit(improvements: any, degradations: any): number {
    const improvementScore = Object.values(improvements).reduce((sum: number, val: any) => sum + val, 0);
    const degradationScore = Object.values(degradations).reduce((sum: number, val: any) => sum + val, 0);
    return improvementScore - degradationScore;
  }

  private calculateConfidenceLevel(data1: typeof this.performanceHistory, data2: typeof this.performanceHistory): number {
    // 簡易実装：データ量ベースの信頼度
    const minSampleSize = 10;
    const actualSampleSize = Math.min(data1.length, data2.length);
    return Math.min(1, actualSampleSize / minSampleSize);
  }

  private getStartDateForPeriod(endDate: Date, period: 'day' | 'week' | 'month' | 'quarter'): Date {
    const start = new Date(endDate);
    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
    }
    return start;
  }

  private calculateTrends(dataPoints: TrendAnalysis['dataPoints']) {
    // 簡易実装：最新のトレンドを分析
    const recent = dataPoints.slice(-5);
    const older = dataPoints.slice(-10, -5);

    const recentAvg = this.calculateAverageMetrics(recent.map(dp => ({
      timestamp: dp.timestamp,
      accounts: [],
      metrics: dp.metrics
    })));

    const olderAvg = this.calculateAverageMetrics(older.map(dp => ({
      timestamp: dp.timestamp,
      accounts: [],
      metrics: dp.metrics
    })));

    return {
      riskTrend: recentAvg.riskMetrics.totalRisk < olderAvg.riskMetrics.totalRisk ? 'improving' : 'deteriorating',
      balanceTrend: recentAvg.balanceMetrics.equityBalance > olderAvg.balanceMetrics.equityBalance ? 'improving' : 'deteriorating',
      efficiencyTrend: recentAvg.efficiencyMetrics.marginEfficiency > olderAvg.efficiencyMetrics.marginEfficiency ? 'improving' : 'deteriorating',
      stabilityTrend: recentAvg.stabilityMetrics.sharpeRatio > olderAvg.stabilityMetrics.sharpeRatio ? 'improving' : 'deteriorating'
    };
  }

  private generateProjections(dataPoints: TrendAnalysis['dataPoints']) {
    // 簡易実装：線形予測
    const latest = dataPoints[dataPoints.length - 1].metrics;
    
    return {
      nextWeek: latest,
      nextMonth: latest,
      confidence: 0.7
    };
  }

  private calculateAvoidedLosses(
    timeframe: { start: Date; end: Date },
    rebalances: RebalanceExecutionResult[]
  ): number {
    return rebalances.reduce((sum, r) => sum + r.metrics.riskReduction * 100, 0);
  }

  private calculateAnnualizedROI(
    totalReturns: number,
    totalInvestments: number,
    timeframe: { start: Date; end: Date }
  ): number {
    const daysDiff = (timeframe.end.getTime() - timeframe.start.getTime()) / (1000 * 60 * 60 * 24);
    const yearsElapsed = daysDiff / 365;
    
    if (yearsElapsed <= 0 || totalInvestments <= 0) return 0;
    
    return Math.pow(totalReturns / totalInvestments, 1 / yearsElapsed) - 1;
  }

  private calculatePaybackPeriod(
    investments: ROIAnalysis['investments'],
    returns: ROIAnalysis['returns'],
    timeframe: { start: Date; end: Date }
  ): number {
    const totalReturns = Object.values(returns).reduce((sum, val) => sum + val, 0);
    const dailyReturn = totalReturns / ((timeframe.end.getTime() - timeframe.start.getTime()) / (1000 * 60 * 60 * 24));
    
    return dailyReturn > 0 ? investments.totalCost / dailyReturn : Infinity;
  }

  private calculateBreakEvenPoint(
    investments: ROIAnalysis['investments'],
    returns: ROIAnalysis['returns'],
    timeframe: { start: Date; end: Date }
  ): Date | undefined {
    const paybackDays = this.calculatePaybackPeriod(investments, returns, timeframe);
    
    if (paybackDays === Infinity) return undefined;
    
    const breakEven = new Date(timeframe.start);
    breakEven.setDate(breakEven.getDate() + paybackDays);
    
    return breakEven;
  }

  private startPerformanceMonitoring(): void {
    // 定期的なパフォーマンス記録
    setInterval(() => {
      // 実際の実装では現在のアカウント状態を取得して記録
      this.emit('performanceMonitoringUpdate', {
        timestamp: new Date(),
        historyLength: this.performanceHistory.length
      });
    }, this.samplingInterval);
  }

  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * パフォーマンス履歴の取得
   */
  getPerformanceHistory(limit?: number): typeof this.performanceHistory {
    const history = [...this.performanceHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * リバランス履歴の取得
   */
  getRebalanceHistory(): Map<string, RebalanceExecutionResult> {
    return new Map(this.rebalanceHistory);
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.performanceHistory.length = 0;
    this.rebalanceHistory.clear();
    this.removeAllListeners();
  }
}