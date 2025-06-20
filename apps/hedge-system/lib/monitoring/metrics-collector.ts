import {
  IMetricsCollector,
  ConnectionMetrics,
  PerformanceMetrics,
  ErrorMetrics,
  AggregatedMetrics,
  TimePeriod,
  MonitoringEvent,
  MONITORING_CONSTANTS,
} from './types';

export class MetricsCollector implements IMetricsCollector {
  private connectionMetrics: Partial<ConnectionMetrics> = {};
  private performanceData: {
    latencyMeasurements: Array<{ timestamp: number; value: number }>;
    throughputMeasurements: Array<{ timestamp: number; value: number }>;
    processingTimes: Array<{ timestamp: number; value: number }>;
  } = {
    latencyMeasurements: [],
    throughputMeasurements: [],
    processingTimes: [],
  };
  
  private errorData: {
    errors: Array<{ timestamp: number; type: string; message: string }>;
    errorCounts: Map<string, number>;
  } = {
    errors: [],
    errorCounts: new Map(),
  };
  
  private messageCounters = {
    sent: 0,
    received: 0,
    failed: 0,
  };
  
  private byteCounters = {
    sent: 0,
    received: 0,
  };
  
  private connectionData = {
    startTime: 0,
    reconnectCount: 0,
    lastReconnect: undefined as Date | undefined,
  };
  
  private isCollecting = false;
  private collectionInterval?: NodeJS.Timeout;
  
  constructor() {
    this.reset();
  }
  
  startCollection(intervalMs: number = MONITORING_CONSTANTS.DEFAULT_METRICS_INTERVAL): void {
    if (this.isCollecting) {
      this.stopCollection();
    }
    
    this.isCollecting = true;
    this.connectionData.startTime = Date.now();
    
    this.collectionInterval = setInterval(() => {
      this.collectSnapshot();
    }, intervalMs);
  }
  
