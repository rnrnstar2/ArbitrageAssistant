import { Position } from '../close/types';
import { HedgePosition } from './types';

export interface HedgeBalance {
  hedgeId: string;
  symbol: string;
  totalBuyLots: number;
  totalSellLots: number;
  imbalance: number;
  imbalancePercentage: number;
  netExposure: number;
  isBalanced: boolean;
  riskScore: number;
  totalProfit: number;
  averageEntry: {
    buy: number;
    sell: number;
  };
  positionCount: {
    buy: number;
    sell: number;
  };
}

export interface OptimalLots {
  symbol: string;
  recommendedBuyLots: number;
  recommendedSellLots: number;
  adjustmentNeeded: {
    buy: number;
    sell: number;
  };
  confidenceScore: number;
  reasoning: string;
}

export interface RebalanceAction {
  hedgeId: string;
  required: boolean;
  urgency: 'low' | 'medium' | 'high';
  actions: RebalanceStep[];
  estimatedCost: number;
  expectedImprovement: number;
  riskReduction: number;
}

export interface RebalanceStep {
  action: 'open' | 'close' | 'adjust';
  positionType: 'buy' | 'sell';
  lots: number;
  targetPrice?: number;
  accountId?: string;
  priority: number;
  reasoning: string;
}

export interface RiskMetrics {
  hedgeId: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  exposureRisk: number;
  liquidityRisk: number;
  correlationRisk: number;
  marginRisk: number;
  drawdownRisk: number;
  metrics: {
    valueAtRisk: number;
    expectedShortfall: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
  };
  warnings: string[];
  recommendations: string[];
}

export interface LiquidityConstraints {
  symbol: string;
  maxPositionSize: number;
  minSpread: number;
  marketDepth: number;
  tradingHours: {
    isOpen: boolean;
    nextOpen?: Date;
    nextClose?: Date;
  };
}

export interface OptimizationParams {
  riskTolerance: number; // 0-1
  costSensitivity: number; // 0-1
  liquidityPreference: number; // 0-1
  maxImbalance: number;
  maxDrawdown: number;
  minProfit: number;
}

export class HedgeBalanceCalculator {
  private readonly DEFAULT_OPTIMIZATION_PARAMS: OptimizationParams = {
    riskTolerance: 0.3,
    costSensitivity: 0.7,
    liquidityPreference: 0.5,
    maxImbalance: 0.1,
    maxDrawdown: 0.05,
    minProfit: 0.01
  };

  /**
   * 両建てバランスを計算
   */
  calculateHedgeBalance(hedge: HedgePosition): HedgeBalance {
    const buyLots = hedge.totalLots.buy;
    const sellLots = hedge.totalLots.sell;
    const imbalance = Math.abs(buyLots - sellLots);
    const totalLots = buyLots + sellLots;
    const imbalancePercentage = totalLots > 0 ? (imbalance / totalLots) * 100 : 0;
    const netExposure = buyLots - sellLots;
    const isBalanced = imbalance <= hedge.settings.maxImbalance;
    
    // リスクスコア計算 (0-100, 低いほど良い)
    let riskScore = 0;
    riskScore += imbalancePercentage * 2; // 不均衡によるリスク
    riskScore += Math.abs(netExposure) * 10; // ネットエクスポージャーリスク
    riskScore = Math.min(100, riskScore);

    return {
      hedgeId: hedge.id,
      symbol: hedge.symbol,
      totalBuyLots: buyLots,
      totalSellLots: sellLots,
      imbalance,
      imbalancePercentage,
      netExposure,
      isBalanced,
      riskScore,
      totalProfit: hedge.totalProfit,
      averageEntry: {
        buy: 0, // 実装では実際のポジション情報から計算
        sell: 0
      },
      positionCount: {
        buy: hedge.positionIds.length, // 簡易実装
        sell: hedge.positionIds.length
      }
    };
  }

