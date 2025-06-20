// Base WebSocket message structure
export interface BaseMessage {
  version: string;
  type: MessageType;
  timestamp: number;
  messageId: string;
  accountId: string;
}

// Deprecated: Use BaseMessage instead
export interface WebSocketMessage {
  type: MessageType;
  payload: unknown;
  timestamp: number;
  clientId?: string;
}

// Message types
export type MessageType = 
  | "position_update"
  | "account_update" 
  | "market_data"
  | "losscut_alert"
  | "command"
  | "heartbeat"
  | "auth"
  | "error"
  | "ack"
  | "entry_result"
  | "close_result"
  | "trail_result"
  | "open_position"
  | "close_position"
  | "update_trail"
  | "test_connection"
  | "system_config"
  | "system_control"
  | "diagnostic_request"
  | "auth_token_update"
  | "session_validate"
  | "log_level_change"
  | "cache_clear"
  | "data_sync_request"
  | "request_account_data"
  | "request_position_data"
  | "request_market_data"
  | "request_margin_data"
  | "request_realtime_data";

// EA -> System messages
export interface EAMessage extends BaseMessage {
  type: 'position_update' | 'account_update' | 'market_data' | 'losscut_alert' | 'heartbeat';
  data: PositionUpdateData | AccountInfoData | MarketData | LosscutAlert | HeartbeatData;
}

// System -> EA commands
export interface SystemCommand extends BaseMessage {
  type: 'open_position' | 'close_position' | 'update_trail' | 'test_connection' | 'system_config' | 'system_control' | 'diagnostic_request' | 'auth_token_update' | 'session_validate' | 'log_level_change' | 'cache_clear' | 'data_sync_request' | 'request_account_data' | 'request_position_data' | 'request_market_data' | 'request_margin_data' | 'request_realtime_data';
  commandId: string;
  data: OpenPositionCommand | ClosePositionCommand | UpdateTrailCommand | TestConnectionCommand | SystemConfigCommand | SystemControlCommand | DiagnosticRequestCommand | AuthTokenUpdateCommand | SessionValidateCommand | LogLevelChangeCommand | CacheClearCommand | DataSyncRequestCommand | RequestAccountDataCommand | RequestPositionDataCommand | RequestMarketDataCommand | RequestMarginDataCommand | RequestRealtimeDataCommand;
}

// Authentication messages
export interface AuthMessage extends WebSocketMessage {
  type: "auth";
  payload: {
    clientId: string;
    userId: string;
    authToken: string;
  };
}

// Heartbeat messages
export interface HeartbeatMessage extends WebSocketMessage {
  type: "heartbeat";
  payload: Record<string, never>;
}

// Position update messages (EA → System)
export interface PositionUpdateMessage extends WebSocketMessage {
  type: "position_update";
  payload: {
    accountId: string;
    positions: Position[];
    timestamp: number;
  };
}

// Account update messages (EA → System)
export interface AccountUpdateMessage extends WebSocketMessage {
  type: "account_update";
  payload: {
    accountId: string;
    balance: number;
    equity: number;
    bonusAmount: number;
    marginLevel: number;
    freeMargin: number;
    timestamp: number;
  };
}

// Command messages (System → EA)
export interface CommandMessage extends WebSocketMessage {
  type: "command";
  payload: {
    commandId: string;
    action: CommandAction;
    params: CommandParams;
    targetClientId?: string;
  };
}

