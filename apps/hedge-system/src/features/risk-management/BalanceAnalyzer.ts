import { EventEmitter } from 'events';
import { AccountBalance, PositionSummary } from './CrossAccountRebalancer';

/**
 * バランス分析詳細結果
 */
export interface DetailedBalanceAnalysis {
  analysisId: string;
  timestamp: Date;
  accounts: AccountBalance[];
  overallMetrics: {
    totalEquity: number;
    totalRiskExposure: number;
    averageMarginLevel: number;
    riskConcentration: number;
    correlationScore: number;
  };
  imbalanceMetrics: {
    equityImbalance: number;
    riskImbalance: number;
    marginImbalance: number;
    positionImbalance: number;
  };
  riskMetrics: {
    systemicRisk: number;
    concentrationRisk: number;
    liquidityRisk: number;
    correlationRisk: number;
  };
  correlationMatrix: number[][];
  accountRankings: {
    byRisk: string[];
    byBalance: string[];
    byEfficiency: string[];
  };
  recommendations: BalanceRecommendation[];
}

/**
 * バランス推奨事項
 */
export interface BalanceRecommendation {
  type: 'rebalance' | 'risk_reduction' | 'efficiency_improvement' | 'emergency_action';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimatedImpact: number;
  estimatedCost: number;
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  requiredActions: string[];
}

/**
 * 相関関係分析結果
 */
export interface CorrelationAnalysis {
  accountPairs: Array<{
    account1: string;
    account2: string;
    correlation: number;
    riskCorrelation: number;
    positionCorrelation: number;
    significance: 'low' | 'medium' | 'high';
  }>;
  clusters: Array<{
    accounts: string[];
    averageCorrelation: number;
    riskLevel: number;
  }>;
  diversificationScore: number;
}

/**
 * 監視アラート
 */
export interface BalanceAlert {
  alertId: string;
  type: 'imbalance' | 'concentration' | 'correlation' | 'efficiency';
  severity: 'info' | 'warning' | 'error' | 'critical';
  accountsInvolved: string[];
  message: string;
  metrics: Record<string, number>;
  timestamp: Date;
  autoResolvable: boolean;
  suggestedActions: string[];
}

/**
 * バランス分析エンジン
 */
export class BalanceAnalyzer extends EventEmitter {
  private readonly maxHistoryLength = 100;
  private analysisHistory: DetailedBalanceAnalysis[] = [];
  private correlationWindow = 50; // 分析に使用する履歴数
  private alertThresholds = {
    equityImbalance: 0.3,      // 30%
    riskImbalance: 0.4,        // 40%
    correlationRisk: 0.8,      // 80%
    concentrationRisk: 0.6     // 60%
  };

  constructor() {
    super();
  }

  /**
   * 詳細バランス分析を実行
   */
  async analyzeDetailedBalance(accounts: AccountBalance[]): Promise<DetailedBalanceAnalysis> {
    const analysisId = this.generateAnalysisId();
    const timestamp = new Date();

    // 全体メトリクスの計算
    const overallMetrics = this.calculateOverallMetrics(accounts);

    // 不均衡メトリクスの計算
    const imbalanceMetrics = this.calculateImbalanceMetrics(accounts);

    // リスクメトリクスの計算
    const riskMetrics = this.calculateRiskMetrics(accounts);

    // 相関行列の計算
    const correlationMatrix = this.calculateCorrelationMatrix(accounts);

    // アカウントランキングの計算
    const accountRankings = this.calculateAccountRankings(accounts);

    // 推奨事項の生成
    const recommendations = this.generateRecommendations(
      accounts,
      overallMetrics,
      imbalanceMetrics,
      riskMetrics
    );

    const analysis: DetailedBalanceAnalysis = {
      analysisId,
      timestamp,
      accounts: [...accounts],
      overallMetrics,
      imbalanceMetrics,
      riskMetrics,
      correlationMatrix,
      accountRankings,
      recommendations
    };

    // 履歴に追加
    this.addToHistory(analysis);

    // アラートのチェック
    this.checkForAlerts(analysis);

    this.emit('detailedAnalysisCompleted', analysis);

    return analysis;
  }

  /**
   * 全体メトリクスの計算
   */
  private calculateOverallMetrics(accounts: AccountBalance[]) {
    const totalEquity = accounts.reduce((sum, acc) => sum + acc.totalEquity, 0);
    const totalRiskExposure = accounts.reduce((sum, acc) => sum + acc.riskExposure, 0);
    const averageMarginLevel = accounts.reduce((sum, acc) => sum + acc.marginLevel, 0) / accounts.length;

    // リスク集中度の計算
    const riskDistribution = accounts.map(acc => acc.riskExposure / totalRiskExposure);
    const riskConcentration = this.calculateConcentrationIndex(riskDistribution);

    // 相関スコアの計算（簡易版）
    const correlationScore = this.calculateAverageCorrelation(accounts);

    return {
      totalEquity,
      totalRiskExposure,
      averageMarginLevel,
      riskConcentration,
      correlationScore
    };
  }

