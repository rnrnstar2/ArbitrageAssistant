import {
  OpenPositionCommand,
  ClosePositionCommand,
  UpdateTrailCommand,
  AccountInfo,
} from '../websocket/message-types';

export interface TradeSafetyConfig {
  maxLotSize: number;
  maxMarginUsage: number; // 0.0 - 1.0 (percentage)
  priceDeviationLimit: number; // 0.0 - 1.0 (percentage)
  maxPositionsPerSymbol: number;
  maxTotalPositions: number;
  minMarginLevel: number; // percentage
  maxDailyLoss: number; // absolute amount
  maxDrawdown: number; // percentage
  allowedTradingHours: {
    start: string; // "HH:MM" format
    end: string;   // "HH:MM" format
    timezone: string;
  };
  blockedSymbols: string[];
  minLotSize: number;
  maxSpread: number; // in pips
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MarketCondition {
  symbol: string;
  currentPrice: number;
  spread: number;
  marketStatus: 'open' | 'closed' | 'weekend';
  volatility?: number;
}

export class TradeSafetyValidator {
  private config: TradeSafetyConfig;
  private currentPositions: Map<string, any[]> = new Map(); // accountId -> positions
  private dailyLosses: Map<string, number> = new Map(); // accountId -> daily loss

  constructor(config: Partial<TradeSafetyConfig> = {}) {
    this.config = {
      maxLotSize: 10.0,
      maxMarginUsage: 0.8, // 80%
      priceDeviationLimit: 0.05, // 5%
      maxPositionsPerSymbol: 3,
      maxTotalPositions: 20,
      minMarginLevel: 200, // 200%
      maxDailyLoss: 10000, // 10,000 units
      maxDrawdown: 0.2, // 20%
      allowedTradingHours: {
        start: "00:00",
        end: "23:59",
        timezone: "UTC"
      },
      blockedSymbols: [],
      minLotSize: 0.01,
      maxSpread: 50, // 5.0 pips
      ...config
    };
  }

  /**
   * ポジションオープンコマンドの包括的検証
   */
  validateOpenPositionCommand(
    command: OpenPositionCommand,
    accountInfo: AccountInfo,
    marketCondition?: MarketCondition
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 基本検証
    const basicValidation = this.validateBasicCommand(command);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);

    // 残高検証
    if (!this.validateBalance(command, accountInfo)) {
      errors.push('Insufficient balance for the trade');
    }

    // 証拠金検証
    if (!this.validateMargin(command, accountInfo)) {
      errors.push('Insufficient margin or exceeds maximum margin usage');
    }

    // ロットサイズ検証
    if (!this.validateLotSize(command)) {
      errors.push(`Lot size must be between ${this.config.minLotSize} and ${this.config.maxLotSize}`);
    }

    // 市場時間検証
    if (!this.validateMarketHours(command.symbol)) {
      errors.push('Market is currently closed or outside trading hours');
    }

    // シンボルブロック検証
    if (this.config.blockedSymbols.includes(command.symbol)) {
      errors.push(`Trading is blocked for symbol: ${command.symbol}`);
    }

    // ポジション数制限検証
    const positionLimitValidation = this.validatePositionLimits(command, accountInfo.accountId);
    errors.push(...positionLimitValidation.errors);
    warnings.push(...positionLimitValidation.warnings);

    // 市場条件検証
    if (marketCondition) {
      const marketValidation = this.validateMarketCondition(command, marketCondition);
      errors.push(...marketValidation.errors);
      warnings.push(...marketValidation.warnings);
    }

    // 日次損失制限検証
    const dailyLossValidation = this.validateDailyLoss(accountInfo);
    errors.push(...dailyLossValidation.errors);
    warnings.push(...dailyLossValidation.warnings);

