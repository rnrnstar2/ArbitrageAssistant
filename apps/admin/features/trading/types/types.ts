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

/**
 * エントリー戦略関連の型定義
 */

// ユーザー（簡略化版）
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'client';
  accounts: AccountWithStatus[];
}

// アカウント状態（簡略化版）
export interface AccountWithStatus {
  id: string;
  userId: string;
  broker: string;
  accountNumber: string;
  name: string;
  balance: number;
  credit: number;
  leverage: number;
  status: 'online' | 'offline';
}

// エントリー戦略フォームデータ（簡略化版）
export interface EntryStrategyFormData {
  // ユーザー・アカウント選択
  selectedUserId: string;
  entryAccountId: string;
  
  // 基本設定
  symbol: string;
  direction: "buy" | "sell";
  
  // ロット設定（複数ロット対応）
  lotConfiguration: {
    type: 'single' | 'multiple';
    singleLot: number;
    multipleLots: LotEntry[];
  };
  
  // トレール設定（常に有効）
  trailSettings: {
    startPips: number;
    trailPips: number;
    trailStep: number;
  };
  
  // 両建て設定（拡張版）
  hedgeSettings: {
    enabled: boolean;
    type: 'reverse_entry' | 'existing_position_close' | 'both';
    
    // 逆方向エントリー設定
    reverseEntry?: {
      hedgeAccountId: string;
      hedgeLots: number;
      executionTiming: "immediate" | "delayed";
      delaySeconds?: number;
    };
    
    // 既存ポジション決済設定
    existingPositionClose?: {
      targetAccountId: string;
      positionSelection: 'all_same_direction' | 'all_opposite_direction' | 'specific_positions';
      closeRatio: number; // 0.0-1.0
      executionTiming: "immediate" | "delayed";
      delaySeconds?: number;
      specificPositionIds?: string[]; // specific_positionsの場合のみ
    };
  };
}

// 複数ロット設定
export interface LotEntry {
  id: string;
  lots: number;
  label?: string;
}

// アクションチェーンの各段階の状態
export type ActionStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

// 実行段階の定義
export interface ExecutionStep {
  id: string;
  name: string;
  description: string;
  status: ActionStatus;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  details?: Record<string, any>;
}

// 戦略実行状態（拡張版）
export interface StrategyExecution {
  id: string;
  symbol: string;
  direction: "buy" | "sell";
  lotConfiguration: {
    type: 'single' | 'multiple';
    singleLot?: number;
    multipleLots?: LotEntry[];
  };
  entryAccount: string;
  hedgeAccount?: string;
  hedgeType?: 'reverse_entry' | 'same_direction_close' | 'both';
  status: ActionStatus;
  startTime: Date;
  endTime?: Date;
  currentStepIndex: number;
  steps: ExecutionStep[];
  progress: number; // 0-100
}