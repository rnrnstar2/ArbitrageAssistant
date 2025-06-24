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
        
        subscription = await subscriptionService.subscribeToSystemCoordination({
          onActionStatusChange: (action) => {
            setCoordinationState(prev => ({
              ...prev,
              userId: action.userId,
              activeActions: prev?.activeActions || [],
              pendingActions: action.status === 'PENDING' ? [...(prev?.pendingActions || []), action] : (prev?.pendingActions || []),
              executingActions: action.status === 'EXECUTING' ? [...(prev?.executingActions || []), action] : (prev?.executingActions || []),
              trailMonitoringPositions: prev?.trailMonitoringPositions || [],
              pcStatus: prev?.pcStatus || 'ONLINE',
              lastUpdate: new Date().toISOString()
            }));
          },
          onPositionStatusChange: (position) => {
            setCoordinationState(prev => ({
              ...prev,
              userId: position.userId,
              trailMonitoringPositions: position.trailWidth && position.trailWidth > 0 
                ? [...(prev?.trailMonitoringPositions || []), position]
                : (prev?.trailMonitoringPositions || []),
              activeActions: prev?.activeActions || [],
              pendingActions: prev?.pendingActions || [],
              executingActions: prev?.executingActions || [],
              pcStatus: prev?.pcStatus || 'ONLINE',
              lastUpdate: new Date().toISOString()
            }));
          }
        });
        setLoading(false);
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