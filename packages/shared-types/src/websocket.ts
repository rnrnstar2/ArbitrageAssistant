export enum WSMessageType {
  // Hedge -> EA
  OPEN = 'OPEN',
  CLOSE = 'CLOSE',
  MODIFY_STOP = 'MODIFY_STOP',
  MODIFY_TP = 'MODIFY_TP',
  PING = 'PING',
  
  // EA -> Hedge
  OPENED = 'OPENED',
  CLOSED = 'CLOSED',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
  PRICE = 'PRICE',
  STOP_MODIFIED = 'STOP_MODIFIED',
  PONG = 'PONG',
  INFO = 'INFO'
}

export interface WSBaseMessage {
  type: WSMessageType;
  timestamp: string;
  sequenceId?: number;
}

// Hedge -> EA Messages
export interface WSOpenCommand extends WSBaseMessage {
  type: WSMessageType.OPEN;
  accountId: string;
  positionId: string;
  actionId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  trailWidth?: number;
  stopLoss?: number;
  takeProfit?: number;
  metadata: {
    strategyId?: string;
    timestamp: string;
  };
}

export interface WSCloseCommand extends WSBaseMessage {
  type: WSMessageType.CLOSE;
  accountId: string;
  positionId: string;
  actionId: string;
  metadata: {
    strategyId?: string;
    timestamp: string;
  };
}

export interface WSModifyStopCommand extends WSBaseMessage {
  type: WSMessageType.MODIFY_STOP;
  positionId: string;
  newStopPrice: number;
}

export interface WSPingMessage extends WSBaseMessage {
  type: WSMessageType.PING;
}

// EA -> Hedge Messages
export interface WSOpenedEvent extends WSBaseMessage {
  type: WSMessageType.OPENED;
  accountId: string;
  positionId: string;
  actionId: string;
  mtTicket: string;
  price: number;
  time: string;
  status: 'SUCCESS' | 'FAILED';
  orderId?: number;
}

export interface WSClosedEvent extends WSBaseMessage {
  type: WSMessageType.CLOSED;
  accountId: string;
  positionId: string;
  actionId: string;
  mtTicket: string;
  price: number;
  profit: number;
  time: string;
  status: 'SUCCESS' | 'FAILED';
}

export interface WSStoppedEvent extends WSBaseMessage {
  type: WSMessageType.STOPPED;
  accountId: string;
  positionId: string;
  mtTicket: string;
  price: number;
  time: string;
  reason: 'STOP_LOSS' | 'MARGIN_CALL';
}

export interface WSErrorEvent extends WSBaseMessage {
  type: WSMessageType.ERROR;
  positionId?: string;
  message: string;
  errorCode?: number;
}

export interface WSPriceEvent extends WSBaseMessage {
  type: WSMessageType.PRICE;
  symbol: string;
  bid: number;
  ask: number;
  time: string;
}

export interface WSPongMessage extends WSBaseMessage {
  type: WSMessageType.PONG;
}

export interface WSInfoEvent extends WSBaseMessage {
  type: WSMessageType.INFO;
  account?: string;
  version?: string;
  [key: string]: any;
}

export interface WSStopModifiedEvent extends WSBaseMessage {
  type: WSMessageType.STOP_MODIFIED;
  positionId: string;
  newStopPrice: number;
  success: boolean;
}

export type WSCommand = WSOpenCommand | WSCloseCommand | WSModifyStopCommand | WSPingMessage;
export type WSEvent = WSOpenedEvent | WSClosedEvent | WSStoppedEvent | WSErrorEvent | WSPriceEvent | WSPongMessage | WSInfoEvent | WSStopModifiedEvent;
export type WSMessage = WSCommand | WSEvent;