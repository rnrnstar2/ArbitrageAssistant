// Symbol 列挙型追加
export enum Symbol {
  USDJPY = 'USDJPY',
  EURUSD = 'EURUSD',
  EURGBP = 'EURGBP',
  XAUUSD = 'XAUUSD'
}

// ExecutionType 列挙型追加
export enum ExecutionType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT'
}

// PositionStatus 更新
export enum PositionStatus {
  PENDING = 'PENDING',
  OPENING = 'OPENING',
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  STOPPED = 'STOPPED',
  CANCELED = 'CANCELED'
}

// Position インターフェース更新
export interface Position {
  id: string;
  userId: string;  // 新規追加
  accountId: string;
  executionType: ExecutionType;  // 新規追加
  status: PositionStatus;
  symbol: Symbol;  // string → Symbol型に変更
  volume: number;
  entryPrice?: number;  // openPrice → entryPrice
  entryTime?: string;   // openTime → entryTime
  exitPrice?: number;   // 新規追加
  exitTime?: string;    // closeTime → exitTime
  exitReason?: string;  // 新規追加
  trailWidth?: number;  // 新規追加
  triggerActionIds?: string;  // 新規追加（JSON配列）
  mtTicket?: string;    // 新規追加
  memo?: string;        // 新規追加
  createdAt?: string;
  updatedAt?: string;
}

// Position 作成用型
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

// Position 更新用型
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

// Position フィルター
export interface PositionFilter {
  userId?: string;
  accountId?: string;
  status?: PositionStatus;
  symbol?: Symbol;
  executionType?: ExecutionType;
}

