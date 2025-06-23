import { Strategy, Position, PositionStatus, PriceData, MarketConditions, EntryParams } from '@repo/shared-types';
import { TrailingStopManager } from './trailing-stop-manager.js';
import { RiskManager } from './risk-manager.js';
import { PriceMonitor } from './price-monitor.js';

export interface StrategyContext {
  strategy: Strategy;
  positions: Position[];
  currentPrices: Map<string, PriceData>;
  marketConditions: MarketConditions;
}

export class StrategyEngine {
  private activeStrategies: Map<string, Strategy> = new Map();
  private trailingStopManager: TrailingStopManager;
  private riskManager: RiskManager;
  private priceMonitor: PriceMonitor;
  
  constructor(
    trailingStopManager: TrailingStopManager,
    riskManager: RiskManager,
    priceMonitor: PriceMonitor
  ) {
    this.trailingStopManager = trailingStopManager;
    this.riskManager = riskManager;
    this.priceMonitor = priceMonitor;
  }
  
  async loadStrategy(strategy: Strategy): Promise<void> {
    // 戦略の読み込みと初期化
    this.activeStrategies.set(strategy.strategyId, strategy);
    await this.initializeStrategy(strategy);
  }
  
  async unloadStrategy(strategyId: string): Promise<void> {
    // 戦略の停止とクリーンアップ
    const strategy = this.activeStrategies.get(strategyId);
    if (strategy) {
      await this.cleanupStrategy(strategy);
      this.activeStrategies.delete(strategyId);
    }
  }
  
  async processMarketUpdate(priceData: PriceData): Promise<void> {
    // 市場データ更新処理
    this.priceMonitor.updatePrice(priceData);
    
    // 各戦略の処理
    for (const strategy of Array.from(this.activeStrategies.values())) {
      await this.processStrategyUpdate(strategy, priceData);
    }
  }
  
  private async processStrategyUpdate(
    strategy: Strategy, 
    priceData: PriceData
  ): Promise<void> {
    // 戦略固有の市場更新処理
    const positions = await this.getPositionsForStrategy(strategy.strategyId);
    const relevantPositions = positions.filter(p => p.symbol === priceData.symbol);
    
    for (const position of relevantPositions) {
      await this.processPositionUpdate(position, priceData, strategy);
    }
  }
  
  private async processPositionUpdate(
    position: Position,
    priceData: PriceData,
    strategy: Strategy
  ): Promise<void> {
    if (position.status !== PositionStatus.OPEN) return;
    
    // リスク管理チェック
    const riskAssessment = await this.riskManager.assessPosition(position, priceData);
    if (riskAssessment.shouldClose) {
      await this.closePosition(position, 'risk_management');
      return;
    }
    
    // トレーリングストップ更新
    const newStopLoss = await this.trailingStopManager.updateTrailingStop(
      position, 
      priceData, 
      strategy
    );
    
    if (newStopLoss && newStopLoss !== position.stopLoss) {
      await this.updateStopLoss(position, newStopLoss);
    }
  }
  
  async executeEntry(strategy: Strategy, entryParams: EntryParams): Promise<Position> {
    // エントリー実行
    const riskCheck = await this.riskManager.validateEntry(strategy, entryParams);
    if (!riskCheck.approved) {
      throw new Error(`Entry rejected: ${riskCheck.reason}`);
    }
    
    const position = await this.createPosition(strategy, entryParams);
    return position;
  }
  
  async closePosition(position: Position, reason: string): Promise<void> {
    // ポジション決済
    const command = {
      type: 'CLOSE',
      positionId: position.positionId,
      reason,
      timestamp: new Date().toISOString()
    };
    
    await this.sendTradeCommand(command);
  }
  
  private async initializeStrategy(strategy: Strategy): Promise<void> {
    // 戦略初期化処理
    // 既存ポジションの読み込み
    const positions = await this.getPositionsForStrategy(strategy.strategyId);
    
    // トレーリングストップの復元
    for (const position of positions) {
      if (position.status === PositionStatus.OPEN) {
        await this.trailingStopManager.initializeTrailingStop(position, strategy);
      }
    }
  }
  
  private async cleanupStrategy(strategy: Strategy): Promise<void> {
    // 戦略終了処理
    const positions = await this.getPositionsForStrategy(strategy.strategyId);
    
    // 関連ポジションのクローズ（オプション）
    for (const position of positions) {
      if (position.status === PositionStatus.OPEN) {
        this.trailingStopManager.removeTrailingStop(position.positionId);
      }
    }
  }
  
  private async getPositionsForStrategy(strategyId: string): Promise<Position[]> {
    // 戦略に関連するポジションを取得
    // 実装要：データベースまたはキャッシュから取得
    return [];
  }
  
  private async createPosition(strategy: Strategy, entryParams: EntryParams): Promise<Position> {
    // ポジション作成
    const position: Position = {
      positionId: crypto.randomUUID(),
      strategyId: strategy.strategyId,
      symbol: entryParams.symbol as any, // TODO: Fix Symbol type mismatch
      volume: entryParams.volume,
      entryPrice: entryParams.price,
      stopLoss: entryParams.stopLoss,
      takeProfit: entryParams.takeProfit,
      status: PositionStatus.OPEN,
      entryTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // トレーリングストップの初期化
    await this.trailingStopManager.initializeTrailingStop(position, strategy);
    
    return position;
  }
  
  private async updateStopLoss(position: Position, newStopLoss: number): Promise<void> {
    // ストップロス更新
    const command = {
      type: 'MODIFY_STOP',
      positionId: position.positionId,
      stopLoss: newStopLoss,
      timestamp: new Date().toISOString()
    };
    
    await this.sendTradeCommand(command);
  }
  
  private async sendTradeCommand(command: any): Promise<void> {
    // 取引コマンド送信
    // 実装要：WebSocketまたはAPIを通じて送信
    console.log('Trade command:', command);
  }
  
  // 戦略の状態取得
  getActiveStrategies(): Strategy[] {
    return Array.from(this.activeStrategies.values());
  }
  
  getStrategy(strategyId: string): Strategy | undefined {
    return this.activeStrategies.get(strategyId);
  }
}