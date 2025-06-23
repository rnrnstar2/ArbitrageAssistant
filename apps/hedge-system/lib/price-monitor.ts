import { PriceData } from '@repo/shared-types';

export interface PriceStatistics {
  symbol: string;
  count: number;
  avgSpread: number;
  minSpread: number;
  maxSpread: number;
  avgPrice: number;
  volatility: number;
  lastUpdate: Date;
}

export interface PriceAlert {
  symbol: string;
  type: 'significant_move' | 'wide_spread' | 'stale_price' | 'volatility_spike';
  message: string;
  timestamp: Date;
  value: number;
  threshold: number;
}

export class PriceMonitor {
  private priceData: Map<string, PriceData> = new Map();
  private priceHistory: Map<string, PriceData[]> = new Map();
  private priceStats: Map<string, PriceStatistics> = new Map();
  private alerts: PriceAlert[] = [];
  private maxHistorySize = 1000;
  private maxAlertsSize = 100;
  
  // アラート設定
  private alertSettings = {
    significantMoveThreshold: 0.001, // 0.1%
    wideSpreadThreshold: 0.0005,     // 0.05%
    stalePriceTimeout: 60000,        // 60秒
    volatilitySpikeThreshold: 2.0    // 通常の2倍
  };
  
  updatePrice(priceData: PriceData): void {
    const previousPrice = this.priceData.get(priceData.symbol);
    
    // 現在価格の更新
    this.priceData.set(priceData.symbol, priceData);
    
    // 価格履歴の更新
    this.updatePriceHistory(priceData);
    
    // 統計情報の更新
    this.updatePriceStatistics(priceData);
    
    // アラートチェック
    this.checkPriceAlerts(priceData, previousPrice);
  }
  
  getCurrentPrice(symbol: string): PriceData | null {
    return this.priceData.get(symbol) || null;
  }
  
  getPriceHistory(symbol: string, count?: number): PriceData[] {
    const history = this.priceHistory.get(symbol) || [];
    return count ? history.slice(-count) : [...history];
  }
  
  getPriceStatistics(symbol: string): PriceStatistics | null {
    return this.priceStats.get(symbol) || null;
  }
  
  getAllPriceStatistics(): PriceStatistics[] {
    return Array.from(this.priceStats.values());
  }
  
  calculateVolatility(symbol: string, periods: number = 20): number {
    const history = this.getPriceHistory(symbol, periods);
    if (history.length < 2) return 0;
    
    const prices = history.map(h => (h.bid + h.ask) / 2);
    const returns = [];
    
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // 年間ボラティリティ
  }
  
  isSignificantPriceMove(symbol: string, threshold?: number): boolean {
    const moveThreshold = threshold || this.alertSettings.significantMoveThreshold;
    const history = this.getPriceHistory(symbol, 2);
    if (history.length < 2) return false;
    
    const [prev, current] = history.slice(-2);
    const prevMid = (prev.bid + prev.ask) / 2;
    const currentMid = (current.bid + current.ask) / 2;
    
    return Math.abs(currentMid - prevMid) / prevMid > moveThreshold;
  }
  
  isPriceStale(symbol: string, timeout?: number): boolean {
    const staleTimeout = timeout || this.alertSettings.stalePriceTimeout;
    const price = this.getCurrentPrice(symbol);
    if (!price) return true;
    
    return Date.now() - price.timestamp.getTime() > staleTimeout;
  }
  
  getSpread(symbol: string): number {
    const price = this.getCurrentPrice(symbol);
    return price ? price.spread : 0;
  }
  
  isWideSpread(symbol: string, threshold?: number): boolean {
    const spreadThreshold = threshold || this.alertSettings.wideSpreadThreshold;
    const price = this.getCurrentPrice(symbol);
    if (!price) return false;
    
    const midPrice = (price.bid + price.ask) / 2;
    return price.spread / midPrice > spreadThreshold;
  }
  
  private updatePriceHistory(priceData: PriceData): void {
    const history = this.priceHistory.get(priceData.symbol) || [];
    history.push(priceData);
    
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
    
    this.priceHistory.set(priceData.symbol, history);
  }
  
  private updatePriceStatistics(priceData: PriceData): void {
    const currentStats = this.priceStats.get(priceData.symbol);
    const history = this.priceHistory.get(priceData.symbol) || [];
    
    if (history.length === 0) return;
    
    const spreads = history.map(h => h.spread);
    const prices = history.map(h => (h.bid + h.ask) / 2);
    
    const stats: PriceStatistics = {
      symbol: priceData.symbol,
      count: history.length,
      avgSpread: spreads.reduce((sum, s) => sum + s, 0) / spreads.length,
      minSpread: Math.min(...spreads),
      maxSpread: Math.max(...spreads),
      avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      volatility: this.calculateVolatility(priceData.symbol),
      lastUpdate: priceData.timestamp
    };
    
    this.priceStats.set(priceData.symbol, stats);
  }
  