  /**
   * 不均衡メトリクスの計算
   */
  private calculateImbalanceMetrics(accounts: AccountBalance[]) {
    const equityValues = accounts.map(acc => acc.totalEquity);
    const riskValues = accounts.map(acc => acc.riskExposure);
    const marginValues = accounts.map(acc => acc.marginLevel);
    const positionCounts = accounts.map(acc => acc.positions.length);

    return {
      equityImbalance: this.calculateVariationCoefficient(equityValues),
      riskImbalance: this.calculateVariationCoefficient(riskValues),
      marginImbalance: this.calculateVariationCoefficient(marginValues),
      positionImbalance: this.calculateVariationCoefficient(positionCounts)
    };
  }

  /**
   * リスクメトリクスの計算
   */
  private calculateRiskMetrics(accounts: AccountBalance[]) {
    const totalEquity = accounts.reduce((sum, acc) => sum + acc.totalEquity, 0);
    const totalRisk = accounts.reduce((sum, acc) => sum + acc.riskExposure, 0);

    // システミックリスク
    const systemicRisk = totalEquity > 0 ? totalRisk / totalEquity : 0;

    // 集中リスク
    const riskDistribution = accounts.map(acc => acc.riskExposure);
    const concentrationRisk = this.calculateConcentrationIndex(riskDistribution);

    // 流動性リスク（証拠金レベルベース）
    const criticalAccounts = accounts.filter(acc => acc.marginLevel < 200).length;
    const liquidityRisk = criticalAccounts / accounts.length;

    // 相関リスク
    const correlationRisk = this.calculateCorrelationRisk(accounts);

    return {
      systemicRisk,
      concentrationRisk,
      liquidityRisk,
      correlationRisk
    };
  }

