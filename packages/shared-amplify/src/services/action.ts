/**
 * Action Service - MVP システム設計書準拠のアクション管理
 * 
 * 設計原則（v7.0）：
 * - userIdベースの高速クエリ
 * - トレール実行管理
 * - 複数システム間連携対応
 * - 事前作成による実行時処理軽減
 */

import { amplifyClient, getCurrentUserId, handleGraphQLError, retryGraphQLOperation } from '../client';
import type {
  Action,
  ActionStatus,
  ActionType,
  CreateActionInput,
  UpdateActionInput,
  ActionFilters
} from '../types';

export class ActionService {
  /**
   * アクション作成
   */
  async createAction(input: Omit<CreateActionInput, 'userId'>): Promise<Action> {
    try {
      const userId = await getCurrentUserId();
      
      const result = await retryGraphQLOperation(async () => {
        return await amplifyClient.models.Action.create({
          ...input,
          userId,
          status: 'PENDING' // 初期状態は常にPENDING
        });
      });
      
      if (!result.data) {
        throw new Error('Action creation failed');
      }
      
      console.log('✅ Action created:', result.data.id);
      return result.data as unknown as Action;
    } catch (error) {
      console.error('❌ Create action error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * アクション更新
   */
  async updateAction(id: string, updates: Partial<UpdateActionInput>): Promise<Action> {
    try {
      const result = await retryGraphQLOperation(async () => {
        return await amplifyClient.models.Action.update({
          id,
          ...updates
        });
      });
      
      if (!result.data) {
        throw new Error('Action update failed');
      }
      
      console.log('✅ Action updated:', id);
      return result.data as unknown as Action;
    } catch (error) {
      console.error('❌ Update action error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * アクション状態更新
   */
  async updateActionStatus(id: string, status: ActionStatus): Promise<Action> {
    return this.updateAction(id, { status });
  }

  /**
   * ユーザーのアクション一覧取得（userIdベース高速検索）
   */
  async listUserActions(filters: ActionFilters = {}): Promise<Action[]> {
    try {
      const userId = await getCurrentUserId();
      
      const result = await retryGraphQLOperation(async () => {
        const queryFilter: any = { userId: { eq: userId } };
        
        if (filters.accountId) queryFilter.accountId = { eq: filters.accountId };
        if (filters.positionId) queryFilter.positionId = { eq: filters.positionId };
        if (filters.type) queryFilter.type = { eq: filters.type };
        if (filters.status) queryFilter.status = { eq: filters.status };
        
        return await amplifyClient.models.Action.list({
          filter: queryFilter,
          limit: filters.limit || 100
        });
      });
      
      return (result.data as unknown as Action[]) || [];
    } catch (error) {
      console.error('❌ List user actions error:', error);
      return [];
    }
  }

  /**
   * 実行中アクション取得（複数システム連携用）
   */
  async listExecutingActions(): Promise<Action[]> {
    return this.listUserActions({ status: 'EXECUTING' });
  }

  /**
   * 待機中アクション取得
   */
  async listPendingActions(): Promise<Action[]> {
    return this.listUserActions({ status: 'PENDING' });
  }

  /**
   * 完了アクション取得
   */
  async listExecutedActions(): Promise<Action[]> {
    return this.listUserActions({ status: 'EXECUTED' });
  }

  /**
   * 失敗アクション取得
   */
  async listFailedActions(): Promise<Action[]> {
    return this.listUserActions({ status: 'FAILED' });
  }

  /**
   * アクション実行開始（PENDING → EXECUTING）
   * 設計書のトレール発動パターン対応
   */
  async triggerAction(id: string): Promise<Action> {
    console.log('⚡ Triggering action:', id);
    return this.updateActionStatus(id, 'EXECUTING');
  }

  /**
   * 複数アクション同時実行（triggerActionIds対応）
   */
  async triggerMultipleActions(actionIds: string[]): Promise<Action[]> {
    try {
      console.log('⚡ Triggering multiple actions:', actionIds);
      
      const promises = actionIds.map(id => this.triggerAction(id));
      const results = await Promise.allSettled(promises);
      
      const successful: Action[] = [];
      const failed: string[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push(actionIds[index]);
          console.error(`❌ Failed to trigger action ${actionIds[index]}:`, result.reason);
        }
      });
      
      if (failed.length > 0) {
        console.warn(`⚠️ Failed to trigger ${failed.length} actions:`, failed);
      }
      
      console.log(`✅ Successfully triggered ${successful.length} actions`);
      return successful;
    } catch (error) {
      console.error('❌ Trigger multiple actions error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * アクション実行完了（EXECUTING → EXECUTED）
   */
  async completeAction(id: string): Promise<Action> {
    console.log('✅ Completing action:', id);
    return this.updateActionStatus(id, 'EXECUTED');
  }

  /**
   * アクション実行失敗（EXECUTING → FAILED）
   */
  async failAction(id: string, reason?: string): Promise<Action> {
    console.log('❌ Failing action:', id, reason);
    return this.updateActionStatus(id, 'FAILED');
  }

  /**
   * アクション再試行（FAILED → PENDING）
   */
  async retryAction(id: string): Promise<Action> {
    console.log('🔄 Retrying action:', id);
    return this.updateActionStatus(id, 'PENDING');
  }

  /**
   * エントリーアクション作成（設計書のエントリーパターン対応）
   */
  async createEntryAction(input: {
    accountId: string;
    positionId?: string;
    triggerPositionId?: string;
  }): Promise<Action> {
    return this.createAction({
      ...input,
      type: 'ENTRY',
      positionId: input.positionId || '', // 必須フィールドのため空文字で初期化
      status: 'PENDING' // 明示的にstatus設定
    });
  }

  /**
   * クローズアクション作成（設計書の決済パターン対応）
   */
  async createCloseAction(input: {
    accountId: string;
    positionId: string;
    triggerPositionId?: string;
  }): Promise<Action> {
    return this.createAction({
      ...input,
      type: 'CLOSE',
      status: 'PENDING' // 明示的にstatus設定
    });
  }

  /**
   * トレール用アクション一括作成（設計書のトレール設定対応）
   */
  async createTrailActions(actions: Array<{
    accountId: string;
    positionId?: string;
    triggerPositionId: string;
    type: ActionType;
  }>): Promise<Action[]> {
    try {
      console.log('🔧 Creating trail actions:', actions.length);
      
      const promises = actions.map(action => this.createAction({
        ...action,
        positionId: action.positionId || '', // 必須フィールドのため空文字で初期化
        status: 'PENDING' // 明示的にstatus設定
      }));
      const results = await Promise.allSettled(promises);
      
      const successful: Action[] = [];
      const failed: number[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push(index);
          console.error(`❌ Failed to create trail action ${index}:`, result.reason);
        }
      });
      
      if (failed.length > 0) {
        console.warn(`⚠️ Failed to create ${failed.length} trail actions`);
      }
      
      console.log(`✅ Successfully created ${successful.length} trail actions`);
      return successful;
    } catch (error) {
      console.error('❌ Create trail actions error:', error);
      throw handleGraphQLError(error);
    }
  }

  /**
   * アクション取得
   */
  async getAction(id: string): Promise<Action | null> {
    try {
      const result = await amplifyClient.models.Action.get({ id });
      return (result.data as unknown as Action) || null;
    } catch (error) {
      console.error('❌ Get action error:', error);
      return null;
    }
  }

  /**
   * アクション削除
   */
  async deleteAction(id: string): Promise<boolean> {
    try {
      await amplifyClient.models.Action.delete({ id });
      console.log('✅ Action deleted:', id);
      return true;
    } catch (error) {
      console.error('❌ Delete action error:', error);
      return false;
    }
  }

  /**
   * ポジション関連アクション取得
   */
  async getPositionActions(positionId: string): Promise<Action[]> {
    return this.listUserActions({ positionId });
  }

  /**
   * 口座関連アクション取得
   */
  async getAccountActions(accountId: string): Promise<Action[]> {
    return this.listUserActions({ accountId });
  }

  /**
   * アクション統計取得
   */
  async getActionStats(): Promise<{
    total: number;
    pending: number;
    executing: number;
    executed: number;
    failed: number;
  }> {
    try {
      const allActions = await this.listUserActions();
      
      const stats = {
        total: allActions.length,
        pending: 0,
        executing: 0,
        executed: 0,
        failed: 0
      };
      
      allActions.forEach(action => {
        switch (action.status) {
          case 'PENDING': stats.pending++; break;
          case 'EXECUTING': stats.executing++; break;
          case 'EXECUTED': stats.executed++; break;
          case 'FAILED': stats.failed++; break;
        }
      });
      
      return stats;
    } catch (error) {
      console.error('❌ Get action stats error:', error);
      return { total: 0, pending: 0, executing: 0, executed: 0, failed: 0 };
    }
  }
}

// シングルトンインスタンス
export const actionService = new ActionService();

// 便利関数エクスポート
export const createAction = (input: Omit<CreateActionInput, 'userId'>) => 
  actionService.createAction(input);

export const updateAction = (id: string, updates: Partial<UpdateActionInput>) => 
  actionService.updateAction(id, updates);

export const listUserActions = (filters?: ActionFilters) => 
  actionService.listUserActions(filters);

export const listExecutingActions = () => 
  actionService.listExecutingActions();

export const listPendingActions = () => 
  actionService.listPendingActions();

export const triggerAction = (id: string) => 
  actionService.triggerAction(id);

export const triggerMultipleActions = (actionIds: string[]) => 
  actionService.triggerMultipleActions(actionIds);

export const completeAction = (id: string) => 
  actionService.completeAction(id);

export const failAction = (id: string, reason?: string) => 
  actionService.failAction(id, reason);

export const createEntryAction = (input: { accountId: string; positionId?: string; triggerPositionId?: string; }) => 
  actionService.createEntryAction(input);

export const createCloseAction = (input: { accountId: string; positionId: string; triggerPositionId?: string; }) => 
  actionService.createCloseAction(input);