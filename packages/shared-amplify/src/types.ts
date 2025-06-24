/**
 * 統一型定義 - MVP システム設計書準拠
 * 
 * 設計原則：
 * - Amplify Gen2 Schemaとの型安全性
 * - shared-typesとの統合
 * - MVP設計書v7.0のuserIdベース最適化対応
 */

// Import from shared-types (MVP設計書準拠の統一型定義)
import type {
  User,
  Account,
  Position,
  Action,
  Symbol,
  PositionStatus,
  ActionType,
  ActionStatus,
  ExecutionType,
  UserRole,
  PCStatus,
  CreatePositionInput,
  UpdatePositionInput,
  CreateActionInput,
  UpdateActionInput,
  CreateAccountInput,
  UpdateAccountInput,
  CreateUserInput,
  UpdateUserInput
} from '@repo/shared-types';

// Re-export types
export type {
  User,
  Account,
  Position,
  Action,
  Symbol,
  PositionStatus,
  ActionType,
  ActionStatus,
  ExecutionType,
  UserRole,
  PCStatus,
  CreatePositionInput,
  UpdatePositionInput,
  CreateActionInput,
  UpdateActionInput,
  CreateAccountInput,
  UpdateAccountInput,
  CreateUserInput,
  UpdateUserInput
};

// Enum Values are already defined in shared-types

// AWS Amplify compatibility types
export type Nullable<T> = T | null;

// Input Types are imported from shared-types above

// ===== Extended Types (MVP設計書準拠) =====

/**
 * ポジション作成時の拡張入力型
 * MVPシステム設計書のエントリー実行パターン対応
 */
export interface CreatePositionWithTrailInput extends Omit<CreatePositionInput, 'userId'> {
  trailActions?: Array<{
    accountId: string;
    type: 'ENTRY' | 'CLOSE';
    triggerPositionId?: string;
  }>;
}

/**
 * 両建て分析結果型
 * MVPシステム設計書の両建て管理対応
 */
export interface HedgeAnalysis {
  accountId: string;
  netPositions: Record<'USDJPY' | 'EURUSD' | 'EURGBP' | 'XAUUSD', number>;
  totalPositions: Position[];
  openPositions: Position[];
  trailPositions: Position[];
  creditUtilization: number;
  riskScore: number;
}

/**
 * システム連携状態型
 * MVPシステム設計書の複数システム連携対応
 */
export interface SystemCoordinationState {
  userId: string;
  pcStatus: 'ONLINE' | 'OFFLINE';
  activeActions: any[];
  pendingActions: any[];
  executingActions: any[];
  trailMonitoringPositions: any[];
  lastUpdate: string;
}

/**
 * トレール実行結果型
 * MVPシステム設計書のトレール機能対応
 */
export interface TrailExecutionResult {
  positionId: string;
  triggeredActionIds: string[];
  executionTime: string;
  success: boolean;
  error?: string;
}

/**
 * クレジット活用状況型
 * MVPシステム設計書のボーナスアービトラージ対応
 */
export interface CreditUtilization {
  accountId: string;
  totalBalance: number;
  totalCredit: number;
  totalEquity: number;
  creditRatio: number;
  utilizationRate: number;
  availableCapacity: number;
}

/**
 * GraphQL操作結果型
 */
export interface GraphQLResult<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

/**
 * Subscription コールバック型
 */
export type SubscriptionCallback<T> = (data: T) => void | Promise<void>;

/**
 * フィルター型定義
 */
export interface PositionFilters {
  accountId?: string;
  status?: 'PENDING' | 'OPENING' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'STOPPED' | 'CANCELED';
  symbol?: 'USDJPY' | 'EURUSD' | 'EURGBP' | 'XAUUSD';
  hasTrail?: boolean;
  limit?: number;
}

export interface ActionFilters {
  accountId?: string;
  positionId?: string;
  type?: 'ENTRY' | 'CLOSE';
  status?: 'PENDING' | 'EXECUTING' | 'EXECUTED' | 'FAILED';
  limit?: number;
}

export interface AccountFilters {
  isActive?: boolean;
  limit?: number;
}

/**
 * ページネーション型
 */
export interface PaginationInput {
  limit?: number;
  nextToken?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextToken?: string;
}

// ===== Re-export from shared-types =====
export * from '@repo/shared-types';