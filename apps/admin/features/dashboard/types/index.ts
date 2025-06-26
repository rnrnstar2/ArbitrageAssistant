export interface DashboardStats {
  connectedAccounts: number;
  totalAccounts: number;
  openPositions: number;
  pendingActions: number;
  totalVolume: number;
  totalPnL: number;
  totalBalance: number;
  totalCredit: number;
  totalEquity: number;
  systemHealth: 'healthy' | 'warning' | 'error';
}

export interface ClientStatus {
  id: string;
  name: string;
  status: "online" | "offline";
  lastSeen: string;
  accountCount: number;
  version: string;
  accountId: string;
}

// Import types from shared-amplify (統一)
export type { Account, Position, Action } from '@repo/shared-amplify/types';