// Error messages
export interface ErrorMessage extends WebSocketMessage {
  type: "error";
  payload: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Acknowledgment messages
export interface AckMessage extends WebSocketMessage {
  type: "ack";
  payload: {
    messageId: string;
    success: boolean;
    error?: string;
  };
}

// Entry result messages (EA → System)
export interface EntryResultMessage extends WebSocketMessage {
  type: "entry_result";
  payload: {
    commandId: string;
    success: boolean;
    positionId?: string;
    error?: string;
    executedPrice?: number;
    executedTime?: string;
    accountId: string;
    symbol?: string;
    direction?: 'BUY' | 'SELL';
    lotSize?: number;
  };
}

// Close result messages (EA → System)
export interface CloseResultMessage extends WebSocketMessage {
  type: "close_result";
  payload: {
    commandId: string;
    success: boolean;
    positionId?: string;
    error?: string;
    executedPrice?: number;
    executedTime?: string;
    actualClosedVolume?: number;
    remainingVolume?: number;
    profit?: number;
    accountId: string;
    symbol?: string;
  };
}

// Trail result messages (EA → System)
export interface TrailResultMessage extends WebSocketMessage {
  type: "trail_result";
  payload: {
    commandId: string;
    success: boolean;
    positionId?: string;
    error?: string;
    oldStopLoss?: number;
    newStopLoss?: number;
    executedTime?: string;
    accountId: string;
    symbol?: string;
    ticket?: number;
  };
}

// Entry Command (for trade entry system)
export interface EntryCommand {
  type: 'ENTRY';
  symbol: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  orderType: 'MARKET' | 'LIMIT';
  price?: number;
  accountId: string;
}

// Command actions
export type CommandAction =
  | "open_position"
  | "close_position"
  | "modify_position"
  | "set_trail_stop"
  | "get_account_info"
  | "get_positions"
  | "ping"
  | "entry"
  | "request_account_data"
  | "request_position_data"
  | "request_market_data"
  | "request_margin_data"
  | "request_realtime_data";

// Command parameters
export type CommandParams = 
  | OpenPositionParams
  | ClosePositionParams
  | ModifyPositionParams
  | SetTrailStopParams
  | GetAccountInfoParams
  | GetPositionsParams
  | PingParams
  | EntryCommand
  | RequestAccountDataParams
  | RequestPositionDataParams
  | RequestMarketDataParams
  | RequestMarginDataParams
  | RequestRealtimeDataParams;

// Open position command parameters
export interface OpenPositionParams {
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  price?: number;
  slippage?: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

// Close position command parameters
export interface ClosePositionParams {
  positionId: string;
  lots?: number; // partial close
  price?: number;
  slippage?: number;
}

// Modify position command parameters
export interface ModifyPositionParams {
  positionId: string;
  stopLoss?: number;
  takeProfit?: number;
}

// Set trail stop command parameters
export interface SetTrailStopParams {
  positionId: string;
  trailAmount: number;
  startPrice?: number;
  step?: number;
}

// Get account info command parameters
export interface GetAccountInfoParams {
  [key: string]: never;
}

// Get positions command parameters
export interface GetPositionsParams {
  accountId?: string;
}

// Ping command parameters
export interface PingParams {
  [key: string]: never;
}

// Request account data command parameters
export interface RequestAccountDataParams {
  includeBonus?: boolean;
  includeMarginInfo?: boolean;
  responseFormat?: 'standard' | 'detailed';
}

// Request position data command parameters  
export interface RequestPositionDataParams {
  positionIds?: string[];
  symbols?: string[];
  includeHistory?: boolean;
  responseFormat?: 'standard' | 'detailed';
}

// Request market data command parameters
export interface RequestMarketDataParams {
  symbols: string[];
  includeSpread?: boolean;
  includeVolume?: boolean;
  responseFormat?: 'standard' | 'detailed';
}

// Request margin data command parameters
export interface RequestMarginDataParams {
  includeUsedMargin?: boolean;
  includeFreeMargin?: boolean;
  includeMarginLevel?: boolean;
  responseFormat?: 'standard' | 'detailed';
}

// Request realtime data command parameters
export interface RequestRealtimeDataParams {
  dataTypes: ('account' | 'positions' | 'market' | 'margin')[];
  updateInterval?: number; // seconds
  responseFormat?: 'standard' | 'detailed';
}

// Position data structure
export interface Position {
  id: string;
  accountId: string;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  swapTotal: number;
  commission: number;
  stopLoss?: number;
  takeProfit?: number;
  trailSettings?: TrailSettings;
  closeSettings?: CloseSettings;
  relatedPositionId?: string;
  status: "open" | "pending_close" | "closed";
  openedAt: string;
  closedAt?: string;
  comment?: string;
}

// Trail settings
export interface TrailSettings {
  enabled: boolean;
  trailAmount: number;
  startPrice?: number;
  step?: number;
  currentStopLoss?: number;
}

// Close settings
export interface CloseSettings {
  targetPrice?: number;
  trailSettings?: TrailSettings;
  linkedCloseAction?: {
    positionId: string;
    action: "close" | "trail";
    settings?: TrailSettings;
  };
  scheduledCloseTime?: string;
}

// Account information
export interface AccountInfo {
  accountId: string;
  broker: string;
  accountNumber: string;
  balance: number;
  equity: number;
  bonusAmount: number;
  marginLevel: number;
  freeMargin: number;
  usedMargin: number;
  currency: string;
  leverage: number;
  profit: number;
  credit: number;
  timestamp: number;
}

// Type guards for message types
export function isAuthMessage(message: WebSocketMessage): message is AuthMessage {
  return message.type === "auth";
}

export function isHeartbeatMessage(message: WebSocketMessage): message is HeartbeatMessage {
  return message.type === "heartbeat";
}

export function isPositionUpdateMessage(message: WebSocketMessage): message is PositionUpdateMessage {
  return message.type === "position_update";
}

export function isAccountUpdateMessage(message: WebSocketMessage): message is AccountUpdateMessage {
  return message.type === "account_update";
}

export function isCommandMessage(message: WebSocketMessage): message is CommandMessage {
  return message.type === "command";
}

export function isErrorMessage(message: WebSocketMessage): message is ErrorMessage {
  return message.type === "error";
}

export function isAckMessage(message: WebSocketMessage): message is AckMessage {
  return message.type === "ack";
}

export function isEntryResultMessage(message: WebSocketMessage): message is EntryResultMessage {
  return message.type === "entry_result";
}

export function isCloseResultMessage(message: WebSocketMessage): message is CloseResultMessage {
  return message.type === "close_result";
}

export function isTrailResultMessage(message: WebSocketMessage): message is TrailResultMessage {
  return message.type === "trail_result";
}

// New type guards for enhanced message types
export function isEAMessage(message: BaseMessage): message is EAMessage {
  return ['position_update', 'account_update', 'market_data', 'losscut_alert', 'heartbeat'].includes(message.type);
}

export function isSystemCommand(message: BaseMessage): message is SystemCommand {
  return ['open_position', 'close_position', 'update_trail', 'test_connection', 'system_config'].includes(message.type);
}

export function isMarketDataMessage(message: BaseMessage): message is EAMessage & { type: 'market_data' } {
  return message.type === 'market_data';
}

export function isLosscutAlertMessage(message: BaseMessage): message is EAMessage & { type: 'losscut_alert' } {
  return message.type === 'losscut_alert';
}

export function isOpenPositionCommand(message: BaseMessage): message is SystemCommand & { type: 'open_position' } {
  return message.type === 'open_position';
}

export function isClosePositionCommand(message: BaseMessage): message is SystemCommand & { type: 'close_position' } {
  return message.type === 'close_position';
}

export function isUpdateTrailCommand(message: BaseMessage): message is SystemCommand & { type: 'update_trail' } {
  return message.type === 'update_trail';
}

export function isTestConnectionCommand(message: BaseMessage): message is SystemCommand & { type: 'test_connection' } {
  return message.type === 'test_connection';
}

export function isSystemConfigCommand(message: BaseMessage): message is SystemCommand & { type: 'system_config' } {
  return message.type === 'system_config';
}

// === SYSTEM MANAGEMENT COMMAND TYPE GUARDS ===

export function isSystemControlCommand(message: BaseMessage): message is SystemCommand & { type: 'system_control' } {
  return message.type === 'system_control';
}

export function isDiagnosticRequestCommand(message: BaseMessage): message is SystemCommand & { type: 'diagnostic_request' } {
  return message.type === 'diagnostic_request';
}

export function isAuthTokenUpdateCommand(message: BaseMessage): message is SystemCommand & { type: 'auth_token_update' } {
  return message.type === 'auth_token_update';
}

export function isSessionValidateCommand(message: BaseMessage): message is SystemCommand & { type: 'session_validate' } {
  return message.type === 'session_validate';
}

export function isLogLevelChangeCommand(message: BaseMessage): message is SystemCommand & { type: 'log_level_change' } {
  return message.type === 'log_level_change';
}

export function isCacheClearCommand(message: BaseMessage): message is SystemCommand & { type: 'cache_clear' } {
  return message.type === 'cache_clear';
}

export function isDataSyncRequestCommand(message: BaseMessage): message is SystemCommand & { type: 'data_sync_request' } {
  return message.type === 'data_sync_request';
}

// === DATA REQUEST COMMAND TYPE GUARDS ===

export function isRequestAccountDataCommand(message: BaseMessage): message is SystemCommand & { type: 'request_account_data' } {
  return message.type === 'request_account_data';
}

export function isRequestPositionDataCommand(message: BaseMessage): message is SystemCommand & { type: 'request_position_data' } {
  return message.type === 'request_position_data';
}

export function isRequestMarketDataCommand(message: BaseMessage): message is SystemCommand & { type: 'request_market_data' } {
  return message.type === 'request_market_data';
}

export function isRequestMarginDataCommand(message: BaseMessage): message is SystemCommand & { type: 'request_margin_data' } {
  return message.type === 'request_margin_data';
}

export function isRequestRealtimeDataCommand(message: BaseMessage): message is SystemCommand & { type: 'request_realtime_data' } {
  return message.type === 'request_realtime_data';
}

// Message validation helpers
export function validateMessage(message: any): message is WebSocketMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    typeof message.type === "string" &&
    typeof message.timestamp === "number" &&
    message.payload !== undefined
  );
}

