/**
 * usePositions Hook - ポジション一覧取得
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { PositionService } from '../services/position';
import type { Position, PositionFilters } from '../types';

const positionService = new PositionService();

export function usePositions(filters?: PositionFilters) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await positionService.listUserPositions(filters);
      setPositions(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const refresh = useCallback(() => {
    fetchPositions();
  }, [fetchPositions]);

  return { 
    positions, 
    loading, 
    error, 
    refresh 
  };
}