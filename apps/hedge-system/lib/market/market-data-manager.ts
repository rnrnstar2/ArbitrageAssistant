import { MarketDataReceiver, marketDataReceiver } from './market-receiver';
import { PriceAnalyzer, priceAnalyzer } from './price-analyzer';
import { MarketDataDistributor, marketDataDistributor } from './market-data-distributor';
import { EAMessage, isMarketDataMessage } from '../websocket/message-types';

// Market data manager configuration
export interface MarketDataManagerConfig {
  enableAnalysis?: boolean;
  enableDistribution?: boolean;
  enableAlerts?: boolean;
  analysisInterval?: number; // ms
  alertThresholds?: {
    volatilitySpike?: number;
    unusualMovement?: number;
    spreadWidening?: number;
  };
  symbols?: string[]; // Symbols to track, empty means all
}

// Market data manager interface
export interface IMarketDataManager {
  initialize(config?: MarketDataManagerConfig): void;
  processMarketData(message: EAMessage): Promise<void>;
  getMarketData(symbol: string): any;
  getAnalysis(symbol: string): any;
  startRealTimeAnalysis(): void;
  stopRealTimeAnalysis(): void;
  getStats(): any;
}

// Market data manager implementation
export class MarketDataManager implements IMarketDataManager {
  private config: Required<MarketDataManagerConfig>;
  private analysisInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private trackedSymbols = new Set<string>();
  
  private readonly defaultConfig: Required<MarketDataManagerConfig> = {
    enableAnalysis: true,
    enableDistribution: true,
    enableAlerts: true,
    analysisInterval: 5000, // 5 seconds
    alertThresholds: {
      volatilitySpike: 2.0,
      unusualMovement: 0.01, // 1%
      spreadWidening: 1.5,
    },
    symbols: [], // Empty means track all symbols
  };

  constructor() {
    this.config = { ...this.defaultConfig };
  }

  /**
   * Initialize the market data manager
   */
  public initialize(config?: MarketDataManagerConfig): void {
    this.config = { ...this.defaultConfig, ...config };
    
    if (this.config.symbols.length > 0) {
      this.trackedSymbols = new Set(this.config.symbols);
    }

    // Subscribe market data receiver to the distributor
    this.setupDataFlow();

    this.isInitialized = true;
    console.log('Market Data Manager initialized with config:', this.config);
  }