export function validateBaseMessage(message: any): message is BaseMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    typeof message.version === "string" &&
    typeof message.type === "string" &&
    typeof message.timestamp === "number" &&
    typeof message.messageId === "string" &&
    typeof message.accountId === "string"
  );
}

// Zod-based validation functions
export function validateEAMessage(message: any): message is EAMessage {
  try {
    EAMessageSchema.parse(message);
    return true;
  } catch {
    return false;
  }
}

export function validateSystemCommand(message: any): message is SystemCommand {
  try {
    SystemCommandSchema.parse(message);
    return true;
  } catch {
    return false;
  }
}

export function parseEAMessage(message: any): EAMessage {
  return EAMessageSchema.parse(message);
}

export function parseSystemCommand(message: any): SystemCommand {
  return SystemCommandSchema.parse(message);
}

// Safe parsing functions (returns result with error handling)
export function safeParseEAMessage(message: any): { success: true; data: EAMessage } | { success: false; error: string } {
  const result = EAMessageSchema.safeParse(message);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error.message };
  }
}

export function safeParseSystemCommand(message: any): { success: true; data: SystemCommand } | { success: false; error: string } {
  const result = SystemCommandSchema.safeParse(message);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error.message };
  }
}

// Constants
export const MESSAGE_TYPES = {
  POSITION_UPDATE: "position_update" as const,
  ACCOUNT_UPDATE: "account_update" as const,
  MARKET_DATA: "market_data" as const,
  LOSSCUT_ALERT: "losscut_alert" as const,
  COMMAND: "command" as const,
  HEARTBEAT: "heartbeat" as const,
  AUTH: "auth" as const,
  ERROR: "error" as const,
  ACK: "ack" as const,
  ENTRY_RESULT: "entry_result" as const,
  CLOSE_RESULT: "close_result" as const,
  TRAIL_RESULT: "trail_result" as const,
};

