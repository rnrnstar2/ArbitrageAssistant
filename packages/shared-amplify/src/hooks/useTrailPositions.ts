/**
 * useTrailPositions Hook - トレール設定ポジション取得
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect, useCallback } from 'react';
import { PositionService } from '../services/position';
import type { Position } from '../types';

const positionService = new PositionService();

export function useTrailPositions() {
  const [trailPositions, setTrailPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrailPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await positionService.listTrailPositions();
      setTrailPositions(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrailPositions();
  }, [fetchTrailPositions]);

  const refresh = useCallback(() => {
    fetchTrailPositions();
  }, [fetchTrailPositions]);

  return { 
    trailPositions, 
    loading, 
    error, 
    refresh 
  };
}