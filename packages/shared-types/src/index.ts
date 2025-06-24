// MVPシステム設計書準拠の統一型定義

// =============================================================================
// User Types
// =============================================================================

export enum UserRole {
  CLIENT = 'CLIENT',
  ADMIN = 'ADMIN'
}

export enum PCStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  pcStatus?: PCStatus;
  isActive: boolean;
  accounts?: Account[];
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================================
// Account Types
// =============================================================================

export interface Account {
  id: string;
  userId: string;
  brokerType: string;
  accountNumber: string;
  serverName: string;
  displayName: string;
  balance?: number;
  credit?: number;
  equity?: number;
  isActive?: boolean;
  lastUpdated?: string;
  user?: User;
  positions?: Position[];
  actions?: Action[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateAccountInput {
  id: string;
  balance?: number;
  credit?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number;
  lastUpdated?: string;
}

// =============================================================================
// Position Types
// =============================================================================

export enum Symbol {
  USDJPY = 'USDJPY',
  EURUSD = 'EURUSD',
  EURGBP = 'EURGBP',
  XAUUSD = 'XAUUSD'
}

export enum PositionStatus {
  PENDING = 'PENDING',
  OPENING = 'OPENING',
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  STOPPED = 'STOPPED',
  CANCELED = 'CANCELED'
}

export enum ExecutionType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT'
}

export interface Position {
  id: string;
  userId: string;
  accountId: string;
  executionType: ExecutionType;
  status: PositionStatus;
  symbol: Symbol;
  volume: number;
  entryPrice?: number;
  entryTime?: string;
  exitPrice?: number;
  exitTime?: string;
  exitReason?: string;
  trailWidth?: number;
  triggerActionIds?: string;
  mtTicket?: string;
  memo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePositionInput {
  userId: string;
  accountId: string;
  executionType: ExecutionType;
  symbol: Symbol;
  volume: number;
  status?: PositionStatus;
  trailWidth?: number;
  triggerActionIds?: string;
  memo?: string;
}

export interface UpdatePositionInput {
  id: string;
  status?: PositionStatus;
  entryPrice?: number;
  entryTime?: string;
  exitPrice?: number;
  exitTime?: string;
  exitReason?: string;
  mtTicket?: string;
  trailWidth?: number;
  triggerActionIds?: string;
}

export interface PositionFilter {
  userId?: string;
  accountId?: string;
  status?: PositionStatus;
  symbol?: Symbol;
  executionType?: ExecutionType;
}

// =============================================================================
// Action Types
// =============================================================================

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
  userId: string;
  accountId: string;
  positionId: string;
  triggerPositionId?: string;
  type: ActionType;
  status: ActionStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateActionInput {
  userId: string;
  accountId: string;
  positionId?: string;
  triggerPositionId?: string;
  type: ActionType;
  status?: ActionStatus;
}

export interface UpdateActionInput {
  id: string;
  status?: ActionStatus;
  updatedAt?: string;
}

export interface ActionFilter {
  userId?: string;
  accountId?: string;
  positionId?: string;
  status?: ActionStatus;
  type?: ActionType;
}

export interface ActionSubscriptionFilter {
  userId: string;
}

// =============================================================================
// WebSocket Types
// =============================================================================

export interface OpenCommand {
  command: 'OPEN';
  accountId: string;
  positionId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  metadata: {
    executionType: ExecutionType;
    timestamp: string;
  };
}

export interface CloseCommand {
  command: 'CLOSE';
  accountId: string;
  positionId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  metadata: {
    executionType: 'EXIT';
    timestamp: string;
  };
}

export interface OpenedEvent {
  event: 'OPENED';
  accountId: string;
  positionId: string;
  mtTicket: string;
  price: number;
  time: string;
  status: 'SUCCESS' | 'FAILED';
}

export interface ClosedEvent {
  event: 'CLOSED';
  accountId: string;
  positionId: string;
  mtTicket: string;
  price: number;
  time: string;
  reason?: string;
}

export interface StoppedEvent {
  event: 'STOPPED';
  accountId: string;
  positionId: string;
  mtTicket: string;
  price: number;
  time: string;
}

export interface AccountUpdateEvent {
  event: 'ACCOUNT_UPDATE';
  accountId: string;
  balance: number;
  credit: number;
  equity: number;
  time: string;
}

export interface PriceUpdateEvent {
  event: 'PRICE_UPDATE';
  symbol: string;
  bid: number;
  ask: number;
  time: string;
}

export type WSCommand = OpenCommand | CloseCommand;
export type WSEvent = OpenedEvent | ClosedEvent | StoppedEvent | AccountUpdateEvent | PriceUpdateEvent;