    // 証拠金レベル検証
    if (accountInfo.marginLevel < this.config.minMarginLevel) {
      errors.push(`Margin level (${accountInfo.marginLevel}%) is below minimum (${this.config.minMarginLevel}%)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 基本的なコマンド検証
   */
  private validateBasicCommand(command: OpenPositionCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!command.symbol || command.symbol.trim().length === 0) {
      errors.push('Symbol is required');
    }

    if (!command.type || !['buy', 'sell'].includes(command.type)) {
      errors.push('Valid trade type (buy/sell) is required');
    }

    if (!command.lots || command.lots <= 0) {
      errors.push('Lot size must be positive');
    }

    if (command.price && command.price <= 0) {
      errors.push('Price must be positive if specified');
    }

    if (command.stopLoss && command.stopLoss <= 0) {
      errors.push('Stop loss must be positive if specified');
    }

    if (command.takeProfit && command.takeProfit <= 0) {
      errors.push('Take profit must be positive if specified');
    }

    // ストップロスとテイクプロフィットの妥当性チェック
    if (command.price && command.stopLoss && command.takeProfit) {
      if (command.type === 'buy') {
        if (command.stopLoss >= command.price) {
          errors.push('Stop loss must be below entry price for buy orders');
        }
        if (command.takeProfit <= command.price) {
          errors.push('Take profit must be above entry price for buy orders');
        }
      } else if (command.type === 'sell') {
        if (command.stopLoss <= command.price) {
          errors.push('Stop loss must be above entry price for sell orders');
        }
        if (command.takeProfit >= command.price) {
          errors.push('Take profit must be below entry price for sell orders');
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * 残高検証
   */
  validateBalance(command: OpenPositionCommand, accountInfo: AccountInfo): boolean {
    const requiredMargin = this.calculateRequiredMargin(command, accountInfo);
    return accountInfo.freeMargin >= requiredMargin;
  }

  /**
   * 証拠金検証
   */
  validateMargin(command: OpenPositionCommand, accountInfo: AccountInfo): boolean {
    const requiredMargin = this.calculateRequiredMargin(command, accountInfo);
    const marginUsage = (accountInfo.usedMargin + requiredMargin) / accountInfo.equity;
    return marginUsage <= this.config.maxMarginUsage;
  }

  /**
   * ロットサイズ検証
   */
  validateLotSize(command: OpenPositionCommand): boolean {
    return command.lots >= this.config.minLotSize && command.lots <= this.config.maxLotSize;
  }

  /**
   * 市場時間検証
   */
  validateMarketHours(symbol: string): boolean {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: this.config.allowedTradingHours.timezone,
      hour: '2-digit',
      minute: '2-digit'
    });

    const startTime = this.config.allowedTradingHours.start;
    const endTime = this.config.allowedTradingHours.end;

    // 簡単な時間比較（より複雑な市場時間ルールは別途実装）
    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * 価格範囲検証
   */
  validatePriceRange(command: OpenPositionCommand, currentPrice: number): boolean {
    if (!command.price) return true; // 成行注文の場合はスキップ

    const deviation = Math.abs(command.price - currentPrice) / currentPrice;
    return deviation <= this.config.priceDeviationLimit;
  }

  /**
   * ポジション数制限検証
   */
  private validatePositionLimits(command: OpenPositionCommand, accountId: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const positions = this.currentPositions.get(accountId) || [];
    
    // 総ポジション数チェック
    if (positions.length >= this.config.maxTotalPositions) {
      errors.push(`Maximum total positions limit reached (${this.config.maxTotalPositions})`);
    }

    // シンボル別ポジション数チェック
    const symbolPositions = positions.filter(p => p.symbol === command.symbol);
    if (symbolPositions.length >= this.config.maxPositionsPerSymbol) {
      errors.push(`Maximum positions for ${command.symbol} reached (${this.config.maxPositionsPerSymbol})`);
    }

    // 警告レベルのチェック
    if (positions.length > this.config.maxTotalPositions * 0.8) {
      warnings.push(`Approaching maximum position limit (${positions.length}/${this.config.maxTotalPositions})`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * 市場条件検証
   */
  private validateMarketCondition(command: OpenPositionCommand, market: MarketCondition): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 市場ステータスチェック
    if (market.marketStatus !== 'open') {
      errors.push(`Market is ${market.marketStatus}`);
    }

    // スプレッドチェック
    if (market.spread > this.config.maxSpread) {
      warnings.push(`High spread detected: ${market.spread} pips (max: ${this.config.maxSpread})`);
    }

    // 価格妥当性チェック
    if (command.price && !this.validatePriceRange(command, market.currentPrice)) {
      errors.push(`Price deviation too large from current market price`);
    }

    // ボラティリティチェック（オプション）
    if (market.volatility && market.volatility > 0.1) { // 10%以上のボラティリティ
      warnings.push(`High volatility detected: ${(market.volatility * 100).toFixed(1)}%`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * 日次損失制限検証
   */
  private validateDailyLoss(accountInfo: AccountInfo): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const dailyLoss = this.dailyLosses.get(accountInfo.accountId) || 0;
    
    if (Math.abs(dailyLoss) >= this.config.maxDailyLoss) {
      errors.push(`Daily loss limit exceeded: ${Math.abs(dailyLoss)} (max: ${this.config.maxDailyLoss})`);
    } else if (Math.abs(dailyLoss) >= this.config.maxDailyLoss * 0.8) {
      warnings.push(`Approaching daily loss limit: ${Math.abs(dailyLoss)} (max: ${this.config.maxDailyLoss})`);
    }

    // ドローダウンチェック
    const drawdown = (accountInfo.balance - accountInfo.equity) / accountInfo.balance;
    if (drawdown > this.config.maxDrawdown) {
      errors.push(`Maximum drawdown exceeded: ${(drawdown * 100).toFixed(1)}% (max: ${(this.config.maxDrawdown * 100).toFixed(1)}%)`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * 必要証拠金の計算
   */
  private calculateRequiredMargin(command: OpenPositionCommand, accountInfo: AccountInfo): number {
    // 簡単な計算例（実際にはシンボルごとの証拠金要件、レバレッジなどを考慮）
    const baseMargin = command.lots * 100000; // 1ロット = 100,000通貨と仮定
    return baseMargin / accountInfo.leverage;
  }

  /**
   * クローズコマンドの検証
   */
  validateClosePositionCommand(command: ClosePositionCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!command.positionId || command.positionId.trim().length === 0) {
      errors.push('Position ID is required');
    }

    if (command.lots && command.lots <= 0) {
      errors.push('Lot size for partial close must be positive');
    }

    if (command.price && command.price <= 0) {
      errors.push('Close price must be positive if specified');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * トレールコマンドの検証
   */
  validateTrailCommand(command: UpdateTrailCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!command.positionId || command.positionId.trim().length === 0) {
      errors.push('Position ID is required');
    }

    if (command.trailAmount <= 0) {
      errors.push('Trail amount must be positive');
    }

    if (command.step && command.step <= 0) {
      errors.push('Trail step must be positive if specified');
    }

    if (command.startPrice && command.startPrice <= 0) {
      errors.push('Start price must be positive if specified');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * ポジション情報の更新
   */
  updatePositions(accountId: string, positions: any[]): void {
    this.currentPositions.set(accountId, positions);
  }

  /**
   * 日次損失の更新
   */
  updateDailyLoss(accountId: string, loss: number): void {
    this.dailyLosses.set(accountId, loss);
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: Partial<TradeSafetyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): TradeSafetyConfig {
    return { ...this.config };
  }

  /**
   * 日次データのリセット（毎日実行）
   */
  resetDailyData(): void {
    this.dailyLosses.clear();
  }

  /**
   * アカウント固有のリスク評価
   */
  assessAccountRisk(accountInfo: AccountInfo): {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
  } {
    const factors: string[] = [];
    let riskScore = 0;

    // 証拠金レベル
    if (accountInfo.marginLevel < 150) {
      factors.push('Very low margin level');
      riskScore += 3;
    } else if (accountInfo.marginLevel < 200) {
      factors.push('Low margin level');
      riskScore += 2;
    }

    // 日次損失
    const dailyLoss = this.dailyLosses.get(accountInfo.accountId) || 0;
    if (Math.abs(dailyLoss) > this.config.maxDailyLoss * 0.8) {
      factors.push('High daily loss');
      riskScore += 2;
    }

    // ポジション数
    const positions = this.currentPositions.get(accountInfo.accountId) || [];
    if (positions.length > this.config.maxTotalPositions * 0.8) {
      factors.push('High position count');
      riskScore += 1;
    }

    // ドローダウン
    const drawdown = (accountInfo.balance - accountInfo.equity) / accountInfo.balance;
    if (drawdown > this.config.maxDrawdown * 0.5) {
      factors.push('Significant drawdown');
      riskScore += 2;
    }

    // リスクレベル判定
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 6) {
      riskLevel = 'critical';
    } else if (riskScore >= 4) {
      riskLevel = 'high';
    } else if (riskScore >= 2) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return { riskLevel, factors };
  }
}