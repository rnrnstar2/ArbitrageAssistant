import { amplifyClient, getCurrentUserId } from './amplify-client';
import { ActionExecutor } from './action-executor';
import { ActionConsistencyManager } from './action-consistency-manager';
import { Action, ActionStatus } from '@repo/shared-types';
import { onActionStatusChanged } from './graphql/subscriptions';

export interface ActionSyncStats {
  isRunning: boolean;
  executingActions: Action[];
  recentActions: Action[];
  totalExecuted: number;
  totalFailed: number;
  lastSyncTime: Date | null;
  subscriptionErrors: number;
}

export class ActionSyncEngine {
  private amplifyClient: any;
  private actionExecutor: ActionExecutor;
  private consistencyManager: ActionConsistencyManager;
  private userId: string;
  private isRunning = false;
  private subscriptions: Map<string, any> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private executingActions: Set<string> = new Set();
  private actionSubscription?: any;
  
  // 統計情報
  private stats: ActionSyncStats = {
    isRunning: false,
    executingActions: [],
    recentActions: [],
    totalExecuted: 0,
    totalFailed: 0,
    lastSyncTime: null,
    subscriptionErrors: 0
  };

  constructor(amplifyClient: any, userId: string, actionExecutor?: ActionExecutor) {
    this.amplifyClient = amplifyClient;
    this.userId = userId;
    this.actionExecutor = actionExecutor || new ActionExecutor();
    this.consistencyManager = new ActionConsistencyManager();
  }

  /**
   * 同期エンジン開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 Action sync engine is already running');
      return;
    }

    this.isRunning = true;
    this.stats.isRunning = true;
    
    // Action Subscription開始
    await this.setupActionSubscription();
    
    // 定期同期開始（既存のEXECUTINGアクション検出用）
    this.startPeriodicSync();
    
    console.log('🚀 Action sync engine started for userId:', this.userId);
  }

  /**
   * 同期エンジン停止
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
    
    console.log('🛑 Action sync engine stopped');
  }

  /**
   * Action Subscription設定（MVPシステム設計準拠）
   */
  private async setupActionSubscription(): Promise<void> {
    console.log('🔔 Setting up Action subscription for userId:', this.userId);
    
    try {
      this.actionSubscription = this.amplifyClient.models.Action
        .onUpdate()
        .subscribe({
          next: async (data: any) => {
            const action = data.data;
            console.log(`📨 Action update received: ${action.id} -> ${action.status}`);
            
            await this.handleActionUpdate(action);
          },
          error: (error: any) => {
            console.error('❌ Action subscription error:', error);
            this.stats.subscriptionErrors++;
            
            // 自動再接続ロジック
            setTimeout(() => this.setupActionSubscription(), 5000);
          }
        });
      
      console.log('✅ Action subscription established');
    } catch (error) {
      console.error('❌ Failed to setup action subscription:', error);
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
      console.log(`🔒 Action already being processed: ${action.id}`);
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
      action.userId === this.userId &&           // 自分担当
      action.status === ActionStatus.EXECUTING && // 実行状態
      !this.executingActions.has(action.id)     // 重複実行防止
    );
  }

  /**
   * Action実行処理（MVPシステム設計準拠）
   */
  private async executeAction(action: Action): Promise<void> {
    this.executingActions.add(action.id);
    this.stats.executingActions.push(action);
    
    try {
      console.log(`⚡ Executing action: ${action.id} (${action.type})`);
      
      if (action.type === 'ENTRY') {
        await this.actionExecutor.executeEntryAction(action);
      } else if (action.type === 'CLOSE') {
        await this.actionExecutor.executeCloseAction(action);
      }
      
      // 実行完了を記録
      await this.amplifyClient.models.Action.update({
        id: action.id,
        status: ActionStatus.EXECUTED
      });
      
      this.stats.totalExecuted++;
      console.log(`✅ Action executed successfully: ${action.id}`);
      
    } catch (error) {
      console.error(`❌ Action execution failed: ${action.id}`, error);
      
      // 失敗状態を記録
      await this.amplifyClient.models.Action.update({
        id: action.id,
        status: ActionStatus.FAILED
      });
      
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
   * Action Subscription停止
   */
  private stopActionSubscription(): void {
    this.subscriptions.forEach((subscription, key) => {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    });
    this.subscriptions.clear();
    console.log('📴 Action subscriptions stopped');
  }

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
      const result = await this.amplifyClient.models.Action.list({
        filter: {
          userId: { eq: this.userId },
          status: { eq: ActionStatus.EXECUTING }
        }
      });
      
      const executingActions = result.data || [];
      
      for (const action of executingActions) {
        if (!this.executingActions.has(action.id)) {
          await this.handleActionUpdate(action);
        }
      }
      
      if (executingActions.length > 0) {
        console.log(`🔄 Processed ${executingActions.length} executing actions`);
      }
      
      // stale action cleanup
      await this.consistencyManager.cleanupStaleActions();
      
    } catch (error) {
      console.error('❌ Periodic action check failed:', error);
    }
  }

  /**
   * 手動同期実行
   */
  async manualSync(): Promise<void> {
    console.log('🔄 Manual action sync started');
    await this.checkExecutingActions();
    this.stats.lastSyncTime = new Date();
    console.log('✅ Manual action sync completed');
  }

  /**
   * 実行中のAction一覧取得
   */
  getExecutingActions(): string[] {
    return Array.from(this.executingActions);
  }

  /**
   * 統計情報取得（HedgeSystemCore用）
   */
  getStats(): ActionSyncStats {
    return {
      ...this.stats,
      isRunning: this.isRunning
    };
  }

  /**
   * ヘルスチェック（HedgeSystemCore用）
   */
  isHealthy(): boolean {
    return this.isRunning && this.stats.subscriptionErrors < 5;
  }
}