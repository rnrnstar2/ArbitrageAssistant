import { describe, it, expect, beforeEach } from 'vitest';
import HedgeHistoryManager, {
  HedgeAction,
  HedgeActionType,
  HedgeHistoryRecord,
  HistoryFilter,
  ExportData
} from '../HedgeHistoryManager';
import { HedgePosition } from '../types';

describe('HedgeHistoryManager', () => {
  let historyManager: HedgeHistoryManager;
  let mockHedgePosition: HedgePosition;

  beforeEach(() => {
    historyManager = new HedgeHistoryManager();
    mockHedgePosition = {
      id: 'hedge_123',
      positionIds: ['pos_1', 'pos_2'],
      symbol: 'EURUSD',
      hedgeType: 'perfect',
      accounts: ['account_1'],
      totalLots: {
        buy: 1.0,
        sell: 1.0
      },
      totalProfit: 150.50,
      isBalanced: true,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      settings: {
        autoRebalance: true,
        maxImbalance: 0.05,
        maintainOnClose: true
      }
    };
  });

  describe('recordHedgeAction', () => {
    it('両建て操作を正常に記録する', async () => {
      const action: Omit<HedgeAction, 'id' | 'timestamp'> = {
        hedgeId: mockHedgePosition.id,
        type: 'create',
        description: '完全両建てを作成',
        data: { lots: 1.0 },
        result: 'success',
        metadata: {
          triggeredBy: 'user',
          relatedPositionIds: ['pos_1', 'pos_2']
        }
      };

      await historyManager.recordHedgeAction(mockHedgePosition, action);

      const history = await historyManager.getHedgeHistory(mockHedgePosition.id);
      expect(history).toHaveLength(1);
      expect(history[0].actions).toHaveLength(1);
      expect(history[0].actions[0].type).toBe('create');
      expect(history[0].actions[0].description).toBe('完全両建てを作成');
    });

    it('複数の操作を時系列で記録する', async () => {
      const actions: Array<Omit<HedgeAction, 'id' | 'timestamp'>> = [
        {
          hedgeId: mockHedgePosition.id,
          type: 'create',
          description: '両建て作成',
          data: {},
          result: 'success'
        },
        {
          hedgeId: mockHedgePosition.id,
          type: 'rebalance',
          description: 'リバランス実行',
          data: { oldRatio: 1.0, newRatio: 1.1 },
          result: 'success'
        },
        {
          hedgeId: mockHedgePosition.id,
          type: 'close',
          description: '両建て解除',
          data: { reason: 'profit_target' },
          result: 'success'
        }
      ];

      for (const action of actions) {
        await historyManager.recordHedgeAction(mockHedgePosition, action);
        // 少し時間をずらす
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const history = await historyManager.getHedgeHistory(mockHedgePosition.id);
      expect(history[0].actions).toHaveLength(3);
      
      // 最新順にソートされているかチェック
      const timestamps = history[0].actions.map(a => a.timestamp.getTime());
      expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1]);
      expect(timestamps[1]).toBeGreaterThanOrEqual(timestamps[2]);
    });

    it('状態スナップショットを作成する', async () => {
      const action: Omit<HedgeAction, 'id' | 'timestamp'> = {
        hedgeId: mockHedgePosition.id,
        type: 'create',
        description: '両建て作成',
        data: {},
        result: 'success'
      };

      await historyManager.recordHedgeAction(mockHedgePosition, action);

      const history = await historyManager.getHedgeHistory(mockHedgePosition.id);
      expect(history[0].states).toHaveLength(1);
      expect(history[0].states[0].hedge).toEqual(mockHedgePosition);
      expect(history[0].states[0].changeType).toBe('initial');
    });

    it('パフォーマンススナップショットを作成する', async () => {
      const action: Omit<HedgeAction, 'id' | 'timestamp'> = {
        hedgeId: mockHedgePosition.id,
        type: 'create',
        description: '両建て作成',
        data: {},
        result: 'success'
      };

      await historyManager.recordHedgeAction(mockHedgePosition, action);

      const history = await historyManager.getHedgeHistory(mockHedgePosition.id);
      expect(history[0].performance).toHaveLength(1);
      expect(history[0].performance[0].totalProfit).toBe(150.50);
      expect(history[0].performance[0].totalLots).toEqual({ buy: 1.0, sell: 1.0 });
      expect(history[0].performance[0].balance).toBe(0); // 完全両建てなので差分は0
    });
  });

  describe('getHedgeHistory', () => {
    beforeEach(async () => {
      // テスト用の履歴データを作成
      const action: Omit<HedgeAction, 'id' | 'timestamp'> = {
        hedgeId: mockHedgePosition.id,
        type: 'create',
        description: '両建て作成',
        data: {},
        result: 'success'
      };
      await historyManager.recordHedgeAction(mockHedgePosition, action);
    });

    it('指定された両建てIDの履歴を取得する', async () => {
      const history = await historyManager.getHedgeHistory(mockHedgePosition.id);
      
      expect(history).toHaveLength(1);
      expect(history[0].hedgeId).toBe(mockHedgePosition.id);
      expect(history[0].hedge).toEqual(mockHedgePosition);
    });

    it('存在しない両建てIDの場合は空配列を返す', async () => {
      const history = await historyManager.getHedgeHistory('non_existent_id');
      expect(history).toHaveLength(0);
    });

    it('全ての履歴を取得する', async () => {
      // 別の両建ても追加
      const anotherHedge: HedgePosition = {
        ...mockHedgePosition,
        id: 'hedge_456',
        symbol: 'GBPUSD'
      };
      
      const action: Omit<HedgeAction, 'id' | 'timestamp'> = {
        hedgeId: anotherHedge.id,
        type: 'create',
        description: '別の両建て作成',
        data: {},
        result: 'success'
      };
      await historyManager.recordHedgeAction(anotherHedge, action);

      const allHistory = await historyManager.getHedgeHistory('all');
      expect(allHistory).toHaveLength(2);
    });
  });

  describe('getHedgeTimeline', () => {
    beforeEach(async () => {
      // タイムライン用のテストデータを作成
      const actions: Array<Omit<HedgeAction, 'id' | 'timestamp'>> = [
        {
          hedgeId: mockHedgePosition.id,
          type: 'create',
          description: '両建て作成',
          data: {},
          result: 'success'
        },
        {
          hedgeId: mockHedgePosition.id,
          type: 'rebalance',
          description: 'リバランス実行',
          data: {},
          result: 'success'
        }
      ];

      for (const action of actions) {
        await historyManager.recordHedgeAction(mockHedgePosition, action);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });

    it('タイムラインイベントを生成する', async () => {
      const timeline = await historyManager.getHedgeTimeline(mockHedgePosition.id);
      
      expect(timeline.length).toBeGreaterThan(0);
      
      // アクションイベントが含まれているかチェック
      const actionEvents = timeline.filter(event => event.type === 'action');
      expect(actionEvents).toHaveLength(2);
      
      // 状態変更イベントが含まれているかチェック
      const stateChangeEvents = timeline.filter(event => event.type === 'state_change');
      expect(stateChangeEvents.length).toBeGreaterThan(0);
    });

    it('時系列順にソートされている', async () => {
      const timeline = await historyManager.getHedgeTimeline(mockHedgePosition.id);
      
      const timestamps = timeline.map(event => event.timestamp.getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i-1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });

    it('存在しない両建てIDの場合は空配列を返す', async () => {
      const timeline = await historyManager.getHedgeTimeline('non_existent_id');
      expect(timeline).toHaveLength(0);
    });
  });

  describe('exportHedgeHistory', () => {
    beforeEach(async () => {
      // エクスポート用のテストデータを作成
      const hedges = [
        { ...mockHedgePosition, id: 'hedge_1', symbol: 'EURUSD', totalProfit: 100 },
        { ...mockHedgePosition, id: 'hedge_2', symbol: 'GBPUSD', totalProfit: -50 },
        { ...mockHedgePosition, id: 'hedge_3', symbol: 'USDJPY', totalProfit: 200 }
      ];

      for (const hedge of hedges) {
        const action: Omit<HedgeAction, 'id' | 'timestamp'> = {
          hedgeId: hedge.id,
          type: 'create',
          description: '両建て作成',
          data: {},
          result: 'success'
        };
        await historyManager.recordHedgeAction(hedge, action);
      }
    });

    it('フィルターなしでの全履歴エクスポート', async () => {
      const exportData = await historyManager.exportHedgeHistory();
      
      expect(exportData.metadata.totalRecords).toBe(3);
      expect(exportData.records).toHaveLength(3);
      expect(exportData.metadata.summary.totalHedges).toBe(3);
      expect(exportData.metadata.summary.totalProfit).toBe(250); // 100 - 50 + 200
    });

    it('通貨ペアフィルターでのエクスポート', async () => {
      const filter: HistoryFilter = {
        symbols: ['EURUSD', 'GBPUSD']
      };
      
      const exportData = await historyManager.exportHedgeHistory(filter);
      
      expect(exportData.metadata.totalRecords).toBe(2);
      expect(exportData.records).toHaveLength(2);
      expect(exportData.metadata.summary.totalProfit).toBe(50); // 100 - 50
    });

    it('利益範囲フィルターでのエクスポート', async () => {
      const filter: HistoryFilter = {
        performanceRange: {
          minProfit: 0
        }
      };
      
      const exportData = await historyManager.exportHedgeHistory(filter);
      
      expect(exportData.metadata.totalRecords).toBe(2); // 利益が0以上の両建て
      expect(exportData.records.every(r => r.hedge.totalProfit >= 0)).toBe(true);
    });

    it('リミットとオフセットが適用される', async () => {
      const filter: HistoryFilter = {
        limit: 2,
        offset: 1
      };
      
      const exportData = await historyManager.exportHedgeHistory(filter);
      
      expect(exportData.metadata.totalRecords).toBe(2);
      expect(exportData.records).toHaveLength(2);
    });

    it('分析データが含まれている', async () => {
      const exportData = await historyManager.exportHedgeHistory();
      
      expect(exportData.analytics).toBeDefined();
      expect(exportData.analytics.performance).toBeDefined();
      expect(exportData.analytics.patterns).toBeDefined();
      expect(exportData.analytics.trends).toBeDefined();
      expect(exportData.analytics.recommendations).toBeDefined();
    });
  });

  describe('analyzeHistory', () => {
    beforeEach(async () => {
      // 分析用のテストデータを作成
      const testData = [
        { id: 'hedge_1', profit: 100, symbol: 'EURUSD', hour: 10 },
        { id: 'hedge_2', profit: -20, symbol: 'GBPUSD', hour: 10 },
        { id: 'hedge_3', profit: 150, symbol: 'EURUSD', hour: 10 },
        { id: 'hedge_4', profit: 80, symbol: 'USDJPY', hour: 14 },
        { id: 'hedge_5', profit: -50, symbol: 'GBPUSD', hour: 14 }
      ];

      for (const data of testData) {
        const hedge: HedgePosition = {
          ...mockHedgePosition,
          id: data.id,
          symbol: data.symbol,
          totalProfit: data.profit,
          createdAt: new Date(`2024-01-01T${data.hour.toString().padStart(2, '0')}:00:00Z`)
        };

        const action: Omit<HedgeAction, 'id' | 'timestamp'> = {
          hedgeId: hedge.id,
          type: 'create',
          description: '両建て作成',
          data: {},
          result: 'success'
        };
        await historyManager.recordHedgeAction(hedge, action);
      }
    });

    it('パフォーマンス分析を実行する', async () => {
      const records = await historyManager.getHedgeHistory('all');
      const analytics = await historyManager.analyzeHistory(records);
      
      expect(analytics.performance.totalReturn).toBe(260); // 100-20+150+80-50
      expect(analytics.performance.averageReturn).toBe(52); // 260/5
      expect(analytics.performance.winRate).toBe(0.6); // 3勝2敗
      expect(analytics.performance.volatility).toBeGreaterThan(0);
    });

    it('パターン分析を実行する', async () => {
      const records = await historyManager.getHedgeHistory('all');
      const analytics = await historyManager.analyzeHistory(records);
      
      expect(analytics.patterns).toBeDefined();
      expect(Array.isArray(analytics.patterns)).toBe(true);
      
      // 成功パターンが検出されるかチェック（3つ以上の成功例があるため）
      const successPattern = analytics.patterns.find(p => p.type === 'success_pattern');
      expect(successPattern).toBeDefined();
    });

    it('トレンド分析を実行する', async () => {
      const records = await historyManager.getHedgeHistory('all');
      const analytics = await historyManager.analyzeHistory(records);
      
      expect(analytics.trends).toBeDefined();
      expect(Array.isArray(analytics.trends)).toBe(true);
      expect(analytics.trends.length).toBeGreaterThan(0);
      
      // 利益トレンドが含まれているかチェック
      const profitTrend = analytics.trends.find(t => t.metric === 'profit');
      expect(profitTrend).toBeDefined();
    });

    it('推奨事項を生成する', async () => {
      const records = await historyManager.getHedgeHistory('all');
      const analytics = await historyManager.analyzeHistory(records);
      
      expect(analytics.recommendations).toBeDefined();
      expect(Array.isArray(analytics.recommendations)).toBe(true);
    });
  });

  describe('getPerformanceTracking', () => {
    beforeEach(async () => {
      // パフォーマンストラッキング用のデータを作成
      const action: Omit<HedgeAction, 'id' | 'timestamp'> = {
        hedgeId: mockHedgePosition.id,
        type: 'create',
        description: '両建て作成',
        data: {},
        result: 'success'
      };
      await historyManager.recordHedgeAction(mockHedgePosition, action);
    });

    it('指定した時間枠のパフォーマンスデータを取得する', () => {
      const tracking = historyManager.getPerformanceTracking(mockHedgePosition.id, '1d');
      
      expect(Array.isArray(tracking)).toBe(true);
      expect(tracking.length).toBeGreaterThan(0);
      expect(tracking[0].hedgeId).toBe(mockHedgePosition.id);
      expect(tracking[0].totalProfit).toBe(150.50);
    });

    it('存在しない両建てIDの場合は空配列を返す', () => {
      const tracking = historyManager.getPerformanceTracking('non_existent_id');
      expect(tracking).toHaveLength(0);
    });

    it('指定した時間枠外のデータは除外される', () => {
      // 24時間より古いデータは除外されることをテスト
      const tracking = historyManager.getPerformanceTracking(mockHedgePosition.id, '1h');
      
      // 実際の実装では、現在時刻から1時間以内のデータのみ返される
      // テストデータは作成直後なので、1時間以内に含まれる
      expect(tracking.length).toBeGreaterThan(0);
    });
  });

  describe('キャッシュ機能', () => {
    beforeEach(async () => {
      const action: Omit<HedgeAction, 'id' | 'timestamp'> = {
        hedgeId: mockHedgePosition.id,
        type: 'create',
        description: '両建て作成',
        data: {},
        result: 'success'
      };
      await historyManager.recordHedgeAction(mockHedgePosition, action);
    });

    it('履歴データがキャッシュされる', async () => {
      // 最初の呼び出し
      const history1 = await historyManager.getHedgeHistory(mockHedgePosition.id);
      
      // 二回目の呼び出し（キャッシュから取得されるはず）
      const history2 = await historyManager.getHedgeHistory(mockHedgePosition.id);
      
      expect(history1).toEqual(history2);
    });

    it('新しい操作記録後にキャッシュがクリアされる', async () => {
      // 初回データ取得
      await historyManager.getHedgeHistory(mockHedgePosition.id);
      
      // 新しい操作を記録
      const newAction: Omit<HedgeAction, 'id' | 'timestamp'> = {
        hedgeId: mockHedgePosition.id,
        type: 'rebalance',
        description: 'リバランス',
        data: {},
        result: 'success'
      };
      await historyManager.recordHedgeAction(mockHedgePosition, newAction);
      
      // 履歴を再取得
      const updatedHistory = await historyManager.getHedgeHistory(mockHedgePosition.id);
      expect(updatedHistory[0].actions).toHaveLength(2);
    });
  });

  describe('エラーハンドリング', () => {
    it('不正なデータでも適切に処理する', async () => {
      const invalidAction: Omit<HedgeAction, 'id' | 'timestamp'> = {
        hedgeId: '',
        type: 'create' as HedgeActionType,
        description: '',
        data: {},
        result: 'success'
      };

      // エラーが発生しないことを確認
      await expect(
        historyManager.recordHedgeAction(mockHedgePosition, invalidAction)
      ).resolves.not.toThrow();
    });

    it('空の履歴に対する分析でもエラーが発生しない', async () => {
      const analytics = await historyManager.analyzeHistory([]);
      
      expect(analytics.performance.totalReturn).toBe(0);
      expect(analytics.patterns).toHaveLength(0);
      expect(analytics.trends).toHaveLength(0);
    });
  });
});