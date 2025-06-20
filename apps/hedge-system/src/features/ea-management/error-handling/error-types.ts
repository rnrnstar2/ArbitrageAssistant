export interface EAErrorContext {
  accountId: string;
  operationId?: string;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

export interface ErrorDetail {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'connection' | 'command' | 'data' | 'system' | 'validation' | 'timeout' | 'authentication';
  context: EAErrorContext;
  stackTrace?: string;
  metadata?: Record<string, any>;
  retryable: boolean;
  autoRecoverable: boolean;
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  applicableErrors: string[]; // error codes
  priority: number;
  maxAttempts: number;
  delayMs: number;
  exponentialBackoff: boolean;
  execute: (error: ErrorDetail, attempt: number) => Promise<RecoveryResult>;
}

export interface RecoveryResult {
  success: boolean;
  newError?: ErrorDetail;
  shouldRetry: boolean;
  retryDelayMs?: number;
  data?: any;
}

export interface RecoveryAttempt {
  id: string;
  errorId: string;
  strategyName: string;
  attemptNumber: number;
  timestamp: Date;
  result: RecoveryResult;
  duration: number;
}

export interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByAccount: Record<string, number>;
  averageRecoveryTime: number;
  recoverySuccessRate: number;
  recentErrors: ErrorDetail[];
}

export interface AlertConfiguration {
  enabled: boolean;
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  categories: string[];
  rateLimit: {
    maxAlertsPerMinute: number;
    maxAlertsPerHour: number;
  };
  channels: AlertChannel[];
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'console';
  config: Record<string, any>;
  enabled: boolean;
}

export interface ErrorEvent {
  type: 'error_occurred' | 'error_resolved' | 'recovery_started' | 'recovery_completed' | 'recovery_failed';
  error: ErrorDetail;
  recoveryAttempt?: RecoveryAttempt;
  timestamp: Date;
}

// 定義済みエラーコード
export const ERROR_CODES = {
  // 接続エラー
  CONNECTION_LOST: 'EA_CONNECTION_LOST',
  CONNECTION_TIMEOUT: 'EA_CONNECTION_TIMEOUT',
  CONNECTION_REFUSED: 'EA_CONNECTION_REFUSED',
  WEBSOCKET_ERROR: 'EA_WEBSOCKET_ERROR',
  
  // コマンドエラー
  COMMAND_TIMEOUT: 'EA_COMMAND_TIMEOUT',
  COMMAND_REJECTED: 'EA_COMMAND_REJECTED',
  INVALID_COMMAND: 'EA_INVALID_COMMAND',
  COMMAND_EXECUTION_FAILED: 'EA_COMMAND_EXECUTION_FAILED',
  
  // データエラー
  DATA_CORRUPTION: 'EA_DATA_CORRUPTION',
  DATA_VALIDATION_FAILED: 'EA_DATA_VALIDATION_FAILED',
  DATA_SYNC_FAILED: 'EA_DATA_SYNC_FAILED',
  POSITION_MISMATCH: 'EA_POSITION_MISMATCH',
  
  // バリデーション固有エラー
  VALIDATION_REQUIRED_FIELD_MISSING: 'EA_VALIDATION_REQUIRED_FIELD_MISSING',
  VALIDATION_INVALID_TYPE: 'EA_VALIDATION_INVALID_TYPE',
  VALIDATION_VALUE_OUT_OF_RANGE: 'EA_VALIDATION_VALUE_OUT_OF_RANGE',
  VALIDATION_INVALID_FORMAT: 'EA_VALIDATION_INVALID_FORMAT',
  VALIDATION_INVALID_CURRENCY_PAIR: 'EA_VALIDATION_INVALID_CURRENCY_PAIR',
  VALIDATION_INVALID_TIMESTAMP: 'EA_VALIDATION_INVALID_TIMESTAMP',
  VALIDATION_NEGATIVE_VALUE: 'EA_VALIDATION_NEGATIVE_VALUE',
  VALIDATION_ZERO_VOLUME: 'EA_VALIDATION_ZERO_VOLUME',
  VALIDATION_INVALID_TICKET: 'EA_VALIDATION_INVALID_TICKET',
  VALIDATION_CORRUPTED_DATA: 'EA_VALIDATION_CORRUPTED_DATA',
  
  // システムエラー
  SYSTEM_OVERLOAD: 'EA_SYSTEM_OVERLOAD',
  MEMORY_EXCEEDED: 'EA_MEMORY_EXCEEDED',
  RATE_LIMIT_EXCEEDED: 'EA_RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'EA_INTERNAL_ERROR',
  
  // 認証エラー
  AUTH_TOKEN_EXPIRED: 'EA_AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'EA_AUTH_TOKEN_INVALID',
  PERMISSION_DENIED: 'EA_PERMISSION_DENIED',
  
  // MT4/MT5 固有エラー
  MT_TRADE_DISABLED: 'EA_MT_TRADE_DISABLED',
  MT_MARKET_CLOSED: 'EA_MT_MARKET_CLOSED',
  MT_INSUFFICIENT_MARGIN: 'EA_MT_INSUFFICIENT_MARGIN',
  MT_PRICE_CHANGED: 'EA_MT_PRICE_CHANGED',
  MT_OFF_QUOTES: 'EA_MT_OFF_QUOTES',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// エラー重要度の定義
export const ERROR_SEVERITY_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
} as const;

// カテゴリー別の自動回復可能性
export const AUTO_RECOVERABLE_CATEGORIES = [
  'connection',
  'timeout',
  'data',
] as const;

// リトライ可能なエラーコード
export const RETRYABLE_ERROR_CODES = [
  ERROR_CODES.CONNECTION_LOST,
  ERROR_CODES.CONNECTION_TIMEOUT,
  ERROR_CODES.WEBSOCKET_ERROR,
  ERROR_CODES.COMMAND_TIMEOUT,
  ERROR_CODES.DATA_SYNC_FAILED,
  ERROR_CODES.SYSTEM_OVERLOAD,
  ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ERROR_CODES.VALIDATION_INVALID_TIMESTAMP,
  ERROR_CODES.VALIDATION_CORRUPTED_DATA,
] as const;