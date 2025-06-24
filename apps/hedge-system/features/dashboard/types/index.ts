export interface EAConnection {
  id: string;
  broker: string;
  accountNumber: string;
  status: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  websocketStatus: 'active' | 'inactive' | 'connecting';
  lastPing: Date;
  responseTime: number;
  balance: number;
  bonusAmount: number;
  openPositions: number;
}

export interface DashboardSystemStatus {
  totalEAs: number;
  activeEAs: number;
  errorCount: number;
  lastUpdate: Date;
  uptime: string;
  webSocketPort: number;
  adminConnected: boolean;
}

export interface SystemHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  color: string;
  icon: any;
}

export interface SystemContextType {
  systemStatus: DashboardSystemStatus;
  eaConnections: EAConnection[];
  isRefreshing: boolean;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  handleRefresh: () => Promise<void>;
}

export interface DashboardProps {
  className?: string;
}

// isolatedModules対応のための空実装
export const DashboardTypes = {} as const;