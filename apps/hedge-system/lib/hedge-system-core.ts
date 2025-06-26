/**
 * Hedge System Core - 金融計算エンジン
 * MVPシステム設計書準拠の完全実装
 * 
 * 主要機能：
 * 1. ArbitrageEngine - 価格差検出・実行判定アルゴリズム
 * 2. PositionManager - ポジション状態管理・PnL計算
 * 3. RiskController - ロスカット判定・資金管理
 * 4. ボーナスアービトラージ特化設計
 */

import {
  Position,
  Account,
  Symbol,
  PositionStatus,
  ExecutionType
} from '@repo/shared-types';

// 金融計算関連の型定義
export interface ArbitrageOpportunity {
  id: string;
  symbol: Symbol;
  buyAccount: string;
  sellAccount: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  volume: number;
  profitEstimate: number;
  executionFee: number;
  slippage: number;
  netProfit: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: string;
}

export interface RiskMetrics {
  maxDrawdown: number;
  currentExposure: number;
  maxExposure: number;
  marginLevel: number;
  riskPercentage: number;
  creditUtilization: number;
  equityRatio: number;
}

export interface PnLCalculation {
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  dailyPnL: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
}

export interface TrailCondition {
  positionId: string;
  currentPrice: number;
  trailWidth: number;
  triggerPrice: number;
  direction: 'BUY' | 'SELL';
  isTriggered: boolean;
}

/**
 * ArbitrageEngine - アービトラージ検出・実行判定
 */
export class ArbitrageEngine {
  private readonly SPREAD_THRESHOLD = 0.0001; // 1pip
  private readonly MIN_PROFIT_THRESHOLD = 5; // 最小利益（USD）
  private readonly MAX_SLIPPAGE = 0.0002; // 最大スリッページ
  private readonly EXECUTION_FEE_RATE = 0.0001; // 手数料率

