// 共通型定義のメインエクスポート

export * from './trading.js';
export * from './monitoring.js';
export * from './risk-management.js';
export * from './common.js';
export * from './validation.js';

// 再エクスポート用の型定義統合
export type {
  Position,
  TradeCommand,
  TrailSettings,
  HedgeSettings,
  HedgeGroup,
  TradeStatus,
  PositionStatus
} from './trading.js';

export type {
  AccountInfo,
  MarketData,
  Alert,
  SystemMetrics,
  ConnectionStatus,
  AlertLevel,
  ConnectionState
} from './monitoring.js';

export type {
  RiskMetrics,
  RiskAlert,
  LossCutSettings,
  BalanceThreshold,
  RiskLevel,
  RiskAction
} from './risk-management.js';

export type {
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  TimeRange,
  WebSocketMessage,
  Currency,
  Symbol,
  EventType
} from './common.js';

// Import types for use in this file
import type { TrailSettings, HedgeSettings } from './trading.js';

// Amplify Generated型との統合
export type AmplifyPosition = {
  id: string;
  account: string;
  symbol: string;
  volume: number;
  openPrice: number;
  currentPrice?: number;
  profit?: number;
  trailSettings?: TrailSettings;
  hedgeSettings?: HedgeSettings;
  createdAt: string;
  updatedAt: string;
  owner?: string;
};

// 型ガード関数追加
export const isValidTrailSettings = (obj: any): obj is TrailSettings => {
  return (
    typeof obj === 'object' &&
    typeof obj.enabled === 'boolean' &&
    ['percentage', 'pip', 'price'].includes(obj.trailType) &&
    typeof obj.trailValue === 'number'
  );
};

export const isValidHedgeSettings = (obj: any): obj is HedgeSettings => {
  return (
    typeof obj === 'object' &&
    ['cross_account', 'single_account', 'correlation_based'].includes(obj.strategy) &&
    typeof obj.ratio === 'number' &&
    Array.isArray(obj.correlationPairs)
  );
};

// Validation schemas exports
export {
  TrailSettingsSchema,
  HedgeSettingsSchema
} from './validation.js';