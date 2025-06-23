import { WebSocketHandler } from './websocket-handler';
import { Action, Position, ActionType } from '@repo/shared-types';
import { amplifyClient } from './amplify-client';
import { PositionService } from './position-service';

export class ActionExecutor {
  private websocketHandler: WebSocketHandler;
  private amplifyClient: any;
  
  constructor(websocketHandler?: WebSocketHandler, amplifyClient?: any) {
    this.websocketHandler = websocketHandler || new WebSocketHandler();
    this.amplifyClient = amplifyClient || amplifyClient;
  }
  
  /**
   * エントリーアクション実行（MVPシステム設計準拠）
   */
  async executeEntryAction(action: Action): Promise<void> {
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    // Position を取得してEA命令送信
    const position = await (this.amplifyClient as any).models?.Position?.get({
      id: action.positionId
    });
    
    if (!position?.data) {
      throw new Error(`Position not found: ${action.positionId}`);
    }
    
    console.log(`🎯 Executing ENTRY action: ${action.id} for position: ${action.positionId}`);
    
    // Position 状態を OPENING に更新
    await (this.amplifyClient as any).models?.Position?.update({
      id: position.data.id,
      status: 'OPENING'
    });
    
    // EA に OPEN 命令送信
    await this.websocketHandler.sendOpenCommand({
      accountId: action.accountId,
      positionId: action.positionId,
      symbol: position.data.symbol,
      volume: position.data.volume,
      executionType: position.data.executionType
    });
    
    console.log(`📤 OPEN command sent for action: ${action.id}`);
  }
  
  /**
   * クローズアクション実行（MVPシステム設計準拠）
   */
  async executeCloseAction(action: Action): Promise<void> {
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    const position = await (this.amplifyClient as any).models?.Position?.get({
      id: action.positionId
    });
    
    if (!position?.data) {
      throw new Error(`Position not found: ${action.positionId}`);
    }
    
    console.log(`🎯 Executing CLOSE action: ${action.id} for position: ${action.positionId}`);
    
    // Position 状態を CLOSING に更新
    await (this.amplifyClient as any).models?.Position?.update({
      id: position.data.id,
      status: 'CLOSING'
    });
    
    // EA に CLOSE 命令送信
    await this.websocketHandler.sendCloseCommand({
      accountId: action.accountId,
      positionId: action.positionId
    });
    
    console.log(`📤 CLOSE command sent for action: ${action.id}`);
  }
  
  /**
   * ポジションの売買方向を決定
   */
  private determineSide(position: Position): 'BUY' | 'SELL' {
    // ポジションの direction やボリュームの符号から判定
    return position.volume > 0 ? 'BUY' : 'SELL';
  }
  
  /**
   * WebSocketHandler設定
   */
  setWebSocketHandler(handler: WebSocketHandler): void {
    this.websocketHandler = handler;
  }
  
  /**
   * AmplifyClient設定
   */
  setAmplifyClient(client: any): void {
    this.amplifyClient = client;
  }
}