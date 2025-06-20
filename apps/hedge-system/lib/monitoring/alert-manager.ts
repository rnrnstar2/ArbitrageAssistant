import {
  IAlertManager,
  Alert,
  AlertConfig,
  AlertType,
  ConnectionMetrics,
  NotificationChannel,
  MONITORING_CONSTANTS,
} from './types';

export class AlertManager implements IAlertManager {
  private config: AlertConfig;
  private activeAlerts = new Map<string, Alert>();
  private alertHistory: Alert[] = [];
  private alertCooldowns = new Map<string, number>();
  
  constructor(config?: Partial<AlertConfig>) {
    this.config = this.createDefaultConfig(config);
  }
  
  private createDefaultConfig(config?: Partial<AlertConfig>): AlertConfig {
    return {
      latencyThreshold: config?.latencyThreshold || MONITORING_CONSTANTS.DEFAULT_LATENCY_THRESHOLD,
      errorRateThreshold: config?.errorRateThreshold || MONITORING_CONSTANTS.DEFAULT_ERROR_RATE_THRESHOLD,
      connectionStabilityThreshold: config?.connectionStabilityThreshold || MONITORING_CONSTANTS.DEFAULT_STABILITY_THRESHOLD,
      throughputMinThreshold: config?.throughputMinThreshold || MONITORING_CONSTANTS.DEFAULT_THROUGHPUT_THRESHOLD,
      enabled: config?.enabled ?? true,
      notificationChannels: config?.notificationChannels || ['log'],
    };
  }
  
  checkAlertConditions(metrics: ConnectionMetrics): Alert[] {
    if (!this.config.enabled) {
      return [];
    }
    
    const alerts: Alert[] = [];
    const now = Date.now();
    
    // レイテンシアラート
    if (metrics.performance.averageLatency > this.config.latencyThreshold) {
      const alertId = 'high-latency';
      
      if (this.canTriggerAlert(alertId, now)) {
        const alert = this.createAlert(
          alertId,
          'performance',
          'warning',
          `High latency detected: ${metrics.performance.averageLatency.toFixed(2)}ms (threshold: ${this.config.latencyThreshold}ms)`,
          { 
            latency: metrics.performance.averageLatency,
            threshold: this.config.latencyThreshold 
          }
        );
        
        alerts.push(alert);
        this.setAlertCooldown(alertId, now);
      }
    } else {
      // レイテンシが正常に戻った場合、対応するアラートをクリア
      this.clearAlert('high-latency');
    }
    
    // エラー率アラート
    if (metrics.performance.errorRate > this.config.errorRateThreshold) {
      const alertId = 'high-error-rate';
      
      if (this.canTriggerAlert(alertId, now)) {
        const severity = metrics.performance.errorRate > this.config.errorRateThreshold * 2 ? 'critical' : 'warning';
        const alert = this.createAlert(
          alertId,
          'reliability',
          severity,
          `High error rate: ${metrics.performance.errorRate.toFixed(2)}% (threshold: ${this.config.errorRateThreshold}%)`,
          { 
            errorRate: metrics.performance.errorRate,
            threshold: this.config.errorRateThreshold 
          }
        );
        
        alerts.push(alert);
        this.setAlertCooldown(alertId, now);
      }
    } else {
      this.clearAlert('high-error-rate');
    }
    
    // 接続安定性アラート
    if (metrics.quality.connectionStability < this.config.connectionStabilityThreshold) {
      const alertId = 'connection-unstable';
      
      if (this.canTriggerAlert(alertId, now)) {
        const severity = metrics.quality.connectionStability < 50 ? 'critical' : 'warning';
        const alert = this.createAlert(
          alertId,
          'connection',
          severity,
          `Connection stability low: ${metrics.quality.connectionStability}% (threshold: ${this.config.connectionStabilityThreshold}%)`,
          { 
            stability: metrics.quality.connectionStability,
            threshold: this.config.connectionStabilityThreshold 
          }
        );
        
        alerts.push(alert);
        this.setAlertCooldown(alertId, now);
      }
    } else {
      this.clearAlert('connection-unstable');
    }
    
    // スループットアラート
    if (metrics.performance.throughput < this.config.throughputMinThreshold) {
      const alertId = 'low-throughput';
      
      if (this.canTriggerAlert(alertId, now)) {
        const alert = this.createAlert(
          alertId,
          'performance',
          'warning',
          `Low throughput: ${metrics.performance.throughput.toFixed(2)} msg/s (threshold: ${this.config.throughputMinThreshold} msg/s)`,
          { 
            throughput: metrics.performance.throughput,
            threshold: this.config.throughputMinThreshold 
          }
        );
        
        alerts.push(alert);
        this.setAlertCooldown(alertId, now);
      }
    } else {
      this.clearAlert('low-throughput');
    }
    
    // 接続状態アラート
    if (metrics.connection.status !== 'connected') {
      const alertId = 'connection-not-connected';
      
      if (this.canTriggerAlert(alertId, now)) {
        const severity = metrics.connection.status === 'disconnected' ? 'critical' : 'warning';
        const alert = this.createAlert(
          alertId,
          'connection',
          severity,
          `Connection status is ${metrics.connection.status}`,
          { 
            status: metrics.connection.status 
          }
        );
        
        alerts.push(alert);
        this.setAlertCooldown(alertId, now);
      }
    } else {
      this.clearAlert('connection-not-connected');
    }
    
    // 総合品質アラート
    if (metrics.quality.overallScore < 50) {
      const alertId = 'poor-quality';
      
      if (this.canTriggerAlert(alertId, now)) {
        const alert = this.createAlert(
          alertId,
          'system',
          'warning',
          `Poor overall quality: ${metrics.quality.overallScore}/100`,
          { 
            qualityScore: metrics.quality.overallScore 
          }
        );
        
        alerts.push(alert);
        this.setAlertCooldown(alertId, now);
      }
    } else {
      this.clearAlert('poor-quality');
    }
    
    // 発生したアラートをアクティブリストに追加
    alerts.forEach(alert => {
      this.activeAlerts.set(alert.id, alert);
      this.alertHistory.push(alert);
    });
    
    // 履歴のクリーンアップ
    this.cleanupAlertHistory();
    
    return alerts;
  }
  
