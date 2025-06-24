/**
 * usePosition Hook - 単一ポジション取得
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { PositionService } from '../services/position';
import type { Position } from '../types';

const positionService = new PositionService();

export function usePosition(id: string | null) {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPosition = useCallback(async () => {
    if (!id) {
      setPosition(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await positionService.getPosition(id);
      setPosition(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  const refresh = useCallback(() => {
    fetchPosition();
  }, [fetchPosition]);

  return { 
    position, 
    loading, 
    error, 
    refresh 
  };
}