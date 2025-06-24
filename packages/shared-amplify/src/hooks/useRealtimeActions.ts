/**
 * useRealtimeActions Hook - アクション変更購読
 * MVP システム設計書準拠のReactフック
 */

import { useState, useEffect } from 'react';
import { SubscriptionService } from '../services/subscription';
import type { Action } from '../types';

const subscriptionService = new SubscriptionService();

export function useRealtimeActions() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let subscription: any;

    const setupSubscription = async () => {
      try {
        setLoading(true);
        setError(null);
        
        subscription = await subscriptionService.subscribeToActions((updatedAction) => {
          setActions(prev => {
            const index = prev.findIndex(a => a.id === updatedAction.id);
            if (index >= 0) {
              const newActions = [...prev];
              newActions[index] = updatedAction;
              return newActions;
            }
            return [...prev, updatedAction];
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
    actions, 
    loading, 
    error 
  };
}