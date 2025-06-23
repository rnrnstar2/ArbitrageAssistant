import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Action } from '@repo/shared-types';

export function useActions() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const client = generateClient();

  const loadActions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const user = await getCurrentUser();
      
      const result = await (client as any).models.Action.list({
        filter: { 
          userId: { eq: user.userId }
        }
      });
      
      if (result.errors) {
        throw new Error(result.errors.map(e => e.message).join(', '));
      }
      
      // 最新順にソート - nullチェックを追加
      const sortedActions = result.data.sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt || '';
        const bTime = b.updatedAt || b.createdAt || '';
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
      
      setActions(sortedActions);
      
    } catch (err) {
      console.error('Failed to load actions:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Action実行
  const executeAction = useCallback(async (actionId: string) => {
    try {
      const result = await (client as any).models.Action.update({
        id: actionId,
        status: 'EXECUTING'
      });
      
      if (result.errors) {
        throw new Error(result.errors.map(e => e.message).join(', '));
      }
      
      // Hedge SystemのSubscriptionが処理
      console.log('Action execution triggered:', actionId);
      
    } catch (err) {
      console.error('Failed to execute action:', err);
      throw err;
    }
  }, [client]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  return {
    actions,
    loading,
    error,
    executeAction,
    refreshActions: loadActions
  };
}