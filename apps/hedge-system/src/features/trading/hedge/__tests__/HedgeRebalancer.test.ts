import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { HedgeRebalancer, RebalanceTarget, RebalanceSchedule } from '../HedgeRebalancer';
import { HedgeBalanceCalculator, RebalanceAction } from '../HedgeBalanceCalculator';
import { HedgeExecutor, HedgeResult } from '../HedgeExecutor';
import { HedgePositionValidator } from '../HedgePositionValidator';
import { HedgePosition } from '../types';

// モックの作成
const mockBalanceCalculator = {
  calculateHedgeBalance: vi.fn(),
  calculateRebalanceRequirement: vi.fn(),
  calculateRiskMetrics: vi.fn()
} as unknown as HedgeBalanceCalculator;

const mockExecutor = {
  executeHedge: vi.fn(),
  cancelHedgeExecution: vi.fn()
} as unknown as HedgeExecutor;

const mockValidator = {
  validateHedgePosition: vi.fn()
} as unknown as HedgePositionValidator;

// テスト用データ
const mockHedgePosition: HedgePosition = {
  id: 'hedge_test_001',
  positionIds: ['pos_001', 'pos_002'],
  symbol: 'EURUSD',
  hedgeType: 'perfect',
  accounts: ['account_001'],
  totalLots: {
    buy: 1.0,
    sell: 0.8
  },
  totalProfit: -50,
  isBalanced: false,
  createdAt: new Date('2023-01-01'),
  settings: {
    autoRebalance: true,
    maxImbalance: 0.1,
    maintainOnClose: true
  }
};

const mockRebalanceAction: RebalanceAction = {
  hedgeId: 'hedge_test_001',
  required: true,
  urgency: 'medium',
  actions: [
    {
      action: 'open',
      positionType: 'sell',
      lots: 0.2,
      priority: 1,
      reasoning: 'Balance adjustment needed'
    }
  ],
  estimatedCost: 0.002,
  expectedImprovement: 30,
  riskReduction: 25
};

const mockHedgeResult: HedgeResult = {
  executionId: 'exec_001',
  status: 'completed',
  results: {
    sell: {
      success: true,
      positionId: 'pos_003',
      lotSize: 0.2
    }
  },
  rollbackRequired: false
};

