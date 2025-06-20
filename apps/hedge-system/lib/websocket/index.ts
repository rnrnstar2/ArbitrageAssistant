// WebSocket Client exports
export { 
  WebSocketClient,
  type WebSocketConnectionOptions,
  type WebSocketConnectionState,
  type WebSocketEventType,
  type WebSocketEventHandler
} from "./websocket-client";

// Heartbeat Manager exports
export {
  HeartbeatManager,
  type HeartbeatConfig,
  type HeartbeatData as HeartbeatManagerData,
  type HeartbeatStats,
  type HeartbeatEventType,
  type HeartbeatEventHandler
} from "./heartbeat-manager";

// Quality Monitor exports
export {
  QualityMonitor,
  type QualityConfig,
  type QualityMetrics,
  type QualityReport,
  type MessageStats,
  type QualityEventType,
  type QualityEventHandler
} from "./quality-monitor";

// WebSocket Connection Manager exports
export {
  WebSocketConnectionManager,
  connectionManager,
  type ConnectionConfig,
  type ConnectionState,
  type ConnectionQualityMetrics,
  type ConnectionPoolEntry
} from "./connection-manager";

// WebSocket Provider exports
export { 
  WebSocketProvider,
  useWebSocket,
  useWebSocketCommands,
  type WebSocketContextType
} from "./websocket-provider";

// Account Info Receiver exports
export {
  AccountInfoReceiver,
  accountInfoReceiver,
  type AccountInfoReceiverConfig,
  type AccountInfoStats,
  type AccountInfoError
} from "./account-info-receiver";

// Position Data Receiver exports
export {
  PositionDataReceiver,
  positionDataReceiver,
  type PositionReceiverConfig,
  type PositionStats,
  type SystemPosition,
  type PositionError
} from "./position-receiver";

// Position Manager exports
export {
  PositionManager,
  positionManager,
  type PositionManagerConfig,
  type PositionConflict,
  type PositionManagerStats,
  type SyncResult
} from "../position/position-manager";

// Data Synchronization exports
export {
  DataBuffer,
  type DataType,
  type DataItem,
  type BufferStatus,
  type DataBufferConfig
} from "./data-buffer";

export {
  SequenceManager,
  type SequenceValidationResult,
  type SequenceGap,
  type MissingDataRequest,
  type SequenceState,
  type SequenceManagerConfig
} from "./sequence-manager";

export {
  SyncQualityMonitor,
  type SyncMetrics,
  type SyncResult,
  type QualityReport,
  type QualityAlert,
  type QualityThresholds,
  type SyncQualityMonitorConfig
} from "./sync-quality-monitor";

export {
  DataSynchronizerImpl as DataSynchronizer,
  dataSynchronizer,
  type DataSynchronizer as IDataSynchronizer,
  type SyncStatus,
  type DataSynchronizerConfig,
  type MissingDataHandler,
  type SyncEventHandlers
} from "./data-synchronizer";

// Message types and protocol exports
export {
  type WebSocketMessage,
  type BaseMessage,
  type MessageType,
  type AuthMessage,
  type HeartbeatMessage,
  type PositionUpdateMessage,
  type AccountUpdateMessage,
  type CommandMessage,
  type ErrorMessage,
  type AckMessage,
  type CommandAction,
  type CommandParams,
  type OpenPositionParams,
  type ClosePositionParams,
  type ModifyPositionParams,
  type SetTrailStopParams,
  type GetAccountInfoParams,
  type GetPositionsParams,
  type PingParams,
  type Position,
  type TrailSettings,
  type CloseSettings,
  type AccountInfo,
  type EAMessage,
  type SystemCommand,
  type PositionUpdateData,
  type AccountInfoData,
  type MarketData,
  type LosscutAlert,
  type HeartbeatData,
  type OpenPositionCommand,
  type ClosePositionCommand,
  type UpdateTrailCommand,
  type TestConnectionCommand,
  type SystemConfigCommand,
  MESSAGE_TYPES,
  COMMAND_ACTIONS,
  isAuthMessage,
  isHeartbeatMessage,
  isPositionUpdateMessage,
  isAccountUpdateMessage,
  isCommandMessage,
  isErrorMessage,
  isAckMessage,
  isEAMessage,
  isSystemCommand,
  isMarketDataMessage,
  isLosscutAlertMessage,
  isOpenPositionCommand,
  isClosePositionCommand,
  isUpdateTrailCommand,
  isTestConnectionCommand,
  isSystemConfigCommand,
  isSystemControlCommand,
  isDiagnosticRequestCommand,
  isAuthTokenUpdateCommand,
  isSessionValidateCommand,
  isLogLevelChangeCommand,
  isCacheClearCommand,
  isDataSyncRequestCommand,
  type SystemControlCommand,
  type DiagnosticRequestCommand,
  type AuthTokenUpdateCommand,
  type SessionValidateCommand,
  type LogLevelChangeCommand,
  type CacheClearCommand,
  type DataSyncRequestCommand,
  validateMessage,
  validateBaseMessage,
} from "./message-types";

// Alert System exports - Task 08-07
export {
  AlertSystem,
  createAlertSystem,
  getDefaultAlertSystem,
  AlertDataReceiver,
  AlertManager,
  NotificationManager,
  AlertHistoryManager,
  type AlertSystemConfig,
  type AlertSystemStats,
  type BaseAlert,
  type ProcessedAlert,
  type AlertType,
  type AlertSearchCriteria,
  type AlertConfiguration,
  type NotificationConfig,
  type NotificationResult
} from "./alert-system";

// System Command Sender exports - Task 08-09
export {
  SystemCommandManager,
  type SystemCommandSender,
  type CommandResult,
  type ConnectionTestResult,
  type DiagnosticResult,
  type SessionValidationResult,
  type EAConfig,
  type PerformanceMetrics,
  type HealthCheckResult,
  type ComponentHealth,
  type LogData,
  type LogEntry
} from "./system-command-sender";

// Diagnostic Manager exports - Task 08-09
export {
  WebSocketDiagnosticManager,
  type DiagnosticManager,
  type MemoryMetrics,
  type GCStats,
  type ConnectionMetrics,
  type FullDiagnosticReport
} from "./diagnostic-manager";

// Authentication Manager exports - Task 08-09
export {
  WebSocketAuthenticationManager,
  type AuthenticationManager,
  type AuthConfig,
  type TokenInfo,
  type SessionInfo,
  type AuthEventType,
  type AuthEventHandler
} from "./authentication-manager";

// Logger and Error Handler exports - Task 08-09
export {
  WebSocketLogger,
  WebSocketErrorHandler,
  logger,
  errorHandler,
  createComponentLogger,
  withErrorHandling,
  type LogLevel,
  type LogEntry as LoggerEntry,
  type LoggerConfig,
  type LogFilter,
  type ErrorInfo,
  type ErrorHandler,
  type ErrorStats
} from "./logger";