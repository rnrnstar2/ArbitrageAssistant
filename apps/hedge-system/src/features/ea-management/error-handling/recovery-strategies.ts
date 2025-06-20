import { 
  RecoveryStrategy, 
  ErrorDetail, 
  RecoveryResult, 
  ERROR_CODES 
} from './error-types';

/**
 * 接続再試行戦略
 */
export const connectionRetryStrategy: RecoveryStrategy = {
  name: 'connection_retry',
  description: 'Reconnect to EA with exponential backoff',
  applicableErrors: [
    ERROR_CODES.CONNECTION_LOST,
    ERROR_CODES.CONNECTION_TIMEOUT,
    ERROR_CODES.WEBSOCKET_ERROR,
  ],
  priority: 1,
  maxAttempts: 5,
  delayMs: 1000,
  exponentialBackoff: true,
  async execute(error: ErrorDetail, attempt: number): Promise<RecoveryResult> {
    try {
      // WebSocket再接続の実装
      const connectionManager = getConnectionManager();
      await connectionManager.reconnect(error.context.accountId);
      
      return {
        success: true,
        shouldRetry: false,
        data: { reconnected: true, attempt },
      };
    } catch (reconnectError) {
      const shouldRetry = attempt < this.maxAttempts;
      const retryDelayMs = this.exponentialBackoff 
        ? this.delayMs * Math.pow(2, attempt - 1)
        : this.delayMs;
      
      return {
        success: false,
        shouldRetry,
        retryDelayMs,
        newError: {
          ...error,
          message: `Reconnection attempt ${attempt} failed: ${reconnectError}`,
          metadata: {
            ...error.metadata,
            reconnectAttempt: attempt,
            originalError: reconnectError,
          },
        },
      };
    }
  },
};

/**
 * コマンド再送信戦略
 */
export const commandRetryStrategy: RecoveryStrategy = {
  name: 'command_retry',
  description: 'Retry failed command with validation',
  applicableErrors: [
    ERROR_CODES.COMMAND_TIMEOUT,
    ERROR_CODES.COMMAND_EXECUTION_FAILED,
    ERROR_CODES.MT_PRICE_CHANGED,
    ERROR_CODES.MT_OFF_QUOTES,
  ],
  priority: 2,
  maxAttempts: 3,
  delayMs: 2000,
  exponentialBackoff: false,
  async execute(error: ErrorDetail, attempt: number): Promise<RecoveryResult> {
    try {
      const { operationId, accountId } = error.context;
      
      if (!operationId) {
        return {
          success: false,
          shouldRetry: false,
          newError: {
            ...error,
            message: 'Cannot retry command without operation ID',
          },
        };
      }
      
      // コマンドの再実行
      const commandManager = getCommandManager();
      const result = await commandManager.retryCommand(operationId, accountId);
      
      return {
        success: true,
        shouldRetry: false,
        data: { commandResult: result, attempt },
      };
    } catch (retryError) {
      const shouldRetry = attempt < this.maxAttempts;
      
      return {
        success: false,
        shouldRetry,
        retryDelayMs: this.delayMs,
        newError: {
          ...error,
          message: `Command retry attempt ${attempt} failed: ${retryError}`,
          metadata: {
            ...error.metadata,
            retryAttempt: attempt,
            originalError: retryError,
          },
        },
      };
    }
  },
};

/**
 * データ同期修復戦略
 */
