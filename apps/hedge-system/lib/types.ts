/**
 * MVPシステム用基本型定義
 * @repo/shared-types の代替
 */

// Position関連
export enum PositionStatus {
  PENDING = 'PENDING',
  OPENING = 'OPENING', 
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  CANCELED = 'CANCELED',
  STOPPED = 'STOPPED'
}

export enum Symbol {
  USDJPY = 'USDJPY',
  EURUSD = 'EURUSD',
  EURGBP = 'EURGBP',
  XAUUSD = 'XAUUSD'
}

export enum ExecutionType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP = 'STOP'
}

export interface Position {
  id: string;
  accountId: string;
  symbol: Symbol;
  volume: number;
  executionType: ExecutionType;
  status: PositionStatus;
  userId?: string;
  trailWidth?: number;
  triggerActionIds?: string;
  memo?: string;
  mtTicket?: string;
  entryPrice?: number;
  entryTime?: string;
  exitPrice?: number;
  exitTime?: string;
  exitReason?: string;
}

export interface CreatePositionInput {
  accountId: string;
  symbol: Symbol;
  volume: number;
  executionType: ExecutionType;
  status: PositionStatus;
  trailWidth?: number;
  triggerActionIds?: string;
  memo?: string;
}

// Action関連
export enum ActionType {
  ENTRY = 'ENTRY',
  CLOSE = 'CLOSE'
}

export enum ActionStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED'
}

export interface Action {
  id: string;
  accountId: string;
  positionId?: string;
  triggerPositionId?: string;
  type: ActionType;
  status: ActionStatus;
  userId?: string;
}

export interface CreateActionInput {
  accountId: string;
  positionId?: string;
  triggerPositionId?: string;
  type: ActionType;
  status: ActionStatus;
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
    timestamp: string;
  };
}

export interface WSCloseCommand extends WSCommand {
  type: WSMessageType.CLOSE;
  positionId: string;
}

export interface WSModifyStopCommand extends WSCommand {
  type: 'MODIFY_STOP';
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
  type: 'PRICE';
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