'use client';

import React, { useState, useEffect } from 'react';
import { TimePeriod, AggregatedMetrics } from '../../lib/monitoring/types';
import { WebSocketMonitor } from '../../lib/monitoring/websocket-monitor';
import { AlertManager } from '../../lib/monitoring/alert-manager';

interface HistoricalDataPanelProps {
  monitor?: WebSocketMonitor;
  alertManager?: AlertManager;
}

export default function HistoricalDataPanel({ monitor, alertManager }: HistoricalDataPanelProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [aggregatedData, setAggregatedData] = useState<AggregatedMetrics>();
  const [eventHistory, setEventHistory] = useState<any[]>([]);
  const [alertStatistics, setAlertStatistics] = useState<any>();
  const [isLoading, setIsLoading] = useState(false);

  // 期間に基づいてデータを取得
  useEffect(() => {
    if (!monitor || !alertManager) return;

    setIsLoading(true);
    
    try {
      // 期間の計算
      const now = new Date();
      const periods = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };

      const startTime = new Date(now.getTime() - periods[selectedPeriod]);
      const period: TimePeriod = { start: startTime, end: now };

      // 集計データの取得
      // const aggregated = monitor.aggregateMetrics(period);
      // setAggregatedData(aggregated);

      // イベント履歴の取得
      const events = monitor.getEventHistory(50);
      const filteredEvents = events.filter(
        event => event.timestamp.getTime() >= startTime.getTime()
      );
      setEventHistory(filteredEvents);

      // アラート統計の取得
      const alertStats = alertManager.getStatistics();
      setAlertStatistics(alertStats);

    } catch (error) {
      console.error('Failed to load historical data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod, monitor, alertManager]);

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString();
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'connection_established': return 'text-green-600 bg-green-100';
      case 'connection_lost': return 'text-red-600 bg-red-100';
      case 'reconnection_attempt': return 'text-yellow-600 bg-yellow-100';
      case 'error_occurred': return 'text-red-600 bg-red-100';
      case 'latency_spike': return 'text-orange-600 bg-orange-100';
      case 'throughput_drop': return 'text-purple-600 bg-purple-100';
      case 'quality_degraded': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'connection_established':
        return (
          <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'connection_lost':
      case 'error_occurred':
        return (
          <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'reconnection_attempt':
        return (
          <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        );
      case 'latency_spike':
      case 'throughput_drop':
      case 'quality_degraded':
        return (
          <svg className="h-4 w-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="h-4 w-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Historical Data & Events</h3>
          
          {/* 期間選択 */}
          <div className="flex space-x-1">
            {['1h', '6h', '24h', '7d'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period as any)}
                className={`px-3 py-1 text-sm rounded-md ${
                  selectedPeriod === period
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading historical data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 統計サマリー */}
            {aggregatedData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-900">
                    {aggregatedData.totalMessages.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-600">Total Messages</div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-900">
                    {aggregatedData.avgLatency.toFixed(0)}ms
                  </div>
                  <div className="text-sm text-green-600">Avg Latency</div>
                </div>
                
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-900">
                    {aggregatedData.totalErrors}
                  </div>
                  <div className="text-sm text-red-600">Total Errors</div>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-900">
                    {formatDuration(aggregatedData.uptime)}
                  </div>
                  <div className="text-sm text-purple-600">Uptime</div>
                </div>
              </div>
            )}

            {/* アラート統計 */}
            {alertStatistics && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-900 mb-3">Alert Statistics (Last 24h)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {alertStatistics.totalAlertsLast24h}
                    </div>
                    <div className="text-sm text-gray-500">Total Alerts</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-semibold text-red-600">
                      {alertStatistics.alertsBySeverity?.critical || 0}
                    </div>
                    <div className="text-sm text-gray-500">Critical</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-semibold text-orange-600">
                      {alertStatistics.activeAlertsCount}
                    </div>
                    <div className="text-sm text-gray-500">Active</div>
                  </div>
                </div>
              </div>
            )}

            {/* イベント履歴 */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Recent Events</h4>
              
              {eventHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No events in the selected time period
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {eventHistory.map((event, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 mt-1">
                        {getEventIcon(event.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {event.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </p>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getEventTypeColor(event.type)}`}>
                              {event.severity}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                        </div>
                        
                        {event.data && Object.keys(event.data).length > 0 && (
                          <div className="mt-1 text-xs text-gray-600">
                            {Object.entries(event.data).map(([key, value]) => (
                              <span key={key} className="mr-3">
                                {key}: {typeof value === 'number' && value % 1 !== 0 ? 
                                  (value as number).toFixed(2) : 
                                  String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* データエクスポート */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Export monitoring data for analysis
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      if (monitor) {
                        const csvData = monitor.exportMetrics('csv');
                        const blob = new Blob([csvData], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `websocket-metrics-${Date.now()}.csv`;
                        a.click();
                      }
                    }}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => {
                      if (monitor) {
                        const jsonData = monitor.exportMetrics('json');
                        const blob = new Blob([jsonData], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `websocket-metrics-${Date.now()}.json`;
                        a.click();
                      }
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Export JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}