/**
 * useRealtimePositions Hook - ポジション変更購読
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect } from 'react';
import { SubscriptionService } from '../services/subscription';
import type { Position } from '../types';

const subscriptionService = new SubscriptionService();

export function useRealtimePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let subscription: any;

    const setupSubscription = async () => {
      try {
        setLoading(true);
        setError(null);
        
        subscription = await subscriptionService.subscribeToPositions((updatedPosition) => {
          setPositions(prev => {
            const index = prev.findIndex(p => p.id === updatedPosition.id);
            if (index >= 0) {
              const newPositions = [...prev];
              newPositions[index] = updatedPosition;
              return newPositions;
            }
            return [...prev, updatedPosition];
          });
          setLoading(false);
        });
      } catch (err) {
        setError(err as Error);
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  return { 
    positions, 
    loading, 
    error 
  };
}