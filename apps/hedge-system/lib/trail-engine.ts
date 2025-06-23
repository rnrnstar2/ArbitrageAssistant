import { Position, PositionStatus } from './types';
import { PositionService } from './position-service';
import { PriceMonitor } from './price-monitor';
import { ActionManager } from './action-manager';

interface TrailPosition {
  positionId: string;
  symbol: string;
  trailWidth: number;
  triggerActionIds: string[];
  lastPrice: number;
  highWaterMark: number;
  isActive: boolean;
}

export class TrailEngine {
  private trailPositions: Map<string, TrailPosition> = new Map();
  private priceMonitor: PriceMonitor;
  private actionManager: ActionManager;

  constructor(priceMonitor: PriceMonitor, actionManager: ActionManager) {
    this.priceMonitor = priceMonitor;
    this.actionManager = actionManager;
  }

  /**
   * トレール監視追加
   */
  addTrailPosition(position: Position): void {
    if (!position.trailWidth || position.trailWidth <= 0) {
      return; // トレール設定なし
    }

    const trailPosition: TrailPosition = {
      positionId: position.id,
      symbol: position.symbol.toString(),
      trailWidth: position.trailWidth,
      triggerActionIds: JSON.parse(position.triggerActionIds || '[]'),
      lastPrice: position.entryPrice || 0,
      highWaterMark: position.entryPrice || 0, // エントリー価格から開始
      isActive: true
    };

    this.trailPositions.set(position.id, trailPosition);
    
    // 価格監視開始
    this.priceMonitor.subscribe(position.symbol.toString(), (price) => {
      this.checkTrailCondition(position.id, price);
    });
    
    console.log(`Trail monitoring added for position ${position.id} (width: ${position.trailWidth})`);
  }

  /**
   * トレール監視停止
   */
  stopTrailMonitoring(positionId: string): void {
    const trailPos = this.trailPositions.get(positionId);
    if (trailPos) {
      this.trailPositions.delete(positionId);
      console.log(`Trail monitoring stopped for position ${positionId}`);
    }
  }

  /**
   * 全監視対象ポジションのトレール監視開始
   */
  async startAllTrailMonitoring(): Promise<void> {
    try {
      const trailPositions = await this.getTrailPositions();
      console.log(`Starting trail monitoring for ${trailPositions.length} positions`);
      
      for (const position of trailPositions) {
        this.addTrailPosition(position);
      }
    } catch (error) {
      console.error('Failed to start all trail monitoring:', error);
    }
  }

  /**
   * トレール条件判定（各ポジション独立）
   */
  private checkTrailCondition(positionId: string, currentPrice: number): void {
    const trailPos = this.trailPositions.get(positionId);
    if (!trailPos || !trailPos.isActive) return;

    // 高値更新確認
    if (currentPrice > trailPos.highWaterMark) {
      trailPos.highWaterMark = currentPrice;
    }

    // トレール条件判定
    const dropFromHigh = trailPos.highWaterMark - currentPrice;
    if (dropFromHigh >= trailPos.trailWidth) {
      // トレール発動！
      this.triggerTrailActions(trailPos);
    }

    trailPos.lastPrice = currentPrice;
  }


  /**
   * pipsを価格差に変換
   */
  private convertPipsToPrice(symbol: string, pips: number): number {
    switch (symbol) {
      case 'USDJPY':
        return pips * 0.01;  // JPY銘柄
      case 'EURUSD':
      case 'EURGBP':
        return pips * 0.0001; // 通常銘柄
      case 'XAUUSD':
        return pips * 0.1;    // ゴールド
      default:
        return pips * 0.0001; // デフォルト
    }
  }

  /**
   * トレール発動時のAction実行
   */
  private async triggerTrailActions(trailPos: TrailPosition): Promise<void> {
    try {
      // 監視停止
      trailPos.isActive = false;

      // 各triggerActionIdを実行状態に変更
      for (const actionId of trailPos.triggerActionIds) {
        await this.actionManager.triggerAction(actionId);
      }

      // 監視リストから削除
      this.trailPositions.delete(trailPos.positionId);
      
      console.log(`Trail actions triggered for position ${trailPos.positionId}`);
      
    } catch (error) {
      console.error('Trail trigger failed:', error);
      // エラー時も監視停止
      trailPos.isActive = false;
    }
  }

  /**
   * 即時実行（trailWidth = 0）
   */
  async checkImmediateExecution(position: Position): Promise<void> {
    if (position.trailWidth === 0 && position.triggerActionIds) {
      // 即座にトリガー
      const actionIds = JSON.parse(position.triggerActionIds);
      for (const actionId of actionIds) {
        await this.actionManager.triggerAction(actionId);
      }
      console.log(`Immediate execution triggered for position ${position.id}`);
    }
  }

  /**
   * ロスカット時のアクション実行
   */
  async triggerStopOutActions(positionId: string): Promise<void> {
    try {
      // ポジション取得
      const position = await this.getPosition(positionId);
      if (!position) {
        console.log(`Position ${positionId} not found for stop out`);
        return;
      }

      // トレールアクションと同じロジックで実行
      await this.triggerTrailActions(position);
      
    } catch (error) {
      console.error(`Failed to trigger stop out actions for ${positionId}:`, error);
    }
  }


  /**
   * ポジション情報取得
   */
  private async getPosition(positionId: string): Promise<Position | null> {
    try {
      // PositionServiceを使用してポジション取得
      const result = await PositionService.listOpen();
      const positions = result.data.listPositions.items;
      return positions.find((p: Position) => p.id === positionId) || null;
    } catch (error) {
      console.error(`Failed to get position ${positionId}:`, error);
      return null;
    }
  }

  /**
   * トレール対象ポジション取得
   */
  private async getTrailPositions(): Promise<Position[]> {
    try {
      // PositionServiceを使用してトレール対象ポジション取得
      const result = await PositionService.listTrailPositions();
      return result.data.listPositions.items;
    } catch (error) {
      console.error('Failed to get trail positions:', error);
      return [];
    }
  }

  /**
   * TrailEngineエンジン開始
   */
  async start(): Promise<void> {
    console.log('🚀 Trail Engine started');
  }

  /**
   * 価格更新イベント処理（HedgeSystemCore用）
   */
  async handlePriceUpdate(priceUpdate: any): Promise<void> {
    this.updatePrice(priceUpdate.symbol, priceUpdate.price);
  }

  /**
   * ロスカット処理（HedgeSystemCore用）
   */
  async handleLossCut(positionId: string, lossCutPrice: number): Promise<void> {
    await this.triggerStopOutActions(positionId);
  }

  /**
   * 価格更新イベント処理
   */
  updatePrice(symbol: string, price: number): void {
    // PriceMonitor経由で価格更新を処理
    // 実際の処理はcheckTrailConditionで行われる
    console.log(`Price updated for ${symbol}: ${price}`);
  }

  /**
   * 統計情報取得（HedgeSystemCore用）
   */
  getStats() {
    return this.getTrailStats();
  }

  /**
   * 全トレール監視停止
   */
  stopAllTrailMonitoring(): void {
    this.trailPositions.clear();
    console.log('All trail monitoring stopped');
  }

  /**
   * 監視中ポジション一覧取得
   */
  getMonitoringPositions(): string[] {
    return Array.from(this.trailPositions.keys());
  }

  /**
   * トレール統計取得
   */
  getTrailStats(): {
    monitoringCount: number;
    activePositions: string[];
  } {
    return {
      monitoringCount: this.trailPositions.size,
      activePositions: Array.from(this.trailPositions.keys())
    };
  }
}

// シングルトンインスタンス
export const trailEngine = new TrailEngine();