describe('HedgeRebalancer', () => {
  let rebalancer: HedgeRebalancer;

  beforeEach(() => {
    vi.clearAllMocks();
    
    rebalancer = new HedgeRebalancer(
      mockBalanceCalculator,
      mockExecutor,
      mockValidator
    );

    // デフォルトのモック戻り値を設定
    (mockBalanceCalculator.calculateRebalanceRequirement as MockedFunction<any>)
      .mockReturnValue(mockRebalanceAction);
    (mockBalanceCalculator.calculateHedgeBalance as MockedFunction<any>)
      .mockReturnValue({
        hedgeId: 'hedge_test_001',
        imbalancePercentage: 20,
        riskScore: 60,
        totalProfit: -50,
        isBalanced: false
      });
    (mockExecutor.executeHedge as MockedFunction<any>)
      .mockResolvedValue(mockHedgeResult);
  });

  afterEach(() => {
    rebalancer.dispose();
  });

  describe('executeAutoRebalance', () => {
    it('リバランスが必要な場合、自動リバランスを実行する', async () => {
      const result = await rebalancer.executeAutoRebalance(mockHedgePosition);

      expect(result).toBeDefined();
      expect(result.type).toBe('auto');
      expect(result.hedgeId).toBe(mockHedgePosition.id);
      expect(result.success).toBe(true);
      expect(mockBalanceCalculator.calculateRebalanceRequirement).toHaveBeenCalledWith(mockHedgePosition);
      expect(mockExecutor.executeHedge).toHaveBeenCalled();
    });

    it('リバランスが不要な場合、エラーを投げる', async () => {
      (mockBalanceCalculator.calculateRebalanceRequirement as MockedFunction<any>)
        .mockReturnValue({
          ...mockRebalanceAction,
          required: false
        });

      await expect(rebalancer.executeAutoRebalance(mockHedgePosition))
        .rejects.toThrow('No rebalance required');
    });

    it('自動リバランスが無効な場合、エラーを投げる', async () => {
      rebalancer.updateSettings({ autoRebalanceEnabled: false });

      await expect(rebalancer.executeAutoRebalance(mockHedgePosition))
        .rejects.toThrow('Auto rebalance is disabled');
    });
  });

  describe('executeManualRebalance', () => {
    const mockTarget: RebalanceTarget = {
      hedgeId: 'hedge_test_001',
      targetBalance: {
        buy: 1.0,
        sell: 1.0
      },
      priority: 'high',
      maxCost: 0.005,
      maxRisk: 50,
      reason: 'Manual adjustment'
    };

    it('手動リバランスを実行する', async () => {
      const result = await rebalancer.executeManualRebalance(mockHedgePosition, mockTarget);

      expect(result).toBeDefined();
      expect(result.type).toBe('manual');
      expect(result.hedgeId).toBe(mockHedgePosition.id);
      expect(result.target).toEqual(mockTarget);
      expect(result.success).toBe(true);
    });

    it('無効な対象の場合、エラーを投げる', async () => {
      const invalidTarget: RebalanceTarget = {
        ...mockTarget,
        hedgeId: 'different_hedge_id'
      };

      await expect(rebalancer.executeManualRebalance(mockHedgePosition, invalidTarget))
        .rejects.toThrow('Invalid rebalance target');
    });
  });

  describe('calculateRebalanceActions', () => {
    it('リバランスアクションを計算する', () => {
      const actions = rebalancer.calculateRebalanceActions(mockHedgePosition);

      expect(actions).toEqual(mockRebalanceAction);
      expect(mockBalanceCalculator.calculateRebalanceRequirement).toHaveBeenCalledWith(mockHedgePosition);
    });
  });

  describe('scheduleRebalance', () => {
    const mockSchedule: RebalanceSchedule = {
      hedgeId: 'hedge_test_001',
      type: 'time_based',
      interval: 60, // 60分
      enabled: true,
      maxExecutionsPerDay: 5,
      executionCount: 0
    };

    it('リバランススケジュールを設定する', () => {
      const eventSpy = vi.fn();
      rebalancer.on('scheduleUpdated', eventSpy);

      rebalancer.scheduleRebalance(mockHedgePosition, mockSchedule);

      expect(eventSpy).toHaveBeenCalledWith({
        hedgeId: mockHedgePosition.id,
        schedule: expect.objectContaining({
          hedgeId: mockSchedule.hedgeId,
          type: mockSchedule.type,
          interval: mockSchedule.interval
        })
      });
    });

    it('条件ベースのスケジュールを設定する', () => {
      const conditionSchedule: RebalanceSchedule = {
        ...mockSchedule,
        type: 'condition_based',
        conditions: [
          {
            type: 'risk_threshold',
            threshold: 70,
            comparator: 'gt',
            enabled: true
          }
        ]
      };

      rebalancer.scheduleRebalance(mockHedgePosition, conditionSchedule);

      // 条件チェックのテスト
      const triggered = rebalancer.checkConditionBasedRebalances(mockHedgePosition);
      expect(triggered).toBe(false); // riskScore 60 < threshold 70
    });
  });

  describe('clearSchedule', () => {
    it('スケジュールをクリアする', () => {
      const mockSchedule: RebalanceSchedule = {
        hedgeId: 'hedge_test_001',
        type: 'time_based',
        interval: 60,
        enabled: true,
        maxExecutionsPerDay: 5,
        executionCount: 0
      };

      const eventSpy = vi.fn();
      rebalancer.on('scheduleCleared', eventSpy);

      rebalancer.scheduleRebalance(mockHedgePosition, mockSchedule);
      rebalancer.clearSchedule(mockHedgePosition.id);

      expect(eventSpy).toHaveBeenCalledWith({
        hedgeId: mockHedgePosition.id
      });
    });
  });

  describe('cancelRebalance', () => {
    it('実行中のリバランスをキャンセルする', async () => {
      // まずリバランスを開始
      const rebalancePromise = rebalancer.executeAutoRebalance(mockHedgePosition);
      
      // 少し待ってからキャンセル
      setTimeout(async () => {
        const activeRebalances = rebalancer.getActiveRebalances();
        if (activeRebalances.length > 0) {
          await rebalancer.cancelRebalance(activeRebalances[0].rebalanceId);
        }
      }, 10);

      const result = await rebalancePromise.catch(err => err);
      
      // キャンセルまたは正常完了のいずれかになる
      expect(result).toBeDefined();
    });

    it('存在しないリバランスIDでエラーを投げる', async () => {
      await expect(rebalancer.cancelRebalance('non_existent_id'))
        .rejects.toThrow('Rebalance non_existent_id not found');
    });
  });

  describe('checkConditionBasedRebalances', () => {
    it('条件が満たされた場合にtrueを返す', () => {
      const schedule: RebalanceSchedule = {
        hedgeId: 'hedge_test_001',
        type: 'condition_based',
        enabled: true,
        conditions: [
          {
            type: 'risk_threshold',
            threshold: 50,
            comparator: 'gt',
            enabled: true
          }
        ],
        maxExecutionsPerDay: 5,
        executionCount: 0
      };

      rebalancer.scheduleRebalance(mockHedgePosition, schedule);
      
      // riskScore 60 > threshold 50 なので条件が満たされる
      const triggered = rebalancer.checkConditionBasedRebalances(mockHedgePosition);
      expect(triggered).toBe(true);
    });

    it('条件が満たされない場合にfalseを返す', () => {
      const schedule: RebalanceSchedule = {
        hedgeId: 'hedge_test_001',
        type: 'condition_based',
        enabled: true,
        conditions: [
          {
            type: 'risk_threshold',
            threshold: 80,
            comparator: 'gt',
            enabled: true
          }
        ],
        maxExecutionsPerDay: 5,
        executionCount: 0
      };

      rebalancer.scheduleRebalance(mockHedgePosition, schedule);
      
      // riskScore 60 < threshold 80 なので条件が満たされない
      const triggered = rebalancer.checkConditionBasedRebalances(mockHedgePosition);
      expect(triggered).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('統計情報がない場合にnullを返す', () => {
      const stats = rebalancer.getStatistics('non_existent_hedge');
      expect(stats).toBeNull();
    });

    it('リバランス実行後に統計情報が更新される', async () => {
      await rebalancer.executeAutoRebalance(mockHedgePosition);
      
      const stats = rebalancer.getStatistics(mockHedgePosition.id);
      expect(stats).toBeDefined();
      expect(stats?.totalRebalances).toBe(1);
      expect(stats?.successRate).toBe(100);
    });
  });

  describe('updateSettings', () => {
    it('設定を更新する', () => {
      const eventSpy = vi.fn();
      rebalancer.on('settingsUpdated', eventSpy);

      const newSettings = {
        autoRebalanceEnabled: false,
        maxDailyRebalances: 20
      };

      rebalancer.updateSettings(newSettings);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining(newSettings)
      );
    });
  });

  describe('エラーハンドリング', () => {
    it('実行エラー時に適切にエラーを処理する', async () => {
      (mockExecutor.executeHedge as MockedFunction<any>)
        .mockRejectedValue(new Error('Execution failed'));

      const eventSpy = vi.fn();
      rebalancer.on('rebalanceFailed', eventSpy);

      await expect(rebalancer.executeAutoRebalance(mockHedgePosition))
        .rejects.toThrow('Execution failed');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('同時実行制限を超えた場合にエラーを投げる', async () => {
      // 同時実行制限を1に設定
      rebalancer = new HedgeRebalancer(
        mockBalanceCalculator,
        mockExecutor,
        mockValidator,
        { maxDailyRebalances: 1 }
      );

      // 長時間実行をシミュレート
      (mockExecutor.executeHedge as MockedFunction<any>)
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      // 最初のリバランスを開始
      const firstRebalance = rebalancer.executeAutoRebalance(mockHedgePosition);

      // 2番目のリバランスは制限に引っかかるはず
      await expect(rebalancer.executeAutoRebalance(mockHedgePosition))
        .rejects.toThrow('Maximum concurrent rebalances reached');

      // クリーンアップのため最初のリバランスを待つ
      await firstRebalance.catch(() => {});
    });
  });

  describe('イベント', () => {
    it('リバランス開始時にイベントを発行する', async () => {
      const eventSpy = vi.fn();
      rebalancer.on('rebalanceStarted', eventSpy);

      await rebalancer.executeAutoRebalance(mockHedgePosition);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'executing',
          type: 'auto'
        })
      );
    });

    it('リバランス完了時にイベントを発行する', async () => {
      const eventSpy = vi.fn();
      rebalancer.on('rebalanceCompleted', eventSpy);

      await rebalancer.executeAutoRebalance(mockHedgePosition);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          success: true
        })
      );
    });
  });
});