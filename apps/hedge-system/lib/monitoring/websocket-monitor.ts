import {
  IWebSocketMonitor,
  WebSocketConnection,
  ConnectionMetrics,
  HealthStatus,
  MonitoringEvent,
  MonitoringEventType,
  MonitoringConfig,
  MONITORING_CONSTANTS,
  ConnectionStatus,
  HealthIssue,
} from './types';

export class WebSocketMonitor implements IWebSocketMonitor {
  private connection?: WebSocketConnection;
  private isMonitoring = false;
  private config: MonitoringConfig;
  
  // Metrics tracking
  private connectionStartTime = 0;
  private messagesSent = 0;
  private messagesReceived = 0;
  private messagesFailed = 0;
  private bytesSent = 0;
  private bytesReceived = 0;
  private totalReconnects = 0;
  private lastReconnect?: Date;
  
  // Performance tracking
  private latencyHistory: number[] = [];
  private throughputHistory: number[] = [];
  private errorHistory: MonitoringEvent[] = [];
  private eventHistory: MonitoringEvent[] = [];
  
  // Timers
  private metricsCollectionTimer?: NodeJS.Timeout;
  private performanceCheckTimer?: NodeJS.Timeout;
  
  constructor(config?: Partial<MonitoringConfig>) {
    this.config = this.createDefaultConfig(config);
  }
  
  private createDefaultConfig(config?: Partial<MonitoringConfig>): MonitoringConfig {
    return {
      metricsCollection: {
        interval: config?.metricsCollection?.interval || MONITORING_CONSTANTS.DEFAULT_METRICS_INTERVAL,
        historyRetention: config?.metricsCollection?.historyRetention || MONITORING_CONSTANTS.DEFAULT_HISTORY_RETENTION,
        enabled: config?.metricsCollection?.enabled ?? true,
      },
      alerts: {
        latencyThreshold: config?.alerts?.latencyThreshold || MONITORING_CONSTANTS.DEFAULT_LATENCY_THRESHOLD,
        errorRateThreshold: config?.alerts?.errorRateThreshold || MONITORING_CONSTANTS.DEFAULT_ERROR_RATE_THRESHOLD,
        connectionStabilityThreshold: config?.alerts?.connectionStabilityThreshold || MONITORING_CONSTANTS.DEFAULT_STABILITY_THRESHOLD,
        throughputMinThreshold: config?.alerts?.throughputMinThreshold || MONITORING_CONSTANTS.DEFAULT_THROUGHPUT_THRESHOLD,
        enabled: config?.alerts?.enabled ?? true,
        notificationChannels: config?.alerts?.notificationChannels || ['log'],
      },
      performance: {
        latencyHistorySize: config?.performance?.latencyHistorySize || 100,
        throughputHistorySize: config?.performance?.throughputHistorySize || 100,
        performanceCheckInterval: config?.performance?.performanceCheckInterval || 5000,
      },
      ui: {
        refreshInterval: config?.ui?.refreshInterval || 1000,
        chartDataPoints: config?.ui?.chartDataPoints || MONITORING_CONSTANTS.CHART_MAX_DATA_POINTS,
        realTimeUpdates: config?.ui?.realTimeUpdates ?? true,
      },
    };
  }
  
  startMonitoring(connection: WebSocketConnection): void {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }
    
    this.connection = connection;
    this.isMonitoring = true;
    this.connectionStartTime = Date.now();
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    // 定期的なメトリクス収集の開始
    if (this.config.metricsCollection.enabled) {
      this.startMetricsCollection();
    }
    
    // パフォーマンスチェックの開始
    this.startPerformanceChecks();
    
    this.recordEvent('connection_established', 'info', {
      connectionId: connection.id,
      timestamp: new Date(),
    });
    