export const COMMAND_ACTIONS = {
  OPEN_POSITION: "open_position" as const,
  CLOSE_POSITION: "close_position" as const,
  MODIFY_POSITION: "modify_position" as const,
  SET_TRAIL_STOP: "set_trail_stop" as const,
  UPDATE_TRAIL: "update_trail" as const,
  TEST_CONNECTION: "test_connection" as const,
  SYSTEM_CONFIG: "system_config" as const,
  GET_ACCOUNT_INFO: "get_account_info" as const,
  GET_POSITIONS: "get_positions" as const,
  PING: "ping" as const,
  ENTRY: "entry" as const,
  REQUEST_ACCOUNT_DATA: "request_account_data" as const,
  REQUEST_POSITION_DATA: "request_position_data" as const,
  REQUEST_MARKET_DATA: "request_market_data" as const,
  REQUEST_MARGIN_DATA: "request_margin_data" as const,
  REQUEST_REALTIME_DATA: "request_realtime_data" as const,
};

// ===== VALIDATION SCHEMAS =====
import { z } from 'zod';

// Base message schema
export const BaseMessageSchema = z.object({
  version: z.string(),
  type: z.string(),
  timestamp: z.number(),
  messageId: z.string(),
  accountId: z.string(),
});

// EA -> System data schemas
export const PositionUpdateDataSchema = z.object({
  positionId: z.string(),
  symbol: z.string(),
  type: z.enum(['buy', 'sell']),
  lots: z.number().positive(),
  openPrice: z.number().positive(),
  currentPrice: z.number().positive(),
  profit: z.number(),
  swapPoints: z.number(),
  commission: z.number(),
  status: z.enum(['open', 'closed', 'pending']),
  openTime: z.date(),
  closeTime: z.date().optional(),
});

