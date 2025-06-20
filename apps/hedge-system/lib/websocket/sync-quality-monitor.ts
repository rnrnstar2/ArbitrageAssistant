import { DataType } from './data-buffer';

export interface SyncMetrics {
  timestamp: Date;
  syncTime: number; // milliseconds
  processed: number;
  duplicates: number;
  missing: number;
  errors: number;
  success: boolean;
  dataType: DataType;
  accountId: string;
}

export interface SyncResult {
  success: boolean;
  processed: number;
  duplicates: number;
  missing: number;
  errors: number;
  syncTime: number;
  timestamp: Date;
  dataType: DataType;
  accountId: string;
}

export interface QualityReport {
  period: {
    start: Date;
    end: Date;
    duration: number; // milliseconds
  };
  overall: {
    averageSyncTime: number;
    successRate: number;
    duplicateRate: number;
    missingDataRate: number;
    errorRate: number;
    qualityScore: number;
    totalOperations: number;
  };
  byDataType: Map<DataType, {
    averageSyncTime: number;
    successRate: number;
    duplicateRate: number;
    missingDataRate: number;
    errorRate: number;
    qualityScore: number;
    totalOperations: number;
  }>;
  byAccount: Map<string, {
    averageSyncTime: number;
    successRate: number;
    duplicateRate: number;
    missingDataRate: number;
    errorRate: number;
    qualityScore: number;
    totalOperations: number;
  }>;
  recommendations: string[];
  alerts: QualityAlert[];
}

export interface QualityAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  type: 'high_latency' | 'high_error_rate' | 'high_duplicate_rate' | 'high_missing_rate' | 'low_quality_score';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  dataType?: DataType;
  accountId?: string;
}

export interface QualityThresholds {
  maxSyncTime: number; // milliseconds
  minSuccessRate: number; // percentage (0-100)
  maxDuplicateRate: number; // percentage (0-100)
  maxMissingRate: number; // percentage (0-100)
  maxErrorRate: number; // percentage (0-100)
  minQualityScore: number; // score (0-100)
}

export interface SyncQualityMonitorConfig {
  maxMetricsHistory: number;
  qualityThresholds: QualityThresholds;
  reportWindow: number; // milliseconds
  alertCooldown: number; // milliseconds
}

export class SyncQualityMonitor {
  private metrics: SyncMetrics[] = [];
  private config: SyncQualityMonitorConfig;
  private lastAlerts: Map<string, Date> = new Map();
  private alertCallbacks: Map<string, (alert: QualityAlert) => void> = new Map();

  constructor(config: Partial<SyncQualityMonitorConfig> = {}) {
    this.config = {
      maxMetricsHistory: config.maxMetricsHistory ?? 10000,
      qualityThresholds: {
        maxSyncTime: 1000, // 1 second
        minSuccessRate: 95, // 95%
        maxDuplicateRate: 5, // 5%
        maxMissingRate: 2, // 2%
        maxErrorRate: 1, // 1%
        minQualityScore: 80, // 80/100
        ...config.qualityThresholds
      },
      reportWindow: config.reportWindow ?? 5 * 60 * 1000, // 5 minutes
      alertCooldown: config.alertCooldown ?? 30 * 1000, // 30 seconds
    };
  }

  recordSyncMetrics(result: SyncResult): void {
    const metrics: SyncMetrics = {
      timestamp: result.timestamp,
      syncTime: result.syncTime,
      processed: result.processed,
      duplicates: result.duplicates,
      missing: result.missing,
      errors: result.errors,
      success: result.success,
      dataType: result.dataType,
      accountId: result.accountId,
    };

    this.metrics.push(metrics);

    // Enforce history size limit
    if (this.metrics.length > this.config.maxMetricsHistory) {
      this.metrics.shift();
    }

    // Check for quality issues and generate alerts
    this.checkQualityAlerts(metrics);
  }

  calculateQualityScore(timeWindow?: number): number {
    const windowStart = timeWindow 
      ? new Date(Date.now() - timeWindow)
      : new Date(Date.now() - this.config.reportWindow);

    const recentMetrics = this.metrics.filter(m => m.timestamp >= windowStart);
    
    if (recentMetrics.length === 0) return 100;

    const stats = this.calculateStats(recentMetrics);
    
    // Quality score calculation (0-100)
    const timeScore = Math.max(0, 100 - (stats.averageSyncTime / this.config.qualityThresholds.maxSyncTime * 100));
    const successScore = stats.successRate;
    const duplicateScore = Math.max(0, 100 - (stats.duplicateRate / this.config.qualityThresholds.maxDuplicateRate * 100));
    const missingScore = Math.max(0, 100 - (stats.missingDataRate / this.config.qualityThresholds.maxMissingRate * 100));
    const errorScore = Math.max(0, 100 - (stats.errorRate / this.config.qualityThresholds.maxErrorRate * 100));

    // Weighted average
    const qualityScore = (
      timeScore * 0.25 +
      successScore * 0.30 +
      duplicateScore * 0.15 +
      missingScore * 0.15 +
      errorScore * 0.15
    );

    return Math.min(100, Math.max(0, qualityScore));
  }

