import { 
  Position, 
  Strategy, 
  WSOpenCommand,
  WSCloseCommand,
  WSModifyStopCommand,
  WSCommand,
  PositionStatus,
  WSMessageType
} from '@repo/shared-types';
import { AmplifyGraphQLClient } from './amplify-client.js';
import { RealtimeSync } from './realtime-sync.js';

interface PositionManagerOptions {
  enableAutoTrailing?: boolean;
  trailUpdateIntervalMs?: number;
  enableRiskManagement?: boolean;
  maxPositionsPerStrategy?: number;
}

export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private amplifyClient: AmplifyGraphQLClient;
  private realtimeSync: RealtimeSync;
  private options: PositionManagerOptions;
  private websocketSender?: (command: WSCommand) => Promise<void>;
  private subscriptions: (() => void)[] = [];
  
  constructor(
    amplifyClient: AmplifyGraphQLClient,
    options: PositionManagerOptions = {},
    websocketSender?: (command: WSCommand) => Promise<void>
  ) {
    this.amplifyClient = amplifyClient;
    this.realtimeSync = new RealtimeSync(amplifyClient);
    this.websocketSender = websocketSender;
    this.options = {
      enableAutoTrailing: true,
      trailUpdateIntervalMs: 1000,
      enableRiskManagement: true,
      maxPositionsPerStrategy: 10,
      ...options
    };
    
    this.setupSubscriptions();
  }
  
  private setupSubscriptions(): void {
    // 新規ポジション監視
    const newPositionSub = this.realtimeSync.subscribeToNewPositions().subscribe({
      next: (position) => this.handleNewPosition(position),
      error: (error) => console.error('New position subscription error:', error)
    });
    this.subscriptions.push(() => newPositionSub.unsubscribe());
    
    // ポジション更新監視
    const positionUpdateSub = this.realtimeSync.subscribeToPositionUpdates().subscribe({
      next: (position) => this.handlePositionUpdate(position),
      error: (error) => console.error('Position update subscription error:', error)
    });
    this.subscriptions.push(() => positionUpdateSub.unsubscribe());
    
    // ポジション削除監視
    const positionDeleteSub = this.realtimeSync.subscribeToPositionDeletes().subscribe({
      next: ({ positionId }) => this.handlePositionDelete(positionId),
      error: (error) => console.error('Position delete subscription error:', error)
    });
    this.subscriptions.push(() => positionDeleteSub.unsubscribe());
  }
  
  private async handleNewPosition(position: Position): Promise<void> {
    console.log(`New position received: ${position.positionId} (${position.status})`);
    
    // ローカルキャッシュに追加
    this.positions.set(position.positionId, position);
    
    // ステータスに応じた処理
    if (position.status === PositionStatus.PENDING) {
      await this.initiateEntry(position);
    }
  }
  
  private async handlePositionUpdate(position: Position): Promise<void> {
    console.log(`Position updated: ${position.positionId} (${position.status})`);
    
    const existingPosition = this.positions.get(position.positionId);
    this.positions.set(position.positionId, position);
    
    // ステータス変更を検知
    if (existingPosition && existingPosition.status !== position.status) {
      await this.handleStatusChange(position, existingPosition.status);
    }
  }
  
  private handlePositionDelete(positionId: string): void {
    console.log(`Position deleted: ${positionId}`);
    this.positions.delete(positionId);
  }
  
  private async handleStatusChange(position: Position, previousStatus: PositionStatus): Promise<void> {
    switch (position.status) {
      case PositionStatus.PENDING:
        if (previousStatus !== PositionStatus.PENDING) {
          await this.initiateEntry(position);
        }
        break;
        
      case PositionStatus.CLOSING:
        if (previousStatus === PositionStatus.OPEN) {
          await this.initiateClose(position);
        }
        break;
        
      case PositionStatus.OPEN:
        if (previousStatus === PositionStatus.PENDING) {
          await this.startTrailing(position);
        }
        break;
        
      case PositionStatus.CLOSED:
        await this.handlePositionClosed(position);
        break;
    }
  }
  
  async initiateEntry(position: Position): Promise<void> {
    try {
      console.log(`Initiating entry for position: ${position.positionId}`);
      
      // 戦略情報を取得
      const strategy = await this.amplifyClient.getStrategy(position.strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${position.strategyId}`);
      }
      
      // リスク管理チェック
      if (this.options.enableRiskManagement) {
        await this.performRiskCheck(position, strategy);
      }
      
      // エントリーコマンドを生成
      const command: WSOpenCommand = {
        type: WSMessageType.OPEN,
        positionId: position.positionId,
        symbol: position.symbol,
        side: this.determineTradeSide(position, strategy),
        volume: position.volume,
        stopLoss: this.calculateInitialStopLoss(position, strategy),
        takeProfit: this.calculateTakeProfit(position, strategy),
        timestamp: new Date().toISOString()
      };
      
      // WebSocket経由でEAに送信
      await this.sendCommand(command);
      
      console.log(`Entry command sent for position: ${position.positionId}`);
      
    } catch (error) {
      console.error(`Failed to initiate entry for position ${position.positionId}:`, error);
      
      // エラー時はポジションをキャンセル状態に更新
      await this.amplifyClient.updatePosition({
        positionId: position.positionId,
        status: PositionStatus.CANCELED
      });
    }
  }
  
  async initiateClose(position: Position): Promise<void> {
    try {
      console.log(`Initiating close for position: ${position.positionId}`);
      
      const command: WSCloseCommand = {
        type: WSMessageType.CLOSE,
        positionId: position.positionId,
        timestamp: new Date().toISOString()
      };
      
      await this.sendCommand(command);
      
      console.log(`Close command sent for position: ${position.positionId}`);
      
    } catch (error) {
      console.error(`Failed to initiate close for position ${position.positionId}:`, error);
      
      // エラー時は状態を戻す
      await this.amplifyClient.updatePosition({
        positionId: position.positionId,
        status: PositionStatus.OPEN
      });
    }
  }
  
  private async startTrailing(position: Position): Promise<void> {
    if (!this.options.enableAutoTrailing || !position.trailWidth) {
      return;
    }
    
    console.log(`Starting trail for position: ${position.positionId}`);
    
    // トレイル機能の実装
    // 実際の実装では価格監視とストップロス更新のロジックが必要
  }
  
  private async handlePositionClosed(position: Position): Promise<void> {
    console.log(`Position closed: ${position.positionId}`);
    
    // ポジション関連のクリーンアップ処理
    // 例: アラート停止、トレイル停止など
  }
  
  // EA側からのイベント処理
  async updatePositionAfterEntry(
    positionId: string, 
    entryPrice: number, 
    entryTime: Date,
    orderId?: number
  ): Promise<void> {
    try {
      await this.amplifyClient.updatePosition({
        positionId,
        status: PositionStatus.OPEN,
        entryPrice,
        entryTime
      });
      
      console.log(`Position entry updated: ${positionId} at ${entryPrice}`);
      
    } catch (error) {
      console.error(`Failed to update position after entry: ${positionId}`, error);
    }
  }
  
  async updatePositionAfterExit(
    positionId: string,
    exitPrice: number,
    exitTime: Date,
    exitReason: string,
    profit?: number
  ): Promise<void> {
    try {
      await this.amplifyClient.updatePosition({
        positionId,
        status: PositionStatus.CLOSED,
        exitPrice,
        exitTime,
        exitReason
      });
      
      console.log(`Position exit updated: ${positionId} at ${exitPrice} (${exitReason})`);
      
    } catch (error) {
      console.error(`Failed to update position after exit: ${positionId}`, error);
    }
  }
  
  async updateStopLoss(positionId: string, newStopPrice: number): Promise<void> {
    try {
      const command: WSModifyStopCommand = {
        type: WSMessageType.MODIFY_STOP,
        positionId,
        newStopPrice,
        timestamp: new Date().toISOString()
      };
      
      await this.sendCommand(command);
      
      // ローカル状態も更新
      await this.amplifyClient.updatePosition({
        positionId,
        stopLoss: newStopPrice
      });
      
      console.log(`Stop loss updated for position: ${positionId} to ${newStopPrice}`);
      
    } catch (error) {
      console.error(`Failed to update stop loss for position: ${positionId}`, error);
    }
  }
  
  // ヘルパーメソッド
  private determineTradeSide(position: Position, strategy: Strategy): 'BUY' | 'SELL' {
    // 戦略に基づいてBUY/SELLを決定
    // 実装はビジネスロジックに依存
    return 'BUY';
  }
  
  private calculateInitialStopLoss(position: Position, strategy: Strategy): number | undefined {
    if (!strategy.trailWidth) {
      return undefined;
    }
    
    // 仮想的な計算 - 実際の実装では現在価格を使用
    const estimatedPrice = 1.0000; // 現在価格を取得する必要がある
    return estimatedPrice - (strategy.trailWidth * 0.0001);
  }
  
  private calculateTakeProfit(position: Position, strategy: Strategy): number | undefined {
    // テイクプロフィットの計算ロジック
    // 戦略設定に基づいて計算
    return undefined;
  }
  
  private async performRiskCheck(position: Position, strategy: Strategy): Promise<void> {
    // ポジション数制限チェック
    const activePositions = Array.from(this.positions.values())
      .filter(p => p.strategyId === strategy.strategyId && p.status === PositionStatus.OPEN);
    
    if (activePositions.length >= (this.options.maxPositionsPerStrategy || 10)) {
      throw new Error(`Maximum positions reached for strategy: ${strategy.strategyId}`);
    }
    
    // その他のリスクチェック
    if (strategy.maxRisk && position.volume > strategy.maxRisk) {
      throw new Error(`Position volume exceeds max risk for strategy: ${strategy.strategyId}`);
    }
  }
  
  private async sendCommand(command: WSCommand): Promise<void> {
    if (!this.websocketSender) {
      throw new Error('WebSocket sender not configured');
    }
    
    await this.websocketSender(command);
  }
  
  // Public API
  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }
  
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }
  
  getPositionsByStrategy(strategyId: string): Position[] {
    return Array.from(this.positions.values())
      .filter(p => p.strategyId === strategyId);
  }
  
  getActivePositions(): Position[] {
    return Array.from(this.positions.values())
      .filter(p => p.status === PositionStatus.OPEN);
  }
  
  getPendingPositions(): Position[] {
    return Array.from(this.positions.values())
      .filter(p => p.status === PositionStatus.PENDING);
  }
  
  async refreshPositions(): Promise<void> {
    try {
      const positions = await this.amplifyClient.listPositions();
      this.positions.clear();
      
      for (const position of positions) {
        this.positions.set(position.positionId, position);
      }
      
      console.log(`Refreshed ${positions.length} positions from GraphQL`);
      
    } catch (error) {
      console.error('Failed to refresh positions:', error);
    }
  }
  
  setWebSocketSender(sender: (command: WSCommand) => Promise<void>): void {
    this.websocketSender = sender;
  }
  
  // Cleanup
  dispose(): void {
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
    this.realtimeSync.unsubscribeAll();
    this.positions.clear();
  }
}