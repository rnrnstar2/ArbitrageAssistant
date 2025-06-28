import { 
  Action, 
  ActionType, 
  ActionStatus, 
  CreateActionInput,
  Position,
  ExecutionType,
  Symbol
} from '@repo/shared-types';
import { 
  WSOpenCommand, 
  WSCloseCommand, 
  WSMessageType
} from './types';
import { 
  amplifyClient, 
  getCurrentUserId,
  subscriptionService,
  actionService 
} from '@repo/shared-amplify';
import { WebSocketHandler } from './websocket-server';

// ========================================
// 型定義・インターフェース
// ========================================

export interface TriggerResult {
  actionId: string;
  success: boolean;
  error?: string;
}

export interface ProcessingInfo {
  startTime: Date;
  status: 'processing' | 'completed' | 'failed';
  retryCount?: number;
}

export interface ActionSyncStats {
  isRunning: boolean;
  executingActions: Action[];
  recentActions: Action[];
  totalExecuted: number;
  totalFailed: number;
  lastSyncTime: Date | null;
  subscriptionErrors: number;
  processingActionsCount: number;
}

// ========================================
// Action Consistency Manager（統合）
// ========================================

class ActionConsistencyManager {
  private processingActions: Map<string, ProcessingInfo> = new Map();
  private readonly DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5分
  
  /**
   * 重複実行防止（排他制御）
   */
  async acquireActionLock(actionId: string): Promise<boolean> {
    if (this.processingActions.has(actionId)) {
      const _info = this.processingActions.get(actionId)!;
      // 🔒 Action is already being processed
      return false; // 既に処理中
    }
    
    this.processingActions.set(actionId, {
      startTime: new Date(),
      status: 'processing'
    });
    
    // 🔐 Acquired lock for action
    return true;
  }
  
  /**
   * ロック解除
   */
  releaseActionLock(actionId: string): void {
    const info = this.processingActions.get(actionId);
    if (info) {
      info.status = 'completed';
      this.processingActions.delete(actionId);
      // 🔓 Released lock for action
    }
  }
  
  /**
   * 失敗としてロック解除
   */
  releaseActionLockWithFailure(actionId: string): void {
    const info = this.processingActions.get(actionId);
    if (info) {
      info.status = 'failed';
      this.processingActions.delete(actionId);
      // ❌ Released lock with failure for action
    }
  }
  
  /**
   * タイムアウト処理（stale action cleanup）
   */
  async cleanupStaleActions(): Promise<void> {
    const now = new Date();
    const stalledActions: string[] = [];
    
    for (const [actionId, info] of this.processingActions) {
      const elapsed = now.getTime() - info.startTime.getTime();
      
      if (elapsed > this.DEFAULT_TIMEOUT) {
        stalledActions.push(actionId);
        console.warn(`⚠️ Stale action detected: ${actionId} (${Math.round(elapsed / 1000)}s elapsed)`);
      }
    }
    
    // stale actionsを削除
    for (const actionId of stalledActions) {
      this.processingActions.delete(actionId);
      console.warn(`🧹 Cleaned up stale action: ${actionId}`);
    }
    
    if (stalledActions.length > 0) {
      // 🧹 Cleaned up stale actions
    }
  }
  
  /**
   * 処理中のAction一覧取得
   */
  getProcessingActions(): Map<string, ProcessingInfo> {
    return new Map(this.processingActions);
  }
  
  /**
   * 統計情報取得
   */
  getStats() {
    return {
      totalProcessing: this.processingActions.size
    };
  }
  
  /**
   * 強制的に全ロック解除（緊急時用）
   */
  forceReleaseAllLocks(): void {
    const count = this.processingActions.size;
    this.processingActions.clear();
    console.warn(`🚨 Force released all locks (${count} actions affected)`);
  }
}

// ========================================
// Action Sync Engine - MVPシステム設計書準拠統合クラス
// ========================================

/**
 * Action Sync Engine - MVPシステム設計書準拠
 * アクション管理・同期・実行・一貫性制御を統合
 * 
 * 主要機能：
 * 1. Action作成・管理（事前作成パターン）
 * 2. userIdベース実行担当判定
 * 3. Action Subscription処理
 * 4. WebSocket経由のMT4/MT5制御
 * 5. triggerActionIds実行
 * 6. 排他制御・一貫性管理
 * 7. GraphQL操作のヘルパー機能
 */