  getQualityReport(timeWindow?: number): QualityReport {
    const windowStart = timeWindow 
      ? new Date(Date.now() - timeWindow)
      : new Date(Date.now() - this.config.reportWindow);
    const windowEnd = new Date();

    const recentMetrics = this.metrics.filter(m => m.timestamp >= windowStart);
    
    const overall = this.calculateStats(recentMetrics);
    
    // Group by data type
    const byDataType = new Map<DataType, typeof overall>();
    const dataTypes = [...new Set(recentMetrics.map(m => m.dataType))];
    
    for (const dataType of dataTypes) {
      const typeMetrics = recentMetrics.filter(m => m.dataType === dataType);
      byDataType.set(dataType, this.calculateStats(typeMetrics));
    }

    // Group by account
    const byAccount = new Map<string, typeof overall>();
    const accounts = [...new Set(recentMetrics.map(m => m.accountId))];
    
    for (const accountId of accounts) {
      const accountMetrics = recentMetrics.filter(m => m.accountId === accountId);
      byAccount.set(accountId, this.calculateStats(accountMetrics));
    }

    const recommendations = this.generateRecommendations(overall, byDataType, byAccount);
    const alerts = this.getRecentAlerts(windowStart);

    return {
      period: {
        start: windowStart,
        end: windowEnd,
        duration: windowEnd.getTime() - windowStart.getTime(),
      },
      overall,
      byDataType,
      byAccount,
      recommendations,
      alerts,
    };
  }

  onAlert(alertType: string, callback: (alert: QualityAlert) => void): void {
    this.alertCallbacks.set(alertType, callback);
  }

  removeAlertCallback(alertType: string): void {
    this.alertCallbacks.delete(alertType);
  }

  getMetricsHistory(timeWindow?: number): SyncMetrics[] {
    if (!timeWindow) return [...this.metrics];

    const windowStart = new Date(Date.now() - timeWindow);
    return this.metrics.filter(m => m.timestamp >= windowStart);
  }

  clearMetrics(): void {
    this.metrics = [];
    this.lastAlerts.clear();
  }

  private calculateStats(metrics: SyncMetrics[]) {
    if (metrics.length === 0) {
      return {
        averageSyncTime: 0,
        successRate: 100,
        duplicateRate: 0,
        missingDataRate: 0,
        errorRate: 0,
        qualityScore: 100,
        totalOperations: 0,
      };
    }

    const totalOperations = metrics.length;
    const successfulOps = metrics.filter(m => m.success).length;
    const totalProcessed = metrics.reduce((sum, m) => sum + m.processed, 0);
    const totalDuplicates = metrics.reduce((sum, m) => sum + m.duplicates, 0);
    const totalMissing = metrics.reduce((sum, m) => sum + m.missing, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);
    const averageSyncTime = metrics.reduce((sum, m) => sum + m.syncTime, 0) / totalOperations;

    const successRate = (successfulOps / totalOperations) * 100;
    const duplicateRate = totalProcessed > 0 ? (totalDuplicates / totalProcessed) * 100 : 0;
    const missingDataRate = totalProcessed > 0 ? (totalMissing / totalProcessed) * 100 : 0;
    const errorRate = totalProcessed > 0 ? (totalErrors / totalProcessed) * 100 : 0;

    // Calculate quality score for this subset
    const timeScore = Math.max(0, 100 - (averageSyncTime / this.config.qualityThresholds.maxSyncTime * 100));
    const duplicateScore = Math.max(0, 100 - (duplicateRate / this.config.qualityThresholds.maxDuplicateRate * 100));
    const missingScore = Math.max(0, 100 - (missingDataRate / this.config.qualityThresholds.maxMissingRate * 100));
    const errorScore = Math.max(0, 100 - (errorRate / this.config.qualityThresholds.maxErrorRate * 100));

    const qualityScore = (
      timeScore * 0.25 +
      successRate * 0.30 +
      duplicateScore * 0.15 +
      missingScore * 0.15 +
      errorScore * 0.15
    );

    return {
      averageSyncTime,
      successRate,
      duplicateRate,
      missingDataRate,
      errorRate,
      qualityScore: Math.min(100, Math.max(0, qualityScore)),
      totalOperations,
    };
  }