  private createAlert(
    id: string,
    type: AlertType,
    severity: Alert['severity'],
    message: string,
    metrics: any
  ): Alert {
    return {
      id,
      type,
      severity,
      message,
      timestamp: new Date(),
      metrics,
      actions: this.generateAlertActions(id, type),
    };
  }
  
  private generateAlertActions(alertId: string, type: AlertType) {
    const actions = [];
    
    switch (type) {
      case 'connection':
        actions.push({
          id: 'reconnect',
          name: 'Reconnect',
          description: 'Attempt to reconnect WebSocket',
          handler: async () => {
            console.log('Triggering reconnection...');
            // 実際の再接続ロジックを実装
          },
        });
        break;
        
      case 'performance':
        actions.push({
          id: 'reduce_frequency',
          name: 'Reduce Message Frequency',
          description: 'Temporarily reduce message sending frequency',
          handler: async () => {
            console.log('Reducing message frequency...');
            // 実際のメッセージ頻度調整ロジックを実装
          },
        });
        break;
        
      case 'reliability':
        actions.push({
          id: 'clear_queue',
          name: 'Clear Queue',
          description: 'Clear pending message queue',
          handler: async () => {
            console.log('Clearing message queue...');
            // 実際のキュークリアロジックを実装
          },
        });
        break;
    }
    
    // 共通アクション
    actions.push({
      id: 'acknowledge',
      name: 'Acknowledge',
      description: 'Acknowledge this alert',
      handler: async () => {
        this.clearAlert(alertId);
      },
    });
    
    return actions;
  }
  
  private canTriggerAlert(alertId: string, currentTime: number): boolean {
    const cooldownEnd = this.alertCooldowns.get(alertId);
    
    if (!cooldownEnd) {
      return true;
    }
    
    return currentTime >= cooldownEnd;
  }
  
  private setAlertCooldown(alertId: string, currentTime: number): void {
    const cooldownDuration = MONITORING_CONSTANTS.ALERT_DEBOUNCE_TIME;
    this.alertCooldowns.set(alertId, currentTime + cooldownDuration);
  }
  
