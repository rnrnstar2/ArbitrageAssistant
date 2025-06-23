// Core MVP types exports

// Position types
export * from './position';

// Action types 
export * from './action';

// Account types (from trading.ts)
export * from './trading';

// WebSocket types
export * from './websocket';

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