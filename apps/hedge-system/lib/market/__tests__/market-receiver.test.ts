import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { MarketDataReceiver, PriceData, MarketDataSubscriber } from '../market-receiver';
import { createMarketDataMessage } from '../../websocket/message-types';

// Mock console to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('MarketDataReceiver', () => {
  let receiver: MarketDataReceiver;
  let mockSubscriber: MarketDataSubscriber;

  beforeEach(() => {
    receiver = new MarketDataReceiver();
    mockSubscriber = {
      onMarketDataUpdate: vi.fn(),
      onPriceUpdate: vi.fn(),
      onSpreadUpdate: vi.fn(),
      onMarketStatusUpdate: vi.fn(),
      onVolatilityUpdate: vi.fn(),
    };
  });

  describe('Market Data Processing', () => {
    it('should process valid market data message', async () => {
      const marketData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        spread: 3,
        marketStatus: 'open' as const,
        lastUpdated: new Date(),
      };

      const message = createMarketDataMessage('test-account', marketData);

      await receiver.onMarketUpdate(message);

      const currentPrice = receiver.getCurrentPrice('EURUSD');
      expect(currentPrice).toBeDefined();
      expect(currentPrice?.symbol).toBe('EURUSD');
      expect(currentPrice?.bid).toBe(1.08500);
      expect(currentPrice?.ask).toBe(1.08503);
    });

    it('should calculate price changes correctly', async () => {
      const symbol = 'GBPUSD';
      
      // First price update
      const firstData = {
        symbol,
        bid: 1.25000,
        ask: 1.25003,
        spread: 3,
        marketStatus: 'open' as const,
        lastUpdated: new Date(),
      };

      const firstMessage = createMarketDataMessage('test-account', firstData);
      await receiver.onMarketUpdate(firstMessage);

      // Second price update
      const secondData = {
        symbol,
        bid: 1.25050,
        ask: 1.25053,
        spread: 3,
        marketStatus: 'open' as const,
        lastUpdated: new Date(),
      };

      const secondMessage = createMarketDataMessage('test-account', secondData);
      await receiver.onMarketUpdate(secondMessage);

      const currentPrice = receiver.getCurrentPrice(symbol);
      expect(currentPrice?.change).toBeGreaterThan(0);
      expect(currentPrice?.changePercent).toBeGreaterThan(0);
    });

    it('should track price history', async () => {
      const symbol = 'USDJPY';
      
      // Add multiple price updates
      for (let i = 0; i < 5; i++) {
        const marketData = {
          symbol,
          bid: 150.000 + i * 0.001,
          ask: 150.003 + i * 0.001,
          spread: 3,
          marketStatus: 'open' as const,
          lastUpdated: new Date(Date.now() + i * 1000),
        };

        const message = createMarketDataMessage('test-account', marketData);
        await receiver.onMarketUpdate(message);
      }

      const history = receiver.getPriceHistory(symbol);
      expect(history).toHaveLength(5);
      expect(history[0].bid).toBe(150.000);
      expect(history[4].bid).toBe(150.004);
    });

    it('should limit history size', async () => {
      const symbol = 'AUDUSD';
      const receiver = new MarketDataReceiver();
      
      // Add more than max history size
      for (let i = 0; i < 1200; i++) {
        const marketData = {
          symbol,
          bid: 0.65000 + i * 0.00001,
          ask: 0.65003 + i * 0.00001,
          spread: 3,
          marketStatus: 'open' as const,
          lastUpdated: new Date(Date.now() + i * 1000),
        };

        const message = createMarketDataMessage('test-account', marketData);
        await receiver.onMarketUpdate(message);
      }

      const history = receiver.getPriceHistory(symbol);
      expect(history.length).toBeLessThanOrEqual(1000); // Should be limited
    });
  });

  describe('Subscription Management', () => {
    it('should manage subscribers correctly', async () => {
      receiver.subscribe(mockSubscriber);

      const marketData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        spread: 3,
        marketStatus: 'open' as const,
        lastUpdated: new Date(),
      };

      const message = createMarketDataMessage('test-account', marketData);
      await receiver.onMarketUpdate(message);

      expect(mockSubscriber.onMarketDataUpdate).toHaveBeenCalledWith('EURUSD', marketData);
      expect(mockSubscriber.onPriceUpdate).toHaveBeenCalled();
    });

    it('should handle subscriber errors gracefully', async () => {
      const faultySubscriber: MarketDataSubscriber = {
        onMarketDataUpdate: vi.fn().mockImplementation(() => {
          throw new Error('Subscriber error');
        }),
      };

      receiver.subscribe(faultySubscriber);

      const marketData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        spread: 3,
        marketStatus: 'open' as const,
        lastUpdated: new Date(),
      };

      const message = createMarketDataMessage('test-account', marketData);
      
      // Should not throw error
      await expect(receiver.onMarketUpdate(message)).resolves.not.toThrow();
    });

    it('should unsubscribe correctly', async () => {
      receiver.subscribe(mockSubscriber);
      receiver.unsubscribe(mockSubscriber);

      const marketData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        spread: 3,
        marketStatus: 'open' as const,
        lastUpdated: new Date(),
      };

      const message = createMarketDataMessage('test-account', marketData);
      await receiver.onMarketUpdate(message);

      expect(mockSubscriber.onMarketDataUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Spread Calculation', () => {
    it('should calculate spread data correctly', async () => {
      const symbol = 'EURUSD';
      
      // Add first price
      const firstData = {
        symbol,
        bid: 1.08500,
        ask: 1.08505,
        spread: 5,
        marketStatus: 'open' as const,
        lastUpdated: new Date(),
      };

      const firstMessage = createMarketDataMessage('test-account', firstData);
      await receiver.onMarketUpdate(firstMessage);

      // Add second price with wider spread
      const secondData = {
        symbol,
        bid: 1.08500,
        ask: 1.08508,
        spread: 8,
        marketStatus: 'open' as const,
        lastUpdated: new Date(),
      };

      const secondMessage = createMarketDataMessage('test-account', secondData);
      await receiver.onMarketUpdate(secondMessage);

      const currentSpread = receiver.getCurrentSpread(symbol);
      expect(currentSpread?.spread).toBe(8);
      expect(currentSpread?.isWidening).toBe(true);
    });
  });

  describe('Volatility Calculation', () => {
    it('should calculate volatility when sufficient data is available', async () => {
      const symbol = 'GBPUSD';
      
      // Add enough price points for volatility calculation
      for (let i = 0; i < 25; i++) {
        const volatility = Math.sin(i * 0.1) * 0.001; // Simulate price movement
        const marketData = {
          symbol,
          bid: 1.25000 + volatility,
          ask: 1.25003 + volatility,
          spread: 3,
          marketStatus: 'open' as const,
          lastUpdated: new Date(Date.now() + i * 1000),
        };

        const message = createMarketDataMessage('test-account', marketData);
        await receiver.onMarketUpdate(message);
      }

      const volatilityData = receiver.getCurrentVolatility(symbol);
      expect(volatilityData).toBeDefined();
      expect(volatilityData?.currentVolatility).toBeGreaterThan(0);
    });

    it('should return null for volatility with insufficient data', async () => {
      const symbol = 'USDCAD';
      
      // Add only a few price points
      for (let i = 0; i < 5; i++) {
        const marketData = {
          symbol,
          bid: 1.35000 + i * 0.001,
          ask: 1.35003 + i * 0.001,
          spread: 3,
          marketStatus: 'open' as const,
          lastUpdated: new Date(Date.now() + i * 1000),
        };

        const message = createMarketDataMessage('test-account', marketData);
        await receiver.onMarketUpdate(message);
      }

      const volatilityData = receiver.getCurrentVolatility(symbol);
      expect(volatilityData).toBeNull();
    });
  });

  describe('Market Status', () => {
    it('should track market status correctly', async () => {
      const symbol = 'NZDUSD';
      
      const marketData = {
        symbol,
        bid: 0.60000,
        ask: 0.60003,
        spread: 3,
        marketStatus: 'closed' as const,
        lastUpdated: new Date(),
      };

      const message = createMarketDataMessage('test-account', marketData);
      await receiver.onMarketUpdate(message);

      const status = receiver.getMarketStatus(symbol);
      expect(status?.isOpen).toBe(false);
      expect(status?.sessionType).toBe('closed');
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      // Add data for multiple symbols
      const symbols = ['EURUSD', 'GBPUSD', 'USDJPY'];
      
      for (const symbol of symbols) {
        for (let i = 0; i < 10; i++) {
          const marketData = {
            symbol,
            bid: 1.00000 + i * 0.001,
            ask: 1.00003 + i * 0.001,
            spread: 3,
            marketStatus: 'open' as const,
            lastUpdated: new Date(Date.now() + i * 1000),
          };

          const message = createMarketDataMessage('test-account', marketData);
          await receiver.onMarketUpdate(message);
        }
      }

      const stats = receiver.getStats();
      expect(stats.totalSymbols).toBe(3);
      expect(stats.totalPricePoints).toBe(30);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid market data gracefully', async () => {
      const invalidMessage = {
        version: '1.0',
        type: 'market_data' as const,
        timestamp: Date.now(),
        messageId: 'test-msg',
        accountId: 'test-account',
        data: null, // Invalid data
      };

      // Should not throw error
      await expect(receiver.onMarketUpdate(invalidMessage as any)).rejects.toThrow();
    });

    it('should handle non-market-data messages', async () => {
      const nonMarketMessage = {
        version: '1.0',
        type: 'heartbeat' as const,
        timestamp: Date.now(),
        messageId: 'test-msg',
        accountId: 'test-account',
        data: { status: 'ok' },
      };

      // Should log warning and return early
      await receiver.onMarketUpdate(nonMarketMessage as any);
      
      // No price data should be stored
      const price = receiver.getCurrentPrice('EURUSD');
      expect(price).toBeNull();
    });
  });

  describe('Data Cleanup', () => {
    it('should clean up old data', () => {
      const symbol = 'EURUSD';
      
      // Mock old timestamp (25 hours ago)
      const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000);
      
      // Directly add old data to test cleanup
      const receiver = new MarketDataReceiver();
      const oldPriceData: PriceData = {
        symbol,
        bid: 1.08500,
        ask: 1.08503,
        timestamp: oldTimestamp,
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      // Access private method for testing (not ideal but necessary for testing)
      (receiver as any).addPriceHistory(symbol, oldPriceData);
      
      // Trigger cleanup
      (receiver as any).cleanupOldData();
      
      const history = receiver.getPriceHistory(symbol);
      expect(history).toHaveLength(0); // Old data should be cleaned up
    });
  });
});