  /**
   * Process incoming market data from EA
   */
  public async processMarketData(message: EAMessage): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Market Data Manager not initialized');
      return;
    }

    if (!isMarketDataMessage(message)) {
      console.warn('Invalid market data message');
      return;
    }

    try {
      const marketData = message.data;
      const symbol = marketData.symbol;

      // Check if we should track this symbol
      if (this.config.symbols.length > 0 && !this.trackedSymbols.has(symbol)) {
        return; // Skip symbols not in the tracking list
      }

      // Add to tracked symbols if not already there
      this.trackedSymbols.add(symbol);

      // Process through market data receiver
      await marketDataReceiver.onMarketUpdate(message);

      // Perform analysis if enabled
      if (this.config.enableAnalysis) {
        await this.performAnalysis(symbol);
      }

      console.log(`Processed market data for ${symbol}:`, {
        bid: marketData.bid,
        ask: marketData.ask,
        spread: marketData.spread,
        timestamp: marketData.lastUpdated,
      });

    } catch (error) {
      console.error('Error processing market data:', error);
      throw error;
    }
  }

  /**
   * Get current market data for a symbol
   */
  public getMarketData(symbol: string): {
    price?: any;
    spread?: any;
    status?: any;
    volatility?: any;
  } {
    return {
      price: marketDataReceiver.getCurrentPrice(symbol),
      spread: marketDataReceiver.getCurrentSpread(symbol),
      status: marketDataReceiver.getMarketStatus(symbol),
      volatility: marketDataReceiver.getCurrentVolatility(symbol),
    };
  }

  /**
   * Get analysis data for a symbol
   */
  public getAnalysis(symbol: string): {
    alerts?: any[];
    trend?: any;
    patterns?: any[];
    supportResistance?: any[];
    movingAverages?: any[];
    stats?: any;
  } {
    if (!this.config.enableAnalysis) {
      return {};
    }

    return {
      alerts: priceAnalyzer.getRecentAlerts(symbol),
      trend: priceAnalyzer.analyzeTrend(symbol),
      patterns: priceAnalyzer.detectPricePatterns(symbol),
      supportResistance: priceAnalyzer.findSupportResistance(symbol),
      movingAverages: priceAnalyzer.getMovingAverages(symbol),
      stats: priceAnalyzer.getAnalysisStats(),
    };
  }

  /**
   * Start real-time analysis
   */
  public startRealTimeAnalysis(): void {
    if (!this.config.enableAnalysis) {
      console.log('Analysis is disabled in configuration');
      return;
    }

    if (this.analysisInterval) {
      console.log('Real-time analysis already running');
      return;
    }

    this.analysisInterval = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.config.analysisInterval);

    console.log(`Started real-time analysis with ${this.config.analysisInterval}ms interval`);
  }

  /**
   * Stop real-time analysis
   */
  public stopRealTimeAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
      console.log('Stopped real-time analysis');
    }
  }

  /**
   * Get comprehensive statistics
   */
  public getStats(): {
    manager: {
      isInitialized: boolean;
      trackedSymbols: number;
      analysisRunning: boolean;
      config: MarketDataManagerConfig;
    };
    receiver: any;
    analyzer: any;
    distributor: any;
  } {
    return {
      manager: {
        isInitialized: this.isInitialized,
        trackedSymbols: this.trackedSymbols.size,
        analysisRunning: this.analysisInterval !== null,
        config: this.config,
      },
      receiver: marketDataReceiver.getStats(),
      analyzer: this.config.enableAnalysis ? priceAnalyzer.getAnalysisStats() : null,
      distributor: this.config.enableDistribution ? marketDataDistributor.getDetailedStats() : null,
    };
  }

  /**
   * Get list of tracked symbols
   */
  public getTrackedSymbols(): string[] {
    return Array.from(this.trackedSymbols);
  }

  /**
   * Add symbol to tracking list
   */
  public addSymbolToTracking(symbol: string): void {
    this.trackedSymbols.add(symbol);
    console.log(`Added symbol ${symbol} to tracking list`);
  }

  /**
   * Remove symbol from tracking list
   */
  public removeSymbolFromTracking(symbol: string): void {
    this.trackedSymbols.delete(symbol);
    console.log(`Removed symbol ${symbol} from tracking list`);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<MarketDataManagerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Handle analysis interval change
    if (newConfig.analysisInterval && newConfig.analysisInterval !== oldConfig.analysisInterval) {
      if (this.analysisInterval) {
        this.stopRealTimeAnalysis();
        this.startRealTimeAnalysis();
      }
    }

    // Handle symbol list change
    if (newConfig.symbols) {
      this.trackedSymbols = new Set(newConfig.symbols);
    }

    console.log('Updated market data manager configuration:', newConfig);
  }

  /**
   * Force analysis for all tracked symbols
   */
  public async forceAnalysis(): Promise<void> {
    if (!this.config.enableAnalysis) {
      console.log('Analysis is disabled');
      return;
    }

    console.log('Forcing analysis for all tracked symbols...');
    
    for (const symbol of this.trackedSymbols) {
      try {
        await this.performAnalysis(symbol);
      } catch (error) {
        console.error(`Error in forced analysis for ${symbol}:`, error);
      }
    }
    
    console.log('Forced analysis completed');
  }

  /**
   * Clear all data and reset
   */
  public reset(): void {
    this.stopRealTimeAnalysis();
    this.trackedSymbols.clear();
    
    // Note: We don't reset the actual data in receiver/analyzer/distributor
    // as they might be used by other parts of the system
    
    console.log('Market data manager reset');
  }

  // Private helper methods

  private setupDataFlow(): void {
    // The data flow is already set up through the individual components
    // MarketDataReceiver -> handles incoming data and notifies distributor
    // PriceAnalyzer -> analyzes data and generates alerts/analysis
    // MarketDataDistributor -> distributes data to UI components

    console.log('Data flow setup completed');
  }

  private async performAnalysis(symbol: string): Promise<void> {
    if (!this.config.enableAnalysis) {
      return;
    }

    try {
      // Get current price data
      const priceData = marketDataReceiver.getCurrentPrice(symbol);
      if (!priceData) {
        return;
      }

      // Add to price analyzer for analysis
      priceAnalyzer.addPriceData(symbol, priceData);

      // Check for alerts
      const alerts = priceAnalyzer.detectPriceAlert(symbol, (priceData.bid + priceData.ask) / 2);
      
      // Distribute alerts if found
      if (this.config.enableDistribution && alerts.length > 0) {
        for (const alert of alerts) {
          marketDataDistributor.broadcastAlert(symbol, alert);
        }
      }

      // Analyze trend
      const trend = priceAnalyzer.analyzeTrend(symbol);
      if (trend && this.config.enableDistribution) {
        marketDataDistributor.broadcastTrendUpdate(symbol, trend);
      }

      // Get moving averages
      const movingAverages = priceAnalyzer.getMovingAverages(symbol);
      if (movingAverages.length > 0 && this.config.enableDistribution) {
        marketDataDistributor.broadcastMovingAverageUpdate(symbol, movingAverages);
      }

      // Find support/resistance levels (less frequent)
      if (Math.random() < 0.1) { // 10% chance to update S/R levels
        const srLevels = priceAnalyzer.findSupportResistance(symbol);
        if (srLevels.length > 0 && this.config.enableDistribution) {
          marketDataDistributor.broadcastSupportResistanceLevels(symbol, srLevels);
        }
      }

    } catch (error) {
      console.error(`Error in analysis for ${symbol}:`, error);
    }
  }

  private performPeriodicAnalysis(): void {
    // Perform analysis for all tracked symbols
    for (const symbol of this.trackedSymbols) {
      this.performAnalysis(symbol).catch(error => {
        console.error(`Error in periodic analysis for ${symbol}:`, error);
      });
    }
  }

  /**
   * Get memory usage information
   */
  public getMemoryUsage(): {
    estimatedSizeKB: number;
    breakdown: {
      receiver: number;
      analyzer: number;
      distributor: number;
      manager: number;
    };
  } {
    const receiverStats = marketDataReceiver.getStats();
    const analyzerStats = priceAnalyzer.getAnalysisStats();
    const distributorStats = marketDataDistributor.getDetailedStats();

    // Rough estimation of memory usage
    const receiverSize = receiverStats.memoryUsage.priceHistory * 100; // ~100 bytes per price point
    const analyzerSize = analyzerStats.totalDataPoints * 80; // ~80 bytes per analysis point
    const distributorSize = distributorStats.subscribers * 50; // ~50 bytes per subscriber
    const managerSize = this.trackedSymbols.size * 20; // ~20 bytes per tracked symbol

    return {
      estimatedSizeKB: Math.round((receiverSize + analyzerSize + distributorSize + managerSize) / 1024),
      breakdown: {
        receiver: Math.round(receiverSize / 1024),
        analyzer: Math.round(analyzerSize / 1024),
        distributor: Math.round(distributorSize / 1024),
        manager: Math.round(managerSize / 1024),
      },
    };
  }

  /**
   * Export current state for debugging
   */
  public exportState(): {
    config: MarketDataManagerConfig;
    trackedSymbols: string[];
    stats: any;
    memoryUsage: any;
  } {
    return {
      config: this.config,
      trackedSymbols: this.getTrackedSymbols(),
      stats: this.getStats(),
      memoryUsage: this.getMemoryUsage(),
    };
  }
}

// Singleton instance
export const marketDataManager = new MarketDataManager();

// Initialize with default configuration
marketDataManager.initialize();

// Export everything for easy access
export {
  marketDataReceiver,
  priceAnalyzer,
  marketDataDistributor,
};