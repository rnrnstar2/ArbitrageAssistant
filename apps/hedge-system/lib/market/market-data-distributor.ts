import { MarketDataSubscriber, PriceData, SpreadData, MarketStatus, VolatilityData } from './market-receiver';
import { PriceAlert, TrendInfo, PricePattern, SupportResistanceLevel, MovingAverageData } from './price-analyzer';
import { MarketData } from '../websocket/message-types';

// Enhanced subscription types
export type SubscriptionType = 
  | 'market_data'
  | 'price_update'
  | 'spread_update'
  | 'market_status'
  | 'volatility_update'
  | 'price_alert'
  | 'trend_update'
  | 'pattern_detection'
  | 'support_resistance'
  | 'moving_average';

// Subscription configuration
export interface SubscriptionConfig {
  symbol?: string; // If undefined, subscribes to all symbols
  updateFrequency?: number; // Minimum milliseconds between updates
  dataFilter?: (data: any) => boolean; // Optional data filter
  priority?: 'low' | 'normal' | 'high'; // Subscription priority
  batchUpdates?: boolean; // Whether to batch multiple updates
  maxBatchSize?: number; // Maximum batch size
  batchTimeout?: number; // Maximum time to wait for batch completion (ms)
}

// Enhanced subscriber interface
export interface EnhancedMarketDataSubscriber extends MarketDataSubscriber {
  subscriberId: string;
  subscriptionTypes: SubscriptionType[];
  config: SubscriptionConfig;
  lastUpdate?: Date;
  updateCount?: number;
  
  // Additional callbacks for enhanced data
  onPriceAlert?(symbol: string, alert: PriceAlert): void;
  onTrendUpdate?(symbol: string, trend: TrendInfo): void;
  onPatternDetection?(symbol: string, pattern: PricePattern): void;
  onSupportResistanceUpdate?(symbol: string, levels: SupportResistanceLevel[]): void;
  onMovingAverageUpdate?(symbol: string, averages: MovingAverageData[]): void;
}

// Batch update data structure
interface BatchUpdate {
  symbol: string;
  type: SubscriptionType;
  data: any;
  timestamp: Date;
}

// Distribution metrics
interface DistributionMetrics {
  totalUpdates: number;
  updatesByType: Record<SubscriptionType, number>;
  updatesBySymbol: Record<string, number>;
  averageLatency: number;
  errorCount: number;
  activeSubscribers: number;
}

// Market data distributor interface
export interface IMarketDataDistributor {
  subscribe(subscriber: EnhancedMarketDataSubscriber): void;
  unsubscribe(subscriberId: string): void;
  distribute(symbol: string, type: SubscriptionType, data: any): void;
  updatePriceDisplays(symbol: string, priceData: PriceData): void;
  updateChartData(symbol: string, priceData: PriceData): void;
  updateMarketSummary(marketStatuses: MarketStatus[]): void;
  getMetrics(): DistributionMetrics;
}

