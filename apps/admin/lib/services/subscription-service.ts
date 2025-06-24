import { amplifyClient, getCurrentUserId } from '../amplify-client';
import { Position, Action, Account } from '@repo/shared-types';
import {
  onActionStatusChanged,
  onPositionStatusChanged,
  onActionCreated,
  onAccountUpdated
} from '../graphql/subscriptions';

/**
 * Subscription Service - MVPシステム設計書準拠のリアルタイム通信サービス
 * 複数Hedge System間の連携とリアルタイム監視を担当
 */
export class SubscriptionService {
  private subscriptions: Map<string, any> = new Map();

  /**
   * アクション状態変更の監視 - 最重要（実行担当判定用）
   * 設計書の「複数システム連携」対応
   */
  async subscribeToActionStatusChanges(
    callback: (action: Action) => void,
    errorCallback?: (error: any) => void
  ): Promise<string> {
    try {
      const userId = await getCurrentUserId();
      
      const subscription = amplifyClient.graphql({
        query: onActionStatusChanged,
        variables: { userId }
      }).subscribe({
        next: ({ data }) => {
          if (data?.onUpdateAction) {
            callback(data.onUpdateAction);
          }
        },
        error: (error) => {
          console.error('Action status subscription error:', error);
          if (errorCallback) errorCallback(error);
        }
      });
      
      const subscriptionId = `action-status-${Date.now()}`;
      this.subscriptions.set(subscriptionId, subscription);
      
      return subscriptionId;
    } catch (error) {
      console.error('Subscribe to action status changes error:', error);
      throw error;
    }
  }

  /**
   * ポジション状態変更の監視 - ポジション実行フロー用
   */
  async subscribeToPositionStatusChanges(
    callback: (position: Position) => void,
    errorCallback?: (error: any) => void
  ): Promise<string> {
    try {
      const userId = await getCurrentUserId();
      
      const subscription = amplifyClient.graphql({
        query: onPositionStatusChanged,
        variables: { userId }
      }).subscribe({
        next: ({ data }) => {
          if (data?.onUpdatePosition) {
            callback(data.onUpdatePosition);
          }
        },
        error: (error) => {
          console.error('Position status subscription error:', error);
          if (errorCallback) errorCallback(error);
        }
      });
      
      const subscriptionId = `position-status-${Date.now()}`;
      this.subscriptions.set(subscriptionId, subscription);
      
      return subscriptionId;
    } catch (error) {
      console.error('Subscribe to position status changes error:', error);
      throw error;
    }
  }

  /**
   * 新規アクション作成の監視 - トレール発動検知用
   */
  async subscribeToActionCreation(
    callback: (action: Action) => void,
    errorCallback?: (error: any) => void
  ): Promise<string> {
    try {
      const userId = await getCurrentUserId();
      
      const subscription = amplifyClient.graphql({
        query: onActionCreated,
        variables: { userId }
      }).subscribe({
        next: ({ data }) => {
          if (data?.onCreateAction) {
            callback(data.onCreateAction);
          }
        },
        error: (error) => {
          console.error('Action creation subscription error:', error);
          if (errorCallback) errorCallback(error);
        }
      });
      
      const subscriptionId = `action-creation-${Date.now()}`;
      this.subscriptions.set(subscriptionId, subscription);
      
      return subscriptionId;
    } catch (error) {
      console.error('Subscribe to action creation error:', error);
      throw error;
    }
  }

  /**
   * 口座情報更新の監視 - 残高・クレジット変動監視用
   */
  async subscribeToAccountUpdates(
    callback: (account: Account) => void,
    errorCallback?: (error: any) => void
  ): Promise<string> {
    try {
      const userId = await getCurrentUserId();
      
      const subscription = amplifyClient.graphql({
        query: onAccountUpdated,
        variables: { userId }
      }).subscribe({
        next: ({ data }) => {
          if (data?.onUpdateAccount) {
            callback(data.onUpdateAccount);
          }
        },
        error: (error) => {
          console.error('Account update subscription error:', error);
          if (errorCallback) errorCallback(error);
        }
      });
      
      const subscriptionId = `account-update-${Date.now()}`;
      this.subscriptions.set(subscriptionId, subscription);
      
      return subscriptionId;
    } catch (error) {
      console.error('Subscribe to account updates error:', error);
      throw error;
    }
  }

