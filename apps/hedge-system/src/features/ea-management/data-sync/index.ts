// 型定義のインポート
import type {
  SyncConfiguration,
  DataChangeset,
  SyncOperation,
  ConflictItem,
} from './types';

// クラスのインポート
import { DataSyncManager } from './data-sync-manager';

// 型定義のエクスポート
export type {
  SyncOperation,
  SyncBatch,
  SyncStats,
  SyncError,
  SyncConfiguration,
  DataChangeset,
  SyncState,
  ConflictItem,
  SyncEvent,
  ConflictResolution,
  GraphQLMutation,
  GraphQLQuery,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationRule,
  EADataValidationSchema,
  ValidationContext,
  DataSanitizer,
  TransformRule,
} from './types';

// メインクラスのエクスポート
export { DataSyncManager } from './data-sync-manager';
export { GraphQLSyncClient, ConflictError } from './graphql-sync';

// バリデーション機能のエクスポート
export {
  EADataValidator,
  defaultValidator,
  validateEAMessage,
  validatePosition,
  VALIDATION_ERROR_CODES,
  VALIDATION_SCHEMAS,
} from './validation';

export {
  ValidationErrorHandler,
  IntegratedValidationService,
  type ValidationErrorStats,
  type FieldValidationReport,
} from './validation-error-handler';

// デフォルト設定
export const DEFAULT_SYNC_CONFIG: SyncConfiguration = {
  batchSize: 10,
  batchInterval: 5000,
  maxRetries: 3,
  retryDelay: 2000,
  enableConflictResolution: true,
  enableOptimisticUpdates: false,
  syncMode: 'hybrid',
};

// ヘルパー関数
export const createDataSyncManager = (
  graphqlEndpoint: string,
  authToken?: string,
  config?: Partial<SyncConfiguration>
) => {
  return new DataSyncManager(graphqlEndpoint, authToken, config);
};

export const createChangeset = (
  accountId: string,
  changes: {
    positionsAdded?: any[];
    positionsUpdated?: any[];
    positionsRemoved?: number[];
    accountUpdated?: any;
    connectionUpdated?: any;
  }
): DataChangeset => {
  return {
    accountId,
    positions: {
      added: changes.positionsAdded || [],
      updated: changes.positionsUpdated || [],
      removed: changes.positionsRemoved || [],
    },
    account: {
      updated: changes.accountUpdated || {},
    },
    connection: {
      updated: changes.connectionUpdated || {},
    },
    timestamp: new Date(),
  };
};

// バリデーション関数
export const validateSyncOperation = (operation: Partial<SyncOperation>): string[] => {
  const errors: string[] = [];
  
  if (!operation.id) {
    errors.push('Operation ID is required');
  }
  
  if (!operation.accountId) {
    errors.push('Account ID is required');
  }
  
  if (!['create', 'update', 'delete'].includes(operation.type as string)) {
    errors.push('Invalid operation type');
  }
  
  if (!['position', 'account', 'connection'].includes(operation.entity as string)) {
    errors.push('Invalid entity type');
  }
  
  if (!operation.data) {
    errors.push('Operation data is required');
  }
  
  return errors;
};

export const isConflictResolvable = (conflict: ConflictItem): boolean => {
  // 基本的な解決可能性チェック
  return conflict.clientData && conflict.serverData && 
         typeof conflict.clientData === 'object' && 
         typeof conflict.serverData === 'object';
};

export const mergePosibookletData = (clientData: any, serverData: any): any => {
  // 簡単なマージ戦略（タイムスタンプベース）
  const clientTimestamp = new Date(clientData.lastUpdated || clientData.timestamp || 0);
  const serverTimestamp = new Date(serverData.lastUpdated || serverData.timestamp || 0);
  
  // 新しいタイムスタンプのデータを優先
  const base = clientTimestamp > serverTimestamp ? clientData : serverData;
  const other = clientTimestamp > serverTimestamp ? serverData : clientData;
  
  // 数値フィールドは新しい値を使用
  const merged = { ...base };
  
  // 特定のフィールドはマージロジックを適用
  if (typeof base.profit === 'number' && typeof other.profit === 'number') {
    merged.profit = base.profit; // 利益は最新の値を使用
  }
  
  if (typeof base.currentPrice === 'number' && typeof other.currentPrice === 'number') {
    merged.currentPrice = base.currentPrice; // 現在価格は最新の値を使用
  }
  
  return merged;
};

// イベントタイプの定数
export const SYNC_EVENTS = {
  SYNC_STARTED: 'sync_started',
  SYNC_COMPLETED: 'sync_completed',
  SYNC_FAILED: 'sync_failed',
  CONFLICT_DETECTED: 'conflict_detected',
  CONFLICT_RESOLVED: 'conflict_resolved',
  OPERATION_COMPLETED: 'operation_completed',
  OPERATION_FAILED: 'operation_failed',
  OPERATION_QUEUED: 'operation_queued',
  MANAGER_STARTED: 'sync_manager_started',
  MANAGER_STOPPED: 'sync_manager_stopped',
} as const;

// 同期モードの定数
export const SYNC_MODES = {
  REALTIME: 'realtime',
  BATCH: 'batch',
  HYBRID: 'hybrid',
} as const;

// コンフリクト解決戦略の定数
export const CONFLICT_STRATEGIES = {
  CLIENT_WINS: 'client_wins',
  SERVER_WINS: 'server_wins',
  MERGE: 'merge',
  MANUAL: 'manual',
} as const;