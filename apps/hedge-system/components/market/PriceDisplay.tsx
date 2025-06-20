'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PriceData, MarketStatus, SpreadData, VolatilityData } from '../../lib/market/market-receiver';
import { PriceAlert, TrendInfo, MovingAverageData } from '../../lib/market/price-analyzer';
import { 
  EnhancedMarketDataSubscriber, 
  SubscriptionType, 
  marketDataDistributor 
} from '../../lib/market/market-data-distributor';
import { MarketData } from '../../lib/websocket/message-types';

// Price display props
interface PriceDisplayProps {
  symbol: string;
  showDetails?: boolean;
  showChart?: boolean;
  showAlerts?: boolean;
  className?: string;
  onPriceClick?: (symbol: string, price: number) => void;
}

// Price change indicator component
const PriceChangeIndicator: React.FC<{ 
  change: number; 
  changePercent: number; 
  size?: 'sm' | 'md' | 'lg' 
}> = ({ change, changePercent, size = 'md' }) => {
  const isPositive = change > 0;
  const isNegative = change < 0;
  
  const sizeClasses = {
    sm: 'text-xs px-1 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const colorClasses = isPositive 
    ? 'bg-green-100 text-green-800 border-green-200'
    : isNegative 
    ? 'bg-red-100 text-red-800 border-red-200'
    : 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span className={`inline-flex items-center rounded-md border font-medium ${sizeClasses[size]} ${colorClasses}`}>
      {isPositive && '+'}{change.toFixed(5)} ({isPositive && '+'}{changePercent.toFixed(2)}%)
    </span>
  );
};

// Spread indicator component
const SpreadIndicator: React.FC<{ 
  spread: number; 
  spreadPercent: number;
  isWidening?: boolean;
}> = ({ spread, spreadPercent, isWidening = false }) => {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">
        Spread: {spread.toFixed(1)} ({spreadPercent.toFixed(3)}%)
      </span>
      {isWidening && (
        <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
          Widening
        </span>
      )}
    </div>
  );
};

// Market status indicator component
const MarketStatusIndicator: React.FC<{ status: MarketStatus }> = ({ status }) => {
  const statusColors = {
    closed: 'bg-red-100 text-red-800 border-red-200',
    pre_market: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    market_hours: 'bg-green-100 text-green-800 border-green-200',
    after_hours: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const statusLabels = {
    closed: 'Closed',
    pre_market: 'Pre-Market',
    market_hours: 'Open',
    after_hours: 'After Hours',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${statusColors[status.sessionType]}`}>
      <div className={`w-2 h-2 rounded-full mr-2 ${status.isOpen ? 'bg-green-500' : 'bg-red-500'}`} />
      {statusLabels[status.sessionType]}
    </span>
  );
};

// Price alert component
const PriceAlertBadge: React.FC<{ alert: PriceAlert }> = ({ alert }) => {
  const severityColors = {
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };

  const typeIcons = {
    resistance: '↑',
    support: '↓',
    breakout: '⚡',
    unusual_movement: '📊',
    volatility_spike: '🌪️',
    spread_widening: '↔️',
  };

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${severityColors[alert.severity]}`}>
      <span className="mr-1">{typeIcons[alert.type]}</span>
      {alert.message}
    </div>
  );
};

// Trend indicator component
const TrendIndicator: React.FC<{ trend: TrendInfo }> = ({ trend }) => {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    sideways: 'text-gray-600',
  };

  const trendIcons = {
    up: '↗️',
    down: '↘️',
    sideways: '→',
  };

  return (
    <div className={`flex items-center space-x-2 ${trendColors[trend.direction]}`}>
      <span className="text-lg">{trendIcons[trend.direction]}</span>
      <div className="text-sm">
        <div className="font-medium">{trend.direction.toUpperCase()}</div>
        <div className="text-xs">
          Strength: {trend.strength.toFixed(0)}% | Confidence: {trend.confidence.toFixed(0)}%
        </div>
      </div>
    </div>
  );
};

