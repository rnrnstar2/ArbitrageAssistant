// 型定義のインポート
import type {
  ErrorHandlerConfig,
} from './error-handler';

// クラスのインポート
import {
  EAErrorHandler,
} from './error-handler';

import type {
  ErrorDetail,
  ErrorCode,
  EAErrorContext,
} from './error-types';

// 定数のインポート
import {
  RETRYABLE_ERROR_CODES,
  AUTO_RECOVERABLE_CATEGORIES,
  ERROR_SEVERITY_LEVELS,
} from './error-types';

// 型定義のエクスポート
export type {
  EAErrorContext,
  ErrorDetail,
  RecoveryStrategy,
  RecoveryResult,
  RecoveryAttempt,
  ErrorStatistics,
  AlertConfiguration,
  AlertChannel,
  ErrorEvent,
  ErrorCode,
} from './error-types';

export type {
  ErrorHandlerConfig,
} from './error-handler';

export {
  EAErrorHandler,
} from './error-handler';

// 定数のエクスポート
export {
  ERROR_CODES,
  ERROR_SEVERITY_LEVELS,
  AUTO_RECOVERABLE_CATEGORIES,
  RETRYABLE_ERROR_CODES,
} from './error-types';

// メインクラスのエクスポート - already exported above

// 回復戦略のエクスポート
export {
  RECOVERY_STRATEGIES,
  selectRecoveryStrategies,
  connectionRetryStrategy,
  commandRetryStrategy,
  dataSyncRepairStrategy,
  authTokenRefreshStrategy,
  resourceCleanupStrategy,
  emergencyStopStrategy,
} from './recovery-strategies';

// デフォルト設定
export const DEFAULT_ERROR_HANDLER_CONFIG: ErrorHandlerConfig = {
  enableAutoRecovery: true,
  maxRecoveryAttempts: 3,
  errorRetentionDays: 30,
  enableMetrics: true,
  alertConfig: {
    enabled: true,
    severityThreshold: 'medium',
    categories: ['connection', 'command', 'data', 'system'],
    rateLimit: {
      maxAlertsPerMinute: 5,
      maxAlertsPerHour: 50,
    },
    channels: [
      {
        type: 'console',
        config: {},
        enabled: true,
      },
    ],
  },
};

// ヘルパー関数
export const createErrorHandler = (config?: Partial<ErrorHandlerConfig>) => {
  const finalConfig = {
    ...DEFAULT_ERROR_HANDLER_CONFIG,
    ...config,
    alertConfig: {
      ...DEFAULT_ERROR_HANDLER_CONFIG.alertConfig,
      ...config?.alertConfig,
    },
  };
  return new EAErrorHandler(finalConfig);
};

export const createErrorDetail = (
  code: ErrorCode,
  message: string,
  context: EAErrorContext,
  options?: {
    severity?: ErrorDetail['severity'];
    category?: ErrorDetail['category'];
    metadata?: Record<string, any>;
  }
): Omit<ErrorDetail, 'retryable' | 'autoRecoverable' | 'stackTrace'> => {
  return {
    code,
    message,
    severity: options?.severity || 'medium',
    category: options?.category || 'system',
    context,
    metadata: options?.metadata,
  };
};

export const isRetryableError = (errorCode: string): boolean => {
  return RETRYABLE_ERROR_CODES.includes(errorCode as any);
};

export const isAutoRecoverableError = (category: string): boolean => {
  return AUTO_RECOVERABLE_CATEGORIES.includes(category as any);
};

export const getErrorSeverityLevel = (severity: string): number => {
  return ERROR_SEVERITY_LEVELS[severity.toUpperCase() as keyof typeof ERROR_SEVERITY_LEVELS] || 0;
};

export const formatErrorForDisplay = (error: ErrorDetail): string => {
  return `[${error.severity.toUpperCase()}] ${error.code}: ${error.message} (Account: ${error.context.accountId})`;
};

export const filterErrorsByTimeRange = (
  errors: ErrorDetail[],
  startTime: Date,
  endTime: Date
): ErrorDetail[] => {
  return errors.filter(error => {
    const errorTime = error.context.timestamp;
    return errorTime >= startTime && errorTime <= endTime;
  });
};

export const groupErrorsByCategory = (errors: ErrorDetail[]): Record<string, ErrorDetail[]> => {
  return errors.reduce((groups, error) => {
    const category = error.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(error);
    return groups;
  }, {} as Record<string, ErrorDetail[]>);
};

export const getTopErrors = (errors: ErrorDetail[], limit: number = 10): Array<{
  code: string;
  count: number;
  lastOccurrence: Date;
}> => {
  const errorCounts = errors.reduce((counts, error) => {
    const code = error.code;
    if (!counts[code]) {
      counts[code] = { count: 0, lastOccurrence: error.context.timestamp };
    }
    counts[code].count++;
    if (error.context.timestamp > counts[code].lastOccurrence) {
      counts[code].lastOccurrence = error.context.timestamp;
    }
    return counts;
  }, {} as Record<string, { count: number; lastOccurrence: Date }>);

  return Object.entries(errorCounts)
    .map(([code, data]) => ({ code, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

// イベントタイプの定数
export const ERROR_EVENTS = {
  ERROR_OCCURRED: 'error_occurred',
  ERROR_RESOLVED: 'error_resolved',
  RECOVERY_STARTED: 'recovery_started',
  RECOVERY_COMPLETED: 'recovery_completed',
  RECOVERY_FAILED: 'recovery_failed',
} as const;

// アラートタイプの定数
export const ALERT_CHANNELS = {
  EMAIL: 'email',
  SLACK: 'slack',
  WEBHOOK: 'webhook',
  CONSOLE: 'console',
} as const;