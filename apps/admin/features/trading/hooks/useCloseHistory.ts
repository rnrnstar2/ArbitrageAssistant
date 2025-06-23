import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@repo/shared-backend/amplify/data/resource';
import { CloseHistoryFilters, CloseHistoryResponse, CloseHistoryDisplay } from '../types/types';

const client = generateClient<Schema>();

// Amplify生成型を使用
type CloseRecord = Schema['CloseRecord']['type'];

interface UseCloseHistoryResult {
  data: CloseHistoryResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCloseHistory(filters: CloseHistoryFilters): UseCloseHistoryResult {
  const [data, setData] = useState<CloseHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCloseHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Amplify直接クエリを使用
      const result = await client.models.CloseRecord.list({
        filter: {
          ...(filters.accountIds?.length && {
            accountId: { eq: filters.accountIds[0] }
          }),
          ...(filters.symbols?.length && {
            symbol: { eq: filters.symbols[0] }
          }),
          ...(filters.statuses?.length && {
            status: { eq: filters.statuses[0] }
          }),
          ...(filters.dateRange && {
            executedAt: {
              between: [filters.dateRange.from.toISOString(), filters.dateRange.to.toISOString()]
            }
          })
        },
        limit: filters.limit || 50
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      // Amplify型から表示用型への変換
      const items = result.data.map((record: CloseRecord) => ({
        id: record.id,
        positionId: record.positionId,
        accountId: record.accountId,
        symbol: record.symbol,
        type: record.type as 'buy' | 'sell',
        lots: record.lots,
        openPrice: record.openPrice,
        closePrice: record.closePrice,
        profit: record.profit,
        swapCost: record.swapCost || 0,
        holdingDays: record.holdingDays,
        closeType: record.closeType as 'market' | 'limit',
        trailSettings: record.trailSettings ? JSON.parse(record.trailSettings as string) : undefined,
        linkedAction: record.linkedAction ? JSON.parse(record.linkedAction as string) : undefined,
        status: record.status as 'pending' | 'executed' | 'failed',
        executedAt: record.executedAt ? new Date(record.executedAt) : undefined,
        error: record.error,
        totalReturn: record.profit - (record.swapCost || 0),
        dailyReturn: (record.profit - (record.swapCost || 0)) / record.holdingDays,
      }));

      setData({
        items,
        total: result.data.length,
        hasNextPage: false,
        hasPreviousPage: false,
        currentPage: 1,
        totalPages: 1,
      });
    } catch (err) {
      console.error('Error fetching close history:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCloseHistory();
  }, [fetchCloseHistory]);

  const refetch = useCallback(async () => {
    await fetchCloseHistory();
  }, [fetchCloseHistory]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}