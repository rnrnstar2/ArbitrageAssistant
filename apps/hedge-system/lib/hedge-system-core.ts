/**
 * Hedge System Core - MVP基本実装
 */

interface Position {
  id: string;
  accountId: string;
  symbol: string;
  volume: number;
  status: 'PENDING' | 'OPENING' | 'OPEN' | 'CLOSING' | 'CLOSED';
  entryPrice?: number;
  exitPrice?: number;
  profit?: number;
}

interface ArbitrageOpportunity {
  symbol: string;
  buyAccount: string;
  sellAccount: string;
  spread: number;
  volume: number;
  profitEstimate: number;
}

export class HedgeSystemCore {
  private isRunning = false;
  private positions: Position[] = [];
  private readonly DECIMAL_PRECISION = 5;
  
  async start() {
    this.isRunning = true;
    console.warn('✅ Hedge System Core started');
  }
  
  async stop() {
    this.isRunning = false;
    console.warn('⏹️ Hedge System Core stopped');
  }
  
  getStatus() {
    return this.isRunning ? 'RUNNING' : 'STOPPED';
  }

  // 基本的なアービトラージ計算
  calculateArbitrageOpportunity(
    symbol: string,
    buyPrice: number,
    sellPrice: number,
    volume: number = 0.01
  ): ArbitrageOpportunity | null {
    const spread = this.roundToPrecision(sellPrice - buyPrice, this.DECIMAL_PRECISION);
    
    if (spread <= 0) return null;
    
    const profitEstimate = this.roundToPrecision(spread * volume * 100000, 2); // 仮想的な計算
    
    return {
      symbol,
      buyAccount: 'account1',
      sellAccount: 'account2', 
      spread,
      volume,
      profitEstimate
    };
  }

  // ポジション状態遷移
  async transitionPosition(positionId: string, newStatus: Position['status']): Promise<boolean> {
    const position = this.positions.find(p => p.id === positionId);
    if (!position) return false;

    const validTransitions: Record<Position['status'], Position['status'][]> = {
      'PENDING': ['OPENING', 'CLOSED'],
      'OPENING': ['OPEN', 'CLOSED'],
      'OPEN': ['CLOSING'],
      'CLOSING': ['CLOSED'],
      'CLOSED': []
    };

    if (!validTransitions[position.status].includes(newStatus)) {
      console.warn(`Invalid transition from ${position.status} to ${newStatus}`);
      return false;
    }

    position.status = newStatus;
    console.warn(`Position ${positionId} transitioned to ${newStatus}`);
    return true;
  }

  // 新規ポジション作成
  createPosition(accountId: string, symbol: string, volume: number): Position {
    const position: Position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountId,
      symbol,
      volume: this.roundToPrecision(volume, this.DECIMAL_PRECISION),
      status: 'PENDING'
    };
    
    this.positions.push(position);
    return position;
  }

  // ポジション取得
  getPosition(positionId: string): Position | undefined {
    return this.positions.find(p => p.id === positionId);
  }

  // 全ポジション取得
  getAllPositions(): Position[] {
    return [...this.positions];
  }

  // 金融計算精度確保
  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  // 基本的なリスク計算
  calculateRisk(volume: number, entryPrice: number, stopLoss: number): number {
    const riskPips = Math.abs(entryPrice - stopLoss);
    return this.roundToPrecision(riskPips * volume * 10, 2);
  }
}

export const hedgeSystemCore = new HedgeSystemCore();