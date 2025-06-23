import { WebSocketHandler } from './websocket-handler';
import { 
  Action, 
  ActionType, 
  ActionStatus, 
  CreateActionInput,
  Position,
  SymbolEnum,
  ExecutionType
} from './types';
import { amplifyClient, getCurrentUserId } from './amplify-client';
import { ActionService } from './action-service';
import { PositionService } from './position-service';

export class ActionManager {
  private wsHandler: WebSocketHandler;
  private amplifyClient = amplifyClient;
  private currentUserId?: string;

  constructor(wsHandler?: WebSocketHandler) {
    this.wsHandler = wsHandler || new WebSocketHandler();
    // 認証状態を確認してから初期化
    this.initializeUserId().catch(error => {
      console.log('User not authenticated, ActionManager will initialize after login');
    });
  }

  /**
   * userId初期化
   */
  private async initializeUserId(): Promise<void> {
    try {
      this.currentUserId = await getCurrentUserId();
      console.log('✅ ActionManager user ID initialized:', this.currentUserId);
    } catch (error) {
      // 認証されていない場合は静かに処理
      this.currentUserId = undefined;
    }
  }

  /**
   * Action Subscription処理（設計書準拠）
   */
  async handleActionSubscription(action: Action): Promise<void> {
    // 担当判定（userIdベース）
    if (!this.currentUserId || action.userId !== this.currentUserId) {
      return; // 他ユーザー担当
    }

    if (action.status === ActionStatus.EXECUTING) {
      await this.executeAction(action);
    }
  }

  /**
   * Action作成（事前作成パターン）
   */
  async createAction(params: {
    accountId: string;
    positionId?: string;
    triggerPositionId?: string;
    type: ActionType;
    status?: ActionStatus;
  }): Promise<Action> {
    const actionInput = {
      userId: this.currentUserId!,
      accountId: params.accountId,
      positionId: params.positionId,
      triggerPositionId: params.triggerPositionId,
      type: params.type,
      status: params.status || ActionStatus.PENDING
    };

    const result = await ActionService.create(actionInput);
    const action = result.data.createAction;
    
    console.log(`Action created: ${action.id} (${action.type})`);
    return action;
  }

  /**
   * Action実行トリガー（PENDING → EXECUTING）
   */
  async triggerAction(actionId: string): Promise<boolean> {
    try {
      await ActionService.updateStatus(actionId, ActionStatus.EXECUTING);
      console.log(`Action triggered: ${actionId}`);
      return true;
    } catch (error) {
      console.error(`Action trigger failed for ${actionId}:`, error);
      return false;
    }
  }

  /**
   * 複数Action同時トリガー（トレール発動時）
   */
  async triggerActions(actionIds: string[]): Promise<boolean[]> {
    const results = await Promise.allSettled(
      actionIds.map(id => this.triggerAction(id))
    );
    
    return results.map(result => 
      result.status === 'fulfilled' ? result.value : false
    );
  }

  /**
   * Action実行処理（設計書準拠の実装）
   */
  private async executeAction(action: Action): Promise<void> {
    try {
      const position = action.positionId ? await this.getPosition(action.positionId) : null;
      
      switch (action.type) {
        case ActionType.ENTRY:
          await this.executeEntryAction(position, action);
          break;
        case ActionType.CLOSE:
          await this.executeCloseAction(position, action);
          break;
        default:
          console.warn(`Unknown action type: ${action.type}`);
      }
      
      // 成功時
      await this.updateActionStatus(action.id, ActionStatus.EXECUTED);
    } catch (error) { 
      console.error(`Action execution failed for ${action.id}:`, error);
      // 失敗時
      await this.updateActionStatus(action.id, ActionStatus.FAILED);
    }
  }

  /**
   * アクション実行（旧メソッド名で互換性維持）
   */
  async executeActionLegacy(action: Action): Promise<void> {
    const currentUserId = await getCurrentUserId();
    
    // 実行担当者チェック（MVPシステム設計.mdの核心）
    if (action.userId !== currentUserId) {
      console.log(`Action ${action.id} is not assigned to current user`);
      return;
    }

    // ステータスチェック
    if (action.status !== ActionStatus.EXECUTING) {
      console.log(`Action ${action.id} is not in EXECUTING status`);
      return;
    }

    await this.executeAction(action);
  }

