/**
 * データ整合性チェック機能の実装
 * 
 * データ間の整合性、計算値の検証、履歴データとの比較を提供します
 */

import type {
  PositionUpdateData,
  AccountInfoData,
  MarketData,
  LosscutAlert,
} from '../websocket/message-types';

import type {
  ConsistencyResult,
  ConsistencyIssue,
  CrossValidationData,
  DataHistoryEntry,
  DataType,
  ConsistencyConfig,
} from './types';

import {
  DEFAULT_CONSISTENCY_CONFIG,
} from './types';

import { FinancialCalculator } from './data-validator';

/**
 * データ履歴管理クラス
 */
export class DataHistoryManager {
  private history: Map<string, DataHistoryEntry[]> = new Map();
  private maxHistorySize: number = 1000;
  private retentionPeriod: number = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * データエントリを追加
   */
  addEntry(accountId: string, data: any, dataType: DataType): void {
    const key = `${accountId}_${dataType}`;
    
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }

    const entries = this.history.get(key)!;
    entries.push({
      data,
      timestamp: Date.now(),
      dataType,
      accountId,
    });

    // Size limit enforcement
    if (entries.length > this.maxHistorySize) {
      entries.splice(0, entries.length - this.maxHistorySize);
    }

    // Time-based cleanup
    this.cleanupOldEntries(key);
  }

  /**
   * 履歴データの取得
   */
  getHistory(
    accountId: string,
    dataType: DataType,
    limit?: number,
    since?: Date
  ): DataHistoryEntry[] {
    const key = `${accountId}_${dataType}`;
    const entries = this.history.get(key) || [];
    
    let filtered = entries;
    
    if (since) {
      filtered = entries.filter(entry => entry.timestamp >= since.getTime());
    }
    
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    
    return filtered;
  }

  /**
   * 古いエントリのクリーンアップ
   */
  private cleanupOldEntries(key: string): void {
    const entries = this.history.get(key);
    if (!entries) return;

    const cutoffTime = Date.now() - this.retentionPeriod;
    const validEntries = entries.filter(entry => entry.timestamp >= cutoffTime);
    
    this.history.set(key, validEntries);
  }

  /**
   * 統計情報の取得
   */
  getStats(): {
    totalEntries: number;
    entriesByType: Record<DataType, number>;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    let totalEntries = 0;
    const entriesByType: Record<DataType, number> = {
      position: 0,
      account: 0,
      market: 0,
      losscut: 0,
      heartbeat: 0,
    };
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const entries of Array.from(this.history.values())) {
      totalEntries += entries.length;
      
      for (const entry of entries) {
        entriesByType[entry.dataType]++;
        
        if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
          oldestTimestamp = entry.timestamp;
        }
        if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
          newestTimestamp = entry.timestamp;
        }
      }
    }

    return {
      totalEntries,
      entriesByType,
      oldestEntry: oldestTimestamp ? new Date(oldestTimestamp) : null,
      newestEntry: newestTimestamp ? new Date(newestTimestamp) : null,
    };
  }
}

/**
 * データ整合性チェックのメインクラス
 */
export class ConsistencyChecker {
  private historyManager: DataHistoryManager;
  private calculator: FinancialCalculator;
  private config: ConsistencyConfig;

  constructor(config: ConsistencyConfig = DEFAULT_CONSISTENCY_CONFIG) {
    this.config = config;
    this.historyManager = new DataHistoryManager();
    this.calculator = new FinancialCalculator();
  }

  /**
   * データの整合性チェック
   */
  async checkDataConsistency(
    newData: any,
    existingData: any[],
    type: DataType
  ): Promise<ConsistencyResult> {
    const issues: ConsistencyIssue[] = [];
    const recommendations: string[] = [];

    try {
      switch (type) {
        case 'position':
          await this.checkPositionConsistency(newData, existingData, issues, recommendations);
          break;
        case 'account':
          await this.checkAccountConsistency(newData, existingData, issues, recommendations);
          break;
        case 'market':
          await this.checkMarketConsistency(newData, existingData, issues, recommendations);
          break;
        default:
          issues.push({
            type: 'sequence',
            severity: 'minor',
            description: `Consistency check not implemented for type: ${type}`,
            affectedFields: ['type'],
          });
      }

      // Add data to history for future consistency checks
      if (newData.accountId) {
        this.historyManager.addEntry(newData.accountId, newData, type);
      }

      const confidenceScore = this.calculateConfidenceScore(issues);
      const consistent = !issues.some(issue => issue.severity === 'critical' || issue.severity === 'major');

      return {
        consistent,
        issues,
        recommendations: this.generateRecommendations(issues),
        confidenceScore,
      };
    } catch (error) {
      issues.push({
        type: 'anomaly',
        severity: 'critical',
        description: `Consistency check failed: ${error instanceof Error ? error.message : String(error)}`,
        affectedFields: ['consistency_check'],
      });

      return {
        consistent: false,
        issues,
        recommendations: ['Review consistency check implementation'],
        confidenceScore: 0,
      };
    }
  }

