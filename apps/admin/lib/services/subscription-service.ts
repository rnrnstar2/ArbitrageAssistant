import { 
  subscriptionService as sharedSubscriptionService
} from '@repo/shared-amplify';
import { Position, Action, Account } from '@repo/shared-types';

/**
 * Subscription Service - Amplify Gen2標準実装
 * shared-amplifyサービスのWrapper（APIの互換性維持）
 */
export class SubscriptionService {
  private subscriptions: Map<string, { unsubscribe: () => void }> = new Map();

  /**
   * アクション状態変更の監視（Amplify Gen2標準）
   */
  async subscribeToActionStatusChanges(
    callback: (action: Action) => void,
    errorCallback?: (error: Error) => void
  ): Promise<string> {
    try {
      const subscriptionId = await sharedSubscriptionService.subscribeToActions(
        callback,
        {} // すべての状態変更を監視
      );
      
      this.subscriptions.set(subscriptionId, {
        unsubscribe: () => sharedSubscriptionService.unsubscribe(subscriptionId)
      });
      
      return subscriptionId;
    } catch (error) {
      console.error('Subscribe to action status changes error:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      if (errorCallback) errorCallback(errorObj);
      throw errorObj;
    }
  }

  /**
   * ポジション状態変更の監視（Amplify Gen2標準）
   */
  async subscribeToPositionStatusChanges(
    callback: (position: Position) => void,
    errorCallback?: (error: Error) => void
  ): Promise<string> {
    try {
      const subscriptionId = await sharedSubscriptionService.subscribeToPositions(
        callback,
        {} // すべての状態変更を監視
      );
      
      this.subscriptions.set(subscriptionId, {
        unsubscribe: () => sharedSubscriptionService.unsubscribe(subscriptionId)
      });
      
      return subscriptionId;
    } catch (error) {
      console.error('Subscribe to position status changes error:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      if (errorCallback) errorCallback(errorObj);
      throw errorObj;
    }
  }

  /**
   * 新規アクション作成の監視（Amplify Gen2標準）
   */
  async subscribeToActionCreation(
    callback: (action: Action) => void,
    errorCallback?: (error: Error) => void
  ): Promise<string> {
    try {
      const subscriptionId = await sharedSubscriptionService.subscribeToActions(
        callback,
        {} // すべてのアクション作成を監視
      );
      
      this.subscriptions.set(subscriptionId, {
        unsubscribe: () => sharedSubscriptionService.unsubscribe(subscriptionId)
      });
      
      return subscriptionId;
    } catch (error) {
      console.error('Subscribe to action creation error:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      if (errorCallback) errorCallback(errorObj);
      throw errorObj;
    }
  }

  /**
   * 口座情報更新の監視（Amplify Gen2標準）
   */
  async subscribeToAccountUpdates(
    callback: (account: Account) => void,
    errorCallback?: (error: Error) => void
  ): Promise<string> {
    try {
      const subscriptionId = await sharedSubscriptionService.subscribeToAccounts(
        callback
      );
      
      this.subscriptions.set(subscriptionId, {
        unsubscribe: () => sharedSubscriptionService.unsubscribe(subscriptionId)
      });
      
      return subscriptionId;
    } catch (error) {
      console.error('Subscribe to account updates error:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      if (errorCallback) errorCallback(errorObj);
      throw errorObj;
    }
  }

  /**
   * 複数システム連携用の統合監視（Amplify Gen2標準）
   */
  async subscribeToSystemCoordination(callbacks: {
    onActionStatusChange: (action: Action) => Promise<void>;
    onPositionStatusChange: (position: Position) => Promise<void>;
    onAccountUpdate: (account: Account) => Promise<void>;
  }): Promise<string[]> {
    try {
      const subscriptionIds = await sharedSubscriptionService.subscribeToSystemCoordination({
        onActionStatusChange: callbacks.onActionStatusChange,
        onPositionStatusChange: callbacks.onPositionStatusChange,
        onAccountUpdate: callbacks.onAccountUpdate
      });
      
      // ローカルの管理マップに追加
      subscriptionIds.forEach(id => {
        this.subscriptions.set(id, {
          unsubscribe: () => sharedSubscriptionService.unsubscribe(id)
        });
      });
      
      return subscriptionIds;
    } catch (error) {
      console.error('Subscribe to system coordination error:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      throw errorObj;
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
    this.subscriptions.forEach((subscription, _id) => {
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
    this.subscriptions.forEach((_subscription, id) => {
      status[id] = 'active'; // Simplify as we don't have closed property
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
export const subscribeToActionStatusChanges = (callback: (action: Action) => void, errorCallback?: (error: Error) => void) => 
  subscriptionService.subscribeToActionStatusChanges(callback, errorCallback);

export const subscribeToPositionStatusChanges = (callback: (position: Position) => void, errorCallback?: (error: Error) => void) => 
  subscriptionService.subscribeToPositionStatusChanges(callback, errorCallback);

export const subscribeToActionCreation = (callback: (action: Action) => void, errorCallback?: (error: Error) => void) => 
  subscriptionService.subscribeToActionCreation(callback, errorCallback);

export const subscribeToAccountUpdates = (callback: (account: Account) => void, errorCallback?: (error: Error) => void) => 
  subscriptionService.subscribeToAccountUpdates(callback, errorCallback);

export const subscribeToSystemCoordination = (callbacks: { onActionStatusChange: (action: Action) => Promise<void>; onPositionStatusChange: (position: Position) => Promise<void>; onAccountUpdate: (account: Account) => Promise<void>; }) => 
  subscriptionService.subscribeToSystemCoordination(callbacks);

export const unsubscribe = (subscriptionId: string) => 
  subscriptionService.unsubscribe(subscriptionId);

export const unsubscribeAll = () => 
  subscriptionService.unsubscribeAll();