export interface DashboardStats {
  connectedAccounts: number;
  totalAccounts: number;
  openPositions: number;
  pendingActions: number;
  totalVolume: number;
  totalPnL: number;
}

export interface ClientStatus {
  id: string;
  name: string;
  status: "online" | "offline";
  lastSeen: string;
  accountCount: number;
}

// Import types from shared-amplify (統一)
export type { Account, Position, Action } from '@repo/shared-amplify/types';
