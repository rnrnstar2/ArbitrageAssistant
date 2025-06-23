// Amplifyで自動生成される型と重複を避けるため、表示専用型として定義

// 表示用追加フィールド付きCloseHistory
export interface CloseHistoryDisplay {
  id: string;
  positionId: string;
  accountId: string;
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  swapCost: number;
  holdingDays: number;
  closeType: 'market' | 'limit';
  trailSettings?: any;
  linkedAction?: LinkedCloseAction;
  status: 'pending' | 'executed' | 'failed';
  executedAt?: Date;
  error?: string;
  // 計算フィールド
  totalReturn: number;
  dailyReturn: number;
}

interface TrailSettings {
  enabled: boolean;
  level: number;
}

export interface LinkedCloseAction {
  relatedPositionId?: string;
  action: 'close' | 'trail' | 'none';
  settings?: TrailSettings;
}

/**
 * 決済履歴のフィルター条件
 */
export interface CloseHistoryFilters {
  accountIds?: string[];
  symbols?: string[];
  closeTypes?: ('market' | 'limit')[];
  statuses?: ('pending' | 'executed' | 'failed')[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  profitRange?: {
    min: number;
    max: number;
  };
  holdingDaysRange?: {
    min: number;
    max: number;
  };
  sortBy?: 'executedAt' | 'profit' | 'holdingDays' | 'totalReturn';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * 決済履歴統計情報
 */
export interface CloseHistoryStats {
  totalTrades: number;
  totalProfit: number;
  totalSwapCost: number;
  totalReturn: number;
  averageHoldingDays: number;
  successRate: number; // executed / total
  profitableRate: number; // (profit > 0) / total
  averageProfit: number;
  maxProfit: number;
  maxLoss: number;
  bySymbol: Record<string, {
    count: number;
    totalProfit: number;
    totalSwapCost: number;
    averageHoldingDays: number;
  }>;
  byCloseType: Record<string, {
    count: number;
    totalProfit: number;
    successRate: number;
  }>;
}

/**
 * エクスポート用データ構造
 */
export interface CloseHistoryExport {
  format: 'csv' | 'excel' | 'json';
  data: CloseHistoryDisplay[];
  summary: CloseHistoryStats;
  filters: CloseHistoryFilters;
  exportedAt: Date;
}

/**
 * ページネーション用レスポンス
 */
export interface CloseHistoryResponse {
  items: CloseHistoryDisplay[];
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  currentPage: number;
  totalPages: number;
}