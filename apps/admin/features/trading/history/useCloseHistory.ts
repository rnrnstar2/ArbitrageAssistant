import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../packages/shared-backend/amplify/data/resource';
import { CloseHistory, CloseHistoryFilters, CloseHistoryResponse } from './types';

const client = generateClient<Schema>();

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

      const response = await client.queries.getCloseHistory({
        accountIds: filters.accountIds,
        symbols: filters.symbols,
        closeTypes: filters.closeTypes,
        statuses: filters.statuses,
        dateFrom: filters.dateRange?.from.toISOString(),
        dateTo: filters.dateRange?.to.toISOString(),
        profitMin: filters.profitRange?.min,
        profitMax: filters.profitRange?.max,
        holdingDaysMin: filters.holdingDaysRange?.min,
        holdingDaysMax: filters.holdingDaysRange?.max,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        limit: filters.limit,
        offset: filters.offset,
      });

      if (response.errors) {
        throw new Error(response.errors[0].message);
      }

      if (response.data) {
        const result = response.data as any;
        
        // データの変換
        const items: CloseHistory[] = result.items.map((item: any) => ({
          id: item.id,
          positionId: item.positionId,
          accountId: item.accountId,
          symbol: item.symbol,
          type: item.type,
          lots: item.lots,
          openPrice: item.openPrice,
          closePrice: item.closePrice,
          profit: item.profit,
          swapCost: item.swapCost || 0,
          holdingDays: item.holdingDays,
          closeType: item.closeType,
          trailSettings: item.trailSettings ? JSON.parse(item.trailSettings) : undefined,
          linkedAction: item.linkedAction ? JSON.parse(item.linkedAction) : undefined,
          status: item.status,
          executedAt: item.executedAt ? new Date(item.executedAt) : undefined,
          error: item.error,
          totalReturn: item.totalReturn,
          dailyReturn: item.dailyReturn,
        }));

        setData({
          items,
          total: result.total,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          stats: result.stats,
        });
      }
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