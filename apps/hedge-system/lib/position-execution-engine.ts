import { Position, PositionStatus, ExecutionType, WSCommand, OpenCommand, CloseCommand } from '@repo/shared-types';
import { getCurrentUserId } from './amplify-client.js';
import type { WebSocketHandler } from './websocket-handler.js';

/**
 * Position Execution Engine - 実行制御
 * userIdベースの実行担当判定と制御を行う
 */
export class PositionExecutionEngine {
  private wsHandler: WebSocketHandler;

  constructor(wsHandler: WebSocketHandler) {
    this.wsHandler = wsHandler;
  }

  /**
   * ポジション実行フロー制御（userIdベース）
   */
  async handlePositionExecution(position: Position): Promise<void> {
    const currentUserId = await getCurrentUserId();
    
    // 実行担当チェック（MVPシステム設計.mdの核心）
    if (position.userId !== currentUserId) {
      console.log(`Position ${position.id} is not assigned to current user`);
      return;
    }

    switch (position.status) {
      case PositionStatus.OPENING:
        await this.executePositionOpen(position);
        break;
        
      case PositionStatus.CLOSING:
        await this.executePositionClose(position);
        break;
        
      default:
        console.log(`No action needed for position ${position.id} with status ${position.status}`);
    }
  }

  /**
   * ポジションオープン実行
   */
  private async executePositionOpen(position: Position): Promise<void> {
    const command: WSOpenCommand = {
      type: WSMessageType.OPEN,
      accountId: position.accountId,
      positionId: position.id,
      symbol: position.symbol,
      side: this.determinePositionSide(position),
      volume: position.volume,
      trailWidth: position.trailWidth,
      timestamp: new Date().toISOString(),
      metadata: {
        executionType: position.executionType,
        timestamp: new Date().toISOString()
      }
    };

    await this.sendCommand(command);
    console.log(`Position open command sent for ${position.id}`);
  }

  /**
   * ポジションクローズ実行
   */
  private async executePositionClose(position: Position): Promise<void> {
    const command: WSCloseCommand = {
      type: WSMessageType.CLOSE,
      accountId: position.accountId,
      positionId: position.id,
      symbol: position.symbol,
      side: this.getOppositePositionSide(position),
      volume: position.volume,
      timestamp: new Date().toISOString(),
      metadata: {
        executionType: ExecutionType.EXIT,
        timestamp: new Date().toISOString()
      }
    };

    await this.sendCommand(command);
    console.log(`Position close command sent for ${position.id}`);
  }

  /**
   * ポジション方向決定（簡易実装）
   */
  private determinePositionSide(position: Position): 'BUY' | 'SELL' {
    // MVPでは簡易的にENTRYは全てBUY
    return position.executionType === ExecutionType.ENTRY ? 'BUY' : 'SELL';
  }

  /**
   * 反対ポジション方向
   */
  private getOppositePositionSide(position: Position): 'BUY' | 'SELL' {
    return this.determinePositionSide(position) === 'BUY' ? 'SELL' : 'BUY';
  }

  /**
   * WebSocketコマンド送信のヘルパー
   */
  private async sendCommand(command: WSCommand): Promise<void> {
    // WebSocketHandlerの実装に依存しない抽象化
    // 実際の実装では wsHandler.sendCommand(accountId, command) を呼ぶ
    console.log('Sending command via WebSocket:', command);
    
    // TODO: 実際のWebSocketハンドラーとの統合
    // await this.wsHandler.sendCommand(command.accountId, command);
  }
}