/**
 * データ検証機能の実装
 * 
 * スキーマ検証、ビジネスロジック検証、異常値検出を提供します
 */

import { z } from 'zod';
import type {
  PositionUpdateData,
  AccountInfoData,
  MarketData,
  LosscutAlert,
  HeartbeatData,
  EAMessage,
  SystemCommand,
} from '../websocket/message-types';

import {
  PositionUpdateDataSchema,
  AccountInfoDataSchema,
  MarketDataSchema,
  LosscutAlertSchema,
  HeartbeatDataSchema,
  EAMessageSchema,
  SystemCommandSchema,
} from '../websocket/message-types';

import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  BatchValidationResult,
  DataType,
  ValidationRule,
  ValidationContext,
  MarketContext,
  StatisticalAnalysis,
  OutlierDetection,
  OutlierPoint,
  ValidationConfig,
  PerformanceMetrics,
} from './types';

import {
  VALIDATION_ERROR_CODES,
  DEFAULT_VALIDATION_CONFIG,
} from './types';

/**
 * 統計的分析機能を提供するクラス
 */
export class StatisticalAnalyzer {
  /**
   * IQR方式による外れ値検出
   */
  detectOutliersIQR(values: number[], multiplier: number = 1.5): OutlierDetection {
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - (multiplier * iqr);
    const upperBound = q3 + (multiplier * iqr);
    
    const outliers: OutlierPoint[] = [];
    values.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        const score = Math.max(
          Math.abs(value - lowerBound) / iqr,
          Math.abs(value - upperBound) / iqr
        );
        outliers.push({
          index,
          value,
          score,
          field: 'value',
          timestamp: new Date(),
        });
      }
    });
    
    return {
      method: 'iqr',
      outliers,
      threshold: multiplier,
      confidence: Math.min(95, Math.max(60, 100 - (outliers.length / values.length) * 100)),
    };
  }

  /**
   * Z-Score方式による外れ値検出
   */
  detectOutliersZScore(values: number[], threshold: number = 2.0): OutlierDetection {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    const outliers: OutlierPoint[] = [];
    values.forEach((value, index) => {
      const zScore = Math.abs((value - mean) / standardDeviation);
      if (zScore > threshold) {
        outliers.push({
          index,
          value,
          score: zScore,
          field: 'value',
          timestamp: new Date(),
        });
      }
    });
    
    return {
      method: 'zscore',
      outliers,
      threshold,
      confidence: Math.min(99, Math.max(70, 100 - (outliers.length / values.length) * 50)),
    };
  }

  /**
   * 基本統計量の計算
   */
  calculateStatistics(values: number[]): {
    mean: number;
    median: number;
    standardDeviation: number;
    min: number;
    max: number;
    count: number;
  } {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return {
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      standardDeviation: Math.sqrt(variance),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: values.length,
    };
  }
}

/**
 * 財務計算ユーティリティ
 */
export class FinancialCalculator {
  /**
   * ポジションの期待損益を計算
   */
  calculateExpectedProfit(position: PositionUpdateData): number {
    const priceDiff = position.currentPrice - position.openPrice;
    const multiplier = position.type === 'buy' ? 1 : -1;
    const pipValue = this.calculatePipValue(position.symbol, position.lots);
    
    return (priceDiff * multiplier * pipValue) - position.commission - position.swapPoints;
  }

  /**
   * Pip値の計算（簡易版）
   */
  private calculatePipValue(symbol: string, lots: number): number {
    // 主要通貨ペアの簡易計算
    const majorPairs = ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'];
    const usdPairs = ['USDJPY', 'USDCHF', 'USDCAD'];
    
    if (majorPairs.includes(symbol)) {
      return lots * 100000 * 0.0001; // 4桁通貨ペア
    } else if (usdPairs.includes(symbol)) {
      return lots * 100000 * 0.01; // JPY系ペア
    } else {
      return lots * 100000 * 0.0001; // デフォルト
    }
  }

  /**
   * 必要証拠金の計算
   */
  calculateMarginRequired(position: PositionUpdateData, leverage: number = 100): number {
    const contractSize = position.lots * 100000;
    return (contractSize * position.openPrice) / leverage;
  }

