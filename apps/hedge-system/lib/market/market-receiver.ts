import { 
  EAMessage, 
  MarketData, 
  isMarketDataMessage,
  BaseMessage
} from '../websocket/message-types';

// Extended market data interfaces for enhanced functionality
export interface PriceData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: Date;
  spread: number;
  change: number;
  changePercent: number;
  high24h?: number;
  low24h?: number;
  volume?: number;
}

export interface SpreadData {
  symbol: string;
  spread: number;
  spreadPercent: number;
  timestamp: Date;
  isWidening: boolean;
  historicalAverage: number;
}

export interface MarketStatus {
  symbol: string;
  isOpen: boolean;
  sessionType: 'pre_market' | 'market_hours' | 'after_hours' | 'closed';
  nextOpen?: Date;
  nextClose?: Date;
  timezone: string;
}

export interface VolatilityData {
  symbol: string;
  currentVolatility: number;
  averageVolatility: number;
  volatilityRank: number; // 0-100 percentile
  timestamp: Date;
}

// Market data receiver interface
export interface IMarketDataReceiver {
  onMarketUpdate(message: EAMessage): Promise<void>;
  onPriceUpdate(data: PriceData): Promise<void>;
  onSpreadUpdate(data: SpreadData): Promise<void>;
  onMarketStatusUpdate(data: MarketStatus): Promise<void>;
  onVolatilityUpdate(data: VolatilityData): Promise<void>;
}

// Market data subscriber interface
export interface MarketDataSubscriber {
  onMarketDataUpdate(symbol: string, data: MarketData): void;
  onPriceUpdate?(symbol: string, data: PriceData): void;
  onSpreadUpdate?(symbol: string, data: SpreadData): void;
  onMarketStatusUpdate?(symbol: string, data: MarketStatus): void;
  onVolatilityUpdate?(symbol: string, data: VolatilityData): void;
}

// Market data receiver implementation
export class MarketDataReceiver implements IMarketDataReceiver {
  private priceHistory: Map<string, PriceData[]> = new Map();
  private marketStatuses: Map<string, MarketStatus> = new Map();
  private spreadHistory: Map<string, SpreadData[]> = new Map();
  private volatilityHistory: Map<string, VolatilityData[]> = new Map();
  
