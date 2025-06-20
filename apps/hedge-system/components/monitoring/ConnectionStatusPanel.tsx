'use client';

import React from 'react';
import { ConnectionMetrics, ConnectionStatus } from '../../lib/monitoring/types';

interface ConnectionStatusPanelProps {
  metrics?: ConnectionMetrics;
}

export default function ConnectionStatusPanel({ metrics }: ConnectionStatusPanelProps) {
  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Connection Status</h3>
        <div className="text-center text-gray-500">
          Loading connection metrics...
        </div>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
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

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      case 'reconnecting': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Connection Status</h3>
      </div>
      
      <div className="p-6">
        {/* メインステータス */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${getStatusColor(metrics.connection.status)}`}></div>
            <span className="text-xl font-semibold text-gray-900">
              {metrics.connection.status.charAt(0).toUpperCase() + metrics.connection.status.slice(1)}
            </span>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-gray-500">Overall Quality</div>
            <div className={`text-2xl font-bold ${getQualityColor(metrics.quality.overallScore)}`}>
              {metrics.quality.overallScore}/100
            </div>
            <div className={`text-sm ${getQualityColor(metrics.quality.overallScore)}`}>
              {getQualityLabel(metrics.quality.overallScore)}
            </div>
          </div>
        </div>

        {/* メトリクスグリッド */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* アップタイム */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatDuration(metrics.connection.uptime)}
            </div>
            <div className="text-sm text-gray-500">Uptime</div>
          </div>

          {/* メッセージ数 */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {(metrics.messages.sent + metrics.messages.received).toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total Messages</div>
            <div className="text-xs text-gray-400 mt-1">
              ↑{metrics.messages.sent} ↓{metrics.messages.received}
            </div>
          </div>

          {/* データ転送量 */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatBytes(metrics.messages.bytesIn + metrics.messages.bytesOut)}
            </div>
            <div className="text-sm text-gray-500">Data Transferred</div>
            <div className="text-xs text-gray-400 mt-1">
              ↑{formatBytes(metrics.messages.bytesOut)} ↓{formatBytes(metrics.messages.bytesIn)}
            </div>
          </div>

          {/* 平均レイテンシ */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {metrics.performance.averageLatency.toFixed(0)}ms
            </div>
            <div className="text-sm text-gray-500">Avg Latency</div>
            <div className="text-xs text-gray-400 mt-1">
              {metrics.performance.minLatency}ms - {metrics.performance.maxLatency}ms
            </div>
          </div>
        </div>

        {/* パフォーマンス詳細 */}
        <div className="mt-8">
          <h4 className="text-md font-medium text-gray-900 mb-4">Performance Details</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* スループット */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Throughput</span>
                <span className="text-lg font-bold text-blue-600">
                  {metrics.performance.throughput.toFixed(1)} msg/s
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(100, (metrics.performance.throughput / 10) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* エラー率 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Error Rate</span>
                <span className={`text-lg font-bold ${metrics.performance.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {metrics.performance.errorRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${metrics.performance.errorRate > 5 ? 'bg-red-600' : 'bg-green-600'}`}
                  style={{ width: `${Math.min(100, metrics.performance.errorRate * 2)}%` }}
                ></div>
              </div>
            </div>

            {/* 接続安定性 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Stability</span>
                <span className={`text-lg font-bold ${getQualityColor(metrics.quality.connectionStability)}`}>
                  {metrics.quality.connectionStability}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${metrics.quality.connectionStability >= 95 ? 'bg-green-600' : 
                    metrics.quality.connectionStability >= 80 ? 'bg-yellow-600' : 'bg-red-600'}`}
                  style={{ width: `${metrics.quality.connectionStability}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* 再接続情報 */}
        {metrics.connection.totalReconnects > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-yellow-800">
                Connection has been reestablished {metrics.connection.totalReconnects} time(s)
              </span>
            </div>
            {metrics.connection.lastReconnect && (
              <div className="mt-1 text-sm text-yellow-700">
                Last reconnection: {metrics.connection.lastReconnect.toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* 失敗メッセージがある場合の警告 */}
        {metrics.messages.failed > 0 && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-red-800">
                {metrics.messages.failed} message(s) failed to send/receive
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}