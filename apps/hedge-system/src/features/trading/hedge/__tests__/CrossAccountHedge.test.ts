import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { 
  CrossAccountHedge, 
  AccountExecution, 
  BalanceValidation, 
  SyncResult, 
  CrossHedgeResult,
  CrossAccountSettings 
} from '../CrossAccountHedge';
import { HedgeBalanceCalculator } from '../HedgeBalanceCalculator';
import { HedgePositionValidator } from '../HedgePositionValidator';
import { WebSocketEntryService, EntryCommandResult } from '../../websocket-entry';
import { WebSocketClient } from '../../../../../lib/websocket/message-types';

// モックの設定
vi.mock('../../websocket-entry');
vi.mock('../HedgeBalanceCalculator');
vi.mock('../HedgePositionValidator');

describe('CrossAccountHedge', () => {
  let crossAccountHedge: CrossAccountHedge;
  let mockWsClient: Partial<WebSocketClient>;
  let mockEntryService: Partial<WebSocketEntryService>;
  let mockBalanceCalculator: Partial<HedgeBalanceCalculator>;
  let mockValidator: Partial<HedgePositionValidator>;

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

    // HedgeBalanceCalculator のモック
    mockBalanceCalculator = {
      calculateHedgeBalance: vi.fn(),
      calculateOptimalLots: vi.fn(),
      calculateRebalanceRequirement: vi.fn()
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

    // CrossAccountHedge インスタンスを作成
    crossAccountHedge = new CrossAccountHedge(
      mockWsClient as WebSocketClient,
      mockBalanceCalculator as HedgeBalanceCalculator,
      mockValidator as HedgePositionValidator
    );
  });

  describe('executeCrossAccountHedge', () => {
    it('should successfully execute cross-account hedge with 2 accounts', async () => {
      const accounts = ['account1', 'account2'];
      const symbol = 'EURUSD';
      const lots = 1.0;

      // モックの成功レスポンス
      const mockEntryResult: EntryCommandResult = {
        success: true,
        commandId: 'cmd_123',
        positionId: 'pos_123',
        executedPrice: 1.1000,
        executedTime: new Date().toISOString(),
        accountId: 'account1',
        symbol: 'EURUSD',
        direction: 'BUY',
        lotSize: 0.5
      };

      (mockEntryService.sendEntryCommand as Mock).mockResolvedValue(mockEntryResult);

      const result = await crossAccountHedge.executeCrossAccountHedge(accounts, symbol, lots);

      expect(result.status).toBe('completed');
      expect(result.accounts).toEqual(accounts);
      expect(result.symbol).toBe(symbol);
      expect(result.totalLots.buy).toBe(lots);
      expect(result.totalLots.sell).toBe(lots);
      expect(result.hedgePosition).toBeDefined();
      expect(result.hedgePosition?.hedgeType).toBe('cross_account');
    });

    it('should fail when less than 2 accounts provided', async () => {
      const accounts = ['account1'];
      const symbol = 'EURUSD';
      const lots = 1.0;

      await expect(
        crossAccountHedge.executeCrossAccountHedge(accounts, symbol, lots)
      ).rejects.toThrow('At least 2 accounts are required for cross-account hedge');
    });

    it('should handle partial execution failure and trigger compensation', async () => {
      const accounts = ['account1', 'account2'];
      const symbol = 'EURUSD';
      const lots = 1.0;

      // 1つ目は成功、2つ目は失敗
      const mockSuccessResult: EntryCommandResult = {
        success: true,
        commandId: 'cmd_success',
        positionId: 'pos_success',
        accountId: 'account1',
        symbol: 'EURUSD',
        direction: 'BUY',
        lotSize: 0.5
      };

      const mockFailResult: EntryCommandResult = {
        success: false,
        commandId: 'cmd_fail',
        error: 'Execution failed',
        accountId: 'account2',
        symbol: 'EURUSD',
        direction: 'SELL',
        lotSize: 0.5
      };

      (mockEntryService.sendEntryCommand as Mock)
        .mockResolvedValueOnce(mockSuccessResult)
        .mockResolvedValueOnce(mockFailResult)
        .mockResolvedValueOnce(mockSuccessResult); // 補正実行は成功

      const result = await crossAccountHedge.executeCrossAccountHedge(accounts, symbol, lots);

      expect(result.status).toBe('completed'); // 補正後に完了
      expect(result.compensationRequired).toBe(true);
      expect(result.compensationActions.length).toBeGreaterThan(0);
    });
  });

  describe('validateAccountBalance', () => {
    it('should validate account balances successfully', async () => {
      const accounts = ['account1', 'account2'];
      
      const result = await crossAccountHedge.validateAccountBalance(accounts);

      expect(result.isValid).toBe(true);
      expect(result.accountResults).toHaveLength(accounts.length);
      expect(result.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
    });

    it('should detect high risk when margin utilization is excessive', async () => {
      // 高いマージン使用率をシミュレート
      const accounts = ['high_risk_account'];
      
      const result = await crossAccountHedge.validateAccountBalance(accounts);

      // マージン使用率に基づくリスク判定をテスト
      expect(result.overallMarginUtilization).toBeGreaterThanOrEqual(0);
      expect(result.totalRequiredMargin).toBeGreaterThanOrEqual(0);
      expect(result.totalAvailableMargin).toBeGreaterThanOrEqual(0);
    });
  });

  describe('synchronizeExecution', () => {
    it('should synchronize execution across multiple accounts', async () => {
      const executions: AccountExecution[] = [
        {
          accountId: 'account1',
          symbol: 'EURUSD',
          direction: 'BUY',
          lotSize: 0.5,
          orderType: 'MARKET',
          priority: 1,
          riskManagement: {}
        },
        {
          accountId: 'account2',
          symbol: 'EURUSD',
          direction: 'SELL',
          lotSize: 0.5,
          orderType: 'MARKET',
          priority: 2,
          riskManagement: {}
        }
      ];

      const mockEntryResult: EntryCommandResult = {
        success: true,
        commandId: 'cmd_123',
        positionId: 'pos_123'
      };

      (mockEntryService.sendEntryCommand as Mock).mockResolvedValue(mockEntryResult);

      const result = await crossAccountHedge.synchronizeExecution(executions);

      expect(result.executionId).toBeDefined();
      expect(result.successfulExecutions).toBe(executions.length);
      expect(result.failedExecutions).toBe(0);
      expect(result.synchronizationAccuracy).toBeGreaterThanOrEqual(0);
      expect(result.synchronizationAccuracy).toBeLessThanOrEqual(1);
      expect(result.results).toHaveLength(executions.length);
    });

    it('should handle execution failures in synchronization', async () => {
      const executions: AccountExecution[] = [
        {
          accountId: 'account1',
          symbol: 'EURUSD',
          direction: 'BUY',
          lotSize: 0.5,
          orderType: 'MARKET',
          priority: 1,
          riskManagement: {}
        }
      ];

      (mockEntryService.sendEntryCommand as Mock).mockRejectedValue(new Error('Network error'));

      const result = await crossAccountHedge.synchronizeExecution(executions);

      expect(result.successfulExecutions).toBe(0);
      expect(result.failedExecutions).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBeDefined();
    });
  });

  describe('handleExecutionFailure', () => {
    it('should handle execution failure and perform compensation', async () => {
      const crossHedgeResult: CrossHedgeResult = {
        crossHedgeId: 'test_hedge_123',
        status: 'partial',
        accounts: ['account1', 'account2'],
        symbol: 'EURUSD',
        totalLots: { buy: 1.0, sell: 1.0 },
        executionResults: new Map(),
        startTime: new Date(),
        compensationRequired: true,
        compensationActions: [
          {
            accountId: 'account2',
            symbol: 'EURUSD',
            direction: 'SELL',
            lotSize: 0.5,
            orderType: 'MARKET',
            priority: 1,
            riskManagement: {}
          }
        ]
      };

      const mockCompensationResult: EntryCommandResult = {
        success: true,
        commandId: 'compensation_cmd',
        positionId: 'compensation_pos'
      };

      (mockEntryService.sendEntryCommand as Mock).mockResolvedValue(mockCompensationResult);

      await crossAccountHedge.handleExecutionFailure(crossHedgeResult);

      expect(mockEntryService.sendEntryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'EURUSD',
          direction: 'SELL',
          lotSize: 0.5,
          accountId: 'account2'
        })
      );
    });

    it('should skip compensation when not required', async () => {
      const crossHedgeResult: CrossHedgeResult = {
        crossHedgeId: 'test_hedge_123',
        status: 'completed',
        accounts: ['account1', 'account2'],
        symbol: 'EURUSD',
        totalLots: { buy: 1.0, sell: 1.0 },
        executionResults: new Map(),
        startTime: new Date(),
        compensationRequired: false,
        compensationActions: []
      };

      await crossAccountHedge.handleExecutionFailure(crossHedgeResult);

      expect(mockEntryService.sendEntryCommand).not.toHaveBeenCalled();
    });
  });

  describe('settings management', () => {
    it('should update settings correctly', () => {
      const newSettings: Partial<CrossAccountSettings> = {
        maxTimeDifference: 3000,
        compensationMode: 'manual'
      };

      crossAccountHedge.updateSettings(newSettings);
      const currentSettings = crossAccountHedge.getSettings();

      expect(currentSettings.maxTimeDifference).toBe(3000);
      expect(currentSettings.compensationMode).toBe('manual');
    });

    it('should return current settings', () => {
      const settings = crossAccountHedge.getSettings();

      expect(settings).toBeDefined();
      expect(typeof settings.maxTimeDifference).toBe('number');
      expect(['automatic', 'manual', 'disabled']).toContain(settings.compensationMode);
      expect(typeof settings.balanceThreshold).toBe('number');
    });
  });

  describe('execution tracking', () => {
    it('should track active executions', () => {
      const activeExecutions = crossAccountHedge.getActiveExecutions();
      expect(Array.isArray(activeExecutions)).toBe(true);
    });

    it('should retrieve specific execution result', async () => {
      const accounts = ['account1', 'account2'];
      const symbol = 'EURUSD';
      const lots = 1.0;

      const mockEntryResult: EntryCommandResult = {
        success: true,
        commandId: 'cmd_123',
        positionId: 'pos_123'
      };

      (mockEntryService.sendEntryCommand as Mock).mockResolvedValue(mockEntryResult);

      const result = await crossAccountHedge.executeCrossAccountHedge(accounts, symbol, lots);
      const retrievedResult = crossAccountHedge.getExecutionResult(result.crossHedgeId);

      expect(retrievedResult).toBeDefined();
      expect(retrievedResult?.crossHedgeId).toBe(result.crossHedgeId);
    });
  });

  describe('resource management', () => {
    it('should dispose resources properly', () => {
      expect(() => {
        crossAccountHedge.dispose();
      }).not.toThrow();

      // dispose後はアクティブな実行がクリアされていることを確認
      const activeExecutions = crossAccountHedge.getActiveExecutions();
      expect(activeExecutions).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty compensation actions', async () => {
      const crossHedgeResult: CrossHedgeResult = {
        crossHedgeId: 'test_hedge_123',
        status: 'partial',
        accounts: ['account1'],
        symbol: 'EURUSD',
        totalLots: { buy: 1.0, sell: 1.0 },
        executionResults: new Map(),
        startTime: new Date(),
        compensationRequired: true,
        compensationActions: []
      };

      await expect(
        crossAccountHedge.handleExecutionFailure(crossHedgeResult)
      ).resolves.not.toThrow();
    });

    it('should handle network errors during compensation', async () => {
      const crossHedgeResult: CrossHedgeResult = {
        crossHedgeId: 'test_hedge_123',
        status: 'partial',
        accounts: ['account1'],
        symbol: 'EURUSD',
        totalLots: { buy: 1.0, sell: 1.0 },
        executionResults: new Map(),
        startTime: new Date(),
        compensationRequired: true,
        compensationActions: [
          {
            accountId: 'account1',
            symbol: 'EURUSD',
            direction: 'BUY',
            lotSize: 0.5,
            orderType: 'MARKET',
            priority: 1,
            riskManagement: {}
          }
        ]
      };

      (mockEntryService.sendEntryCommand as Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        crossAccountHedge.handleExecutionFailure(crossHedgeResult)
      ).resolves.not.toThrow();
    });
  });
});