  /**
   * 複数システム連携用の統合監視 - 設計書のメインフロー対応
   */
  async subscribeToSystemCoordination(callbacks: {
    onActionStatusChange: (action: Action) => Promise<void>;
    onPositionStatusChange: (position: Position) => Promise<void>;
    onAccountUpdate: (account: Account) => Promise<void>;
  }): Promise<string[]> {
    const subscriptionIds: string[] = [];
    
    try {
      // Action状態変更監視（最重要）
      const actionSubscriptionId = await this.subscribeToActionStatusChanges(
        async (action) => {
          // userIdベースの実行判定
          const currentUserId = await getCurrentUserId();
          if (action.userId === currentUserId) {
            await callbacks.onActionStatusChange(action);
          }
        }
      );
      subscriptionIds.push(actionSubscriptionId);
      
      // Position状態変更監視
      const positionSubscriptionId = await this.subscribeToPositionStatusChanges(
        callbacks.onPositionStatusChange
      );
      subscriptionIds.push(positionSubscriptionId);
      
      // Account更新監視
      const accountSubscriptionId = await this.subscribeToAccountUpdates(
        callbacks.onAccountUpdate
      );
      subscriptionIds.push(accountSubscriptionId);
      
      return subscriptionIds;
    } catch (error) {
      // エラー時は作成済みサブスクリプションをクリーンアップ
      subscriptionIds.forEach(id => this.unsubscribe(id));
      throw error;
    }
  }

  /**
   * サブスクリプション解除
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionId);
      return true;
    }
    return false;
  }

  /**
   * 全サブスクリプション解除
   */
  unsubscribeAll(): number {
    let count = 0;
    this.subscriptions.forEach((subscription, id) => {
      subscription.unsubscribe();
      count++;
    });
    this.subscriptions.clear();
    return count;
  }

  /**
   * アクティブなサブスクリプション数取得
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * サブスクリプション状態確認
   */
  getSubscriptionStatus(): { [subscriptionId: string]: string } {
    const status: { [subscriptionId: string]: string } = {};
    this.subscriptions.forEach((subscription, id) => {
      status[id] = subscription.closed ? 'closed' : 'active';
    });
    return status;
  }
}

// シングルトンインスタンス
export const subscriptionService = new SubscriptionService();

// React Hook用の便利関数
export const useActionStatusSubscription = (callback: (action: Action) => void) => {
  return subscriptionService.subscribeToActionStatusChanges(callback);
};

export const usePositionStatusSubscription = (callback: (position: Position) => void) => {
  return subscriptionService.subscribeToPositionStatusChanges(callback);
};

export const useAccountUpdateSubscription = (callback: (account: Account) => void) => {
  return subscriptionService.subscribeToAccountUpdates(callback);
};

// 便利関数エクスポート
export const subscribeToActionStatusChanges = (callback: (action: Action) => void, errorCallback?: (error: any) => void) => 
  subscriptionService.subscribeToActionStatusChanges(callback, errorCallback);

export const subscribeToPositionStatusChanges = (callback: (position: Position) => void, errorCallback?: (error: any) => void) => 
  subscriptionService.subscribeToPositionStatusChanges(callback, errorCallback);

export const subscribeToActionCreation = (callback: (action: Action) => void, errorCallback?: (error: any) => void) => 
  subscriptionService.subscribeToActionCreation(callback, errorCallback);

export const subscribeToAccountUpdates = (callback: (account: Account) => void, errorCallback?: (error: any) => void) => 
  subscriptionService.subscribeToAccountUpdates(callback, errorCallback);

export const subscribeToSystemCoordination = (callbacks: { onActionStatusChange: (action: Action) => Promise<void>; onPositionStatusChange: (position: Position) => Promise<void>; onAccountUpdate: (account: Account) => Promise<void>; }) => 
  subscriptionService.subscribeToSystemCoordination(callbacks);

export const unsubscribe = (subscriptionId: string) => 
  subscriptionService.unsubscribe(subscriptionId);

export const unsubscribeAll = () => 
  subscriptionService.unsubscribeAll();