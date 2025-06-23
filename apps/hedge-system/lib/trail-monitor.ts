import { Position } from './types';

export class TrailMonitor {
  private position: Position;
  private lastPrice: number = 0;
  private bestPrice: number = 0;
  private isTriggered: boolean = false;

  constructor(position: Position) {
    this.position = position;
    this.initializeBestPrice();
  }

  /**
   * 最適価格を初期化
   */
  private initializeBestPrice(): void {
    // エントリー価格から開始、またはロング・ショートに応じて調整
    this.bestPrice = this.position.entryPrice || 0;
    this.lastPrice = this.bestPrice;
    
    console.log(`Trail monitor initialized for position ${this.position.id}: bestPrice=${this.bestPrice}`);
  }

  /**
   * トレール判定ロジック
   * @param newPrice 新しい価格
   * @returns トリガーされた場合true
   */
  async updatePrice(newPrice: number): Promise<boolean> {
    if (this.isTriggered) return false;

    // トレール条件判定
    const isTriggered = this.checkTrailCondition(newPrice);

    if (isTriggered) {
      this.isTriggered = true;
      console.log(`🎯 Trail triggered for position ${this.position.id} at price ${newPrice}`);
      return true;
    }

    this.updateBestPrice(newPrice);
    this.lastPrice = newPrice;
    return false;
  }

  /**
   * トレール条件判定（MVPシステム設計準拠）
   * @param currentPrice 現在価格
   * @returns トリガー条件成立の場合true
   */
  private checkTrailCondition(currentPrice: number): boolean {
    if (!this.position.trailWidth || this.position.trailWidth <= 0) {
      return false;
    }

    // MVPシステム設計準拠のトレール判定
    // bestPriceからの下落幅がtrailWidthを超えた場合にトリガー
    const trailThreshold = this.bestPrice - this.position.trailWidth;
    const isTriggered = currentPrice <= trailThreshold;

    if (isTriggered) {
      console.log(`Trail condition met: currentPrice=${currentPrice}, bestPrice=${this.bestPrice}, threshold=${trailThreshold}, trailWidth=${this.position.trailWidth}`);
    }

    return isTriggered;
  }

  /**
   * 最適価格更新
   * @param newPrice 新しい価格
   */
  private updateBestPrice(newPrice: number): void {
    // 価格が上昇した場合のみbestPriceを更新（ロング前提）
    // TODO: ショートポジションの場合は逆ロジックが必要
    if (newPrice > this.bestPrice) {
      const previousBest = this.bestPrice;
      this.bestPrice = newPrice;
      
      console.log(`Best price updated for position ${this.position.id}: ${previousBest} -> ${this.bestPrice}`);
    }
  }

  /**
   * 監視状態取得
   */
  getMonitorStatus(): {
    positionId: string;
    symbol: string;
    trailWidth: number;
    lastPrice: number;
    bestPrice: number;
    isTriggered: boolean;
    currentDrawdown: number;
  } {
    const currentDrawdown = this.bestPrice - this.lastPrice;
    
    return {
      positionId: this.position.id,
      symbol: this.position.symbol.toString(),
      trailWidth: this.position.trailWidth || 0,
      lastPrice: this.lastPrice,
      bestPrice: this.bestPrice,
      isTriggered: this.isTriggered,
      currentDrawdown
    };
  }

  /**
   * トリガー状態取得
   */
  isAlreadyTriggered(): boolean {
    return this.isTriggered;
  }

  /**
   * ポジション情報取得
   */
  getPosition(): Position {
    return this.position;
  }

  /**
   * トレール幅取得
   */
  getTrailWidth(): number {
    return this.position.trailWidth || 0;
  }

  /**
   * triggerActionIds取得
   */
  getTriggerActionIds(): string[] {
    try {
      return this.position.triggerActionIds ? JSON.parse(this.position.triggerActionIds) : [];
    } catch (error) {
      console.error(`Failed to parse triggerActionIds for position ${this.position.id}:`, error);
      return [];
    }
  }

  /**
   * 監視強制停止
   */
  forceStop(): void {
    this.isTriggered = true;
    console.log(`Trail monitoring force stopped for position ${this.position.id}`);
  }

  /**
   * 監視リセット（デバッグ用）
   */
  reset(): void {
    this.isTriggered = false;
    this.initializeBestPrice();
    console.log(`Trail monitor reset for position ${this.position.id}`);
  }
}