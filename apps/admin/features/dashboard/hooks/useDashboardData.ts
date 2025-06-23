import { useState, useEffect, useCallback, useMemo } from "react";
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import { Schema } from '@repo/shared-backend';
import { DashboardStats, ClientStatus, Account, Position, Action, ExecutionType, PositionStatus, ActionType, ActionStatus } from "../types";

// Amplifyデータをアプリケーション型に変換
function convertAmplifyAccount(amplifyAccount: any): Account {
  return {
    id: amplifyAccount.id,
    userId: amplifyAccount.userId,
    brokerType: amplifyAccount.brokerType,
    accountNumber: amplifyAccount.accountNumber,
    serverName: amplifyAccount.serverName,
    displayName: amplifyAccount.displayName,
    balance: amplifyAccount.balance ?? 0,
    credit: amplifyAccount.credit ?? 0,
    equity: amplifyAccount.equity ?? 0,
    isActive: amplifyAccount.isActive ?? true,
    lastUpdated: amplifyAccount.lastUpdated,
    createdAt: amplifyAccount.createdAt,
    updatedAt: amplifyAccount.updatedAt,
  };
}

function convertAmplifyPosition(amplifyPosition: any): Position {
  return {
    id: amplifyPosition.id,
    userId: amplifyPosition.userId,
    accountId: amplifyPosition.accountId,
    executionType: amplifyPosition.executionType as ExecutionType,
    status: amplifyPosition.status as PositionStatus,
    symbol: amplifyPosition.symbol as any,
    volume: amplifyPosition.volume,
    entryPrice: amplifyPosition.entryPrice,
    entryTime: amplifyPosition.entryTime,
    exitPrice: amplifyPosition.exitPrice,
    exitTime: amplifyPosition.exitTime,
    exitReason: amplifyPosition.exitReason,
    trailWidth: amplifyPosition.trailWidth,
    triggerActionIds: amplifyPosition.triggerActionIds,
    mtTicket: amplifyPosition.mtTicket,
    memo: amplifyPosition.memo,
    createdAt: amplifyPosition.createdAt,
    updatedAt: amplifyPosition.updatedAt,
  };
}

function convertAmplifyAction(amplifyAction: any): Action {
  return {
    id: amplifyAction.id,
    userId: amplifyAction.userId,
    accountId: amplifyAction.accountId,
    positionId: amplifyAction.positionId,
    triggerPositionId: amplifyAction.triggerPositionId,
    type: amplifyAction.type as ActionType,
    status: amplifyAction.status as ActionStatus,
    createdAt: amplifyAction.createdAt,
    updatedAt: amplifyAction.updatedAt,
  };
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