  /**
   * ENTRY アクション実行（設計書準拠）
   */
  private async executeEntryAction(position: Position | null, action: Action): Promise<void> {
    console.log(`Executing ENTRY action: ${action.id}`);
    
    if (!position) {
      throw new Error('Position is required for ENTRY action');
    }
    
    try {
      // WebSocketHandler経由でEAにエントリー命令を送信
      const result = await this.wsHandler.sendOpenCommand({
        accountId: action.accountId,
        positionId: position.id,
        symbol: position.symbol as any,
        volume: position.volume,
        executionType: position.executionType
      });
      
      console.log(`Entry action executed successfully: ${action.id}`);
    } catch (error) {
      console.error(`Entry action execution failed: ${error}`);
      throw error;
    }
  }

  /**
   * CLOSE アクション実行（設計書準拠）
   */
  private async executeCloseAction(position: Position | null, action: Action): Promise<void> {
    console.log(`Executing CLOSE action: ${action.id}`);
    
    if (!position) {
      throw new Error('Position is required for CLOSE action');
    }

    try {
      // WebSocketHandler経由でEAにクローズ命令を送信
      const result = await this.wsHandler.sendCloseCommand({
        accountId: action.accountId,
        positionId: position.id
      });
      
      console.log(`Close action executed successfully: ${action.id}`);
    } catch (error) {
      console.error(`Close action execution failed: ${error}`);
      throw error;
    }
  }

  /**
   * Action完了マーク
   */
  private async markActionExecuted(actionId: string): Promise<void> {
    try {
      await ActionService.updateStatus(actionId, ActionStatus.EXECUTED);
      console.log(`Action marked as executed: ${actionId}`);
    } catch (error) {
      console.error(`Failed to mark action as executed: ${actionId}`, error);
    }
  }

  /**
   * Action失敗マーク
   */
  private async markActionFailed(actionId: string, reason: string): Promise<void> {
    try {
      await ActionService.updateStatus(actionId, ActionStatus.FAILED);
      console.log(`Action marked as failed: ${actionId} - ${reason}`);
    } catch (error) {
      console.error(`Failed to mark action as failed: ${actionId}`, error);
    }
  }

  /**
   * ポジション取得
   */
  private async getPosition(positionId: string): Promise<Position | null> {
    try {
      const result = await PositionService.listOpen();
      const positions = result.data.listPositions.items;
      return positions.find((p: Position) => p.id === positionId) || null;
    } catch (error) {
      console.error(`Failed to get position ${positionId}:`, error);
      return null;
    }
  }

  /**
   * Action状態更新
   */
  private async updateActionStatus(actionId: string, status: ActionStatus): Promise<void> {
    await ActionService.updateStatus(actionId, status);
  }

  /**
   * 自分担当のAction取得
   */
  async getMyActions(status?: ActionStatus): Promise<Action[]> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    try {
      const result = await ActionService.listExecuting();
      const allActions = result.data.listActions.items;
      
      return allActions.filter((action: Action) => {
        return action.userId === this.currentUserId && 
               (!status || action.status === status);
      });
    } catch (error) {
      console.error('Failed to get my actions:', error);
      return [];
    }
  }

  /**
   * Action Subscriptionの開始
   */
  async subscribeToMyActions(): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    // TODO: Fix schema mismatch - regenerate amplify_outputs.json
    // userIdベースのサブスクリプション
    const subscription = (this.amplifyClient as any).models?.Action?.observeQuery({
      filter: { userId: { eq: this.currentUserId } }
    })?.subscribe({
      next: (data: any) => {
        data?.items?.forEach((action: any) => {
          this.handleActionSubscription(action);
        });
      },
      error: (error: any) => {
        console.error('Action subscription error:', error);
      }
    });
    
    console.log('Action subscription started for user:', this.currentUserId);
  }

  /**
   * 実行中のAction一覧取得
   */
  async getExecutingActions(): Promise<Action[]> {
    try {
      const result = await ActionService.listExecuting();
      return result.data.listActions.items;
    } catch (error) {
      console.error('Failed to get executing actions:', error);
      return [];
    }
  }
}