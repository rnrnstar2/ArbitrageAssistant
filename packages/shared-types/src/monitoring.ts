// モニタリング関連の共通型定義

export interface AccountInfo {
  accountId: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
}

export interface MarketData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: Date;
  spread: number;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  accountId?: string;
  acknowledged: boolean;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  timestamp: Date;
}

export interface ConnectionStatus {
  accountId: string;
  connected: boolean;
  lastHeartbeat: Date;
  reconnectAttempts: number;
}

export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';
export type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'error';