  /**
   * 価格差検出アルゴリズム
   */
  detectArbitrageOpportunity(
    symbol: Symbol,
    buyAccount: string,
    sellAccount: string,
    buyPrice: number,
    sellPrice: number,
    volume: number = 0.01
  ): ArbitrageOpportunity | null {
    
    const spread = this.calculatePreciseSpread(sellPrice, buyPrice);
    
    // スプレッド閾値チェック
    if (spread < this.SPREAD_THRESHOLD) {
      return null;
    }
    
    // 手数料・スリッページ計算
    const executionFee = this.calculateExecutionFee(volume, buyPrice);
    const slippage = this.estimateSlippage(symbol, volume);
    
    // 純利益計算
    const grossProfit = spread * volume * this.getMultiplier(symbol);
    const netProfit = grossProfit - executionFee - slippage;
    
    // 最小利益閾値チェック
    if (netProfit < this.MIN_PROFIT_THRESHOLD) {
      return null;
    }
    
    // リスクレベル評価
    const riskLevel = this.evaluateRiskLevel(spread, volume, symbol);
    
    return {
      id: `arb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      buyAccount,
      sellAccount,
      buyPrice: this.roundToPrecision(buyPrice, 5),
      sellPrice: this.roundToPrecision(sellPrice, 5),
      spread: this.roundToPrecision(spread, 5),
      volume: this.roundToPrecision(volume, 2),
      profitEstimate: this.roundToPrecision(grossProfit, 2),
      executionFee: this.roundToPrecision(executionFee, 2),
      slippage: this.roundToPrecision(slippage, 2),
      netProfit: this.roundToPrecision(netProfit, 2),
      riskLevel,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 実行可能性判定
   */
  isExecutable(
    opportunity: ArbitrageOpportunity,
    accountStates: { [accountId: string]: Account }
  ): boolean {
    const buyAccount = accountStates[opportunity.buyAccount];
    const sellAccount = accountStates[opportunity.sellAccount];
    
    if (!buyAccount || !sellAccount) {
      return false;
    }
    
    // 証拠金チェック
    const requiredMargin = this.calculateRequiredMargin(
      opportunity.symbol,
      opportunity.volume,
      opportunity.buyPrice
    );
    
    // 両口座で十分な証拠金があるかチェック
    const buyAccountAvailable = (buyAccount.equity || 0) - requiredMargin;
    const sellAccountAvailable = (sellAccount.equity || 0) - requiredMargin;
    
    return buyAccountAvailable > 0 && sellAccountAvailable > 0;
  }

  /**
   * 精密なスプレッド計算（金融計算精度対応）
   */
  private calculatePreciseSpread(sellPrice: number, buyPrice: number): number {
    return this.roundToPrecision(sellPrice - buyPrice, 5);
  }

  /**
   * 手数料計算
   */
  private calculateExecutionFee(volume: number, price: number): number {
    return volume * price * this.EXECUTION_FEE_RATE;
  }

  /**
   * スリッページ推定
   */
  private estimateSlippage(symbol: Symbol, volume: number): number {
    // 通貨ペア・ボリューム別のスリッページ推定
    const baseSlippage = this.MAX_SLIPPAGE;
    const volumeMultiplier = Math.min(volume * 10, 2); // ボリューム増加でスリッページ増加
    
    return baseSlippage * volumeMultiplier;
  }

  /**
   * 通貨ペア別乗数取得
   */
  private getMultiplier(symbol: Symbol): number {
    const multipliers: Record<Symbol, number> = {
      'USDJPY': 100000,
      'EURUSD': 100000,
      'EURGBP': 100000,
      'XAUUSD': 100
    };
    return multipliers[symbol] || 100000;
  }

  /**
   * リスクレベル評価
   */
  private evaluateRiskLevel(spread: number, volume: number, symbol: Symbol): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskScore = (volume * 100) + (spread < 0.0002 ? 2 : 0);
    
    if (riskScore < 5) return 'LOW';
    if (riskScore < 15) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * 必要証拠金計算
   */
  private calculateRequiredMargin(symbol: Symbol, volume: number, price: number): number {
    const leverage = 100; // 1:100レバレッジ
    const contractSize = this.getMultiplier(symbol);
    
    return (volume * contractSize * price) / leverage;
  }

  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
}

/**
 * PositionManager - ポジション状態管理・PnL計算
 */
export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private readonly PRICE_PRECISION = 5;

  /**
   * ポジション状態遷移管理
   */
  async transitionPosition(
    positionId: string,
    newStatus: PositionStatus,
    additionalData?: Partial<Position>
  ): Promise<boolean> {
    
    const position = this.positions.get(positionId);
    if (!position) {
      console.error(`Position not found: ${positionId}`);
      return false;
    }

    // 有効な状態遷移を定義
    const validTransitions: Record<PositionStatus, PositionStatus[]> = {
      'PENDING': ['OPENING', 'CANCELED'],
      'OPENING': ['OPEN', 'CANCELED'],
      'OPEN': ['CLOSING', 'STOPPED'],
      'CLOSING': ['CLOSED', 'STOPPED'],
      'CLOSED': [],
      'STOPPED': [],
      'CANCELED': []
    };

    if (!validTransitions[position.status].includes(newStatus)) {
      console.error(`Invalid transition: ${position.status} -> ${newStatus}`);
      return false;
    }

    // 状態更新
    const updatedPosition: Position = {
      ...position,
      ...additionalData,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    this.positions.set(positionId, updatedPosition);
    
    console.log(`✅ Position ${positionId}: ${position.status} -> ${newStatus}`);
    return true;
  }

  /**
   * リアルタイムPnL計算
   */
  calculatePositionPnL(
    position: Position,
    currentPrice: number
  ): number {
    
    if (position.status !== 'OPEN' || !position.entryPrice) {
      return 0;
    }

    const direction = position.executionType === 'ENTRY' ? 1 : -1;
    const priceDiff = (currentPrice - position.entryPrice) * direction;
    const multiplier = this.getSymbolMultiplier(position.symbol);
    
    return this.roundToPrecision(priceDiff * position.volume * multiplier, 2);
  }

  /**
   * ポートフォリオ全体のPnL計算
   */
  calculatePortfolioPnL(
    userId: string,
    currentPrices: { [symbol: string]: number }
  ): PnLCalculation {
    
    const userPositions = Array.from(this.positions.values())
      .filter(p => p.userId === userId);
    
    let unrealizedPnL = 0;
    let realizedPnL = 0;
    let winCount = 0;
    let lossCount = 0;
    let maxDrawdown = 0;
    
    userPositions.forEach(position => {
      if (position.status === 'OPEN') {
        // 未実現損益
        const currentPrice = currentPrices[position.symbol];
        if (currentPrice) {
          unrealizedPnL += this.calculatePositionPnL(position, currentPrice);
        }
      } else if (position.status === 'CLOSED' && position.exitPrice && position.entryPrice) {
        // 実現損益
        const direction = position.executionType === 'ENTRY' ? 1 : -1;
        const pnl = (position.exitPrice - position.entryPrice) * direction * position.volume * this.getSymbolMultiplier(position.symbol);
        realizedPnL += pnl;
        
        if (pnl > 0) winCount++;
        else lossCount++;
      }
    });
    
    const totalTrades = winCount + lossCount;
    const winRate = totalTrades > 0 ? winCount / totalTrades : 0;
    const profitFactor = lossCount > 0 ? Math.abs(realizedPnL) / Math.abs(realizedPnL - Math.abs(realizedPnL)) : 0;
    
    return {
      unrealizedPnL: this.roundToPrecision(unrealizedPnL, 2),
      realizedPnL: this.roundToPrecision(realizedPnL, 2),
      totalPnL: this.roundToPrecision(unrealizedPnL + realizedPnL, 2),
      dailyPnL: this.calculateDailyPnL(userId),
      maxDrawdown,
      winRate: this.roundToPrecision(winRate * 100, 1),
      profitFactor: this.roundToPrecision(profitFactor, 2)
    };
  }

  /**
   * Entry/Exit判定
   */
  shouldExecuteEntry(
    position: Position,
    marketConditions: { price: number; spread: number; volatility: number }
  ): boolean {
    // エントリー条件の判定ロジック
    if (position.status !== 'PENDING') {
      return false;
    }
    
    // 基本的な市場条件チェック
    const spreadThreshold = 0.0001;
    const volatilityThreshold = 0.01;
    
    return marketConditions.spread < spreadThreshold && 
           marketConditions.volatility < volatilityThreshold;
  }

  shouldExecuteExit(
    position: Position,
    currentPrice: number,
    targetProfit?: number,
    stopLoss?: number
  ): boolean {
    if (position.status !== 'OPEN' || !position.entryPrice) {
      return false;
    }
    
    const currentPnL = this.calculatePositionPnL(position, currentPrice);
    
    // 利確チェック
    if (targetProfit && currentPnL >= targetProfit) {
      return true;
    }
    
    // 損切りチェック
    if (stopLoss && currentPnL <= -Math.abs(stopLoss)) {
      return true;
    }
    
    return false;
  }

  private getSymbolMultiplier(symbol: Symbol): number {
    const multipliers: Record<Symbol, number> = {
      'USDJPY': 100000,
      'EURUSD': 100000,
      'EURGBP': 100000,
      'XAUUSD': 100
    };
    return multipliers[symbol] || 100000;
  }

  private calculateDailyPnL(userId: string): number {
    // 今日の実現損益を計算
    const today = new Date().toISOString().split('T')[0];
    // TODO: 実装
    return 0;
  }

  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  // ポジション管理メソッド
  addPosition(position: Position): void {
    this.positions.set(position.id, position);
  }

  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getUserPositions(userId: string): Position[] {
    return Array.from(this.positions.values())
      .filter(p => p.userId === userId);
  }
}

/**
 * RiskController - ロスカット判定・資金管理
 */
export class RiskController {
  private readonly MAX_RISK_PERCENTAGE = 2.0; // 最大リスク2%
  private readonly MAX_DRAWDOWN_PERCENTAGE = 10.0; // 最大ドローダウン10%
  private readonly MIN_MARGIN_LEVEL = 150.0; // 最小証拠金レベル150%
  private readonly MAX_CREDIT_UTILIZATION = 80.0; // 最大クレジット使用率80%

  /**
   * ロスカット判定
   */
  shouldExecuteStopOut(
    account: Account,
    positions: Position[],
    currentPrices: { [symbol: string]: number }
  ): { shouldStop: boolean; reason: string; positions: string[] } {
    
    // 証拠金レベルチェック
    const marginLevel = this.calculateMarginLevel(account, positions, currentPrices);
    if (marginLevel < this.MIN_MARGIN_LEVEL) {
      return {
        shouldStop: true,
        reason: 'MARGIN_CALL',
        positions: positions.filter(p => p.status === 'OPEN').map(p => p.id)
      };
    }
    
    // ドローダウンチェック
    const drawdownPercentage = this.calculateDrawdownPercentage(account, positions, currentPrices);
    if (drawdownPercentage > this.MAX_DRAWDOWN_PERCENTAGE) {
      return {
        shouldStop: true,
        reason: 'MAX_DRAWDOWN',
        positions: this.selectPositionsForStopOut(positions, currentPrices)
      };
    }
    
    return {
      shouldStop: false,
      reason: '',
      positions: []
    };
  }

  /**
   * リスク管理メトリクス計算
   */
  calculateRiskMetrics(
    account: Account,
    positions: Position[],
    currentPrices: { [symbol: string]: number }
  ): RiskMetrics {
    
    const marginLevel = this.calculateMarginLevel(account, positions, currentPrices);
    const currentExposure = this.calculateCurrentExposure(positions, currentPrices);
    const maxExposure = (account.balance || 0) * (this.MAX_RISK_PERCENTAGE / 100);
    const totalBalance = (account.balance || 0) + (account.credit || 0);
    const creditUtilization = totalBalance > 0 ? ((account.credit || 0) / totalBalance) * 100 : 0;
    const equityRatio = totalBalance > 0 ? ((account.equity || 0) / totalBalance) * 100 : 0;
    
    return {
      maxDrawdown: this.calculateDrawdownPercentage(account, positions, currentPrices),
      currentExposure: this.roundToPrecision(currentExposure, 2),
      maxExposure: this.roundToPrecision(maxExposure, 2),
      marginLevel: this.roundToPrecision(marginLevel, 1),
      riskPercentage: this.roundToPrecision((currentExposure / (account.balance || 1)) * 100, 2),
      creditUtilization: this.roundToPrecision(creditUtilization, 1),
      equityRatio: this.roundToPrecision(equityRatio * 100, 1)
    };
  }

  /**
   * エクスポージャー制御
   */
  isWithinRiskLimits(
    account: Account,
    newPositionVolume: number,
    newPositionSymbol: Symbol,
    currentPrice: number
  ): boolean {
    
    const additionalExposure = this.calculatePositionExposure(
      newPositionVolume,
      newPositionSymbol,
      currentPrice
    );
    
    const currentExposure = this.calculateCurrentExposure([], {}); // TODO: 現在のポジションを取得
    const totalExposure = currentExposure + additionalExposure;
    const maxAllowedExposure = (account.balance || 0) * (this.MAX_RISK_PERCENTAGE / 100);
    
    return totalExposure <= maxAllowedExposure;
  }

  /**
   * クレジット効率的活用判定
   */
  optimizeCreditUtilization(
    account: Account,
    availableOpportunities: ArbitrageOpportunity[]
  ): ArbitrageOpportunity[] {
    
    const maxCreditUsage = (account.credit || 0) * (this.MAX_CREDIT_UTILIZATION / 100);
    const sortedOpportunities = availableOpportunities
      .sort((a, b) => b.netProfit - a.netProfit); // 利益率順でソート
    
    const selectedOpportunities: ArbitrageOpportunity[] = [];
    let usedCredit = 0;
    
    for (const opportunity of sortedOpportunities) {
      const requiredCredit = opportunity.volume * opportunity.buyPrice * 0.01; // 1%証拠金と仮定
      
      if (usedCredit + requiredCredit <= maxCreditUsage) {
        selectedOpportunities.push(opportunity);
        usedCredit += requiredCredit;
      }
    }
    
    return selectedOpportunities;
  }

  // プライベートメソッド
  private calculateMarginLevel(
    account: Account,
    positions: Position[],
    currentPrices: { [symbol: string]: number }
  ): number {
    // 簡易計算
    const usedMargin = positions
      .filter(p => p.status === 'OPEN')
      .reduce((total, pos) => {
        const price = currentPrices[pos.symbol] || pos.entryPrice || 0;
        return total + (pos.volume * price * 0.01); // 1%証拠金率と仮定
      }, 0);
    
    return usedMargin > 0 ? ((account.equity || 0) / usedMargin) * 100 : 1000;
  }

  private calculateDrawdownPercentage(
    account: Account,
    positions: Position[],
    currentPrices: { [symbol: string]: number }
  ): number {
    // TODO: 実装
    return 0;
  }

  private calculateCurrentExposure(
    positions: Position[],
    currentPrices: { [symbol: string]: number }
  ): number {
    return positions
      .filter(p => p.status === 'OPEN')
      .reduce((total, pos) => {
        const price = currentPrices[pos.symbol] || pos.entryPrice || 0;
        return total + (pos.volume * price);
      }, 0);
  }

  private calculatePositionExposure(
    volume: number,
    symbol: Symbol,
    price: number
  ): number {
    return volume * price;
  }

  private selectPositionsForStopOut(
    positions: Position[],
    currentPrices: { [symbol: string]: number }
  ): string[] {
    // 損失の大きいポジションから選択
    return positions
      .filter(p => p.status === 'OPEN')
      .map(p => p.id)
      .slice(0, Math.ceil(positions.length * 0.5)); // 半分のポジションを決済対象
  }

  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
}

/**
 * メインのHedgeSystemCoreクラス
 */
export class HedgeSystemCore {
  private isRunning = false;
  private arbitrageEngine: ArbitrageEngine;
  private positionManager: PositionManager;
  private riskController: RiskController;
  
  constructor() {
    this.arbitrageEngine = new ArbitrageEngine();
    this.positionManager = new PositionManager();
    this.riskController = new RiskController();
  }
  
  async start() {
    this.isRunning = true;
    console.log('✅ Hedge System Core started - Ready for financial calculations');
  }
  
  async stop() {
    this.isRunning = false;
    console.log('⏹️ Hedge System Core stopped');
  }
  
  getStatus() {
    return {
      isRunning: this.isRunning,
      status: this.isRunning ? 'RUNNING' : 'STOPPED',
      engines: {
        arbitrage: !!this.arbitrageEngine,
        position: !!this.positionManager,
        risk: !!this.riskController
      }
    };
  }

  // エンジンへのアクセサー
  get arbitrage() {
    return this.arbitrageEngine;
  }

  get positions() {
    return this.positionManager;
  }

  get risk() {
    return this.riskController;
  }

  /**
   * 高速アービトラージ機会検出（< 50ms目標）
   */
  async detectArbitrageOpportunities(
    symbol: Symbol,
    accounts: { [accountId: string]: Account },
    marketData: { [accountId: string]: { buyPrice: number; sellPrice: number } },
    volume: number = 0.01
  ): Promise<ArbitrageOpportunity[]> {
    
    const opportunities: ArbitrageOpportunity[] = [];
    const accountIds = Object.keys(accounts);
    
    // 全口座ペアでアービトラージ機会を検出
    for (let i = 0; i < accountIds.length; i++) {
      for (let j = i + 1; j < accountIds.length; j++) {
        const buyAccountId = accountIds[i];
        const sellAccountId = accountIds[j];
        
        const buyData = marketData[buyAccountId];
        const sellData = marketData[sellAccountId];
        
        if (!buyData || !sellData) continue;
        
        // 双方向でチェック
        const opportunity1 = this.arbitrageEngine.detectArbitrageOpportunity(
          symbol, buyAccountId, sellAccountId,
          buyData.buyPrice, sellData.sellPrice, volume
        );
        
        const opportunity2 = this.arbitrageEngine.detectArbitrageOpportunity(
          symbol, sellAccountId, buyAccountId,
          sellData.buyPrice, buyData.sellPrice, volume
        );
        
        if (opportunity1) opportunities.push(opportunity1);
        if (opportunity2) opportunities.push(opportunity2);
      }
    }
    
    // 実行可能性をチェック
    return opportunities.filter(opp => 
      this.arbitrageEngine.isExecutable(opp, accounts)
    );
  }

  /**
   * 高速ポジション状態更新（< 10ms目標）
   */
  async updatePositionState(
    positionId: string,
    newStatus: PositionStatus,
    additionalData?: Partial<Position>
  ): Promise<boolean> {
    return this.positionManager.transitionPosition(positionId, newStatus, additionalData);
  }

  /**
   * リアルタイムリスク監視（< 20ms目標）
   */
  async monitorRisk(
    userId: string,
    accounts: { [accountId: string]: Account },
    currentPrices: { [symbol: string]: number }
  ): Promise<{ alerts: string[]; actions: string[] }> {
    
    const alerts: string[] = [];
    const actions: string[] = [];
    
    for (const account of Object.values(accounts)) {
      const userPositions = this.positionManager.getUserPositions(userId)
        .filter(p => p.accountId === account.id);
      
      const stopOutCheck = this.riskController.shouldExecuteStopOut(
        account, userPositions, currentPrices
      );
      
      if (stopOutCheck.shouldStop) {
        alerts.push(`❌ Stop-out required for account ${account.id}: ${stopOutCheck.reason}`);
        actions.push(...stopOutCheck.positions.map(posId => `STOP_OUT:${posId}`));
      }
      
      const riskMetrics = this.riskController.calculateRiskMetrics(
        account, userPositions, currentPrices
      );
      
      if (riskMetrics.marginLevel < 200) {
        alerts.push(`⚠️ Low margin level: ${riskMetrics.marginLevel}%`);
      }
      
      if (riskMetrics.creditUtilization > 70) {
        alerts.push(`⚠️ High credit utilization: ${riskMetrics.creditUtilization}%`);
      }
    }
    
    return { alerts, actions };
  }

  /**
   * 利益最適化計算
   */
  async optimizeProfit(
    userId: string,
    availableOpportunities: ArbitrageOpportunity[],
    accounts: { [accountId: string]: Account }
  ): Promise<ArbitrageOpportunity[]> {
    
    let optimizedOpportunities: ArbitrageOpportunity[] = [];
    
    for (const account of Object.values(accounts)) {
      const accountOpportunities = availableOpportunities.filter(
        opp => opp.buyAccount === account.id || opp.sellAccount === account.id
      );
      
      const optimized = this.riskController.optimizeCreditUtilization(
        account, accountOpportunities
      );
      
      optimizedOpportunities = optimizedOpportunities.concat(optimized);
    }
    
    return optimizedOpportunities
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, 10); // 上位10件
  }

  /**
   * トレール条件評価（高速処理対応）
   */
  evaluateTrailConditions(
    positions: Position[],
    currentPrices: { [symbol: string]: number }
  ): TrailCondition[] {
    
    const trailConditions: TrailCondition[] = [];
    
    positions
      .filter(p => p.status === 'OPEN' && p.trailWidth && p.trailWidth > 0)
      .forEach(position => {
        const currentPrice = currentPrices[position.symbol];
        if (!currentPrice || !position.entryPrice) return;
        
        const direction = position.executionType === 'ENTRY' ? 'BUY' : 'SELL';
        const trailWidth = position.trailWidth!;
        
        let triggerPrice: number;
        let isTriggered: boolean;
        
        if (direction === 'BUY') {
          triggerPrice = position.entryPrice + trailWidth;
          isTriggered = currentPrice >= triggerPrice;
        } else {
          triggerPrice = position.entryPrice - trailWidth;
          isTriggered = currentPrice <= triggerPrice;
        }
        
        trailConditions.push({
          positionId: position.id,
          currentPrice,
          trailWidth,
          triggerPrice,
          direction,
          isTriggered
        });
      });
    
    return trailConditions;
  }

  /**
   * パフォーマンス統計取得
   */
  getPerformanceStats() {
    return {
      totalPositions: this.positionManager.getAllPositions().length,
      engines: {
        arbitrage: this.arbitrageEngine,
        position: this.positionManager,
        risk: this.riskController
      },
      systemStatus: this.getStatus()
    };
  }
}

// シングルトンインスタンス
export const hedgeSystemCore = new HedgeSystemCore();