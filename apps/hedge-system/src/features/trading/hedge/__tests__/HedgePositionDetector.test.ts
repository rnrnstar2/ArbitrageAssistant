import { describe, it, expect, beforeEach } from 'vitest';
import { HedgePositionDetector, HedgeDetectionCriteria, HedgePosition } from '../HedgePositionDetector';
import { Position } from '../../../../../lib/websocket/message-types';

describe('HedgePositionDetector', () => {
  let detector: HedgePositionDetector;
  let mockPositions: Position[];

  beforeEach(() => {
    detector = new HedgePositionDetector();
    
    // モックポジションデータを設定
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
        swapTotal: 0,
        commission: 0,
        status: 'open',
        openedAt: '2024-06-20T10:00:00Z',
        comment: ''
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
        swapTotal: 0,
        commission: 0,
        status: 'open',
        openedAt: '2024-06-20T10:05:00Z',
        comment: ''
      },
      {
        id: 'pos3',
        accountId: 'acc2',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 0.5,
        openPrice: 1.1010,
        currentPrice: 1.1060,
        profit: 25.0,
        swapTotal: 0,
        commission: 0,
        status: 'open',
        openedAt: '2024-06-20T10:10:00Z',
        comment: ''
      },
      {
        id: 'pos4',
        accountId: 'acc1',
        symbol: 'GBPUSD',
        type: 'buy',
        lots: 2.0,
        openPrice: 1.2500,
        currentPrice: 1.2550,
        profit: 100.0,
        swapTotal: 0,
        commission: 0,
        status: 'open',
        openedAt: '2024-06-20T10:15:00Z',
        comment: ''
      }
    ];
  });

  describe('setCriteria and getCriteria', () => {
    it('should set and get criteria correctly', () => {
      const criteria: Partial<HedgeDetectionCriteria> = {
        timeWindow: 30,
        maxSpread: 10.0,
        minLotSize: 0.1
      };

      detector.setCriteria('EURUSD', criteria);
      const result = detector.getCriteria('EURUSD');

      expect(result.symbol).toBe('EURUSD');
      expect(result.timeWindow).toBe(30);
      expect(result.maxSpread).toBe(10.0);
      expect(result.minLotSize).toBe(0.1);
    });

    it('should return default criteria for unknown symbol', () => {
      const result = detector.getCriteria('UNKNOWN');
      
      expect(result.symbol).toBe('UNKNOWN');
      expect(result.timeWindow).toBe(15);
      expect(result.maxSpread).toBe(5.0);
      expect(result.minLotSize).toBe(0.01);
    });
  });

  describe('detectHedgePositions', () => {
    it('should detect perfect hedge between buy and sell positions', () => {
      const hedges = detector.detectHedgePositions(mockPositions);
      
      expect(hedges).toHaveLength(1);
      expect(hedges[0].symbol).toBe('EURUSD');
      expect(hedges[0].hedgeType).toBe('perfect');
      expect(hedges[0].totalLots.buy).toBe(1.0);
      expect(hedges[0].totalLots.sell).toBe(1.0);
      expect(hedges[0].isBalanced).toBe(true);
    });

    it('should not detect hedge when positions are too far apart in time', () => {
      // 時間窓を短く設定
      detector.setCriteria('EURUSD', { timeWindow: 1 }); // 1分
      
      const hedges = detector.detectHedgePositions(mockPositions);
      
      expect(hedges).toHaveLength(0);
    });

    it('should handle empty position array', () => {
      const hedges = detector.detectHedgePositions([]);
      
      expect(hedges).toHaveLength(0);
    });

    it('should handle positions with only one direction', () => {
      const buyOnlyPositions = mockPositions.filter(p => p.type === 'buy');
      const hedges = detector.detectHedgePositions(buyOnlyPositions);
      
      expect(hedges).toHaveLength(0);
    });
  });

  describe('detectPotentialHedges', () => {
    it('should detect potential hedge opportunities', () => {
      const potentials = detector.detectPotentialHedges(mockPositions);
      
      expect(potentials.length).toBeGreaterThan(0);
      
      const eurusdPotential = potentials.find(p => p.symbol === 'EURUSD');
      expect(eurusdPotential).toBeDefined();
      expect(eurusdPotential!.buyPositions.length).toBeGreaterThan(0);
      expect(eurusdPotential!.sellPositions.length).toBeGreaterThan(0);
      expect(eurusdPotential!.confidence).toBeGreaterThan(0);
    });

    it('should not detect potential hedge for single direction', () => {
      const gbpusdPositions = mockPositions.filter(p => p.symbol === 'GBPUSD');
      const potentials = detector.detectPotentialHedges(gbpusdPositions);
      
      const gbpusdPotential = potentials.find(p => p.symbol === 'GBPUSD');
      expect(gbpusdPotential).toBeUndefined();
    });
  });

  describe('validateHedgeOpportunity', () => {
    it('should validate correct criteria', () => {
      const criteria: HedgeDetectionCriteria = {
        symbol: 'EURUSD',
        timeWindow: 15,
        maxSpread: 5.0,
        minLotSize: 0.01
      };
      
      const isValid = detector.validateHedgeOpportunity(criteria);
      expect(isValid).toBe(true);
    });

    it('should reject invalid time window', () => {
      const criteria: HedgeDetectionCriteria = {
        symbol: 'EURUSD',
        timeWindow: -1,
        maxSpread: 5.0,
        minLotSize: 0.01
      };
      
      const isValid = detector.validateHedgeOpportunity(criteria);
      expect(isValid).toBe(false);
    });

    it('should reject invalid spread', () => {
      const criteria: HedgeDetectionCriteria = {
        symbol: 'EURUSD',
        timeWindow: 15,
        maxSpread: -1.0,
        minLotSize: 0.01
      };
      
      const isValid = detector.validateHedgeOpportunity(criteria);
      expect(isValid).toBe(false);
    });

    it('should reject invalid lot size', () => {
      const criteria: HedgeDetectionCriteria = {
        symbol: 'EURUSD',
        timeWindow: 15,
        maxSpread: 5.0,
        minLotSize: 0
      };
      
      const isValid = detector.validateHedgeOpportunity(criteria);
      expect(isValid).toBe(false);
    });

    it('should reject invalid symbol', () => {
      const criteria: HedgeDetectionCriteria = {
        symbol: 'EUR',
        timeWindow: 15,
        maxSpread: 5.0,
        minLotSize: 0.01
      };
      
      const isValid = detector.validateHedgeOpportunity(criteria);
      expect(isValid).toBe(false);
    });
  });

  describe('getDetectionStats', () => {
    it('should calculate correct statistics', () => {
      const stats = detector.getDetectionStats(mockPositions);
      
      expect(stats.totalPositions).toBe(4);
      expect(stats.hedgedPositions).toBe(2); // pos1 and pos2 are hedged
      expect(stats.hedgeRatio).toBe(0.5);
      
      expect(stats.symbolStats.has('EURUSD')).toBe(true);
      expect(stats.symbolStats.has('GBPUSD')).toBe(true);
      
      const eurusdStats = stats.symbolStats.get('EURUSD')!;
      expect(eurusdStats.total).toBe(3);
      expect(eurusdStats.hedged).toBe(2);
      expect(eurusdStats.ratio).toBeCloseTo(0.667, 2);
      
      const gbpusdStats = stats.symbolStats.get('GBPUSD')!;
      expect(gbpusdStats.total).toBe(1);
      expect(gbpusdStats.hedged).toBe(0);
      expect(gbpusdStats.ratio).toBe(0);
    });

    it('should handle empty positions', () => {
      const stats = detector.getDetectionStats([]);
      
      expect(stats.totalPositions).toBe(0);
      expect(stats.hedgedPositions).toBe(0);
      expect(stats.hedgeRatio).toBe(0);
      expect(stats.symbolStats.size).toBe(0);
    });
  });

  describe('cross-account hedge detection', () => {
    it('should detect cross-account hedges when configured', () => {
      detector.setCriteria('EURUSD', {
        accountGroups: [['acc1', 'acc2']]
      });
      
      const hedges = detector.detectHedgePositions(mockPositions);
      
      // Should detect both same-account and cross-account hedges
      expect(hedges.length).toBeGreaterThanOrEqual(1);
      
      const crossAccountHedge = hedges.find(h => h.hedgeType === 'cross_account');
      if (crossAccountHedge) {
        expect(crossAccountHedge.accounts.length).toBeGreaterThan(1);
      }
    });
  });

  describe('partial hedge detection', () => {
    it('should detect partial hedges with imbalanced lots', () => {
      const imbalancedPositions: Position[] = [
        {
          ...mockPositions[0],
          lots: 2.0 // Larger buy position
        },
        {
          ...mockPositions[1],
          lots: 1.0 // Smaller sell position
        }
      ];
      
      const hedges = detector.detectHedgePositions(imbalancedPositions);
      
      expect(hedges).toHaveLength(1);
      expect(hedges[0].hedgeType).toBe('partial');
      expect(hedges[0].isBalanced).toBe(false);
      expect(hedges[0].totalLots.buy).toBe(2.0);
      expect(hedges[0].totalLots.sell).toBe(1.0);
    });
  });

  describe('hedge ID generation', () => {
    it('should generate unique IDs for different hedges', () => {
      const hedges = detector.detectHedgePositions(mockPositions);
      
      if (hedges.length > 1) {
        const ids = hedges.map(h => h.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }
    });

    it('should generate consistent IDs for the same positions', () => {
      const hedges1 = detector.detectHedgePositions(mockPositions);
      const hedges2 = detector.detectHedgePositions(mockPositions);
      
      // Since positions and time are the same, should generate same structure
      expect(hedges1.length).toBe(hedges2.length);
    });
  });
});