  private checkPriceAlerts(priceData: PriceData, previousPrice?: PriceData): void {
    const alerts: PriceAlert[] = [];
    
    // 大幅な価格変動チェック
    if (this.isSignificantPriceMove(priceData.symbol)) {
      const history = this.getPriceHistory(priceData.symbol, 2);
      if (history.length >= 2) {
        const [prev, current] = history.slice(-2);
        const prevMid = (prev.bid + prev.ask) / 2;
        const currentMid = (current.bid + current.ask) / 2;
        const change = Math.abs(currentMid - prevMid) / prevMid;
        
        alerts.push({
          symbol: priceData.symbol,
          type: 'significant_move',
          message: `Significant price move detected: ${(change * 100).toFixed(3)}%`,
          timestamp: priceData.timestamp,
          value: change,
          threshold: this.alertSettings.significantMoveThreshold
        });
      }
    }
    
    // 広いスプレッドチェック
    if (this.isWideSpread(priceData.symbol)) {
      const midPrice = (priceData.bid + priceData.ask) / 2;
      const spreadRatio = priceData.spread / midPrice;
      
      alerts.push({
        symbol: priceData.symbol,
        type: 'wide_spread',
        message: `Wide spread detected: ${(spreadRatio * 100).toFixed(3)}%`,
        timestamp: priceData.timestamp,
        value: spreadRatio,
        threshold: this.alertSettings.wideSpreadThreshold
      });
    }
    
    // ボラティリティスパイクチェック
    const currentVolatility = this.calculateVolatility(priceData.symbol, 10);
    const averageVolatility = this.calculateVolatility(priceData.symbol, 100);
    
    if (averageVolatility > 0 && currentVolatility > averageVolatility * this.alertSettings.volatilitySpikeThreshold) {
      alerts.push({
        symbol: priceData.symbol,
        type: 'volatility_spike',
        message: `Volatility spike detected: ${currentVolatility.toFixed(4)} vs avg ${averageVolatility.toFixed(4)}`,
        timestamp: priceData.timestamp,
        value: currentVolatility,
        threshold: averageVolatility * this.alertSettings.volatilitySpikeThreshold
      });
    }
    
    // アラートを追加
    this.alerts.push(...alerts);
    
    // アラート履歴のサイズ制限
    if (this.alerts.length > this.maxAlertsSize) {
      this.alerts = this.alerts.slice(-this.maxAlertsSize);
    }
  }
  
  // 古い価格データのチェック
  checkStalePrices(): PriceAlert[] {
    const staleAlerts: PriceAlert[] = [];
    const now = new Date();
    
    this.priceData.forEach((price, symbol) => {
      if (this.isPriceStale(symbol)) {
        const staleTime = now.getTime() - price.timestamp.getTime();
        staleAlerts.push({
          symbol,
          type: 'stale_price',
          message: `Stale price data: ${Math.floor(staleTime / 1000)} seconds old`,
          timestamp: now,
          value: staleTime,
          threshold: this.alertSettings.stalePriceTimeout
        });
      }
    });
    
    return staleAlerts;
  }
  
  // アラート取得
  getAlerts(symbol?: string, type?: PriceAlert['type']): PriceAlert[] {
    let filteredAlerts = [...this.alerts];
    
    if (symbol) {
      filteredAlerts = filteredAlerts.filter(alert => alert.symbol === symbol);
    }
    
    if (type) {
      filteredAlerts = filteredAlerts.filter(alert => alert.type === type);
    }
    
    return filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  // アラート設定の更新
  updateAlertSettings(settings: Partial<typeof this.alertSettings>): void {
    this.alertSettings = { ...this.alertSettings, ...settings };
  }
  
  getAlertSettings(): typeof this.alertSettings {
    return { ...this.alertSettings };
  }
  
  // 統計・監視用メソッド
  getMonitoringSummary(): {
    totalSymbols: number;
    totalPriceUpdates: number;
    totalAlerts: number;
    staleSymbols: number;
    averageSpread: number;
    lastUpdate: Date | null;
  } {
    const stats = this.getAllPriceStatistics();
    const totalUpdates = stats.reduce((sum, stat) => sum + stat.count, 0);
    const totalSpread = stats.reduce((sum, stat) => sum + stat.avgSpread, 0);
    const staleSymbols = Array.from(this.priceData.keys()).filter(symbol => this.isPriceStale(symbol)).length;
    
    const lastUpdateTimes = Array.from(this.priceData.values()).map(p => p.timestamp.getTime());
    const lastUpdate = lastUpdateTimes.length > 0 ? new Date(Math.max(...lastUpdateTimes)) : null;
    
    return {
      totalSymbols: this.priceData.size,
      totalPriceUpdates: totalUpdates,
      totalAlerts: this.alerts.length,
      staleSymbols,
      averageSpread: stats.length > 0 ? totalSpread / stats.length : 0,
      lastUpdate
    };
  }
  
  // デバッグ用メソッド
  clearHistory(symbol?: string): void {
    if (symbol) {
      this.priceHistory.delete(symbol);
      this.priceStats.delete(symbol);
    } else {
      this.priceHistory.clear();
      this.priceStats.clear();
    }
  }
  
  clearAlerts(): void {
    this.alerts = [];
  }
  
  /**
   * 全ての購読を解除
   */
  clearAllSubscriptions(): void {
    this.subscribers.clear();
    console.log('All price subscriptions cleared');
  }
  
  /**
   * 購読者の統計情報取得
   */
  getSubscriptionStats(): { symbol: string; subscriberCount: number }[] {
    return Array.from(this.subscribers.entries()).map(([symbol, callbacks]) => ({
      symbol,
      subscriberCount: callbacks.length
    }));
  }
}

// シングルトンインスタンス
export const priceMonitor = new PriceMonitor();