import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { AccountInfoReceiver, AccountInfoReceiverConfig } from '../account-info-receiver';
import { createAccountInfoMessage, AccountInfoData } from '../message-types';

describe('AccountInfoReceiver', () => {
  let receiver: AccountInfoReceiver;
  let mockConfig: AccountInfoReceiverConfig;

  beforeEach(() => {
    mockConfig = {
      enableValidation: true,
      enableMetrics: true,
      enablePersistence: false,
      maxBufferSize: 100,
      processingTimeout: 1000,
      retryAttempts: 2,
      debounceInterval: 50,
    };
    receiver = new AccountInfoReceiver(mockConfig);
  });

  afterEach(() => {
    receiver.dispose();
  });

  describe('Message Processing', () => {
    it('should process valid account info message', async () => {
      const accountData: AccountInfoData = {
        balance: 10000,
        equity: 9800,
        freeMargin: 8000,
        marginLevel: 180,
        bonusAmount: 1000,
        profit: -200,
        credit: 0,
        marginUsed: 1800,
        currency: 'USD',
      };

      const message = createAccountInfoMessage('test-account-1', accountData);
      
      const receivedPromise = new Promise((resolve) => {
        receiver.once('account_info_received', resolve);
      });

      await receiver.handleMessage(message);
      
      const result = await receivedPromise;
      expect(result).toBeDefined();
      expect((result as any).accountId).toBe('test-account-1');
      expect((result as any).data).toEqual(accountData);
    });

    it('should ignore non-account messages', async () => {
      const positionMessage = {
        version: '1.0',
        type: 'position_update',
        timestamp: Date.now(),
        messageId: 'test-msg-1',
        accountId: 'test-account-1',
        data: {
          positionId: 'pos-1',
          symbol: 'EURUSD',
          type: 'buy',
          lots: 0.1,
          openPrice: 1.1000,
          currentPrice: 1.1010,
          profit: 10,
          swapPoints: 0,
          commission: 0,
          status: 'open',
          openTime: new Date(),
        }
      };

      let eventReceived = false;
      receiver.once('account_info_received', () => {
        eventReceived = true;
      });

      await receiver.handleMessage(positionMessage);
      
      // 少し待って、イベントが発生しないことを確認
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(eventReceived).toBe(false);
    });

    it('should handle validation errors gracefully', async () => {
      const invalidMessage = {
        version: '1.0',
        type: 'account_update',
        timestamp: Date.now(),
        messageId: 'test-msg-1',
        accountId: 'test-account-1',
        data: {
          balance: 'invalid', // should be number
          equity: 9800,
        }
      };

      const errorPromise = new Promise((resolve) => {
        receiver.once('validation_error', resolve);
      });

      await receiver.handleMessage(invalidMessage);
      
      const error = await errorPromise;
      expect(error).toBeDefined();
      expect((error as any).accountId).toBe('test-account-1');
    });
  });

  describe('Duplicate Data Detection', () => {
    it('should ignore duplicate data', async () => {
      const accountData: AccountInfoData = {
        balance: 10000,
        equity: 9800,
        freeMargin: 8000,
        marginLevel: 180,
        bonusAmount: 1000,
        profit: -200,
        credit: 0,
        marginUsed: 1800,
        currency: 'USD',
      };

      const message1 = createAccountInfoMessage('test-account-1', accountData);
      const message2 = createAccountInfoMessage('test-account-1', accountData);
      
      let receivedCount = 0;
      receiver.on('account_info_received', () => {
        receivedCount++;
      });

      let duplicateIgnoredCount = 0;
      receiver.on('duplicate_data_ignored', () => {
        duplicateIgnoredCount++;
      });

      await receiver.handleMessage(message1);
      await receiver.handleMessage(message2);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(receivedCount).toBe(1);
      expect(duplicateIgnoredCount).toBe(1);
    });
  });

  describe('Critical Change Detection', () => {
    it('should detect margin level changes', async () => {
      const initialData: AccountInfoData = {
        balance: 10000,
        equity: 9800,
        freeMargin: 8000,
        marginLevel: 180,
        bonusAmount: 1000,
        profit: -200,
        credit: 0,
        marginUsed: 1800,
        currency: 'USD',
      };

      const changedData: AccountInfoData = {
        ...initialData,
        marginLevel: 120, // 60点の変化
      };

      const message1 = createAccountInfoMessage('test-account-1', initialData);
      const message2 = createAccountInfoMessage('test-account-1', changedData);
      
      const marginChangePromise = new Promise((resolve) => {
        receiver.once('margin_level_change', resolve);
      });

      await receiver.handleMessage(message1);
      await receiver.handleMessage(message2);
      
      const changeEvent = await marginChangePromise;
      expect(changeEvent).toBeDefined();
      expect((changeEvent as any).accountId).toBe('test-account-1');
      expect((changeEvent as any).previousLevel).toBe(180);
      expect((changeEvent as any).currentLevel).toBe(120);
    });

    it('should detect bonus amount changes', async () => {
      const initialData: AccountInfoData = {
        balance: 10000,
        equity: 9800,
        freeMargin: 8000,
        marginLevel: 180,
        bonusAmount: 1000,
        profit: -200,
        credit: 0,
        marginUsed: 1800,
        currency: 'USD',
      };

      const changedData: AccountInfoData = {
        ...initialData,
        bonusAmount: 1500, // ボーナス増加
      };

      const message1 = createAccountInfoMessage('test-account-1', initialData);
      const message2 = createAccountInfoMessage('test-account-1', changedData);
      
      const bonusChangePromise = new Promise((resolve) => {
        receiver.once('bonus_amount_change', resolve);
      });

      await receiver.handleMessage(message1);
      await receiver.handleMessage(message2);
      
      const changeEvent = await bonusChangePromise;
      expect(changeEvent).toBeDefined();
      expect((changeEvent as any).accountId).toBe('test-account-1');
      expect((changeEvent as any).previousAmount).toBe(1000);
      expect((changeEvent as any).currentAmount).toBe(1500);
    });

    it('should detect significant balance changes', async () => {
      const initialData: AccountInfoData = {
        balance: 10000,
        equity: 9800,
        freeMargin: 8000,
        marginLevel: 180,
        bonusAmount: 1000,
        profit: -200,
        credit: 0,
        marginUsed: 1800,
        currency: 'USD',
      };

      const changedData: AccountInfoData = {
        ...initialData,
        balance: 8500, // 15%の減少
      };

      const message1 = createAccountInfoMessage('test-account-1', initialData);
      const message2 = createAccountInfoMessage('test-account-1', changedData);
      
      const balanceChangePromise = new Promise((resolve) => {
        receiver.once('significant_balance_change', resolve);
      });

      await receiver.handleMessage(message1);
      await receiver.handleMessage(message2);
      
      const changeEvent = await balanceChangePromise;
      expect(changeEvent).toBeDefined();
      expect((changeEvent as any).accountId).toBe('test-account-1');
      expect((changeEvent as any).previousBalance).toBe(10000);
      expect((changeEvent as any).currentBalance).toBe(8500);
      expect((changeEvent as any).changePercent).toBeCloseTo(15, 1);
    });
  });

  describe('Statistics and Metrics', () => {
    it('should track processing statistics', async () => {
      const accountData: AccountInfoData = {
        balance: 10000,
        equity: 9800,
        freeMargin: 8000,
        marginLevel: 180,
        bonusAmount: 1000,
        profit: -200,
        credit: 0,
        marginUsed: 1800,
        currency: 'USD',
      };

      const message = createAccountInfoMessage('test-account-1', accountData);
      
      await receiver.handleMessage(message);
      
      const stats = receiver.getStats();
      expect(stats.totalReceived).toBe(1);
      expect(stats.successfullyProcessed).toBe(1);
      expect(stats.validationFailures).toBe(0);
      expect(stats.processingErrors).toBe(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should track validation failures', async () => {
      const invalidMessage = {
        version: '1.0',
        type: 'account_update',
        timestamp: Date.now(),
        messageId: 'test-msg-1',
        accountId: 'test-account-1',
        data: {
          balance: 'invalid',
        }
      };

      await receiver.handleMessage(invalidMessage);
      
      const stats = receiver.getStats();
      expect(stats.totalReceived).toBe(1);
      expect(stats.validationFailures).toBe(1);
      expect(stats.successfullyProcessed).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should respect validation disable setting', async () => {
      receiver.updateConfig({ enableValidation: false });

      const invalidMessage = {
        version: '1.0',
        type: 'account_update',
        timestamp: Date.now(),
        messageId: 'test-msg-1',
        accountId: 'test-account-1',
        data: {
          balance: 'invalid', // normally would fail validation
          equity: 9800,
        }
      };

      let eventReceived = false;
      receiver.once('account_info_received', () => {
        eventReceived = true;
      });

      await receiver.handleMessage(invalidMessage);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(eventReceived).toBe(true);
    });

    it('should allow stats reset', () => {
      // 統計を生成
      receiver.getStats(); // 統計を初期化

      // リセット
      receiver.resetStats();
      
      const stats = receiver.getStats();
      expect(stats.totalReceived).toBe(0);
      expect(stats.successfullyProcessed).toBe(0);
      expect(stats.validationFailures).toBe(0);
      expect(stats.processingErrors).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed messages gracefully', async () => {
      const malformedMessage = {
        // missing required fields
        type: 'account_update',
        data: { balance: 1000 }
      };

      let errorReceived = false;
      receiver.once('processing_error', () => {
        errorReceived = true;
      });

      await receiver.handleMessage(malformedMessage);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(errorReceived).toBe(true);
    });

    it('should maintain error history', async () => {
      const invalidMessage = {
        version: '1.0',
        type: 'account_update',
        timestamp: Date.now(),
        messageId: 'test-msg-1',
        accountId: 'test-account-1',
        data: {
          balance: 'invalid',
        }
      };

      await receiver.handleMessage(invalidMessage);
      
      const errors = receiver.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].accountId).toBe('test-account-1');
      expect(errors[0].error).toContain('parsing failed');
    });
  });

  describe('Debouncing', () => {
    it('should debounce rapid updates', async () => {
      const config = new AccountInfoReceiver({ debounceInterval: 100 });
      
      const accountData1: AccountInfoData = {
        balance: 10000,
        equity: 9800,
        freeMargin: 8000,
        marginLevel: 180,
        bonusAmount: 1000,
        profit: -200,
        credit: 0,
        marginUsed: 1800,
        currency: 'USD',
      };

      const accountData2: AccountInfoData = {
        ...accountData1,
        balance: 10010,
      };

      const message1 = createAccountInfoMessage('test-account-1', accountData1);
      const message2 = createAccountInfoMessage('test-account-1', accountData2);
      
      let receivedCount = 0;
      config.on('account_info_received', () => {
        receivedCount++;
      });

      // 連続で送信
      await config.handleMessage(message1);
      await config.handleMessage(message2);
      
      // デバウンス期間より少し長く待つ
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 最後のメッセージのみ処理されるべき
      expect(receivedCount).toBe(1);
      
      config.dispose();
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on dispose', () => {
      const testReceiver = new AccountInfoReceiver();
      
      // データを追加
      testReceiver.handleMessage({
        version: '1.0',
        type: 'account_update',
        timestamp: Date.now(),
        messageId: 'test-msg-1',
        accountId: 'test-account-1',
        data: {
          balance: 10000,
          equity: 9800,
          freeMargin: 8000,
          marginLevel: 180,
          bonusAmount: 1000,
          profit: -200,
          credit: 0,
          marginUsed: 1800,
          currency: 'USD',
        }
      });

      testReceiver.dispose();
      
      // dispose後のアクセスでエラーが発生しないことを確認
      expect(() => testReceiver.getStats()).not.toThrow();
      expect(() => testReceiver.getErrors()).not.toThrow();
    });
  });
});