export interface EAConnection {
  accountId: string;
  clientPCId: string;
  status: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  lastSeen: Date;
  version: string;
  broker: string;
  accountNumber: string;
  connectionInfo: {
    ipAddress: string;
    userAgent: string;
    connectedAt: Date;
  };
}

export interface Position {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  swap: number;
  sl: number;
  tp: number;
  openTime: Date;
  comment: string;
}

export interface Account {
  accountId: string;
  balance: number;
  equity: number;
  margin: number;
  marginFree: number;
  marginLevel: number;
  credit: number;
  profit: number;
  server: string;
  currency: string;
  leverage: number;
  positions: Position[];
}

export interface EACommand {
  id: string;
  accountId: string;
  type: 'open_position' | 'close_position' | 'modify_position' | 'set_trail' | 'emergency_stop';
  payload: Record<string, any>;
  timestamp: Date;
  status: 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
}

export interface OpenPositionCommand {
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  price?: number; // 0 for market order
  sl?: number;
  tp?: number;
  comment?: string;
  magic?: number;
}

export interface ClosePositionCommand {
  ticket: number;
  volume?: number; // partial close if specified
}

export interface ModifyPositionCommand {
  ticket: number;
  sl?: number;
  tp?: number;
}

export interface SetTrailCommand {
  ticket: number;
  trailDistance: number;
  trailStep: number;
}

export interface PositionUpdateData {
  type: 'position_update';
  accountId: string;
  timestamp: number;
  positions: Position[];
}

export interface AccountUpdateData {
  type: 'account_update';
  accountId: string;
  timestamp: number;
  balance: number;
  equity: number;
  margin: number;
  marginFree: number;
  marginLevel: number;
  credit: number;
  profit: number;
  server: string;
  currency: string;
}

export interface HeartbeatData {
  type: 'heartbeat';
  accountId: string;
  timestamp: number;
  status: 'online';
}

export interface CommandResponse {
  type: 'command_response';
  commandId: string;
  accountId: string;
  timestamp: number;
  status: 'success' | 'error';
  result?: any;
  error?: string;
}

export type EAMessage = PositionUpdateData | AccountUpdateData | HeartbeatData | CommandResponse;

export interface EAConnectionStats {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  lastReconnectAttempt?: Date;
  uptime: number;
  messagesReceived: number;
  messagesSent: number;
  averageLatency: number;
}

export interface EAError {
  accountId: string;
  timestamp: Date;
  type: 'connection' | 'command' | 'data' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, any>;
  resolved: boolean;
}

export interface EASettings {
  autoReconnect: boolean;
  reconnectInterval: number; // milliseconds
  heartbeatInterval: number; // milliseconds
  commandTimeout: number; // milliseconds
  maxRetries: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
}