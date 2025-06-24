/**
 * useSystemCoordination Hook - システム間連携購読
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect } from 'react';
import { SubscriptionService } from '../services/subscription';
import type { SystemCoordinationState } from '../types';

const subscriptionService = new SubscriptionService();

export function useSystemCoordination() {
  const [coordinationState, setCoordinationState] = useState<SystemCoordinationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let subscription: any;

    const setupSubscription = async () => {
      try {
        setLoading(true);
        setError(null);
        
        subscription = await subscriptionService.subscribeToSystemCoordination((state) => {
          setCoordinationState(state);
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
    coordinationState, 
    loading, 
    error 
  };
}