  /**
   * 最適ロットサイズを算出
   */
  calculateOptimalLots(
    positions: Position[], 
    params: Partial<OptimizationParams> = {}
  ): OptimalLots {
    const optimizationParams = { ...this.DEFAULT_OPTIMIZATION_PARAMS, ...params };
    
    if (positions.length === 0) {
      throw new Error('ポジションリストが空です');
    }

    const symbol = positions[0].symbol;
    const buyPositions = positions.filter(p => p.type === 'buy');
    const sellPositions = positions.filter(p => p.type === 'sell');
    
    const currentBuyLots = buyPositions.reduce((sum, p) => sum + p.lots, 0);
    const currentSellLots = sellPositions.reduce((sum, p) => sum + p.lots, 0);
    
    // 最適化アルゴリズム
    const optimalBalance = this.calculateOptimalBalance(
      currentBuyLots, 
      currentSellLots, 
      optimizationParams
    );
    
    // 調整量計算
    const adjustmentNeeded = {
      buy: Math.max(0, optimalBalance.buy - currentBuyLots),
      sell: Math.max(0, optimalBalance.sell - currentSellLots)
    };
    
    // 信頼度スコア計算
    const confidenceScore = this.calculateConfidenceScore(
      positions, 
      optimalBalance, 
      optimizationParams
    );
    
    // 推奨理由の生成
    const reasoning = this.generateOptimizationReasoning(
      currentBuyLots, 
      currentSellLots, 
      optimalBalance, 
      optimizationParams
    );

    return {
      symbol,
      recommendedBuyLots: optimalBalance.buy,
      recommendedSellLots: optimalBalance.sell,
      adjustmentNeeded,
      confidenceScore,
      reasoning
    };
  }

  /**
   * リバランス必要量を計算
   */
  calculateRebalanceRequirement(hedge: HedgePosition): RebalanceAction {
    const balance = this.calculateHedgeBalance(hedge);
    const required = !balance.isBalanced || balance.riskScore > 50;
    
    let urgency: 'low' | 'medium' | 'high' = 'low';
    if (balance.riskScore > 80) urgency = 'high';
    else if (balance.riskScore > 50) urgency = 'medium';
    
    const actions: RebalanceStep[] = [];
    
    if (required) {
      // 不均衡の解消アクション生成
      if (balance.imbalance > hedge.settings.maxImbalance) {
        if (balance.totalBuyLots > balance.totalSellLots) {
          actions.push({
            action: 'open',
            positionType: 'sell',
            lots: balance.imbalance,
            priority: 1,
            reasoning: '買いポジション過多による売りポジション追加'
          });
        } else {
          actions.push({
            action: 'open',
            positionType: 'buy',
            lots: balance.imbalance,
            priority: 1,
            reasoning: '売りポジション過多による買いポジション追加'
          });
        }
      }
    }
    
    // コスト推定
    const estimatedCost = actions.reduce((sum, action) => {
      return sum + (action.lots * 0.001); // 簡易スプレッドコスト
    }, 0);
    
    return {
      hedgeId: hedge.id,
      required,
      urgency,
      actions,
      estimatedCost,
      expectedImprovement: required ? Math.max(0, balance.riskScore - 30) : 0,
      riskReduction: required ? balance.riskScore * 0.6 : 0
    };
  }

