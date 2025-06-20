// トレール設定の型定義
export interface TrailSettings {
  id: string;
  positionId: string;
  type: 'fixed' | 'percentage' | 'atr';
  trailAmount: number;
  startCondition: {
    type: 'immediate' | 'profit_threshold' | 'price_level';
    value?: number;
  };
  isActive: boolean;
  currentStopLoss: number;
  maxProfit: number;
  lastUpdated: Date;
  createdAt: Date;
  accountId: string;
  symbol: string;
}

// トレール状況の型定義
export interface TrailStatus {
  id: string;
  positionId: string;
  trailSettingsId: string;
  status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentPrice: number;
  currentStopLoss: number;
  highestPrice: number; // buy position用
  lowestPrice: number;  // sell position用
  profitSinceStart: number;
  trailDistance: number;
  lastAdjustment: Date;
  adjustmentCount: number;
  nextCheckTime: Date;
  errorMessage?: string;
}

// トレール履歴の型定義
export interface TrailHistory {
  id: string;
  positionId: string;
  trailSettingsId: string;
  timestamp: Date;
  action: 'created' | 'adjusted' | 'triggered' | 'paused' | 'resumed' | 'cancelled';
  oldStopLoss?: number;
  newStopLoss?: number;
  price: number;
  profit: number;
  reason: string;
  metadata?: Record<string, any>;
}

// トレールプリセットの型定義
export interface TrailPreset {
  id: string;
  name: string;
  description?: string;
  type: 'fixed' | 'percentage' | 'atr';
  trailAmount: number;
  startCondition: {
    type: 'immediate' | 'profit_threshold' | 'price_level';
    value?: number;
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// トレール実行コマンドの型定義
export interface TrailExecutionCommand {
  id: string;
  positionId: string;
  accountId: string;
  commandType: 'start' | 'stop' | 'pause' | 'resume' | 'adjust';
  trailSettings?: TrailSettings;
  newStopLoss?: number;
  timestamp: Date;
  status: 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
}

// トレール計算結果の型定義
export interface TrailCalculationResult {
  shouldAdjust: boolean;
  newStopLoss: number;
  trailDistance: number;
  reason: string;
  confidence: number; // 0-1の信頼度
  metadata: {
    currentPrice: number;
    previousStopLoss: number;
    maxPrice: number;
    minPrice: number;
  };
}

// トレール監視設定の型定義
export interface TrailMonitoringConfig {
  id: string;
  accountIds: string[];
  symbols: string[];
  checkInterval: number; // milliseconds
  priceThreshold: number; // minimum price change to trigger check
  maxConcurrentTasks: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  notifications: {
    onAdjustment: boolean;
    onTrigger: boolean;
    onError: boolean;
  };
}

// トレール統計情報の型定義
export interface TrailStatistics {
  totalTrails: number;
  activeTrails: number;
  completedTrails: number;
  failedTrails: number;
  averageProfit: number;
  totalAdjustments: number;
  successRate: number;
  performanceBySymbol: Record<string, {
    count: number;
    averageProfit: number;
    successRate: number;
  }>;
  performanceByType: Record<string, {
    count: number;
    averageProfit: number;
    successRate: number;
  }>;
}

// エラータイプの定数
export const TRAIL_ERROR_TYPES = {
  CALCULATION_ERROR: 'calculation_error',
  EXECUTION_ERROR: 'execution_error',
  CONNECTION_ERROR: 'connection_error',
  VALIDATION_ERROR: 'validation_error',
  TIMEOUT_ERROR: 'timeout_error',
} as const;

// トレール状態の定数
export const TRAIL_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

// トレールタイプの定数
export const TRAIL_TYPES = {
  FIXED: 'fixed',
  PERCENTAGE: 'percentage',
  ATR: 'atr',
} as const;

// 開始条件タイプの定数
export const START_CONDITION_TYPES = {
  IMMEDIATE: 'immediate',
  PROFIT_THRESHOLD: 'profit_threshold',
  PRICE_LEVEL: 'price_level',
} as const;