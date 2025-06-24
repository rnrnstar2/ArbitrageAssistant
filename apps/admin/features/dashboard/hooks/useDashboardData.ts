import { useState, useEffect, useCallback, useMemo } from "react";
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { AmplifySchema as Schema, Account, Position, Action, ExecutionType, PositionStatus, ActionType, ActionStatus } from '@repo/shared-amplify/types';
import { DashboardStats, ClientStatus } from "../types";

// Amplifyデータをアプリケーション型に変換
function convertAmplifyAccount(amplifyAccount: any): Account {
  return amplifyAccount as Account;
}

function convertAmplifyPosition(amplifyPosition: any): Position {
  return amplifyPosition as Position;
}

function convertAmplifyAction(amplifyAction: any): Action {
  return amplifyAction as Action;
}

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => generateClient<Schema>(), []);

  const loadRealData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const user = await getCurrentUser();
      
      // 実際のデータ取得
      const [accountsResult, positionsResult, actionsResult] = await Promise.all([
        client.models.Account.list({
          filter: { userId: { eq: user.userId } }
        }),
        client.models.Position.list({
          filter: { userId: { eq: user.userId } }
        }),
        client.models.Action.list({
          filter: { userId: { eq: user.userId } }
        })
      ]);
      
      if (accountsResult.errors || positionsResult.errors || actionsResult.errors) {
        throw new Error('Failed to load dashboard data');
      }
      
      const accountsData = (accountsResult.data || []).map(convertAmplifyAccount);
      const positionsData = (positionsResult.data || []).map(convertAmplifyPosition);
      const actionsData = (actionsResult.data || []).map(convertAmplifyAction);
      
      setAccounts(accountsData);
      setPositions(positionsData);
      setActions(actionsData);
      
      // 統計計算
      const calculatedStats = calculateRealStats(
        accountsData, 
        positionsData, 
        actionsData
      );
      setStats(calculatedStats);
      
      // Client status (模擬 - 実際のクライアント接続状態が必要)
      setClients(generateClientStatus(accountsData));
      
    } catch (err) {
      console.error('Dashboard data loading failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadRealData();
  }, [loadRealData]);

  return {
    stats,
    accounts,
    positions,
    actions,
    clients,
    isLoading,
    error,
    refresh: loadRealData
  };
}

// 実際のデータから統計計算
function calculateRealStats(
  accounts: Account[], 
  positions: Position[], 
  actions: Action[]
): DashboardStats {
  const openPositions = positions.filter(pos => pos.status === 'OPEN');
  const pendingActions = actions.filter(action => action.status === 'PENDING');
  
  return {
    connectedAccounts: accounts.filter(acc => acc.isActive).length,
    totalAccounts: accounts.length,
    openPositions: openPositions.length,
    pendingActions: pendingActions.length,
    totalVolume: openPositions.reduce((sum, pos) => sum + (pos.volume || 0), 0),
    totalPnL: openPositions.reduce((sum, pos) => {
      // PnL計算 (entryPrice と exitPrice があれば)
      if (pos.entryPrice && pos.exitPrice) {
        const pnl = (pos.exitPrice - pos.entryPrice) * (pos.volume || 0);
        return sum + pnl;
      }
      return sum;
    }, 0)
  };
}

// Client status 生成 (アカウントベース)
function generateClientStatus(accounts: Account[]): ClientStatus[] {
  const clientMap = new Map<string, ClientStatus>();
  
  accounts.forEach(account => {
    const clientId = account.userId;
    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        id: clientId,
        name: `Client-${clientId.slice(-6)}`,
        status: account.isActive ? "online" : "offline",
        lastSeen: account.lastUpdated ? new Date(account.lastUpdated).toLocaleString('ja-JP') : "不明",
        accountCount: 0
      });
    }
    
    const client = clientMap.get(clientId)!;
    client.accountCount += 1;
  });
  
  return Array.from(clientMap.values());
}