  async sendAlert(alert: Alert): Promise<void> {
    console.log(`🚨 WebSocket Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    // 設定されたチャネルに通知を送信
    for (const channel of this.config.notificationChannels) {
      try {
        await this.sendNotificationToChannel(alert, channel);
      } catch (error) {
        console.error(`Failed to send notification to ${channel}:`, error);
      }
    }
  }
  
  private async sendNotificationToChannel(alert: Alert, channel: NotificationChannel): Promise<void> {
    switch (channel) {
      case 'desktop':
        await this.sendDesktopNotification(alert);
        break;
        
      case 'log':
        this.logAlert(alert);
        break;
        
      case 'email':
        await this.sendEmailNotification(alert);
        break;
        
      case 'slack':
        await this.sendSlackNotification(alert);
        break;
        
      default:
        console.warn(`Unknown notification channel: ${channel}`);
    }
  }
  
  private async sendDesktopNotification(alert: Alert): Promise<void> {
    try {
      // macOSのosascriptを使用してデスクトップ通知を送信
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      const soundName = alert.severity === 'critical' ? 'Basso' : 'Glass';
      const command = `osascript -e 'display notification "${alert.message}" with title "WebSocket Monitor" subtitle "${alert.type} Alert" sound name "${soundName}"'`;
      
      await execPromise(command);
    } catch (error) {
      console.error('Failed to send desktop notification:', error);
    }
  }
  
  private logAlert(alert: Alert): void {
    const logLevel = alert.severity === 'critical' ? 'error' : 
                     alert.severity === 'warning' ? 'warn' : 'info';
    
    console[logLevel](`[${alert.timestamp.toISOString()}] WebSocket Alert - ${alert.type}: ${alert.message}`, alert.metrics);
  }
  
  private async sendEmailNotification(alert: Alert): Promise<void> {
    // メール通知の実装（実際のメールサービスプロバイダーに応じて実装）
    console.log(`EMAIL: ${alert.message}`);
  }
  
  private async sendSlackNotification(alert: Alert): Promise<void> {
    // Slack通知の実装（WebhookやAPIを使用）
    console.log(`SLACK: ${alert.message}`);
  }
  
  configureAlerts(config: AlertConfig): void {
    this.config = { ...this.config, ...config };
    console.log('Alert configuration updated:', this.config);
  }
  
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }
  
  clearAlert(alertId: string): void {
    if (this.activeAlerts.has(alertId)) {
      this.activeAlerts.delete(alertId);
      console.log(`Alert cleared: ${alertId}`);
    }
  }
  
  clearAllAlerts(): void {
    this.activeAlerts.clear();
    console.log('All alerts cleared');
  }
  
  getAlertHistory(limit?: number): Alert[] {
    const sortedHistory = [...this.alertHistory].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    
    return limit ? sortedHistory.slice(0, limit) : sortedHistory;
  }
  
  private cleanupAlertHistory(): void {
    const maxHistorySize = 100;
    const retentionPeriod = 24 * 60 * 60 * 1000; // 24時間
    const cutoffTime = Date.now() - retentionPeriod;
    
    // 古いアラートを削除
    this.alertHistory = this.alertHistory.filter(
      alert => alert.timestamp.getTime() > cutoffTime
    );
    
    // 履歴サイズ制限
    if (this.alertHistory.length > maxHistorySize) {
      this.alertHistory = this.alertHistory
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, maxHistorySize);
    }
  }
  
  getStatistics() {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    
    const recent24hAlerts = this.alertHistory.filter(
      alert => alert.timestamp.getTime() > last24h
    );
    
    const alertsByType = new Map<AlertType, number>();
    const alertsBySeverity = new Map<Alert['severity'], number>();
    
    recent24hAlerts.forEach(alert => {
      // タイプ別
      const typeCount = alertsByType.get(alert.type) || 0;
      alertsByType.set(alert.type, typeCount + 1);
      
      // 重要度別
      const severityCount = alertsBySeverity.get(alert.severity) || 0;
      alertsBySeverity.set(alert.severity, severityCount + 1);
    });
    
    return {
      activeAlertsCount: this.activeAlerts.size,
      totalAlertsLast24h: recent24hAlerts.length,
      alertsByType: Object.fromEntries(alertsByType),
      alertsBySeverity: Object.fromEntries(alertsBySeverity),
      config: this.config,
    };
  }
  
  // テスト用のアラート発生
  async triggerTestAlert(): Promise<void> {
    const testAlert = this.createAlert(
      'test-alert',
      'system',
      'info',
      'This is a test alert to verify the notification system',
      { test: true }
    );
    
    await this.sendAlert(testAlert);
  }
}