export const AccountInfoDataSchema = z.object({
  balance: z.number(),
  equity: z.number(),
  freeMargin: z.number(),
  marginLevel: z.number().min(0),
  bonusAmount: z.number().min(0),
  profit: z.number(),
  credit: z.number(),
  marginUsed: z.number().min(0),
  currency: z.string(),
});

export const MarketDataSchema = z.object({
  symbol: z.string(),
  bid: z.number().positive(),
  ask: z.number().positive(),
  spread: z.number().min(0),
  marketStatus: z.enum(['open', 'closed', 'weekend']),
  lastUpdated: z.date(),
});

export const LosscutAlertSchema = z.object({
  alertType: z.enum(['warning', 'critical', 'executed']),
  marginLevel: z.number().min(0),
  thresholdLevel: z.number().min(0),
  affectedPositions: z.array(z.string()),
  estimatedLoss: z.number(),
  message: z.string(),
});

export const HeartbeatDataSchema = z.object({
  status: z.literal('ok'),
  connectionQuality: z.number().min(0).max(100).optional(),
  lastActivity: z.date().optional(),
});

// System -> EA command schemas
export const OpenPositionCommandSchema = z.object({
  symbol: z.string(),
  type: z.enum(['buy', 'sell']),
  lots: z.number().positive(),
  price: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  comment: z.string().optional(),
});

export const ClosePositionCommandSchema = z.object({
  positionId: z.string(),
  lots: z.number().positive().optional(),
  price: z.number().positive().optional(),
  slippage: z.number().min(0).optional(),
});

export const UpdateTrailCommandSchema = z.object({
  positionId: z.string(),
  trailAmount: z.number().positive(),
  startPrice: z.number().positive().optional(),
  step: z.number().positive().optional(),
});

export const TestConnectionCommandSchema = z.object({
  testType: z.enum(['ping', 'echo', 'full']),
  payload: z.string().optional(),
});

export const SystemConfigCommandSchema = z.object({
  configType: z.enum(['heartbeat_interval', 'data_frequency', 'reconnect_settings']),
  settings: z.record(z.any()),
});

// === SYSTEM MANAGEMENT COMMAND SCHEMAS ===

export const SystemControlCommandSchema = z.object({
  action: z.enum(['start', 'stop', 'restart', 'pause', 'resume']),
  reason: z.string().optional(),
  delay: z.number().min(0).optional(),
});

