import { describe, it, expect, beforeEach } from 'vitest';
import { MarginLevelCalculator } from '../MarginLevelCalculator';
import type { MarginCalculationInput, MarginCalculation } from '../MarginLevelCalculator';
import type { Account, Position } from '../../../ea-management/types';

describe('MarginLevelCalculator', () => {
  let mockPosition: Position;
  let mockAccount: Account;
  let calculationInput: MarginCalculationInput;

  beforeEach(() => {
    mockPosition = {
      ticket: 12345,
      symbol: 'USDJPY',
      type: 'buy',
      volume: 1.0,
      openPrice: 150.50,
      currentPrice: 150.75,
      profit: 250,
      swap: -5,
      sl: 150.00,
      tp: 151.00,
      openTime: new Date('2024-01-01T10:00:00Z'),
      comment: 'Test position',
    };

    mockAccount = {
      accountId: 'test-account-001',
      balance: 10000,
      equity: 10245,
      margin: 1000,
      marginFree: 9245,
      marginLevel: 1024.5,
      credit: 0,
      profit: 245,
      server: 'Test-Server',
      currency: 'USD',
      leverage: 100,
      positions: [mockPosition],
    };

    calculationInput = {
      balance: 10000,
      equity: 10245,
      marginUsed: 1000,
      bonusAmount: 500,
      profit: 245,
      credit: 0,
      currency: 'USD',
      leverage: 100,
      positions: [mockPosition],
    };
  });

  describe('calculate', () => {
    it('should calculate basic margin level correctly', () => {
      const result = MarginLevelCalculator.calculate('test-account', calculationInput);

      expect(result.marginLevel).toBeCloseTo(1024.5, 1);
      expect(result.freeMargin).toBe(9245);
      expect(result.accountId).toBe('test-account');
      expect(result.currency).toBe('USD');
      expect(result.leverage).toBe(100);
    });

    it('should calculate effective equity with bonus correctly', () => {
      const result = MarginLevelCalculator.calculate('test-account', calculationInput);

      // effectiveEquity = balance + profit + bonusAmount + credit
      // = 10000 + 245 + 500 + 0 = 10745
      expect(result.effectiveEquity).toBe(10745);
    });

    it('should calculate bonus adjusted margin correctly', () => {
      const result = MarginLevelCalculator.calculate('test-account', calculationInput);

      // bonusAdjustedEquity = realBalance + profit = (balance + credit) + profit = 10000 + 245 = 10245
      // bonusAdjustedMargin = (bonusAdjustedEquity / marginUsed) * 100 = (10245 / 1000) * 100 = 1024.5
      expect(result.bonusAdjustedMargin).toBeCloseTo(1024.5, 1);
    });

    it('should handle zero margin used correctly', () => {
      const inputWithZeroMargin = { ...calculationInput, marginUsed: 0 };
      const result = MarginLevelCalculator.calculate('test-account', inputWithZeroMargin);

      expect(result.marginLevel).toBe(999999);
      expect(result.bonusAdjustedMargin).toBe(999999);
    });

    it('should calculate total profit from positions', () => {
      const result = MarginLevelCalculator.calculate('test-account', calculationInput);

      // totalProfit = position.profit + position.swap = 250 + (-5) = 245
      expect(result.totalProfit).toBe(245);
    });

    it('should set calculation timestamp', () => {
      const beforeCalculation = new Date();
      const result = MarginLevelCalculator.calculate('test-account', calculationInput);
      const afterCalculation = new Date();

      expect(result.calculatedAt).toBeInstanceOf(Date);
      expect(result.calculatedAt.getTime()).toBeGreaterThanOrEqual(beforeCalculation.getTime());
      expect(result.calculatedAt.getTime()).toBeLessThanOrEqual(afterCalculation.getTime());
    });
  });

  describe('calculateFromAccount', () => {
    it('should calculate from Account object correctly', () => {
      const result = MarginLevelCalculator.calculateFromAccount(mockAccount, 500);

      expect(result.accountId).toBe('test-account-001');
      expect(result.marginLevel).toBeCloseTo(1024.5, 1);
      expect(result.effectiveEquity).toBe(10745); // includes bonus
    });

    it('should handle account without bonus', () => {
      const result = MarginLevelCalculator.calculateFromAccount(mockAccount);

      expect(result.effectiveEquity).toBe(10245); // no bonus
      expect(result.bonusAdjustedMargin).toBeCloseTo(1024.5, 1);
    });
  });

  describe('calculateMultipleAccounts', () => {
    it('should calculate multiple accounts correctly', () => {
      const account2 = { ...mockAccount, accountId: 'test-account-002', balance: 5000, equity: 5100, profit: 100 };
      const accounts = [
        { account: mockAccount, bonusAmount: 500 },
        { account: account2, bonusAmount: 200 },
      ];

      const results = MarginLevelCalculator.calculateMultipleAccounts(accounts);

      expect(results).toHaveLength(2);
      expect(results[0].accountId).toBe('test-account-001');
      expect(results[1].accountId).toBe('test-account-002');
      expect(results[0].effectiveEquity).toBe(10745);
      expect(results[1].effectiveEquity).toBe(5300); // 5000 + 100 + 200 + 0
    });
  });

  describe('calculateChange', () => {
    it('should calculate changes between two calculations correctly', () => {
      const previous = MarginLevelCalculator.calculate('test-account', calculationInput);
      
      // Simulate 1 minute later with different values and position changes
      const newPosition = { ...mockPosition, profit: -500, swap: -5 };
      const newInput = { ...calculationInput, equity: 9500, profit: -500, positions: [newPosition] };
      const current = MarginLevelCalculator.calculate('test-account', newInput);
      current.calculatedAt = new Date(previous.calculatedAt.getTime() + 60000); // 1 minute later

      const change = MarginLevelCalculator.calculateChange(current, previous);

      expect(change.marginLevelChange).toBeCloseTo(950 - 1024.5, 1); // 950% - 1024.5%
      expect(change.freeMarginChange).toBe(8500 - 9245); // difference in free margin
      expect(change.profitChange).toBe(-505 - 245); // profit change: (-500 + -5) - (250 + -5) = -505 - 245 = -750
      expect(change.timeDifference).toBe(60); // 60 seconds
    });
  });

  describe('calculateMaxLossBeforeLosscut', () => {
    it('should calculate max loss before losscut correctly', () => {
      const calculation = MarginLevelCalculator.calculate('test-account', calculationInput);
      const result = MarginLevelCalculator.calculateMaxLossBeforeLosscut(calculation, 20);

      // losscutEquity = (marginUsed * losscutLevel) / 100 = (1000 * 20) / 100 = 200
      // maxLoss = effectiveEquity - losscutEquity = 10745 - 200 = 10545
      expect(result.losscutEquity).toBe(200);
      expect(result.maxLoss).toBe(10545);
      expect(result.currentBuffer).toBe(10545);
    });

    it('should return zero max loss when already below losscut level', () => {
      const lowEquityInput = { ...calculationInput, balance: 100, profit: -50, bonusAmount: 0 };
      const calculation = MarginLevelCalculator.calculate('test-account', lowEquityInput);
      const result = MarginLevelCalculator.calculateMaxLossBeforeLosscut(calculation, 20);

      // effectiveEquity = 100 + (-50) + 0 + 0 = 50
      // losscutEquity = (1000 * 20) / 100 = 200
      // Since effectiveEquity (50) < losscutEquity (200), maxLoss should be 0
      expect(result.maxLoss).toBe(0);
    });
  });

  describe('calculateRequiredMargin', () => {
    it('should calculate required margin for new position', () => {
      const requiredMargin = MarginLevelCalculator.calculateRequiredMargin(
        'USDJPY',
        1.0,    // volume
        150.50, // price
        100,    // leverage
        100000  // contract size
      );

      // Required Margin = (Contract Size * Volume * Price) / Leverage
      // = (100000 * 1.0 * 150.50) / 100 = 15050000 / 100 = 150500
      expect(requiredMargin).toBe(150500);
    });
  });

  describe('calculateMaxVolume', () => {
    it('should calculate maximum tradeable volume', () => {
      const calculation = MarginLevelCalculator.calculate('test-account', calculationInput);
      const result = MarginLevelCalculator.calculateMaxVolume(
        calculation,
        'USDJPY',
        150.50,
        100,
        1505, // margin per lot
        10    // 10% safety margin
      );

      // availableMargin = 9245
      // maxVolume = 9245 / 1505 ≈ 6.14
      // safeVolume = maxVolume * 0.9 ≈ 5.53
      expect(result.maxVolume).toBeCloseTo(6.14, 2);
      expect(result.safeVolume).toBeCloseTo(5.53, 2);
      expect(result.marginRequired).toBe(1505);
    });
  });

  describe('validateCalculation', () => {
    it('should pass validation for normal calculation', () => {
      const calculation = MarginLevelCalculator.calculate('test-account', calculationInput);
      const validation = MarginLevelCalculator.validateCalculation(calculation);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect negative margin level error', () => {
      const invalidInput = { ...calculationInput, equity: -100 };
      const calculation = MarginLevelCalculator.calculate('test-account', invalidInput);
      const validation = MarginLevelCalculator.validateCalculation(calculation);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Margin level cannot be negative');
    });

    it('should detect negative used margin error', () => {
      const invalidInput = { ...calculationInput, marginUsed: -100 };
      const calculation = MarginLevelCalculator.calculate('test-account', invalidInput);
      const validation = MarginLevelCalculator.validateCalculation(calculation);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Used margin cannot be negative');
    });

    it('should warn about negative effective equity', () => {
      const invalidInput = { ...calculationInput, balance: -1000, profit: -500, bonusAmount: 0 };
      const calculation = MarginLevelCalculator.calculate('test-account', invalidInput);
      const validation = MarginLevelCalculator.validateCalculation(calculation);

      expect(validation.warnings).toContain('Effective equity is negative');
    });

    it('should warn about extremely high margin level', () => {
      const extremeInput = { ...calculationInput, marginUsed: 0.01 };
      const calculation = MarginLevelCalculator.calculate('test-account', extremeInput);
      const validation = MarginLevelCalculator.validateCalculation(calculation);

      expect(validation.warnings).toContain('Margin level is extremely high (>10000%)');
    });
  });

  describe('calculateStatistics', () => {
    it('should calculate statistics for multiple calculations', () => {
      const calculations: MarginCalculation[] = [];
      
      // Create 5 calculations with different margin levels
      for (let i = 0; i < 5; i++) {
        const input = { ...calculationInput, equity: 10000 + i * 1000 };
        calculations.push(MarginLevelCalculator.calculate('test-account', input));
      }

      const stats = MarginLevelCalculator.calculateStatistics(calculations);

      expect(stats.average).toBeGreaterThan(0);
      expect(stats.min).toBeLessThanOrEqual(stats.average);
      expect(stats.max).toBeGreaterThanOrEqual(stats.average);
      expect(stats.volatility).toBeGreaterThan(0);
      expect(['up', 'down', 'stable']).toContain(stats.trend);
    });

    it('should handle empty calculations array', () => {
      const stats = MarginLevelCalculator.calculateStatistics([]);

      expect(stats.average).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.volatility).toBe(0);
      expect(stats.trend).toBe('stable');
    });

    it('should detect upward trend', () => {
      const calculations: MarginCalculation[] = [];
      
      // Create calculations with increasing margin levels
      for (let i = 0; i < 10; i++) {
        const input = { ...calculationInput, equity: 10000 + i * 2000 };
        calculations.push(MarginLevelCalculator.calculate('test-account', input));
      }

      const stats = MarginLevelCalculator.calculateStatistics(calculations);
      expect(stats.trend).toBe('up');
    });

    it('should detect downward trend', () => {
      const calculations: MarginCalculation[] = [];
      
      // Create calculations with decreasing margin levels
      for (let i = 0; i < 10; i++) {
        const input = { ...calculationInput, equity: 15000 - i * 2000 };
        calculations.push(MarginLevelCalculator.calculate('test-account', input));
      }

      const stats = MarginLevelCalculator.calculateStatistics(calculations);
      expect(stats.trend).toBe('down');
    });
  });
});