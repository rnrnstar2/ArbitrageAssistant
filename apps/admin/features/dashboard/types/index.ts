export interface DashboardStats {
  connectedClients: number;
  totalAccounts: number;
  activeStrategies: number;
  totalBalance: number;
  openPositions: number;
  totalProfit: number;
}

export interface ClientStatus {
  id: string;
  name: string;
  status: "online" | "offline";
  lastSeen: string;
  accountCount: number;
  totalBalance: number;
}

export interface StrategyInfo {
  id: string;
  name: string;
  status: "active" | "paused" | "stopped";
  accounts: string[];
  profit: number;
  positions: number;
  created: string;
}

export interface QuickStrategyPreset {
  id: string;
  name: string;
  description: string;
  type: "hedge" | "arbitrage" | "trail";
}