  /**
   * リスク指標を計算
   */
  calculateRiskMetrics(hedge: HedgePosition): RiskMetrics {
    const balance = this.calculateHedgeBalance(hedge);
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // 全体リスクレベル判定
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (balance.riskScore > 90) overallRisk = 'critical';
    else if (balance.riskScore > 70) overallRisk = 'high';
    else if (balance.riskScore > 40) overallRisk = 'medium';
    
    // 各種リスク指標計算
    const exposureRisk = Math.min(100, Math.abs(balance.netExposure) * 50);
    const liquidityRisk = this.calculateLiquidityRisk(hedge);
    const correlationRisk = this.calculateCorrelationRisk(hedge);
    const marginRisk = this.calculateMarginRisk(hedge);
    const drawdownRisk = this.calculateDrawdownRisk(hedge);
    
    // 警告とレコメンデーション生成
    if (balance.imbalancePercentage > 20) {
      warnings.push('両建てバランスが大きく崩れています');
      recommendations.push('リバランス実行を検討してください');
    }
    
    if (Math.abs(balance.totalProfit) > 1000) {
      warnings.push('大きな含み損益が発生しています');
      recommendations.push('利益確定または損切りを検討してください');
    }
    
    // バリュー・アット・リスク等の計算（簡易実装）
    const valueAtRisk = Math.abs(balance.netExposure) * 0.02; // 2%の価格変動を想定
    const expectedShortfall = valueAtRisk * 1.5;
    const volatility = this.estimateVolatility(hedge);
    const maxDrawdown = Math.abs(Math.min(0, balance.totalProfit)) / 
                        Math.max(1, Math.abs(balance.totalProfit));
    const sharpeRatio = balance.totalProfit > 0 ? balance.totalProfit / volatility : 0;
    
    return {
      hedgeId: hedge.id,
      overallRisk,
      exposureRisk,
      liquidityRisk,
      correlationRisk,
      marginRisk,
      drawdownRisk,
      metrics: {
        valueAtRisk,
        expectedShortfall,
        sharpeRatio,
        maxDrawdown,
        volatility
      },
      warnings,
      recommendations
    };
  }

  /**
   * 最適バランスを計算する最適化アルゴリズム
   */
  private calculateOptimalBalance(
    currentBuy: number, 
    currentSell: number, 
    params: OptimizationParams
  ): { buy: number; sell: number } {
    const totalLots = currentBuy + currentSell;
    
    // 最小リスク両建て比率（デフォルトは50:50）
    let targetBuyRatio = 0.5;
    let targetSellRatio = 0.5;
    
    // リスク許容度に基づく調整
    if (params.riskTolerance > 0.5) {
      // リスク許容度が高い場合、より攻撃的な配分
      const deviation = (params.riskTolerance - 0.5) * 0.3;
      targetBuyRatio += deviation;
      targetSellRatio -= deviation;
    }
    
    // 流動性制約の考慮
    if (params.liquidityPreference > 0.7) {
      // 流動性を重視する場合、バランスを維持
      targetBuyRatio = 0.5;
      targetSellRatio = 0.5;
    }
    
    return {
      buy: Math.max(0.01, totalLots * targetBuyRatio),
      sell: Math.max(0.01, totalLots * targetSellRatio)
    };
  }

  /**
   * 信頼度スコアを計算
   */
  private calculateConfidenceScore(
    positions: Position[], 
    optimalBalance: { buy: number; sell: number }, 
    params: OptimizationParams
  ): number {
    let score = 0.5; // ベーススコア
    
    // データ量による調整
    const dataQuality = Math.min(1, positions.length / 10);
    score += dataQuality * 0.3;
    
    // リスク許容度による調整
    score += params.riskTolerance * 0.2;
    
    return Math.min(1, Math.max(0, score));
  }

  /**
   * 最適化理由を生成
   */
  private generateOptimizationReasoning(
    currentBuy: number, 
    currentSell: number, 
    optimal: { buy: number; sell: number }, 
    params: OptimizationParams
  ): string {
    const buyAdjustment = optimal.buy - currentBuy;
    const sellAdjustment = optimal.sell - currentSell;
    
    if (Math.abs(buyAdjustment) < 0.01 && Math.abs(sellAdjustment) < 0.01) {
      return '現在のバランスは最適です';
    }
    
    const reasons: string[] = [];
    
    if (buyAdjustment > 0.01) {
      reasons.push(`買いポジション${buyAdjustment.toFixed(2)}ロット追加推奨`);
    } else if (buyAdjustment < -0.01) {
      reasons.push(`買いポジション${Math.abs(buyAdjustment).toFixed(2)}ロット削減推奨`);
    }
    
    if (sellAdjustment > 0.01) {
      reasons.push(`売りポジション${sellAdjustment.toFixed(2)}ロット追加推奨`);
    } else if (sellAdjustment < -0.01) {
      reasons.push(`売りポジション${Math.abs(sellAdjustment).toFixed(2)}ロット削減推奨`);
    }
    
    if (params.riskTolerance < 0.3) {
      reasons.push('リスク抑制のため');
    } else if (params.riskTolerance > 0.7) {
      reasons.push('リターン最大化のため');
    }
    
    return reasons.join(', ');
  }

