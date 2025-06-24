import { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Action } from '@repo/shared-amplify/types';

export function useActions() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const client = useMemo(() => generateClient(), []);

  const loadActions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading actions...');
      
      const user = await getCurrentUser();
      console.log('Current user:', { userId: user.userId });
      
      // MVPシステム設計書v7.0準拠 - GSI actionsByUserIdAndStatusを使用した高速クエリ
      const result = await (client as any).models.Action.listActionByUserIdAndStatus({
        userId: user.userId
        // status: null, // 全ステータスを取得
      });
      
      console.log('Action list result:', result);
      
      if (result.errors && result.errors.length > 0) {
        const errorMsg = result.errors.map((e: any) => e.message).join(', ');
        console.error('GraphQL errors:', result.errors);
        throw new Error(`GraphQL Error: ${errorMsg}`);
      }
      
      // 最新順にソート - nullチェックを追加
      const sortedActions = (result.data || []).sort((a: any, b: any) => {
        const aTime = a.updatedAt || a.createdAt || '';
        const bTime = b.updatedAt || b.createdAt || '';
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
      
      setActions(sortedActions);
      
    } catch (err) {
      console.error('Failed to load actions:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setActions([]);
    } finally {
      setLoading(false);
    }
  };

  // Action実行 - MVPシステム設計書準拠
  const executeAction = async (actionId: string) => {
    try {
      // PENDING→EXECUTINGに変更してSubscription経由でHedge Systemが実行
      const result = await (client as any).models.Action.update({
        id: actionId,
        status: 'EXECUTING'
      });
      
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e: any) => e.message).join(', '));
      }
      
      // Hedge SystemのSubscriptionが処理
      console.log('Action execution triggered:', actionId);
      
    } catch (err) {
      console.error('Failed to execute action:', err);
      throw err;
    }
  };

  useEffect(() => {
    loadActions();
  }, []); // 空の依存配列で初回のみ実行

  return {
    actions,
    loading,
    error,
    executeAction,
    refreshActions: loadActions
  };
}