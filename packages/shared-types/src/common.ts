// 共通型定義

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface WebSocketMessage<T = any> {
  type: string;
  payload: T;
  timestamp: Date;
  id?: string;
}

export type Currency = 'USD' | 'EUR' | 'JPY' | 'GBP' | 'AUD' | 'CAD' | 'CHF';
export type Symbol = `${Currency}${Currency}`;
export type EventType = 'created' | 'updated' | 'deleted' | 'error';