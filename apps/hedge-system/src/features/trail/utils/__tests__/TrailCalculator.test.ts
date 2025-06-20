import { describe, it, expect, beforeEach } from 'vitest';
import { TrailCalculator } from '../TrailCalculator';
import { TrailSettings, TRAIL_TYPES, START_CONDITION_TYPES } from '../../types';

// テスト用のモックデータ
const mockPosition = {
  id: 'pos-123',
  symbol: 'EURUSD',
  type: 'buy' as const,
  lots: 1.0,
  openPrice: 1.2000,
  currentPrice: 1.2050,
  profit: 50.0,
  openTime: new Date('2024-01-01T10:00:00Z'),
};

const mockJPYPosition = {
  ...mockPosition,
  symbol: 'USDJPY',
  openPrice: 110.000,
  currentPrice: 110.500,
};

const mockSellPosition = {
  ...mockPosition,
  type: 'sell' as const,
  currentPrice: 1.1950,
  profit: 50.0,
};

const mockPriceHistory = [
  { high: 1.2060, low: 1.2040, close: 1.2050, timestamp: new Date('2024-01-01T10:00:00Z') },
  { high: 1.2080, low: 1.2050, close: 1.2070, timestamp: new Date('2024-01-01T11:00:00Z') },
  { high: 1.2090, low: 1.2060, close: 1.2080, timestamp: new Date('2024-01-01T12:00:00Z') },
  { high: 1.2100, low: 1.2070, close: 1.2090, timestamp: new Date('2024-01-01T13:00:00Z') },
  { high: 1.2110, low: 1.2080, close: 1.2100, timestamp: new Date('2024-01-01T14:00:00Z') },
];

