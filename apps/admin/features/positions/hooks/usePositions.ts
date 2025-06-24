import { useState, useEffect, useCallback } from 'react';
import { dummyPositions } from '../../../lib/mock-data';
import type { Position } from '@repo/shared-types';

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Loading dummy positions...');
      
      // ダミーデータ読み込み（ローディング演出）
      await new Promise(resolve => setTimeout(resolve, 400));
      
      setPositions(dummyPositions);
      console.log('✅ Dummy positions loaded:', dummyPositions.length);
      
    } catch (err) {
      console.error('❌ Failed to load dummy positions:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const refreshPositions = useCallback(() => {
    loadPositions();
  }, [loadPositions]);

  return {
    positions,
    loading,
    error,
    refreshPositions
  };
}