export const dataSyncRepairStrategy: RecoveryStrategy = {
  name: 'data_sync_repair',
  description: 'Repair data synchronization issues',
  applicableErrors: [
    ERROR_CODES.DATA_SYNC_FAILED,
    ERROR_CODES.POSITION_MISMATCH,
    ERROR_CODES.DATA_CORRUPTION,
  ],
  priority: 3,
  maxAttempts: 2,
  delayMs: 5000,
  exponentialBackoff: false,
  async execute(error: ErrorDetail, attempt: number): Promise<RecoveryResult> {
    try {
      const { accountId } = error.context;
      
      // データ同期の修復
      const syncManager = getDataSyncManager();
      
      // 1. サーバーから最新データを取得
      const serverData = await syncManager.fetchServerData(accountId);
      
      // 2. ローカルデータと比較
      const localData = await syncManager.getLocalData(accountId);
      
      // 3. 差分を検出して修復
      const conflicts = syncManager.detectConflicts(localData, serverData);
      
      if (conflicts.length > 0) {
        // 自動解決可能なコンフリクトを処理
        const autoResolved = await syncManager.autoResolveConflicts(conflicts);
        
        if (autoResolved < conflicts.length) {
          // 手動解決が必要なコンフリクトが残っている
          return {
            success: false,
            shouldRetry: false,
            newError: {
              ...error,
              message: `Data sync partially repaired. ${conflicts.length - autoResolved} conflicts need manual resolution`,
              metadata: {
                ...error.metadata,
                unresolvedConflicts: conflicts.slice(autoResolved),
              },
            },
          };
        }
      }
      
      // 4. 修復されたデータで同期実行
      await syncManager.forceSyncAccount(accountId);
      
      return {
        success: true,
        shouldRetry: false,
        data: { repairedConflicts: conflicts.length, attempt },
      };
    } catch (repairError) {
      const shouldRetry = attempt < this.maxAttempts;
      
      return {
        success: false,
        shouldRetry,
        retryDelayMs: this.delayMs,
        newError: {
          ...error,
          message: `Data sync repair attempt ${attempt} failed: ${repairError}`,
          metadata: {
            ...error.metadata,
            repairAttempt: attempt,
            originalError: repairError,
          },
        },
      };
    }
  },
};

/**
 * 認証トークン更新戦略
 */
export const authTokenRefreshStrategy: RecoveryStrategy = {
  name: 'auth_token_refresh',
  description: 'Refresh expired authentication token',
  applicableErrors: [
    ERROR_CODES.AUTH_TOKEN_EXPIRED,
    ERROR_CODES.AUTH_TOKEN_INVALID,
  ],
  priority: 1,
  maxAttempts: 2,
  delayMs: 1000,
  exponentialBackoff: false,
  async execute(error: ErrorDetail, attempt: number): Promise<RecoveryResult> {
    try {
      const { accountId } = error.context;
      
      // 認証トークンの更新
      const authManager = getAuthManager();
      const newToken = await authManager.refreshToken(accountId);
      
      // 接続マネージャーに新しいトークンを設定
      const connectionManager = getConnectionManager();
      await connectionManager.updateAuthToken(accountId, newToken);
      
      return {
        success: true,
        shouldRetry: false,
        data: { tokenRefreshed: true, attempt },
      };
    } catch (refreshError) {
      const shouldRetry = attempt < this.maxAttempts;
      
      return {
        success: false,
        shouldRetry,
        retryDelayMs: this.delayMs,
        newError: {
          ...error,
          message: `Token refresh attempt ${attempt} failed: ${refreshError}`,
          metadata: {
            ...error.metadata,
            refreshAttempt: attempt,
            originalError: refreshError,
          },
        },
      };
    }
  },
};

/**
 * システムリソース解放戦略
 */
export const resourceCleanupStrategy: RecoveryStrategy = {
  name: 'resource_cleanup',
  description: 'Clean up system resources to resolve overload',
  applicableErrors: [
    ERROR_CODES.SYSTEM_OVERLOAD,
    ERROR_CODES.MEMORY_EXCEEDED,
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ],
  priority: 2,
  maxAttempts: 1,
  delayMs: 10000,
  exponentialBackoff: false,
  async execute(error: ErrorDetail, attempt: number): Promise<RecoveryResult> {
    try {
      const { accountId } = error.context;
      
      // リソースクリーンアップの実行
      const resourceManager = getResourceManager();
      
      // 1. 不要な接続のクリーンアップ
      await resourceManager.cleanupIdleConnections();
      
      // 2. メモリキャッシュのクリア
      await resourceManager.clearCache(accountId);
      
      // 3. 保留中の操作の整理
      await resourceManager.cleanupPendingOperations(accountId);
      
      // 4. ガベージコレクションの強制実行
      if (global.gc) {
        global.gc();
      }
      
      return {
        success: true,
        shouldRetry: false,
        data: { resourcesCleanedUp: true, attempt },
      };
    } catch (cleanupError) {
      return {
        success: false,
        shouldRetry: false,
        newError: {
          ...error,
          message: `Resource cleanup failed: ${cleanupError}`,
          severity: 'critical',
          metadata: {
            ...error.metadata,
            cleanupError,
          },
        },
      };
    }
  },
};