  /**
   * 相関行列の計算
   */
  private calculateCorrelationMatrix(accounts: AccountBalance[]): number[][] {
    const n = accounts.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          matrix[i][j] = this.calculatePairwiseCorrelation(accounts[i], accounts[j]);
        }
      }
    }

    return matrix;
  }

  /**
   * ペアワイズ相関の計算
   */
  private calculatePairwiseCorrelation(account1: AccountBalance, account2: AccountBalance): number {
    // 簡易実装：実際の実装では履歴データを使用
    const factors = [
      account1.totalEquity / 10000,
      account1.riskExposure / 1000,
      account1.marginLevel / 100,
      account1.positions.length
    ];

    const factors2 = [
      account2.totalEquity / 10000,
      account2.riskExposure / 1000,
      account2.marginLevel / 100,
      account2.positions.length
    ];

    return this.pearsonCorrelation(factors, factors2);
  }

  /**
   * ピアソン相関係数の計算
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n !== y.length || n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * アカウントランキングの計算
   */
  private calculateAccountRankings(accounts: AccountBalance[]) {
    // リスク順（高リスクが上位）
    const byRisk = [...accounts]
      .sort((a, b) => b.riskExposure - a.riskExposure)
      .map(acc => acc.accountId);

    // バランス順（大きな資産が上位）
    const byBalance = [...accounts]
      .sort((a, b) => b.totalEquity - a.totalEquity)
      .map(acc => acc.accountId);

    // 効率順（マージンレベルが高い順）
    const byEfficiency = [...accounts]
      .sort((a, b) => b.marginLevel - a.marginLevel)
      .map(acc => acc.accountId);

    return {
      byRisk,
      byBalance,
      byEfficiency
    };
  }

  /**
   * 推奨事項の生成
   */
  private generateRecommendations(
    accounts: AccountBalance[],
    overallMetrics: any,
    imbalanceMetrics: any,
    riskMetrics: any
  ): BalanceRecommendation[] {
    const recommendations: BalanceRecommendation[] = [];

    // 緊急アクション（高リスク）
    if (riskMetrics.systemicRisk > 0.8) {
      recommendations.push({
        type: 'emergency_action',
        priority: 'critical',
        description: 'Systemic risk level is critical - immediate risk reduction required',
        estimatedImpact: 0.9,
        estimatedCost: 500,
        timeframe: 'immediate',
        requiredActions: [
          'Close high-risk positions',
          'Redistribute exposure across accounts',
          'Increase margin levels'
        ]
      });
    }

    // リスク軽減
    if (riskMetrics.concentrationRisk > 0.6) {
      recommendations.push({
        type: 'risk_reduction',
        priority: 'high',
        description: 'High risk concentration detected - diversification recommended',
        estimatedImpact: 0.7,
        estimatedCost: 200,
        timeframe: 'short_term',
        requiredActions: [
          'Diversify positions across more accounts',
          'Reduce position sizes in high-risk accounts'
        ]
      });
    }

    // バランス調整
    if (imbalanceMetrics.equityImbalance > 0.3) {
      recommendations.push({
        type: 'rebalance',
        priority: 'medium',
        description: 'Significant equity imbalance between accounts',
        estimatedImpact: 0.5,
        estimatedCost: 100,
        timeframe: 'medium_term',
        requiredActions: [
          'Transfer funds between accounts',
          'Adjust position sizes to balance equity'
        ]
      });
    }

    // 効率改善
    if (overallMetrics.averageMarginLevel < 250) {
      recommendations.push({
        type: 'efficiency_improvement',
        priority: 'medium',
        description: 'Low average margin level - efficiency improvements possible',
        estimatedImpact: 0.4,
        estimatedCost: 50,
        timeframe: 'long_term',
        requiredActions: [
          'Optimize position sizes',
          'Improve margin utilization'
        ]
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * 相関分析の実行
   */
  analyzeCorrelations(accounts: AccountBalance[]): CorrelationAnalysis {
    const accountPairs: CorrelationAnalysis['accountPairs'] = [];
    
    for (let i = 0; i < accounts.length; i++) {
      for (let j = i + 1; j < accounts.length; j++) {
        const correlation = this.calculatePairwiseCorrelation(accounts[i], accounts[j]);
        const riskCorrelation = this.calculateRiskCorrelation(accounts[i], accounts[j]);
        const positionCorrelation = this.calculatePositionCorrelation(accounts[i], accounts[j]);
        
        let significance: 'low' | 'medium' | 'high' = 'low';
        const avgCorr = (Math.abs(correlation) + Math.abs(riskCorrelation) + Math.abs(positionCorrelation)) / 3;
        if (avgCorr > 0.7) significance = 'high';
        else if (avgCorr > 0.4) significance = 'medium';

        accountPairs.push({
          account1: accounts[i].accountId,
          account2: accounts[j].accountId,
          correlation,
          riskCorrelation,
          positionCorrelation,
          significance
        });
      }
    }

    // クラスタリング（簡易実装）
    const clusters = this.performClustering(accounts, accountPairs);

    // 多様化スコア
    const diversificationScore = this.calculateDiversificationScore(accountPairs);

    return {
      accountPairs,
      clusters,
      diversificationScore
    };
  }

  /**
   * アラートチェック
   */
  private checkForAlerts(analysis: DetailedBalanceAnalysis): void {
    const alerts: BalanceAlert[] = [];

    // 不均衡アラート
    if (analysis.imbalanceMetrics.equityImbalance > this.alertThresholds.equityImbalance) {
      alerts.push({
        alertId: this.generateAlertId(),
        type: 'imbalance',
        severity: 'warning',
        accountsInvolved: analysis.accounts.map(acc => acc.accountId),
        message: `High equity imbalance detected: ${(analysis.imbalanceMetrics.equityImbalance * 100).toFixed(1)}%`,
        metrics: { imbalance: analysis.imbalanceMetrics.equityImbalance },
        timestamp: new Date(),
        autoResolvable: true,
        suggestedActions: ['Rebalance equity across accounts']
      });
    }

    // 集中リスクアラート
    if (analysis.riskMetrics.concentrationRisk > this.alertThresholds.concentrationRisk) {
      alerts.push({
        alertId: this.generateAlertId(),
        type: 'concentration',
        severity: 'error',
        accountsInvolved: analysis.accountRankings.byRisk.slice(0, 3),
        message: `High risk concentration detected: ${(analysis.riskMetrics.concentrationRisk * 100).toFixed(1)}%`,
        metrics: { concentration: analysis.riskMetrics.concentrationRisk },
        timestamp: new Date(),
        autoResolvable: true,
        suggestedActions: ['Diversify risk across more accounts']
      });
    }

    // 相関リスクアラート
    if (analysis.riskMetrics.correlationRisk > this.alertThresholds.correlationRisk) {
      alerts.push({
        alertId: this.generateAlertId(),
        type: 'correlation',
        severity: 'warning',
        accountsInvolved: analysis.accounts.map(acc => acc.accountId),
        message: `High correlation risk detected: ${(analysis.riskMetrics.correlationRisk * 100).toFixed(1)}%`,
        metrics: { correlation: analysis.riskMetrics.correlationRisk },
        timestamp: new Date(),
        autoResolvable: false,
        suggestedActions: ['Review account positioning strategies']
      });
    }

    // アラートの発行
    alerts.forEach(alert => {
      this.emit('balanceAlert', alert);
    });
  }

  // ユーティリティメソッド
  private calculateConcentrationIndex(values: number[]): number {
    const total = values.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;

    const normalizedValues = values.map(val => val / total);
    const herfindahlIndex = normalizedValues.reduce((sum, val) => sum + val * val, 0);
    
    return herfindahlIndex;
  }

  private calculateVariationCoefficient(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (mean === 0) return 0;

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean;
  }

  private calculateAverageCorrelation(accounts: AccountBalance[]): number {
    if (accounts.length < 2) return 0;

    let totalCorrelation = 0;
    let pairCount = 0;

    for (let i = 0; i < accounts.length; i++) {
      for (let j = i + 1; j < accounts.length; j++) {
        totalCorrelation += Math.abs(this.calculatePairwiseCorrelation(accounts[i], accounts[j]));
        pairCount++;
      }
    }

    return pairCount > 0 ? totalCorrelation / pairCount : 0;
  }

  private calculateCorrelationRisk(accounts: AccountBalance[]): number {
    const avgCorrelation = this.calculateAverageCorrelation(accounts);
    return Math.min(1, avgCorrelation * 1.5); // 相関が高いほどリスクが高い
  }

  private calculateRiskCorrelation(account1: AccountBalance, account2: AccountBalance): number {
    return Math.random() * 0.8 - 0.4; // -0.4 to 0.4 の範囲
  }

  private calculatePositionCorrelation(account1: AccountBalance, account2: AccountBalance): number {
    const symbols1 = new Set(account1.positions.map(p => p.symbol));
    const symbols2 = new Set(account2.positions.map(p => p.symbol));
    const intersection = new Set([...symbols1].filter(s => symbols2.has(s)));
    
    return intersection.size / Math.max(symbols1.size, symbols2.size, 1);
  }

  private performClustering(
    accounts: AccountBalance[], 
    pairs: CorrelationAnalysis['accountPairs']
  ): CorrelationAnalysis['clusters'] {
    // 簡易クラスタリング実装
    const clusters: CorrelationAnalysis['clusters'] = [];
    const processed = new Set<string>();

    for (const account of accounts) {
      if (processed.has(account.accountId)) continue;

      const cluster = [account.accountId];
      const relatedPairs = pairs.filter(p => 
        (p.account1 === account.accountId || p.account2 === account.accountId) &&
        p.significance === 'high'
      );

      for (const pair of relatedPairs) {
        const otherAccount = pair.account1 === account.accountId ? pair.account2 : pair.account1;
        if (!processed.has(otherAccount)) {
          cluster.push(otherAccount);
          processed.add(otherAccount);
        }
      }

      processed.add(account.accountId);
      
      if (cluster.length > 1) {
        const averageCorrelation = relatedPairs.reduce((sum, p) => sum + Math.abs(p.correlation), 0) / relatedPairs.length;
        const riskLevel = cluster.reduce((sum, id) => {
          const acc = accounts.find(a => a.accountId === id);
          return sum + (acc ? acc.riskExposure : 0);
        }, 0);

        clusters.push({
          accounts: cluster,
          averageCorrelation,
          riskLevel
        });
      }
    }

    return clusters;
  }

  private calculateDiversificationScore(pairs: CorrelationAnalysis['accountPairs']): number {
    if (pairs.length === 0) return 1;

    const avgCorrelation = pairs.reduce((sum, p) => sum + Math.abs(p.correlation), 0) / pairs.length;
    return Math.max(0, 1 - avgCorrelation);
  }

  private addToHistory(analysis: DetailedBalanceAnalysis): void {
    this.analysisHistory.push(analysis);
    
    if (this.analysisHistory.length > this.maxHistoryLength) {
      this.analysisHistory.shift();
    }
  }

  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 履歴の取得
   */
  getAnalysisHistory(limit?: number): DetailedBalanceAnalysis[] {
    const history = [...this.analysisHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * アラート閾値の更新
   */
  updateAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    this.emit('alertThresholdsUpdated', this.alertThresholds);
  }

  /**
   * 設定の取得
   */
  getSettings() {
    return {
      correlationWindow: this.correlationWindow,
      alertThresholds: { ...this.alertThresholds },
      maxHistoryLength: this.maxHistoryLength
    };
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.analysisHistory.length = 0;
    this.removeAllListeners();
  }
}