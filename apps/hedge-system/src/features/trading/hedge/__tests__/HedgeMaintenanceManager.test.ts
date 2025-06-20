import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { HedgeMaintenanceManager, MaintenanceResult, MaintenanceSettings } from '../HedgeMaintenanceManager';
import { PositionRelationManager } from '../PositionRelationManager';
import { HedgePositionValidator } from '../HedgePositionValidator';
import { HedgeExecutor } from '../HedgeExecutor';
import { HedgePosition } from '../types';
import { Position } from '../../close/types';
import { WebSocketClient } from '../../../../../lib/websocket/message-types';

// モックの設定
vi.mock('../PositionRelationManager');
vi.mock('../HedgePositionValidator');
vi.mock('../HedgeExecutor');

describe('HedgeMaintenanceManager', () => {
  let manager: HedgeMaintenanceManager;
  let mockRelationManager: Partial<PositionRelationManager>;
  let mockValidator: Partial<HedgePositionValidator>;
  let mockExecutor: Partial<HedgeExecutor>;
  let mockWsClient: Partial<WebSocketClient>;
  let mockHedgePosition: HedgePosition;
  let mockSettings: MaintenanceSettings;

  beforeEach(() => {
    // PositionRelationManager のモック
    mockRelationManager = {
      getAllHedgePositions: vi.fn(),
      findRelatedPositions: vi.fn(),
      updateRelation: vi.fn()
    };

    // HedgePositionValidator のモック
    mockValidator = {
      validateHedgePosition: vi.fn()
    };

    // HedgeExecutor のモック
    mockExecutor = {
      executeHedge: vi.fn(),
      getExecutionStatus: vi.fn(),
      cancelHedgeExecution: vi.fn()
    };

    // WebSocketClient のモック
    mockWsClient = {
      send: vi.fn(),
      on: vi.fn(),
      getConnectionState: vi.fn().mockReturnValue('connected')
    };

    // テスト用の設定
    mockSettings = {
      enabled: true,
      scheduleType: 'daily',
      executionTime: '23:00',
      swapAvoidanceThreshold: 22,
      maxRetries: 3,
      retryDelay: 5000,
      emergencyMaintenance: true
    };

    // テスト用の両建てポジション
    mockHedgePosition = {
      id: 'hedge_test_001',
      positionIds: ['pos_001', 'pos_002'],
      symbol: 'EURUSD',
      hedgeType: 'perfect',
      accounts: ['account_001'],
      totalLots: {
        buy: 1.0,
        sell: 1.0
      },
      totalProfit: 0,
      isBalanced: true,
      createdAt: new Date('2023-01-01T10:00:00Z'),
      settings: {
        autoRebalance: true,
        maxImbalance: 0.1,
        maintainOnClose: true
      }
    };

    // HedgeMaintenanceManager のインスタンス作成
    manager = new HedgeMaintenanceManager(
      mockRelationManager as PositionRelationManager,
      mockValidator as HedgePositionValidator,
      mockExecutor as HedgeExecutor,
      mockWsClient as WebSocketClient,
      { enabled: false } // テスト中はスケジューラーを無効化
    );
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
  });

  describe('maintainHedgeDuringCleanup', () => {
    it('should successfully maintain hedge during cleanup', async () => {
      // モックの設定
      const mockValidation = {
        isValid: true,
        issues: [],
        recommendations: []
      };
      (mockValidator.validateHedgePosition as Mock).mockResolvedValue(mockValidation);
      (mockRelationManager.getAllHedgePositions as Mock).mockReturnValue([mockHedgePosition]);

      // 実行
      const result = await manager.maintainHedgeDuringCleanup(mockHedgePosition);

      // 検証
      expect(result.status).toBe('completed');
      expect(result.hedgeId).toBe(mockHedgePosition.id);
      expect(result.operations).toHaveLength(2); // close + reopen
      expect(result.rollbackRequired).toBe(false);
      expect(result.completedAt).toBeDefined();
    });

    it('should handle validation failure', async () => {
      // バリデーション失敗のモック
      const mockValidation = {
        isValid: false,
        issues: [{ 
          type: 'lot_imbalance', 
          severity: 'error', 
          description: 'Lot imbalance detected',
          affectedPositions: ['pos_001']
        }],
        recommendations: []
      };
      (mockValidator.validateHedgePosition as Mock).mockResolvedValue(mockValidation);

      // 実行
      const result = await manager.maintainHedgeDuringCleanup(mockHedgePosition);

      // 検証
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Maintenance validation failed');
    });

    it('should handle execution errors with rollback', async () => {
      // バリデーション成功のモック
      const mockValidation = {
        isValid: true,
        issues: [],
        recommendations: []
      };
      (mockValidator.validateHedgePosition as Mock).mockResolvedValue(mockValidation);
      
      // 実行エラーのモック
      const mockError = new Error('Execution failed');
      vi.spyOn(manager, 'executeSimultaneousCloseReopen').mockRejectedValue(mockError);

      // 実行
      const result = await manager.maintainHedgeDuringCleanup(mockHedgePosition);

      // 検証
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Execution failed');
      expect(result.rollbackRequired).toBe(true);
    });
  });

  describe('executeSimultaneousCloseReopen', () => {
    it('should execute close and reopen operations', async () => {
      // モックの設定
      const mockPositions: Position[] = [
        {
          id: 'pos_001',
          accountId: 'account_001',
          symbol: 'EURUSD',
          type: 'buy',
          lots: 1.0,
          openPrice: 1.1000,
          currentPrice: 1.1010,
          profit: 10.0,
          openedAt: new Date()
        },
        {
          id: 'pos_002',
          accountId: 'account_001',
          symbol: 'EURUSD',
          type: 'sell',
          lots: 1.0,
          openPrice: 1.1000,
          currentPrice: 1.1010,
          profit: -10.0,
          openedAt: new Date()
        }
      ];

      // プライベートメソッドのモック
      vi.spyOn(manager as any, 'getCurrentPositions').mockResolvedValue(mockPositions);
      vi.spyOn(manager as any, 'closeAllPositions').mockResolvedValue(undefined);
      vi.spyOn(manager as any, 'reopenPositions').mockResolvedValue(undefined);

      // 実行
      await manager.executeSimultaneousCloseReopen(mockHedgePosition);

      // 検証
      expect(manager['getCurrentPositions']).toHaveBeenCalledWith(mockHedgePosition.positionIds);
      expect(manager['closeAllPositions']).toHaveBeenCalledWith(mockHedgePosition.positionIds);
      expect(manager['reopenPositions']).toHaveBeenCalledWith(mockHedgePosition, mockPositions);
    });

    it('should handle close operation failure', async () => {
      // モックの設定
      vi.spyOn(manager as any, 'getCurrentPositions').mockResolvedValue([]);
      vi.spyOn(manager as any, 'closeAllPositions').mockRejectedValue(new Error('Close failed'));

      // 実行と検証
      await expect(manager.executeSimultaneousCloseReopen(mockHedgePosition))
        .rejects.toThrow('Close failed');
    });
  });

  describe('validateMaintenanceIntegrity', () => {
    it('should validate integrity correctly for identical positions', () => {
      const before = { ...mockHedgePosition };
      const after = { ...mockHedgePosition };

      const result = manager.validateMaintenanceIntegrity(before, after);
      
      expect(result).toBe(true);
    });

    it('should fail validation for different symbols', () => {
      const before = { ...mockHedgePosition };
      const after = { ...mockHedgePosition, symbol: 'GBPUSD' };

      const result = manager.validateMaintenanceIntegrity(before, after);
      
      expect(result).toBe(false);
    });

    it('should fail validation for different hedge types', () => {
      const before = { ...mockHedgePosition };
      const after = { ...mockHedgePosition, hedgeType: 'partial' as const };

      const result = manager.validateMaintenanceIntegrity(before, after);
      
      expect(result).toBe(false);
    });

    it('should fail validation for lot size differences', () => {
      const before = { ...mockHedgePosition };
      const after = { 
        ...mockHedgePosition, 
        totalLots: { buy: 1.0, sell: 0.5 } 
      };

      const result = manager.validateMaintenanceIntegrity(before, after);
      
      expect(result).toBe(false);
    });

    it('should allow small lot size differences', () => {
      const before = { ...mockHedgePosition };
      const after = { 
        ...mockHedgePosition, 
        totalLots: { buy: 1.0, sell: 1.005 } 
      };

      const result = manager.validateMaintenanceIntegrity(before, after);
      
      expect(result).toBe(true);
    });
  });

  describe('preserveHedgeHistory', () => {
    it('should preserve hedge history correctly', async () => {
      await manager.preserveHedgeHistory(mockHedgePosition, 'maintenance', 'Test maintenance');

      // 履歴が保存されていることを確認
      const history = manager['history'].get(mockHedgePosition.id);
      expect(history).toBeDefined();
      expect(history).toHaveLength(1);
      expect(history![0].type).toBe('maintenance');
      expect(history![0].metadata.reason).toBe('Test maintenance');
      expect(history![0].snapshot).toEqual(mockHedgePosition);
    });

    it('should limit history to 30 entries', async () => {
      // 31回履歴を追加
      for (let i = 0; i < 31; i++) {
        await manager.preserveHedgeHistory(mockHedgePosition, 'maintenance', `Test ${i}`);
      }

      // 履歴が30件に制限されていることを確認
      const history = manager['history'].get(mockHedgePosition.id);
      expect(history).toHaveLength(30);
      expect(history![0].metadata.reason).toBe('Test 1'); // 最初のエントリが削除されている
    });
  });

  describe('scheduleMaintenanceTask', () => {
    it('should create maintenance schedule', () => {
      const scheduledAt = new Date('2023-12-01T23:00:00Z');
      
      const schedule = manager.scheduleMaintenanceTask(
        mockHedgePosition.id,
        scheduledAt,
        'daily'
      );

      expect(schedule.hedgeId).toBe(mockHedgePosition.id);
      expect(schedule.scheduledAt).toEqual(scheduledAt);
      expect(schedule.type).toBe('daily');
      expect(schedule.status).toBe('scheduled');
      expect(schedule.attempts).toBe(0);
    });
  });

  describe('executeEmergencyMaintenance', () => {
    it('should execute emergency maintenance', async () => {
      // モックの設定
      (mockRelationManager.getAllHedgePositions as Mock).mockReturnValue([mockHedgePosition]);
      const mockValidation = {
        isValid: true,
        issues: [],
        recommendations: []
      };
      (mockValidator.validateHedgePosition as Mock).mockResolvedValue(mockValidation);

      // 実行
      const result = await manager.executeEmergencyMaintenance(
        mockHedgePosition.id,
        'Critical issue detected'
      );

      // 検証
      expect(result.status).toBe('completed');
      expect(result.hedgeId).toBe(mockHedgePosition.id);
    });

    it('should fail when emergency maintenance is disabled', async () => {
      // 緊急維持管理を無効化
      const disabledManager = new HedgeMaintenanceManager(
        mockRelationManager as PositionRelationManager,
        mockValidator as HedgePositionValidator,
        mockExecutor as HedgeExecutor,
        mockWsClient as WebSocketClient,
        { emergencyMaintenance: false }
      );

      // 実行と検証
      await expect(
        disabledManager.executeEmergencyMaintenance(mockHedgePosition.id, 'Test')
      ).rejects.toThrow('Emergency maintenance is disabled');

      disabledManager.dispose();
    });

    it('should fail when hedge position not found', async () => {
      // 空の配列を返すモック
      (mockRelationManager.getAllHedgePositions as Mock).mockReturnValue([]);

      // 実行と検証
      await expect(
        manager.executeEmergencyMaintenance('nonexistent_id', 'Test')
      ).rejects.toThrow('Hedge position nonexistent_id not found');
    });
  });

  describe('getMaintenanceStatistics', () => {
    it('should return correct statistics', async () => {
      // 複数の維持管理を実行
      const mockValidation = {
        isValid: true,
        issues: [],
        recommendations: []
      };
      (mockValidator.validateHedgePosition as Mock).mockResolvedValue(mockValidation);
      (mockRelationManager.getAllHedgePositions as Mock).mockReturnValue([mockHedgePosition]);

      // 3つの維持管理を実行（2つ成功、1つ失敗）
      await manager.maintainHedgeDuringCleanup(mockHedgePosition);
      await manager.maintainHedgeDuringCleanup(mockHedgePosition);
      
      // 1つを失敗させる
      (mockValidator.validateHedgePosition as Mock).mockResolvedValueOnce({
        isValid: false,
        issues: [{ type: 'error', severity: 'error', description: 'Test error', affectedPositions: [] }],
        recommendations: []
      });
      await manager.maintainHedgeDuringCleanup(mockHedgePosition);

      // 統計を取得
      const stats = manager.getMaintenanceStatistics();

      // 検証
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('cancelMaintenance', () => {
    it('should cancel active maintenance', async () => {
      // 実行中の維持管理を作成
      const mockValidation = {
        isValid: true,
        issues: [],
        recommendations: []
      };
      (mockValidator.validateHedgePosition as Mock).mockResolvedValue(mockValidation);
      (mockRelationManager.getAllHedgePositions as Mock).mockReturnValue([mockHedgePosition]);

      // 長時間実行される維持管理をシミュレート
      const maintenancePromise = manager.maintainHedgeDuringCleanup(mockHedgePosition);
      
      // 少し待ってからキャンセル
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // アクティブな維持管理のIDを取得
      const activeMaintenances = Array.from(manager['activeMaintenances'].keys());
      if (activeMaintenances.length > 0) {
        await manager.cancelMaintenance(activeMaintenances[0]);
        
        const maintenance = manager['activeMaintenances'].get(activeMaintenances[0]);
        expect(maintenance?.status).toBe('failed');
        expect(maintenance?.error).toBe('Cancelled by user');
      }

      // 元の維持管理の完了を待つ
      await maintenancePromise;
    });

    it('should fail to cancel non-existent maintenance', async () => {
      await expect(manager.cancelMaintenance('nonexistent_id'))
        .rejects.toThrow('Maintenance nonexistent_id not found');
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      // 何らかのスケジュールやタイムアウトを設定
      manager.scheduleMaintenanceTask(mockHedgePosition.id, new Date());
      
      // dispose を実行
      manager.dispose();

      // リソースがクリアされていることを確認
      expect(manager['activeMaintenances'].size).toBe(0);
      expect(manager['schedules'].size).toBe(0);
      expect(manager['history'].size).toBe(0);
      expect(manager['maintenanceTimeouts'].size).toBe(0);
    });
  });
});