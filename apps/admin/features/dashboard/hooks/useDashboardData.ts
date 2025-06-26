import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentUser } from 'aws-amplify/auth';
import { amplifyClient } from "../../../lib/amplify-client";
import type { Account, Position, Action } from '@repo/shared-types';
import { DashboardStats, ClientStatus } from "../types";

interface SubscriptionRefs {
  accounts?: any;
  positions?: any;
  actions?: any;
}

/**
 * DataRefreshManager - MVPシステム設計書準拠
 * GraphQL Subscription連携、リアルタイムデータ更新、エラーハンドリング
 */
export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const subscriptionsRef = useRef<SubscriptionRefs>({});
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // 統計情報計算
  const calculateStats = useCallback((accounts: Account[], positions: Position[], actions: Action[]): DashboardStats => {
    const activeAccounts = accounts.filter(acc => acc.isActive);
    const openPositions = positions.filter(p => p.status === 'OPEN');
    const pendingActions = actions.filter(a => a.status === 'PENDING');

    return {
      connectedAccounts: activeAccounts.length,
      totalAccounts: accounts.length,
      openPositions: openPositions.length,
      pendingActions: pendingActions.length,
      totalBalance: activeAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0),
      totalCredit: activeAccounts.reduce((sum, acc) => sum + (acc.credit || 0), 0),
      totalEquity: activeAccounts.reduce((sum, acc) => sum + (acc.equity || 0), 0),
      systemHealth: activeAccounts.length > 0 && pendingActions.length === 0 ? 'healthy' : 'warning'
    };
  }, []);

  // 初期データ読み込み
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('📊 Loading initial dashboard data...');
      
      // Get current user
      const user = await getCurrentUser();
      const userId = user.userId;
      
      // 並列でデータ取得
      const [accountsResult, positionsResult, actionsResult] = await Promise.all([
        amplifyClient.models.Account.list({
          filter: { userId: { eq: userId } }
        }),
        amplifyClient.models.Position.list({
          filter: { userId: { eq: userId } }
        }),
        amplifyClient.models.Action.list({
          filter: { userId: { eq: userId } }
        })
      ]);

      // エラーチェック
      if (accountsResult.errors || positionsResult.errors || actionsResult.errors) {
        throw new Error('GraphQL query failed');
      }

      const accountsData = accountsResult.data || [];
      const positionsData = positionsResult.data || [];
      const actionsData = actionsResult.data || [];

      setAccounts(accountsData);
      setPositions(positionsData);
      setActions(actionsData);
      setStats(calculateStats(accountsData, positionsData, actionsData));
      
      // クライアント監視データ (簡易実装)
      setClients(accountsData.map(acc => ({
        id: acc.id,
        name: acc.displayName || acc.accountNumber,
        status: acc.isActive ? 'online' : 'offline',
        lastSeen: acc.lastUpdated || new Date().toISOString(),
        version: '1.0.0',
        accountId: acc.id
      })));

      setIsConnected(true);
      retryCountRef.current = 0;
      console.log('✅ Initial data loaded successfully');
      
    } catch (err) {
      console.error('❌ Failed to load initial data:', err);
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
      setIsConnected(false);
      
      // リトライ処理
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`🔄 Retrying... (${retryCountRef.current}/${maxRetries})`);
        setTimeout(() => loadInitialData(), 2000 * retryCountRef.current);
      }
    } finally {
      setIsLoading(false);
    }
  }, [calculateStats]);

  // Subscription設定
  const setupSubscriptions = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      const userId = user.userId;

      console.log('🔔 Setting up GraphQL subscriptions...');

      // Account更新監視
      subscriptionsRef.current.accounts = amplifyClient.models.Account.observeQuery({
        filter: { userId: { eq: userId } }
      }).subscribe({
        next: ({ items }) => {
          console.log('📋 Account subscription update:', items.length);
          setAccounts(items);
          setStats(prev => {
            const newStats = calculateStats(items, positions, actions);
            return { ...prev, ...newStats };
          });
        },
        error: (err) => {
          console.error('❌ Account subscription error:', err);
          setError('リアルタイム更新でエラーが発生しました');
        }
      });

      // Position更新監視
      subscriptionsRef.current.positions = amplifyClient.models.Position.observeQuery({
        filter: { userId: { eq: userId } }
      }).subscribe({
        next: ({ items }) => {
          console.log('📊 Position subscription update:', items.length);
          setPositions(items);
          setStats(prev => {
            const newStats = calculateStats(accounts, items, actions);
            return { ...prev, ...newStats };
          });
        },
        error: (err) => {
          console.error('❌ Position subscription error:', err);
          setError('ポジション監視でエラーが発生しました');
        }
      });

      // Action更新監視
      subscriptionsRef.current.actions = amplifyClient.models.Action.observeQuery({
        filter: { userId: { eq: userId } }
      }).subscribe({
        next: ({ items }) => {
          console.log('⚡ Action subscription update:', items.length);
          setActions(items);
          setStats(prev => {
            const newStats = calculateStats(accounts, positions, items);
            return { ...prev, ...newStats };
          });
        },
        error: (err) => {
          console.error('❌ Action subscription error:', err);
          setError('アクション監視でエラーが発生しました');
        }
      });

      console.log('✅ GraphQL subscriptions setup complete');
      
    } catch (err) {
      console.error('❌ Failed to setup subscriptions:', err);
      setError('リアルタイム更新の設定に失敗しました');
    }
  }, [accounts, positions, actions, calculateStats]);

  // Subscription解除
  const cleanupSubscriptions = useCallback(() => {
    console.log('🧹 Cleaning up subscriptions...');
    
    Object.values(subscriptionsRef.current).forEach(subscription => {
      if (subscription) {
        subscription.unsubscribe();
      }
    });
    
    subscriptionsRef.current = {};
  }, []);

  // 手動更新
  const refresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    await loadInitialData();
  }, [loadInitialData]);

  // 初期化
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Subscription開始
  useEffect(() => {
    if (isConnected && !isLoading && !error) {
      setupSubscriptions();
    }
    
    return cleanupSubscriptions;
  }, [isConnected, isLoading, error, setupSubscriptions, cleanupSubscriptions]);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      cleanupSubscriptions();
    };
  }, [cleanupSubscriptions]);

  // 接続状態監視
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isConnected && !isLoading) {
        console.log('🔄 Auto-retry connection...');
        loadInitialData();
      }
    }, 30000); // 30秒ごとに接続チェック

    return () => clearInterval(interval);
  }, [isConnected, isLoading, loadInitialData]);

  return {
    stats,
    accounts,
    positions,
    actions,
    clients,
    isLoading,
    error,
    isConnected,
    refresh
  };
}