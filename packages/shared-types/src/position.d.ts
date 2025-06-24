export declare enum Symbol {
    USDJPY = "USDJPY",
    EURUSD = "EURUSD",
    EURGBP = "EURGBP",
    XAUUSD = "XAUUSD"
}
export declare enum ExecutionType {
    ENTRY = "ENTRY",
    EXIT = "EXIT"
}
export declare enum PositionStatus {
    PENDING = "PENDING",
    OPENING = "OPENING",
    OPEN = "OPEN",
    CLOSING = "CLOSING",
    CLOSED = "CLOSED",
    STOPPED = "STOPPED",
    CANCELED = "CANCELED"
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