  /**
   * アカウント残高と損益の整合性チェック
   */
  async checkAccountBalance(
    positions: PositionUpdateData[],
    accountInfo: AccountInfoData
  ): Promise<ConsistencyResult> {
    const issues: ConsistencyIssue[] = [];

    // Calculate total position profit
    const totalPositionProfit = positions
      .filter(p => p.status === 'open')
      .reduce((sum, p) => sum + p.profit, 0);

    // Check profit consistency
    const profitDifference = Math.abs(accountInfo.profit - totalPositionProfit);
    const tolerance = Math.max(1, Math.abs(totalPositionProfit * this.config.tolerances.profitCalculationTolerance / 100));

    if (profitDifference > tolerance) {
      issues.push({
        type: 'mismatch',
        severity: 'major',
        description: `Total position profit (${totalPositionProfit.toFixed(2)}) does not match account profit (${accountInfo.profit.toFixed(2)}). Difference: ${profitDifference.toFixed(2)}`,
        affectedFields: ['profit'],
        suggestedFix: 'Request full data resync from EA',
        impact: 'Potential data synchronization issue',
        confidence: 85,
      });
    }

    // Calculate margin used for open positions
    const calculatedMarginUsed = this.calculateTotalMarginUsed(positions);
    const marginDifference = Math.abs(accountInfo.marginUsed - calculatedMarginUsed);
    const marginTolerance = calculatedMarginUsed * this.config.tolerances.marginCalculationTolerance / 100;

    if (marginDifference > marginTolerance) {
      issues.push({
        type: 'mismatch',
        severity: 'major',
        description: `Calculated margin (${calculatedMarginUsed.toFixed(2)}) does not match account margin (${accountInfo.marginUsed.toFixed(2)}). Difference: ${marginDifference.toFixed(2)}`,
        affectedFields: ['marginUsed'],
        suggestedFix: 'Verify position lot sizes and leverage settings',
        impact: 'Potential margin calculation error',
        confidence: 75,
      });
    }

    // Equity calculation consistency
    const expectedEquity = accountInfo.balance + accountInfo.profit + accountInfo.credit;
    const equityDifference = Math.abs(accountInfo.equity - expectedEquity);
    const equityTolerance = Math.max(1, expectedEquity * 0.01); // 1%

    if (equityDifference > equityTolerance) {
      issues.push({
        type: 'calculation',
        severity: 'major',
        description: `Equity calculation inconsistent. Expected: ${expectedEquity.toFixed(2)}, Actual: ${accountInfo.equity.toFixed(2)}`,
        affectedFields: ['equity', 'balance', 'profit', 'credit'],
        suggestedFix: 'Check equity calculation formula',
        impact: 'Potential accounting error',
        confidence: 90,
      });
    }

    // Free margin calculation
    const expectedFreeMargin = accountInfo.equity - accountInfo.marginUsed;
    const freeMarginDifference = Math.abs(accountInfo.freeMargin - expectedFreeMargin);
    const freeMarginTolerance = Math.max(1, Math.abs(expectedFreeMargin * 0.02)); // 2%

    if (freeMarginDifference > freeMarginTolerance) {
      issues.push({
        type: 'calculation',
        severity: 'minor',
        description: `Free margin calculation inconsistent. Expected: ${expectedFreeMargin.toFixed(2)}, Actual: ${accountInfo.freeMargin.toFixed(2)}`,
        affectedFields: ['freeMargin', 'equity', 'marginUsed'],
        suggestedFix: 'Verify free margin calculation',
        impact: 'Minor calculation discrepancy',
        confidence: 80,
      });
    }

    return {
      consistent: issues.filter(i => i.severity === 'critical' || i.severity === 'major').length === 0,
      issues,
      recommendations: this.generateRecommendations(issues),
      confidenceScore: this.calculateConfidenceScore(issues),
    };
  }