/**
 * 緊急停止戦略
 */
export const emergencyStopStrategy: RecoveryStrategy = {
  name: 'emergency_stop',
  description: 'Emergency stop for critical errors',
  applicableErrors: [
    ERROR_CODES.DATA_CORRUPTION,
    ERROR_CODES.PERMISSION_DENIED,
    ERROR_CODES.INTERNAL_ERROR,
  ],
  priority: 10, // 最高優先度
  maxAttempts: 1,
  delayMs: 0,
  exponentialBackoff: false,
  async execute(error: ErrorDetail, attempt: number): Promise<RecoveryResult> {
    try {
      const { accountId } = error.context;
      
      // 緊急停止の実行
      const emergencyManager = getEmergencyManager();
      await emergencyManager.emergencyStop(accountId, error);
      
      // 管理者に通知
      const alertManager = getAlertManager();
      await alertManager.sendCriticalAlert(error);
      
      return {
        success: true,
        shouldRetry: false,
        data: { emergencyStopExecuted: true, attempt },
      };
    } catch (stopError) {
      return {
        success: false,
        shouldRetry: false,
        newError: {
          ...error,
          message: `Emergency stop failed: ${stopError}`,
          severity: 'critical',
          metadata: {
            ...error.metadata,
            stopError,
          },
        },
      };
    }
  },
};

// 利用可能な回復戦略のリスト
export const RECOVERY_STRATEGIES: RecoveryStrategy[] = [
  connectionRetryStrategy,
  commandRetryStrategy,
  dataSyncRepairStrategy,
  authTokenRefreshStrategy,
  resourceCleanupStrategy,
  emergencyStopStrategy,
];

// 戦略選択のヘルパー関数
export const selectRecoveryStrategies = (error: ErrorDetail): RecoveryStrategy[] => {
  return RECOVERY_STRATEGIES
    .filter(strategy => strategy.applicableErrors.includes(error.code))
    .sort((a, b) => a.priority - b.priority);
};

// モックの実装（実際の実装では適切なサービスクラスを注入）
function getConnectionManager(): any {
  // 実際の実装ではDIコンテナから取得
  return {
    reconnect: async (_accountId: string) => { /* 実装 */ },
    updateAuthToken: async (_accountId: string, _token: string) => { /* 実装 */ },
  };
}

function getCommandManager(): any {
  return {
    retryCommand: async (_operationId: string, _accountId: string) => { /* 実装 */ },
  };
}

function getDataSyncManager(): any {
  return {
    fetchServerData: async (_accountId: string) => { /* 実装 */ },
    getLocalData: async (_accountId: string) => { /* 実装 */ },
    detectConflicts: (_localData: any, _serverData: any) => { /* 実装 */ },
    autoResolveConflicts: async (_conflicts: any[]) => { /* 実装 */ },
    forceSyncAccount: async (_accountId: string) => { /* 実装 */ },
  };
}

function getAuthManager(): any {
  return {
    refreshToken: async (_accountId: string) => { /* 実装 */ },
  };
}

function getResourceManager(): any {
  return {
    cleanupIdleConnections: async () => { /* 実装 */ },
    clearCache: async (_accountId: string) => { /* 実装 */ },
    cleanupPendingOperations: async (_accountId: string) => { /* 実装 */ },
  };
}

function getEmergencyManager(): any {
  return {
    emergencyStop: async (_accountId: string, _error: ErrorDetail) => { /* 実装 */ },
  };
}

function getAlertManager(): any {
  return {
    sendCriticalAlert: async (_error: ErrorDetail) => { /* 実装 */ },
  };
}