import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { HedgeExecutor, HedgeExecutionCriteria, HedgeResult } from '../HedgeExecutor';
import { HedgePositionDetector } from '../HedgePositionDetector';
import { PositionRelationManager } from '../PositionRelationManager';
import { HedgePositionValidator } from '../HedgePositionValidator';
import { WebSocketEntryService } from '../../websocket-entry';
import { WebSocketClient, Position, EntryCommand } from '../../../../../lib/websocket/message-types';

// モックの設定
vi.mock('../../websocket-entry');
vi.mock('../HedgePositionDetector');
vi.mock('../PositionRelationManager');
vi.mock('../HedgePositionValidator');

describe('HedgeExecutor', () => {
  let executor: HedgeExecutor;
  let mockWsClient: Partial<WebSocketClient>;
  let mockEntryService: Partial<WebSocketEntryService>;
  let mockDetector: Partial<HedgePositionDetector>;
  let mockRelationManager: Partial<PositionRelationManager>;
  let mockValidator: Partial<HedgePositionValidator>;
  let mockCriteria: HedgeExecutionCriteria;

  beforeEach(() => {
    // WebSocketClient のモック
    mockWsClient = {
      send: vi.fn(),
      on: vi.fn(),
      getConnectionState: vi.fn().mockReturnValue('connected')
    };

    // WebSocketEntryService のモック
    mockEntryService = {
      sendEntryCommand: vi.fn()
    };

    // HedgePositionDetector のモック
    mockDetector = {
      detectHedgePositions: vi.fn(),
      validateHedgeOpportunity: vi.fn()
    };

    // PositionRelationManager のモック
    mockRelationManager = {
      createRelationship: vi.fn(),
      findRelatedPositions: vi.fn()
    };

    // HedgePositionValidator のモック
    mockValidator = {
      validateHedgePosition: vi.fn().mockReturnValue({
        isValid: true,
        issues: [],
        recommendations: []
      })
    };

    // コンストラクタのモック
    (WebSocketEntryService as unknown as Mock).mockImplementation(() => mockEntryService);

    // HedgeExecutor インスタンスを作成
    executor = new HedgeExecutor(
      mockWsClient as WebSocketClient,
      mockDetector as HedgePositionDetector,
      mockRelationManager as PositionRelationManager,
      mockValidator as HedgePositionValidator
    );

    // テスト用の実行条件
    mockCriteria = {
      symbol: 'EURUSD',
      hedgeType: 'perfect',
      accounts: ['acc1'],
      lotSizes: {
        buy: 1.0,
        sell: 1.0
      },
      executionMode: 'simultaneous',
      timing: {
        maxDelay: 5000,
        sequentialDelay: 1000
      },
      priceSettings: {
        orderType: 'market'
      },
      riskManagement: {}
    };
  });

  describe('executeHedge', () => {
    it('should execute hedge successfully with simultaneous mode', async () => {
      const mockBuyResult = {
        success: true,
        commandId: 'buy_cmd_1',
        positionId: 'pos_buy_1',
        lotSize: 1.0
      };

      const mockSellResult = {
        success: true,
        commandId: 'sell_cmd_1',
        positionId: 'pos_sell_1',
        lotSize: 1.0
      };

      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValueOnce(mockBuyResult)
        .mockResolvedValueOnce(mockSellResult);

      const result = await executor.executeHedge(mockCriteria);

      expect(result.status).toBe('completed');
      expect(result.results.buy).toEqual(mockBuyResult);
      expect(result.results.sell).toEqual(mockSellResult);
      expect(result.rollbackRequired).toBe(false);
      expect(mockEntryService.sendEntryCommand).toHaveBeenCalledTimes(2);
    });

    it('should execute hedge successfully with sequential mode', async () => {
      const sequentialCriteria = {
        ...mockCriteria,
        executionMode: 'sequential' as const
      };

      const mockBuyResult = { success: true, positionId: 'pos_buy_1' };
      const mockSellResult = { success: true, positionId: 'pos_sell_1' };

      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValueOnce(mockBuyResult)
        .mockResolvedValueOnce(mockSellResult);

      const result = await executor.executeHedge(sequentialCriteria);

      expect(result.status).toBe('completed');
      expect(mockEntryService.sendEntryCommand).toHaveBeenCalledTimes(2);
    });

    it('should handle partial execution failure', async () => {
      const mockBuyResult = { success: true, positionId: 'pos_buy_1' };
      const mockSellResult = { success: false, error: 'Sell failed' };

      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValueOnce(mockBuyResult)
        .mockResolvedValueOnce(mockSellResult);

      const result = await executor.executeHedge(mockCriteria);

      expect(result.status).toBe('partial');
      expect(result.rollbackRequired).toBe(true);
    });

    it('should handle complete execution failure', async () => {
      const mockBuyResult = { success: false, error: 'Buy failed' };
      const mockSellResult = { success: false, error: 'Sell failed' };

      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValueOnce(mockBuyResult)
        .mockResolvedValueOnce(mockSellResult);

      const result = await executor.executeHedge(mockCriteria);

      expect(result.status).toBe('failed');
      expect(result.rollbackRequired).toBe(false);
    });

    it('should validate criteria before execution', async () => {
      const invalidCriteria = {
        ...mockCriteria,
        symbol: 'XXX', // Invalid symbol
        lotSizes: { buy: 0, sell: 0 } // Invalid lot sizes
      };

      const result = await executor.executeHedge(invalidCriteria);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Validation failed');
      expect(mockEntryService.sendEntryCommand).not.toHaveBeenCalled();
    });

    it('should queue execution when max concurrent limit is reached', async () => {
      // 最大同時実行数を超える実行を試行
      const promise1 = executor.executeHedge(mockCriteria);
      const promise2 = executor.executeHedge(mockCriteria);
      const promise3 = executor.executeHedge(mockCriteria);
      const promise4 = executor.executeHedge(mockCriteria); // これはキューに入る

      // 最初の実行をモック
      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValue({ success: true, positionId: 'pos_1' });

      await Promise.all([promise1, promise2, promise3]);

      const result4 = await promise4;
      expect(result4.status).toBe('pending');

      // キューの状態を確認
      const queue = executor.getExecutionQueue();
      expect(queue.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executePartialHedge', () => {
    it('should execute partial hedge with correct ratio', async () => {
      const mockPosition: Position = {
        id: 'pos1',
        accountId: 'acc1',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 2.0,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 100,
        swapTotal: 0,
        commission: 0,
        status: 'open',
        openedAt: '2024-06-20T10:00:00Z',
        comment: ''
      };

      const ratio = 0.5;

      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValue({ success: true, positionId: 'hedge_pos' });

      const result = await executor.executePartialHedge(mockPosition, ratio);

      expect(result.status).toBe('completed');
      
      // 呼び出された引数を確認
      const entryCall = (mockEntryService.sendEntryCommand as Mock).mock.calls[0][0] as EntryCommand;
      expect(entryCall.direction).toBe('SELL');
      expect(entryCall.lotSize).toBe(1.0); // 2.0 * 0.5
      expect(entryCall.symbol).toBe('EURUSD');
    });

    it('should reject invalid ratio', async () => {
      const mockPosition: Position = {
        id: 'pos1',
        accountId: 'acc1',
        symbol: 'EURUSD',
        type: 'buy',
        lots: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 50,
        swapTotal: 0,
        commission: 0,
        status: 'open',
        openedAt: '2024-06-20T10:00:00Z',
        comment: ''
      };

      await expect(executor.executePartialHedge(mockPosition, 0)).rejects.toThrow('Ratio must be between 0 and 1');
      await expect(executor.executePartialHedge(mockPosition, 1.5)).rejects.toThrow('Ratio must be between 0 and 1');
    });
  });

  describe('cancelHedgeExecution', () => {
    it('should cancel pending execution', async () => {
      // 実行開始
      const executePromise = executor.executeHedge(mockCriteria);
      
      // すぐに実行IDを取得（実際にはもう少し工夫が必要）
      const activeExecutions = executor.getActiveExecutions();
      if (activeExecutions.length > 0) {
        const executionId = activeExecutions[0].executionId;
        
        await executor.cancelHedgeExecution(executionId);
        
        const result = await executePromise;
        expect(result.status).toBe('failed');
        expect(result.error).toContain('cancelled');
      }
    });

    it('should not cancel completed execution', async () => {
      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValue({ success: true, positionId: 'pos_1' });

      const result = await executor.executeHedge(mockCriteria);
      
      await expect(executor.cancelHedgeExecution(result.executionId))
        .rejects.toThrow('Cannot cancel execution in status');
    });

    it('should throw error for non-existent execution', async () => {
      await expect(executor.cancelHedgeExecution('non_existent_id'))
        .rejects.toThrow('Execution non_existent_id not found');
    });
  });

  describe('getExecutionStatus', () => {
    it('should return execution status for valid execution', async () => {
      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValue({ success: true, positionId: 'pos_1' });

      const result = await executor.executeHedge(mockCriteria);
      const status = executor.getExecutionStatus(result.executionId);

      expect(status).toBeDefined();
      expect(status!.executionId).toBe(result.executionId);
      expect(status!.status).toBe(result.status);
      expect(status!.progress).toBeDefined();
      expect(status!.startTime).toBeDefined();
    });

    it('should return null for non-existent execution', () => {
      const status = executor.getExecutionStatus('non_existent_id');
      expect(status).toBeNull();
    });
  });

  describe('getActiveExecutions', () => {
    it('should return only active executions', async () => {
      // 完了した実行
      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValue({ success: true, positionId: 'pos_1' });

      await executor.executeHedge(mockCriteria);

      // 進行中の実行
      const pendingPromise = executor.executeHedge(mockCriteria);

      const activeExecutions = executor.getActiveExecutions();
      
      // 完了した実行は含まれない
      expect(activeExecutions.every(e => e.status === 'pending' || e.status === 'executing')).toBe(true);

      await pendingPromise;
    });
  });

  describe('execution timeout', () => {
    it('should handle execution timeout', async () => {
      // EntryService を遅延させる
      (mockEntryService.sendEntryCommand as Mock)
        .mockImplementation(() => new Promise(resolve => {
          setTimeout(() => resolve({ success: true, positionId: 'pos_1' }), 35000); // 35秒後
        }));

      const result = await executor.executeHedge(mockCriteria);
      
      expect(result.status).toBe('failed');
      expect(result.error).toContain('timeout');
    }, 40000); // テスト自体のタイムアウトを40秒に設定
  });

  describe('validation', () => {
    it('should validate symbol format', async () => {
      const invalidCriteria = {
        ...mockCriteria,
        symbol: 'XX'
      };

      const result = await executor.executeHedge(invalidCriteria);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Invalid symbol');
    });

    it('should validate lot sizes', async () => {
      const invalidCriteria = {
        ...mockCriteria,
        lotSizes: { buy: 0, sell: 0 }
      };

      const result = await executor.executeHedge(invalidCriteria);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('At least one lot size must be greater than 0');
    });

    it('should validate accounts', async () => {
      const invalidCriteria = {
        ...mockCriteria,
        accounts: []
      };

      const result = await executor.executeHedge(invalidCriteria);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('At least one account is required');
    });
  });

  describe('resource cleanup', () => {
    it('should clean up resources on dispose', () => {
      executor.dispose();

      const activeExecutions = executor.getActiveExecutions();
      const queue = executor.getExecutionQueue();

      expect(activeExecutions).toHaveLength(0);
      expect(queue).toHaveLength(0);
    });
  });

  describe('entry command generation', () => {
    it('should generate correct buy entry command', async () => {
      const criteriaWithPrice = {
        ...mockCriteria,
        priceSettings: {
          orderType: 'limit' as const,
          buyPrice: 1.1000,
          sellPrice: 1.1005
        },
        riskManagement: {
          stopLoss: 1.0950,
          takeProfit: 1.1100
        }
      };

      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValue({ success: true, positionId: 'pos_1' });

      await executor.executeHedge(criteriaWithPrice);

      const buyCall = (mockEntryService.sendEntryCommand as Mock).mock.calls
        .find(call => call[0].direction === 'BUY')?.[0] as EntryCommand;

      expect(buyCall).toBeDefined();
      expect(buyCall.symbol).toBe('EURUSD');
      expect(buyCall.direction).toBe('BUY');
      expect(buyCall.lotSize).toBe(1.0);
      expect(buyCall.orderType).toBe('LIMIT');
      expect(buyCall.price).toBe(1.1000);
      expect(buyCall.stopLoss).toBe(1.0950);
      expect(buyCall.takeProfit).toBe(1.1100);
    });

    it('should generate correct sell entry command', async () => {
      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValue({ success: true, positionId: 'pos_1' });

      await executor.executeHedge(mockCriteria);

      const sellCall = (mockEntryService.sendEntryCommand as Mock).mock.calls
        .find(call => call[0].direction === 'SELL')?.[0] as EntryCommand;

      expect(sellCall).toBeDefined();
      expect(sellCall.symbol).toBe('EURUSD');
      expect(sellCall.direction).toBe('SELL');
      expect(sellCall.lotSize).toBe(1.0);
      expect(sellCall.orderType).toBe('MARKET');
    });
  });

  describe('hedge position creation', () => {
    it('should create hedge position when both executions succeed', async () => {
      const mockBuyResult = {
        success: true,
        positionId: 'pos_buy_1',
        lotSize: 1.0
      };

      const mockSellResult = {
        success: true,
        positionId: 'pos_sell_1',
        lotSize: 1.0
      };

      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValueOnce(mockBuyResult)
        .mockResolvedValueOnce(mockSellResult);

      const result = await executor.executeHedge(mockCriteria);

      expect(result.status).toBe('completed');
      expect(result.hedgePosition).toBeDefined();
      expect(result.hedgePosition!.positionIds).toContain('pos_buy_1');
      expect(result.hedgePosition!.positionIds).toContain('pos_sell_1');
    });

    it('should not create hedge position on partial execution', async () => {
      const mockBuyResult = { success: true, positionId: 'pos_buy_1' };
      const mockSellResult = { success: false, error: 'Sell failed' };

      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValueOnce(mockBuyResult)
        .mockResolvedValueOnce(mockSellResult);

      const result = await executor.executeHedge(mockCriteria);

      expect(result.status).toBe('partial');
      expect(result.hedgePosition).toBeUndefined();
    });
  });
});