  /**
   * 市場データの連続性チェック
   */
  async checkMarketDataContinuity(marketData: MarketData[]): Promise<ConsistencyResult> {
    const issues: ConsistencyIssue[] = [];

    if (marketData.length < 2) {
      return {
        consistent: true,
        issues,
        recommendations: [],
        confidenceScore: 100,
      };
    }

    // Sort by timestamp
    const sortedData = [...marketData].sort((a, b) => a.lastUpdated.getTime() - b.lastUpdated.getTime());

    for (let i = 1; i < sortedData.length; i++) {
      const current = sortedData[i];
      const previous = sortedData[i - 1];

      // Check time gaps
      const timeDiff = current.lastUpdated.getTime() - previous.lastUpdated.getTime();
      const expectedInterval = 1000; // 1 second

      if (timeDiff > expectedInterval * (this.config.tolerances.timeGapTolerance + 1)) {
        issues.push({
          type: 'gap',
          severity: 'minor',
          description: `Time gap detected: ${(timeDiff / 1000).toFixed(1)}s between ${previous.lastUpdated.toISOString()} and ${current.lastUpdated.toISOString()}`,
          affectedFields: ['lastUpdated'],
          suggestedFix: 'Check network connectivity and data feed stability',
          impact: 'Potential data feed interruption',
          confidence: 70,
        });
      }

      // Check for price jumps (same symbol only)
      if (current.symbol === previous.symbol) {
        const priceChange = Math.abs(current.bid - previous.bid);
        const threshold = previous.bid * this.config.tolerances.priceVariationTolerance / 100;

        if (priceChange > threshold) {
          const changePercent = (priceChange / previous.bid) * 100;
          issues.push({
            type: 'anomaly',
            severity: changePercent > 10 ? 'major' : 'minor',
            description: `Abnormal price change: ${changePercent.toFixed(2)}% from ${previous.bid} to ${current.bid}`,
            affectedFields: ['bid'],
            suggestedFix: 'Verify market data source and check for news events',
            impact: 'Potential market volatility or data error',
            confidence: 60,
          });
        }
      }

      // Check bid/ask spread consistency
      const currentSpread = current.ask - current.bid;
      const previousSpread = previous.ask - previous.bid;
      const spreadChange = Math.abs(currentSpread - previousSpread);
      const maxSpreadChange = Math.max(previousSpread * 0.5, 0.0001); // 50% or minimum

      if (spreadChange > maxSpreadChange && current.symbol === previous.symbol) {
        issues.push({
          type: 'anomaly',
          severity: 'minor',
          description: `Spread changed significantly from ${(previousSpread * 10000).toFixed(1)} to ${(currentSpread * 10000).toFixed(1)} pips`,
          affectedFields: ['spread', 'bid', 'ask'],
          suggestedFix: 'Monitor spread variations during market hours',
          impact: 'Trading cost variation',
          confidence: 65,
        });
      }
    }

    return {
      consistent: issues.filter(i => i.severity === 'critical' || i.severity === 'major').length === 0,
      issues,
      recommendations: this.generateRecommendations(issues),
      confidenceScore: this.calculateConfidenceScore(issues),
    };
  }

