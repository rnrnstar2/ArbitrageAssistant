import { Position, Account, EAConnection } from '../types';

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'position' | 'account' | 'connection';
  accountId: string;
  data: any;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  error?: string;
}

export interface SyncBatch {
  id: string;
  operations: SyncOperation[];
  accountId: string;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedCount: number;
  failedCount: number;
}

export interface SyncStats {
  totalOperations: number;
  pendingOperations: number;
  completedOperations: number;
  failedOperations: number;
  averageProcessingTime: number;
  lastSyncTime?: Date;
  syncErrors: SyncError[];
}

export interface SyncError {
  id: string;
  operationId: string;
  accountId: string;
  timestamp: Date;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
}

export interface SyncConfiguration {
  batchSize: number;
  batchInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  enableConflictResolution: boolean;
  enableOptimisticUpdates: boolean;
  syncMode: 'realtime' | 'batch' | 'hybrid';
}

export interface ConflictResolution {
  strategy: 'client_wins' | 'server_wins' | 'merge' | 'manual';
  mergeFunction?: (clientData: any, serverData: any) => any;
}

export interface DataChangeset {
  accountId: string;
  positions: {
    added: Position[];
    updated: Position[];
    removed: number[]; // ticket numbers
  };
  account: {
    updated: Partial<Account>;
  };
  connection: {
    updated: Partial<EAConnection>;
  };
  timestamp: Date;
}

export interface SyncState {
  lastSyncTimestamp: Map<string, Date>; // accountId -> timestamp
  pendingOperations: Map<string, SyncOperation[]>; // accountId -> operations
  conflictQueue: ConflictItem[];
}

export interface ConflictItem {
  id: string;
  operationId: string;
  accountId: string;
  clientData: any;
  serverData: any;
  timestamp: Date;
  resolution?: ConflictResolution;
}

export interface GraphQLMutation {
  name: string;
  variables: Record<string, any>;
  operation: string;
}

export interface GraphQLQuery {
  name: string;
  variables: Record<string, any>;
  operation: string;
}

export interface SyncEvent {
  type: 'sync_started' | 'sync_completed' | 'sync_failed' | 'conflict_detected' | 'operation_completed' | 'operation_failed' | 'operation_queued';
  accountId: string;
  operationId?: string;
  timestamp: Date;
  data?: any;
  error?: string;
}

// データバリデーション関連の型定義
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'critical';
  receivedValue?: any;
  expectedType?: string;
  expectedRange?: { min?: number; max?: number };
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  receivedValue?: any;
  suggestedValue?: any;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'type' | 'range' | 'format' | 'custom';
  constraint: any;
  message: string;
  severity: 'error' | 'warning' | 'critical';
}

export interface EADataValidationSchema {
  entity: 'position' | 'account' | 'heartbeat' | 'command_response';
  rules: ValidationRule[];
  strictMode: boolean; // 厳密モード（警告もエラー扱い）
}

export interface ValidationContext {
  accountId: string;
  timestamp: Date;
  messageType: string;
  sequenceNumber?: number;
  version?: string;
}

export interface DataSanitizer {
  sanitize: (data: any, context: ValidationContext) => any;
  normalize: (data: any) => any;
  transform: (data: any, rules: TransformRule[]) => any;
}

export interface TransformRule {
  field: string;
  transformer: 'trim' | 'lowercase' | 'uppercase' | 'number' | 'date' | 'currency' | 'custom';
  config?: any;
}