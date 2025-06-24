import { useState, useEffect, useCallback } from "react";
import { dummyAccounts, dummyPositions, dummyActions, dummyDashboardStats, dummyClientStatus } from "../../../lib/mock-data";
import type { Account, Position, Action } from '@repo/shared-types';
import { DashboardStats, ClientStatus } from "../types";


export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDummyData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('📊 Loading dummy dashboard data...');
      
      // シンプルにダミーデータを設定
      await new Promise(resolve => setTimeout(resolve, 500)); // ローディング演出
      
      setAccounts(dummyAccounts);
      setPositions(dummyPositions);
      setActions(dummyActions);
      setStats(dummyDashboardStats);
      setClients(dummyClientStatus);
      
      console.log('✅ Dummy data loaded successfully');
      
    } catch (err) {
      console.error('❌ Failed to load dummy data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDummyData();
  }, [loadDummyData]);

  return {
    stats,
    accounts,
    positions,
    actions,
    clients,
    isLoading,
    error,
    refresh: loadDummyData
  };
}