import { Position, Strategy, PriceData, EntryParams, RiskAssessment, TradingRiskMetrics, RiskLimits } from '@repo/shared-types';

export class RiskManager {
  private riskLimits: RiskLimits;
  private dailyPnL: number = 0;
  private dailyResetTime: Date = new Date();
  private tradingHistory: Map<string, number> = new Map(); // symbol -> volume
  
  constructor(riskLimits: RiskLimits) {
    this.riskLimits = riskLimits;
    this.resetDailyPnLIfNeeded();
  }
  
  async assessPosition(position: Position, priceData: PriceData): Promise<RiskAssessment> {
    const metrics = await this.calculateRiskMetrics(position, priceData);
    
    // クリティカルリスクのチェック
    if (metrics.marginLevel <= this.riskLimits.stopOutLevel) {
      return {
        shouldClose: true,
        reason: 'Stop out level reached',
        riskLevel: 'critical',
        metrics
      };
    }
    
    // 最大損失のチェック
    if (metrics.unrealizedPnL <= -this.riskLimits.maxDailyLoss) {
      return {
        shouldClose: true,
        reason: 'Maximum daily loss exceeded',
        riskLevel: 'critical',
        metrics
      };
    }
    
    // 最大ドローダウンのチェック
    if (Math.abs(metrics.unrealizedPnL) >= this.riskLimits.maxDrawdown) {
      return {
        shouldClose: true,
        reason: 'Maximum drawdown exceeded',
        riskLevel: 'critical',
        metrics
      };
    }
    
    // マージンコールレベルのチェック
    if (metrics.marginLevel <= this.riskLimits.marginCallLevel) {
      return {
        shouldClose: false,
        reason: 'Margin call level approached',
        riskLevel: 'high',
        metrics
      };
    }
    
    return {
      shouldClose: false,
      riskLevel: this.determineRiskLevel(metrics),
      metrics
    };
  }
  
  async validateEntry(strategy: Strategy, entryParams: EntryParams): Promise<{
    approved: boolean;
    reason?: string;
  }> {
    // ポジションサイズチェック
    if (entryParams.volume > this.riskLimits.maxPositionSize) {
      return {
        approved: false,
        reason: 'Position size exceeds maximum allowed'
      };
    }
    
    // シンボル別エクスポージャーチェック
    const currentExposure = await this.getSymbolExposure(entryParams.symbol);
    if (currentExposure + entryParams.volume > this.riskLimits.maxExposurePerSymbol) {
      return {
        approved: false,
        reason: 'Symbol exposure limit exceeded'
      };
    }
    
    // 日次損失チェック
    this.resetDailyPnLIfNeeded();
    if (this.dailyPnL <= -this.riskLimits.maxDailyLoss) {
      return {
        approved: false,
        reason: 'Daily loss limit reached'
      };
    }
    
    // 戦略固有のリスクチェック
    if (strategy.maxRisk && entryParams.volume > strategy.maxRisk) {
      return {
        approved: false,
        reason: 'Strategy risk limit exceeded'
      };
    }
    
    return { approved: true };
  }
  
  private async calculateRiskMetrics(
    position: Position, 
    priceData: PriceData
  ): Promise<TradingRiskMetrics> {
    const unrealizedPnL = this.calculateUnrealizedPnL(position, priceData);
    const riskPercent = this.calculateRiskPercent(position, unrealizedPnL);
    const marginLevel = await this.calculateMarginLevel();
    const exposureBySymbol = await this.getExposureBySymbol();
    const totalExposure = Object.values(exposureBySymbol).reduce((sum, exp) => sum + Math.abs(exp), 0);
    
    return {
      unrealizedPnL,
      riskPercent,
      marginLevel,
      exposureBySymbol,
      totalExposure
    };
  }
  
  private calculateUnrealizedPnL(position: Position, priceData: PriceData): number {
    if (!position.entryPrice) return 0;
    
    const currentPrice = this.isLongPosition(position) ? priceData.bid : priceData.ask;
    const priceDiff = this.isLongPosition(position) 
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;
    
    return priceDiff * Math.abs(position.volume) * this.getContractSize(position.symbol);
  }
  
  private determineRiskLevel(metrics: TradingRiskMetrics): 'low' | 'medium' | 'high' | 'critical' {
    if (metrics.marginLevel <= this.riskLimits.marginCallLevel * 1.1) return 'high';
    if (metrics.riskPercent >= 80) return 'high';
    if (metrics.riskPercent >= 50) return 'medium';
    return 'low';
  }
  
  private isLongPosition(position: Position): boolean {
    return position.volume > 0;
  }
  