// Market data distributor implementation
export class MarketDataDistributor implements IMarketDataDistributor {
  private subscribers: Map<string, EnhancedMarketDataSubscriber> = new Map();
  private subscriptionsByType: Map<SubscriptionType, Set<string>> = new Map();
  private subscriptionsBySymbol: Map<string, Set<string>> = new Map();
  private batchQueues: Map<string, BatchUpdate[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private metrics: DistributionMetrics;
  
  private readonly defaultConfig: Required<SubscriptionConfig> = {
    symbol: undefined,
    updateFrequency: 0,
    dataFilter: () => true,
    priority: 'normal',
    batchUpdates: false,
    maxBatchSize: 10,
    batchTimeout: 100,
  };

  constructor() {
    this.initializeMetrics();
    this.startMetricsCollection();
  }

  /**
   * Subscribe to market data updates
   */
  public subscribe(subscriber: EnhancedMarketDataSubscriber): void {
    const config = { ...this.defaultConfig, ...subscriber.config };
    const enhancedSubscriber = {
      ...subscriber,
      config,
      lastUpdate: undefined,
      updateCount: 0,
    };

    this.subscribers.set(subscriber.subscriberId, enhancedSubscriber);

    // Index by subscription types
    for (const type of subscriber.subscriptionTypes) {
      if (!this.subscriptionsByType.has(type)) {
        this.subscriptionsByType.set(type, new Set());
      }
      this.subscriptionsByType.get(type)!.add(subscriber.subscriberId);
    }

    // Index by symbol if specified
    if (config.symbol) {
      if (!this.subscriptionsBySymbol.has(config.symbol)) {
        this.subscriptionsBySymbol.set(config.symbol, new Set());
      }
      this.subscriptionsBySymbol.get(config.symbol)!.add(subscriber.subscriberId);
    }

    console.log(`Subscriber ${subscriber.subscriberId} registered for types: ${subscriber.subscriptionTypes.join(', ')}`);
  }

  /**
   * Unsubscribe from market data updates
   */
  public unsubscribe(subscriberId: string): void {
    const subscriber = this.subscribers.get(subscriberId);
    if (!subscriber) {
      console.warn(`Subscriber ${subscriberId} not found`);
      return;
    }

    // Remove from type indexes
    for (const type of subscriber.subscriptionTypes) {
      const typeSubscribers = this.subscriptionsByType.get(type);
      if (typeSubscribers) {
        typeSubscribers.delete(subscriberId);
        if (typeSubscribers.size === 0) {
          this.subscriptionsByType.delete(type);
        }
      }
    }

    // Remove from symbol indexes
    if (subscriber.config.symbol) {
      const symbolSubscribers = this.subscriptionsBySymbol.get(subscriber.config.symbol);
      if (symbolSubscribers) {
        symbolSubscribers.delete(subscriberId);
        if (symbolSubscribers.size === 0) {
          this.subscriptionsBySymbol.delete(subscriber.config.symbol);
        }
      }
    }

    // Clean up batch queue
    const batchTimer = this.batchTimers.get(subscriberId);
    if (batchTimer) {
      clearTimeout(batchTimer);
      this.batchTimers.delete(subscriberId);
    }
    this.batchQueues.delete(subscriberId);

    this.subscribers.delete(subscriberId);
    console.log(`Subscriber ${subscriberId} unsubscribed`);
  }

  /**
   * Distribute data to subscribers
   */
  public distribute(symbol: string, type: SubscriptionType, data: any): void {
    const startTime = Date.now();
    let updateCount = 0;

    try {
      // Get subscribers for this type
      const typeSubscribers = this.subscriptionsByType.get(type) || new Set();
      const symbolSubscribers = this.subscriptionsBySymbol.get(symbol) || new Set();
      
      // Combine subscribers (those subscribed to this type AND those subscribed to this symbol)
      const relevantSubscribers = new Set([...typeSubscribers]);
      
      // Add symbol-specific subscribers if they're also subscribed to this type
      for (const subscriberId of symbolSubscribers) {
        const subscriber = this.subscribers.get(subscriberId);
        if (subscriber && subscriber.subscriptionTypes.includes(type)) {
          relevantSubscribers.add(subscriberId);
        }
      }

      // Also include global subscribers (no specific symbol)
      for (const subscriberId of typeSubscribers) {
        const subscriber = this.subscribers.get(subscriberId);
        if (subscriber && !subscriber.config.symbol) {
          relevantSubscribers.add(subscriberId);
        }
      }

      // Distribute to relevant subscribers
      for (const subscriberId of relevantSubscribers) {
        const subscriber = this.subscribers.get(subscriberId);
        if (!subscriber) continue;

        // Check update frequency throttling
        if (this.shouldThrottleUpdate(subscriber)) {
          continue;
        }

        // Apply data filter
        if (!subscriber.config.dataFilter(data)) {
          continue;
        }

        try {
          if (subscriber.config.batchUpdates) {
            this.addToBatch(subscriberId, symbol, type, data);
          } else {
            this.deliverUpdate(subscriber, symbol, type, data);
          }
          
          updateCount++;
          subscriber.updateCount = (subscriber.updateCount || 0) + 1;
          subscriber.lastUpdate = new Date();
          
        } catch (error) {
          console.error(`Error delivering update to subscriber ${subscriberId}:`, error);
          this.metrics.errorCount++;
        }
      }

      // Update metrics
      this.metrics.totalUpdates++;
      this.metrics.updatesByType[type] = (this.metrics.updatesByType[type] || 0) + updateCount;
      this.metrics.updatesBySymbol[symbol] = (this.metrics.updatesBySymbol[symbol] || 0) + updateCount;
      
      const latency = Date.now() - startTime;
      this.updateAverageLatency(latency);

    } catch (error) {
      console.error('Error in distribute method:', error);
      this.metrics.errorCount++;
    }
  }

  /**
   * Update price displays across UI components
   */
  public updatePriceDisplays(symbol: string, priceData: PriceData): void {
    this.distribute(symbol, 'price_update', priceData);
  }

  /**
   * Update chart data
   */
  public updateChartData(symbol: string, priceData: PriceData): void {
    // This could be a separate subscription type for chart-specific updates
    this.distribute(symbol, 'price_update', {
      ...priceData,
      chartData: true, // Flag to indicate this is for chart updates
    });
  }

  /**
   * Update market summary information
   */
  public updateMarketSummary(marketStatuses: MarketStatus[]): void {
    for (const status of marketStatuses) {
      this.distribute(status.symbol, 'market_status', status);
    }
  }

  /**
   * Get distribution metrics
   */
  public getMetrics(): DistributionMetrics {
    return {
      ...this.metrics,
      activeSubscribers: this.subscribers.size,
    };
  }

  /**
   * Get subscriber information
   */
  public getSubscriberInfo(): Array<{
    id: string;
    types: SubscriptionType[];
    symbol?: string;
    updateCount: number;
    lastUpdate?: Date;
  }> {
    return Array.from(this.subscribers.values()).map(sub => ({
      id: sub.subscriberId,
      types: sub.subscriptionTypes,
      symbol: sub.config.symbol,
      updateCount: sub.updateCount || 0,
      lastUpdate: sub.lastUpdate,
    }));
  }

  /**
   * Broadcast alert to all relevant subscribers
   */
  public broadcastAlert(symbol: string, alert: PriceAlert): void {
    this.distribute(symbol, 'price_alert', alert);
  }

  /**
   * Broadcast trend update
   */
  public broadcastTrendUpdate(symbol: string, trend: TrendInfo): void {
    this.distribute(symbol, 'trend_update', trend);
  }

  /**
   * Broadcast pattern detection
   */
  public broadcastPatternDetection(symbol: string, pattern: PricePattern): void {
    this.distribute(symbol, 'pattern_detection', pattern);
  }

  /**
   * Broadcast support/resistance levels
   */
  public broadcastSupportResistanceLevels(symbol: string, levels: SupportResistanceLevel[]): void {
    this.distribute(symbol, 'support_resistance', levels);
  }

  /**
   * Broadcast moving average updates
   */
  public broadcastMovingAverageUpdate(symbol: string, averages: MovingAverageData[]): void {
    this.distribute(symbol, 'moving_average', averages);
  }

  // Private helper methods

  private shouldThrottleUpdate(subscriber: EnhancedMarketDataSubscriber): boolean {
    if (subscriber.config.updateFrequency === 0) {
      return false;
    }

    if (!subscriber.lastUpdate) {
      return false;
    }

    const timeSinceLastUpdate = Date.now() - subscriber.lastUpdate.getTime();
    return timeSinceLastUpdate < subscriber.config.updateFrequency;
  }

  private addToBatch(subscriberId: string, symbol: string, type: SubscriptionType, data: any): void {
    if (!this.batchQueues.has(subscriberId)) {
      this.batchQueues.set(subscriberId, []);
    }

    const batch = this.batchQueues.get(subscriberId)!;
    batch.push({
      symbol,
      type,
      data,
      timestamp: new Date(),
    });

    const subscriber = this.subscribers.get(subscriberId)!;
    const maxBatchSize = subscriber.config.maxBatchSize;
    const batchTimeout = subscriber.config.batchTimeout;

    // Deliver batch if it's full
    if (batch.length >= maxBatchSize) {
      this.deliverBatch(subscriberId);
      return;
    }

    // Set timer for batch delivery if not already set
    if (!this.batchTimers.has(subscriberId)) {
      const timer = setTimeout(() => {
        this.deliverBatch(subscriberId);
      }, batchTimeout);
      this.batchTimers.set(subscriberId, timer);
    }
  }

  private deliverBatch(subscriberId: string): void {
    const batch = this.batchQueues.get(subscriberId);
    const timer = this.batchTimers.get(subscriberId);
    
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(subscriberId);
    }

    if (!batch || batch.length === 0) {
      return;
    }

    const subscriber = this.subscribers.get(subscriberId);
    if (!subscriber) {
      return;
    }

    try {
      // Group batch updates by type and symbol
      const groupedUpdates = this.groupBatchUpdates(batch);
      
      // Deliver grouped updates
      for (const [key, updates] of groupedUpdates.entries()) {
        const [symbol, type] = key.split(':');
        this.deliverUpdate(subscriber, symbol, type as SubscriptionType, updates.map(u => u.data));
      }

      // Clear batch
      this.batchQueues.set(subscriberId, []);
      
    } catch (error) {
      console.error(`Error delivering batch to subscriber ${subscriberId}:`, error);
      this.metrics.errorCount++;
    }
  }

