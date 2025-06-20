'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ConnectionMetrics, Alert, MonitoringConfig, MONITORING_CONSTANTS } from '../../lib/monitoring/types';
import { WebSocketMonitor } from '../../lib/monitoring/websocket-monitor';
import { AlertManager } from '../../lib/monitoring/alert-manager';
import ConnectionStatusPanel from './ConnectionStatusPanel';
import MetricsChartsPanel from './MetricsChartsPanel';
import AlertsPanel from './AlertsPanel';
import HistoricalDataPanel from './HistoricalDataPanel';

interface WebSocketDashboardProps {
  websocketConnection?: any;
  className?: string;
}

export default function WebSocketDashboard({ websocketConnection, className = '' }: WebSocketDashboardProps) {
  const [metrics, setMetrics] = useState<ConnectionMetrics>();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitor, setMonitor] = useState<WebSocketMonitor>();
  const [alertManager, setAlertManager] = useState<AlertManager>();
  const [config, setConfig] = useState<MonitoringConfig>({
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
  });

  // 監視の初期化
  useEffect(() => {
    const monitorInstance = new WebSocketMonitor(config);
    const alertManagerInstance = new AlertManager(config.alerts);
    
    setMonitor(monitorInstance);
    setAlertManager(alertManagerInstance);
    
    return () => {
      monitorInstance.stopMonitoring();
    };
  }, []);

  // WebSocket接続が変更された時の処理
  useEffect(() => {
    if (websocketConnection && monitor && !isMonitoring) {
      startMonitoring();
    }
  }, [websocketConnection, monitor]);

  // メトリクスの定期更新
  useEffect(() => {
    if (!isMonitoring || !monitor) return;

    const interval = setInterval(() => {
      updateMetrics();
    }, config.ui.refreshInterval);

    return () => clearInterval(interval);
  }, [isMonitoring, monitor, config.ui.refreshInterval]);

  const startMonitoring = useCallback(() => {
    if (!monitor || !websocketConnection) return;

    try {
      monitor.startMonitoring(websocketConnection);
      setIsMonitoring(true);
      console.log('WebSocket monitoring started');
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  }, [monitor, websocketConnection]);

  const stopMonitoring = useCallback(() => {
    if (!monitor) return;

    try {
      monitor.stopMonitoring();
      setIsMonitoring(false);
      console.log('WebSocket monitoring stopped');
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
    }
  }, [monitor]);

  const updateMetrics = useCallback(() => {
    if (!monitor || !alertManager) return;

    try {
      const currentMetrics = monitor.getMetrics();
      setMetrics(currentMetrics);

      // アラートの確認
      const newAlerts = alertManager.checkAlertConditions(currentMetrics);
      if (newAlerts.length > 0) {
        // 新しいアラートを送信
        newAlerts.forEach(alert => {
          alertManager.sendAlert(alert);
        });
      }

      // アクティブなアラートを取得
      const activeAlerts = alertManager.getActiveAlerts();
      setAlerts(activeAlerts);
    } catch (error) {
      console.error('Failed to update metrics:', error);
    }
  }, [monitor, alertManager]);

  const handleClearAlert = useCallback((alertId: string) => {
    if (!alertManager) return;
    
    alertManager.clearAlert(alertId);
    setAlerts(alertManager.getActiveAlerts());
  }, [alertManager]);

  const handleClearAllAlerts = useCallback(() => {
    if (!alertManager) return;
    
    alertManager.clearAllAlerts();
    setAlerts([]);
  }, [alertManager]);

  const handleTestAlert = useCallback(async () => {
    if (!alertManager) return;
    
    try {
      await alertManager.triggerTestAlert();
    } catch (error) {
      console.error('Failed to trigger test alert:', error);
    }
  }, [alertManager]);

  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getConnectionStatusColor = (status?: string) => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'connecting': return 'text-yellow-600 bg-yellow-100';
      case 'disconnected': return 'text-red-600 bg-red-100';
      case 'reconnecting': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={`websocket-dashboard space-y-6 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">WebSocket Monitor</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConnectionStatusColor(metrics?.connection.status)}`}>
              {metrics?.connection.status?.toUpperCase() || 'UNKNOWN'}
            </span>
            {metrics?.connection.uptime && (
              <span className="text-sm text-gray-500">
                Uptime: {formatUptime(metrics.connection.uptime)}
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            {!isMonitoring ? (
              <button
                onClick={startMonitoring}
                disabled={!websocketConnection}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Start Monitoring
              </button>
            ) : (
              <button
                onClick={stopMonitoring}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Stop Monitoring
              </button>
            )}
            <button
              onClick={handleTestAlert}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Test Alert
            </button>
          </div>
        </div>
      </div>

      {/* 監視が無効な場合の表示 */}
      {!isMonitoring && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Monitoring Not Active
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                {!websocketConnection 
                  ? 'No WebSocket connection available. Please establish a connection first.' 
                  : 'Click "Start Monitoring" to begin monitoring WebSocket performance.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      {isMonitoring && (
        <>
          {/* 接続ステータスパネル */}
          <ConnectionStatusPanel metrics={metrics} />

          {/* アラートパネル */}
          {alerts.length > 0 && (
            <AlertsPanel 
              alerts={alerts}
              onClearAlert={handleClearAlert}
              onClearAllAlerts={handleClearAllAlerts}
            />
          )}

          {/* メトリクスチャートパネル */}
          <MetricsChartsPanel metrics={metrics} />

          {/* 履歴データパネル */}
          <HistoricalDataPanel 
            monitor={monitor}
            alertManager={alertManager}
          />
        </>
      )}
    </div>
  );
}