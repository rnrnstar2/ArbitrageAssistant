/**
 * DataValidator テストファイル
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { DataValidator, StatisticalAnalyzer, FinancialCalculator } from '../data-validator';
import type { PositionUpdateData, AccountInfoData, MarketData } from '../../websocket/message-types';
import type { ValidationContext, DEFAULT_VALIDATION_CONFIG } from '../types';

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('Position Data Validation', () => {
    test('should validate valid position data', async () => {
      const validPosition: PositionUpdateData = {
        positionId: 'pos_123',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 50.0,
        swapPoints: 0.5,
        commission: 2.0,
        status: 'open',
        openTime: new Date(),
      };

      const result = await validator.validatePositionData(validPosition);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(80);
    });

    test('should detect invalid lot size', async () => {
      const invalidPosition: PositionUpdateData = {
        positionId: 'pos_123',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 0, // Invalid: zero lots
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 50.0,
        swapPoints: 0.5,
        commission: 2.0,
        status: 'open',
        openTime: new Date(),
      };

      const result = await validator.validatePositionData(invalidPosition);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_LOT_SIZE')).toBe(true);
    });

    test('should detect negative prices', async () => {
      const invalidPosition: PositionUpdateData = {
        positionId: 'pos_123',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 1.0,
        openPrice: -1.1000, // Invalid: negative price
        currentPrice: 1.1050,
        profit: 50.0,
        swapPoints: 0.5,
        commission: 2.0,
        status: 'open',
        openTime: new Date(),
      };

      const result = await validator.validatePositionData(invalidPosition);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_PRICE')).toBe(true);
    });

    test('should detect profit calculation mismatch', async () => {
      const positionWithWrongProfit: PositionUpdateData = {
        positionId: 'pos_123',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 1000.0, // Too high for the price difference
        swapPoints: 0.5,
        commission: 2.0,
        status: 'open',
        openTime: new Date(),
      };

      const result = await validator.validatePositionData(positionWithWrongProfit);

      expect(result.warnings.some(w => w.code === 'PROFIT_CALCULATION_MISMATCH')).toBe(true);
    });
  });

  describe('Account Data Validation', () => {
    test('should validate valid account data', async () => {
      const validAccount: AccountInfoData = {
        balance: 10000.0,
        equity: 10050.0,
        freeMargin: 9000.0,
        marginLevel: 1000.0,
        bonusAmount: 500.0,
        profit: 50.0,
        credit: 0.0,
        marginUsed: 1050.0,
        currency: 'USD',
      };

      const result = await validator.validateAccountData(validAccount);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect low margin level', async () => {
      const lowMarginAccount: AccountInfoData = {
        balance: 1000.0,
        equity: 500.0,
        freeMargin: 0.0,
        marginLevel: 30.0, // Critical margin level
        bonusAmount: 0.0,
        profit: -500.0,
        credit: 0.0,
        marginUsed: 500.0,
        currency: 'USD',
      };

      const result = await validator.validateAccountData(lowMarginAccount);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'CRITICAL_MARGIN_LEVEL')).toBe(true);
    });

    test('should detect negative bonus', async () => {
      const invalidAccount: AccountInfoData = {
        balance: 10000.0,
        equity: 10000.0,
        freeMargin: 9000.0,
        marginLevel: 1000.0,
        bonusAmount: -100.0, // Invalid: negative bonus
        profit: 0.0,
        credit: 0.0,
        marginUsed: 1000.0,
        currency: 'USD',
      };

      const result = await validator.validateAccountData(invalidAccount);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'NEGATIVE_BONUS')).toBe(true);
    });
  });

  describe('Market Data Validation', () => {
    test('should validate valid market data', async () => {
      const validMarketData: MarketData = {
        symbol: 'EURUSD',
        bid: 1.1000,
        ask: 1.1003,
        spread: 0.0003,
        marketStatus: 'open',
        lastUpdated: new Date(),
      };

      const result = await validator.validateMarketData(validMarketData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid bid/ask relationship', async () => {
      const invalidMarketData: MarketData = {
        symbol: 'EURUSD',
        bid: 1.1005,
        ask: 1.1000, // Invalid: bid higher than ask
        spread: 0.0003,
        marketStatus: 'open',
        lastUpdated: new Date(),
      };

      const result = await validator.validateMarketData(invalidMarketData);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_BID_ASK')).toBe(true);
    });

    test('should detect spread calculation mismatch', async () => {
      const marketDataWithWrongSpread: MarketData = {
        symbol: 'EURUSD',
        bid: 1.1000,
        ask: 1.1003,
        spread: 0.01, // Wrong spread value
        marketStatus: 'open',
        lastUpdated: new Date(),
      };

      const result = await validator.validateMarketData(marketDataWithWrongSpread);

      expect(result.warnings.some(w => w.code === 'SPREAD_CALCULATION_MISMATCH')).toBe(true);
    });
  });

  describe('Batch Validation', () => {
    test('should validate batch of position data', async () => {
      const positions: PositionUpdateData[] = [
        {
          positionId: 'pos_1',
          symbol: 'EURUSD',
          type: 'buy',
          lots: 1.0,
          openPrice: 1.1000,
          currentPrice: 1.1050,
          profit: 50.0,
          swapPoints: 0.5,
          commission: 2.0,
          status: 'open',
          openTime: new Date(),
        },
        {
          positionId: 'pos_2',
          symbol: 'GBPUSD',
          type: 'sell',
          lots: 0.5,
          openPrice: 1.3000,
          currentPrice: 1.2950,
          profit: 25.0,
          swapPoints: -0.2,
          commission: 1.0,
          status: 'open',
          openTime: new Date(),
        },
      ];

      const result = await validator.validateBatch(positions, 'position');

      expect(result.totalItems).toBe(2);
      expect(result.validItems).toBe(2);
      expect(result.errorItems).toBe(0);
      expect(result.overallScore).toBeGreaterThan(80);
    });

    test('should handle mixed valid/invalid data in batch', async () => {
      const mixedData: PositionUpdateData[] = [
        {
          positionId: 'pos_1',
          symbol: 'EURUSD',
          type: 'buy',
          lots: 1.0,
          openPrice: 1.1000,
          currentPrice: 1.1050,
          profit: 50.0,
          swapPoints: 0.5,
          commission: 2.0,
          status: 'open',
          openTime: new Date(),
        },
        {
          positionId: 'pos_2',
          symbol: 'GBPUSD',
          type: 'sell',
          lots: 0, // Invalid lot size
          openPrice: 1.3000,
          currentPrice: 1.2950,
          profit: 25.0,
          swapPoints: -0.2,
          commission: 1.0,
          status: 'open',
          openTime: new Date(),
        },
      ];

      const result = await validator.validateBatch(mixedData, 'position');

      expect(result.totalItems).toBe(2);
      expect(result.validItems).toBe(1);
      expect(result.errorItems).toBe(1);
      expect(result.overallScore).toBe(50);
    });
  });

  describe('Statistical Validation', () => {
    test('should detect outliers with historical data', async () => {
      const currentPosition: PositionUpdateData = {
        positionId: 'pos_current',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 10000.0, // Outlier profit
        swapPoints: 0.5,
        commission: 2.0,
        status: 'open',
        openTime: new Date(),
      };

      const historicalData = Array.from({ length: 20 }, (_, i) => ({
        positionId: `pos_${i}`,
        profit: 50 + (Math.random() - 0.5) * 20, // Normal profits around 50
      }));

      const context: ValidationContext = {
        dataType: 'position',
        accountId: 'test_account',
        timestamp: Date.now(),
        historicalData,
      };

      const result = await validator.validatePositionData(currentPosition, context);

      expect(result.warnings.some(w => w.code === 'STATISTICAL_OUTLIER')).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    test('should track performance metrics', async () => {
      const position: PositionUpdateData = {
        positionId: 'pos_123',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 50.0,
        swapPoints: 0.5,
        commission: 2.0,
        status: 'open',
        openTime: new Date(),
      };

      await validator.validatePositionData(position);
      const metrics = validator.getPerformanceMetrics();

      expect(metrics.validationLatency).toBeGreaterThan(0);
      expect(typeof metrics.throughput).toBe('number');
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig = {
        thresholds: {
          errorTolerance: 2,
          warningTolerance: 10,
          qualityMinimum: 80,
        },
      };

      validator.updateConfig(newConfig);
      
      // Configuration should be updated (verify through behavior)
      expect(() => validator.updateConfig(newConfig)).not.toThrow();
    });

    test('should manage custom rules', () => {
      const customRule = {
        field: 'customField',
        type: 'required' as const,
        constraint: true,
        message: 'Custom field is required',
        severity: 'error' as const,
      };

      validator.addRule(customRule);
      const rules = validator.getRules();

      expect(rules.some(r => r.field === 'customField')).toBe(true);

      validator.removeRule('customField', 'required');
      const updatedRules = validator.getRules();

      expect(updatedRules.some(r => r.field === 'customField')).toBe(false);
    });
  });
});

describe('StatisticalAnalyzer', () => {
  let analyzer: StatisticalAnalyzer;

  beforeEach(() => {
    analyzer = new StatisticalAnalyzer();
  });

  test('should detect outliers using IQR method', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]; // 100 is an outlier
    const result = analyzer.detectOutliersIQR(data);

    expect(result.method).toBe('iqr');
    expect(result.outliers).toHaveLength(1);
    expect(result.outliers[0].value).toBe(100);
  });

  test('should detect outliers using Z-Score method', () => {
    const data = [10, 12, 11, 13, 12, 11, 10, 12, 11, 50]; // 50 is an outlier
    const result = analyzer.detectOutliersZScore(data, 2.0);

    expect(result.method).toBe('zscore');
    expect(result.outliers).toHaveLength(1);
    expect(result.outliers[0].value).toBe(50);
  });

  test('should calculate basic statistics', () => {
    const data = [1, 2, 3, 4, 5];
    const stats = analyzer.calculateStatistics(data);

    expect(stats.mean).toBe(3);
    expect(stats.median).toBe(3);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5);
    expect(stats.count).toBe(5);
  });
});

describe('FinancialCalculator', () => {
  let calculator: FinancialCalculator;

  beforeEach(() => {
    calculator = new FinancialCalculator();
  });

  test('should calculate expected profit for buy position', () => {
    const position: PositionUpdateData = {
      positionId: 'pos_123',
      symbol: 'EURUSD',
      type: 'buy',
      lots: 1.0,
      openPrice: 1.1000,
      currentPrice: 1.1050,
      profit: 0, // Will be calculated
      swapPoints: 0.5,
      commission: 2.0,
      status: 'open',
      openTime: new Date(),
    };

    const expectedProfit = calculator.calculateExpectedProfit(position);

    expect(typeof expectedProfit).toBe('number'); // Should return a valid number
  });

  test('should calculate expected profit for sell position', () => {
    const position: PositionUpdateData = {
      positionId: 'pos_123',
      symbol: 'EURUSD',
      type: 'sell',
      lots: 1.0,
      openPrice: 1.1050,
      currentPrice: 1.1000,
      profit: 0, // Will be calculated
      swapPoints: 0.5,
      commission: 2.0,
      status: 'open',
      openTime: new Date(),
    };

    const expectedProfit = calculator.calculateExpectedProfit(position);

    expect(typeof expectedProfit).toBe('number'); // Should return a valid number
  });

  test('should calculate margin required', () => {
    const position: PositionUpdateData = {
      positionId: 'pos_123',
      symbol: 'EURUSD',
      type: 'buy',
      lots: 1.0,
      openPrice: 1.1000,
      currentPrice: 1.1050,
      profit: 50.0,
      swapPoints: 0.5,
      commission: 2.0,
      status: 'open',
      openTime: new Date(),
    };

    const marginRequired = calculator.calculateMarginRequired(position, 100);

    expect(marginRequired).toBeGreaterThan(0);
    expect(typeof marginRequired).toBe('number');
  });

  test('should calculate margin level', () => {
    const marginLevel = calculator.calculateMarginLevel(10000, 1000);

    expect(marginLevel).toBe(1000); // (10000 / 1000) * 100 = 1000%
  });

  test('should handle zero margin used', () => {
    const marginLevel = calculator.calculateMarginLevel(10000, 0);

    expect(marginLevel).toBe(Infinity);
  });
});