  /**
   * クロスバリデーション（複数データ型の整合性チェック）
   */
  async crossValidateData(data: CrossValidationData): Promise<ConsistencyResult> {
    const issues: ConsistencyIssue[] = [];

    // Check account-position consistency
    const accountPositionResult = await this.checkAccountBalance(data.positions, data.accountInfo);
    issues.push(...accountPositionResult.issues);

    // Check market data consistency with positions
    for (const position of data.positions) {
      const relevantMarketData = data.marketData.find(md => md.symbol === position.symbol);
      
      if (relevantMarketData) {
        // Check if position current price is reasonable compared to market data
        const marketPrice = position.type === 'buy' ? relevantMarketData.bid : relevantMarketData.ask;
        const priceDifference = Math.abs(position.currentPrice - marketPrice);
        const tolerance = marketPrice * 0.01; // 1% tolerance

        if (priceDifference > tolerance) {
          issues.push({
            type: 'mismatch',
            severity: 'minor',
            description: `Position price (${position.currentPrice}) differs from market price (${marketPrice}) by ${((priceDifference / marketPrice) * 100).toFixed(2)}%`,
            affectedFields: ['currentPrice'],
            suggestedFix: 'Check price feed synchronization',
            impact: 'Potential price feed delay',
            confidence: 70,
          });
        }
      }
    }

    // Check timestamp consistency
    const timestamps = [
      data.timestamp,
      ...data.positions.map(p => p.openTime.getTime()),
      ...data.marketData.map(md => md.lastUpdated.getTime()),
    ];

    const maxTimestamp = Math.max(...timestamps);
    const minTimestamp = Math.min(...timestamps);
    const timeSpan = maxTimestamp - minTimestamp;

    if (timeSpan > 30000) { // 30 seconds
      issues.push({
        type: 'sequence',
        severity: 'minor',
        description: `Data timestamps span ${(timeSpan / 1000).toFixed(1)} seconds, indicating potential synchronization issues`,
        affectedFields: ['timestamp'],
        suggestedFix: 'Check data collection timing',
        impact: 'Data synchronization concern',
        confidence: 60,
      });
    }

    return {
      consistent: issues.filter(i => i.severity === 'critical' || i.severity === 'major').length === 0,
      issues,
      recommendations: this.generateRecommendations(issues),
      confidenceScore: this.calculateConfidenceScore(issues),
    };
  }

  /**
   * ポジション整合性チェック
   */
  private async checkPositionConsistency(
    newPosition: PositionUpdateData,
    existingPositions: PositionUpdateData[],
    issues: ConsistencyIssue[],
    recommendations: string[]
  ): Promise<void> {
    // Check for duplicate position IDs
    const duplicates = existingPositions.filter(p => p.positionId === newPosition.positionId);
    if (duplicates.length > 0) {
      issues.push({
        type: 'duplication',
        severity: 'major',
        description: `Duplicate position ID: ${newPosition.positionId}`,
        affectedFields: ['positionId'],
        suggestedFix: 'Ensure unique position ID generation',
        confidence: 95,
      });
    }

    // Check profit calculation consistency
    const expectedProfit = this.calculator.calculateExpectedProfit(newPosition);
    const profitDifference = Math.abs(newPosition.profit - expectedProfit);
    const tolerance = Math.abs(expectedProfit * 0.02); // 2% tolerance

    if (profitDifference > tolerance) {
      issues.push({
        type: 'calculation',
        severity: 'minor',
        description: `Profit calculation inconsistency. Expected: ${expectedProfit.toFixed(2)}, Actual: ${newPosition.profit.toFixed(2)}`,
        affectedFields: ['profit'],
        suggestedFix: 'Verify profit calculation parameters',
        confidence: 80,
      });
    }

    // Check position status transitions
    const previousVersions = existingPositions.filter(p => 
      p.positionId === newPosition.positionId && 
      p.openTime.getTime() <= newPosition.openTime.getTime()
    );

    if (previousVersions.length > 0) {
      const latest = previousVersions.sort((a, b) => b.openTime.getTime() - a.openTime.getTime())[0];
      
      // Check for invalid status transitions
      if (latest.status === 'closed' && newPosition.status === 'open') {
        issues.push({
          type: 'sequence',
          severity: 'major',
          description: `Invalid status transition from '${latest.status}' to '${newPosition.status}' for position ${newPosition.positionId}`,
          affectedFields: ['status'],
          suggestedFix: 'Check position lifecycle management',
          confidence: 90,
        });
      }
    }
  }

  /**
   * アカウント整合性チェック
   */
  private async checkAccountConsistency(
    newAccount: AccountInfoData,
    existingAccounts: AccountInfoData[],
    issues: ConsistencyIssue[],
    recommendations: string[]
  ): Promise<void> {
    if (existingAccounts.length === 0) return;

    const latest = existingAccounts[existingAccounts.length - 1];

    // Check for reasonable balance changes
    const balanceChange = Math.abs(newAccount.balance - latest.balance);
    const balanceChangePercent = (balanceChange / latest.balance) * 100;

    if (balanceChangePercent > 50) { // 50% change
      issues.push({
        type: 'anomaly',
        severity: 'major',
        description: `Large balance change: ${balanceChangePercent.toFixed(1)}% from ${latest.balance} to ${newAccount.balance}`,
        affectedFields: ['balance'],
        suggestedFix: 'Verify large transactions or deposits/withdrawals',
        confidence: 70,
      });
    }

    // Check margin level reasonableness
    if (newAccount.marginLevel < 10 && latest.marginLevel > 100) {
      issues.push({
        type: 'anomaly',
        severity: 'critical',
        description: `Margin level dropped drastically from ${latest.marginLevel.toFixed(1)}% to ${newAccount.marginLevel.toFixed(1)}%`,
        affectedFields: ['marginLevel'],
        suggestedFix: 'Check for potential margin call or system error',
        confidence: 85,
      });
    }
  }

