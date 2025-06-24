/**
 * useExecutingActions Hook - 実行中アクション監視
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { ActionService } from '../services/action';
import type { Action } from '../types';

const actionService = new ActionService();

export function useExecutingActions() {
  const [executingActions, setExecutingActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchExecutingActions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await actionService.listExecutingActions();
      setExecutingActions(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExecutingActions();
  }, [fetchExecutingActions]);

  const refresh = useCallback(() => {
    fetchExecutingActions();
  }, [fetchExecutingActions]);

  return { 
    executingActions, 
    loading, 
    error, 
    refresh 
  };
}