  private checkQualityAlerts(metrics: SyncMetrics): void {
    const now = new Date();
    const alertPrefix = `${metrics.dataType}_${metrics.accountId}`;

    // Check sync time
    if (metrics.syncTime > this.config.qualityThresholds.maxSyncTime) {
      this.generateAlert('high_latency', {
        level: metrics.syncTime > this.config.qualityThresholds.maxSyncTime * 2 ? 'error' : 'warning',
        type: 'high_latency',
        message: `High sync latency detected: ${metrics.syncTime}ms (threshold: ${this.config.qualityThresholds.maxSyncTime}ms)`,
        value: metrics.syncTime,
        threshold: this.config.qualityThresholds.maxSyncTime,
        timestamp: now,
        dataType: metrics.dataType,
        accountId: metrics.accountId,
      }, `${alertPrefix}_latency`);
    }

    // Check for errors
    if (!metrics.success || metrics.errors > 0) {
      this.generateAlert('high_error_rate', {
        level: 'error',
        type: 'high_error_rate',
        message: `Sync errors detected for ${metrics.dataType} on account ${metrics.accountId}`,
        value: metrics.errors,
        threshold: 0,
        timestamp: now,
        dataType: metrics.dataType,
        accountId: metrics.accountId,
      }, `${alertPrefix}_error`);
    }

    // Check duplicate rate
    const duplicateRate = metrics.processed > 0 ? (metrics.duplicates / metrics.processed) * 100 : 0;
    if (duplicateRate > this.config.qualityThresholds.maxDuplicateRate) {
      this.generateAlert('high_duplicate_rate', {
        level: 'warning',
        type: 'high_duplicate_rate',
        message: `High duplicate rate detected: ${duplicateRate.toFixed(1)}% (threshold: ${this.config.qualityThresholds.maxDuplicateRate}%)`,
        value: duplicateRate,
        threshold: this.config.qualityThresholds.maxDuplicateRate,
        timestamp: now,
        dataType: metrics.dataType,
        accountId: metrics.accountId,
      }, `${alertPrefix}_duplicate`);
    }

    // Check missing data rate
    const missingRate = metrics.processed > 0 ? (metrics.missing / metrics.processed) * 100 : 0;
    if (missingRate > this.config.qualityThresholds.maxMissingRate) {
      this.generateAlert('high_missing_rate', {
        level: 'warning',
        type: 'high_missing_rate',
        message: `High missing data rate detected: ${missingRate.toFixed(1)}% (threshold: ${this.config.qualityThresholds.maxMissingRate}%)`,
        value: missingRate,
        threshold: this.config.qualityThresholds.maxMissingRate,
        timestamp: now,
        dataType: metrics.dataType,
        accountId: metrics.accountId,
      }, `${alertPrefix}_missing`);
    }
  }

  private generateAlert(type: string, alert: QualityAlert, cooldownKey: string): void {
    // Check cooldown
    const lastAlert = this.lastAlerts.get(cooldownKey);
    if (lastAlert && (Date.now() - lastAlert.getTime()) < this.config.alertCooldown) {
      return;
    }

    this.lastAlerts.set(cooldownKey, new Date());

    // Call registered callback
    const callback = this.alertCallbacks.get(type);
    if (callback) {
      callback(alert);
    }
  }

  private generateRecommendations(
    overall: ReturnType<typeof this.calculateStats>,
    byDataType: Map<DataType, ReturnType<typeof this.calculateStats>>,
    byAccount: Map<string, ReturnType<typeof this.calculateStats>>
  ): string[] {
    const recommendations: string[] = [];

    // Overall recommendations
    if (overall.qualityScore < this.config.qualityThresholds.minQualityScore) {
      recommendations.push(`Overall quality score is low (${overall.qualityScore.toFixed(1)}). Consider investigating connection quality.`);
    }

    if (overall.averageSyncTime > this.config.qualityThresholds.maxSyncTime) {
      recommendations.push(`Average sync time is high (${overall.averageSyncTime.toFixed(0)}ms). Consider optimizing buffer sizes or network configuration.`);
    }

    if (overall.duplicateRate > this.config.qualityThresholds.maxDuplicateRate) {
      recommendations.push(`High duplicate rate (${overall.duplicateRate.toFixed(1)}%). Check for message retransmission issues.`);
    }

    if (overall.missingDataRate > this.config.qualityThresholds.maxMissingRate) {
      recommendations.push(`High missing data rate (${overall.missingDataRate.toFixed(1)}%). Verify network stability and message ordering.`);
    }

    // Data type specific recommendations
    for (const [dataType, stats] of byDataType) {
      if (stats.qualityScore < this.config.qualityThresholds.minQualityScore) {
        recommendations.push(`${dataType} data quality is poor. Consider adjusting sync parameters for this data type.`);
      }
    }

    // Account specific recommendations
    for (const [accountId, stats] of byAccount) {
      if (stats.qualityScore < this.config.qualityThresholds.minQualityScore) {
        recommendations.push(`Account ${accountId} has poor sync quality. Check EA connection for this account.`);
      }
    }

    return recommendations;
  }

  private getRecentAlerts(since: Date): QualityAlert[] {
    // In a real implementation, this would track alerts
    // For now, return empty array as alerts are handled via callbacks
    return [];
  }
}