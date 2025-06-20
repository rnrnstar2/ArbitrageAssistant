import { PriceData, SpreadData, VolatilityData } from './market-receiver';

// Price analysis result interfaces
export interface TrendInfo {
  direction: 'up' | 'down' | 'sideways';
  strength: number; // 0-100
  duration: number; // minutes
  confidence: number; // 0-100
  startPrice: number;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
}

export interface PriceAlert {
  id: string;
  type: 'resistance' | 'support' | 'breakout' | 'unusual_movement' | 'volatility_spike' | 'spread_widening';
  symbol: string;
  price: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PricePattern {
  type: 'double_top' | 'double_bottom' | 'head_shoulders' | 'triangle' | 'channel' | 'flag';
  confidence: number; // 0-100
  startTime: Date;
  endTime: Date;
  keyLevels: number[];
  description: string;
  tradingSignal: 'bullish' | 'bearish' | 'neutral';
}

export interface MovingAverageData {
  period: number;
  value: number;
  trend: 'up' | 'down' | 'flat';
  crossover?: {
    type: 'golden_cross' | 'death_cross';
    timestamp: Date;
  };
}

export interface SupportResistanceLevel {
  level: number;
  type: 'support' | 'resistance';
  strength: number; // 0-100, based on how many times it was tested
  lastTested: Date;
  touches: number;
}

// Price analyzer interface
export interface IPriceAnalyzer {
  addPriceData(symbol: string, priceData: PriceData): void;
  calculateMovingAverage(symbol: string, period: number): number | null;
  calculateVolatility(symbol: string, period: number): number | null;
  detectPriceAlert(symbol: string, currentPrice: number): PriceAlert[];
  analyzeTrend(symbol: string, timeframe: number): TrendInfo | null;
  detectPricePatterns(symbol: string): PricePattern[];
  findSupportResistance(symbol: string): SupportResistanceLevel[];
  getMovingAverages(symbol: string): MovingAverageData[];
}

// Price analyzer implementation
export class PriceAnalyzer implements IPriceAnalyzer {
  private priceHistory: Map<string, PriceData[]> = new Map();
  private alertHistory: Map<string, PriceAlert[]> = new Map();
  private supportResistanceLevels: Map<string, SupportResistanceLevel[]> = new Map();
  
  private readonly maxHistorySize = 2000; // Maximum number of price points to keep
  private readonly alertRetentionTime = 24 * 60 * 60 * 1000; // 24 hours in ms

  // Standard moving average periods
  private readonly standardPeriods = [5, 10, 20, 50, 100, 200];

  /**
   * Add new price data for analysis
   */
  public addPriceData(symbol: string, priceData: PriceData): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push(priceData);

    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }

