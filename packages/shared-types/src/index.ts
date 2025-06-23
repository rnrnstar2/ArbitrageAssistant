// 共通型定義のメインエクスポート

export * from './trading.js';
export * from './monitoring.js';
export * from './risk-management.js';
export * from './validation.js';
export * from './position.js';
export * from './strategy.js';
export * from './websocket.js';

// 再エクスポート用の型定義統合
export type {
  TradeCommand,
  TrailSettings,
  HedgeSettings,
  HedgeGroup,
  TradeStatus,
  PriceData,
  MarketConditions,
  EntryParams,
  RiskAssessment,
  TradingRiskMetrics,
  RiskLimits
} from './trading.js';

export type {
  Position,
  CreatePositionInput,
  UpdatePositionInput
} from './position.js';

export { PositionStatus } from './position.js';

export type {
  Strategy,
  EntryStrategy,
  ExitStrategy,
  BaseStrategy,
  LegacyStrategy,
  PositionSpec,
  CreateStrategyInput,
  CreateEntryStrategyInput,
  CreateExitStrategyInput,
  CreateLegacyStrategyInput,
  UpdateStrategyInput,
  StrategyType
} from './strategy.js';

// Common types - specific symbols to avoid conflicts
export type {
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  TimeRange,
  WebSocketMessage,
  Currency,
  EventType
} from './common.js';
export type { Symbol as CommonSymbol } from './common.js';

// Action types
export type {
  Action,
  ActionType
} from './action.js';
export { ActionStatus, Symbol as ActionSymbol } from './action.js';

// WebSocket types
export { WSMessageType } from './websocket.js';
export type {
  WSBaseMessage,
  WSCommand,
  WSEvent,
  WSMessage,
  WSOpenCommand,
  WSCloseCommand,
  WSModifyStopCommand,
  WSPingMessage,
  WSOpenedEvent,
  WSClosedEvent,
  WSErrorEvent,
  WSPriceEvent,
  WSPongMessage,
  WSInfoEvent,
  WSStopModifiedEvent
} from './websocket.js';

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