export class ActionSync {
  private wsHandler: WebSocketHandler;
  private consistencyManager: ActionConsistencyManager;
  private currentUserId?: string;
  private isRunning = false;
  private actionSubscription?: { unsubscribe: () => void };
  private syncInterval: NodeJS.Timeout | null = null;
  private executingActions: Set<string> = new Set();
  
  // 統計情報
  private stats: ActionSyncStats = {
    isRunning: false,
    executingActions: [],
    recentActions: [],
    totalExecuted: 0,
    totalFailed: 0,
    lastSyncTime: null,
    subscriptionErrors: 0,
    processingActionsCount: 0
  };

  constructor(wsHandler: WebSocketHandler) {
    this.wsHandler = wsHandler;
    this.consistencyManager = new ActionConsistencyManager();
    this.initializeUserId();
  }

  // ========================================
  // 初期化・ライフサイクル
  // ========================================

  /**
   * userId初期化
   */
  private async initializeUserId(): Promise<void> {
    try {
      this.currentUserId = await getCurrentUserId();
      // ✅ ActionSync user ID initialized
    } catch (_error) {
      this.currentUserId = undefined;
    }
  }

  /**
   * Action Sync開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      // 🔄 Action sync engine is already running
      return;
    }

    if (!this.currentUserId) {
      await this.initializeUserId();
    }

    this.isRunning = true;
    this.stats.isRunning = true;
    
    // Action Subscription開始
    await this.setupActionSubscription();
    
    // 定期同期開始（既存のEXECUTINGアクション検出用）
    this.startPeriodicSync();
    
    // 🚀 Action sync engine started
  }

  /**
   * Action Sync停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.stats.isRunning = false;
    
    // Subscription停止
    this.stopActionSubscription();
    
    // 定期同期停止
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // 実行中アクションのクリーンアップ
    await this.consistencyManager.cleanupStaleActions();
    
    // 🛑 Action sync engine stopped
  }

  // ========================================
  // Action Subscription処理
  // ========================================

  /**
   * Action Subscription設定（Amplify Gen2標準）
   */
  private async setupActionSubscription(): Promise<void> {
    // 🔔 Setting up Action subscription
    
    try {
      // EXECUTING状態のアクションを監視（実行担当判定用）
      const subscriptionId = await subscriptionService.subscribeToExecutingActions(
        async (action: Action) => {
          // 📨 Action update received
          await this.handleActionUpdate(action);
        }
      );
      
      this.actionSubscription = {
        unsubscribe: () => subscriptionService.unsubscribe(subscriptionId)
      };
      
      // ✅ Action subscription established
    } catch (_error) {
      console.error('❌ Failed to setup action subscription:', _error);
      this.stats.subscriptionErrors++;
    }
  }

  /**
   * Action更新処理（MVPシステム設計 3.1 準拠）
   */
  private async handleActionUpdate(action: Action): Promise<void> {
    // 担当判定
    if (!this.shouldExecuteAction(action)) {
      return;
    }
    
    // 排他制御
    const lockAcquired = await this.consistencyManager.acquireActionLock(action.id);
    if (!lockAcquired) {
      // 🔒 Action already being processed
      return;
    }
    
    try {
      await this.executeAction(action);
    } finally {
      this.consistencyManager.releaseActionLock(action.id);
    }
  }

  /**
   * Action実行判定（MVPシステム設計 3.1 準拠）
   */
  private shouldExecuteAction(action: Action): boolean {
    return (
      action.userId === this.currentUserId &&           // 自分担当
      action.status === ActionStatus.EXECUTING &&       // 実行状態
      !this.executingActions.has(action.id)             // 重複実行防止
    );
  }

  /**
   * Action Subscription停止
   */
  private stopActionSubscription(): void {
    if (this.actionSubscription && this.actionSubscription.unsubscribe) {
      this.actionSubscription.unsubscribe();
    }
    // 📴 Action subscription stopped
  }