  private groupBatchUpdates(batch: BatchUpdate[]): Map<string, BatchUpdate[]> {
    const grouped = new Map<string, BatchUpdate[]>();
    
    for (const update of batch) {
      const key = `${update.symbol}:${update.type}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(update);
    }
    
    return grouped;
  }

  private deliverUpdate(subscriber: EnhancedMarketDataSubscriber, symbol: string, type: SubscriptionType, data: any): void {
    switch (type) {
      case 'market_data':
        subscriber.onMarketDataUpdate(symbol, data);
        break;
      case 'price_update':
        if (subscriber.onPriceUpdate) {
          subscriber.onPriceUpdate(symbol, data);
        }
        break;
      case 'spread_update':
        if (subscriber.onSpreadUpdate) {
          subscriber.onSpreadUpdate(symbol, data);
        }
        break;
      case 'market_status':
        if (subscriber.onMarketStatusUpdate) {
          subscriber.onMarketStatusUpdate(symbol, data);
        }
        break;
      case 'volatility_update':
        if (subscriber.onVolatilityUpdate) {
          subscriber.onVolatilityUpdate(symbol, data);
        }
        break;
      case 'price_alert':
        if (subscriber.onPriceAlert) {
          subscriber.onPriceAlert(symbol, data);
        }
        break;
      case 'trend_update':
        if (subscriber.onTrendUpdate) {
          subscriber.onTrendUpdate(symbol, data);
        }
        break;
      case 'pattern_detection':
        if (subscriber.onPatternDetection) {
          subscriber.onPatternDetection(symbol, data);
        }
        break;
      case 'support_resistance':
        if (subscriber.onSupportResistanceUpdate) {
          subscriber.onSupportResistanceUpdate(symbol, data);
        }
        break;
      case 'moving_average':
        if (subscriber.onMovingAverageUpdate) {
          subscriber.onMovingAverageUpdate(symbol, data);
        }
        break;
      default:
        console.warn(`Unknown subscription type: ${type}`);
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalUpdates: 0,
      updatesByType: {} as Record<SubscriptionType, number>,
      updatesBySymbol: {},
      averageLatency: 0,
      errorCount: 0,
      activeSubscribers: 0,
    };
  }

  private updateAverageLatency(latency: number): void {
    if (this.metrics.averageLatency === 0) {
      this.metrics.averageLatency = latency;
    } else {
      // Exponential moving average
      this.metrics.averageLatency = this.metrics.averageLatency * 0.9 + latency * 0.1;
    }
  }

  private startMetricsCollection(): void {
    // Reset metrics every hour
    setInterval(() => {
      this.resetMetrics();
    }, 60 * 60 * 1000);

    // Log metrics every 5 minutes in development
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        console.log('Market Data Distribution Metrics:', this.getMetrics());
      }, 5 * 60 * 1000);
    }
  }

  private resetMetrics(): void {
    const currentActiveSubscribers = this.subscribers.size;
    this.initializeMetrics();
    this.metrics.activeSubscribers = currentActiveSubscribers;
  }

  /**
   * Force delivery of all pending batches
   */
  public flushAllBatches(): void {
    for (const subscriberId of this.batchQueues.keys()) {
      this.deliverBatch(subscriberId);
    }
  }

  /**
   * Get statistics for monitoring
   */
  public getDetailedStats(): {
    subscribers: number;
    subscriptionsByType: Record<SubscriptionType, number>;
    pendingBatches: number;
    totalBatchItems: number;
    metrics: DistributionMetrics;
  } {
    const subscriptionsByType: Record<SubscriptionType, number> = {} as any;
    for (const [type, subscribers] of this.subscriptionsByType.entries()) {
      subscriptionsByType[type] = subscribers.size;
    }

    let totalBatchItems = 0;
    for (const batch of this.batchQueues.values()) {
      totalBatchItems += batch.length;
    }

    return {
      subscribers: this.subscribers.size,
      subscriptionsByType,
      pendingBatches: this.batchQueues.size,
      totalBatchItems,
      metrics: this.getMetrics(),
    };
  }
}

// Singleton instance
export const marketDataDistributor = new MarketDataDistributor();