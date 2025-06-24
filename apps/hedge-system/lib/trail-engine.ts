import { Position, Action, ActionStatus } from '@repo/shared-types';
import { PriceMonitor } from './price-monitor';
import { amplifyClient, getCurrentUserId } from './amplify-client';
import { 
  updateAction,
  listUserPositions
} from '@repo/shared-amplify';


export interface TrailEngineStats {
  monitoringCount: number;
  activePositions: string[];
  totalTriggered: number;
  lastUpdate: Date;
}

interface MonitoredPosition {
  position: Position;
  trailWidth: number;
  triggerActionIds: string[];
  lastPrice: number;
  highWaterMark: number;
  isActive: boolean;
}

export class TrailEngine {
  private monitoredPositions: Map<string, MonitoredPosition> = new Map();
  private priceMonitor?: PriceMonitor;
  private totalTriggered: number = 0;

  constructor(priceMonitor?: PriceMonitor) {
    this.priceMonitor = priceMonitor;
  }

  /**
   * ポジション監視追加
   * @param position 監視対象ポジション
   */
  async addPositionMonitoring(position: Position): Promise<void> {
    if (!position.trailWidth || position.trailWidth <= 0) {
      console.log(`Position ${position.id} has no trail width, skipping monitoring`);
      return;
    }

    try {
      const monitoredPosition: MonitoredPosition = {
        position,
        trailWidth: position.trailWidth,
        triggerActionIds: position.triggerActionIds ? JSON.parse(position.triggerActionIds) : [],
        lastPrice: position.entryPrice || 0,
        highWaterMark: position.entryPrice || 0,
        isActive: true
      };
      
      this.monitoredPositions.set(position.id, monitoredPosition);

      // 価格監視設定
      if (this.priceMonitor) {
        this.priceMonitor.subscribe(position.symbol.toString(), async (price) => {
          await this.handlePriceUpdateForPosition(position.id, price);
        });
      }

      console.log(`✅ Trail monitoring added for position ${position.id} (symbol: ${position.symbol}, trailWidth: ${position.trailWidth})`);
      
    } catch (error) {
      console.error(`❌ Failed to add trail monitoring for position ${position.id}:`, error);
      throw error;
    }
  }

  /**
   * ポジション監視停止
   * @param positionId 停止対象ポジションID
   */
  async removePositionMonitoring(positionId: string): Promise<void> {
    const monitored = this.monitoredPositions.get(positionId);
    if (monitored) {
      this.monitoredPositions.delete(positionId);
      console.log(`✅ Trail monitoring removed for position ${positionId}`);
    } else {
      console.log(`Position ${positionId} was not being monitored`);
    }
  }

  /**
   * 特定ポジションの価格更新処理
   * @param positionId ポジションID
   * @param price 新しい価格
   */
  private async handlePriceUpdateForPosition(positionId: string, price: number): Promise<void> {
    const monitored = this.monitoredPositions.get(positionId);
    if (!monitored || !monitored.isActive) return;

    try {
      // 高値更新確認
      if (price > monitored.highWaterMark) {
        monitored.highWaterMark = price;
      }

      // トレール条件判定
      const dropFromHigh = monitored.highWaterMark - price;
      if (dropFromHigh >= monitored.trailWidth) {
        // トレール発動！
        await this.executeTriggerActions(positionId, monitored.triggerActionIds);
        
        // 監視停止
        await this.removePositionMonitoring(positionId);
        this.totalTriggered++;
      }
      
      monitored.lastPrice = price;
      
    } catch (error) {
      console.error(`❌ Failed to handle price update for position ${positionId}:`, error);
    }
  }

  /**
   * triggerActionIds実行
   * @param positionId 対象ポジションID
   * @param actionIds アクションIDs配列
   */
  private async executeTriggerActions(positionId: string, actionIds: string[]): Promise<void> {
    if (!actionIds || actionIds.length === 0) {
      console.log(`No trigger actions for position ${positionId}`);
      return;
    }

    try {
      let succeeded = 0;
      
      for (const actionId of actionIds) {
        try {
          await updateAction(actionId, {
            status: ActionStatus.EXECUTING
          });
          succeeded++;
        } catch (error) {
          console.error(`Failed to trigger action ${actionId}:`, error);
        }
      }
      
      console.log(`🎯 Trail trigger executed for position ${positionId}: ${succeeded}/${actionIds.length} actions succeeded`);
      
    } catch (error) {
      console.error(`❌ Failed to execute trigger actions for position ${positionId}:`, error);
    }
  }



  /**
   * 全監視対象ポジションのトレール監視開始
   */
  async startAllTrailMonitoring(): Promise<void> {
    try {
      const trailPositions = await this.getTrailPositions();
      console.log(`🚀 Starting trail monitoring for ${trailPositions.length} positions`);
      
      for (const position of trailPositions) {
        await this.addPositionMonitoring(position);
      }
      
      console.log(`✅ Trail monitoring started for ${this.monitoredPositions.size} positions`);
    } catch (error) {
      console.error('❌ Failed to start all trail monitoring:', error);
    }
  }





  /**
   * 即時実行（trailWidth = 0）
   */
  async checkImmediateExecution(position: Position): Promise<void> {
    if (position.trailWidth === 0 && position.triggerActionIds) {
      const actionIds = JSON.parse(position.triggerActionIds);
      await this.executeTriggerActions(position.id, actionIds);
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

      // トリガーアクション実行
      if (position.triggerActionIds) {
        const actionIds = JSON.parse(position.triggerActionIds);
        await this.executeTriggerActions(positionId, actionIds);
      }
      
    } catch (error) {
      console.error(`Failed to trigger stop out actions for ${positionId}:`, error);
    }
  }


  /**
   * ポジション情報取得
   */
  private async getPosition(positionId: string): Promise<Position | null> {
    try {
      const positions = await listUserPositions();
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
      return await listUserPositions({ hasTrail: true });
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
  getStats(): TrailEngineStats {
    return {
      monitoringCount: this.monitoredPositions.size,
      activePositions: Array.from(this.monitoredPositions.keys()),
      totalTriggered: this.totalTriggered,
      lastUpdate: new Date()
    };
  }

  /**
   * 全トレール監視停止
   */
  async stopAllTrailMonitoring(): Promise<void> {
    const positionIds = Array.from(this.monitoredPositions.keys());
    for (const positionId of positionIds) {
      await this.removePositionMonitoring(positionId);
    }
    console.log('All trail monitoring stopped');
  }

  /**
   * 監視中ポジション一覧取得（ポジションオブジェクト）
   */
  getMonitoredPositions(): Position[] {
    const positions: Position[] = [];
    const monitoredList = Array.from(this.monitoredPositions.values());
    
    for (const monitored of monitoredList) {
      positions.push(monitored.position);
    }
    
    return positions;
  }

  /**
   * 監視中ポジションID一覧取得（レガシー互換）
   */
  getMonitoringPositions(): string[] {
    return Array.from(this.monitoredPositions.keys());
  }

}

// シングルトンインスタンス（遅延初期化）
let _trailEngineInstance: TrailEngine | null = null;

export function getTrailEngine(priceMonitor?: PriceMonitor): TrailEngine {
  if (!_trailEngineInstance) {
    _trailEngineInstance = new TrailEngine(priceMonitor);
  }
  return _trailEngineInstance;
}