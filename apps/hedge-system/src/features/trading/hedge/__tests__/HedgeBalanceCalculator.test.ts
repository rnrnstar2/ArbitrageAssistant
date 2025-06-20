import { describe, it, expect, beforeEach } from 'vitest';
import { HedgeBalanceCalculator, HedgeBalance, OptimalLots, RebalanceAction, RiskMetrics, OptimizationParams } from '../HedgeBalanceCalculator';
import { HedgePosition } from '../types';
import { Position } from '../close/types';

describe('HedgeBalanceCalculator', () => {
  let calculator: HedgeBalanceCalculator;
  let mockHedgePosition: HedgePosition;
  let mockPositions: Position[];

  beforeEach(() => {
    calculator = new HedgeBalanceCalculator();
    
    // モック両建てポジション
    mockHedgePosition = {
      id: 'hedge_001',
      positionIds: ['pos1', 'pos2'],
      symbol: 'EURUSD',
      hedgeType: 'perfect',
      accounts: ['acc1'],
      totalLots: {
        buy: 1.0,
        sell: 1.0
      },
      totalProfit: 50.0,
      isBalanced: true,
      createdAt: new Date('2024-06-20T10:00:00Z'),
      settings: {
        autoRebalance: true,
        maxImbalance: 0.1,
        maintainOnClose: true
      }
    };

    // モックポジション
    mockPositions = [
      {
        id: 'pos1',
        accountId: 'acc1',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 50.0,
        openedAt: new Date('2024-06-20T10:00:00Z')
      },
      {
        id: 'pos2',
        accountId: 'acc1',
        symbol: 'EURUSD',
        type: 'sell',
        lots: 1.0,
        openPrice: 1.1005,
        currentPrice: 1.1055,
        profit: -50.0,
        openedAt: new Date('2024-06-20T10:05:00Z')
      }
    ];
  });

  describe('calculateHedgeBalance', () => {
    it('should calculate perfect hedge balance correctly', () => {
      const balance = calculator.calculateHedgeBalance(mockHedgePosition);

      expect(balance.hedgeId).toBe('hedge_001');
      expect(balance.symbol).toBe('EURUSD');
      expect(balance.totalBuyLots).toBe(1.0);
      expect(balance.totalSellLots).toBe(1.0);
      expect(balance.imbalance).toBe(0.0);
      expect(balance.imbalancePercentage).toBe(0.0);
      expect(balance.netExposure).toBe(0.0);
      expect(balance.isBalanced).toBe(true);
      expect(balance.riskScore).toBe(0);
      expect(balance.totalProfit).toBe(50.0);
    });

    it('should calculate partial hedge balance with imbalance', () => {
      const imbalancedHedge: HedgePosition = {
        ...mockHedgePosition,
        hedgeType: 'partial',
        totalLots: {
          buy: 1.5,
          sell: 1.0
        },
        isBalanced: false
      };

      const balance = calculator.calculateHedgeBalance(imbalancedHedge);

      expect(balance.imbalance).toBe(0.5);
      expect(balance.imbalancePercentage).toBeCloseTo(20, 1); // 0.5 / 2.5 * 100
      expect(balance.netExposure).toBe(0.5);
      expect(balance.isBalanced).toBe(false);
      expect(balance.riskScore).toBeGreaterThan(0);
    });

    it('should handle cross-account hedge', () => {
      const crossAccountHedge: HedgePosition = {
        ...mockHedgePosition,
        hedgeType: 'cross_account',
        accounts: ['acc1', 'acc2']
      };

      const balance = calculator.calculateHedgeBalance(crossAccountHedge);

      expect(balance.hedgeId).toBe('hedge_001');
      expect(balance.isBalanced).toBe(true);
    });
  });

  describe('calculateOptimalLots', () => {
    it('should calculate optimal lots for balanced positions', () => {
      const optimal = calculator.calculateOptimalLots(mockPositions);

      expect(optimal.symbol).toBe('EURUSD');
      expect(optimal.recommendedBuyLots).toBeGreaterThan(0);
      expect(optimal.recommendedSellLots).toBeGreaterThan(0);
      expect(optimal.confidenceScore).toBeGreaterThan(0);
      expect(optimal.confidenceScore).toBeLessThanOrEqual(1);
      expect(optimal.reasoning).toBeDefined();
    });

    it('should suggest adjustments for imbalanced positions', () => {
      const imbalancedPositions: Position[] = [
        {
          ...mockPositions[0],
          lots: 2.0
        },
        {
          ...mockPositions[1],
          lots: 1.0
        }
      ];

      const optimal = calculator.calculateOptimalLots(imbalancedPositions);

      expect(optimal.adjustmentNeeded.buy + optimal.adjustmentNeeded.sell).toBeGreaterThan(0);
    });

    it('should handle custom optimization parameters', () => {
      const customParams: Partial<OptimizationParams> = {
        riskTolerance: 0.8,
        costSensitivity: 0.2,
        maxImbalance: 0.05
      };

      const optimal = calculator.calculateOptimalLots(mockPositions, customParams);

      expect(optimal.confidenceScore).toBeGreaterThan(0);
      expect(optimal.reasoning).toContain('リターン最大化');
    });

    it('should throw error for empty positions', () => {
      expect(() => calculator.calculateOptimalLots([])).toThrow('ポジションリストが空です');
    });
  });

  describe('calculateRebalanceRequirement', () => {
    it('should not require rebalance for balanced hedge', () => {
      const rebalance = calculator.calculateRebalanceRequirement(mockHedgePosition);

      expect(rebalance.hedgeId).toBe('hedge_001');
      expect(rebalance.required).toBe(false);
      expect(rebalance.urgency).toBe('low');
      expect(rebalance.actions).toHaveLength(0);
    });

    it('should require rebalance for imbalanced hedge', () => {
      const imbalancedHedge: HedgePosition = {
        ...mockHedgePosition,
        totalLots: {
          buy: 2.0,
          sell: 1.0
        },
        isBalanced: false,
        settings: {
          ...mockHedgePosition.settings,
          maxImbalance: 0.1
        }
      };

      const rebalance = calculator.calculateRebalanceRequirement(imbalancedHedge);

      expect(rebalance.required).toBe(true);
      expect(rebalance.actions.length).toBeGreaterThan(0);
      expect(rebalance.estimatedCost).toBeGreaterThan(0);
      expect(rebalance.expectedImprovement).toBeGreaterThan(0);
    });

    it('should set high urgency for high-risk hedge', () => {
      const highRiskHedge: HedgePosition = {
        ...mockHedgePosition,
        totalLots: {
          buy: 10.0,
          sell: 1.0
        },
        isBalanced: false
      };

      const rebalance = calculator.calculateRebalanceRequirement(highRiskHedge);

      expect(rebalance.urgency).toBe('high');
    });

    it('should generate appropriate rebalance actions', () => {
      const imbalancedHedge: HedgePosition = {
        ...mockHedgePosition,
        totalLots: {
          buy: 2.0,
          sell: 1.0
        },
        isBalanced: false,
        settings: {
          ...mockHedgePosition.settings,
          maxImbalance: 0.05
        }
      };

      const rebalance = calculator.calculateRebalanceRequirement(imbalancedHedge);

      expect(rebalance.actions).toHaveLength(1);
      expect(rebalance.actions[0].action).toBe('open');
      expect(rebalance.actions[0].positionType).toBe('sell');
      expect(rebalance.actions[0].lots).toBe(1.0);
      expect(rebalance.actions[0].reasoning).toContain('買いポジション過多');
    });
  });

  describe('calculateRiskMetrics', () => {
    it('should calculate risk metrics for balanced hedge', () => {
      const riskMetrics = calculator.calculateRiskMetrics(mockHedgePosition);

      expect(riskMetrics.hedgeId).toBe('hedge_001');
      expect(riskMetrics.overallRisk).toBe('low');
      expect(riskMetrics.exposureRisk).toBe(0); // No net exposure
      expect(riskMetrics.liquidityRisk).toBeGreaterThanOrEqual(0);
      expect(riskMetrics.correlationRisk).toBe(5); // Perfect hedge has low correlation risk
      expect(riskMetrics.marginRisk).toBeGreaterThanOrEqual(0);
      expect(riskMetrics.drawdownRisk).toBeGreaterThanOrEqual(0);
      expect(riskMetrics.metrics).toBeDefined();
      expect(riskMetrics.warnings).toBeDefined();
      expect(riskMetrics.recommendations).toBeDefined();
    });

    it('should identify high risk for imbalanced hedge', () => {
      const highRiskHedge: HedgePosition = {
        ...mockHedgePosition,
        totalLots: {
          buy: 10.0,
          sell: 2.0
        },
        totalProfit: -2000.0,
        isBalanced: false
      };

      const riskMetrics = calculator.calculateRiskMetrics(highRiskHedge);

      expect(riskMetrics.overallRisk).toBe('high');
      expect(riskMetrics.exposureRisk).toBeGreaterThan(0);
      expect(riskMetrics.warnings.length).toBeGreaterThan(0);
      expect(riskMetrics.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle cross-account hedge risk differently', () => {
      const crossAccountHedge: HedgePosition = {
        ...mockHedgePosition,
        hedgeType: 'cross_account',
        accounts: ['acc1', 'acc2']
      };

      const riskMetrics = calculator.calculateRiskMetrics(crossAccountHedge);

      expect(riskMetrics.correlationRisk).toBe(25); // Higher than perfect hedge
      expect(riskMetrics.marginRisk).toBeLessThan(
        calculator.calculateRiskMetrics(mockHedgePosition).marginRisk
      ); // Lower due to account diversification
    });

    it('should generate warnings for large profits/losses', () => {
      const largeProfitHedge: HedgePosition = {
        ...mockHedgePosition,
        totalProfit: 1500.0
      };

      const riskMetrics = calculator.calculateRiskMetrics(largeProfitHedge);

      expect(riskMetrics.warnings).toContain('大きな含み損益が発生しています');
      expect(riskMetrics.recommendations).toContain('利益確定または損切りを検討してください');
    });

    it('should calculate value at risk correctly', () => {
      const riskMetrics = calculator.calculateRiskMetrics(mockHedgePosition);

      expect(riskMetrics.metrics.valueAtRisk).toBe(0); // No net exposure
      expect(riskMetrics.metrics.expectedShortfall).toBe(0);
      expect(riskMetrics.metrics.volatility).toBeGreaterThan(0);
    });
  });

  describe('validateCalculation', () => {
    it('should validate correct hedge calculation', () => {
      const validation = calculator.validateCalculation(mockHedgePosition);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toHaveLength(0);
    });

    it('should detect negative lot sizes', () => {
      const invalidHedge: HedgePosition = {
        ...mockHedgePosition,
        totalLots: {
          buy: -1.0,
          sell: 1.0
        }
      };

      const validation = calculator.validateCalculation(invalidHedge);

      expect(validation.isValid).toBe(false);
      expect(validation.warnings).toContain('負のロット数が検出されました');
    });

    it('should detect missing positions', () => {
      const emptyHedge: HedgePosition = {
        ...mockHedgePosition,
        positionIds: []
      };

      const validation = calculator.validateCalculation(emptyHedge);

      expect(validation.isValid).toBe(false);
      expect(validation.warnings).toContain('関連ポジションが存在しません');
    });

    it('should warn about high risk state', () => {
      const highRiskHedge: HedgePosition = {
        ...mockHedgePosition,
        totalLots: {
          buy: 20.0,
          sell: 1.0
        }
      };

      const validation = calculator.validateCalculation(highRiskHedge);

      expect(validation.warnings).toContain('高リスク状態です');
      expect(validation.recommendations).toContain('リバランスを実行することをお勧めします');
    });
  });

  describe('optimization algorithms', () => {
    it('should handle different risk tolerance levels', () => {
      const conservativeParams: OptimizationParams = {
        riskTolerance: 0.1,
        costSensitivity: 0.9,
        liquidityPreference: 0.8,
        maxImbalance: 0.05,
        maxDrawdown: 0.02,
        minProfit: 0.005
      };

      const aggressiveParams: OptimizationParams = {
        riskTolerance: 0.9,
        costSensitivity: 0.1,
        liquidityPreference: 0.2,
        maxImbalance: 0.2,
        maxDrawdown: 0.1,
        minProfit: 0.02
      };

      const conservativeOptimal = calculator.calculateOptimalLots(mockPositions, conservativeParams);
      const aggressiveOptimal = calculator.calculateOptimalLots(mockPositions, aggressiveParams);

      expect(conservativeOptimal.reasoning).toContain('リスク');
      expect(aggressiveOptimal.reasoning).toContain('リターン');
    });

    it('should consider liquidity preferences', () => {
      const highLiquidityParams: OptimizationParams = {
        riskTolerance: 0.5,
        costSensitivity: 0.5,
        liquidityPreference: 0.9,
        maxImbalance: 0.1,
        maxDrawdown: 0.05,
        minProfit: 0.01
      };

      const optimal = calculator.calculateOptimalLots(mockPositions, highLiquidityParams);

      // High liquidity preference should maintain balance
      expect(Math.abs(optimal.recommendedBuyLots - optimal.recommendedSellLots)).toBeLessThan(0.1);
    });
  });

  describe('edge cases', () => {
    it('should handle zero total lots', () => {
      const zeroLotHedge: HedgePosition = {
        ...mockHedgePosition,
        totalLots: {
          buy: 0,
          sell: 0
        }
      };

      const balance = calculator.calculateHedgeBalance(zeroLotHedge);

      expect(balance.imbalancePercentage).toBe(0);
      expect(balance.netExposure).toBe(0);
    });

    it('should handle very large positions', () => {
      const largeLotHedge: HedgePosition = {
        ...mockHedgePosition,
        totalLots: {
          buy: 1000.0,
          sell: 1000.0
        }
      };

      const riskMetrics = calculator.calculateRiskMetrics(largeLotHedge);

      expect(riskMetrics.liquidityRisk).toBeGreaterThan(0);
      expect(riskMetrics.marginRisk).toBeGreaterThan(0);
    });

    it('should handle positions with different symbols correctly', () => {
      const mixedSymbolPositions: Position[] = [
        { ...mockPositions[0], symbol: 'EURUSD' },
        { ...mockPositions[1], symbol: 'GBPUSD' }
      ];

      // Should use the first position's symbol
      const optimal = calculator.calculateOptimalLots(mixedSymbolPositions);
      expect(optimal.symbol).toBe('EURUSD');
    });
  });
});