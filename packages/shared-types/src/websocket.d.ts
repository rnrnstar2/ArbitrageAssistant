import { ExecutionType } from './position';
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
