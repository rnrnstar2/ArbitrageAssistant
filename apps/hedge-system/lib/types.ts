/**
 * Hedge System固有の型定義
 * 共通型は @repo/shared-types から import
 */

// shared-types からの型をre-export
export type {
  Position,
  CreatePositionInput,
  UpdatePositionInput,
  Action,
  CreateActionInput,
  UpdateActionInput,
  Account,
  UpdateAccountInput,
  User,
  ExecutionType,
  PositionStatus,
  ActionType,
  ActionStatus,
  UserRole,
  PCStatus,
  Symbol
} from '@repo/shared-types';

// Enumsの値をインポート
import {
  ExecutionType,
  PositionStatus,
  ActionType,
  ActionStatus
} from '@repo/shared-types';

// Hedge System 固有のフィルター型
export interface PositionFilter {
  userId?: string;
  accountId?: string;
  status?: PositionStatus;
  symbol?: Symbol;
  executionType?: ExecutionType;
}

export interface ActionFilter {
  userId?: string;
  accountId?: string;
  positionId?: string;
  status?: ActionStatus;
  type?: ActionType;
}

// WebSocket関連
export enum WSMessageType {
  INFO = 'INFO',
  PING = 'PING',
  PONG = 'PONG',
  OPEN = 'OPEN',
  CLOSE = 'CLOSE',
  OPENED = 'OPENED',
  CLOSED = 'CLOSED',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR'
}

export interface WSMessage {
  type: WSMessageType;
  timestamp: string;
}

export interface WSEvent extends WSMessage {
  accountId?: string;
  positionId?: string;
  actionId?: string;
}

export interface WSCommand extends WSMessage {
  accountId: string;
}

export interface WSPingMessage extends WSMessage {
  type: WSMessageType.PING;
}

export interface WSPongMessage extends WSMessage {
  type: WSMessageType.PONG;
}

export interface WSOpenCommand extends WSCommand {
  type: WSMessageType.OPEN;
  positionId: string;
  symbol: Symbol;
  side: 'BUY' | 'SELL';
  volume: number;
  trailWidth?: number;
  metadata?: {
    strategyId?: string;
    executionType?: ExecutionType;
    timestamp: string;
  };
}

export interface WSCloseCommand extends WSCommand {
  type: WSMessageType.CLOSE;
  positionId: string;
  symbol?: Symbol;
  side?: 'BUY' | 'SELL';
  volume?: number;
  metadata?: {
    executionType?: ExecutionType;
    timestamp: string;
  };
}

export interface WSModifyStopCommand extends WSCommand {
  type: WSMessageType.CLOSE; // MODIFY_STOP は CLOSE に統合
  positionId: string;
  stopLoss: number;
}

export interface WSOpenedEvent extends WSEvent {
  type: WSMessageType.OPENED;
  positionId: string;
  orderId: number;
  price: number;
  time: string;
  mtTicket?: string;
}

export interface WSClosedEvent extends WSEvent {
  type: WSMessageType.CLOSED;
  positionId: string;
  price: number;
  profit: number;
  time: string;
  mtTicket?: string;
}

export interface WSStoppedEvent extends WSEvent {
  type: WSMessageType.STOPPED;
  positionId: string;
  price: number;
  time: string;
  reason: string;
}

export interface WSErrorEvent extends WSEvent {
  type: WSMessageType.ERROR;
  positionId?: string;
  message: string;
  errorCode?: string;
}

export interface WSPriceEvent extends WSEvent {
  type: WSMessageType.INFO; // PRICE は INFO に統合
  symbol: string;
  price: number;
  timestamp: string;
}

// Realtime関連（最小限）
export interface RealtimePosition {
  id: string;
  accountId: string;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  openTime: Date;
  lastUpdate: Date;
  isStale: boolean;
}

export interface RealtimeAccount {
  id: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  connectionStatus: 'connected' | 'disconnected';
  lastUpdate: Date;
  positions: RealtimePosition[];
}

// WebSocket Performance型定義
export interface WebSocketPerformanceMetrics {
  avg_latency_ms: number;
  error_rate: number;
  peak_connections: number;
  messages_per_second: number;
  connected_clients: number;
  total_messages_received: number;
  total_messages_sent: number;
  uptime_seconds: number;
}

export interface SystemPerformance {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_latency_ms: number;
}

export interface NetworkQuality {
  connection_stability: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  packet_loss_rate: number;
  bandwidth_mbps: number;
}

export interface WebSocketClientInfo {
  id: string;
  authenticated: boolean;
  connected_at: string;
  last_heartbeat: string;
  ea_info?: {
    version: string;
    platform: string;
    account: string;
    server_name?: string;
    company_name?: string;
  };
}

export interface WebSocketDetailedStats {
  performance: WebSocketPerformanceMetrics;
  clients: WebSocketClientInfo[];
  errors: Array<{ timestamp: string; message: string; count: number }>;
}

export interface WebSocketEventPayload {
  type: 'connection' | 'disconnection' | 'message' | 'error';
  clientId: string;
  message?: string;
  error?: string;
}

// isolatedModules対応のための空実装
export const Types = {} as const;