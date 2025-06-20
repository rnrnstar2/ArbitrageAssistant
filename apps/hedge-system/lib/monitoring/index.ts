// WebSocket監視機能のメインエクスポート

// 型定義
export * from './types';

// 監視クラス
export { WebSocketMonitor } from './websocket-monitor';
export { MetricsCollector } from './metrics-collector';
export { AlertManager } from './alert-manager';

// デフォルトエクスポート（便利な設定済みインスタンス）
import { WebSocketMonitor } from './websocket-monitor';
import { AlertManager } from './alert-manager';
import { MonitoringConfig, MONITORING_CONSTANTS, NotificationChannel } from './types';

/**
 * デフォルト設定でWebSocket監視を開始するヘルパー関数
 */
export function createWebSocketMonitor(config?: Partial<MonitoringConfig>) {
  const defaultConfig: MonitoringConfig = {
    metricsCollection: {
      interval: MONITORING_CONSTANTS.DEFAULT_METRICS_INTERVAL,
      historyRetention: MONITORING_CONSTANTS.DEFAULT_HISTORY_RETENTION,
      enabled: true,
    },
    alerts: {
      latencyThreshold: MONITORING_CONSTANTS.DEFAULT_LATENCY_THRESHOLD,
      errorRateThreshold: MONITORING_CONSTANTS.DEFAULT_ERROR_RATE_THRESHOLD,
      connectionStabilityThreshold: MONITORING_CONSTANTS.DEFAULT_STABILITY_THRESHOLD,
      throughputMinThreshold: MONITORING_CONSTANTS.DEFAULT_THROUGHPUT_THRESHOLD,
      enabled: true,
      notificationChannels: ['desktop', 'log'],
    },
    performance: {
      latencyHistorySize: 100,
      throughputHistorySize: 100,
      performanceCheckInterval: 5000,
    },
    ui: {
      refreshInterval: 1000,
      chartDataPoints: MONITORING_CONSTANTS.CHART_MAX_DATA_POINTS,
      realTimeUpdates: true,
    },
  };

  const mergedConfig = {
    ...defaultConfig,
    ...config,
    metricsCollection: { ...defaultConfig.metricsCollection, ...config?.metricsCollection },
    alerts: { ...defaultConfig.alerts, ...config?.alerts },
    performance: { ...defaultConfig.performance, ...config?.performance },
    ui: { ...defaultConfig.ui, ...config?.ui },
  };

  return new WebSocketMonitor(mergedConfig);
}

/**
 * デフォルト設定でアラートマネージャーを作成するヘルパー関数
 */
export function createAlertManager(config?: Partial<MonitoringConfig['alerts']>) {
  const defaultAlertConfig = {
    latencyThreshold: MONITORING_CONSTANTS.DEFAULT_LATENCY_THRESHOLD,
    errorRateThreshold: MONITORING_CONSTANTS.DEFAULT_ERROR_RATE_THRESHOLD,
    connectionStabilityThreshold: MONITORING_CONSTANTS.DEFAULT_STABILITY_THRESHOLD,
    throughputMinThreshold: MONITORING_CONSTANTS.DEFAULT_THROUGHPUT_THRESHOLD,
    enabled: true,
    notificationChannels: ['desktop', 'log'] as NotificationChannel[],
  };

  const mergedConfig = { ...defaultAlertConfig, ...config };
  return new AlertManager(mergedConfig);
}

/**
 * WebSocket監視システム全体を初期化するヘルパー関数
 */
export function initializeMonitoringSystem(
  websocketConnection: any,
  config?: Partial<MonitoringConfig>
) {
  const monitor = createWebSocketMonitor(config);
  const alertManager = createAlertManager(config?.alerts);

  // 監視開始
  monitor.startMonitoring(websocketConnection);

  // アラート処理の設定
  const checkAlerts = () => {
    const metrics = monitor.getMetrics();
    const alerts = alertManager.checkAlertConditions(metrics);
    
    alerts.forEach(alert => {
      alertManager.sendAlert(alert);
    });
  };

  // 定期的なアラートチェック
  const alertCheckInterval = setInterval(checkAlerts, 5000);

  // クリーンアップ関数を返す
  return {
    monitor,
    alertManager,
    cleanup: () => {
      monitor.stopMonitoring();
      clearInterval(alertCheckInterval);
    },
  };
}

/**
 * 品質スコアの評価基準
 */
export const QUALITY_EVALUATION = {
  EXCELLENT: { min: 90, max: 100, label: 'Excellent', color: 'green' },
  GOOD: { min: 75, max: 89, label: 'Good', color: 'blue' },
  FAIR: { min: 50, max: 74, label: 'Fair', color: 'yellow' },
  POOR: { min: 0, max: 49, label: 'Poor', color: 'red' },
} as const;

/**
 * 品質スコアを評価する関数
 */
export function evaluateQualityScore(score: number) {
  if (score >= QUALITY_EVALUATION.EXCELLENT.min) return QUALITY_EVALUATION.EXCELLENT;
  if (score >= QUALITY_EVALUATION.GOOD.min) return QUALITY_EVALUATION.GOOD;
  if (score >= QUALITY_EVALUATION.FAIR.min) return QUALITY_EVALUATION.FAIR;
  return QUALITY_EVALUATION.POOR;
}

/**
 * バイト数を人間が読みやすい形式にフォーマットする関数
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 時間を人間が読みやすい形式にフォーマットする関数
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * レイテンシの健康度を評価する関数
 */
export function evaluateLatencyHealth(latency: number) {
  if (latency < 100) return { status: 'excellent', color: 'green' };
  if (latency < 500) return { status: 'good', color: 'blue' };
  if (latency < 1000) return { status: 'fair', color: 'yellow' };
  return { status: 'poor', color: 'red' };
}

/**
 * エラー率の健康度を評価する関数
 */
export function evaluateErrorRateHealth(errorRate: number) {
  if (errorRate < 1) return { status: 'excellent', color: 'green' };
  if (errorRate < 3) return { status: 'good', color: 'blue' };
  if (errorRate < 5) return { status: 'fair', color: 'yellow' };
  return { status: 'poor', color: 'red' };
}

/**
 * スループットの健康度を評価する関数
 */
export function evaluateThroughputHealth(throughput: number, threshold: number = 1) {
  if (throughput >= threshold * 2) return { status: 'excellent', color: 'green' };
  if (throughput >= threshold * 1.5) return { status: 'good', color: 'blue' };
  if (throughput >= threshold) return { status: 'fair', color: 'yellow' };
  return { status: 'poor', color: 'red' };
}