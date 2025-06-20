// Market data system exports

// Core classes and interfaces
export {
  MarketDataReceiver,
  marketDataReceiver,
  type IMarketDataReceiver,
  type PriceData,
  type SpreadData,
  type MarketStatus,
  type VolatilityData,
  type MarketDataSubscriber,
} from './market-receiver';

export {
  PriceAnalyzer,
  priceAnalyzer,
  type IPriceAnalyzer,
  type TrendInfo,
  type PriceAlert,
  type PricePattern,
  type MovingAverageData,
  type SupportResistanceLevel,
} from './price-analyzer';

export {
  MarketDataDistributor,
  marketDataDistributor,
  type IMarketDataDistributor,
  type EnhancedMarketDataSubscriber,
  type SubscriptionType,
  type SubscriptionConfig,
} from './market-data-distributor';

export {
  MarketDataManager,
  marketDataManager,
  type IMarketDataManager,
  type MarketDataManagerConfig,
} from './market-data-manager';

// Re-export components
export { default as PriceDisplay } from '../../components/market/PriceDisplay';

// Utility function to initialize the entire market data system
export function initializeMarketDataSystem(config?: {
  managerConfig?: any;
  symbols?: string[];
  enableAnalysis?: boolean;
  enableDistribution?: boolean;
}) {
  const { managerConfig, symbols, enableAnalysis = true, enableDistribution = true } = config || {};
  
  // Initialize manager with configuration
  marketDataManager.initialize({
    symbols,
    enableAnalysis,
    enableDistribution,
    ...managerConfig,
  });

  // Start real-time analysis
  if (enableAnalysis) {
    marketDataManager.startRealTimeAnalysis();
  }

  console.log('Market data system initialized successfully');
  
  return {
    manager: marketDataManager,
    receiver: marketDataReceiver,
    analyzer: priceAnalyzer,
    distributor: marketDataDistributor,
  };
}

// Utility function to create a simple market data subscriber
export function createSimpleSubscriber(
  id: string,
  symbol: string,
  onPriceUpdate: (symbol: string, price: any) => void,
  onAlert?: (symbol: string, alert: any) => void
) {
  return {
    subscriberId: id,
    subscriptionTypes: ['price_update', 'price_alert'] as any[],
    config: { symbol },
    onMarketDataUpdate: () => {},
    onPriceUpdate,
    onPriceAlert: onAlert,
  };
}

// Utility function to get comprehensive market data for a symbol
export function getSymbolData(symbol: string) {
  return {
    marketData: marketDataManager.getMarketData(symbol),
    analysis: marketDataManager.getAnalysis(symbol),
  };
}

// Utility function to get system health
export function getSystemHealth() {
  const stats = marketDataManager.getStats();
  const memoryUsage = marketDataManager.getMemoryUsage();
  
  return {
    isHealthy: stats.manager.isInitialized && stats.receiver.totalSymbols > 0,
    stats,
    memoryUsage,
    trackedSymbols: marketDataManager.getTrackedSymbols(),
  };
}