export const DiagnosticRequestCommandSchema = z.object({
  requestType: z.enum(['performance', 'memory', 'logs', 'connection', 'health']),
  period: z.number().min(1).optional(),
  detailLevel: z.enum(['basic', 'detailed', 'verbose']).optional(),
});

export const AuthTokenUpdateCommandSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.date(),
  permissions: z.array(z.string()).optional(),
});

export const SessionValidateCommandSchema = z.object({
  sessionId: z.string().optional(),
  includePermissions: z.boolean(),
});

export const LogLevelChangeCommandSchema = z.object({
  level: z.enum(['debug', 'info', 'warning', 'error']),
  components: z.array(z.string()).optional(),
});

export const CacheClearCommandSchema = z.object({
  cacheType: z.enum(['positions', 'account', 'market_data', 'all']),
  olderThan: z.date().optional(),
});

export const DataSyncRequestCommandSchema = z.object({
  syncType: z.enum(['positions', 'account', 'history', 'all']),
  since: z.date().optional(),
  forceRefresh: z.boolean(),
});

// Data request command schemas
export const RequestAccountDataCommandSchema = z.object({
  includeBonus: z.boolean().optional(),
  includeMarginInfo: z.boolean().optional(),
  responseFormat: z.enum(['standard', 'detailed']).optional(),
});

export const RequestPositionDataCommandSchema = z.object({
  positionIds: z.array(z.string()).optional(),
  symbols: z.array(z.string()).optional(),
  includeHistory: z.boolean().optional(),
  responseFormat: z.enum(['standard', 'detailed']).optional(),
});

export const RequestMarketDataCommandSchema = z.object({
  symbols: z.array(z.string()),
  includeSpread: z.boolean().optional(),
  includeVolume: z.boolean().optional(),
  responseFormat: z.enum(['standard', 'detailed']).optional(),
});

export const RequestMarginDataCommandSchema = z.object({
  includeUsedMargin: z.boolean().optional(),
  includeFreeMargin: z.boolean().optional(),
  includeMarginLevel: z.boolean().optional(),
  responseFormat: z.enum(['standard', 'detailed']).optional(),
});

export const RequestRealtimeDataCommandSchema = z.object({
  dataTypes: z.array(z.enum(['account', 'positions', 'market', 'margin'])),
  updateInterval: z.number().min(1).optional(),
  responseFormat: z.enum(['standard', 'detailed']).optional(),
});

// Composite message schemas
export const EAMessageSchema = BaseMessageSchema.extend({
  type: z.enum(['position_update', 'account_update', 'market_data', 'losscut_alert', 'heartbeat']),
  data: z.union([
    PositionUpdateDataSchema,
    AccountInfoDataSchema,
    MarketDataSchema,
    LosscutAlertSchema,
    HeartbeatDataSchema,
  ]),
});

export const SystemCommandSchema = BaseMessageSchema.extend({
  type: z.enum(['open_position', 'close_position', 'update_trail', 'test_connection', 'system_config', 'system_control', 'diagnostic_request', 'auth_token_update', 'session_validate', 'log_level_change', 'cache_clear', 'data_sync_request', 'request_account_data', 'request_position_data', 'request_market_data', 'request_margin_data', 'request_realtime_data']),
  commandId: z.string(),
  data: z.union([
    OpenPositionCommandSchema,
    ClosePositionCommandSchema,
    UpdateTrailCommandSchema,
    TestConnectionCommandSchema,
    SystemConfigCommandSchema,
    SystemControlCommandSchema,
    DiagnosticRequestCommandSchema,
    AuthTokenUpdateCommandSchema,
    SessionValidateCommandSchema,
    LogLevelChangeCommandSchema,
    CacheClearCommandSchema,
    DataSyncRequestCommandSchema,
    RequestAccountDataCommandSchema,
    RequestPositionDataCommandSchema,
    RequestMarketDataCommandSchema,
    RequestMarginDataCommandSchema,
    RequestRealtimeDataCommandSchema,
  ]),
});