  /**
   * 証拠金維持率の計算
   */
  calculateMarginLevel(equity: number, usedMargin: number): number {
    if (usedMargin === 0) return Infinity;
    return (equity / usedMargin) * 100;
  }
}

/**
 * データ検証のメインクラス
 */
export class DataValidator {
  private rules: ValidationRule[] = [];
  private statisticalAnalyzer: StatisticalAnalyzer;
  private financialCalculator: FinancialCalculator;
  private config: ValidationConfig;
  private performanceMetrics: PerformanceMetrics;

  constructor(config: ValidationConfig = DEFAULT_VALIDATION_CONFIG) {
    this.config = config;
    this.statisticalAnalyzer = new StatisticalAnalyzer();
    this.financialCalculator = new FinancialCalculator();
    this.performanceMetrics = {
      validationLatency: 0,
      throughput: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      errorRate: 0,
      cacheHitRate: 0,
    };
    this.initializeDefaultRules();
  }

  /**
   * デフォルトバリデーションルールの初期化
   */
  private initializeDefaultRules(): void {
    this.rules = [
      // Position validation rules
      {
        field: 'positionId',
        type: 'required',
        constraint: true,
        message: 'Position ID is required',
        severity: 'error',
      },
      {
        field: 'lots',
        type: 'range',
        constraint: { min: 0.01, max: 100 },
        message: 'Lot size must be between 0.01 and 100',
        severity: 'error',
      },
      {
        field: 'openPrice',
        type: 'range',
        constraint: { min: 0.0001, max: 1000000 },
        message: 'Open price must be positive and reasonable',
        severity: 'error',
      },
      {
        field: 'currentPrice',
        type: 'range',
        constraint: { min: 0.0001, max: 1000000 },
        message: 'Current price must be positive and reasonable',
        severity: 'error',
      },
      // Account validation rules
      {
        field: 'balance',
        type: 'range',
        constraint: { min: 0, max: 10000000 },
        message: 'Account balance must be reasonable',
        severity: 'error',
      },
      {
        field: 'marginLevel',
        type: 'range',
        constraint: { min: 0, max: 100000 },
        message: 'Margin level must be reasonable',
        severity: 'warning',
      },
      // Market data validation rules
      {
        field: 'spread',
        type: 'range',
        constraint: { min: 0, max: 1000 },
        message: 'Spread must be reasonable',
        severity: 'warning',
      },
    ];
  }