    console.log(`WebSocket monitoring started for connection ${connection.id}`);
  }
  
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    // タイマーのクリア
    if (this.metricsCollectionTimer) {
      clearInterval(this.metricsCollectionTimer);
      this.metricsCollectionTimer = undefined;
    }
    
    if (this.performanceCheckTimer) {
      clearInterval(this.performanceCheckTimer);
      this.performanceCheckTimer = undefined;
    }
    
    // イベントリスナーの削除
    this.removeEventListeners();
    
    this.recordEvent('monitoring_stopped', 'info', {
      duration: Date.now() - this.connectionStartTime,
    });
    
    console.log('WebSocket monitoring stopped');
  }
  
  private setupEventListeners(): void {
    if (!this.connection) return;
    
    this.connection.on('message', (data: any) => {
      this.recordMessageReceived(data);
    });
    
    this.connection.on('send', (data: any) => {
      this.recordMessageSent(data);
    });
    
    this.connection.on('error', (error: Error) => {
      this.recordError(error);
    });
    
    this.connection.on('close', () => {
      this.recordDisconnection();
    });
    
    this.connection.on('reconnect', () => {
      this.recordReconnection();
    });
  }
  
  private removeEventListeners(): void {
    if (!this.connection) return;
    
    // 実際の実装では、具体的なイベントリスナーの削除が必要
    // この例では簡略化
  }
  
  private startMetricsCollection(): void {
    this.metricsCollectionTimer = setInterval(() => {
      this.collectMetricsSnapshot();
      this.cleanupOldHistory();
    }, this.config.metricsCollection.interval);
  }
  
  private startPerformanceChecks(): void {
    this.performanceCheckTimer = setInterval(() => {
      this.performPerformanceCheck();
    }, this.config.performance.performanceCheckInterval);
  }
  
  private recordMessageReceived(data: any): void {
    this.messagesReceived++;
    
    const messageSize = this.calculateMessageSize(data);
    this.bytesReceived += messageSize;
    
    // レイテンシの計算（メッセージにタイムスタンプが含まれている場合）
    const latency = this.calculateLatency(data);
    if (latency > 0) {
      this.recordLatency(latency);
    }
    
    this.recordEvent('message_received', 'info', {
      messageSize,
      totalReceived: this.messagesReceived,
    });
  }
  
  private recordMessageSent(data: any): void {
    this.messagesSent++;
    
    const messageSize = this.calculateMessageSize(data);
    this.bytesSent += messageSize;
    
    this.recordEvent('message_sent', 'info', {
      messageSize,
      totalSent: this.messagesSent,
    });
  }
  
  private recordError(error: Error): void {
    this.messagesFailed++;
    
    const errorEvent: MonitoringEvent = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'error_occurred',
      timestamp: new Date(),
      data: {
        error: error.message,
        stack: error.stack,
      },
      severity: 'error',
    };
    
    this.errorHistory.push(errorEvent);
    this.recordEvent('error_occurred', 'error', errorEvent.data);
  }
  
  private recordDisconnection(): void {
    this.recordEvent('connection_lost', 'warning', {
      uptime: Date.now() - this.connectionStartTime,
    });
  }
  
  private recordReconnection(): void {
    this.totalReconnects++;
    this.lastReconnect = new Date();
    
    this.recordEvent('reconnection_attempt', 'info', {
      reconnectCount: this.totalReconnects,
      timestamp: this.lastReconnect,
    });
  }
  
  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    
    // 履歴サイズの制限
    if (this.latencyHistory.length > this.config.performance.latencyHistorySize) {
      this.latencyHistory.shift();
    }
    
    // 異常なレイテンシの検出
    if (latency > this.config.alerts.latencyThreshold) {
      this.recordEvent('latency_spike', 'warning', {
        latency,
        threshold: this.config.alerts.latencyThreshold,
      });
    }
  }
  
  private recordEvent(type: MonitoringEventType, severity: MonitoringEvent['severity'], data: any): void {
    const event: MonitoringEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date(),
      data,
      severity,
    };
    
    this.eventHistory.push(event);
    
    // 履歴サイズの制限
    const maxHistorySize = 1000;
    if (this.eventHistory.length > maxHistorySize) {
      this.eventHistory.shift();
    }
  }
  
  private calculateMessageSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
  
  private calculateLatency(data: any): number {
    try {
      if (data && typeof data.timestamp === 'number') {
        return Date.now() - data.timestamp;
      }
    } catch {
      // エラーは無視
    }
    return 0;
  }
  
  private collectMetricsSnapshot(): void {
    const now = Date.now();
    const throughput = this.calculateThroughput();
    
    this.throughputHistory.push(throughput);
    
    if (this.throughputHistory.length > this.config.performance.throughputHistorySize) {
      this.throughputHistory.shift();
    }
  }
  
  private calculateThroughput(): number {
    const timeWindow = 5000; // 5秒
    const recentEvents = this.eventHistory.filter(
      event => Date.now() - event.timestamp.getTime() < timeWindow
    );
    
    return recentEvents.length / (timeWindow / 1000);
  }
  
  private performPerformanceCheck(): void {
    const metrics = this.getMetrics();
    
    // スループットの低下をチェック
    if (metrics.performance.throughput < this.config.alerts.throughputMinThreshold) {
      this.recordEvent('throughput_drop', 'warning', {
        currentThroughput: metrics.performance.throughput,
        threshold: this.config.alerts.throughputMinThreshold,
      });
    }
    
    // 品質の低下をチェック
    if (metrics.quality.overallScore < 50) {
      this.recordEvent('quality_degraded', 'warning', {
        qualityScore: metrics.quality.overallScore,
      });
    }
  }
  
  private cleanupOldHistory(): void {
    const cutoffTime = Date.now() - this.config.metricsCollection.historyRetention;
    
    this.eventHistory = this.eventHistory.filter(
      event => event.timestamp.getTime() > cutoffTime
    );
    
    this.errorHistory = this.errorHistory.filter(
      event => event.timestamp.getTime() > cutoffTime
    );
  }
  
  getMetrics(): ConnectionMetrics {
    const now = Date.now();
    const uptime = now - this.connectionStartTime;
    
    return {
      connection: {
        status: this.connection?.status || 'disconnected',
        uptime,
        totalReconnects: this.totalReconnects,
        lastReconnect: this.lastReconnect,
      },
      messages: {
        sent: this.messagesSent,
        received: this.messagesReceived,
        failed: this.messagesFailed,
        bytesIn: this.bytesReceived,
        bytesOut: this.bytesSent,
        avgMessageSize: this.calculateAverageMessageSize(),
      },
      performance: {
        averageLatency: this.calculateAverageLatency(),
        minLatency: Math.min(...this.latencyHistory) || 0,
        maxLatency: Math.max(...this.latencyHistory) || 0,
        throughput: this.calculateThroughput(),
        errorRate: this.calculateErrorRate(),
      },
      quality: this.calculateQualityMetrics(),
    };
  }
  
  private calculateAverageMessageSize(): number {
    const totalMessages = this.messagesSent + this.messagesReceived;
    const totalBytes = this.bytesSent + this.bytesReceived;
    
    return totalMessages > 0 ? totalBytes / totalMessages : 0;
  }
  
  private calculateAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0;
    
    const sum = this.latencyHistory.reduce((acc, latency) => acc + latency, 0);
    return sum / this.latencyHistory.length;
  }
  
  private calculateErrorRate(): number {
    const totalMessages = this.messagesSent + this.messagesReceived;
    
    if (totalMessages === 0) return 0;
    
    return (this.messagesFailed / totalMessages) * 100;
  }
  
  private calculateQualityMetrics() {
    const stability = this.calculateConnectionStability();
    const integrity = this.calculateDataIntegrity();
    const overall = (stability * 0.6) + (integrity * 0.4);
    
    return {
      connectionStability: stability,
      dataIntegrity: integrity,
      overallScore: overall,
    };
  }
  
  private calculateConnectionStability(): number {
    const uptime = Date.now() - this.connectionStartTime;
    const maxReconnectsPerHour = 3;
    const hoursUp = uptime / (1000 * 60 * 60);
    
    if (hoursUp < 1) return 100;
    
    const reconnectsPerHour = this.totalReconnects / hoursUp;
    const stability = Math.max(0, 100 - (reconnectsPerHour / maxReconnectsPerHour) * 100);
    
    return Math.round(stability);
  }
  
  private calculateDataIntegrity(): number {
    const errorRate = this.calculateErrorRate();
    const integrity = Math.max(0, 100 - errorRate);
    
    return Math.round(integrity);
  }
  
  getHealthStatus(): HealthStatus {
    const metrics = this.getMetrics();
    const issues: HealthIssue[] = [];
    
    // 接続の問題をチェック
    if (metrics.connection.status !== 'connected') {
      issues.push({
        id: 'connection_not_connected',
        type: 'connection',
        severity: 'critical',
        message: `Connection status is ${metrics.connection.status}`,
        timestamp: new Date(),
      });
    }
    
    // パフォーマンスの問題をチェック
    if (metrics.performance.averageLatency > this.config.alerts.latencyThreshold) {
      issues.push({
        id: 'high_latency',
        type: 'performance',
        severity: 'medium',
        message: `High latency: ${metrics.performance.averageLatency}ms`,
        timestamp: new Date(),
      });
    }
    
    if (metrics.performance.errorRate > this.config.alerts.errorRateThreshold) {
      issues.push({
        id: 'high_error_rate',
        type: 'data',
        severity: 'high',
        message: `High error rate: ${metrics.performance.errorRate}%`,
        timestamp: new Date(),
      });
    }
    
    // 全体的な健康状態を決定
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');
    
    let overall: HealthStatus['overall'];
    if (criticalIssues.length > 0) {
      overall = 'critical';
    } else if (highIssues.length > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }
    
    return {
      overall,
      issues,
      recommendations: this.generateRecommendations(issues),
      lastCheck: new Date(),
    };
  }
  
  private generateRecommendations(issues: HealthIssue[]): string[] {
    const recommendations: string[] = [];
    
    const hasConnectionIssues = issues.some(issue => issue.type === 'connection');
    const hasPerformanceIssues = issues.some(issue => issue.type === 'performance');
    const hasDataIssues = issues.some(issue => issue.type === 'data');
    
    if (hasConnectionIssues) {
      recommendations.push('Check network connectivity and WebSocket server status');
    }
    
    if (hasPerformanceIssues) {
      recommendations.push('Consider optimizing message size or reducing send frequency');
    }
    
    if (hasDataIssues) {
      recommendations.push('Review error logs and implement better error handling');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System is operating normally');
    }
    
    return recommendations;
  }
  
  exportMetrics(format: 'json' | 'csv'): string {
    const metrics = this.getMetrics();
    
    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    } else {
      return this.convertMetricsToCSV(metrics);
    }
  }
  
  private convertMetricsToCSV(metrics: ConnectionMetrics): string {
    const headers = [
      'timestamp',
      'connection_status',
      'uptime',
      'messages_sent',
      'messages_received',
      'messages_failed',
      'bytes_in',
      'bytes_out',
      'avg_latency',
      'throughput',
      'error_rate',
      'quality_score',
    ];
    
    const values = [
      new Date().toISOString(),
      metrics.connection.status,
      metrics.connection.uptime,
      metrics.messages.sent,
      metrics.messages.received,
      metrics.messages.failed,
      metrics.messages.bytesIn,
      metrics.messages.bytesOut,
      metrics.performance.averageLatency,
      metrics.performance.throughput,
      metrics.performance.errorRate,
      metrics.quality.overallScore,
    ];
    
    return headers.join(',') + '\n' + values.join(',');
  }
  
  getEventHistory(limit?: number): MonitoringEvent[] {
    const sortedEvents = [...this.eventHistory].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    
    return limit ? sortedEvents.slice(0, limit) : sortedEvents;
  }
  
  clearHistory(): void {
    this.eventHistory = [];
    this.errorHistory = [];
    this.latencyHistory = [];
    this.throughputHistory = [];
  }
}