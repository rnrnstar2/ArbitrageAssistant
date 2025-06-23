export interface DashboardStats {
  connectedClients: number;
  totalAccounts: number;
  openPositions: number;
}

export interface ClientStatus {
  id: string;
  name: string;
  status: "online" | "offline";
  lastSeen: string;
  accountCount: number;
}