  private getContractSize(symbol: string): number {
    // 通貨ペアごとの契約サイズ
    const contractSizes: Record<string, number> = {
      'USDJPY': 100000,
      'EURJPY': 100000,
      'GBPJPY': 100000,
      'AUDJPY': 100000,
      'NZDJPY': 100000,
      'CADJPY': 100000,
      'CHFJPY': 100000,
      'EURUSD': 100000,
      'GBPUSD': 100000,
      'AUDUSD': 100000,
      'NZDUSD': 100000,
      'USDCAD': 100000,
      'USDCHF': 100000,
      'EURGBP': 100000,
      'EURAUD': 100000,
      'EURNZD': 100000,
      'EURCAD': 100000,
      'EURCHF': 100000,
      'GBPAUD': 100000,
      'GBPNZD': 100000,
      'GBPCAD': 100000,
      'GBPCHF': 100000,
      'AUDNZD': 100000,
      'AUDCAD': 100000,
      'AUDCHF': 100000,
      'NZDCAD': 100000,
      'NZDCHF': 100000,
      'CADCHF': 100000
    };
    
    return contractSizes[symbol] || 100000; // 標準ロット
  }
  
  private async getSymbolExposure(symbol: string): Promise<number> {
    // シンボル別の現在のエクスポージャー計算
    // 実装要：実際のポジションデータから計算
    return this.tradingHistory.get(symbol) || 0;
  }
  
  private async getExposureBySymbol(): Promise<Record<string, number>> {
    // 全シンボルのエクスポージャー計算
    // 実装要：実際のポジションデータから計算
    const exposure: Record<string, number> = {};
    this.tradingHistory.forEach((volume, symbol) => {
      exposure[symbol] = volume;
    });
    return exposure;
  }
  
  private async calculateMarginLevel(): Promise<number> {
    // マージンレベル計算
    // 実装要：実際のアカウント情報から計算
    // 仮の値として1000%を返す（健全な状態）
    return 1000;
  }
  
  private calculateRiskPercent(position: Position, unrealizedPnL: number): number {
    // リスク％計算
    // 簡易計算：未実現損益の絶対値 / 想定元本 * 100
    const notionalValue = Math.abs(position.volume) * this.getContractSize(position.symbol);
    return notionalValue > 0 ? (Math.abs(unrealizedPnL) / notionalValue) * 100 : 0;
  }
  
  private resetDailyPnLIfNeeded(): void {
    const now = new Date();
    const resetTime = new Date(this.dailyResetTime);
    resetTime.setDate(now.getDate());
    resetTime.setHours(0, 0, 0, 0);
    
    if (now >= resetTime && now.getTime() - resetTime.getTime() >= 24 * 60 * 60 * 1000) {
      this.dailyPnL = 0;
      this.dailyResetTime = now;
    }
  }
  
  // 公開メソッド
  updateDailyPnL(pnl: number): void {
    this.resetDailyPnLIfNeeded();
    this.dailyPnL += pnl;
  }
  
  getDailyPnL(): number {
    this.resetDailyPnLIfNeeded();
    return this.dailyPnL;
  }
  
  updateSymbolExposure(symbol: string, volume: number): void {
    const currentExposure = this.tradingHistory.get(symbol) || 0;
    this.tradingHistory.set(symbol, currentExposure + volume);
  }
  
  getRiskLimits(): RiskLimits {
    return { ...this.riskLimits };
  }
  
  updateRiskLimits(newLimits: Partial<RiskLimits>): void {
    this.riskLimits = { ...this.riskLimits, ...newLimits };
  }
  
  // デバッグ・監視用メソッド
  getRiskSummary(): {
    dailyPnL: number;
    totalExposure: number;
    symbolCount: number;
    riskLimits: RiskLimits;
    lastReset: Date;
  } {
    const totalExposure = Array.from(this.tradingHistory.values())
      .reduce((sum, volume) => sum + Math.abs(volume), 0);
    
    return {
      dailyPnL: this.dailyPnL,
      totalExposure,
      symbolCount: this.tradingHistory.size,
      riskLimits: this.riskLimits,
      lastReset: this.dailyResetTime
    };
  }
  
  // アラート機能
  checkAlerts(): {
    level: 'info' | 'warning' | 'critical';
    message: string;
  }[] {
    const alerts: { level: 'info' | 'warning' | 'critical'; message: string }[] = [];
    
    // 日次損失アラート
    if (this.dailyPnL <= -this.riskLimits.maxDailyLoss * 0.8) {
      alerts.push({
        level: 'warning',
        message: `Daily loss approaching limit: ${this.dailyPnL.toFixed(2)} (${(-this.dailyPnL / this.riskLimits.maxDailyLoss * 100).toFixed(1)}%)`
      });
    }
    
    // シンボル別エクスポージャーアラート
    this.tradingHistory.forEach((volume, symbol) => {
      if (Math.abs(volume) >= this.riskLimits.maxExposurePerSymbol * 0.9) {
        alerts.push({
          level: 'warning',
          message: `High exposure for ${symbol}: ${Math.abs(volume).toFixed(2)} (${(Math.abs(volume) / this.riskLimits.maxExposurePerSymbol * 100).toFixed(1)}%)`
        });
      }
    });
    
    return alerts;
  }
}