// Main price display component
export const PriceDisplay: React.FC<PriceDisplayProps> = ({ 
  symbol, 
  showDetails = true, 
  showChart = false, 
  showAlerts = true,
  className = '',
  onPriceClick 
}) => {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [spreadData, setSpreadData] = useState<SpreadData | null>(null);
  const [volatilityData, setVolatilityData] = useState<VolatilityData | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<PriceAlert[]>([]);
  const [trendInfo, setTrendInfo] = useState<TrendInfo | null>(null);
  const [movingAverages, setMovingAverages] = useState<MovingAverageData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const subscriberIdRef = useRef<string>(`price-display-${symbol}-${Date.now()}`);

  // Create market data subscriber
  const createSubscriber = useCallback((): EnhancedMarketDataSubscriber => {
    return {
      subscriberId: subscriberIdRef.current,
      subscriptionTypes: [
        'price_update',
        'market_status',
        'spread_update', 
        'volatility_update',
        'price_alert',
        'trend_update',
        'moving_average'
      ] as SubscriptionType[],
      config: {
        symbol,
        updateFrequency: 100, // Minimum 100ms between updates
        priority: 'normal',
        batchUpdates: false,
      },

      // Basic subscriber methods
      onMarketDataUpdate: (updateSymbol: string, data: MarketData) => {
        if (updateSymbol === symbol) {
          setLastUpdate(new Date());
          setIsConnected(true);
        }
      },

      // Enhanced subscriber methods
      onPriceUpdate: (updateSymbol: string, data: PriceData) => {
        if (updateSymbol === symbol) {
          setPriceData(data);
          setLastUpdate(new Date());
          setIsConnected(true);
        }
      },

      onMarketStatusUpdate: (updateSymbol: string, status: MarketStatus) => {
        if (updateSymbol === symbol) {
          setMarketStatus(status);
          setLastUpdate(new Date());
        }
      },

      onSpreadUpdate: (updateSymbol: string, data: SpreadData) => {
        if (updateSymbol === symbol) {
          setSpreadData(data);
          setLastUpdate(new Date());
        }
      },

      onVolatilityUpdate: (updateSymbol: string, data: VolatilityData) => {
        if (updateSymbol === symbol) {
          setVolatilityData(data);
          setLastUpdate(new Date());
        }
      },

      onPriceAlert: (updateSymbol: string, alert: PriceAlert) => {
        if (updateSymbol === symbol) {
          setRecentAlerts(prev => {
            const newAlerts = [alert, ...prev.slice(0, 4)]; // Keep last 5 alerts
            return newAlerts;
          });
          setLastUpdate(new Date());
        }
      },

      onTrendUpdate: (updateSymbol: string, trend: TrendInfo) => {
        if (updateSymbol === symbol) {
          setTrendInfo(trend);
          setLastUpdate(new Date());
        }
      },

      onMovingAverageUpdate: (updateSymbol: string, averages: MovingAverageData[]) => {
        if (updateSymbol === symbol) {
          setMovingAverages(averages);
          setLastUpdate(new Date());
        }
      },
    };
  }, [symbol]);

  // Subscribe to market data updates
  useEffect(() => {
    const subscriber = createSubscriber();
    marketDataDistributor.subscribe(subscriber);

    // Connection timeout check
    const timeoutId = setTimeout(() => {
      if (!isConnected) {
        console.warn(`No data received for symbol ${symbol} within 10 seconds`);
      }
    }, 10000);

    return () => {
      marketDataDistributor.unsubscribe(subscriberIdRef.current);
      clearTimeout(timeoutId);
    };
  }, [symbol, createSubscriber, isConnected]);

  // Handle price click
  const handlePriceClick = useCallback(() => {
    if (priceData && onPriceClick) {
      const midPrice = (priceData.bid + priceData.ask) / 2;
      onPriceClick(symbol, midPrice);
    }
  }, [priceData, onPriceClick, symbol]);

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!priceData) {
    return (
      <div className={`p-4 border border-gray-200 rounded-lg bg-gray-50 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="text-lg font-medium text-gray-900">{symbol}</div>
          <div className="text-sm text-gray-500">
            {isConnected ? 'Loading...' : 'Connecting...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 border border-gray-200 rounded-lg bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">{symbol}</h3>
          {marketStatus && <MarketStatusIndicator status={marketStatus} />}
        </div>
        <div className="text-xs text-gray-500">
          {lastUpdate && formatTimestamp(lastUpdate)}
        </div>
      </div>

      {/* Price Information */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div 
          className="cursor-pointer hover:bg-gray-50 p-2 rounded"
          onClick={handlePriceClick}
        >
          <div className="text-sm text-gray-600">Bid</div>
          <div className="text-xl font-mono font-bold text-red-600">
            {priceData.bid.toFixed(5)}
          </div>
        </div>
        <div 
          className="cursor-pointer hover:bg-gray-50 p-2 rounded"
          onClick={handlePriceClick}
        >
          <div className="text-sm text-gray-600">Ask</div>
          <div className="text-xl font-mono font-bold text-green-600">
            {priceData.ask.toFixed(5)}
          </div>
        </div>
      </div>

      {/* Price Change */}
      {(priceData.change !== 0 || priceData.changePercent !== 0) && (
        <div className="mb-3">
          <PriceChangeIndicator 
            change={priceData.change} 
            changePercent={priceData.changePercent} 
          />
        </div>
      )}

      {/* Spread Information */}
      {spreadData && (
        <div className="mb-3">
          <SpreadIndicator 
            spread={spreadData.spread}
            spreadPercent={spreadData.spreadPercent}
            isWidening={spreadData.isWidening}
          />
        </div>
      )}

      {/* Details Section */}
      {showDetails && (
        <div className="space-y-3">
          {/* 24h High/Low */}
          {(priceData.high24h || priceData.low24h) && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {priceData.high24h && (
                <div>
                  <span className="text-gray-600">24h High: </span>
                  <span className="font-mono text-green-600">{priceData.high24h.toFixed(5)}</span>
                </div>
              )}
              {priceData.low24h && (
                <div>
                  <span className="text-gray-600">24h Low: </span>
                  <span className="font-mono text-red-600">{priceData.low24h.toFixed(5)}</span>
                </div>
              )}
            </div>
          )}

          {/* Volatility */}
          {volatilityData && (
            <div className="text-sm">
              <span className="text-gray-600">Volatility: </span>
              <span className="font-medium">
                {volatilityData.currentVolatility.toFixed(2)}%
              </span>
              <span className="text-gray-500 ml-2">
                (Rank: {volatilityData.volatilityRank.toFixed(0)}/100)
              </span>
            </div>
          )}

          {/* Trend Information */}
          {trendInfo && (
            <div>
              <div className="text-sm text-gray-600 mb-1">Trend</div>
              <TrendIndicator trend={trendInfo} />
            </div>
          )}

          {/* Moving Averages */}
          {movingAverages.length > 0 && (
            <div>
              <div className="text-sm text-gray-600 mb-2">Moving Averages</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {movingAverages.slice(0, 6).map((ma) => (
                  <div key={ma.period} className="text-center p-1 bg-gray-50 rounded">
                    <div className="text-gray-600">MA{ma.period}</div>
                    <div className="font-mono">{ma.value.toFixed(5)}</div>
                    <div className={`text-xs ${ma.trend === 'up' ? 'text-green-600' : ma.trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                      {ma.trend === 'up' ? '↑' : ma.trend === 'down' ? '↓' : '→'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Price Alerts */}
      {showAlerts && recentAlerts.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-2">Recent Alerts</div>
          <div className="space-y-2">
            {recentAlerts.slice(0, 3).map((alert) => (
              <PriceAlertBadge key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Connection Status Indicator */}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {lastUpdate && (
            <span>Updated: {formatTimestamp(lastUpdate)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PriceDisplay;