import { amplifyClient, getCurrentUserId } from './amplify-client';
import { ActionManager } from './action-manager';
import { Action, ActionStatus } from '@repo/shared-types';
import { onActionStatusChanged } from './graphql/subscriptions';

// Global ActionManager instance - will be properly initialized when needed
let actionManager: ActionManager;

export class ActionSyncEngine {
  private isRunning = false;
  private subscriptions: Map<string, any> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * 同期エンジン開始
   */
  start(): void {
    if (this.isRunning) {
      console.log('Action sync engine is already running');
      return;
    }

    this.isRunning = true;
    
    // Action Subscription開始
    this.startActionSubscription();
    
    // 定期同期開始（既存のEXECUTINGアクション検出用）
    this.startPeriodicSync();
    
    console.log('Action sync engine started');
  }

  /**
   * 同期エンジン停止
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    // Subscription停止
    this.stopActionSubscription();
    
    // 定期同期停止
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    console.log('Action sync engine stopped');
  }

  /**
   * Action Subscription開始
   */
  private startActionSubscription(): void {
    getCurrentUserId().then(userId => {
      try {
        const subscription = amplifyClient.graphql({
          query: onActionStatusChanged,
          variables: { userId }
        });

        if ('subscribe' in subscription) {
          (subscription as any).subscribe({
            next: ({ data }: any) => {
              const action = data.onUpdateAction;
              if (action && action.status === ActionStatus.EXECUTING && actionManager) {
                actionManager.executeAction(action);
              }
            },
            error: (error: any) => console.error('Action subscription error:', error)
          });
        }

        this.subscriptions.set('actionChanges', subscription);
        console.log('Action subscription started');
      } catch (error) {
        console.error('Failed to start action subscription:', error);
      }
    });
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
    console.log('Action subscriptions stopped');
  }

  /**
   * 定期同期開始
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
      const executingActions = await actionManager.getExecutingActions();
      
      for (const action of executingActions) {
        await actionManager.executeAction(action);
      }
      
      if (executingActions.length > 0) {
        console.log(`Processed ${executingActions.length} executing actions`);
      }
    } catch (error) {
      console.error('Periodic action check failed:', error);
    }
  }

  /**
   * 手動同期実行
   */
  async manualSync(): Promise<void> {
    console.log('Manual action sync started');
    await this.checkExecutingActions();
    console.log('Manual action sync completed');
  }

  /**
   * ActionManager インスタンスを設定
   */
  setActionManager(manager: ActionManager): void {
    actionManager = manager;
  }

  /**
   * ヘルスチェック（HedgeSystemCore用）
   */
  isHealthy(): boolean {
    return this.isRunning;
  }

  /**
   * 統計情報取得（HedgeSystemCore用）
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      activeSubscriptions: this.subscriptions.size
    };
  }
}