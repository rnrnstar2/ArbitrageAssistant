/**
 * Subscription Service - MVP システム設計書準拠のリアルタイム購読
 * 
 * 設計原則（v7.0）：
 * - userIdベースの効率的購読
 * - 複数システム間連携対応
 * - 自動的な購読管理
 * - エラーハンドリングとリトライ
 */

import { amplifyClient, getCurrentUserId, handleGraphQLError } from '../client';
import type {
  Position,
  Action,
  Account,
  User,
  SubscriptionCallback,
  SystemCoordinationState
} from '../types';

// 購読管理
interface ActiveSubscription {
  id: string;
  type: string;
  unsubscribe: () => void;
}

export class SubscriptionService {
  private activeSubscriptions: Map<string, ActiveSubscription> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * ポジション購読（userIdベース）
   */
  async subscribeToPositions(
    callback: SubscriptionCallback<Position>,
    filters?: { accountId?: string; status?: string }
  ): Promise<string> {
    try {
      const userId = await getCurrentUserId();
      const subscriptionId = `positions-${userId}-${Date.now()}`;
      
      console.log('📡 Subscribing to positions:', subscriptionId);
      
      const subscription = amplifyClient.models.Position.observeQuery({
        filter: {
          userId: { eq: userId },
          ...(filters?.accountId && { accountId: { eq: filters.accountId } }),
          ...(filters?.status && { status: { eq: filters.status } })
        }
      }).subscribe({
        next: (data) => {
          try {
            data.items.forEach(position => callback(position));
          } catch (error) {
            console.error('❌ Position subscription callback error:', error);
          }
        },
        error: (error) => {
          console.error('❌ Position subscription error:', error);
          this.handleSubscriptionError(subscriptionId);
        }
      });
      
      this.activeSubscriptions.set(subscriptionId, {
        id: subscriptionId,
        type: 'positions',
        unsubscribe: () => subscription.unsubscribe()
      });
      
      return subscriptionId;
    } catch (error) {
      console.error('❌ Subscribe to positions error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * アクション購読（userIdベース）
   */
  async subscribeToActions(
    callback: SubscriptionCallback<Action>,
    filters?: { accountId?: string; status?: string; positionId?: string }
  ): Promise<string> {
    try {
      const userId = await getCurrentUserId();
      const subscriptionId = `actions-${userId}-${Date.now()}`;
      
      console.log('📡 Subscribing to actions:', subscriptionId);
      
      const subscription = amplifyClient.models.Action.observeQuery({
        filter: {
          userId: { eq: userId },
          ...(filters?.accountId && { accountId: { eq: filters.accountId } }),
          ...(filters?.status && { status: { eq: filters.status } }),
          ...(filters?.positionId && { positionId: { eq: filters.positionId } })
        }
      }).subscribe({
        next: (data) => {
          try {
            data.items.forEach(action => callback(action));
          } catch (error) {
            console.error('❌ Action subscription callback error:', error);
          }
        },
        error: (error) => {
          console.error('❌ Action subscription error:', error);
          this.handleSubscriptionError(subscriptionId);
        }
      });
      
      this.activeSubscriptions.set(subscriptionId, {
        id: subscriptionId,
        type: 'actions',
        unsubscribe: () => subscription.unsubscribe()
      });
      
      return subscriptionId;
    } catch (error) {
      console.error('❌ Subscribe to actions error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * 口座購読（userIdベース）
   */
  async subscribeToAccounts(
    callback: SubscriptionCallback<Account>
  ): Promise<string> {
    try {
      const userId = await getCurrentUserId();
      const subscriptionId = `accounts-${userId}-${Date.now()}`;
      
      console.log('📡 Subscribing to accounts:', subscriptionId);
      
      const subscription = amplifyClient.models.Account.observeQuery({
        filter: {
          userId: { eq: userId }
        }
      }).subscribe({
        next: (data) => {
          try {
            data.items.forEach(account => callback(account));
          } catch (error) {
            console.error('❌ Account subscription callback error:', error);
          }
        },
        error: (error) => {
          console.error('❌ Account subscription error:', error);
          this.handleSubscriptionError(subscriptionId);
        }
      });
      
      this.activeSubscriptions.set(subscriptionId, {
        id: subscriptionId,
        type: 'accounts',
        unsubscribe: () => subscription.unsubscribe()
      });
      
      return subscriptionId;
    } catch (error) {
      console.error('❌ Subscribe to accounts error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * システム連携購読（複数システム間連携用）
   */
  async subscribeToSystemCoordination(callbacks: {
    onActionStatusChange?: SubscriptionCallback<Action>;
    onPositionStatusChange?: SubscriptionCallback<Position>;
    onAccountUpdate?: SubscriptionCallback<Account>;
  }): Promise<string[]> {
    try {
      const subscriptionIds: string[] = [];
      
      // アクション状態変更の購読（EXECUTING状態を重点監視）
      if (callbacks.onActionStatusChange) {
        const actionSubId = await this.subscribeToActions(
          callbacks.onActionStatusChange,
          { status: 'EXECUTING' }
        );
        subscriptionIds.push(actionSubId);
      }
      
      // ポジション状態変更の購読
      if (callbacks.onPositionStatusChange) {
        const positionSubId = await this.subscribeToPositions(
          callbacks.onPositionStatusChange
        );
        subscriptionIds.push(positionSubId);
      }
      
      // 口座更新の購読
      if (callbacks.onAccountUpdate) {
        const accountSubId = await this.subscribeToAccounts(
          callbacks.onAccountUpdate
        );
        subscriptionIds.push(accountSubId);
      }
      
      console.log('🔗 System coordination subscriptions established:', subscriptionIds);
      return subscriptionIds;
    } catch (error) {
      console.error('❌ Subscribe to system coordination error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * トレール監視専用購読
   */
  async subscribeToTrailMonitoring(
    callback: SubscriptionCallback<Position>
  ): Promise<string> {
    return this.subscribeToPositions(
      (position) => {
        // トレール設定があるポジションのみコールバック実行
        if (position.trailWidth && position.trailWidth > 0) {
          callback(position);
        }
      },
      { status: 'OPEN' }
    );
  }

  /**
   * 実行中アクション監視購読
   */
  async subscribeToExecutingActions(
    callback: SubscriptionCallback<Action>
  ): Promise<string> {
    return this.subscribeToActions(callback, { status: 'EXECUTING' });
  }

  /**
   * 購読解除
   */
  unsubscribe(subscriptionId: string): boolean {
    try {
      const subscription = this.activeSubscriptions.get(subscriptionId);
      if (subscription) {
        subscription.unsubscribe();
        this.activeSubscriptions.delete(subscriptionId);
        this.reconnectAttempts.delete(subscriptionId);
        console.log('✅ Subscription unsubscribed:', subscriptionId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Unsubscribe error:', error);
      return false;
    }
  }

  /**
   * 全購読解除
   */
  unsubscribeAll(): void {
    try {
      console.log('🔄 Unsubscribing all subscriptions:', this.activeSubscriptions.size);
      
      this.activeSubscriptions.forEach((subscription) => {
        subscription.unsubscribe();
      });
      
      this.activeSubscriptions.clear();
      this.reconnectAttempts.clear();
      
      console.log('✅ All subscriptions unsubscribed');
    } catch (error) {
      console.error('❌ Unsubscribe all error:', error);
    }
  }

  /**
   * アクティブ購読一覧取得
   */
  getActiveSubscriptions(): Array<{ id: string; type: string }> {
    return Array.from(this.activeSubscriptions.values()).map(sub => ({
      id: sub.id,
      type: sub.type
    }));
  }

  /**
   * 購読エラーハンドリング
   */
  private handleSubscriptionError(subscriptionId: string): void {
    const attempts = this.reconnectAttempts.get(subscriptionId) || 0;
    
    if (attempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, attempts);
      
      console.log(`🔄 Retrying subscription ${subscriptionId} in ${delay}ms (attempt ${attempts + 1})`);
      
      setTimeout(() => {
        this.reconnectAttempts.set(subscriptionId, attempts + 1);
        // TODO: 購読の再試行ロジック実装
      }, delay);
    } else {
      console.error(`❌ Max reconnect attempts exceeded for subscription: ${subscriptionId}`);
      this.unsubscribe(subscriptionId);
    }
  }

  /**
   * 接続状態確認
   */
  isConnected(): boolean {
    return this.activeSubscriptions.size > 0;
  }

  /**
   * 購読統計取得
   */
  getSubscriptionStats(): {
    total: number;
    byType: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    
    this.activeSubscriptions.forEach(sub => {
      byType[sub.type] = (byType[sub.type] || 0) + 1;
    });
    
    return {
      total: this.activeSubscriptions.size,
      byType
    };
  }
}

// シングルトンインスタンス
export const subscriptionService = new SubscriptionService();

// 便利関数エクスポート
export const subscribeToPositions = (
  callback: SubscriptionCallback<Position>,
  filters?: { accountId?: string; status?: string }
) => subscriptionService.subscribeToPositions(callback, filters);

export const subscribeToActions = (
  callback: SubscriptionCallback<Action>,
  filters?: { accountId?: string; status?: string; positionId?: string }
) => subscriptionService.subscribeToActions(callback, filters);

export const subscribeToAccounts = (callback: SubscriptionCallback<Account>) => 
  subscriptionService.subscribeToAccounts(callback);

export const subscribeToSystemCoordination = (callbacks: {
  onActionStatusChange?: SubscriptionCallback<Action>;
  onPositionStatusChange?: SubscriptionCallback<Position>;
  onAccountUpdate?: SubscriptionCallback<Account>;
}) => subscriptionService.subscribeToSystemCoordination(callbacks);

export const unsubscribe = (subscriptionId: string) => 
  subscriptionService.unsubscribe(subscriptionId);

export const unsubscribeAll = () => 
  subscriptionService.unsubscribeAll();