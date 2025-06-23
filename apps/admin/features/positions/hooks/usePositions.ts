import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '@repo/shared-backend/amplify/data/resource';

type Position = Schema['Position']['type'];
type PositionFilterInput = Schema['Position']['filterInput'];

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const client = generateClient<Schema>();

  const loadPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const user = await getCurrentUser();
      
      // MVPスキーマv7.0準拠のクエリ
      const result = await client.models.Position.list({
        filter: { 
          userId: { eq: user.userId }
        },
        limit: 100
      });
      
      if (result.errors) {
        throw new Error(result.errors.map(e => e.message).join(', '));
      }
      
      setPositions(result.data);
      
    } catch (err) {
      console.error('Failed to load positions:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  // リアルタイム更新のSubscription
  useEffect(() => {
    const setupSubscription = async () => {
      try {
        const user = await getCurrentUser();
        
        const subscription = client.models.Position.onUpdate({
          filter: { userId: { eq: user.userId } }
        }).subscribe({
          next: (data) => {
            console.log('Position update received:', data);
            setPositions(prev => 
              prev.map(pos => 
                pos.id === data.id ? { ...pos, ...data } : pos
              )
            );
          },
          error: (err) => {
            console.error('Position subscription error:', err);
          }
        });

        return () => subscription.unsubscribe();
      } catch (err) {
        console.error('Failed to setup position subscription:', err);
      }
    };

    setupSubscription();
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