  /**
   * 流動性リスクを計算
   */
  private calculateLiquidityRisk(hedge: HedgePosition): number {
    // 通貨ペアと取引量に基づく簡易計算
    const totalLots = hedge.totalLots.buy + hedge.totalLots.sell;
    
    // メジャー通貨ペアの判定（簡易）
    const majorPairs = ['EURUSD', 'USDJPY', 'GBPUSD', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'];
    const isMajorPair = majorPairs.includes(hedge.symbol);
    
    let risk = 0;
    
    // 通貨ペアリスク
    if (!isMajorPair) {
      risk += 30; // マイナー通貨ペアは流動性リスクが高い
    }
    
    // 取引量リスク
    if (totalLots > 10) {
      risk += (totalLots - 10) * 2; // 大量取引は流動性リスクが高い
    }
    
    return Math.min(100, risk);
  }

  /**
   * 相関リスクを計算
   */
  private calculateCorrelationRisk(hedge: HedgePosition): number {
    // 両建ての場合、基本的に相関リスクは低い
    if (hedge.hedgeType === 'perfect') {
      return 5; // 完全両建ては相関リスクが非常に低い
    } else if (hedge.hedgeType === 'partial') {
      return 15; // 部分両建ては少し相関リスクがある
    } else {
      return 25; // クロスアカウント両建ては相関リスクがやや高い
    }
  }

  /**
   * 証拠金リスクを計算
   */
  private calculateMarginRisk(hedge: HedgePosition): number {
    const totalLots = hedge.totalLots.buy + hedge.totalLots.sell;
    
    // 簡易証拠金リスク計算
    let risk = 0;
    
    // 取引量に基づくリスク
    if (totalLots > 5) {
      risk += (totalLots - 5) * 5;
    }
    
    // アカウント分散によるリスク軽減
    if (hedge.accounts.length > 1) {
      risk *= 0.7; // 複数口座は証拠金リスクを軽減
    }
    
    return Math.min(100, risk);
  }

  /**
   * ドローダウンリスクを計算
   */
  private calculateDrawdownRisk(hedge: HedgePosition): number {
    const currentDrawdown = Math.abs(Math.min(0, hedge.totalProfit));
    const totalExposure = (hedge.totalLots.buy + hedge.totalLots.sell) * 100000; // 概算投資額
    
    if (totalExposure === 0) return 0;
    
    const drawdownRatio = currentDrawdown / totalExposure;
    return Math.min(100, drawdownRatio * 200); // 200倍してリスクスコア化
  }

  /**
   * ボラティリティを推定
   */
  private estimateVolatility(hedge: HedgePosition): number {
    // 通貨ペア別の概算ボラティリティ
    const volatilityMap: Record<string, number> = {
      'EURUSD': 0.012,
      'USDJPY': 0.010,
      'GBPUSD': 0.015,
      'USDCHF': 0.011,
      'AUDUSD': 0.014,
      'USDCAD': 0.012,
      'NZDUSD': 0.016,
      'DEFAULT': 0.015
    };
    
    return volatilityMap[hedge.symbol] || volatilityMap['DEFAULT'];
  }

  /**
   * 市場条件に基づく調整係数を取得
   */
  private getMarketAdjustmentFactor(): number {
    // 実装では実際の市場条件（ボラティリティ、スプレッド等）から計算
    // 現在は固定値
    return 1.0;
  }

  /**
   * バランス計算の品質チェック
   */
  validateCalculation(hedge: HedgePosition): {
    isValid: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // 基本的な整合性チェック
    if (hedge.totalLots.buy < 0 || hedge.totalLots.sell < 0) {
      warnings.push('負のロット数が検出されました');
    }
    
    if (hedge.positionIds.length === 0) {
      warnings.push('関連ポジションが存在しません');
    }
    
    // バランスチェック
    const balance = this.calculateHedgeBalance(hedge);
    if (balance.riskScore > 70) {
      warnings.push('高リスク状態です');
      recommendations.push('リバランスを実行することをお勧めします');
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
      recommendations
    };
  }
}