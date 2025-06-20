// 型定義のエクスポート
export type {
  EAConnection,
  Position,
  Account,
  EACommand,
  OpenPositionCommand,
  ClosePositionCommand,
  ModifyPositionCommand,
  SetTrailCommand,
  PositionUpdateData,
  AccountUpdateData,
  HeartbeatData,
  CommandResponse,
  EAMessage,
  EAConnectionStats,
  EAError,
  EASettings,
} from './types';

// メインクラスのエクスポート
export { EAConnectionManager } from './ea-connection-manager';
export { EAManagementService } from './ea-management-service';
export type { EAManagementServiceOptions } from './ea-management-service';

// デフォルト設定
export const DEFAULT_EA_SETTINGS: any = {
  autoReconnect: true,
  reconnectInterval: 5000,
  heartbeatInterval: 30000,
  commandTimeout: 10000,
  maxRetries: 3,
  logLevel: 'info',
  enableMetrics: true,
};

// ヘルパー関数
export const createEAManagementService = (options?: any) => {
  return new ((require('./ea-management-service') as any).EAManagementService)(options);
};

export const isValidAccountId = (accountId: string): boolean => {
  return /^[a-zA-Z0-9_-]+$/.test(accountId) && accountId.length > 0 && accountId.length <= 50;
};

export const formatPositionProfit = (profit: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(profit);
};

export const calculateMarginLevel = (equity: number, margin: number): number => {
  return margin > 0 ? (equity / margin) * 100 : 0;
};

export const getPositionTypeLabel = (type: 'buy' | 'sell'): string => {
  return type === 'buy' ? 'Long' : 'Short';
};

export const formatTimestamp = (timestamp: Date): string => {
  return timestamp.toISOString();
};

export const parseEAMessage = (rawMessage: string): any => {
  try {
    const parsed = JSON.parse(rawMessage);
    
    // 基本的なバリデーション
    if (!parsed.type || !parsed.accountId || !parsed.timestamp) {
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to parse EA message:', error);
    return null;
  }
};

// イベントタイプの定数
export const EA_EVENTS = {
  EA_CONNECTED: 'eaConnected',
  EA_DISCONNECTED: 'eaDisconnected',
  POSITION_UPDATED: 'positionUpdated',
  ACCOUNT_UPDATED: 'accountUpdated',
  COMMAND_COMPLETED: 'commandCompleted',
  COMMAND_FAILED: 'commandFailed',
  EA_ERROR: 'eaError',
  MONITORING_STARTED: 'monitoringStarted',
  MONITORING_STOPPED: 'monitoringStopped',
} as const;

// エラータイプの定数
export const EA_ERROR_TYPES = {
  CONNECTION: 'connection',
  COMMAND: 'command',
  DATA: 'data',
  SYSTEM: 'system',
} as const;

// コマンドタイプの定数
export const EA_COMMAND_TYPES = {
  OPEN_POSITION: 'open_position',
  CLOSE_POSITION: 'close_position',
  MODIFY_POSITION: 'modify_position',
  SET_TRAIL: 'set_trail',
  EMERGENCY_STOP: 'emergency_stop',
} as const;