  private readonly maxHistorySize = 1000; // Maximum number of historical data points per symbol
  private readonly subscribers: Set<MarketDataSubscriber> = new Set();

  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    // Initialize default settings and cleanup intervals
    setInterval(() => this.cleanupOldData(), 5 * 60 * 1000); // Clean every 5 minutes
  }

  /**
   * Subscribe to market data updates
   */
  public subscribe(subscriber: MarketDataSubscriber): void {
    this.subscribers.add(subscriber);
  }

  /**
   * Unsubscribe from market data updates
   */
  public unsubscribe(subscriber: MarketDataSubscriber): void {
    this.subscribers.delete(subscriber);
  }

  /**
   * Main entry point for market data messages from EA
   */
  public async onMarketUpdate(message: EAMessage): Promise<void> {
    try {
      if (!isMarketDataMessage(message)) {
        console.warn('Invalid market data message received:', message);
        return;
      }

      const marketData = message.data as MarketData;
      
      // Convert basic market data to enhanced format
      const priceData = this.convertToEnhancedPriceData(marketData);
      
      await this.onPriceUpdate(priceData);
      
      // Calculate and update spread data
      const spreadData = this.calculateSpreadData(priceData);
      await this.onSpreadUpdate(spreadData);
      
      // Update market status
      const marketStatus = this.deriveMarketStatus(marketData);
      await this.onMarketStatusUpdate(marketStatus);
      
      // Calculate volatility
      const volatilityData = this.calculateVolatility(priceData);
      if (volatilityData) {
        await this.onVolatilityUpdate(volatilityData);
      }

      // Notify subscribers
      this.notifySubscribers(marketData.symbol, marketData);
      
    } catch (error) {
      console.error('Error processing market data update:', error);
      throw error;
    }
  }

  /**
   * Handle price data updates
   */
  public async onPriceUpdate(data: PriceData): Promise<void> {
    try {
      // Store price history
      this.addPriceHistory(data.symbol, data);
      
      // Notify price subscribers
      this.subscribers.forEach(subscriber => {
        if (subscriber.onPriceUpdate) {
          try {
            subscriber.onPriceUpdate(data.symbol, data);
          } catch (error) {
            console.error('Error in price update subscriber:', error);
          }
        }
      });
      
    } catch (error) {
      console.error('Error processing price update:', error);
      throw error;
    }
  }

  /**
   * Handle spread data updates
   */
  public async onSpreadUpdate(data: SpreadData): Promise<void> {
    try {
      // Store spread history
      this.addSpreadHistory(data.symbol, data);
      
      // Notify spread subscribers
      this.subscribers.forEach(subscriber => {
        if (subscriber.onSpreadUpdate) {
          try {
            subscriber.onSpreadUpdate(data.symbol, data);
          } catch (error) {
            console.error('Error in spread update subscriber:', error);
          }
        }
      });
      
    } catch (error) {
      console.error('Error processing spread update:', error);
      throw error;
    }
  }

  /**
   * Handle market status updates
   */
  public async onMarketStatusUpdate(data: MarketStatus): Promise<void> {
    try {
      // Store market status
      this.marketStatuses.set(data.symbol, data);
      
      // Notify status subscribers
      this.subscribers.forEach(subscriber => {
        if (subscriber.onMarketStatusUpdate) {
          try {
            subscriber.onMarketStatusUpdate(data.symbol, data);
          } catch (error) {
            console.error('Error in market status update subscriber:', error);
          }
        }
      });
      
    } catch (error) {
      console.error('Error processing market status update:', error);
      throw error;
    }
  }

  /**
   * Handle volatility data updates
   */
  public async onVolatilityUpdate(data: VolatilityData): Promise<void> {
    try {
      // Store volatility history
      this.addVolatilityHistory(data.symbol, data);
      
      // Notify volatility subscribers
      this.subscribers.forEach(subscriber => {
        if (subscriber.onVolatilityUpdate) {
          try {
            subscriber.onVolatilityUpdate(data.symbol, data);
          } catch (error) {
            console.error('Error in volatility update subscriber:', error);
          }
        }
      });
      
    } catch (error) {
      console.error('Error processing volatility update:', error);
      throw error;
    }
  }

  /**
   * Get current price for a symbol
   */
  public getCurrentPrice(symbol: string): PriceData | null {
    const history = this.priceHistory.get(symbol);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get price history for a symbol
   */
  public getPriceHistory(symbol: string, limit?: number): PriceData[] {
    const history = this.priceHistory.get(symbol) || [];
    return limit ? history.slice(-limit) : [...history];
  }

  /**
   * Get current market status for a symbol
   */
  public getMarketStatus(symbol: string): MarketStatus | null {
    return this.marketStatuses.get(symbol) || null;
  }

  /**
   * Get current spread data for a symbol
   */
  public getCurrentSpread(symbol: string): SpreadData | null {
    const history = this.spreadHistory.get(symbol);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get volatility data for a symbol
   */
  public getCurrentVolatility(symbol: string): VolatilityData | null {
    const history = this.volatilityHistory.get(symbol);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  // Private helper methods

  private convertToEnhancedPriceData(marketData: MarketData): PriceData {
    const history = this.priceHistory.get(marketData.symbol) || [];
    const previousPrice = history.length > 0 ? history[history.length - 1] : null;
    
    const currentPrice = (marketData.bid + marketData.ask) / 2;
    const change = previousPrice ? currentPrice - (previousPrice.bid + previousPrice.ask) / 2 : 0;
    const changePercent = previousPrice ? (change / ((previousPrice.bid + previousPrice.ask) / 2)) * 100 : 0;

    return {
      symbol: marketData.symbol,
      bid: marketData.bid,
      ask: marketData.ask,
      timestamp: marketData.lastUpdated,
      spread: marketData.spread,
      change,
      changePercent,
      high24h: this.calculate24hHigh(marketData.symbol),
      low24h: this.calculate24hLow(marketData.symbol),
    };
  }

  private calculateSpreadData(priceData: PriceData): SpreadData {
    const spreadHistory = this.spreadHistory.get(priceData.symbol) || [];
    const spreadPercent = (priceData.spread / priceData.bid) * 100;
    
    // Calculate historical average (last 100 data points or available)
    const recentSpreads = spreadHistory.slice(-100).map(s => s.spread);
    const historicalAverage = recentSpreads.length > 0 
      ? recentSpreads.reduce((sum, spread) => sum + spread, 0) / recentSpreads.length 
      : priceData.spread;

    const isWidening = spreadHistory.length > 0 
      ? priceData.spread > spreadHistory[spreadHistory.length - 1].spread 
      : false;

    return {
      symbol: priceData.symbol,
      spread: priceData.spread,
      spreadPercent,
      timestamp: priceData.timestamp,
      isWidening,
      historicalAverage,
    };
  }

  private deriveMarketStatus(marketData: MarketData): MarketStatus {
    // Basic market status derivation from MarketData
    // This would typically integrate with market hours data
    const now = new Date();
    
    return {
      symbol: marketData.symbol,
      isOpen: marketData.marketStatus === 'open',
      sessionType: this.determineSessionType(marketData.marketStatus, now),
      timezone: 'UTC', // Default to UTC, should be configurable
    };
  }

  private determineSessionType(status: 'open' | 'closed' | 'weekend', time: Date): MarketStatus['sessionType'] {
    if (status === 'closed' || status === 'weekend') {
      return 'closed';
    }
    
    // Simplified logic - would need real market hours integration
    const hour = time.getUTCHours();
    if (hour >= 9 && hour < 17) {
      return 'market_hours';
    } else if (hour >= 4 && hour < 9) {
      return 'pre_market';
    } else {
      return 'after_hours';
    }
  }

  private calculateVolatility(priceData: PriceData): VolatilityData | null {
    const history = this.priceHistory.get(priceData.symbol) || [];
    
    if (history.length < 20) {
      return null; // Need minimum data for volatility calculation
    }

    // Calculate price returns for the last 20 periods
    const returns: number[] = [];
    for (let i = 1; i < Math.min(history.length, 20); i++) {
      const current = (history[i].bid + history[i].ask) / 2;
      const previous = (history[i - 1].bid + history[i - 1].ask) / 2;
      returns.push((current - previous) / previous);
    }

    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const currentVolatility = Math.sqrt(variance) * 100; // Convert to percentage

    // Calculate average volatility from historical data
    const volatilityHistory = this.volatilityHistory.get(priceData.symbol) || [];
    const averageVolatility = volatilityHistory.length > 0
      ? volatilityHistory.slice(-100).reduce((sum, vol) => sum + vol.currentVolatility, 0) / Math.min(volatilityHistory.length, 100)
      : currentVolatility;

    // Calculate volatility rank (simplified)
    const volatilityRank = Math.min(100, Math.max(0, (currentVolatility / averageVolatility) * 50));

    return {
      symbol: priceData.symbol,
      currentVolatility,
      averageVolatility,
      volatilityRank,
      timestamp: priceData.timestamp,
    };
  }

  private calculate24hHigh(symbol: string): number | undefined {
    const history = this.priceHistory.get(symbol) || [];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recent24h = history.filter(data => data.timestamp >= yesterday);
    if (recent24h.length === 0) return undefined;
    
    return Math.max(...recent24h.map(data => Math.max(data.bid, data.ask)));
  }

  private calculate24hLow(symbol: string): number | undefined {
    const history = this.priceHistory.get(symbol) || [];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recent24h = history.filter(data => data.timestamp >= yesterday);
    if (recent24h.length === 0) return undefined;
    
    return Math.min(...recent24h.map(data => Math.min(data.bid, data.ask)));
  }

  private addPriceHistory(symbol: string, data: PriceData): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    
    const history = this.priceHistory.get(symbol)!;
    history.push(data);
    
    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  private addSpreadHistory(symbol: string, data: SpreadData): void {
    if (!this.spreadHistory.has(symbol)) {
      this.spreadHistory.set(symbol, []);
    }
    
    const history = this.spreadHistory.get(symbol)!;
    history.push(data);
    
    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  private addVolatilityHistory(symbol: string, data: VolatilityData): void {
    if (!this.volatilityHistory.has(symbol)) {
      this.volatilityHistory.set(symbol, []);
    }
    
    const history = this.volatilityHistory.get(symbol)!;
    history.push(data);
    
    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  private notifySubscribers(symbol: string, data: MarketData): void {
    this.subscribers.forEach(subscriber => {
      try {
        subscriber.onMarketDataUpdate(symbol, data);
      } catch (error) {
        console.error('Error in market data subscriber:', error);
      }
    });
  }

  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    // Clean price history
    for (const [symbol, history] of this.priceHistory.entries()) {
      const filteredHistory = history.filter(data => data.timestamp >= cutoffTime);
      if (filteredHistory.length !== history.length) {
        this.priceHistory.set(symbol, filteredHistory);
      }
    }
    
    // Clean spread history
    for (const [symbol, history] of this.spreadHistory.entries()) {
      const filteredHistory = history.filter(data => data.timestamp >= cutoffTime);
      if (filteredHistory.length !== history.length) {
        this.spreadHistory.set(symbol, filteredHistory);
      }
    }
    
    // Clean volatility history
    for (const [symbol, history] of this.volatilityHistory.entries()) {
      const filteredHistory = history.filter(data => data.timestamp >= cutoffTime);
      if (filteredHistory.length !== history.length) {
        this.volatilityHistory.set(symbol, filteredHistory);
      }
    }
  }

  /**
   * Get statistics for debugging and monitoring
   */
  public getStats(): {
    totalSymbols: number;
    totalPricePoints: number;
    subscriberCount: number;
    memoryUsage: {
      priceHistory: number;
      spreadHistory: number;
      volatilityHistory: number;
    };
  } {
    let totalPricePoints = 0;
    let totalSpreadPoints = 0;
    let totalVolatilityPoints = 0;
    
    for (const history of this.priceHistory.values()) {
      totalPricePoints += history.length;
    }
    
    for (const history of this.spreadHistory.values()) {
      totalSpreadPoints += history.length;
    }
    
    for (const history of this.volatilityHistory.values()) {
      totalVolatilityPoints += history.length;
    }

    return {
      totalSymbols: this.priceHistory.size,
      totalPricePoints,
      subscriberCount: this.subscribers.size,
      memoryUsage: {
        priceHistory: totalPricePoints,
        spreadHistory: totalSpreadPoints,
        volatilityHistory: totalVolatilityPoints,
      },
    };
  }
}

// Singleton instance for global use
export const marketDataReceiver = new MarketDataReceiver();