    // Update analysis
    this.updateAnalysis(symbol);
  }

  /**
   * Calculate moving average for a specific period
   */
  public calculateMovingAverage(symbol: string, period: number): number | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < period) {
      return null;
    }

    const recent = history.slice(-period);
    const sum = recent.reduce((acc, data) => acc + (data.bid + data.ask) / 2, 0);
    return sum / period;
  }

  /**
   * Calculate volatility (standard deviation of returns) for a period
   */
  public calculateVolatility(symbol: string, period: number = 20): number | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < period + 1) {
      return null;
    }

    const recent = history.slice(-period - 1);
    const returns: number[] = [];

    // Calculate returns
    for (let i = 1; i < recent.length; i++) {
      const current = (recent[i].bid + recent[i].ask) / 2;
      const previous = (recent[i - 1].bid + recent[i - 1].ask) / 2;
      returns.push((current - previous) / previous);
    }

    // Calculate standard deviation
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * 100; // Convert to percentage
  }

  /**
   * Detect price alerts based on current conditions
   */
  public detectPriceAlert(symbol: string, currentPrice: number): PriceAlert[] {
    const alerts: PriceAlert[] = [];
    const history = this.priceHistory.get(symbol);
    
    if (!history || history.length < 20) {
      return alerts;
    }

    // Check for breakout alerts
    const breakoutAlert = this.checkBreakoutAlert(symbol, currentPrice, history);
    if (breakoutAlert) alerts.push(breakoutAlert);

    // Check for unusual movement
    const movementAlert = this.checkUnusualMovement(symbol, currentPrice, history);
    if (movementAlert) alerts.push(movementAlert);

    // Check for volatility spike
    const volatilityAlert = this.checkVolatilitySpike(symbol, history);
    if (volatilityAlert) alerts.push(volatilityAlert);

    // Check for support/resistance test
    const srAlert = this.checkSupportResistanceTest(symbol, currentPrice);
    if (srAlert) alerts.push(srAlert);

    // Store alerts
    this.storeAlerts(symbol, alerts);

    return alerts;
  }

  /**
   * Analyze price trend for a given timeframe
   */
  public analyzeTrend(symbol: string, timeframe: number = 60): TrendInfo | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 10) {
      return null;
    }

    const cutoffTime = new Date(Date.now() - timeframe * 60 * 1000);
    const recentData = history.filter(data => data.timestamp >= cutoffTime);
    
    if (recentData.length < 5) {
      return null;
    }

    const startPrice = (recentData[0].bid + recentData[0].ask) / 2;
    const currentPrice = (recentData[recentData.length - 1].bid + recentData[recentData.length - 1].ask) / 2;
    const priceChange = currentPrice - startPrice;
    const priceChangePercent = (priceChange / startPrice) * 100;

    // Calculate trend strength using linear regression
    const { slope, rSquared } = this.calculateLinearRegression(recentData);
    
    let direction: TrendInfo['direction'];
    if (Math.abs(slope) < 0.0001) {
      direction = 'sideways';
    } else {
      direction = slope > 0 ? 'up' : 'down';
    }

    const strength = Math.min(100, Math.abs(slope) * 10000);
    const confidence = rSquared * 100;
    const duration = timeframe;

    return {
      direction,
      strength,
      duration,
      confidence,
      startPrice,
      currentPrice,
      priceChange,
      priceChangePercent,
    };
  }

  /**
   * Detect price patterns in the data
   */
  public detectPricePatterns(symbol: string): PricePattern[] {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 50) {
      return [];
    }

    const patterns: PricePattern[] = [];

    // Detect double top/bottom patterns
    const doublePatterns = this.detectDoubleTopBottom(symbol, history);
    patterns.push(...doublePatterns);

    // Detect triangle patterns
    const trianglePatterns = this.detectTrianglePatterns(symbol, history);
    patterns.push(...trianglePatterns);

    // Detect channel patterns
    const channelPatterns = this.detectChannelPatterns(symbol, history);
    patterns.push(...channelPatterns);

    return patterns;
  }

  /**
   * Find support and resistance levels
   */
  public findSupportResistance(symbol: string): SupportResistanceLevel[] {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 50) {
      return [];
    }

    const levels: SupportResistanceLevel[] = [];
    const recentHistory = history.slice(-200); // Use last 200 data points

    // Find local highs and lows
    const highs = this.findLocalExtremes(recentHistory, 'high');
    const lows = this.findLocalExtremes(recentHistory, 'low');

    // Group similar levels
    const resistanceLevels = this.groupSimilarLevels(highs, 'resistance');
    const supportLevels = this.groupSimilarLevels(lows, 'support');

    levels.push(...resistanceLevels, ...supportLevels);

    // Store for future reference
    this.supportResistanceLevels.set(symbol, levels);

    return levels.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Get moving averages for standard periods
   */
  public getMovingAverages(symbol: string): MovingAverageData[] {
    const averages: MovingAverageData[] = [];

    for (const period of this.standardPeriods) {
      const value = this.calculateMovingAverage(symbol, period);
      if (value !== null) {
        const trend = this.getMovingAverageTrend(symbol, period);
        const crossover = this.detectCrossover(symbol, period);

        averages.push({
          period,
          value,
          trend,
          crossover,
        });
      }
    }

    return averages;
  }

  // Private helper methods

  private updateAnalysis(symbol: string): void {
    // Update support/resistance levels
    this.findSupportResistance(symbol);
    
    // Clean old alerts
    this.cleanOldAlerts(symbol);
  }

  private checkBreakoutAlert(symbol: string, currentPrice: number, history: PriceData[]): PriceAlert | null {
    const srLevels = this.supportResistanceLevels.get(symbol) || [];
    const tolerance = 0.0005; // 5 pips tolerance

    for (const level of srLevels) {
      if (level.strength > 70) { // Only strong levels
        const distance = Math.abs(currentPrice - level.level);
        const relativeDistance = distance / level.level;

        if (relativeDistance < tolerance) {
          const breakoutType = currentPrice > level.level ? 'resistance' : 'support';
          
          return {
            id: this.generateAlertId(),
            type: 'breakout',
            symbol,
            price: currentPrice,
            severity: level.strength > 90 ? 'critical' : 'warning',
            message: `Price breaking ${breakoutType} level at ${level.level.toFixed(5)}`,
            timestamp: new Date(),
            metadata: {
              level: level.level,
              strength: level.strength,
              levelType: level.type,
            },
          };
        }
      }
    }

    return null;
  }

  private checkUnusualMovement(symbol: string, currentPrice: number, history: PriceData[]): PriceAlert | null {
    if (history.length < 20) return null;

    const recent20 = history.slice(-20);
    const previousPrice = (recent20[recent20.length - 2].bid + recent20[recent20.length - 2].ask) / 2;
    const priceChange = Math.abs(currentPrice - previousPrice) / previousPrice;

    // Calculate average movement
    const movements: number[] = [];
    for (let i = 1; i < recent20.length - 1; i++) {
      const current = (recent20[i].bid + recent20[i].ask) / 2;
      const previous = (recent20[i - 1].bid + recent20[i - 1].ask) / 2;
      movements.push(Math.abs(current - previous) / previous);
    }

    const avgMovement = movements.reduce((sum, mov) => sum + mov, 0) / movements.length;
    const threshold = avgMovement * 3; // 3x average movement

    if (priceChange > threshold && priceChange > 0.001) { // At least 0.1% movement
      return {
        id: this.generateAlertId(),
        type: 'unusual_movement',
        symbol,
        price: currentPrice,
        severity: priceChange > threshold * 2 ? 'critical' : 'warning',
        message: `Unusual price movement: ${(priceChange * 100).toFixed(2)}% in one tick`,
        timestamp: new Date(),
        metadata: {
          movementPercent: priceChange * 100,
          averageMovement: avgMovement * 100,
          threshold: threshold * 100,
        },
      };
    }

    return null;
  }

  private checkVolatilitySpike(symbol: string, history: PriceData[]): PriceAlert | null {
    const currentVolatility = this.calculateVolatility(symbol, 10);
    const averageVolatility = this.calculateVolatility(symbol, 50);

    if (currentVolatility !== null && averageVolatility !== null) {
      const volatilityRatio = currentVolatility / averageVolatility;

      if (volatilityRatio > 2.0) { // 2x normal volatility
        return {
          id: this.generateAlertId(),
          type: 'volatility_spike',
          symbol,
          price: (history[history.length - 1].bid + history[history.length - 1].ask) / 2,
          severity: volatilityRatio > 3.0 ? 'critical' : 'warning',
          message: `Volatility spike: ${currentVolatility.toFixed(2)}% vs normal ${averageVolatility.toFixed(2)}%`,
          timestamp: new Date(),
          metadata: {
            currentVolatility,
            averageVolatility,
            ratio: volatilityRatio,
          },
        };
      }
    }

    return null;
  }

  private checkSupportResistanceTest(symbol: string, currentPrice: number): PriceAlert | null {
    const srLevels = this.supportResistanceLevels.get(symbol) || [];
    const tolerance = 0.0002; // 2 pips tolerance

    for (const level of srLevels) {
      const distance = Math.abs(currentPrice - level.level);
      const relativeDistance = distance / level.level;

      if (relativeDistance < tolerance) {
        return {
          id: this.generateAlertId(),
          type: level.type,
          symbol,
          price: currentPrice,
          severity: level.strength > 80 ? 'warning' : 'info',
          message: `Price testing ${level.type} level at ${level.level.toFixed(5)}`,
          timestamp: new Date(),
          metadata: {
            level: level.level,
            strength: level.strength,
            touches: level.touches,
          },
        };
      }
    }

    return null;
  }

  private calculateLinearRegression(data: PriceData[]): { slope: number; rSquared: number } {
    const n = data.length;
    const prices = data.map((d, i) => ({ x: i, y: (d.bid + d.ask) / 2 }));

    const sumX = prices.reduce((sum, p) => sum + p.x, 0);
    const sumY = prices.reduce((sum, p) => sum + p.y, 0);
    const sumXY = prices.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = prices.reduce((sum, p) => sum + p.x * p.x, 0);
    const sumYY = prices.reduce((sum, p) => sum + p.y * p.y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = prices.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0);
    const ssResidual = prices.reduce((sum, p) => {
      const predicted = slope * p.x + intercept;
      return sum + Math.pow(p.y - predicted, 2);
    }, 0);

    const rSquared = 1 - (ssResidual / ssTotal);

    return { slope, rSquared };
  }

  private detectDoubleTopBottom(symbol: string, history: PriceData[]): PricePattern[] {
    // Simplified implementation - in practice, this would be more sophisticated
    const patterns: PricePattern[] = [];
    const highs = this.findLocalExtremes(history, 'high');
    const lows = this.findLocalExtremes(history, 'low');

    // Look for double tops
    for (let i = 0; i < highs.length - 1; i++) {
      const first = highs[i];
      const second = highs[i + 1];
      const priceDiff = Math.abs(first.price - second.price) / first.price;

      if (priceDiff < 0.005 && (second.timestamp.getTime() - first.timestamp.getTime()) > 30 * 60 * 1000) {
        patterns.push({
          type: 'double_top',
          confidence: Math.max(0, 100 - priceDiff * 10000),
          startTime: first.timestamp,
          endTime: second.timestamp,
          keyLevels: [first.price, second.price],
          description: `Double top pattern at ${first.price.toFixed(5)}`,
          tradingSignal: 'bearish',
        });
      }
    }

    // Look for double bottoms
    for (let i = 0; i < lows.length - 1; i++) {
      const first = lows[i];
      const second = lows[i + 1];
      const priceDiff = Math.abs(first.price - second.price) / first.price;

      if (priceDiff < 0.005 && (second.timestamp.getTime() - first.timestamp.getTime()) > 30 * 60 * 1000) {
        patterns.push({
          type: 'double_bottom',
          confidence: Math.max(0, 100 - priceDiff * 10000),
          startTime: first.timestamp,
          endTime: second.timestamp,
          keyLevels: [first.price, second.price],
          description: `Double bottom pattern at ${first.price.toFixed(5)}`,
          tradingSignal: 'bullish',
        });
      }
    }

    return patterns;
  }

  private detectTrianglePatterns(symbol: string, history: PriceData[]): PricePattern[] {
    // Placeholder for triangle pattern detection
    return [];
  }

  private detectChannelPatterns(symbol: string, history: PriceData[]): PricePattern[] {
    // Placeholder for channel pattern detection
    return [];
  }

  private findLocalExtremes(history: PriceData[], type: 'high' | 'low'): Array<{ price: number; timestamp: Date; index: number }> {
    const extremes: Array<{ price: number; timestamp: Date; index: number }> = [];
    const lookback = 5; // Look 5 periods back and forward

    for (let i = lookback; i < history.length - lookback; i++) {
      const currentPrice = type === 'high' ? Math.max(history[i].bid, history[i].ask) : Math.min(history[i].bid, history[i].ask);
      let isExtreme = true;

      // Check if current point is local extreme
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        
        const comparePrice = type === 'high' ? Math.max(history[j].bid, history[j].ask) : Math.min(history[j].bid, history[j].ask);
        
        if (type === 'high' && comparePrice > currentPrice) {
          isExtreme = false;
          break;
        } else if (type === 'low' && comparePrice < currentPrice) {
          isExtreme = false;
          break;
        }
      }

      if (isExtreme) {
        extremes.push({
          price: currentPrice,
          timestamp: history[i].timestamp,
          index: i,
        });
      }
    }

    return extremes;
  }

  private groupSimilarLevels(extremes: Array<{ price: number; timestamp: Date; index: number }>, type: 'support' | 'resistance'): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const tolerance = 0.0005; // 5 pips tolerance for grouping

    for (const extreme of extremes) {
      let found = false;
      
      for (const level of levels) {
        const priceDiff = Math.abs(level.level - extreme.price) / level.level;
        
        if (priceDiff < tolerance) {
          // Update existing level
          level.touches++;
          level.lastTested = extreme.timestamp > level.lastTested ? extreme.timestamp : level.lastTested;
          level.strength = Math.min(100, level.strength + 10);
          found = true;
          break;
        }
      }
      
      if (!found) {
        levels.push({
          level: extreme.price,
          type,
          strength: 20, // Starting strength
          lastTested: extreme.timestamp,
          touches: 1,
        });
      }
    }

    return levels;
  }

  private getMovingAverageTrend(symbol: string, period: number): 'up' | 'down' | 'flat' {
    const current = this.calculateMovingAverage(symbol, period);
    const previous = this.calculateMovingAverageAtOffset(symbol, period, 1);

    if (current === null || previous === null) {
      return 'flat';
    }

    const diff = current - previous;
    const threshold = 0.0001; // Minimum change to consider as trend

    if (Math.abs(diff) < threshold) {
      return 'flat';
    }

    return diff > 0 ? 'up' : 'down';
  }

  private calculateMovingAverageAtOffset(symbol: string, period: number, offset: number): number | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < period + offset) {
      return null;
    }

    const endIndex = history.length - offset;
    const startIndex = endIndex - period;
    const slice = history.slice(startIndex, endIndex);
    
    const sum = slice.reduce((acc, data) => acc + (data.bid + data.ask) / 2, 0);
    return sum / period;
  }

  private detectCrossover(symbol: string, period: number): MovingAverageData['crossover'] {
    // Check for golden cross (short MA crosses above long MA) or death cross (opposite)
    const shortPeriod = period;
    const longPeriod = period * 2;

    const shortCurrent = this.calculateMovingAverage(symbol, shortPeriod);
    const shortPrevious = this.calculateMovingAverageAtOffset(symbol, shortPeriod, 1);
    const longCurrent = this.calculateMovingAverage(symbol, longPeriod);
    const longPrevious = this.calculateMovingAverageAtOffset(symbol, longPeriod, 1);

    if (shortCurrent === null || shortPrevious === null || longCurrent === null || longPrevious === null) {
      return undefined;
    }

    // Check for crossover
    const wasBelow = shortPrevious < longPrevious;
    const isAbove = shortCurrent > longCurrent;
    const wasAbove = shortPrevious > longPrevious;
    const isBelow = shortCurrent < longCurrent;

    if (wasBelow && isAbove) {
      return {
        type: 'golden_cross',
        timestamp: new Date(),
      };
    } else if (wasAbove && isBelow) {
      return {
        type: 'death_cross',
        timestamp: new Date(),
      };
    }

    return undefined;
  }

  private storeAlerts(symbol: string, alerts: PriceAlert[]): void {
    if (!this.alertHistory.has(symbol)) {
      this.alertHistory.set(symbol, []);
    }

    const history = this.alertHistory.get(symbol)!;
    history.push(...alerts);
  }

  private cleanOldAlerts(symbol: string): void {
    const history = this.alertHistory.get(symbol);
    if (!history) return;

    const cutoffTime = new Date(Date.now() - this.alertRetentionTime);
    const filteredHistory = history.filter(alert => alert.timestamp >= cutoffTime);
    this.alertHistory.set(symbol, filteredHistory);
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Get recent alerts for a symbol
   */
  public getRecentAlerts(symbol: string, hours: number = 24): PriceAlert[] {
    const history = this.alertHistory.get(symbol) || [];
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return history.filter(alert => alert.timestamp >= cutoffTime);
  }

  /**
   * Get analysis statistics for debugging
   */
  public getAnalysisStats(): {
    totalSymbols: number;
    totalDataPoints: number;
    totalAlerts: number;
    avgHistorySize: number;
  } {
    let totalDataPoints = 0;
    let totalAlerts = 0;

    for (const history of this.priceHistory.values()) {
      totalDataPoints += history.length;
    }

    for (const alerts of this.alertHistory.values()) {
      totalAlerts += alerts.length;
    }

    return {
      totalSymbols: this.priceHistory.size,
      totalDataPoints,
      totalAlerts,
      avgHistorySize: this.priceHistory.size > 0 ? totalDataPoints / this.priceHistory.size : 0,
    };
  }
}

// Singleton instance
export const priceAnalyzer = new PriceAnalyzer();