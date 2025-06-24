import { useState, useEffect, useCallback } from 'react';
import { amplifyClient } from '@repo/shared-amplify';
import type { Position, Account } from '@repo/shared-types';

const client = amplifyClient;

interface PositionWithAccount extends Position {
  account?: Account;
}

interface UseRealtimePositionsOptions {
  accountId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseRealtimePositionsResult {
  positions: any[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  inactiveCount: number;
  refresh: () => Promise<void>;
  markAllAsInactive: () => Promise<void>;
  deleteInactivePositions: () => Promise<void>;
}

/**
 * リアルタイムポジション管理Hook
 * 信頼性の高いポジションデータ表示
 */
export function useRealtimePositions({
  accountId,
  autoRefresh = true,
  refreshInterval = 5000 // 5秒
}: UseRealtimePositionsOptions = {}): UseRealtimePositionsResult {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  /**
   * ポジションデータ取得
   */
  const fetchPositions = useCallback(async () => {
    try {
      setError(null);
      
      const filter = accountId 
        ? { accountId: { eq: accountId } }
        : {};
      
      const result = await client.models.Position.list({
        filter
      });
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      const positionsData = result.data || [];
      
      // ソート: アクティブ順、新しい順
      const sortedPositions = positionsData.sort((a: any, b: any) => {
        // まずアクティブ順（OPEN状態を優先）
        const aIsActive = a.status === 'OPEN';
        const bIsActive = b.status === 'OPEN';
        if (aIsActive !== bIsActive) {
          return aIsActive ? -1 : 1;
        }
        // 次に開設時間の新しい順
        const aTime = a.entryTime || a.createdAt;
        const bTime = b.entryTime || b.createdAt;
        if (aTime && bTime) {
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        }
        return 0;
      });
      
      setPositions(sortedPositions);
      setLastUpdate(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch positions';
      setError(errorMessage);
      console.error('Error fetching positions:', err);
    }
  }, [accountId]);
  
  /**
   * データ更新
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchPositions();
    } finally {
      setLoading(false);
    }
  }, [fetchPositions]);
  
  /**
   * 全ポジションを非アクティブとしてマーク
   */
  const markAllAsInactive = useCallback(async () => {
    try {
      const filter = accountId 
        ? { accountId: { eq: accountId } }
        : {};
      
      const result = await client.models.Position.list({ filter });
      const currentPositions = result.data || [];
      
      // 全アクティブポジションを非アクティブとしてマーク
      const updatePromises = currentPositions
        .filter((p: any) => p.status === 'OPEN')
        .map((position: any) => 
          client.models.Position.update({
            id: position.id,
            status: 'CLOSED'
          })
        );
      
      await Promise.all(updatePromises);
      await refresh();
      
      console.log(`Marked ${updatePromises.length} positions as inactive`);
    } catch (error) {
      console.error('Failed to mark positions as inactive:', error);
      setError('Failed to mark positions as inactive');
    }
  }, [accountId, refresh]);
  
  /**
   * 非アクティブポジション削除
   */
  const deleteInactivePositions = useCallback(async () => {
    try {
      const inactivePositions = positions.filter((p: any) => p.status === 'CLOSED' || p.status === 'CANCELED');
      
      if (inactivePositions.length === 0) {
        console.log('No inactive positions to delete');
        return;
      }
      
      const deletePromises = inactivePositions.map((position: any) => 
        client.models.Position.delete({ id: position.id })
      );
      
      await Promise.all(deletePromises);
      await refresh();
      
      console.log(`Deleted ${inactivePositions.length} inactive positions`);
    } catch (error) {
      console.error('Failed to delete inactive positions:', error);
      setError('Failed to delete inactive positions');
    }
  }, [positions, refresh]);
  
  // 初期データ読み込み
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  // 自動更新
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchPositions(); // ローディング状態を変更せずに更新
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchPositions]);
  
  // GraphQL Subscriptions（リアルタイム更新）
  useEffect(() => {
    const subscription = client.models.Position.observeQuery({
      filter: accountId ? { accountId: { eq: accountId } } : {}
    }).subscribe({
      next: ({ items, isSynced }: { items: any; isSynced: any }) => {
        if (isSynced) {
          const sortedItems = items.sort((a: any, b: any) => {
            // アクティブ（OPEN）ポジションを上位に表示
            const aIsActive = a.status === 'OPEN';
            const bIsActive = b.status === 'OPEN';
            
            if (aIsActive !== bIsActive) {
              return aIsActive ? -1 : 1;
            }
            
            // entryTimeがある場合は新しい順、ない場合はcreatedAtで比較
            const aTime = a.entryTime || a.createdAt;
            const bTime = b.entryTime || b.createdAt;
            
            if (aTime && bTime) {
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            }
            
            return 0;
          });
          
          setPositions(sortedItems);
          setLastUpdate(new Date());
        }
      },
      error: (err: any) => {
        console.error('Position subscription error:', err);
        setError('Realtime update failed');
      }
    });
    
    return () => subscription.unsubscribe();
  }, [accountId]);
  
  // 計算値 - CLOSEDまたはCANCELEDステータスのポジション数
  const inactiveCount = positions.filter(p => p.status === 'CLOSED' || p.status === 'CANCELED').length;
  
  return {
    positions,
    loading,
    error,
    lastUpdate,
    inactiveCount,
    refresh,
    markAllAsInactive,
    deleteInactivePositions
  };
}

/**
 * ポジション統計Hook
 * 利益計算は削除（リアルタイムデータとして別途取得）
 */
export function usePositionStats(positions: any[]) {
  const activePositions = positions.filter(p => p.status === 'OPEN');
  const inactivePositions = positions.filter(p => p.status === 'CLOSED' || p.status === 'CANCELED');
  
  const entryPositions = activePositions.filter(p => p.executionType === 'ENTRY');
  const exitPositions = activePositions.filter(p => p.executionType === 'EXIT');
  
  const totalVolume = activePositions.reduce((sum, p) => sum + (p.volume || 0), 0);
  
  // シンボル別統計（利益は除外）
  const symbolStats = new Map<string, {
    count: number;
    volume: number;
  }>();
  
  activePositions.forEach(position => {
    const symbol = position.symbol;
    const current = symbolStats.get(symbol) || { count: 0, volume: 0 };
    
    symbolStats.set(symbol, {
      count: current.count + 1,
      volume: current.volume + (position.volume || 0)
    });
  });
  
  return {
    total: positions.length,
    active: activePositions.length,
    inactive: inactivePositions.length,
    entry: entryPositions.length,
    exit: exitPositions.length,
    totalVolume,
    symbolStats: Array.from(symbolStats.entries()).map(([symbol, stats]) => ({
      symbol,
      ...stats
    }))
  };
}

/**
 * アカウント別ポジション状態Hook
 * ハートビート機能削除、最終同期時刻ベースに変更
 */
export function useAccountPositionStatus() {
  const [accountStatus, setAccountStatus] = useState<Map<string, {
    lastSync: Date;
    positionCount: number;
    activeCount: number;
    inactiveCount: number;
    isRecentSync: boolean;
  }>>(new Map());
  
  useEffect(() => {
    const fetchAccountStatus = async () => {
      try {
        const accountsResult = await client.models.Account.list();
        
        const accounts = accountsResult.data || [];
        const statusMap = new Map();
        
        for (const account of accounts) {
          // アカウント別にポジションを取得
          const positionsResult = await client.models.Position.list({
            filter: { accountId: { eq: account.id } }
          });
          
          const positions = positionsResult.data || [];
          const activePositions = positions.filter((p: any) => p.status === 'OPEN');
          const inactivePositions = positions.filter((p: any) => p.status === 'CLOSED' || p.status === 'CANCELED');
          
          // 最新の更新時刻を取得
          const latestSync = positions.reduce((latest: Date | null, position: any) => {
            const positionSync = position.updatedAt ? new Date(position.updatedAt) : null;
            return !latest || (positionSync && positionSync > latest) ? positionSync : latest;
          }, null as Date | null);
          
          const isRecentSync = latestSync 
            ? (Date.now() - latestSync.getTime()) < 300000 // 5分以内
            : false;
          
          statusMap.set(account.id, {
            lastSync: latestSync || new Date(0),
            positionCount: positions.length,
            activeCount: activePositions.length,
            inactiveCount: inactivePositions.length,
            isRecentSync
          });
        }
        
        setAccountStatus(statusMap);
      } catch (error) {
        console.error('Failed to fetch account status:', error);
      }
    };
    
    fetchAccountStatus();
    
    // 1分ごとに更新
    const interval = setInterval(fetchAccountStatus, 60000);
    return () => clearInterval(interval);
  }, []);
  
  return accountStatus;
}