  /**
   * ポジションデータの検証
   */
  async validatePositionData(
    data: PositionUpdateData,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Schema validation
      if (this.config.enabledChecks.schemaValidation) {
        const schemaResult = this.validateSchema(data, PositionUpdateDataSchema);
        errors.push(...schemaResult.errors);
        warnings.push(...schemaResult.warnings);
      }

      // Business logic validation
      if (this.config.enabledChecks.businessLogicValidation) {
        this.validatePositionBusinessLogic(data, errors, warnings);
      }

      // Statistical validation
      if (this.config.enabledChecks.statisticalValidation && context?.historicalData) {
        await this.validatePositionStatistically(data, context.historicalData, warnings);
      }

      const score = this.calculateValidationScore(errors, warnings);
      
      // Update performance metrics
      this.performanceMetrics.validationLatency = performance.now() - startTime;
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        score,
      };
    } catch (error) {
      errors.push({
        field: 'validation',
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });

      return {
        valid: false,
        errors,
        warnings,
        score: 0,
      };
    }
  }

  /**
   * アカウント情報の検証
   */
  async validateAccountData(
    data: AccountInfoData,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Schema validation
      if (this.config.enabledChecks.schemaValidation) {
        const schemaResult = this.validateSchema(data, AccountInfoDataSchema);
        errors.push(...schemaResult.errors);
        warnings.push(...schemaResult.warnings);
      }

      // Business logic validation
      if (this.config.enabledChecks.businessLogicValidation) {
        this.validateAccountBusinessLogic(data, errors, warnings);
      }

      // Statistical validation
      if (this.config.enabledChecks.statisticalValidation && context?.historicalData) {
        await this.validateAccountStatistically(data, context.historicalData, warnings);
      }

      const score = this.calculateValidationScore(errors, warnings);
      
      this.performanceMetrics.validationLatency = performance.now() - startTime;
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        score,
      };
    } catch (error) {
      errors.push({
        field: 'validation',
        code: 'VALIDATION_ERROR',
        message: `Account validation failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });

      return {
        valid: false,
        errors,
        warnings,
        score: 0,
      };
    }
  }

  /**
   * 市場データの検証
   */
  async validateMarketData(
    data: MarketData,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Schema validation
      if (this.config.enabledChecks.schemaValidation) {
        const schemaResult = this.validateSchema(data, MarketDataSchema);
        errors.push(...schemaResult.errors);
        warnings.push(...schemaResult.warnings);
      }

      // Business logic validation
      if (this.config.enabledChecks.businessLogicValidation) {
        this.validateMarketBusinessLogic(data, errors, warnings);
      }

      // Statistical validation
      if (this.config.enabledChecks.statisticalValidation && context?.historicalData) {
        await this.validateMarketStatistically(data, context.historicalData, warnings);
      }

      const score = this.calculateValidationScore(errors, warnings);
      
      this.performanceMetrics.validationLatency = performance.now() - startTime;
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        score,
      };
    } catch (error) {
      errors.push({
        field: 'validation',
        code: 'VALIDATION_ERROR',
        message: `Market data validation failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });

      return {
        valid: false,
        errors,
        warnings,
        score: 0,
      };
    }
  }

  /**
   * バッチデータの検証
   */
  async validateBatch(
    data: any[],
    type: DataType,
    context?: ValidationContext
  ): Promise<BatchValidationResult> {
    const startTime = performance.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let validItems = 0;
    let errorItems = 0;
    let warningItems = 0;

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      let result: ValidationResult;

      try {
        switch (type) {
          case 'position':
            result = await this.validatePositionData(item, context);
            break;
          case 'account':
            result = await this.validateAccountData(item, context);
            break;
          case 'market':
            result = await this.validateMarketData(item, context);
            break;
          default:
            throw new Error(`Unsupported data type: ${type}`);
        }

        if (result.valid) {
          validItems++;
        } else {
          errorItems++;
        }

        if (result.warnings.length > 0) {
          warningItems++;
        }

        // Add index to errors and warnings
        result.errors.forEach(error => {
          errors.push({ ...error, field: `[${i}].${error.field}` });
        });
        result.warnings.forEach(warning => {
          warnings.push({ ...warning, field: `[${i}].${warning.field}` });
        });

      } catch (error) {
        errorItems++;
        errors.push({
          field: `[${i}]`,
          code: 'BATCH_VALIDATION_ERROR',
          message: `Item validation failed: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
        });
      }
    }

    const processingTime = performance.now() - startTime;
    const overallScore = data.length > 0 ? (validItems / data.length) * 100 : 100;

    // Update performance metrics
    this.performanceMetrics.throughput = data.length / (processingTime / 1000);

    return {
      totalItems: data.length,
      validItems,
      errorItems,
      warningItems,
      overallScore,
      errors,
      warnings,
      processingTime,
    };
  }

  /**
   * スキーマ検証
   */
  private validateSchema(data: any, schema: z.ZodSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(zodError => {
          errors.push({
            field: zodError.path.join('.'),
            code: 'SCHEMA_VALIDATION_ERROR',
            message: zodError.message,
            severity: 'error',
            value: (zodError as any).received,
            expectedValue: (zodError as any).expected,
          });
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: errors.length === 0 ? 100 : 0,
    };
  }

  /**
   * ポジションビジネスロジック検証
   */
  private validatePositionBusinessLogic(
    data: PositionUpdateData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Lot size validation
    if (data.lots <= 0 || data.lots > 100) {
      errors.push({
        field: 'lots',
        code: 'INVALID_LOT_SIZE',
        message: `Invalid lot size: ${data.lots}`,
        severity: 'error',
        value: data.lots,
        constraint: '0.01 <= lots <= 100',
      });
    }

    // Price validation
    if (data.openPrice <= 0 || data.currentPrice <= 0) {
      errors.push({
        field: 'price',
        code: 'INVALID_PRICE',
        message: 'Price must be positive',
        severity: 'error',
      });
    }

    // Profit calculation validation
    const expectedProfit = this.financialCalculator.calculateExpectedProfit(data);
    const profitDifference = Math.abs(data.profit - expectedProfit);
    const tolerance = Math.abs(expectedProfit * 0.01); // 1% tolerance

    if (profitDifference > tolerance) {
      warnings.push({
        field: 'profit',
        code: 'PROFIT_CALCULATION_MISMATCH',
        message: `Profit calculation mismatch. Expected: ${expectedProfit.toFixed(2)}, Actual: ${data.profit.toFixed(2)}`,
        severity: 'warning',
        value: { expected: expectedProfit, actual: data.profit },
        impact: 'Potential data integrity issue',
      });
    }

    // Price change validation
    const priceChange = Math.abs(data.currentPrice - data.openPrice);
    const priceChangePercent = (priceChange / data.openPrice) * 100;

    if (priceChangePercent > 10) { // 10% price change warning
      warnings.push({
        field: 'currentPrice',
        code: 'LARGE_PRICE_CHANGE',
        message: `Large price change detected: ${priceChangePercent.toFixed(2)}%`,
        severity: 'warning',
        value: priceChangePercent,
        impact: 'Potential market volatility or data error',
      });
    }
  }

  /**
   * アカウントビジネスロジック検証
   */
  private validateAccountBusinessLogic(
    data: AccountInfoData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Margin level validation
    if (data.marginLevel < 100) {
      warnings.push({
        field: 'marginLevel',
        code: 'LOW_MARGIN_LEVEL',
        message: `Low margin level: ${data.marginLevel}%`,
        severity: 'warning',
        value: data.marginLevel,
        impact: 'Risk of margin call',
      });
    }

    if (data.marginLevel < 50) {
      errors.push({
        field: 'marginLevel',
        code: 'CRITICAL_MARGIN_LEVEL',
        message: `Critical margin level: ${data.marginLevel}%`,
        severity: 'error',
        value: data.marginLevel,
        constraint: 'marginLevel >= 50',
      });
    }

    // Equity vs Balance validation
    if (data.equity > data.balance * 1.5) {
      warnings.push({
        field: 'equity',
        code: 'HIGH_EQUITY_RATIO',
        message: `Equity significantly higher than balance: ${(data.equity / data.balance * 100).toFixed(1)}%`,
        severity: 'warning',
        value: data.equity / data.balance,
        impact: 'Potential data inconsistency',
      });
    }

    // Bonus amount validation
    if (data.bonusAmount < 0) {
      errors.push({
        field: 'bonusAmount',
        code: 'NEGATIVE_BONUS',
        message: 'Bonus amount cannot be negative',
        severity: 'error',
        value: data.bonusAmount,
      });
    }
  }

  /**
   * 市場データビジネスロジック検証
   */
  private validateMarketBusinessLogic(
    data: MarketData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Bid/Ask validation
    if (data.bid >= data.ask) {
      errors.push({
        field: 'bid_ask',
        code: 'INVALID_BID_ASK',
        message: `Bid (${data.bid}) must be lower than Ask (${data.ask})`,
        severity: 'error',
        value: { bid: data.bid, ask: data.ask },
      });
    }

    // Spread validation
    const calculatedSpread = data.ask - data.bid;
    if (Math.abs(data.spread - calculatedSpread) > 0.00001) {
      warnings.push({
        field: 'spread',
        code: 'SPREAD_CALCULATION_MISMATCH',
        message: `Spread mismatch. Calculated: ${calculatedSpread}, Reported: ${data.spread}`,
        severity: 'warning',
        value: { calculated: calculatedSpread, reported: data.spread },
      });
    }

    // Abnormal spread validation
    const spreadPips = data.spread * 10000; // Assuming 4-digit currency pair
    if (spreadPips > 50) { // 5 pips
      warnings.push({
        field: 'spread',
        code: 'HIGH_SPREAD',
        message: `High spread detected: ${spreadPips.toFixed(1)} pips`,
        severity: 'warning',
        value: spreadPips,
        impact: 'Trading cost impact',
      });
    }
  }

  /**
   * ポジション統計的検証
   */
  private async validatePositionStatistically(
    data: PositionUpdateData,
    historicalData: any[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    if (historicalData.length < 10) return; // Not enough data for statistical analysis

    // Extract profit values for analysis
    const profits = historicalData
      .filter(item => item.positionId && item.profit !== undefined)
      .map(item => item.profit);

    if (profits.length >= 10) {
      const outlierDetection = this.statisticalAnalyzer.detectOutliersZScore(profits, 2.5);
      
      // Check if current profit is an outlier
      const currentProfitZScore = this.calculateZScore(data.profit, profits);
      if (Math.abs(currentProfitZScore) > 2.5) {
        warnings.push({
          field: 'profit',
          code: 'STATISTICAL_OUTLIER',
          message: `Profit value is a statistical outlier (Z-score: ${currentProfitZScore.toFixed(2)})`,
          severity: 'warning',
          value: data.profit,
          impact: 'Potential data anomaly',
        });
      }
    }
  }

  /**
   * アカウント統計的検証
   */
  private async validateAccountStatistically(
    data: AccountInfoData,
    historicalData: any[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    if (historicalData.length < 10) return;

    // Extract balance values for analysis
    const balances = historicalData
      .filter(item => item.balance !== undefined)
      .map(item => item.balance);

    if (balances.length >= 10) {
      const balanceStats = this.statisticalAnalyzer.calculateStatistics(balances);
      const balanceChange = Math.abs(data.balance - balanceStats.mean);
      const changePercent = (balanceChange / balanceStats.mean) * 100;

      if (changePercent > 20) { // 20% change from mean
        warnings.push({
          field: 'balance',
          code: 'ABNORMAL_BALANCE_CHANGE',
          message: `Balance change of ${changePercent.toFixed(1)}% from historical mean`,
          severity: 'warning',
          value: data.balance,
          impact: 'Potential significant trading activity',
        });
      }
    }
  }

  /**
   * 市場データ統計的検証
   */
  private async validateMarketStatistically(
    data: MarketData,
    historicalData: any[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    if (historicalData.length < 20) return;

    // Extract bid prices for analysis
    const bids = historicalData
      .filter(item => item.bid !== undefined && item.symbol === data.symbol)
      .map(item => item.bid);

    if (bids.length >= 20) {
      const priceStats = this.statisticalAnalyzer.calculateStatistics(bids);
      const priceChange = Math.abs(data.bid - priceStats.mean);
      const changePercent = (priceChange / priceStats.mean) * 100;

      if (changePercent > 5) { // 5% price change
        warnings.push({
          field: 'bid',
          code: 'ABNORMAL_PRICE_CHANGE',
          message: `Price change of ${changePercent.toFixed(2)}% from recent average`,
          severity: 'warning',
          value: data.bid,
          impact: 'Potential market volatility',
        });
      }
    }
  }

  /**
   * Z-Scoreの計算
   */
  private calculateZScore(value: number, dataset: number[]): number {
    const mean = dataset.reduce((sum, val) => sum + val, 0) / dataset.length;
    const variance = dataset.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dataset.length;
    const standardDeviation = Math.sqrt(variance);
    
    return standardDeviation === 0 ? 0 : (value - mean) / standardDeviation;
  }

  /**
   * バリデーションスコアの計算
   */
  private calculateValidationScore(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): number {
    if (errors.length === 0 && warnings.length === 0) return 100;
    
    const errorPenalty = errors.length * 25; // Each error costs 25 points
    const warningPenalty = warnings.length * 5; // Each warning costs 5 points
    
    return Math.max(0, 100 - errorPenalty - warningPenalty);
  }

  /**
   * パフォーマンス指標の取得
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * カスタムルールの追加
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * ルールの削除
   */
  removeRule(field: string, type: ValidationRule['type']): void {
    this.rules = this.rules.filter(rule => !(rule.field === field && rule.type === type));
  }

  /**
   * 全ルールの取得
   */
  getRules(): ValidationRule[] {
    return [...this.rules];
  }
}