describe('TrailCalculator', () => {
  describe('Fixed Trail Calculation', () => {
    it('should calculate fixed trail for buy position correctly', () => {
      const trailSettings: TrailSettings = {
        id: 'trail-123',
        positionId: 'pos-123',
        type: TRAIL_TYPES.FIXED,
        trailAmount: 0.0020, // 20 pips
        startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
        isActive: true,
        currentStopLoss: 1.1980,
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const result = TrailCalculator.calculateTrail(
        mockPosition,
        trailSettings,
        1.2050,
        1.2050 // maxFavorablePrice
      );

      expect(result.shouldAdjust).toBe(true);
      expect(result.newStopLoss).toBe(1.2030); // 1.2050 - 0.0020
      expect(result.trailDistance).toBe(0.0020);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should calculate fixed trail for sell position correctly', () => {
      const trailSettings: TrailSettings = {
        id: 'trail-124',
        positionId: 'pos-124',
        type: TRAIL_TYPES.FIXED,
        trailAmount: 0.0020,
        startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
        isActive: true,
        currentStopLoss: 1.2020,
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const result = TrailCalculator.calculateTrail(
        mockSellPosition,
        trailSettings,
        1.1950,
        1.1950 // maxFavorablePrice (lowest for sell)
      );

      expect(result.shouldAdjust).toBe(true);
      expect(result.newStopLoss).toBe(1.1970); // 1.1950 + 0.0020
      expect(result.trailDistance).toBe(0.0020);
    });
  });

  describe('Percentage Trail Calculation', () => {
    it('should calculate percentage trail correctly', () => {
      const trailSettings: TrailSettings = {
        id: 'trail-125',
        positionId: 'pos-125',
        type: TRAIL_TYPES.PERCENTAGE,
        trailAmount: 1.5, // 1.5%
        startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
        isActive: true,
        currentStopLoss: 1.1800, // 計算される新しいストップロス（約1.187）より低く設定
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const maxFavorablePrice = 1.2050;
      const result = TrailCalculator.calculateTrail(
        mockPosition,
        trailSettings,
        1.2050,
        maxFavorablePrice
      );

      const expectedTrailDistance = maxFavorablePrice * 0.015; // 1.5%
      const expectedStopLoss = maxFavorablePrice - expectedTrailDistance;

      expect(result.shouldAdjust).toBe(true);
      expect(result.newStopLoss).toBeCloseTo(expectedStopLoss, 4);
      expect(result.trailDistance).toBeCloseTo(expectedTrailDistance, 5);
    });
  });

  describe('ATR Trail Calculation', () => {
    it('should calculate ATR trail correctly', () => {
      const trailSettings: TrailSettings = {
        id: 'trail-126',
        positionId: 'pos-126',
        type: TRAIL_TYPES.ATR,
        trailAmount: 2.0, // 2x ATR
        startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
        isActive: true,
        currentStopLoss: 1.1980,
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const result = TrailCalculator.calculateTrail(
        mockPosition,
        trailSettings,
        1.2050,
        1.2050,
        mockPriceHistory
      );

      expect(result.shouldAdjust).toBe(true);
      expect(result.newStopLoss).toBeLessThan(1.2050);
      expect(result.trailDistance).toBeGreaterThan(0);
      expect(result.reason).toContain('ATR trail');
    });
  });

  describe('Start Condition Checking', () => {
    it('should not activate trail when profit threshold not met', () => {
      const trailSettings: TrailSettings = {
        id: 'trail-127',
        positionId: 'pos-127',
        type: TRAIL_TYPES.FIXED,
        trailAmount: 0.0020,
        startCondition: { 
          type: START_CONDITION_TYPES.PROFIT_THRESHOLD,
          value: 100.0 // requires 100 profit, but position only has 50
        },
        isActive: true,
        currentStopLoss: 1.1980,
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const result = TrailCalculator.calculateTrail(
        mockPosition,
        trailSettings,
        1.2050,
        1.2050
      );

      expect(result.shouldAdjust).toBe(false);
      expect(result.reason).toContain('activation conditions not met');
    });

    it('should activate trail when price level reached', () => {
      const trailSettings: TrailSettings = {
        id: 'trail-128',
        positionId: 'pos-128',
        type: TRAIL_TYPES.FIXED,
        trailAmount: 0.0020,
        startCondition: { 
          type: START_CONDITION_TYPES.PRICE_LEVEL,
          value: 1.2040 // target price for buy position
        },
        isActive: true,
        currentStopLoss: 1.1980,
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const result = TrailCalculator.calculateTrail(
        mockPosition,
        trailSettings,
        1.2050, // current price > target price
        1.2050
      );

      expect(result.shouldAdjust).toBe(true);
    });
  });

  describe('Stop Loss Update Logic', () => {
    it('should only update stop loss when favorable for buy position', () => {
      const trailSettings: TrailSettings = {
        id: 'trail-129',
        positionId: 'pos-129',
        type: TRAIL_TYPES.FIXED,
        trailAmount: 0.0020,
        startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
        isActive: true,
        currentStopLoss: 1.2000, // current stop loss is higher than calculated
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const result = TrailCalculator.calculateTrail(
        mockPosition,
        trailSettings,
        1.2010,
        1.2010
      );

      // Calculated stop loss (1.2010 - 0.0020 = 1.1990) is lower than current (1.2000)
      // Should not update for buy position
      expect(result.shouldAdjust).toBe(false);
    });
  });

  describe('Price Data Validation', () => {
    it('should throw error for invalid current price', () => {
      const trailSettings: TrailSettings = {
        id: 'trail-130',
        positionId: 'pos-130',
        type: TRAIL_TYPES.FIXED,
        trailAmount: 0.0020,
        startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
        isActive: true,
        currentStopLoss: 1.1980,
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const result = TrailCalculator.calculateTrail(
        mockPosition,
        trailSettings,
        -1, // invalid price
        1.2050
      );

      expect(result.shouldAdjust).toBe(false);
      expect(result.reason).toContain('error');
      expect(result.confidence).toBe(0.0);
    });

    it('should handle extreme price changes', () => {
      const extremePosition = {
        ...mockPosition,
        openPrice: 1.0000,
      };

      const trailSettings: TrailSettings = {
        id: 'trail-131',
        positionId: 'pos-131',
        type: TRAIL_TYPES.FIXED,
        trailAmount: 0.0020,
        startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
        isActive: true,
        currentStopLoss: 1.1980,
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const result = TrailCalculator.calculateTrail(
        extremePosition,
        trailSettings,
        2.0000, // 100% price change
        2.0000
      );

      expect(result.shouldAdjust).toBe(false);
      expect(result.reason).toContain('Extreme price change');
    });
  });

  describe('Utility Functions', () => {
    describe('Pips Conversion', () => {
      it('should convert pips to price for major pairs', () => {
        const pipsToPrice = TrailCalculator.pipsToPrice(20, 'EURUSD');
        expect(pipsToPrice).toBe(0.0020);
      });

      it('should convert pips to price for JPY pairs', () => {
        const pipsToPrice = TrailCalculator.pipsToPrice(20, 'USDJPY');
        expect(pipsToPrice).toBe(0.20);
      });

      it('should convert price to pips for major pairs', () => {
        const priceToPips = TrailCalculator.priceToPips(0.0020, 'EURUSD');
        expect(priceToPips).toBe(20);
      });

      it('should convert price to pips for JPY pairs', () => {
        const priceToPips = TrailCalculator.priceToPips(0.20, 'USDJPY');
        expect(priceToPips).toBe(20);
      });
    });

    describe('Max Favorable Price Tracking', () => {
      it('should update max favorable price for buy position when price increases', () => {
        const shouldUpdate = TrailCalculator.shouldUpdateMaxFavorablePrice(
          mockPosition,
          1.2060, // higher than current max
          1.2050
        );
        expect(shouldUpdate).toBe(true);
      });

      it('should not update max favorable price for buy position when price decreases', () => {
        const shouldUpdate = TrailCalculator.shouldUpdateMaxFavorablePrice(
          mockPosition,
          1.2040, // lower than current max
          1.2050
        );
        expect(shouldUpdate).toBe(false);
      });

      it('should update max favorable price for sell position when price decreases', () => {
        const shouldUpdate = TrailCalculator.shouldUpdateMaxFavorablePrice(
          mockSellPosition,
          1.1940, // lower than current max
          1.1950
        );
        expect(shouldUpdate).toBe(true);
      });
    });

    describe('Initial Max Favorable Price', () => {
      it('should calculate initial max favorable price for buy position', () => {
        const initialMax = TrailCalculator.calculateInitialMaxFavorablePrice(
          mockPosition,
          1.2060 // current price higher than open price
        );
        expect(initialMax).toBe(1.2060);
      });

      it('should use open price when current price is lower for buy position', () => {
        const initialMax = TrailCalculator.calculateInitialMaxFavorablePrice(
          mockPosition,
          1.1990 // current price lower than open price
        );
        expect(initialMax).toBe(1.2000); // open price
      });
    });

    describe('Optimal Trail Distance Calculation', () => {
      it('should calculate optimal trail distance based on volatility', () => {
        const optimalDistance = TrailCalculator.calculateOptimalTrailDistance(
          mockPosition,
          mockPriceHistory,
          5
        );
        expect(optimalDistance).toBeGreaterThan(0);
      });

      it('should return default trail distance for insufficient price history', () => {
        const optimalDistance = TrailCalculator.calculateOptimalTrailDistance(
          mockPosition,
          [], // empty history
          5
        );
        expect(optimalDistance).toBe(0.0020); // default for EURUSD
      });
    });

    describe('Trail Distance Conversion', () => {
      it('should convert fixed trail distance', () => {
        const trailSettings: TrailSettings = {
          id: 'trail-132',
          positionId: 'pos-132',
          type: TRAIL_TYPES.FIXED,
          trailAmount: 0.0030,
          startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
          isActive: true,
          currentStopLoss: 1.1980,
          maxProfit: 50.0,
          lastUpdated: new Date(),
          createdAt: new Date(),
          accountId: 'acc-123',
          symbol: 'EURUSD',
        };

        const distance = TrailCalculator.convertTrailDistance(
          trailSettings,
          'EURUSD',
          1.2050
        );
        expect(distance).toBe(0.0030);
      });

      it('should convert percentage trail distance', () => {
        const trailSettings: TrailSettings = {
          id: 'trail-133',
          positionId: 'pos-133',
          type: TRAIL_TYPES.PERCENTAGE,
          trailAmount: 2.0, // 2%
          startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
          isActive: true,
          currentStopLoss: 1.1980,
          maxProfit: 50.0,
          lastUpdated: new Date(),
          createdAt: new Date(),
          accountId: 'acc-123',
          symbol: 'EURUSD',
        };

        const distance = TrailCalculator.convertTrailDistance(
          trailSettings,
          'EURUSD',
          1.2000
        );
        expect(distance).toBe(0.024); // 1.2000 * 0.02
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing position data gracefully', () => {
      const trailSettings: TrailSettings = {
        id: 'trail-134',
        positionId: 'pos-134',
        type: TRAIL_TYPES.FIXED,
        trailAmount: 0.0020,
        startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
        isActive: true,
        currentStopLoss: 1.1980,
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const result = TrailCalculator.calculateTrail(
        null as any, // invalid position
        trailSettings,
        1.2050,
        1.2050
      );

      expect(result.shouldAdjust).toBe(false);
      expect(result.confidence).toBe(0.0);
      expect(result.reason).toContain('error');
    });

    it('should handle unsupported trail type', () => {
      const trailSettings: TrailSettings = {
        id: 'trail-135',
        positionId: 'pos-135',
        type: 'unsupported' as any,
        trailAmount: 0.0020,
        startCondition: { type: START_CONDITION_TYPES.IMMEDIATE },
        isActive: true,
        currentStopLoss: 1.1980,
        maxProfit: 50.0,
        lastUpdated: new Date(),
        createdAt: new Date(),
        accountId: 'acc-123',
        symbol: 'EURUSD',
      };

      const result = TrailCalculator.calculateTrail(
        mockPosition,
        trailSettings,
        1.2050,
        1.2050
      );

      expect(result.shouldAdjust).toBe(false);
      expect(result.reason).toContain('Unsupported trail type');
    });
  });
});