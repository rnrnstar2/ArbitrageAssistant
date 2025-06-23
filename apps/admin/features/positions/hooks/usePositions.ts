import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '@repo/shared-backend/amplify/data/resource';
import { Position } from '@repo/shared-types';

export interface UsePositionsReturn {
  positions: Position[];
  loading: boolean;
  error: Error | null;
  refreshPositions: () => Promise<void>;
}

export function usePositions(): UsePositionsReturn {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const client = generateClient<Schema>();

  const fetchPositions = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await client.models.Position.list({
        selectionSet: [
          'positionId',
          'strategyId',
          'status',
          'symbol',
          'volume',
          'entryPrice',
          'entryTime',
          'exitPrice',
          'exitTime',
          'exitReason',
          'stopLoss',
          'takeProfit',
          'trailWidth',
          'primary',
          'owner',
          'createdAt',
          'updatedAt'
        ]
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const positionsData = result.data?.map(pos => ({
        positionId: pos.positionId,
        strategyId: pos.strategyId,
        status: pos.status,
        symbol: pos.symbol,
        volume: pos.volume,
        entryPrice: pos.entryPrice,
        entryTime: pos.entryTime ? new Date(pos.entryTime) : undefined,
        exitPrice: pos.exitPrice,
        exitTime: pos.exitTime ? new Date(pos.exitTime) : undefined,
        exitReason: pos.exitReason,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        trailWidth: pos.trailWidth,
        primary: pos.primary,
        owner: pos.owner,
        createdAt: new Date(pos.createdAt),
        updatedAt: new Date(pos.updatedAt)
      })) || [];

      setPositions(positionsData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // ポジション更新のサブスクリプション
    const updateSub = (client.models.Position.onUpdate({
      selectionSet: [
        'positionId',
        'strategyId',
        'status',
        'symbol',
        'volume',
        'entryPrice',
        'entryTime',
        'exitPrice',
        'exitTime',
        'exitReason',
        'stopLoss',
        'takeProfit',
        'trailWidth',
        'primary',
        'owner',
        'createdAt',
        'updatedAt'
      ]
    }) as any).subscribe({
      next: (data: any) => {
        const updatedPosition: Position = {
          positionId: data.positionId,
          strategyId: data.strategyId,
          status: data.status,
          symbol: data.symbol,
          volume: data.volume,
          entryPrice: data.entryPrice,
          entryTime: data.entryTime ? new Date(data.entryTime) : undefined,
          exitPrice: data.exitPrice,
          exitTime: data.exitTime ? new Date(data.exitTime) : undefined,
          exitReason: data.exitReason,
          stopLoss: data.stopLoss,
          takeProfit: data.takeProfit,
          trailWidth: data.trailWidth,
          primary: data.primary,
          owner: data.owner,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt)
        };

        setPositions(prev => prev.map(p => 
          p.positionId === updatedPosition.positionId ? updatedPosition : p
        ));
      },
      error: (err: any) => {
        console.error('Position update subscription error:', err);
        setError(new Error('リアルタイム更新でエラーが発生しました'));
      }
    });

    // 新規ポジション作成のサブスクリプション
    const createSub = (client.models.Position.onCreate({
      selectionSet: [
        'positionId',
        'strategyId',
        'status',
        'symbol',
        'volume',
        'entryPrice',
        'entryTime',
        'exitPrice',
        'exitTime',
        'exitReason',
        'stopLoss',
        'takeProfit',
        'trailWidth',
        'primary',
        'owner',
        'createdAt',
        'updatedAt'
      ]
    }) as any).subscribe({
      next: (data: any) => {
        const newPosition: Position = {
          positionId: data.positionId,
          strategyId: data.strategyId,
          status: data.status,
          symbol: data.symbol,
          volume: data.volume,
          entryPrice: data.entryPrice,
          entryTime: data.entryTime ? new Date(data.entryTime) : undefined,
          exitPrice: data.exitPrice,
          exitTime: data.exitTime ? new Date(data.exitTime) : undefined,
          exitReason: data.exitReason,
          stopLoss: data.stopLoss,
          takeProfit: data.takeProfit,
          trailWidth: data.trailWidth,
          primary: data.primary,
          owner: data.owner,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt)
        };

        setPositions(prev => [newPosition, ...prev]);
      },
      error: (err: any) => {
        console.error('Position create subscription error:', err);
        setError(new Error('リアルタイム更新でエラーが発生しました'));
      }
    });

    // ポジション削除のサブスクリプション
    const deleteSub = (client.models.Position.onDelete({
      selectionSet: ['positionId']
    }) as any).subscribe({
      next: (data: any) => {
        setPositions(prev => prev.filter(p => p.positionId !== data.positionId));
      },
      error: (err: any) => {
        console.error('Position delete subscription error:', err);
        setError(new Error('リアルタイム更新でエラーが発生しました'));
      }
    });

    return () => {
      updateSub.unsubscribe();
      createSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  };

  useEffect(() => {
    fetchPositions();
    const unsubscribe = setupRealtimeSubscriptions();
    
    return unsubscribe;
  }, []);

  return {
    positions,
    loading,
    error,
    refreshPositions: fetchPositions
  };
}