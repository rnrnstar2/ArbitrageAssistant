import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HedgePositionValidator } from '../HedgePositionValidator';
import { HedgePosition, HedgeValidationResult, HedgeValidationIssue } from '../types';
import { Position } from '../../close/types';

// モック設定
vi.mock('../../dashboard/services/NotificationService', () => ({
  notificationService: {
    critical: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

// テスト用のモックデータ
const createMockPosition = (overrides: Partial<Position> = {}): Position => ({
  id: 'pos-001',
  accountId: 'acc-001',
  symbol: 'EURUSD',
  type: 'buy',
  lots: 1.0,
  openPrice: 1.2000,
  currentPrice: 1.2050,
  profit: 50.0,
  openedAt: new Date('2024-06-20T10:00:00Z'),
  ...overrides
});

const createMockHedgePosition = (overrides: Partial<HedgePosition> = {}): HedgePosition => ({
  id: 'hedge-001',
  positionIds: ['pos-001', 'pos-002'],
  symbol: 'EURUSD',
  hedgeType: 'perfect',
  accounts: ['acc-001', 'acc-002'],
  totalLots: {
    buy: 1.0,
    sell: 1.0
  },
  totalProfit: 0.0,
  isBalanced: true,
  createdAt: new Date('2024-06-20T10:00:00Z'),
  settings: {
    autoRebalance: false,
    maxImbalance: 5.0,
    maintainOnClose: true
  },
  ...overrides
});

const createMockPositions = (): Position[] => [
  createMockPosition({
    id: 'pos-001',
    accountId: 'acc-001',
    type: 'buy',
    lots: 1.0,
    openedAt: new Date('2024-06-20T10:00:00Z')
  }),
  createMockPosition({
    id: 'pos-002',
    accountId: 'acc-002',
    type: 'sell',
    lots: 1.0,
    openPrice: 1.2005,
    currentPrice: 1.2055,
    profit: -50.0,
    openedAt: new Date('2024-06-20T10:05:00Z')
  })
];

describe('HedgePositionValidator', () => {
  let mockPositions: Position[];
  let mockHedgePosition: HedgePosition;

  beforeEach(() => {
    mockPositions = createMockPositions();
    mockHedgePosition = createMockHedgePosition();
    
    // LocalStorage のモック
    global.localStorage = {
      getItem: vi.fn(() => '[]'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    } as any;
    
    // console のモック（ログ出力を抑制）
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateHedgePosition', () => {
    it('should validate a perfect hedge position', async () => {
      const result = await HedgePositionValidator.validateHedgePosition(
        mockHedgePosition,
        mockPositions
      );

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations).toEqual([]);
    });

    it('should detect lot imbalance', async () => {
      const imbalancedHedge = createMockHedgePosition({
        totalLots: { buy: 2.0, sell: 1.0 },
        isBalanced: false
      });

      const result = await HedgePositionValidator.validateHedgePosition(
        imbalancedHedge,
        mockPositions
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'lot_imbalance')).toBe(true);
      expect(result.recommendations).toContain('ロットバランスの調整を検討してください');
    });

    it('should detect insufficient positions', async () => {
      const invalidHedge = createMockHedgePosition({
        positionIds: ['pos-001'] // 1つのポジションのみ
      });

      const result = await HedgePositionValidator.validateHedgePosition(
        invalidHedge,
        mockPositions
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => 
        i.type === 'orphaned_position' && i.severity === 'error'
      )).toBe(true);
    });

    it('should detect missing positions', async () => {
      const hedgeWithMissingPositions = createMockHedgePosition({
        positionIds: ['pos-001', 'pos-999'] // pos-999 は存在しない
      });

      const result = await HedgePositionValidator.validateHedgePosition(
        hedgeWithMissingPositions,
        mockPositions
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => 
        i.type === 'orphaned_position' &&
        i.description.includes('存在しないポジション')
      )).toBe(true);
    });

    it('should detect same account hedge in perfect hedge type', async () => {
      const sameAccountPositions = [
        createMockPosition({
          id: 'pos-001',
          accountId: 'acc-001',
          type: 'buy'
        }),
        createMockPosition({
          id: 'pos-002',
          accountId: 'acc-001', // 同じアカウント
          type: 'sell'
        })
      ];

      const sameAccountHedge = createMockHedgePosition({
        hedgeType: 'perfect', // cross_accountではない
        accounts: ['acc-001']
      });

      const result = await HedgePositionValidator.validateHedgePosition(
        sameAccountHedge,
        sameAccountPositions
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => 
        i.type === 'account_mismatch' && i.severity === 'error'
      )).toBe(true);
    });

    it('should detect timing issues', async () => {
      const earlyPosition = createMockPosition({
        id: 'pos-001',
        openedAt: new Date('2024-06-20T10:00:00Z')
      });
      
      const latePosition = createMockPosition({
        id: 'pos-002',
        type: 'sell',
        openedAt: new Date('2024-06-20T12:00:00Z') // 2時間後
      });

      const result = await HedgePositionValidator.validateHedgePosition(
        mockHedgePosition,
        [earlyPosition, latePosition]
      );

      expect(result.issues.some(i => i.type === 'timing_issue')).toBe(true);
    });

    it('should handle cross-account hedge validation', async () => {
      const crossAccountHedge = createMockHedgePosition({
        hedgeType: 'cross_account',
        accounts: ['acc-001', 'acc-002']
      });

      const result = await HedgePositionValidator.validateHedgePosition(
        crossAccountHedge,
        mockPositions
      );

      expect(result.isValid).toBe(true);
    });

    it('should detect invalid cross-account configuration', async () => {
      const invalidCrossAccountHedge = createMockHedgePosition({
        hedgeType: 'cross_account',
        accounts: ['acc-001'] // 単一アカウントなのにcross_account
      });

      const result = await HedgePositionValidator.validateHedgePosition(
        invalidCrossAccountHedge,
        mockPositions
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => 
        i.type === 'account_mismatch' && i.severity === 'error'
      )).toBe(true);
    });
  });

  describe('detectInconsistencies', () => {
    it('should detect inconsistencies across multiple hedges', async () => {
      const hedges = [
        createMockHedgePosition({
          id: 'hedge-001',
          positionIds: ['pos-001', 'pos-002']
        }),
        createMockHedgePosition({
          id: 'hedge-002',
          positionIds: ['pos-002', 'pos-003'], // pos-002が重複
          symbol: 'GBPUSD'
        })
      ];

      const extendedPositions = [
        ...mockPositions,
        createMockPosition({
          id: 'pos-003',
          symbol: 'GBPUSD',
          type: 'sell'
        })
      ];

      const issues = await HedgePositionValidator.detectInconsistencies(
        hedges,
        extendedPositions
      );

      expect(issues.some(i => 
        i.type === 'orphaned_position' &&
        i.description.includes('複数の両建てグループで使用')
      )).toBe(true);
    });

    it('should detect orphaned positions', async () => {
      const hedges = [mockHedgePosition];
      const extendedPositions = [
        ...mockPositions,
        createMockPosition({
          id: 'pos-003',
          type: 'sell',
          symbol: 'EURUSD' // 同一通貨ペアで反対方向
        })
      ];

      const issues = await HedgePositionValidator.detectInconsistencies(
        hedges,
        extendedPositions
      );

      expect(issues.some(i => 
        i.type === 'orphaned_position' &&
        i.description.includes('両建て可能なポジション')
      )).toBe(true);
    });
  });

  describe('suggestCorrections', () => {
    it('should suggest corrections for lot imbalance', () => {
      const issue: HedgeValidationIssue = {
        type: 'lot_imbalance',
        severity: 'warning',
        description: 'ロット不均衡があります',
        affectedPositions: ['pos-001', 'pos-002']
      };

      const corrections = HedgePositionValidator.suggestCorrections(
        issue,
        mockHedgePosition,
        mockPositions
      );

      expect(corrections).toContain(
        'ロット差を修正するため、追加エントリーまたは部分決済を検討してください'
      );
    });

    it('should suggest corrections for account mismatch', () => {
      const issue: HedgeValidationIssue = {
        type: 'account_mismatch',
        severity: 'error',
        description: '同一口座内で両建てが行われています',
        affectedPositions: ['pos-001', 'pos-002']
      };

      const corrections = HedgePositionValidator.suggestCorrections(
        issue,
        mockHedgePosition,
        mockPositions
      );

      expect(corrections).toContain(
        '両建てポジションを異なる口座に分散配置することを強く推奨します'
      );
    });

    it('should suggest corrections for timing issues', () => {
      const issue: HedgeValidationIssue = {
        type: 'timing_issue',
        severity: 'warning',
        description: 'エントリータイミングに時間差があります',
        affectedPositions: ['pos-001', 'pos-002']
      };

      const corrections = HedgePositionValidator.suggestCorrections(
        issue,
        mockHedgePosition,
        mockPositions
      );

      expect(corrections).toContain(
        'エントリータイミングの時間差を最小化するため、同時エントリー設定を使用してください'
      );
    });

    it('should suggest corrections for orphaned positions', () => {
      const issue: HedgeValidationIssue = {
        type: 'orphaned_position',
        severity: 'warning',
        description: '孤立したポジションが存在します',
        affectedPositions: ['pos-003']
      };

      const corrections = HedgePositionValidator.suggestCorrections(
        issue,
        mockHedgePosition,
        mockPositions
      );

      expect(corrections).toContain(
        '孤立したポジションを既存の両建てグループに統合するか、新しい両建てを構築してください'
      );
    });
  });

  describe('checkBalanceConsistency', () => {
    it('should detect lot imbalance exceeding threshold', () => {
      const imbalancedHedge = createMockHedgePosition({
        totalLots: { buy: 2.0, sell: 1.0 }, // 33.3% imbalance
        isBalanced: false
      });

      const issues = (HedgePositionValidator as any).checkBalanceConsistency(imbalancedHedge);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('lot_imbalance');
      expect(issues[0].severity).toBe('warning');
    });

    it('should detect severe lot imbalance', () => {
      const severelyImbalancedHedge = createMockHedgePosition({
        totalLots: { buy: 3.0, sell: 1.0 }, // 50% imbalance
        isBalanced: false
      });

      const issues = (HedgePositionValidator as any).checkBalanceConsistency(severelyImbalancedHedge);
      
      expect(issues.some(i => i.severity === 'error')).toBe(true);
    });

    it('should detect inconsistent balance flag', () => {
      const inconsistentHedge = createMockHedgePosition({
        totalLots: { buy: 2.0, sell: 1.0 },
        isBalanced: true // 実際は不均衡なのにtrueになっている
      });

      const issues = (HedgePositionValidator as any).checkBalanceConsistency(inconsistentHedge);
      
      expect(issues.some(i => 
        i.description.includes('バランス状態がfalseですが')
      )).toBe(true);
    });

    it('should handle zero lot positions', () => {
      const zeroLotHedge = createMockHedgePosition({
        totalLots: { buy: 0, sell: 1.0 }
      });

      const issues = (HedgePositionValidator as any).checkBasicConsistency(zeroLotHedge);
      
      expect(issues.some(i => 
        i.type === 'lot_imbalance' && i.severity === 'error'
      )).toBe(true);
    });
  });

  describe('calculateLotImbalance', () => {
    it('should calculate imbalance percentage correctly', () => {
      const hedge = createMockHedgePosition({
        totalLots: { buy: 2.0, sell: 1.0 }
      });

      const imbalance = (HedgePositionValidator as any).calculateLotImbalance(hedge);
      
      expect(imbalance).toBeCloseTo(33.33, 1); // (|2-1|/3)*100
    });

    it('should return 0 for balanced positions', () => {
      const hedge = createMockHedgePosition({
        totalLots: { buy: 1.0, sell: 1.0 }
      });

      const imbalance = (HedgePositionValidator as any).calculateLotImbalance(hedge);
      
      expect(imbalance).toBe(0);
    });

    it('should handle zero total lots', () => {
      const hedge = createMockHedgePosition({
        totalLots: { buy: 0, sell: 0 }
      });

      const imbalance = (HedgePositionValidator as any).calculateLotImbalance(hedge);
      
      expect(imbalance).toBe(0);
    });
  });

  describe('alert and logging functionality', () => {
    it('should log validation results', async () => {
      const setItemSpy = vi.spyOn(global.localStorage, 'setItem');
      
      await HedgePositionValidator.validateHedgePosition(
        mockHedgePosition,
        mockPositions
      );

      expect(setItemSpy).toHaveBeenCalledWith(
        'hedge_validation_logs',
        expect.any(String)
      );
    });

    it('should handle logging errors gracefully', async () => {
      const setItemSpy = vi.spyOn(global.localStorage, 'setItem')
        .mockImplementation(() => {
          throw new Error('Storage error');
        });
      
      // エラーをスローしないことを確認
      await expect(
        HedgePositionValidator.validateHedgePosition(mockHedgePosition, mockPositions)
      ).resolves.toBeDefined();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to log validation result:',
        expect.any(Error)
      );
    });

    it('should clean up old logs', async () => {
      const oldLog = {
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25時間前
        hedgeId: 'old-hedge'
      };
      
      const getItemSpy = vi.spyOn(global.localStorage, 'getItem')
        .mockReturnValue(JSON.stringify([oldLog]));
      
      const setItemSpy = vi.spyOn(global.localStorage, 'setItem');

      await HedgePositionValidator.validateHedgePosition(
        mockHedgePosition,
        mockPositions
      );

      // 古いログが除外されることを確認
      const savedData = JSON.parse(setItemSpy.mock.calls[0][1]);
      expect(savedData.some((log: any) => log.hedgeId === 'old-hedge')).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty position arrays', async () => {
      const result = await HedgePositionValidator.validateHedgePosition(
        mockHedgePosition,
        []
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'orphaned_position')).toBe(true);
    });

    it('should handle hedge with mixed symbols', async () => {
      const mixedPositions = [
        createMockPosition({ id: 'pos-001', symbol: 'EURUSD', type: 'buy' }),
        createMockPosition({ id: 'pos-002', symbol: 'GBPUSD', type: 'sell' })
      ];

      const result = await HedgePositionValidator.validateHedgePosition(
        mockHedgePosition,
        mixedPositions
      );

      expect(result.issues.some(i => 
        i.type === 'account_mismatch' &&
        i.description.includes('異なる通貨ペアが混在')
      )).toBe(true);
    });

    it('should validate hedge creation timestamp', async () => {
      const futureHedge = createMockHedgePosition({
        createdAt: new Date(Date.now() + 10 * 60 * 1000) // 10分後
      });

      const result = await HedgePositionValidator.validateHedgePosition(
        futureHedge,
        mockPositions
      );

      expect(result.issues.some(i => i.type === 'timing_issue')).toBe(true);
    });
  });

  describe('performance and scalability', () => {
    it('should handle large numbers of positions efficiently', async () => {
      const largePositionArray = Array.from({ length: 1000 }, (_, i) => 
        createMockPosition({
          id: `pos-${i}`,
          accountId: `acc-${i % 10}`,
          symbol: i % 2 === 0 ? 'EURUSD' : 'GBPUSD'
        })
      );

      const startTime = Date.now();
      
      const result = await HedgePositionValidator.validateHedgePosition(
        mockHedgePosition,
        largePositionArray
      );

      const duration = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // 1秒以内に完了
    });

    it('should handle batch validation efficiently', async () => {
      const hedges = Array.from({ length: 50 }, (_, i) => 
        createMockHedgePosition({
          id: `hedge-${i}`,
          symbol: i % 2 === 0 ? 'EURUSD' : 'GBPUSD'
        })
      );

      const startTime = Date.now();
      
      const issues = await HedgePositionValidator.detectInconsistencies(
        hedges,
        mockPositions
      );

      const duration = Date.now() - startTime;
      
      expect(issues).toBeDefined();
      expect(duration).toBeLessThan(2000); // 2秒以内に完了
    });
  });
});