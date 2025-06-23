"use client";

import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@repo/shared-backend/amplify/data/resource';
import { CloseHistoryFilters, CloseHistoryResponse, CloseHistoryDisplay } from '../types/types';

const client = generateClient<Schema>();

// Amplify生成型を使用（開発中のためコメントアウト）
// type CloseRecord = Schema['CloseRecord']['type'];

// 開発用ダミーデータ生成関数
const createMockCloseHistory = (filters: CloseHistoryFilters): CloseHistoryDisplay[] => {
  const symbols = ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY", "NZDJPY"];
  const types: ('buy' | 'sell')[] = ["buy", "sell"];
  const statuses: ('pending' | 'executed' | 'failed')[] = ["executed", "executed", "executed", "pending", "failed"];
  const closeTypes: ('market' | 'limit')[] = ["market", "limit"];
  
  const mockData = Array.from({ length: 25 }, (_, i) => {
    const openPrice = 150 + Math.random() * 10;
    const closePrice = openPrice + (Math.random() - 0.5) * 2;
    const lots = Number((Math.random() * 2 + 0.1).toFixed(1));
    const holdingDays = Math.floor(Math.random() * 30) + 1;
    const profit = Number(((closePrice - openPrice) * lots * 100000).toFixed(2));
    const swapCost = Number((Math.random() * 100 - 50).toFixed(2));
    const totalReturn = profit - swapCost;
    const dailyReturn = totalReturn / holdingDays;
    
    return {
      id: `close-${i + 1}`,
      positionId: `pos-${i + 1}`,
      accountId: `account-${Math.floor(Math.random() * 3) + 1}`,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      type: types[Math.floor(Math.random() * types.length)],
      lots,
      openPrice: Number(openPrice.toFixed(3)),
      closePrice: Number(closePrice.toFixed(3)),
      profit: Number(profit.toFixed(2)),
      swapCost,
      holdingDays,
      closeType: closeTypes[Math.floor(Math.random() * closeTypes.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      executedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      error: Math.random() < 0.1 ? "実行エラー" : undefined,
      totalReturn: Number(totalReturn.toFixed(2)),
      dailyReturn: Number(dailyReturn.toFixed(2)),
    };
  });
  
  // フィルタリング
  let filteredData = mockData;
  
  if (filters.accountIds?.length) {
    filteredData = filteredData.filter(item => filters.accountIds!.includes(item.accountId));
  }
  
  if (filters.symbols?.length) {
    filteredData = filteredData.filter(item => filters.symbols!.includes(item.symbol));
  }
  
  if (filters.statuses?.length) {
    filteredData = filteredData.filter(item => filters.statuses!.includes(item.status));
  }
  
  if (filters.profitRange) {
    filteredData = filteredData.filter(item => 
      item.totalReturn >= (filters.profitRange!.min || Number.MIN_SAFE_INTEGER) &&
      item.totalReturn <= (filters.profitRange!.max || Number.MAX_SAFE_INTEGER)
    );
  }
  
  // ソート
  filteredData.sort((a, b) => {
    if (filters.sortBy === 'executedAt' && a.executedAt && b.executedAt) {
      return filters.sortOrder === 'desc' 
        ? b.executedAt.getTime() - a.executedAt.getTime()
        : a.executedAt.getTime() - b.executedAt.getTime();
    }
    return 0;
  });
  
  return filteredData.slice(0, filters.limit || 50);
};

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

      // 開発用：ダミーデータを使用
      const mockItems = createMockCloseHistory(filters);
      
      // 実際のプロダクションでは以下のAmplifyクエリを使用
      // const result = await client.models.CloseRecord.list({
      //   filter: {
      //     ...(filters.accountIds?.length && {
      //       accountId: { eq: filters.accountIds[0] }
      //     }),
      //     ...(filters.symbols?.length && {
      //       symbol: { eq: filters.symbols[0] }
      //     }),
      //     ...(filters.statuses?.length && {
      //       status: { eq: filters.statuses[0] }
      //     }),
      //     ...(filters.dateRange && {
      //       executedAt: {
      //         between: [filters.dateRange.from.toISOString(), filters.dateRange.to.toISOString()]
      //       }
      //     })
      //   },
      //   limit: filters.limit || 50
      // });

      setData({
        items: mockItems,
        total: mockItems.length,
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