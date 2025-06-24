/**
 * useAction Hook - 単一アクション取得
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { ActionService } from '../services/action';
import type { Action } from '../types';

const actionService = new ActionService();

export function useAction(id: string | null) {
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAction = useCallback(async () => {
    if (!id) {
      setAction(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await actionService.getAction(id);
      setAction(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAction();
  }, [fetchAction]);

  const refresh = useCallback(() => {
    fetchAction();
  }, [fetchAction]);

  return { 
    action, 
    loading, 
    error, 
    refresh 
  };
}