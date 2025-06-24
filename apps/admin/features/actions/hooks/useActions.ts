import { useState, useEffect, useCallback } from 'react';
import { dummyActions } from '../../../lib/mock-data';
import type { Action } from '@repo/shared-types';

export function useActions() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadActions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Loading dummy actions...');
      
      // ダミーデータ読み込み（ローディング演出）
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // 最新順にソート
      const sortedActions = [...dummyActions].sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt || '';
        const bTime = b.updatedAt || b.createdAt || '';
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
      
      setActions(sortedActions);
      console.log('✅ Dummy actions loaded:', sortedActions.length);
      
    } catch (err) {
      console.error('❌ Failed to load dummy actions:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Action実行 - ダミー実装
  const executeAction = useCallback(async (actionId: string) => {
    try {
      console.log('📝 Executing dummy action:', actionId);
      
      // ダミー実装：実行をログ出力
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log('✅ Dummy action executed:', actionId);
      
    } catch (err) {
      console.error('❌ Failed to execute dummy action:', err);
      throw err;
    }
  }, []);

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