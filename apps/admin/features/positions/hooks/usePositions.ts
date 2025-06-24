import { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Position, AmplifySchema as Schema } from '@repo/shared-amplify/types';

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const client = useMemo(() => generateClient<Schema>(), []);

  const loadPositions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading positions...');
      
      const user = await getCurrentUser();
      console.log('Current user:', { userId: user.userId });
      
      // MVPシステム設計書v7.0準拠 - GSI positionsByUserIdを使用した高速クエリ
      const result = await (client as any).models.Position.listPositionByUserIdAndStatus({
        userId: user.userId,
        // status: null, // 全ステータスを取得
        limit: 100
      });
      
      console.log('Position list result:', result);
      
      if (result.errors && result.errors.length > 0) {
        const errorMsg = result.errors.map((e: any) => e.message).join(', ');
        console.error('GraphQL errors:', result.errors);
        throw new Error(`GraphQL Error: ${errorMsg}`);
      }
      
      setPositions(result.data || []);
      
    } catch (err) {
      console.error('Failed to load positions:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

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
  }, []); // 空の依存配列で初回のみ実行

  const refreshPositions = () => {
    loadPositions();
  };

  return {
    positions,
    loading,
    error,
    refreshPositions
  };
}