  // ========================================
  // Action作成・管理
  // ========================================

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
      positionId: params.positionId || '',
      triggerPositionId: params.triggerPositionId,
      type: params.type,
      status: params.status || ActionStatus.PENDING
    };

    const result = await this.createActionGraphQL(actionInput);
    const action = result;
    
    // Action created
    return action;
  }

  /**
   * Action実行トリガー（PENDING → EXECUTING）
   */
  async triggerAction(actionId: string): Promise<boolean> {
    try {
      await this.updateActionStatus(actionId, ActionStatus.EXECUTING);
      // Action triggered
      return true;
    } catch (_error) {
      console.error(`Action trigger failed for ${actionId}:`, _error);
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

  // ========================================
  // Action実行処理
  // ========================================

  /**
   * Action実行処理（MVPシステム設計準拠）
   */
  private async executeAction(action: Action): Promise<void> {
    this.executingActions.add(action.id);
    this.stats.executingActions.push(action);
    
    try {
      // ⚡ Executing action
      
      switch (action.type) {
        case ActionType.ENTRY:
          await this.executeEntryAction(action);
          break;
        case ActionType.CLOSE:
          await this.executeCloseAction(action);
          break;
        default:
          console.warn(`Unknown action type: ${action.type}`);
      }
      
      // 実行完了を記録
      await this.updateActionStatus(action.id, ActionStatus.EXECUTED);
      
      this.stats.totalExecuted++;
      // ✅ Action executed successfully
      
    } catch (_error) {
      console.error(`❌ Action execution failed: ${action.id}`, _error);
      
      // 失敗状態を記録
      await this.updateActionStatus(action.id, ActionStatus.FAILED);
      
      this.stats.totalFailed++;
      
    } finally {
      this.executingActions.delete(action.id);
      
      // 統計情報更新
      this.stats.executingActions = this.stats.executingActions.filter(a => a.id !== action.id);
      this.stats.recentActions.unshift(action);
      if (this.stats.recentActions.length > 50) {
        this.stats.recentActions = this.stats.recentActions.slice(0, 50);
      }
      this.stats.lastSyncTime = new Date();
    }
  }

  /**
   * ENTRY アクション実行（設計書準拠）
   */
  private async executeEntryAction(action: Action): Promise<void> {
    // 🎯 Executing ENTRY action
    
    // Position取得
    const position = await this.getPosition(action.positionId);
    if (!position) {
      throw new Error(`Position not found: ${action.positionId}`);
    }
    
    try {
      // Position状態をOPENINGに更新
      await this.updatePositionStatus(position.id, 'OPENING');
      
      // WebSocketHandler経由でEAにエントリー命令を送信
      const command: WSOpenCommand = {
        type: WSMessageType.OPEN,
        accountId: action.accountId,
        positionId: position.id,
        symbol: position.symbol as any,
        side: this.determineSide(position),
        volume: position.volume,
        trailWidth: position.trailWidth ?? 0,
        timestamp: new Date().toISOString(),
        metadata: {
          executionType: position.executionType,
          timestamp: new Date().toISOString()
        }
      };

      await this.sendWSCommand(command);
      // 📤 OPEN command sent for action
      
    } catch (_error) {
      console.error(`Entry action execution failed: ${error}`);
      throw error;
    }
  }

  /**
   * CLOSE アクション実行（設計書準拠）
   */
  private async executeCloseAction(action: Action): Promise<void> {
    // 🎯 Executing CLOSE action
    
    // Position取得
    const position = await this.getPosition(action.positionId);
    if (!position) {
      throw new Error(`Position not found: ${action.positionId}`);
    }

    try {
      // Position状態をCLOSINGに更新
      await this.updatePositionStatus(position.id, 'CLOSING');
      
      // WebSocketHandler経由でEAにクローズ命令を送信
      const command: WSCloseCommand = {
        type: WSMessageType.CLOSE,
        accountId: action.accountId,
        positionId: position.id,
        symbol: position.symbol as any,
        side: this.getOppositeSide(position),
        volume: position.volume,
        timestamp: new Date().toISOString(),
        metadata: {
          executionType: ExecutionType.EXIT,
          timestamp: new Date().toISOString()
        }
      };

      await this.sendWSCommand(command);
      // 📤 CLOSE command sent for action
      
    } catch (_error) {
      console.error(`Close action execution failed: ${error}`);
      throw error;
    }
  }

  // ========================================
  // TriggerActionIds実行（設計書準拠）
  // ========================================

  /**
   * triggerActionIds実行（MVPシステム設計 3.1, 4.1準拠）
   */
  async executeTriggerActions(
    positionId: string, 
    triggerActionIds: string
  ): Promise<TriggerResult[]> {
    
    if (!triggerActionIds || triggerActionIds.trim() === '') {
      // No trigger actions for position
      return [];
    }

    try {
      // JSON配列をパース
      const actionIds: string[] = JSON.parse(triggerActionIds);
      
      if (!Array.isArray(actionIds) || actionIds.length === 0) {
        // No valid action IDs found for position
        return [];
      }

      // 🚀 Executing trigger actions for position

      // 各Actionをsequentialに実行
      const results: TriggerResult[] = [];
      
      for (const actionId of actionIds) {
        const result = await this.triggerSingleAction(positionId, actionId);
        results.push(result);
        
        // 実行間隔を少し設ける（DynamoDB throttling回避）
        if (actionIds.length > 1) {
          await this.delay(100);
        }
      }

      const _successCount = results.filter(r => r.success).length;
      // ✅ Trigger actions completed

      return results;
      
    } catch (_error) {
      console.error(`❌ Failed to parse or execute trigger actions for position ${positionId}:`, error);
      return [{ 
        actionId: 'parse_error', 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }];
    }
  }

  /**
   * 単一Action実行
   */
  private async triggerSingleAction(positionId: string, actionId: string): Promise<TriggerResult> {
    try {
      // Action状態を PENDING → EXECUTING に変更
      await this.updateActionStatus(actionId, ActionStatus.EXECUTING);
      
      // ✅ Triggered action
      
      return {
        actionId,
        success: true
      };
      
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : 'Unknown error';
      console.error(`❌ Failed to trigger action ${actionId} for position ${positionId}:`, errorMessage);
      
      return {
        actionId,
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * ロスカット時のトリガー実行
   */
  async executeLossCutTriggers(
    positionId: string,
    triggerActionIds: string,
    _lossCutPrice?: number
  ): Promise<TriggerResult[]> {
    
    // 💥 Executing loss cut triggers for position
    
    // ロスカット時は通常実行
    return await this.executeTriggerActions(positionId, triggerActionIds);
  }

  // ========================================
  // 定期同期・監視
  // ========================================

  /**
   * 定期同期開始（既存EXECUTING Action検出用）
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(async () => {
      await this.checkExecutingActions();
    }, 5000); // 5秒間隔
  }

  /**
   * 実行中アクションの確認・処理
   */
  private async checkExecutingActions(): Promise<void> {
    try {
      // 自分担当のEXECUTING状態のActionを取得
      const result = await this.listExecutingActions();
      const executingActions = result || [];
      
      for (const action of executingActions) {
        if (!this.executingActions.has(action.id)) {
          await this.handleActionUpdate(action);
        }
      }
      
      if (executingActions.length > 0) {
        // 🔄 Processed executing actions
      }
      
      // stale action cleanup
      await this.consistencyManager.cleanupStaleActions();
      
    } catch (_error) {
      console.error('❌ Periodic action check failed:', error);
    }
  }

  /**
   * 手動同期実行
   */
  async manualSync(): Promise<void> {
    // 🔄 Manual action sync started
    await this.checkExecutingActions();
    this.stats.lastSyncTime = new Date();
    // ✅ Manual action sync completed
  }

  // ========================================
  // 取得系メソッド
  // ========================================

  /**
   * 自分担当のAction取得
   */
  async getMyActions(status?: ActionStatus): Promise<Action[]> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    
    try {
      const result = await this.listExecutingActions();
      const allActions = result || [];
      
      return allActions.filter((action: Action) => {
        return action.userId === this.currentUserId && 
               (!status || action.status === status);
      });
    } catch (_error) {
      console.error('Failed to get my actions:', error);
      return [];
    }
  }

  /**
   * 実行中のAction一覧取得
   */
  getExecutingActions(): string[] {
    return Array.from(this.executingActions);
  }

  // ========================================
  // ヘルパーメソッド
  // ========================================

  /**
   * ポジションの売買方向決定
   */
  private determineSide(position: Position): 'BUY' | 'SELL' {
    return position.volume > 0 ? 'BUY' : 'SELL';
  }

  /**
   * 反対方向取得
   */
  private getOppositeSide(position: Position): 'BUY' | 'SELL' {
    return this.determineSide(position) === 'BUY' ? 'SELL' : 'BUY';
  }

  /**
   * WebSocketコマンド送信（統合強化版）
   */
  private async sendWSCommand(command: WSOpenCommand | WSCloseCommand): Promise<void> {
    try {
      if (!this.wsHandler || !this.wsHandler.isConnected()) {
        throw new Error('WebSocket handler not connected');
      }
      
      // 📡 Sending WebSocket command
      
      // WebSocketHandlerを通じてコマンド送信
      let result;
      if (command.type === WSMessageType.OPEN) {
        result = await this.wsHandler.sendOpenCommand({
          accountId: command.accountId,
          positionId: command.positionId,
          symbol: command.symbol,
          volume: command.volume,
          executionType: command.metadata?.executionType
        });
      } else if (command.type === WSMessageType.CLOSE) {
        result = await this.wsHandler.sendCloseCommand({
          accountId: command.accountId,
          positionId: command.positionId
        });
      }
      
      if (result && !result.success) {
        throw new Error(result.error || 'Command execution failed');
      }
      
      // ✅ WebSocket command sent successfully
      
    } catch (_error) {
      console.error('❌ Failed to send WebSocket command:', error);
      throw error;
    }
  }

  /**
   * 遅延処理（スロットリング対策）
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========================================
  // GraphQL Service Methods（統合）
  // ========================================

  /**
   * Action作成（Amplify Gen2）
   */
  private async createActionGraphQL(input: CreateActionInput): Promise<Action> {
    const result = await actionService.createAction(input);
    return { data: { createAction: result } };
  }

  /**
   * Action状態更新（Amplify Gen2）
   */
  private async updateActionStatus(id: string, status: ActionStatus): Promise<Action> {
    const result = await actionService.updateActionStatus(id, status);
    return { data: { updateAction: result } };
  }

  /**
   * 実行中Action一覧取得（Amplify Gen2）
   */
  private async listExecutingActions(): Promise<Action[]> {
    const result = await actionService.listExecutingActions();
    return result;
  }

  /**
   * ポジション取得
   */
  private async getPosition(positionId?: string): Promise<Position | null> {
    if (!positionId) return null;
    
    try {
      // TODO: Fix schema mismatch - regenerate amplify_outputs.json
      const position = await (amplifyClient as any).models?.Position?.get({
        id: positionId
      });
      return position?.data || null;
    } catch (_error) {
      console.error(`Failed to get position ${positionId}:`, error);
      return null;
    }
  }

  /**
   * Position状態更新
   */
  private async updatePositionStatus(positionId: string, status: string): Promise<void> {
    try {
      // TODO: Fix schema mismatch - regenerate amplify_outputs.json
      await (amplifyClient as any).models?.Position?.update({
        id: positionId,
        status
      });
    } catch (_error) {
      console.error(`Failed to update position status ${positionId}:`, error);
    }
  }

  // ========================================
  // 外部アクセス用メソッド
  // ========================================

  /**
   * 統計情報取得
   */
  getStats(): ActionSyncStats {
    const consistencyStats = this.consistencyManager.getStats();
    
    return {
      ...this.stats,
      isRunning: this.isRunning,
      processingActionsCount: consistencyStats.totalProcessing
    };
  }

  /**
   * ヘルスチェック
   */
  isHealthy(): boolean {
    return this.isRunning && this.stats.subscriptionErrors < 5;
  }

  /**
   * 現在のユーザーID取得
   */
  getCurrentUserId(): string | undefined {
    return this.currentUserId;
  }

  /**
   * 強制停止（緊急時用）
   */
  async forceStop(): Promise<void> {
    console.warn('🚨 Force stopping ActionSync...');
    this.consistencyManager.forceReleaseAllLocks();
    await this.stop();
  }
}

// ========================================
// Action Service Export（shared-amplifyへ移行済み）
// ========================================

/**
 * Action Service - Amplify Gen2操作のヘルパー関数
 * shared-amplifyサービスへの統一されたアクセス
 * Note: 実装はshared-amplify/src/services/action.tsに移行済み
 */
export { actionService as ActionService } from '@repo/shared-amplify';