  /**
   * 市場データ整合性チェック
   */
  private async checkMarketConsistency(
    newMarketData: MarketData,
    existingMarketData: MarketData[],
    issues: ConsistencyIssue[],
    recommendations: string[]
  ): Promise<void> {
    const sameSymbolData = existingMarketData.filter(md => md.symbol === newMarketData.symbol);
    
    if (sameSymbolData.length === 0) return;

    const latest = sameSymbolData[sameSymbolData.length - 1];

    // Check for reasonable price movements
    const priceChange = Math.abs(newMarketData.bid - latest.bid);
    const priceChangePercent = (priceChange / latest.bid) * 100;

    if (priceChangePercent > 5) { // 5% price change
      issues.push({
        type: 'anomaly',
        severity: 'minor',
        description: `Large price movement: ${priceChangePercent.toFixed(2)}% for ${newMarketData.symbol}`,
        affectedFields: ['bid'],
        suggestedFix: 'Check for market news or volatility events',
        confidence: 60,
      });
    }

    // Check spread reasonableness
    const currentSpread = newMarketData.ask - newMarketData.bid;
    const previousSpread = latest.ask - latest.bid;
    const spreadRatio = currentSpread / previousSpread;

    if (spreadRatio > 3 || spreadRatio < 0.3) { // 3x increase or 70% decrease
      issues.push({
        type: 'anomaly',
        severity: 'minor',
        description: `Spread changed significantly: ${(previousSpread * 10000).toFixed(1)} to ${(currentSpread * 10000).toFixed(1)} pips`,
        affectedFields: ['spread'],
        suggestedFix: 'Monitor liquidity conditions',
        confidence: 65,
      });
    }
  }

  /**
   * 推奨事項の生成
   */
  private generateRecommendations(issues: ConsistencyIssue[]): string[] {
    const recommendations = new Set<string>();

    for (const issue of issues) {
      if (issue.suggestedFix) {
        recommendations.add(issue.suggestedFix);
      }

      // Generate general recommendations based on issue type
      switch (issue.type) {
        case 'mismatch':
          recommendations.add('Review data synchronization between components');
          break;
        case 'calculation':
          recommendations.add('Verify calculation formulas and parameters');
          break;
        case 'anomaly':
          recommendations.add('Monitor for unusual market conditions or data errors');
          break;
        case 'sequence':
          recommendations.add('Check data flow timing and ordering');
          break;
        case 'duplication':
          recommendations.add('Implement duplicate detection and prevention');
          break;
        case 'gap':
          recommendations.add('Improve data feed reliability and monitoring');
          break;
      }
    }

    return Array.from(recommendations);
  }

  /**
   * 信頼度スコアの計算
   */
  private calculateConfidenceScore(issues: ConsistencyIssue[]): number {
    if (issues.length === 0) return 100;

    let penalty = 0;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          penalty += 40;
          break;
        case 'major':
          penalty += 20;
          break;
        case 'minor':
          penalty += 5;
          break;
      }
    }

    return Math.max(0, 100 - penalty);
  }

  /**
   * 証拠金計算
   */
  private calculateTotalMarginUsed(positions: PositionUpdateData[]): number {
    return positions
      .filter(p => p.status === 'open')
      .reduce((total, position) => {
        // Simplified margin calculation
        const contractSize = position.lots * 100000;
        const marginRequired = (contractSize * position.openPrice) / 100; // Assuming 1:100 leverage
        return total + marginRequired;
      }, 0);
  }

  /**
   * 履歴管理機能へのアクセス
   */
  getHistoryManager(): DataHistoryManager {
    return this.historyManager;
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<ConsistencyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): ConsistencyConfig {
    return { ...this.config };
  }
}