// ===== NEW MESSAGE DATA TYPES =====

// EA -> System data types
export interface PositionUpdateData {
  positionId: string;
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  swapPoints: number;
  commission: number;
  status: 'open' | 'closed' | 'pending';
  openTime: Date;
  closeTime?: Date;
}

export interface AccountInfoData {
  balance: number;
  equity: number;
  freeMargin: number;
  marginLevel: number;
  bonusAmount: number;
  profit: number;
  credit: number;
  marginUsed: number;
  currency: string;
}

export interface MarketData {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  marketStatus: 'open' | 'closed' | 'weekend';
  lastUpdated: Date;
}

export interface LosscutAlert {
  alertType: 'warning' | 'critical' | 'executed';
  marginLevel: number;
  thresholdLevel: number;
  affectedPositions: string[];
  estimatedLoss: number;
  message: string;
}

export interface HeartbeatData {
  status: 'ok';
  connectionQuality?: number; // 0-100
  lastActivity?: Date;
}

// System -> EA command types
export interface OpenPositionCommand {
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  price?: number; // for limit orders
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface ClosePositionCommand {
  positionId: string;
  lots?: number; // for partial close
  price?: number;
  slippage?: number;
}

export interface UpdateTrailCommand {
  positionId: string;
  trailAmount: number;
  startPrice?: number;
  step?: number;
}

export interface TestConnectionCommand {
  testType: 'ping' | 'echo' | 'full';
  payload?: string;
}

export interface SystemConfigCommand {
  configType: 'heartbeat_interval' | 'data_frequency' | 'reconnect_settings';
  settings: Record<string, any>;
}

// === SYSTEM MANAGEMENT COMMAND TYPES ===

export interface SystemControlCommand {
  action: 'start' | 'stop' | 'restart' | 'pause' | 'resume';
  reason?: string;
  delay?: number; // seconds
}

export interface DiagnosticRequestCommand {
  requestType: 'performance' | 'memory' | 'logs' | 'connection' | 'health';
  period?: number; // minutes
  detailLevel?: 'basic' | 'detailed' | 'verbose';
}

export interface AuthTokenUpdateCommand {
  token: string;
  expiresAt: Date;
  permissions?: string[];
}

export interface SessionValidateCommand {
  sessionId?: string;
  includePermissions: boolean;
}

export interface LogLevelChangeCommand {
  level: 'debug' | 'info' | 'warning' | 'error';
  components?: string[]; // specific components, or all if undefined
}

export interface CacheClearCommand {
  cacheType: 'positions' | 'account' | 'market_data' | 'all';
  olderThan?: Date;
}

export interface DataSyncRequestCommand {
  syncType: 'positions' | 'account' | 'history' | 'all';
  since?: Date;
  forceRefresh: boolean;
}

// === DATA REQUEST COMMAND TYPES ===

export interface RequestAccountDataCommand {
  includeBonus?: boolean;
  includeMarginInfo?: boolean;
  responseFormat?: 'standard' | 'detailed';
}

export interface RequestPositionDataCommand {
  positionIds?: string[];
  symbols?: string[];
  includeHistory?: boolean;
  responseFormat?: 'standard' | 'detailed';
}

export interface RequestMarketDataCommand {
  symbols: string[];
  includeSpread?: boolean;
  includeVolume?: boolean;
  responseFormat?: 'standard' | 'detailed';
}

export interface RequestMarginDataCommand {
  includeUsedMargin?: boolean;
  includeFreeMargin?: boolean;
  includeMarginLevel?: boolean;
  responseFormat?: 'standard' | 'detailed';
}

export interface RequestRealtimeDataCommand {
  dataTypes: ('account' | 'positions' | 'market' | 'margin')[];
  updateInterval?: number; // seconds
  responseFormat?: 'standard' | 'detailed';
}

// ===== MESSAGE FACTORY FUNCTIONS =====

/**
 * Create a unique message ID
 */
export function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create EA message with proper structure
 */
export function createEAMessage<T extends EAMessage['type']>(
  type: T,
  accountId: string,
  data: EAMessage['data'],
  version: string = '1.0'
): EAMessage {
  return {
    version,
    type,
    timestamp: Date.now(),
    messageId: createMessageId(),
    accountId,
    data,
  };
}

/**
 * Create System command with proper structure
 */
export function createSystemCommand<T extends SystemCommand['type']>(
  type: T,
  accountId: string,
  data: SystemCommand['data'],
  version: string = '1.0'
): SystemCommand {
  return {
    version,
    type,
    timestamp: Date.now(),
    messageId: createMessageId(),
    accountId,
    commandId: createMessageId(),
    data,
  };
}

/**
 * Create position update message
 */
export function createPositionUpdateMessage(
  accountId: string,
  positionData: PositionUpdateData
): EAMessage {
  return createEAMessage('position_update', accountId, positionData);
}

/**
 * Create account info message
 */
export function createAccountInfoMessage(
  accountId: string,
  accountData: AccountInfoData
): EAMessage {
  return createEAMessage('account_update', accountId, accountData);
}

/**
 * Create market data message
 */
export function createMarketDataMessage(
  accountId: string,
  marketData: MarketData
): EAMessage {
  return createEAMessage('market_data', accountId, marketData);
}

/**
 * Create losscut alert message
 */
export function createLosscutAlertMessage(
  accountId: string,
  alertData: LosscutAlert
): EAMessage {
  return createEAMessage('losscut_alert', accountId, alertData);
}

/**
 * Create heartbeat message
 */
export function createHeartbeatMessage(
  accountId: string,
  heartbeatData: HeartbeatData = { status: 'ok' }
): EAMessage {
  return createEAMessage('heartbeat', accountId, heartbeatData);
}

/**
 * Create open position command
 */
export function createOpenPositionCommand(
  accountId: string,
  commandData: OpenPositionCommand
): SystemCommand {
  return createSystemCommand('open_position', accountId, commandData);
}

/**
 * Create close position command
 */
export function createClosePositionCommand(
  accountId: string,
  commandData: ClosePositionCommand
): SystemCommand {
  return createSystemCommand('close_position', accountId, commandData);
}

/**
 * Create update trail command
 */
export function createUpdateTrailCommand(
  accountId: string,
  commandData: UpdateTrailCommand
): SystemCommand {
  return createSystemCommand('update_trail', accountId, commandData);
}

/**
 * Create test connection command
 */
export function createTestConnectionCommand(
  accountId: string,
  commandData: TestConnectionCommand
): SystemCommand {
  return createSystemCommand('test_connection', accountId, commandData);
}

/**
 * Create system config command
 */
export function createSystemConfigCommand(
  accountId: string,
  commandData: SystemConfigCommand
): SystemCommand {
  return createSystemCommand('system_config', accountId, commandData);
}

/**
 * Create request account data command
 */
export function createRequestAccountDataCommand(
  accountId: string,
  commandData: RequestAccountDataCommand
): SystemCommand {
  return createSystemCommand('request_account_data', accountId, commandData);
}

/**
 * Create request position data command
 */
export function createRequestPositionDataCommand(
  accountId: string,
  commandData: RequestPositionDataCommand
): SystemCommand {
  return createSystemCommand('request_position_data', accountId, commandData);
}

/**
 * Create request market data command
 */
export function createRequestMarketDataCommand(
  accountId: string,
  commandData: RequestMarketDataCommand
): SystemCommand {
  return createSystemCommand('request_market_data', accountId, commandData);
}

/**
 * Create request margin data command
 */
export function createRequestMarginDataCommand(
  accountId: string,
  commandData: RequestMarginDataCommand
): SystemCommand {
  return createSystemCommand('request_margin_data', accountId, commandData);
}

/**
 * Create request realtime data command
 */
export function createRequestRealtimeDataCommand(
  accountId: string,
  commandData: RequestRealtimeDataCommand
): SystemCommand {
  return createSystemCommand('request_realtime_data', accountId, commandData);
}