  stopCollection(): void {
    this.isCollecting = false;
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }
  }
  
  private collectSnapshot(): void {
    const timestamp = Date.now();
    
    // スループットの計算
    const throughput = this.calculateCurrentThroughput();
    this.performanceData.throughputMeasurements.push({
      timestamp,
      value: throughput,
    });
    
    // 古いデータのクリーンアップ
    this.cleanupOldData(timestamp);
  }
  
  private calculateCurrentThroughput(): number {
    const timeWindow = 5000; // 5秒
    const now = Date.now();
    
    // 直近5秒間のメッセージ数を計算
    const recentMessages = this.performanceData.throughputMeasurements.filter(
      measurement => now - measurement.timestamp < timeWindow
    );
    
    return recentMessages.length / (timeWindow / 1000);
  }
  
  private cleanupOldData(currentTimestamp: number): void {
    const retentionPeriod = MONITORING_CONSTANTS.DEFAULT_HISTORY_RETENTION;
    const cutoff = currentTimestamp - retentionPeriod;
    
    // 古いパフォーマンスデータを削除
    this.performanceData.latencyMeasurements = this.performanceData.latencyMeasurements.filter(
      measurement => measurement.timestamp > cutoff
    );
    
    this.performanceData.throughputMeasurements = this.performanceData.throughputMeasurements.filter(
      measurement => measurement.timestamp > cutoff
    );
    
    this.performanceData.processingTimes = this.performanceData.processingTimes.filter(
      measurement => measurement.timestamp > cutoff
    );
    
    // 古いエラーデータを削除
    this.errorData.errors = this.errorData.errors.filter(
      error => error.timestamp > cutoff
    );
  }
  
  recordMessageSent(size: number): void {
    this.messageCounters.sent++;
    this.byteCounters.sent += size;
  }
  
  recordMessageReceived(size: number, latency?: number): void {
    this.messageCounters.received++;
    this.byteCounters.received += size;
    
    if (latency !== undefined && latency > 0) {
      this.recordLatency(latency);
    }
  }
  
  recordMessageFailed(errorType: string, errorMessage: string): void {
    this.messageCounters.failed++;
    
    const timestamp = Date.now();
    this.errorData.errors.push({
      timestamp,
      type: errorType,
      message: errorMessage,
    });
    
    // エラータイプ別のカウントを更新
    const currentCount = this.errorData.errorCounts.get(errorType) || 0;
    this.errorData.errorCounts.set(errorType, currentCount + 1);
  }
  
  recordLatency(latency: number): void {
    this.performanceData.latencyMeasurements.push({
      timestamp: Date.now(),
      value: latency,
    });
  }
  
  recordProcessingTime(processingTime: number): void {
    this.performanceData.processingTimes.push({
      timestamp: Date.now(),
      value: processingTime,
    });
  }
  
  recordReconnection(): void {
    this.connectionData.reconnectCount++;
    this.connectionData.lastReconnect = new Date();
  }
  
  collectConnectionMetrics(): ConnectionMetrics {
    const now = Date.now();
    const uptime = now - this.connectionData.startTime;
    const totalMessages = this.messageCounters.sent + this.messageCounters.received;
    const latencyStats = this.calculateLatencyStatistics();
    const throughputStats = this.calculateThroughputStatistics();
    
    return {
      connection: {
        status: 'connected', // 実際の接続状態は外部から設定
        uptime,
        totalReconnects: this.connectionData.reconnectCount,
        lastReconnect: this.connectionData.lastReconnect,
      },
      messages: {
        sent: this.messageCounters.sent,
        received: this.messageCounters.received,
        failed: this.messageCounters.failed,
        bytesIn: this.byteCounters.received,
        bytesOut: this.byteCounters.sent,
        avgMessageSize: this.calculateAverageMessageSize(),
      },
      performance: {
        averageLatency: latencyStats.average,
        minLatency: this.getMinLatency(),
        maxLatency: this.getMaxLatency(),
        throughput: throughputStats.messagesPerSecond,
        errorRate: totalMessages > 0 ? (this.messageCounters.failed / totalMessages) * 100 : 0,
      },
      quality: this.calculateQualityMetrics(),
    };
  }
  
  private getMinLatency(): number {
    const latencyValues = this.performanceData.latencyMeasurements.map(m => m.value);
    return latencyValues.length > 0 ? Math.min(...latencyValues) : 0;
  }
  
  private getMaxLatency(): number {
    const latencyValues = this.performanceData.latencyMeasurements.map(m => m.value);
    return latencyValues.length > 0 ? Math.max(...latencyValues) : 0;
  }
  
  collectPerformanceMetrics(): PerformanceMetrics {
    const latencyStats = this.calculateLatencyStatistics();
    const throughputStats = this.calculateThroughputStatistics();
    
    return {
      latency: {
        current: this.getCurrentLatency(),
        average: latencyStats.average,
        p95: latencyStats.p95,
        p99: latencyStats.p99,
      },
      throughput: {
        messagesPerSecond: throughputStats.messagesPerSecond,
        bytesPerSecond: throughputStats.bytesPerSecond,
      },
      processing: {
        avgProcessingTime: this.calculateAverageProcessingTime(),
        queueSize: 0, // 実装に応じて設定
        backpressure: this.detectBackpressure(),
      },
    };
  }
  
  collectErrorMetrics(): ErrorMetrics {
    const totalMessages = this.messageCounters.sent + this.messageCounters.received;
    const errorRate = totalMessages > 0 ? (this.messageCounters.failed / totalMessages) * 100 : 0;
    
    return {
      totalErrors: this.messageCounters.failed,
      errorRate,
      errorsByType: new Map(this.errorData.errorCounts),
      recentErrors: this.getRecentErrors(),
      criticalErrors: this.countCriticalErrors(),
      timeToRecover: this.calculateRecoveryTimes(),
    };
  }
  
  aggregateMetrics(period: TimePeriod): AggregatedMetrics {
    const periodStart = period.start.getTime();
    const periodEnd = period.end.getTime();
    
    // 期間内のデータをフィルタリング
    const periodLatency = this.performanceData.latencyMeasurements.filter(
      measurement => measurement.timestamp >= periodStart && measurement.timestamp <= periodEnd
    );
    
    const periodErrors = this.errorData.errors.filter(
      error => error.timestamp >= periodStart && error.timestamp <= periodEnd
    );
    
    // 統計計算
    const latencyValues = periodLatency.map(m => m.value);
    const avgLatency = latencyValues.length > 0 
      ? latencyValues.reduce((sum, val) => sum + val, 0) / latencyValues.length 
      : 0;
    
    const maxLatency = latencyValues.length > 0 ? Math.max(...latencyValues) : 0;
    const minLatency = latencyValues.length > 0 ? Math.min(...latencyValues) : 0;
    
    const periodDuration = periodEnd - periodStart;
    const uptime = periodDuration; // 簡略化：実際の稼働時間計算が必要
    const downtime = 0; // 実装に応じて計算
    
    return {
      period,
      totalMessages: this.messageCounters.sent + this.messageCounters.received,
      avgLatency,
      maxLatency,
      minLatency,
      totalErrors: periodErrors.length,
      uptime,
      downtime,
      qualityScore: this.calculateQualityScore(),
    };
  }
  
  private calculateAverageMessageSize(): number {
    const totalMessages = this.messageCounters.sent + this.messageCounters.received;
    const totalBytes = this.byteCounters.sent + this.byteCounters.received;
    
    return totalMessages > 0 ? totalBytes / totalMessages : 0;
  }
  
  private calculateLatencyStatistics() {
    const latencyValues = this.performanceData.latencyMeasurements.map(m => m.value);
    
    if (latencyValues.length === 0) {
      return { average: 0, p95: 0, p99: 0 };
    }
    
    const sortedLatencies = latencyValues.sort((a, b) => a - b);
    const average = latencyValues.reduce((sum, val) => sum + val, 0) / latencyValues.length;
    
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);
    
    return {
      average,
      p95: sortedLatencies[p95Index] || 0,
      p99: sortedLatencies[p99Index] || 0,
    };
  }
  
  private calculateThroughputStatistics() {
    const timeWindow = 60000; // 1分
    const now = Date.now();
    
    // 直近1分間のメッセージ数
    const recentMessages = this.performanceData.throughputMeasurements.filter(
      measurement => now - measurement.timestamp < timeWindow
    );
    
    const messagesPerSecond = recentMessages.length / (timeWindow / 1000);
    
    // バイト数の計算（簡略化）
    const avgMessageSize = this.calculateAverageMessageSize();
    const bytesPerSecond = messagesPerSecond * avgMessageSize;
    
    return {
      messagesPerSecond,
      bytesPerSecond,
    };
  }
  
  private getCurrentLatency(): number {
    const recent = this.performanceData.latencyMeasurements.slice(-10);
    
    if (recent.length === 0) return 0;
    
    const sum = recent.reduce((acc, measurement) => acc + measurement.value, 0);
    return sum / recent.length;
  }
  
  private calculateAverageProcessingTime(): number {
    const processingTimes = this.performanceData.processingTimes.map(m => m.value);
    
    if (processingTimes.length === 0) return 0;
    
    return processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
  }
  
  private detectBackpressure(): boolean {
    // 簡略化された実装：エラー率が高い場合にbackpressureとみなす
    const errorRate = this.collectErrorMetrics().errorRate;
    return errorRate > 10; // 10%以上のエラー率
  }
  
  private calculateQualityMetrics() {
    const errorRate = this.collectErrorMetrics().errorRate;
    const avgLatency = this.calculateLatencyStatistics().average;
    
    // 接続安定性の計算（再接続回数ベース）
    const uptime = Date.now() - this.connectionData.startTime;
    const hoursUp = uptime / (1000 * 60 * 60);
    const reconnectsPerHour = hoursUp > 0 ? this.connectionData.reconnectCount / hoursUp : 0;
    const connectionStability = Math.max(0, 100 - (reconnectsPerHour * 20));
    
    // データ整合性の計算（エラー率ベース）
    const dataIntegrity = Math.max(0, 100 - errorRate);
    
    // 全体スコアの計算
    const latencyScore = Math.max(0, 100 - (avgLatency / 100)); // 100ms以上で減点
    const overallScore = (connectionStability * 0.4) + (dataIntegrity * 0.4) + (latencyScore * 0.2);
    
    return {
      connectionStability: Math.round(connectionStability),
      dataIntegrity: Math.round(dataIntegrity),
      overallScore: Math.round(overallScore),
    };
  }
  
  private getRecentErrors(): any[] {
    const timeWindow = 300000; // 5分
    const now = Date.now();
    
    return this.errorData.errors
      .filter(error => now - error.timestamp < timeWindow)
      .map(error => ({
        timestamp: new Date(error.timestamp),
        type: error.type,
        message: error.message,
      }));
  }
  
  private countCriticalErrors(): number {
    const criticalErrorTypes = ['connection_failed', 'authentication_failed', 'protocol_error'];
    
    return Array.from(this.errorData.errorCounts.entries())
      .filter(([type]) => criticalErrorTypes.includes(type))
      .reduce((total, [, count]) => total + count, 0);
  }
  
  private calculateRecoveryTimes(): number[] {
    // 簡略化された実装：エラー間隔を復旧時間とみなす
    const errorTimes = this.errorData.errors.map(error => error.timestamp);
    const recoveryTimes: number[] = [];
    
    for (let i = 1; i < errorTimes.length; i++) {
      const recoveryTime = errorTimes[i] - errorTimes[i - 1];
      recoveryTimes.push(recoveryTime);
    }
    
    return recoveryTimes;
  }
  
  private calculateQualityScore(): number {
    const metrics = this.calculateQualityMetrics();
    return metrics.overallScore;
  }
  
  reset(): void {
    this.connectionMetrics = {};
    this.performanceData = {
      latencyMeasurements: [],
      throughputMeasurements: [],
      processingTimes: [],
    };
    this.errorData = {
      errors: [],
      errorCounts: new Map(),
    };
    this.messageCounters = {
      sent: 0,
      received: 0,
      failed: 0,
    };
    this.byteCounters = {
      sent: 0,
      received: 0,
    };
    this.connectionData = {
      startTime: Date.now(),
      reconnectCount: 0,
      lastReconnect: undefined,
    };
  }
  
  // 統計情報の取得
  getStatistics() {
    return {
      totalDataPoints: {
        latency: this.performanceData.latencyMeasurements.length,
        throughput: this.performanceData.throughputMeasurements.length,
        errors: this.errorData.errors.length,
      },
      dataRetentionPeriod: MONITORING_CONSTANTS.DEFAULT_HISTORY_RETENTION,
      collectionStatus: this.isCollecting,
    };
  }
}