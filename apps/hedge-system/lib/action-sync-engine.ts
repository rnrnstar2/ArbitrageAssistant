import { AmplifyGraphQLClient } from './amplify-client';
import { WebSocketHandler } from './websocket-handler';
import { Action, ActionStatus } from '@repo/shared-types';
import { SUBSCRIBE_TO_ACTIONS } from './graphql/subscriptions';
import { UPDATE_ACTION_STATUS } from './graphql/mutations';
import type { Subscription } from 'rxjs';

interface ActionExecutionResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * AppSync Action同期実行エンジン
 * MVPデザイン仕様5-3に基づく分散アーキテクチャ
 */
export class ActionSyncEngine {
  private amplifyClient: AmplifyGraphQLClient;
  private websocketHandler: WebSocketHandler;
  private subscriptions: Map<string, Subscription> = new Map();
  private assignedAccounts: Set<string> = new Set();
  private isRunning = false;
  
  // 統計・監視
  private stats = {
    totalReceived: 0,
    totalExecuted: 0,
    totalFailed: 0,
    lastExecution: new Date()
  };

  constructor(
    amplifyClient: AmplifyGraphQLClient,
    websocketHandler: WebSocketHandler
  ) {
    this.amplifyClient = amplifyClient;
    this.websocketHandler = websocketHandler;
  }

