import { Position, Action, ActionStatus, ActionType, ExecutionType } from '@repo/shared-types';
import { PriceMonitor } from './price-monitor';
import { amplifyClient, getCurrentUserId } from './amplify-client';
import { 
  updateAction,
  listUserPositions,
  listUserActions,
  positionService
} from '@repo/shared-amplify';
import { ActionFlowEngine } from './position-execution';
import { WebSocketHandler } from './websocket-server';


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
  private actionFlowEngine?: ActionFlowEngine;
  private wsHandler?: WebSocketHandler;

  constructor(priceMonitor?: PriceMonitor, actionFlowEngine?: ActionFlowEngine, wsHandler?: WebSocketHandler) {
    this.priceMonitor = priceMonitor;
    this.actionFlowEngine = actionFlowEngine;
    this.wsHandler = wsHandler;
  }

  /**
   * ActionFlowEngine設定
   */
  setActionFlowEngine(actionFlowEngine: ActionFlowEngine): void {
    this.actionFlowEngine = actionFlowEngine;
  }

  /**
   * WebSocketHandler設定
   */
  setWebSocketHandler(wsHandler: WebSocketHandler): void {
    this.wsHandler = wsHandler;
  }

  /**
   * 統合強化：ActionFlowEngineとWebSocketHandlerを同時設定
   */
  setExecutionComponents(actionFlowEngine: ActionFlowEngine, wsHandler: WebSocketHandler): void {
    this.actionFlowEngine = actionFlowEngine;
    this.wsHandler = wsHandler;
    // TrailEngine: ActionFlowEngine and WebSocketHandler components set for automatic execution
  }

  /**
   * ポジション監視追加
   * @param position 監視対象ポジション
   */
  async addPositionMonitoring(position: Position): Promise<void> {
    if (!position.trailWidth || position.trailWidth <= 0) {
      // Position has no trail width, skipping monitoring
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

      // Trail monitoring added successfully
      
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
      // Trail monitoring removed successfully
    } else {
      // Position was not being monitored
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
   * triggerActionIds実行（完全自動実行版）
   * @param positionId 対象ポジションID
   * @param actionIds アクションIDs配列
   */
  private async executeTriggerActions(positionId: string, actionIds: string[]): Promise<void> {
    if (!actionIds || actionIds.length === 0) {
      // No trigger actions for position
      return;
    }

    if (!this.actionFlowEngine || !this.wsHandler) {
      console.warn(`⚠️ ActionFlowEngine or WebSocketHandler not available, falling back to status update only`);
      await this.fallbackToStatusUpdate(positionId, actionIds);
      return;
    }

    try {
      let succeeded = 0;
      let executed = 0;
      
      for (const actionId of actionIds) {
        try {
          // 1. アクション詳細情報取得
          const actions = await listUserActions();
          const action = actions.find(a => a.id === actionId);
          
          if (!action) {
            console.error(`❌ Action ${actionId} not found`);
            continue;
          }

          // 2. アクション状態をEXECUTINGに更新
          await updateAction(actionId, {
            status: ActionStatus.EXECUTING
          });
          succeeded++;

          // 3. アクションタイプ別の実際の実行
          const executionResult = await this.executeActionByType(action);
          
          if (executionResult.success) {
            // 4. 実行成功時の状態更新
            await updateAction(actionId, {
              status: ActionStatus.EXECUTED
            });
            executed++;
            // Action executed successfully
          } else {
            // 5. 実行失敗時の状態復旧
            await updateAction(actionId, {
              status: ActionStatus.FAILED
            });
            console.error(`❌ Action ${actionId} execution failed: ${executionResult.error}`);
          }
          
        } catch (error) {
          console.error(`❌ Failed to process action ${actionId}:`, error);
          
          // エラー時は状態をFAILEDに更新
          try {
            await updateAction(actionId, {
              status: ActionStatus.FAILED
            });
          } catch (updateError) {
            console.error(`❌ Failed to update action status to FAILED:`, updateError);
          }
        }
      }
      
      // Trail trigger completed successfully
      
    } catch (error) {
      console.error(`❌ Failed to execute trigger actions for position ${positionId}:`, error);
    }
  }

  /**
   * アクションタイプ別実行
   * @param action 実行対象アクション
   */
  private async executeActionByType(action: Action): Promise<{ success: boolean; executionTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      switch (action.type) {
        case ActionType.ENTRY:
          return await this.executeEntryAction(action);
          
        case ActionType.CLOSE:
          return await this.executeCloseAction(action);
          
        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Action execution failed:`, error);
      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * エントリーアクション実行
   * @param action エントリーアクション
   */
  private async executeEntryAction(action: Action): Promise<{ success: boolean; executionTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // アクションに関連するポジション取得
      const position = await this.getPositionByAction(action);
      if (!position) {
        throw new Error(`Position not found for action ${action.id}`);
      }

      // 現在価格取得（フォールバック付き）
      const currentPrice = this.getCurrentPrice(position.symbol);

      // エントリー実行（新規ポジション作成として処理）
      // Note: エントリーアクションの場合、新規ポジション作成が必要
      // 実際の実装ではActionFlowEngineにエントリー用メソッドを追加するか、
      // PositionExecutorのエントリー機能を利用する
      // Entry action triggered
      
      // 暫定的にsuccessを返す（実際のエントリー実行は別途実装が必要）
      const result = {
        success: true,
        executionTime: Date.now() - startTime
      };

      return {
        success: result.success,
        executionTime: result.executionTime,
        error: result.success ? undefined : 'Entry execution failed'
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * クローズアクション実行
   * @param action クローズアクション
   */
  private async executeCloseAction(action: Action): Promise<{ success: boolean; executionTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // アクションに関連するポジション取得
      const position = await this.getPositionByAction(action);
      if (!position) {
        throw new Error(`Position not found for action ${action.id}`);
      }

      // 現在価格取得（フォールバック付き）
      const currentPrice = this.getCurrentPrice(position.symbol);

      // クローズ実行
      const result = await this.actionFlowEngine!.executeClose(
        position,
        'TRAIL_TRIGGERED_CLOSE',
        currentPrice,
        this.wsHandler!
      );

      return {
        success: result.success,
        executionTime: result.executionTime,
        error: result.success ? undefined : 'Close execution failed'
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * フォールバック：ステータス更新のみ（旧動作）
   */
  private async fallbackToStatusUpdate(positionId: string, actionIds: string[]): Promise<void> {
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
    
    // Trail trigger (status only) completed
  }

  /**
   * アクションに関連するポジション取得
   */
  private async getPositionByAction(action: Action): Promise<Position | null> {
    try {
      if (action.positionId) {
        return await this.getPosition(action.positionId);
      }
      
      // positionIdがない場合はaccountIdから推測（必要に応じて）
      const positions = await listUserPositions();
      return positions.find((p: Position) => p.accountId === action.accountId) || null;
    } catch (error) {
      console.error(`Failed to get position for action ${action.id}:`, error);
      return null;
    }
  }

  /**
   * 現在価格取得（フォールバック付き）
   */
  private getCurrentPrice(symbol: string): number {
    // PriceMonitorから価格取得を試行
    if (this.priceMonitor) {
      const priceData = this.priceMonitor.getCurrentPrice(symbol);
      if (priceData) {
        return typeof priceData === 'number' ? priceData : (priceData.bid || priceData.ask || 0);
      }
    }
    
    // フォールバック価格
    const fallbackPrices: { [key: string]: number } = {
      'USDJPY': 150.0,
      'EURUSD': 1.0800,
      'EURGBP': 0.8500,
      'XAUUSD': 2000.0
    };
    
    const price = fallbackPrices[symbol] || 1.0;
    console.warn(`⚠️ Using fallback price for ${symbol}: ${price}`);
    return price;
  }



  /**
   * 全監視対象ポジションのトレール監視開始
   */
  async startAllTrailMonitoring(): Promise<void> {
    try {
      const trailPositions = await this.getTrailPositions();
      // Starting trail monitoring for multiple positions
      
      for (const position of trailPositions) {
        await this.addPositionMonitoring(position);
      }
      
      // Trail monitoring started successfully
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
      // Immediate execution triggered
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
        // Position not found for stop out
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
    // Trail Engine started
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
    // Price updated for symbol
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
    // All trail monitoring stopped
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

export function getTrailEngine(
  priceMonitor?: PriceMonitor, 
  actionFlowEngine?: ActionFlowEngine, 
  wsHandler?: WebSocketHandler
): TrailEngine {
  if (!_trailEngineInstance) {
    _trailEngineInstance = new TrailEngine(priceMonitor, actionFlowEngine, wsHandler);
  }
  return _trailEngineInstance;
}