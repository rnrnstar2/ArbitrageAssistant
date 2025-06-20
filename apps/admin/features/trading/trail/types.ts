export type TrailType = 'fixed' | 'percentage' | 'atr';

export type StartConditionType = 'immediate' | 'profit_threshold' | 'price_level';

export interface TrailStartCondition {
  type: StartConditionType;
  value?: number;
}

export interface TrailSettings {
  id: string;
  positionId: string;
  type: TrailType;
  trailAmount: number;
  startCondition: TrailStartCondition;
  isActive: boolean;
  currentStopLoss?: number;
  maxProfit?: number;
  lastUpdated: Date;
}

export interface TrailFormData {
  type: TrailType;
  fixedPips?: number;
  percentageAmount?: number;
  atrMultiplier?: number;
  atrPeriod?: number;
  startCondition: TrailStartCondition;
}

export interface TrailPreset {
  id: string;
  name: string;
  description?: string;
  settings: Omit<TrailFormData, 'id'>;
  isDefault?: boolean;
}

export interface TrailHistoryEntry {
  id: string;
  positionId: string;
  accountId: string;
  symbol: string;
  trailSettings: TrailSettings;
  actionType: 'start' | 'update' | 'stop' | 'triggered';
  oldStopLoss?: number;
  newStopLoss?: number;
  price: number;
  profit: number;
  maxProfit: number;
  trailDistance: number;
  timestamp: Date;
  reason?: string;
  success: boolean;
  error?: string;
}

export interface TrailHistoryFilters {
  accountIds?: string[];
  symbols?: string[];
  positionIds?: string[];
  actionTypes?: ('start' | 'update' | 'stop' | 'triggered')[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  profitRange?: {
    min: number;
    max: number;
  };
  success?: boolean;
  sortBy?: 'timestamp' | 'profit' | 'maxProfit' | 'trailDistance';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface TrailHistoryStats {
  totalActions: number;
  successfulActions: number;
  successRate: number;
  averageProfit: number;
  maxProfit: number;
  minProfit: number;
  averageTrailDistance: number;
  totalTriggered: number;
  triggerRate: number;
  byActionType: Record<string, {
    count: number;
    successRate: number;
    averageProfit: number;
  }>;
  bySymbol: Record<string, {
    count: number;
    successRate: number;
    averageProfit: number;
    totalTriggered: number;
  }>;
  profitDistribution: {
    profitable: number;
    unprofitable: number;
    breakeven: number;
  };
}

export interface TrailHistoryResponse {
  items: TrailHistoryEntry[];
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  currentPage: number;
  totalPages: number;
  stats: TrailHistoryStats;
}

export interface TrailHistoryExport {
  format: 'csv' | 'excel' | 'json';
  data: TrailHistoryEntry[];
  stats: TrailHistoryStats;
  filters: TrailHistoryFilters;
  exportedAt: Date;
}