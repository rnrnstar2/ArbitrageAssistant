import { 
  TrailSettings, 
  TrailCalculationResult, 
  TRAIL_TYPES, 
  START_CONDITION_TYPES 
} from '../types';

/**
 * 価格データの型定義
 */
interface PriceData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: Date;
}

/**
 * ポジション情報の型定義
 */
interface PositionInfo {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  openTime: Date;
}

/**
 * ATR計算用の価格履歴データ
 */
interface PriceHistory {
  high: number;
  low: number;
  close: number;
  timestamp: Date;
}

/**
 * トレール計算エンジン
 * 各種トレールタイプの計算アルゴリズムを提供
 */
export class TrailCalculator {
  private static readonly DEFAULT_ATR_PERIOD = 14;
  private static readonly MIN_PRICE_PRECISION = 5;
  private static readonly MAX_TRAIL_DISTANCE_MULTIPLIER = 10;

  /**
   * メイントレール計算メソッド
   * 現在価格とトレール設定に基づいて損切りライン計算
   */
  static calculateTrail(
    position: PositionInfo,
    trailSettings: TrailSettings,
    currentPrice: number,
    maxFavorablePrice: number,
    priceHistory?: PriceHistory[]
  ): TrailCalculationResult {
    try {
      // 価格データバリデーション
      this.validatePriceData(position, currentPrice);

      // トレール発動条件の判定
      if (!this.shouldActivateTrail(position, trailSettings, currentPrice, maxFavorablePrice)) {
        return {
          shouldAdjust: false,
          newStopLoss: trailSettings.currentStopLoss,
          trailDistance: this.convertTrailDistance(trailSettings, position.symbol, currentPrice),
          reason: 'Trail activation conditions not met',
          confidence: 1.0,
          metadata: {
            currentPrice,
            previousStopLoss: trailSettings.currentStopLoss,
            maxPrice: maxFavorablePrice,
            minPrice: currentPrice,
          }
        };
      }

      // トレールタイプ別計算
      const calculationResult = this.calculateByType(
        position,
        trailSettings,
        currentPrice,
        maxFavorablePrice,
        priceHistory
      );

      // 損切りライン更新判定
      const shouldUpdate = this.shouldUpdateStopLoss(
        position,
        trailSettings.currentStopLoss,
        calculationResult.newStopLoss
      );

      return {
        ...calculationResult,
        shouldAdjust: shouldUpdate,
        confidence: this.calculateConfidence(position, trailSettings, currentPrice, maxFavorablePrice)
      };

    } catch (error) {
      return {
        shouldAdjust: false,
        newStopLoss: trailSettings.currentStopLoss,
        trailDistance: 0,
        reason: `Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.0,
        metadata: {
          currentPrice,
          previousStopLoss: trailSettings.currentStopLoss,
          maxPrice: maxFavorablePrice,
          minPrice: currentPrice,
        }
      };
    }
  }

  /**
   * 固定幅トレール計算
   */
  private static calculateFixedTrail(
    position: PositionInfo,
    trailSettings: TrailSettings,
    currentPrice: number,
    maxFavorablePrice: number
  ): Omit<TrailCalculationResult, 'shouldAdjust' | 'confidence'> {
    const trailDistance = trailSettings.trailAmount;
    const isBuyPosition = position.type === 'buy';

    let newStopLoss: number;
    if (isBuyPosition) {
      // Buy position: trail below current price
      newStopLoss = maxFavorablePrice - trailDistance;
    } else {
      // Sell position: trail above current price  
      newStopLoss = maxFavorablePrice + trailDistance;
    }

    // 精度調整
    newStopLoss = this.roundToSymbolPrecision(newStopLoss, position.symbol);

    return {
      newStopLoss,
      trailDistance,
      reason: `Fixed trail: ${trailDistance} distance from max favorable price`,
      metadata: {
        currentPrice,
        previousStopLoss: trailSettings.currentStopLoss,
        maxPrice: maxFavorablePrice,
        minPrice: currentPrice,
      }
    };
  }

  /**
   * パーセンテージトレール計算
   */
  private static calculatePercentageTrail(
    position: PositionInfo,
    trailSettings: TrailSettings,
    currentPrice: number,
    maxFavorablePrice: number
  ): Omit<TrailCalculationResult, 'shouldAdjust' | 'confidence'> {
    const trailPercentage = trailSettings.trailAmount / 100; // パーセンテージを小数に変換
    const isBuyPosition = position.type === 'buy';

    let newStopLoss: number;
    let trailDistance: number;

    if (isBuyPosition) {
      trailDistance = maxFavorablePrice * trailPercentage;
      newStopLoss = maxFavorablePrice - trailDistance;
    } else {
      trailDistance = maxFavorablePrice * trailPercentage;
      newStopLoss = maxFavorablePrice + trailDistance;
    }

    // 精度調整
    newStopLoss = this.roundToSymbolPrecision(newStopLoss, position.symbol);

    return {
      newStopLoss,
      trailDistance,
      reason: `Percentage trail: ${trailSettings.trailAmount}% (${trailDistance}) from max favorable price`,
      metadata: {
        currentPrice,
        previousStopLoss: trailSettings.currentStopLoss,
        maxPrice: maxFavorablePrice,
        minPrice: currentPrice,
      }
    };
  }

  /**
   * ATRベーストレール計算
   */
  private static calculateATRTrail(
    position: PositionInfo,
    trailSettings: TrailSettings,
    currentPrice: number,
    maxFavorablePrice: number,
    priceHistory?: PriceHistory[]
  ): Omit<TrailCalculationResult, 'shouldAdjust' | 'confidence'> {
    // ATR計算
    const atr = this.calculateATR(priceHistory || [], this.DEFAULT_ATR_PERIOD);
    const trailMultiplier = trailSettings.trailAmount; // ATRの倍数
    const trailDistance = atr * trailMultiplier;
    const isBuyPosition = position.type === 'buy';

    let newStopLoss: number;
    if (isBuyPosition) {
      newStopLoss = maxFavorablePrice - trailDistance;
    } else {
      newStopLoss = maxFavorablePrice + trailDistance;
    }

    // 精度調整
    newStopLoss = this.roundToSymbolPrecision(newStopLoss, position.symbol);

    return {
      newStopLoss,
      trailDistance,
      reason: `ATR trail: ${trailMultiplier}x ATR (${atr.toFixed(5)}) = ${trailDistance.toFixed(5)} from max favorable price`,
      metadata: {
        currentPrice,
        previousStopLoss: trailSettings.currentStopLoss,
        maxPrice: maxFavorablePrice,
        minPrice: currentPrice,
      }
    };
  }

  /**
   * トレールタイプ別計算の分岐処理
   */
  private static calculateByType(
    position: PositionInfo,
    trailSettings: TrailSettings,
    currentPrice: number,
    maxFavorablePrice: number,
    priceHistory?: PriceHistory[]
  ): Omit<TrailCalculationResult, 'shouldAdjust' | 'confidence'> {
    switch (trailSettings.type) {
      case TRAIL_TYPES.FIXED:
        return this.calculateFixedTrail(position, trailSettings, currentPrice, maxFavorablePrice);
      
      case TRAIL_TYPES.PERCENTAGE:
        return this.calculatePercentageTrail(position, trailSettings, currentPrice, maxFavorablePrice);
      
      case TRAIL_TYPES.ATR:
        return this.calculateATRTrail(position, trailSettings, currentPrice, maxFavorablePrice, priceHistory);
      
      default:
        throw new Error(`Unsupported trail type: ${trailSettings.type}`);
    }
  }

  /**
   * トレール発動条件の判定
   */
  private static shouldActivateTrail(
    position: PositionInfo,
    trailSettings: TrailSettings,
    currentPrice: number,
    maxFavorablePrice: number
  ): boolean {
    if (!trailSettings.isActive) {
      return false;
    }

    const { startCondition } = trailSettings;
    
    switch (startCondition.type) {
      case START_CONDITION_TYPES.IMMEDIATE:
        return true;
      
      case START_CONDITION_TYPES.PROFIT_THRESHOLD:
        return position.profit >= (startCondition.value || 0);
      
      case START_CONDITION_TYPES.PRICE_LEVEL:
        const targetPrice = startCondition.value;
        if (!targetPrice) return false;
        
        const isBuyPosition = position.type === 'buy';
        if (isBuyPosition) {
          return currentPrice >= targetPrice;
        } else {
          return currentPrice <= targetPrice;
        }
      
      default:
        return false;
    }
  }

  /**
   * 損切りライン更新判定
   */
  private static shouldUpdateStopLoss(
    position: PositionInfo,
    currentStopLoss: number,
    newStopLoss: number
  ): boolean {
    const isBuyPosition = position.type === 'buy';
    
    if (isBuyPosition) {
      // Buy position: 新しいStop Lossが現在より高い場合のみ更新
      return newStopLoss > currentStopLoss;
    } else {
      // Sell position: 新しいStop Lossが現在より低い場合のみ更新
      return newStopLoss < currentStopLoss;
    }
  }

  /**
   * 最適トレール距離算出
   */
  static calculateOptimalTrailDistance(
    position: PositionInfo,
    priceHistory: PriceHistory[],
    volatilityPeriod: number = 20
  ): number {
    // 最近のボラティリティ計算
    const recentPrices = priceHistory.slice(-volatilityPeriod);
    if (recentPrices.length < 2) {
      return this.getDefaultTrailDistance(position.symbol);
    }

    // 標準偏差ベースのボラティリティ計算
    const closes = recentPrices.map(p => p.close);
    const mean = closes.reduce((sum, close) => sum + close, 0) / closes.length;
    const variance = closes.reduce((sum, close) => sum + Math.pow(close - mean, 2), 0) / closes.length;
    const volatility = Math.sqrt(variance);

    // ATR計算
    const atr = this.calculateATR(recentPrices, Math.min(14, recentPrices.length));

    // 最適距離 = ATR * ボラティリティ調整係数
    const volatilityAdjustment = Math.max(0.5, Math.min(3.0, volatility / mean * 1000));
    return atr * volatilityAdjustment;
  }

  /**
   * ATR計算機能
   */
  private static calculateATR(priceHistory: PriceHistory[], period: number = 14): number {
    if (priceHistory.length < 2) {
      return 0;
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < priceHistory.length; i++) {
      const current = priceHistory[i];
      const previous = priceHistory[i - 1];
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    // 指定期間の平均TR
    const effectivePeriod = Math.min(period, trueRanges.length);
    const recentTRs = trueRanges.slice(-effectivePeriod);
    
    return recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;
  }

  /**
   * 価格データバリデーション
   */
  private static validatePriceData(position: PositionInfo, currentPrice: number): void {
    if (!position || !position.symbol) {
      throw new Error('Invalid position data');
    }

    if (typeof currentPrice !== 'number' || currentPrice <= 0) {
      throw new Error('Invalid current price');
    }

    if (typeof position.openPrice !== 'number' || position.openPrice <= 0) {
      throw new Error('Invalid open price');
    }

    // 価格の妥当性チェック（極端な価格変動の検出）
    const priceChangeRatio = Math.abs(currentPrice - position.openPrice) / position.openPrice;
    if (priceChangeRatio > 0.5) { // 50%以上の変動は異常とみなす
      throw new Error(`Extreme price change detected: ${(priceChangeRatio * 100).toFixed(2)}%`);
    }
  }

  /**
   * トレール距離変換（pips⇔価格）
   */
  static convertTrailDistance(trailSettings: TrailSettings, symbol: string, currentPrice: number): number {
    if (trailSettings.type === TRAIL_TYPES.FIXED) {
      return trailSettings.trailAmount;
    }
    
    if (trailSettings.type === TRAIL_TYPES.PERCENTAGE) {
      return currentPrice * (trailSettings.trailAmount / 100);
    }
    
    // ATRの場合は、実際のATR値に基づいて計算する必要がある
    // ここでは概算値を返す
    return this.getDefaultTrailDistance(symbol) * trailSettings.trailAmount;
  }

  /**
   * Pips to Price conversion
   */
  static pipsToPrice(pips: number, symbol: string): number {
    const pipValue = this.getPipValue(symbol);
    return pips * pipValue;
  }

  /**
   * Price to Pips conversion
   */
  static priceToPips(priceDistance: number, symbol: string): number {
    const pipValue = this.getPipValue(symbol);
    return priceDistance / pipValue;
  }

  /**
   * 通貨ペア別のPip価値取得
   */
  private static getPipValue(symbol: string): number {
    // JPY pairs (e.g., USDJPY, EURJPY, GBPJPY)
    if (symbol.includes('JPY')) {
      return 0.01;
    }
    
    // Most major pairs (e.g., EURUSD, GBPUSD, AUDUSD)
    return 0.0001;
  }

  /**
   * 通貨ペア別のデフォルトトレール距離取得
   */
  private static getDefaultTrailDistance(symbol: string): number {
    // JPY pairs
    if (symbol.includes('JPY')) {
      return 0.20; // 20 pips
    }
    
    // Major pairs
    const majorPairs = ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF'];
    if (majorPairs.some(pair => symbol.includes(pair))) {
      return 0.0020; // 20 pips
    }
    
    // Minor pairs and exotics
    return 0.0030; // 30 pips
  }

  /**
   * 通貨ペア別の価格精度に丸め
   */
  private static roundToSymbolPrecision(price: number, symbol: string): number {
    const precision = symbol.includes('JPY') ? 3 : 5;
    return Math.round(price * Math.pow(10, precision)) / Math.pow(10, precision);
  }

  /**
   * 計算信頼度の計算
   */
  private static calculateConfidence(
    position: PositionInfo,
    trailSettings: TrailSettings,
    currentPrice: number,
    maxFavorablePrice: number
  ): number {
    let confidence = 1.0;

    // 価格データの新しさ
    const timeSinceUpdate = Date.now() - new Date(position.openTime).getTime();
    if (timeSinceUpdate > 60000) { // 1分以上古い
      confidence *= 0.9;
    }

    // トレール距離の妥当性
    const trailDistance = this.convertTrailDistance(trailSettings, position.symbol, currentPrice);
    const priceRange = Math.abs(maxFavorablePrice - position.openPrice);
    
    if (priceRange > 0) {
      const trailRatio = trailDistance / priceRange;
      if (trailRatio > 0.5) { // トレール距離が価格レンジの50%以上
        confidence *= 0.8;
      }
    }

    // 利益状況
    if (position.profit < 0) {
      confidence *= 0.7; // マイナスポジションは信頼度を下げる
    }

    return Math.max(0.1, confidence); // 最低10%の信頼度は保持
  }

  /**
   * 最大有利価格の更新判定
   */
  static shouldUpdateMaxFavorablePrice(
    position: PositionInfo,
    currentPrice: number,
    currentMaxFavorablePrice: number
  ): boolean {
    const isBuyPosition = position.type === 'buy';
    
    if (isBuyPosition) {
      return currentPrice > currentMaxFavorablePrice;
    } else {
      return currentPrice < currentMaxFavorablePrice;
    }
  }

  /**
   * 初期最大有利価格の計算
   */
  static calculateInitialMaxFavorablePrice(position: PositionInfo, currentPrice: number): number {
    const isBuyPosition = position.type === 'buy';
    
    if (isBuyPosition) {
      return Math.max(position.openPrice, currentPrice);
    } else {
      return Math.min(position.openPrice, currentPrice);
    }
  }
}