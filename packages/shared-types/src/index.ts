// MVPシステム設計書準拠の統一型定義

// AWS Amplify compatibility types
export type Nullable<T> = T | null;

// =============================================================================
// User Types
// =============================================================================

export const UserRole = {
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN'
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export const PCStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE'
} as const;

export type PCStatus = typeof PCStatus[keyof typeof PCStatus];

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  pcStatus?: Nullable<PCStatus>;
  isActive: boolean;
  accounts?: Account[];
  createdAt?: Nullable<string>;
  updatedAt?: Nullable<string>;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  pcStatus?: PCStatus;
}

export interface UpdateUserInput {
  id: string;
  name?: string;
  role?: UserRole;
  pcStatus?: PCStatus;
  isActive?: boolean;
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
  balance?: Nullable<number>;
  credit?: Nullable<number>;
  equity?: Nullable<number>;
  isActive?: Nullable<boolean>;
  lastUpdated?: Nullable<string>;
  user?: User;
  positions?: Position[];
  actions?: Action[];
  createdAt?: Nullable<string>;
  updatedAt?: Nullable<string>;
}

export interface CreateAccountInput {
  userId: string;
  brokerType: string;
  accountNumber: string;
  serverName: string;
  displayName: string;
  balance?: number;
  credit?: number;
  equity?: number;
  isActive?: boolean;
}

export interface UpdateAccountInput {
  id: string;
  balance?: number;
  credit?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number;
  isActive?: boolean;
  lastUpdated?: string;
}

// =============================================================================
// Position Types
// =============================================================================

export const Symbol = {
  USDJPY: 'USDJPY',
  EURUSD: 'EURUSD',
  EURGBP: 'EURGBP',
  XAUUSD: 'XAUUSD'
} as const;

export type Symbol = typeof Symbol[keyof typeof Symbol];

export const PositionStatus = {
  PENDING: 'PENDING',
  OPENING: 'OPENING',
  OPEN: 'OPEN',
  CLOSING: 'CLOSING',
  CLOSED: 'CLOSED',
  STOPPED: 'STOPPED',
  CANCELED: 'CANCELED'
} as const;

export type PositionStatus = typeof PositionStatus[keyof typeof PositionStatus];

export const ExecutionType = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT'
} as const;

export type ExecutionType = typeof ExecutionType[keyof typeof ExecutionType];

export interface Position {
  id: string;
  userId: string;
  accountId: string;
  executionType: ExecutionType;
  status: PositionStatus;
  symbol: Symbol;
  volume: number;
  entryPrice?: Nullable<number>;
  entryTime?: Nullable<string>;
  exitPrice?: Nullable<number>;
  exitTime?: Nullable<string>;
  exitReason?: Nullable<string>;
  trailWidth?: Nullable<number>;
  triggerActionIds?: Nullable<string>;
  mtTicket?: Nullable<string>;
  memo?: Nullable<string>;
  createdAt?: Nullable<string>;
  updatedAt?: Nullable<string>;
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

export const ActionType = {
  ENTRY: 'ENTRY',
  CLOSE: 'CLOSE'
} as const;

export type ActionType = typeof ActionType[keyof typeof ActionType];

export const ActionStatus = {
  PENDING: 'PENDING',
  EXECUTING: 'EXECUTING',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED'
} as const;

export type ActionStatus = typeof ActionStatus[keyof typeof ActionStatus];

export interface Action {
  id: string;
  userId: string;
  accountId: string;
  positionId: string;
  triggerPositionId?: Nullable<string>;
  type: ActionType;
  status: ActionStatus;
  createdAt?: Nullable<string>;
  updatedAt?: Nullable<string>;
}

export interface CreateActionInput {
  userId: string;
  accountId: string;
  positionId: string;
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
// Market Types
// =============================================================================

export interface MarketCondition {
  symbol: Symbol;
  currentPrice: number;
  spread: number;
  volatility: number;
  liquidity: number;
  timestamp: string;
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