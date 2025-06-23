import { Symbol } from './action';

export enum PositionStatus {
  PENDING = 'pending',
  OPENING = 'opening',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
  STOPPED = 'stopped',
  CANCELED = 'canceled'
}

export interface Position {
  positionId: string;
  strategyId: string;
  status: PositionStatus;
  symbol: Symbol;
  volume: number;
  accountId?: string; // 対象口座ID
  currentPrice?: number; // 現在価格
  entryPrice?: number;
  entryTime?: Date;
  exitPrice?: number;
  exitTime?: Date;
  exitReason?: string;
  stopLoss?: number;
  takeProfit?: number;
  trailWidth?: number;
  primary?: boolean;
  owner?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePositionInput {
  strategyId: string;
  symbol: Symbol;
  volume: number;
  status?: PositionStatus;
  trailWidth?: number;
  primary?: boolean;
  owner?: string;
}

export interface UpdatePositionInput {
  positionId: string;
  status?: PositionStatus;
  entryPrice?: number;
  entryTime?: Date;
  exitPrice?: number;
  exitTime?: Date;
  exitReason?: string;
  stopLoss?: number;
  takeProfit?: number;
}