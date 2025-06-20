// WebSocket監視機能の型定義

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface ConnectionMetrics {
  connection: {
    status: ConnectionStatus;
    uptime: number; // milliseconds
    totalReconnects: number;
    lastReconnect?: Date;
  };
  messages: {
    sent: number;
    received: number;
    failed: number;
    bytesIn: number;
    bytesOut: number;
    avgMessageSize: number;
  };
  performance: {
    averageLatency: number; // milliseconds
    minLatency: number;
    maxLatency: number;
    throughput: number; // messages per second
    errorRate: number; // percentage
  };
  quality: {
    connectionStability: number; // 0-100
    dataIntegrity: number; // 0-100
    overallScore: number; // 0-100
  };
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  issues: HealthIssue[];
  recommendations: string[];
  lastCheck: Date;
}

export interface HealthIssue {
  id: string;
  type: 'connection' | 'performance' | 'data' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  affectedComponent?: string;
}

export interface MonitoringEvent {
  id: string;
  type: MonitoringEventType;
  timestamp: Date;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export type MonitoringEventType = 
  | 'connection_established'
  | 'connection_lost'
  | 'reconnection_attempt'
  | 'message_sent'
  | 'message_received'
  | 'message_failed'
  | 'latency_spike'
  | 'throughput_drop'
  | 'error_occurred'
  | 'quality_degraded'
  | 'monitoring_stopped';

export interface PerformanceMetrics {
  latency: {
    current: number;
    average: number;
    p95: number;
    p99: number;
  };
  throughput: {
    messagesPerSecond: number;
    bytesPerSecond: number;
  };
  processing: {
    avgProcessingTime: number;
    queueSize: number;
    backpressure: boolean;
  };
}

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  errorsByType: Map<string, number>;
  recentErrors: ErrorEvent[];
  criticalErrors: number;
  timeToRecover: number[];
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  metrics: any;
  actions?: AlertAction[];
}

export type AlertType = 'performance' | 'reliability' | 'connection' | 'data' | 'system';

export interface AlertAction {
  id: string;
  name: string;
  description: string;
  handler: () => Promise<void>;
}

export interface AlertConfig {
  latencyThreshold: number; // milliseconds
  errorRateThreshold: number; // percentage
  connectionStabilityThreshold: number; // percentage
  throughputMinThreshold: number; // messages per second
  enabled: boolean;
  notificationChannels: NotificationChannel[];
}

export type NotificationChannel = 'desktop' | 'email' | 'slack' | 'log';

export interface TimePeriod {
  start: Date;
  end: Date;
}

export interface AggregatedMetrics {
  period: TimePeriod;
  totalMessages: number;
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
  totalErrors: number;
  uptime: number;
  downtime: number;
  qualityScore: number;
}

export interface WebSocketConnection {
  readonly id: string;
  readonly status: ConnectionStatus;
  readonly startTime: number;
  readonly reconnectCount: number;
  readonly lastReconnect?: Date;
  
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  send(data: any): Promise<void>;
  close(): void;
}

export interface MonitoringConfig {
  metricsCollection: {
    interval: number; // milliseconds
    historyRetention: number; // milliseconds
    enabled: boolean;
  };
  alerts: AlertConfig;
  performance: {
    latencyHistorySize: number;
    throughputHistorySize: number;
    performanceCheckInterval: number;
  };
  ui: {
    refreshInterval: number;
    chartDataPoints: number;
    realTimeUpdates: boolean;
  };
}

// WebSocket Monitor Interface
export interface IWebSocketMonitor {
  startMonitoring(connection: WebSocketConnection): void;
  stopMonitoring(): void;
  getMetrics(): ConnectionMetrics;
  getHealthStatus(): HealthStatus;
  exportMetrics(format: 'json' | 'csv'): string;
  getEventHistory(limit?: number): MonitoringEvent[];
  clearHistory(): void;
}

// Metrics Collector Interface
export interface IMetricsCollector {
  collectConnectionMetrics(): ConnectionMetrics;
  collectPerformanceMetrics(): PerformanceMetrics;
  collectErrorMetrics(): ErrorMetrics;
  aggregateMetrics(period: TimePeriod): AggregatedMetrics;
  reset(): void;
}

// Alert Manager Interface
export interface IAlertManager {
  checkAlertConditions(metrics: ConnectionMetrics): Alert[];
  sendAlert(alert: Alert): Promise<void>;
  configureAlerts(config: AlertConfig): void;
  getActiveAlerts(): Alert[];
  clearAlert(alertId: string): void;
}

// Monitoring Dashboard Props
export interface MonitoringDashboardProps {
  metrics?: ConnectionMetrics;
  isMonitoring: boolean;
  onStartMonitoring: () => void;
  onStopMonitoring: () => void;
  config: MonitoringConfig;
}

export interface ConnectionStatusPanelProps {
  metrics?: ConnectionMetrics;
  status: ConnectionStatus;
}

export interface MetricsChartsPanelProps {
  metrics?: ConnectionMetrics;
  historicalData: AggregatedMetrics[];
}

export interface AlertsPanelProps {
  alerts: Alert[];
  onClearAlert: (alertId: string) => void;
}

export interface HistoricalDataPanelProps {
  data: AggregatedMetrics[];
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
}

// Utility types
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface QualityIndicator {
  score: number; // 0-100
  status: 'excellent' | 'good' | 'fair' | 'poor';
  color: string;
  description: string;
}

// Constants
export const MONITORING_CONSTANTS = {
  DEFAULT_METRICS_INTERVAL: 1000, // 1 second
  DEFAULT_HISTORY_RETENTION: 24 * 60 * 60 * 1000, // 24 hours
  DEFAULT_LATENCY_THRESHOLD: 1000, // 1 second
  DEFAULT_ERROR_RATE_THRESHOLD: 5, // 5%
  DEFAULT_STABILITY_THRESHOLD: 95, // 95%
  DEFAULT_THROUGHPUT_THRESHOLD: 1, // 1 message per second
  CHART_MAX_DATA_POINTS: 100,
  ALERT_DEBOUNCE_TIME: 60000, // 1 minute
} as const;

export const QUALITY_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  FAIR: 50,
  POOR: 0,
} as const;

export const ERROR_TYPES = {
  CONNECTION_FAILED: 'connection_failed',
  MESSAGE_SEND_FAILED: 'message_send_failed',
  MESSAGE_RECEIVE_FAILED: 'message_receive_failed',
  TIMEOUT: 'timeout',
  PROTOCOL_ERROR: 'protocol_error',
  AUTHENTICATION_FAILED: 'authentication_failed',
  PARSING_ERROR: 'parsing_error',
  VALIDATION_ERROR: 'validation_error',
} as const;