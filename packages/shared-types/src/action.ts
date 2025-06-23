export enum ActionType {
  ENTRY = 'ENTRY',
  CLOSE = 'CLOSE'
}

export enum ActionStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  EXECUTED = 'executed',
  FAILED = 'failed'
}

export enum Symbol {
  USDJPY = 'USDJPY',
  EURUSD = 'EURUSD',
  EURGBP = 'EURGBP',
  XAUUSD = 'XAUUSD'
}

export interface EntryParams {
  symbol: Symbol;
  volume: number;
  price?: number; // Optional - 成行の場合はnull
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface CloseParams {
  reason?: string; // 'manual', 'stop_loss', 'take_profit', etc.
  comment?: string;
}

export interface Action {
  actionId: string;
  strategyId: string;
  type: ActionType;
  positionId: string; // Action作成時にPosition同時作成でIDを連携
  accountId: string; // 対象口座ID
  entryParams?: EntryParams;
  closeParams?: CloseParams;
  status: ActionStatus;
  createdAt: Date;
  updatedAt: Date;
}