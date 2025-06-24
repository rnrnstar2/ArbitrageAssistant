/**
 * useActions Hook - アクション一覧取得
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { ActionService } from '../services/action';
import type { Action, ActionFilters } from '../types';

const actionService = new ActionService();

export function useActions(filters?: ActionFilters) {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await actionService.listUserActions(filters);
      setActions(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const refresh = useCallback(() => {
    fetchActions();
  }, [fetchActions]);

  return { 
    actions, 
    loading, 
    error, 
    refresh 
  };
}