import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  MarketDataDistributor, 
  EnhancedMarketDataSubscriber, 
  SubscriptionType 
} from '../market-data-distributor';
import { PriceData } from '../market-receiver';
import { PriceAlert } from '../price-analyzer';

// Mock console to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('MarketDataDistributor', () => {
  let distributor: MarketDataDistributor;
  let mockSubscriber: EnhancedMarketDataSubscriber;

  beforeEach(() => {
    distributor = new MarketDataDistributor();
    mockSubscriber = {
      subscriberId: 'test-subscriber-1',
      subscriptionTypes: ['price_update', 'price_alert'],
      config: { symbol: 'EURUSD' },
      onMarketDataUpdate: vi.fn(),
      onPriceUpdate: vi.fn(),
      onPriceAlert: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Subscription Management', () => {
    it('should subscribe and index subscriber correctly', () => {
      distributor.subscribe(mockSubscriber);

      const subscriberInfo = distributor.getSubscriberInfo();
      expect(subscriberInfo).toHaveLength(1);
      expect(subscriberInfo[0].id).toBe('test-subscriber-1');
      expect(subscriberInfo[0].types).toEqual(['price_update', 'price_alert']);
      expect(subscriberInfo[0].symbol).toBe('EURUSD');
    });

    it('should unsubscribe correctly', () => {
      distributor.subscribe(mockSubscriber);
      distributor.unsubscribe('test-subscriber-1');

      const subscriberInfo = distributor.getSubscriberInfo();
      expect(subscriberInfo).toHaveLength(0);
    });

    it('should handle unsubscribing non-existent subscriber', () => {
      expect(() => {
        distributor.unsubscribe('non-existent');
      }).not.toThrow();
    });

    it('should support multiple subscribers', () => {
      const subscriber2: EnhancedMarketDataSubscriber = {
        subscriberId: 'test-subscriber-2',
        subscriptionTypes: ['market_status'],
        config: { symbol: 'GBPUSD' },
        onMarketDataUpdate: vi.fn(),
        onMarketStatusUpdate: vi.fn(),
      };

      distributor.subscribe(mockSubscriber);
      distributor.subscribe(subscriber2);

      const subscriberInfo = distributor.getSubscriberInfo();
      expect(subscriberInfo).toHaveLength(2);
    });
  });

  describe('Data Distribution', () => {
    it('should distribute price updates to relevant subscribers', () => {
      distributor.subscribe(mockSubscriber);

      const priceData: PriceData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        timestamp: new Date(),
        spread: 3,
        change: 0.001,
        changePercent: 0.09,
      };

      distributor.distribute('EURUSD', 'price_update', priceData);

      expect(mockSubscriber.onPriceUpdate).toHaveBeenCalledWith('EURUSD', priceData);
    });

    it('should not distribute to wrong symbol subscribers', () => {
      distributor.subscribe(mockSubscriber);

      const priceData: PriceData = {
        symbol: 'GBPUSD',
        bid: 1.25000,
        ask: 1.25003,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      distributor.distribute('GBPUSD', 'price_update', priceData);

      expect(mockSubscriber.onPriceUpdate).not.toHaveBeenCalled();
    });

    it('should distribute to global subscribers (no specific symbol)', () => {
      const globalSubscriber: EnhancedMarketDataSubscriber = {
        subscriberId: 'global-subscriber',
        subscriptionTypes: ['price_update'],
        config: {}, // No specific symbol
        onMarketDataUpdate: vi.fn(),
        onPriceUpdate: vi.fn(),
      };

      distributor.subscribe(globalSubscriber);

      const priceData: PriceData = {
        symbol: 'USDJPY',
        bid: 150.000,
        ask: 150.003,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      distributor.distribute('USDJPY', 'price_update', priceData);

      expect(globalSubscriber.onPriceUpdate).toHaveBeenCalledWith('USDJPY', priceData);
    });

    it('should handle subscriber errors gracefully', () => {
      const faultySubscriber: EnhancedMarketDataSubscriber = {
        subscriberId: 'faulty-subscriber',
        subscriptionTypes: ['price_update'],
        config: { symbol: 'EURUSD' },
        onMarketDataUpdate: vi.fn(),
        onPriceUpdate: vi.fn().mockImplementation(() => {
          throw new Error('Subscriber error');
        }),
      };

      distributor.subscribe(faultySubscriber);

      const priceData: PriceData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      // Should not throw
      expect(() => {
        distributor.distribute('EURUSD', 'price_update', priceData);
      }).not.toThrow();

      const metrics = distributor.getMetrics();
      expect(metrics.errorCount).toBe(1);
    });
  });

  describe('Update Frequency Throttling', () => {
    it('should throttle high-frequency updates', () => {
      const throttledSubscriber: EnhancedMarketDataSubscriber = {
        subscriberId: 'throttled-subscriber',
        subscriptionTypes: ['price_update'],
        config: { 
          symbol: 'EURUSD',
          updateFrequency: 1000, // 1 second minimum
        },
        onMarketDataUpdate: vi.fn(),
        onPriceUpdate: vi.fn(),
      };

      distributor.subscribe(throttledSubscriber);

      const priceData: PriceData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      // First update should go through
      distributor.distribute('EURUSD', 'price_update', priceData);
      expect(throttledSubscriber.onPriceUpdate).toHaveBeenCalledTimes(1);

      // Second update immediately should be throttled
      distributor.distribute('EURUSD', 'price_update', priceData);
      expect(throttledSubscriber.onPriceUpdate).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('Data Filtering', () => {
    it('should apply data filter', () => {
      const filteredSubscriber: EnhancedMarketDataSubscriber = {
        subscriberId: 'filtered-subscriber',
        subscriptionTypes: ['price_update'],
        config: { 
          symbol: 'EURUSD',
          dataFilter: (data: PriceData) => data.bid > 1.08000, // Only high prices
        },
        onMarketDataUpdate: vi.fn(),
        onPriceUpdate: vi.fn(),
      };

      distributor.subscribe(filteredSubscriber);

      // Low price - should be filtered out
      const lowPriceData: PriceData = {
        symbol: 'EURUSD',
        bid: 1.07500,
        ask: 1.07503,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      distributor.distribute('EURUSD', 'price_update', lowPriceData);
      expect(filteredSubscriber.onPriceUpdate).not.toHaveBeenCalled();

      // High price - should pass through
      const highPriceData: PriceData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      distributor.distribute('EURUSD', 'price_update', highPriceData);
      expect(filteredSubscriber.onPriceUpdate).toHaveBeenCalledWith('EURUSD', highPriceData);
    });
  });

  describe('Batch Updates', () => {
    it('should batch updates when configured', (done) => {
      const batchSubscriber: EnhancedMarketDataSubscriber = {
        subscriberId: 'batch-subscriber',
        subscriptionTypes: ['price_update'],
        config: { 
          symbol: 'EURUSD',
          batchUpdates: true,
          maxBatchSize: 3,
          batchTimeout: 100,
        },
        onMarketDataUpdate: vi.fn(),
        onPriceUpdate: vi.fn(),
      };

      distributor.subscribe(batchSubscriber);

      // Send multiple updates quickly
      for (let i = 0; i < 3; i++) {
        const priceData: PriceData = {
          symbol: 'EURUSD',
          bid: 1.08500 + i * 0.001,
          ask: 1.08503 + i * 0.001,
          timestamp: new Date(),
          spread: 3,
          change: 0,
          changePercent: 0,
        };

        distributor.distribute('EURUSD', 'price_update', priceData);
      }

      // Should be called once with batch
      setTimeout(() => {
        expect(batchSubscriber.onPriceUpdate).toHaveBeenCalledTimes(1);
        expect(batchSubscriber.onPriceUpdate).toHaveBeenCalledWith('EURUSD', expect.any(Array));
        done();
      }, 150);
    });

    it('should flush batches on timeout', (done) => {
      const batchSubscriber: EnhancedMarketDataSubscriber = {
        subscriberId: 'timeout-batch-subscriber',
        subscriptionTypes: ['price_update'],
        config: { 
          symbol: 'EURUSD',
          batchUpdates: true,
          maxBatchSize: 10,
          batchTimeout: 100,
        },
        onMarketDataUpdate: vi.fn(),
        onPriceUpdate: vi.fn(),
      };

      distributor.subscribe(batchSubscriber);

      // Send only one update
      const priceData: PriceData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      distributor.distribute('EURUSD', 'price_update', priceData);

      // Should be delivered after timeout
      setTimeout(() => {
        expect(batchSubscriber.onPriceUpdate).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });
  });

  describe('Alert Broadcasting', () => {
    it('should broadcast price alerts', () => {
      distributor.subscribe(mockSubscriber);

      const alert: PriceAlert = {
        id: 'alert-1',
        type: 'resistance',
        symbol: 'EURUSD',
        price: 1.08500,
        severity: 'warning',
        message: 'Price approaching resistance level',
        timestamp: new Date(),
      };

      distributor.broadcastAlert('EURUSD', alert);

      expect(mockSubscriber.onPriceAlert).toHaveBeenCalledWith('EURUSD', alert);
    });
  });

  describe('Metrics and Statistics', () => {
    it('should track distribution metrics', () => {
      distributor.subscribe(mockSubscriber);

      const priceData: PriceData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      distributor.distribute('EURUSD', 'price_update', priceData);

      const metrics = distributor.getMetrics();
      expect(metrics.totalUpdates).toBe(1);
      expect(metrics.updatesByType.price_update).toBe(1);
      expect(metrics.updatesBySymbol.EURUSD).toBe(1);
      expect(metrics.activeSubscribers).toBe(1);
    });

    it('should provide detailed statistics', () => {
      distributor.subscribe(mockSubscriber);

      const stats = distributor.getDetailedStats();
      expect(stats.subscribers).toBe(1);
      expect(stats.subscriptionsByType.price_update).toBe(1);
      expect(stats.subscriptionsByType.price_alert).toBe(1);
    });
  });

  describe('Subscription Types', () => {
    it('should handle different subscription types correctly', () => {
      const multiTypeSubscriber: EnhancedMarketDataSubscriber = {
        subscriberId: 'multi-type-subscriber',
        subscriptionTypes: ['price_update', 'spread_update', 'market_status'],
        config: { symbol: 'EURUSD' },
        onMarketDataUpdate: vi.fn(),
        onPriceUpdate: vi.fn(),
        onSpreadUpdate: vi.fn(),
        onMarketStatusUpdate: vi.fn(),
      };

      distributor.subscribe(multiTypeSubscriber);

      // Test price update
      const priceData: PriceData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      distributor.distribute('EURUSD', 'price_update', priceData);
      expect(multiTypeSubscriber.onPriceUpdate).toHaveBeenCalled();

      // Test type not subscribed to
      distributor.distribute('EURUSD', 'volatility_update' as SubscriptionType, {});
      expect(multiTypeSubscriber.onVolatilityUpdate).toBeUndefined();
    });
  });

  describe('Memory Management', () => {
    it('should clean up subscriber data on unsubscribe', () => {
      const subscriber1: EnhancedMarketDataSubscriber = {
        subscriberId: 'subscriber-1',
        subscriptionTypes: ['price_update'],
        config: { 
          symbol: 'EURUSD',
          batchUpdates: true,
        },
        onMarketDataUpdate: vi.fn(),
        onPriceUpdate: vi.fn(),
      };

      distributor.subscribe(subscriber1);

      // Add some data to batch queue
      const priceData: PriceData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      distributor.distribute('EURUSD', 'price_update', priceData);

      // Unsubscribe should clean up batch queue
      distributor.unsubscribe('subscriber-1');

      const stats = distributor.getDetailedStats();
      expect(stats.pendingBatches).toBe(0);
      expect(stats.totalBatchItems).toBe(0);
    });
  });

  describe('Batch Management', () => {
    it('should force flush all batches', () => {
      const batchSubscriber: EnhancedMarketDataSubscriber = {
        subscriberId: 'flush-test-subscriber',
        subscriptionTypes: ['price_update'],
        config: { 
          symbol: 'EURUSD',
          batchUpdates: true,
          maxBatchSize: 10,
          batchTimeout: 10000, // Long timeout
        },
        onMarketDataUpdate: vi.fn(),
        onPriceUpdate: vi.fn(),
      };

      distributor.subscribe(batchSubscriber);

      // Add to batch
      const priceData: PriceData = {
        symbol: 'EURUSD',
        bid: 1.08500,
        ask: 1.08503,
        timestamp: new Date(),
        spread: 3,
        change: 0,
        changePercent: 0,
      };

      distributor.distribute('EURUSD', 'price_update', priceData);

      // Force flush
      distributor.flushAllBatches();

      expect(batchSubscriber.onPriceUpdate).toHaveBeenCalled();
    });
  });
});