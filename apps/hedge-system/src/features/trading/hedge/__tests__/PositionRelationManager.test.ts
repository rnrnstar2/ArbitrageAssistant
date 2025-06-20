import { describe, it, expect, beforeEach } from 'vitest';
import { PositionRelationManager } from '../PositionRelationManager';
import { Position } from '../../close/types';

describe('PositionRelationManager', () => {
  let manager: PositionRelationManager;
  let mockPositions: Position[];

  beforeEach(() => {
    manager = new PositionRelationManager();
    mockPositions = [
      {
        id: 'pos1',
        accountId: 'acc1',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 50,
        openedAt: new Date('2023-01-01'),
      },
      {
        id: 'pos2',
        accountId: 'acc1',
        symbol: 'EURUSD',
        type: 'sell',
        lots: 1.0,
        openPrice: 1.1020,
        currentPrice: 1.1050,
        profit: -30,
        openedAt: new Date('2023-01-01'),
      },
      {
        id: 'pos3',
        accountId: 'acc2',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 0.5,
        openPrice: 1.1010,
        currentPrice: 1.1050,
        profit: 20,
        openedAt: new Date('2023-01-01'),
      },
    ];
  });

  describe('linkPositions', () => {
    it('正常な両建て関連付けを作成できる', () => {
      const hedgePosition = manager.linkPositions(['pos1', 'pos2'], mockPositions);

      expect(hedgePosition.positionIds).toEqual(['pos1', 'pos2']);
      expect(hedgePosition.symbol).toBe('EURUSD');
      expect(hedgePosition.hedgeType).toBe('perfect');
      expect(hedgePosition.totalLots.buy).toBe(1.0);
      expect(hedgePosition.totalLots.sell).toBe(1.0);
      expect(hedgePosition.isBalanced).toBe(true);
    });

    it('クロスアカウント両建てを正しく識別する', () => {
      const hedgePosition = manager.linkPositions(['pos1', 'pos3'], mockPositions);

      expect(hedgePosition.hedgeType).toBe('cross_account');
      expect(hedgePosition.accounts).toEqual(['acc1', 'acc2']);
    });

    it('部分両建てを正しく識別する', () => {
      const partialSellPosition: Position = {
        id: 'pos4',
        accountId: 'acc1',
        symbol: 'EURUSD',
        type: 'sell',
        lots: 0.5,
        openPrice: 1.1020,
        currentPrice: 1.1050,
        profit: -15,
        openedAt: new Date('2023-01-01'),
      };

      const positions = [...mockPositions, partialSellPosition];
      const hedgePosition = manager.linkPositions(['pos1', 'pos4'], positions);

      expect(hedgePosition.hedgeType).toBe('partial');
      expect(hedgePosition.isBalanced).toBe(false);
    });

    it('ポジション数が不足している場合はエラーを投げる', () => {
      expect(() => {
        manager.linkPositions(['pos1'], mockPositions);
      }).toThrow('少なくとも2つのポジションが必要です');
    });

    it('存在しないポジションを指定した場合はエラーを投げる', () => {
      expect(() => {
        manager.linkPositions(['pos1', 'nonexistent'], mockPositions);
      }).toThrow('ポジション nonexistent が見つかりません');
    });

    it('異なる通貨ペアのポジションは関連付けできない', () => {
      const gbpPosition: Position = {
        id: 'pos_gbp',
        accountId: 'acc1',
        symbol: 'GBPUSD',
        type: 'sell',
        lots: 1.0,
        openPrice: 1.2500,
        currentPrice: 1.2520,
        profit: -20,
        openedAt: new Date('2023-01-01'),
      };

      const positions = [...mockPositions, gbpPosition];
      
      expect(() => {
        manager.linkPositions(['pos1', 'pos_gbp'], positions);
      }).toThrow('異なる通貨ペアのポジションは関連付けできません');
    });

    it('同じ方向のポジションのみでは両建てにならない', () => {
      expect(() => {
        manager.linkPositions(['pos1', 'pos3'], mockPositions.filter(p => p.type === 'buy'));
      }).toThrow('両建てには買いと売りの両方のポジションが必要です');
    });
  });

  describe('findRelatedPositions', () => {
    it('関連付けられたポジションを正しく検索できる', () => {
      const hedgePosition = manager.linkPositions(['pos1', 'pos2'], mockPositions);
      
      const found1 = manager.findRelatedPositions('pos1');
      const found2 = manager.findRelatedPositions('pos2');

      expect(found1).toEqual(hedgePosition);
      expect(found2).toEqual(hedgePosition);
    });

    it('関連付けられていないポジションの場合はnullを返す', () => {
      const found = manager.findRelatedPositions('pos3');
      expect(found).toBeNull();
    });
  });

  describe('unlinkPositions', () => {
    it('関連付けを正しく削除できる', () => {
      const hedgePosition = manager.linkPositions(['pos1', 'pos2'], mockPositions);
      
      manager.unlinkPositions(hedgePosition.id);
      
      const found1 = manager.findRelatedPositions('pos1');
      const found2 = manager.findRelatedPositions('pos2');

      expect(found1).toBeNull();
      expect(found2).toBeNull();
    });

    it('存在しない両建て管理IDの場合はエラーを投げる', () => {
      expect(() => {
        manager.unlinkPositions('nonexistent');
      }).toThrow('両建て管理 nonexistent が見つかりません');
    });
  });

  describe('updateRelation', () => {
    it('両建て管理の設定を正しく更新できる', () => {
      const hedgePosition = manager.linkPositions(['pos1', 'pos2'], mockPositions);
      
      const updates = {
        settings: {
          autoRebalance: false,
          maxImbalance: 0.2,
          maintainOnClose: false
        }
      };

      manager.updateRelation(hedgePosition.id, updates);
      
      const updated = manager.findRelatedPositions('pos1');
      expect(updated?.settings).toEqual(updates.settings);
      expect(updated?.lastRebalanced).toBeDefined();
    });

    it('存在しない両建て管理IDの場合はエラーを投げる', () => {
      expect(() => {
        manager.updateRelation('nonexistent', {});
      }).toThrow('両建て管理 nonexistent が見つかりません');
    });
  });

  describe('findOrphanedPositions', () => {
    it('孤立ポジションを正しく検出する', () => {
      manager.linkPositions(['pos1', 'pos2'], mockPositions);
      
      const orphaned = manager.findOrphanedPositions(mockPositions);
      
      expect(orphaned).toHaveLength(1);
      expect(orphaned[0].id).toBe('pos3');
    });

    it('全てのポジションが管理されている場合は空配列を返す', () => {
      manager.linkPositions(['pos1', 'pos2'], mockPositions);
      manager.linkPositions(['pos3'], mockPositions.slice(2));
      
      const orphaned = manager.findOrphanedPositions(mockPositions.slice(0, 2));
      
      expect(orphaned).toHaveLength(0);
    });
  });

  describe('validateConsistency', () => {
    it('正常な状態では整合性チェックを通過する', () => {
      manager.linkPositions(['pos1', 'pos2'], mockPositions);
      
      const validation = manager.validateConsistency(mockPositions);
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('存在しないポジションが参照されている場合はエラーを検出する', () => {
      manager.linkPositions(['pos1', 'pos2'], mockPositions);
      
      // pos2を削除したポジションリストで検証
      const incompletePositions = mockPositions.filter(p => p.id !== 'pos2');
      const validation = manager.validateConsistency(incompletePositions);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(i => i.type === 'orphaned_position')).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('統計情報を正しく計算する', () => {
      manager.linkPositions(['pos1', 'pos2'], mockPositions);
      
      const stats = manager.getStatistics();
      
      expect(stats.totalHedgePositions).toBe(1);
      expect(stats.byType.perfect).toBe(1);
      expect(stats.bySymbol.EURUSD).toBe(1);
      expect(stats.totalProfit).toBe(20); // pos1(50) + pos2(-30)
    });

    it('複数の両建て管理がある場合の統計を正しく計算する', () => {
      const additionalPositions: Position[] = [
        {
          id: 'pos4',
          accountId: 'acc2',
          symbol: 'GBPUSD',
          type: 'buy',
          lots: 0.5,
          openPrice: 1.2500,
          currentPrice: 1.2520,
          profit: 10,
          openedAt: new Date('2023-01-01'),
        },
        {
          id: 'pos5',
          accountId: 'acc3',
          symbol: 'GBPUSD',
          type: 'sell',
          lots: 0.5,
          openPrice: 1.2510,
          currentPrice: 1.2520,
          profit: -5,
          openedAt: new Date('2023-01-01'),
        }
      ];

      const allPositions = [...mockPositions, ...additionalPositions];
      
      manager.linkPositions(['pos1', 'pos2'], allPositions);
      manager.linkPositions(['pos4', 'pos5'], allPositions);
      
      const stats = manager.getStatistics();
      
      expect(stats.totalHedgePositions).toBe(2);
      expect(stats.byType.perfect).toBe(1);
      expect(stats.byType.cross_account).toBe(1);
      expect(stats.bySymbol.EURUSD).toBe(1);
      expect(stats.bySymbol.GBPUSD).toBe(1);
      expect(stats.totalProfit).toBe(25); // (50-30) + (10-5)
    });
  });

  describe('getHedgePositionsBySymbol', () => {
    it('指定された通貨ペアの両建て管理のみを返す', () => {
      const gbpPositions: Position[] = [
        {
          id: 'pos_gbp1',
          accountId: 'acc1',
          symbol: 'GBPUSD',
          type: 'buy',
          lots: 1.0,
          openPrice: 1.2500,
          currentPrice: 1.2520,
          profit: 20,
          openedAt: new Date('2023-01-01'),
        },
        {
          id: 'pos_gbp2',
          accountId: 'acc1',
          symbol: 'GBPUSD',
          type: 'sell',
          lots: 1.0,
          openPrice: 1.2510,
          currentPrice: 1.2520,
          profit: -10,
          openedAt: new Date('2023-01-01'),
        }
      ];

      const allPositions = [...mockPositions, ...gbpPositions];
      
      manager.linkPositions(['pos1', 'pos2'], allPositions);
      manager.linkPositions(['pos_gbp1', 'pos_gbp2'], allPositions);
      
      const eurHedges = manager.getHedgePositionsBySymbol('EURUSD');
      const gbpHedges = manager.getHedgePositionsBySymbol('GBPUSD');
      
      expect(eurHedges).toHaveLength(1);
      expect(gbpHedges).toHaveLength(1);
      expect(eurHedges[0].symbol).toBe('EURUSD');
      expect(gbpHedges[0].symbol).toBe('GBPUSD');
    });
  });
});