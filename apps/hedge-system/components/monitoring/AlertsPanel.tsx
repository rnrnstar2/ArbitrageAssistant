'use client';

import React from 'react';
import { Alert } from '../../lib/monitoring/types';

interface AlertsPanelProps {
  alerts: Alert[];
  onClearAlert: (alertId: string) => void;
  onClearAllAlerts: () => void;
}

export default function AlertsPanel({ alerts, onClearAlert, onClearAllAlerts }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return null;
  }

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return (
          <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getTypeColor = (type: Alert['type']) => {
    switch (type) {
      case 'connection': return 'bg-purple-100 text-purple-800';
      case 'performance': return 'bg-blue-100 text-blue-800';
      case 'reliability': return 'bg-orange-100 text-orange-800';
      case 'data': return 'bg-green-100 text-green-800';
      case 'system': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString();
  };

  const handleActionClick = async (action: any) => {
    try {
      await action.handler();
    } catch (error) {
      console.error('Failed to execute action:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Active Alerts ({alerts.length})
          </h3>
          {alerts.length > 1 && (
            <button
              onClick={onClearAllAlerts}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {alerts.map((alert) => (
          <div key={alert.id} className={`p-6 ${getSeverityColor(alert.severity)} border-l-4`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {getSeverityIcon(alert.severity)}
              </div>
              
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium">
                      {alert.message}
                    </h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(alert.type)}`}>
                      {alert.type}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(alert.timestamp)}
                    </span>
                    <button
                      onClick={() => onClearAlert(alert.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* メトリクス詳細 */}
                {alert.metrics && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-600">
                      {Object.entries(alert.metrics).map(([key, value]) => (
                        <span key={key} className="mr-4">
                          {key}: {typeof value === 'number' ? value.toFixed(2) : String(value)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* アクションボタン */}
                {alert.actions && alert.actions.length > 0 && (
                  <div className="mt-3 flex space-x-2">
                    {alert.actions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleActionClick(action)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        title={action.description}
                      >
                        {action.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* アラート統計 */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-red-600">
              {alerts.filter(a => a.severity === 'critical').length}
            </div>
            <div className="text-xs text-gray-500">Critical</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-yellow-600">
              {alerts.filter(a => a.severity === 'warning').length}
            </div>
            <div className="text-xs text-gray-500">Warning</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-blue-600">
              {alerts.filter(a => a.severity === 'info').length}
            </div>
            <div className="text-xs text-gray-500">Info</div>
          </div>
        </div>
      </div>
    </div>
  );
}