// Core MVP types exports

// Position types
export * from './position.js';
export type {
  Position,
  CreatePositionInput,
  UpdatePositionInput,
  PositionFilter
} from './position.js';
export { PositionStatus, Symbol, ExecutionType } from './position.js';

// Action types
export * from './action.js';
export type {
  Action,
  CreateActionInput,
  UpdateActionInput,
  ActionFilter,
  ActionSubscriptionFilter
} from './action.js';
export { ActionType, ActionStatus } from './action.js';

// Account types (from trading.ts)
export type {
  Account,
  UpdateAccountInput
} from './trading.js';

// WebSocket types
export type {
  OpenCommand,
  CloseCommand,
  WSCommand
} from './websocket.js';

// User types (core MVP)
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
  isActive?: boolean;
}