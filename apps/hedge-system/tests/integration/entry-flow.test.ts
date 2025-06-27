import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PositionExecutor, EntryFlowEngine, TrailFlowEngine, ActionFlowEngine } from '../../lib/position-execution';
import { WebSocketHandler } from '../../lib/websocket-server';
import { TrailEngine } from '../../lib/trail-engine';
import { 
  Position, 
  PositionStatus, 
  Symbol, 
  ExecutionType,
  MarketCondition 
} from '@repo/shared-types';
import * as amplifyServices from '@repo/shared-amplify';

// モック設定
vi.mock('../../lib/websocket-server');
vi.mock('../../lib/trail-engine');
vi.mock('@repo/shared-amplify', () => ({
  recordExecutionResult: vi.fn().mockResolvedValue({}),
  getPerformanceMetrics: vi.fn().mockResolvedValue({
    totalPositions: 10,
    openPositions: 5,
    closedPositions: 5,
    avgExecutionTime: 150,
    successRate: 0.95
  }),
  createPosition: vi.fn(),
  updatePosition: vi.fn(),
  listUserPositions: vi.fn(),
  subscribeToPositions: vi.fn()
}));

vi.mock('../../lib/amplify-client', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('test-user-123')
}));

describe('EntryFlow Integration Tests', () => {
  let positionExecutor: PositionExecutor;
  let wsHandler: WebSocketHandler;
  let trailEngine: TrailEngine;
  let entryFlowEngine: EntryFlowEngine;

  const mockPosition: Position = {
    id: 'pos-123',
    userId: 'test-user-123',
    accountId: 'acc-456',
    executionType: ExecutionType.ENTRY,
    status: PositionStatus.OPENING,
    symbol: Symbol.USDJPY,
    volume: 0.01,
    trailWidth: 0.001,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockMarketCondition: MarketCondition = {
    symbol: Symbol.USDJPY,
    currentPrice: 150.000,
    spread: 0.00005,
    volatility: 0.005,
    liquidity: 0.9,
    timestamp: new Date().toISOString()
  };

  beforeEach(() => {
    wsHandler = new WebSocketHandler();
    trailEngine = new TrailEngine(wsHandler);
    positionExecutor = new PositionExecutor(wsHandler, trailEngine);
    entryFlowEngine = new EntryFlowEngine();

    // WebSocketHandlerのモック設定
    vi.mocked(wsHandler.sendOpenCommand).mockResolvedValue({
      success: true,
      orderId: 'order-789'
    });

    vi.mocked(wsHandler.sendCloseCommand).mockResolvedValue({
      success: true,
      orderId: 'close-order-999'
    });

    // PriceMonitorのモック
    wsHandler.priceMonitor = {
      getCurrentPrice: vi.fn().mockReturnValue(150.000),
      subscribe: vi.fn(),
      unsubscribe: vi.fn()
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('EntryFlowEngine', () => {
    it('should evaluate entry conditions correctly', async () => {
      const condition = await entryFlowEngine.evaluateEntryCondition(
        mockPosition,
        mockMarketCondition
      );

      expect(condition.isConditionMet).toBe(true);
      expect(condition.positionId).toBe(mockPosition.id);
      expect(condition.symbol).toBe(mockPosition.symbol);
      expect(condition.maxSpread).toBe(0.0001);
      expect(condition.maxVolatility).toBe(0.01);
    });

    it('should reject entry when conditions are not met', async () => {
      const badMarketCondition = {
        ...mockMarketCondition,
        spread: 0.001, // スプレッドが広すぎる
        volatility: 0.02 // ボラティリティが高すぎる
      };

      const condition = await entryFlowEngine.evaluateEntryCondition(
        mockPosition,
        badMarketCondition
      );

      expect(condition.isConditionMet).toBe(false);
    });

    it('should execute order successfully', async () => {
      const result = await entryFlowEngine.executeOrder(
        mockPosition,
        mockMarketCondition,
        wsHandler
      );

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order-789');
      expect(result.executionTime).toBeLessThan(5000);
      expect(wsHandler.sendOpenCommand).toHaveBeenCalled();
    });

    it('should record performance data on successful entry', async () => {
      await entryFlowEngine.executeOrder(
        mockPosition,
        mockMarketCondition,
        wsHandler
      );

      // パフォーマンスデータが保存されることを確認
      await new Promise(resolve => setTimeout(resolve, 100)); // 非同期処理待機
      expect(amplifyServices.recordExecutionResult).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: mockPosition.id,
          executionType: ExecutionType.ENTRY,
          success: true
        })
      );
    });

    it('should handle order execution failure with retry', async () => {
      // 最初の2回は失敗、3回目で成功
      vi.mocked(wsHandler.sendOpenCommand)
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValueOnce({
          success: true,
          orderId: 'retry-order-123'
        });

      const result = await entryFlowEngine.executeOrder(
        mockPosition,
        mockMarketCondition,
        wsHandler
      );

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('retry-order-123');
      expect(wsHandler.sendOpenCommand).toHaveBeenCalledTimes(3);
    });

    it('should track execution statistics', () => {
      const stats = entryFlowEngine.getExecutionStats();
      
      expect(stats).toHaveProperty('totalAttempts');
      expect(stats).toHaveProperty('successfulEntries');
      expect(stats).toHaveProperty('failedEntries');
      expect(stats).toHaveProperty('avgExecutionTime');
      expect(stats).toHaveProperty('successRate');
    });
  });

  describe('PositionExecutor Integration', () => {
    it('should handle position subscription correctly', async () => {
      await positionExecutor.handlePositionSubscription(mockPosition);

      // ステータスに応じた処理が実行されることを確認
      expect(wsHandler.sendOpenCommand).toHaveBeenCalled();
    });

    it('should start trail monitoring for open positions', async () => {
      const openPosition = {
        ...mockPosition,
        status: PositionStatus.OPEN,
        entryPrice: 150.000
      };

      await positionExecutor.startTrailMonitoring(openPosition);

      // TrailEngineにポジションが追加されることを確認
      expect(trailEngine.addPositionMonitoring).toHaveBeenCalledWith(openPosition);
    });

    it('should get performance metrics successfully', async () => {
      const metrics = await positionExecutor.constructor.getPerformanceMetrics(
        'test-user-123',
        'day'
      );

      expect(metrics).toHaveProperty('totalPositions', 10);
      expect(metrics).toHaveProperty('openPositions', 5);
      expect(metrics).toHaveProperty('closedPositions', 5);
      expect(metrics).toHaveProperty('avgExecutionTime', 150);
      expect(metrics).toHaveProperty('successRate', 0.95);
    });

    it('should handle settlement retry on failure', async () => {
      // 決済コマンドを失敗させる
      vi.mocked(wsHandler.sendCloseCommand)
        .mockRejectedValueOnce(new Error('CONNECTION_REFUSED'))
        .mockResolvedValueOnce({
          success: true,
          orderId: 'retry-close-123'
        });

      const closingPosition = {
        ...mockPosition,
        status: PositionStatus.CLOSING
      };

      // privateメソッドをテストするため、直接executeExitを呼び出す
      // @ts-ignore - private method access for testing
      await positionExecutor.executeExit(closingPosition);

      // リトライが実行されることを確認
      expect(wsHandler.sendCloseCommand).toHaveBeenCalledTimes(2);
    });
  });

  describe('TrailFlowEngine', () => {
    it('should initialize trail condition correctly', () => {
      const trailFlowEngine = new TrailFlowEngine();
      const openPosition = {
        ...mockPosition,
        status: PositionStatus.OPEN,
        entryPrice: 150.000,
        trailWidth: 0.001
      };

      const condition = trailFlowEngine.initializeTrailCondition(
        openPosition,
        150.100
      );

      expect(condition.positionId).toBe(openPosition.id);
      expect(condition.entryPrice).toBe(150.000);
      expect(condition.trailWidth).toBe(0.001);
      expect(condition.direction).toBe('BUY');
      expect(condition.highWaterMark).toBe(150.100);
      expect(condition.triggerPrice).toBe(150.099); // 150.100 - 0.001
    });

    it('should evaluate trail condition and update trigger price', () => {
      const trailFlowEngine = new TrailFlowEngine();
      const openPosition = {
        ...mockPosition,
        status: PositionStatus.OPEN,
        entryPrice: 150.000,
        trailWidth: 0.001
      };

      // 初期化
      trailFlowEngine.initializeTrailCondition(openPosition, 150.100);

      // 価格上昇時のトレール更新
      const result1 = trailFlowEngine.evaluateTrailCondition(
        openPosition.id,
        150.200
      );

      expect(result1.isTriggered).toBe(false);
      expect(result1.newTriggerPrice).toBe(150.199); // 150.200 - 0.001
      expect(result1.reason).toContain('High watermark updated');

      // 価格下落時のトレール発動
      const result2 = trailFlowEngine.evaluateTrailCondition(
        openPosition.id,
        150.195
      );

      expect(result2.isTriggered).toBe(true);
      expect(result2.reason).toContain('Trail triggered');
    });
  });

  describe('End-to-End Entry Flow', () => {
    it('should complete full entry flow successfully', async () => {
      // 1. ポジション作成
      const newPosition = await positionExecutor.createPosition({
        accountId: 'acc-456',
        symbol: Symbol.USDJPY,
        volume: 0.01,
        executionType: ExecutionType.ENTRY,
        trailWidth: 0.001
      });

      expect(newPosition).toBeDefined();

      // 2. エントリー実行
      const executionStarted = await positionExecutor.executePosition(newPosition.id);
      expect(executionStarted).toBe(true);

      // 3. エントリー完了処理
      await positionExecutor.handlePositionOpened({
        event: 'OPENED',
        accountId: 'acc-456',
        positionId: newPosition.id,
        mtTicket: '12345',
        price: 150.000,
        time: new Date().toISOString(),
        status: 'SUCCESS'
      });

      // 4. パフォーマンスデータが記録されることを確認
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(amplifyServices.recordExecutionResult).toHaveBeenCalled();
    });

    it('should handle error recovery gracefully', async () => {
      // WebSocketエラーをシミュレート
      vi.mocked(wsHandler.sendOpenCommand)
        .mockRejectedValueOnce(new Error('WebSocket connection lost'))
        .mockResolvedValueOnce({
          success: true,
          orderId: 'recovery-order-123'
        });

      const result = await entryFlowEngine.executeOrder(
        mockPosition,
        mockMarketCondition,
        wsHandler
      );

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('recovery-order-123');
      
      // エラー情報もパフォーマンスDBに記録されることを確認
      const recordCalls = vi.mocked(amplifyServices.recordExecutionResult).mock.calls;
      const errorRecord = recordCalls.find(call => call[0].success === false);
      expect(errorRecord).toBeDefined();
    });
  });
});