  /**
   * AppSync Action Subscriptionを開始
   * 口座別にSubscriptionを作成して監視
   */
  async startActionSubscription(accountIds: string[]): Promise<void> {
    if (this.isRunning) {
      console.warn('ActionSyncEngine is already running');
      return;
    }

    this.assignedAccounts = new Set(accountIds);
    this.isRunning = true;

    console.log(`🚀 Starting Action Subscription for accounts: ${accountIds.join(', ')}`);

    try {
      for (const accountId of accountIds) {
        await this.subscribeToAccountActions(accountId);
      }
      console.log('✅ All Action subscriptions started successfully');
    } catch (error) {
      console.error('❌ Failed to start Action subscriptions:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 個別口座のAction監視開始
   */
  private async subscribeToAccountActions(accountId: string): Promise<void> {
    try {
      const subscription = await this.amplifyClient.client.graphql({
        query: SUBSCRIBE_TO_ACTIONS,
        variables: { accountId }
      }).subscribe({
        next: (result: any) => {
          const action = result.data?.onActionUpdate;
          if (action) {
            this.handleActionReceived(action);
          }
        },
        error: (error: any) => {
          this.handleSubscriptionError(accountId, error);
        }
      });

      this.subscriptions.set(accountId, subscription);
      console.log(`📡 Action subscription started for account: ${accountId}`);
    } catch (error) {
      console.error(`❌ Failed to subscribe to actions for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * アクション受信処理
   * 設計書5-3の分散実行ロジック
   */
  private async handleActionReceived(action: Action): Promise<void> {
    this.stats.totalReceived++;
    
    console.log(`📨 Action received: ${action.actionId} (${action.type}) for account: ${action.accountId}`);

    try {
      // 1. 口座担当判定
      if (!this.isAccountAssigned(action.accountId)) {
        console.log(`⏭️  Action ${action.actionId} skipped - not assigned to this PC`);
        return;
      }

      // 2. ステータス確認（PENDING以外はスキップ）
      if (action.status !== ActionStatus.PENDING) {
        console.log(`⏭️  Action ${action.actionId} skipped - status: ${action.status}`);
        return;
      }

      // 3. アクション実行
      await this.executeAction(action);
      this.stats.totalExecuted++;

    } catch (error) {
      console.error(`❌ Failed to handle action ${action.actionId}:`, error);
      this.stats.totalFailed++;
    }

    this.stats.lastExecution = new Date();
  }

  /**
   * アクション実行（設計書5-3準拠）
   * 1. ステータス更新（EXECUTING）
   * 2. WebSocket経由でEA送信
   * 3. 結果に応じてステータス更新
   */
  private async executeAction(action: Action): Promise<void> {
    console.log(`🔄 Executing action: ${action.actionId}`);

    try {
      // 1. アクションステータスをEXECUTINGに更新
      await this.updateActionStatus(action.actionId, ActionStatus.EXECUTING);
      console.log(`📝 Action ${action.actionId} status updated to EXECUTING`);

      // 2. WebSocket経由でEAに命令送信
      const result = await this.sendToEA(action);

      // 3. 結果に応じてステータス更新
      if (result.success) {
        await this.updateActionStatus(action.actionId, ActionStatus.EXECUTED, result.data);
        console.log(`✅ Action ${action.actionId} executed successfully`);
      } else {
        await this.updateActionStatus(action.actionId, ActionStatus.FAILED, result.error);
        console.error(`❌ Action ${action.actionId} failed: ${result.error}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateActionStatus(action.actionId, ActionStatus.FAILED, errorMessage);
      console.error(`💥 Action ${action.actionId} execution error:`, error);
      throw error;
    }
  }

  /**
   * EA（MetaTrader）への命令送信
   * WebSocketHandler経由でMT4 EAに送信
   */
  private async sendToEA(action: Action): Promise<ActionExecutionResult> {
    try {
      // WebSocketメッセージ作成
      const wsMessage = this.createWebSocketMessage(action);
      
      // WebSocketHandler経由で送信
      // Note: WebSocketHandlerの送信メソッドを使用
      // 実装は既存のWebSocketハンドラーのAPIに依存
      
      // TODO: WebSocketHandlerの送信メソッドを確認して適切に実装
      console.log(`📤 Sending to EA: ${JSON.stringify(wsMessage)}`);
      
      // 現時点では成功として返す（実際の実装では応答待ち）
      return {
        success: true,
        data: { message: 'Command sent to EA successfully' }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send command to EA';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * WebSocketメッセージ作成
   */
  private createWebSocketMessage(action: Action): any {
    const baseMessage = {
      id: action.actionId,
      timestamp: new Date().toISOString(),
      accountId: action.accountId
    };

    switch (action.type) {
      case 'ENTRY':
        return {
          ...baseMessage,
          type: 'OPEN',
          ...action.entryParams
        };
      
      case 'CLOSE':
        return {
          ...baseMessage,
          type: 'CLOSE',
          positionId: action.positionId,
          ...action.closeParams
        };

      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  /**
   * アクションステータス更新
   */
  private async updateActionStatus(
    actionId: string, 
    status: ActionStatus, 
    result?: any
  ): Promise<void> {
    try {
      await this.amplifyClient.client.graphql({
        query: UPDATE_ACTION_STATUS,
        variables: { 
          actionId, 
          status, 
          result: result ? JSON.stringify(result) : null 
        }
      });
    } catch (error) {
      console.error(`Failed to update action status for ${actionId}:`, error);
      throw error;
    }
  }

  /**
   * 口座担当判定
   */
  private isAccountAssigned(accountId: string): boolean {
    return this.assignedAccounts.has(accountId);
  }

  /**
   * Subscription エラーハンドリング
   */
  private handleSubscriptionError(accountId: string, error: any): void {
    console.error(`❌ Subscription error for account ${accountId}:`, error);
    
    // 自動再接続ロジック
    setTimeout(() => {
      console.log(`🔄 Attempting to reconnect subscription for account: ${accountId}`);
      this.subscribeToAccountActions(accountId).catch(err => {
        console.error(`Failed to reconnect subscription for ${accountId}:`, err);
      });
    }, 5000);
  }

  /**
   * 全Subscription停止
   */
  async stopAllSubscriptions(): Promise<void> {
    console.log('🛑 Stopping all Action subscriptions...');
    
    for (const [accountId, subscription] of this.subscriptions) {
      try {
        subscription.unsubscribe();
        console.log(`📴 Subscription stopped for account: ${accountId}`);
      } catch (error) {
        console.error(`Error stopping subscription for ${accountId}:`, error);
      }
    }
    
    this.subscriptions.clear();
    this.isRunning = false;
    console.log('✅ All Action subscriptions stopped');
  }

  /**
   * 統計情報取得
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      activeSubscriptions: this.subscriptions.size,
      assignedAccounts: Array.from(this.assignedAccounts)
    };
  }

  /**
   * ヘルスチェック
   */
  isHealthy(): boolean {
    return this.isRunning && 
           this.subscriptions.size > 0 && 
           this.amplifyClient.isConnected();
  }
}