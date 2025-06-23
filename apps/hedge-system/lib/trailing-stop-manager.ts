import { Position, Strategy, PriceData } from '@repo/shared-types';

export interface TrailingStopState {
  positionId: string;
  currentStopLoss: number;
  highestPrice: number; // for long positions
  lowestPrice: number;  // for short positions
  trailWidth: number;
  lastUpdateTime: Date;
}

export class TrailingStopManager {
  private trailingStops: Map<string, TrailingStopState> = new Map();
  
  async initializeTrailingStop(
    position: Position, 
    strategy: Strategy
  ): Promise<void> {
    if (!position.entryPrice) return;
    
    const state: TrailingStopState = {
      positionId: position.positionId,
      currentStopLoss: position.stopLoss || position.entryPrice,
      highestPrice: position.entryPrice,
      lowestPrice: position.entryPrice,
      trailWidth: strategy.trailWidth,
      lastUpdateTime: new Date()
    };
    
    this.trailingStops.set(position.positionId, state);
    this.logTrailingInit(position.positionId, state);
  }
  
  async updateTrailingStop(
    position: Position,
    priceData: PriceData,
    strategy: Strategy
  ): Promise<number | null> {
    const state = this.trailingStops.get(position.positionId);
    if (!state) return null;
    
    const currentPrice = this.getCurrentPrice(priceData, position);
    let newStopLoss: number | null = null;
    
    // ロング・ショートの判定
    const isLong = this.isLongPosition(position);
    
    if (isLong) {
      // ロングポジションのトレーリング
      if (currentPrice > state.highestPrice) {
        state.highestPrice = currentPrice;
        newStopLoss = currentPrice - (strategy.trailWidth * this.getPointValue(position.symbol));
        
        // 既存のストップロスより有利な場合のみ更新
        if (newStopLoss > state.currentStopLoss) {
          state.currentStopLoss = newStopLoss;
          state.lastUpdateTime = new Date();
          
          this.logTrailingUpdate(position.positionId, 'LONG', newStopLoss, currentPrice);
          return newStopLoss;
        }
      }
    } else {
      // ショートポジションのトレーリング
      if (currentPrice < state.lowestPrice) {
        state.lowestPrice = currentPrice;
        newStopLoss = currentPrice + (strategy.trailWidth * this.getPointValue(position.symbol));
        
        // 既存のストップロスより有利な場合のみ更新
        if (newStopLoss < state.currentStopLoss) {
          state.currentStopLoss = newStopLoss;
          state.lastUpdateTime = new Date();
          
          this.logTrailingUpdate(position.positionId, 'SHORT', newStopLoss, currentPrice);
          return newStopLoss;
        }
      }
    }
    
    return null;
  }
  
  removeTrailingStop(positionId: string): void {
    const removed = this.trailingStops.delete(positionId);
    if (removed) {
      this.logTrailingRemoval(positionId);
    }
  }
  
  getTrailingStopState(positionId: string): TrailingStopState | undefined {
    return this.trailingStops.get(positionId);
  }
  
  getAllTrailingStops(): TrailingStopState[] {
    return Array.from(this.trailingStops.values());
  }
  
  private getCurrentPrice(priceData: PriceData, position: Position): number {
    // ポジションの方向に応じて適切な価格を返す
    return this.isLongPosition(position) ? priceData.bid : priceData.ask;
  }
  
  private isLongPosition(position: Position): boolean {
    // ポジションの方向判定
    // 簡易的にvolume > 0をロングとする
    return position.volume > 0;
  }
  
  private getPointValue(symbol: string): number {
    // 通貨ペアごとのポイント値
    const pointValues: Record<string, number> = {
      'USDJPY': 0.01,
      'EURJPY': 0.01,
      'GBPJPY': 0.01,
      'AUDJPY': 0.01,
      'NZDJPY': 0.01,
      'CADJPY': 0.01,
      'CHFJPY': 0.01,
      'EURUSD': 0.0001,
      'GBPUSD': 0.0001,
      'AUDUSD': 0.0001,
      'NZDUSD': 0.0001,
      'USDCAD': 0.0001,
      'USDCHF': 0.0001,
      'EURGBP': 0.0001,
      'EURAUD': 0.0001,
      'EURNZD': 0.0001,
      'EURCAD': 0.0001,
      'EURCHF': 0.0001,
      'GBPAUD': 0.0001,
      'GBPNZD': 0.0001,
      'GBPCAD': 0.0001,
      'GBPCHF': 0.0001,
      'AUDNZD': 0.0001,
      'AUDCAD': 0.0001,
      'AUDCHF': 0.0001,
      'NZDCAD': 0.0001,
      'NZDCHF': 0.0001,
      'CADCHF': 0.0001
    };
    
    return pointValues[symbol] || 0.0001;
  }
  
  private logTrailingInit(positionId: string, state: TrailingStopState): void {
    console.log(`Trailing Stop Initialized - Position: ${positionId}, Initial Stop: ${state.currentStopLoss}, Trail Width: ${state.trailWidth}`);
  }
  
  private logTrailingUpdate(
    positionId: string, 
    direction: string, 
    newStopLoss: number, 
    currentPrice: number
  ): void {
    console.log(`Trailing Stop Updated - Position: ${positionId}, Direction: ${direction}, New Stop: ${newStopLoss}, Current Price: ${currentPrice}`);
  }
  
  private logTrailingRemoval(positionId: string): void {
    console.log(`Trailing Stop Removed - Position: ${positionId}`);
  }
  
  // デバッグ用メソッド
  getStats(): {
    activeTrails: number;
    totalUpdates: number;
    averageTrailWidth: number;
  } {
    const states = Array.from(this.trailingStops.values());
    const totalTrailWidth = states.reduce((sum, state) => sum + state.trailWidth, 0);
    
    return {
      activeTrails: states.length,
      totalUpdates: 0, // 実装要：更新回数の追跡
      averageTrailWidth: states.length > 0 ? totalTrailWidth / states.length : 0
    };
  }
  
  // ストレステスト用メソッド
  validateTrailingStops(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    for (const [positionId, state] of Array.from(this.trailingStops.entries())) {
      // 基本的な検証
      if (state.trailWidth <= 0) {
        errors.push(`Invalid trail width for position ${positionId}: ${state.trailWidth}`);
      }
      
      if (state.highestPrice < 0) {
        errors.push(`Invalid highest price for position ${positionId}: ${state.highestPrice}`);
      }
      
      if (state.lowestPrice < 0) {
        errors.push(`Invalid lowest price for position ${positionId}: ${state.lowestPrice}`);
      }
      
      // 時間の検証（24時間以上更新されていない場合は警告）
      const timeSinceUpdate = Date.now() - state.lastUpdateTime.getTime();
      if (timeSinceUpdate > 24 * 60 * 60 * 1000) {
        errors.push(`Stale trailing stop for position ${positionId}: last update ${Math.floor(timeSinceUpdate / (60 * 60 * 1000))} hours ago`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}