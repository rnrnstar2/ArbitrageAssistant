'use client';

import React, { useState, useEffect } from 'react';
import { ConnectionMetrics } from '../../lib/monitoring/types';

interface MetricsChartsPanelProps {
  metrics?: ConnectionMetrics;
}

interface ChartDataPoint {
  timestamp: number;
  value: number;
}

export default function MetricsChartsPanel({ metrics }: MetricsChartsPanelProps) {
  const [latencyHistory, setLatencyHistory] = useState<ChartDataPoint[]>([]);
  const [throughputHistory, setThroughputHistory] = useState<ChartDataPoint[]>([]);
  const [errorRateHistory, setErrorRateHistory] = useState<ChartDataPoint[]>([]);
  const [qualityHistory, setQualityHistory] = useState<ChartDataPoint[]>([]);

  // メトリクスが更新されたときに履歴を更新
  useEffect(() => {
    if (!metrics) return;

    const timestamp = Date.now();
    const maxDataPoints = 60; // 直近60ポイントを保持

    // レイテンシ履歴の更新
    setLatencyHistory(prev => {
      const newHistory = [...prev, { timestamp, value: metrics.performance.averageLatency }];
      return newHistory.slice(-maxDataPoints);
    });

    // スループット履歴の更新
    setThroughputHistory(prev => {
      const newHistory = [...prev, { timestamp, value: metrics.performance.throughput }];
      return newHistory.slice(-maxDataPoints);
    });

    // エラー率履歴の更新
    setErrorRateHistory(prev => {
      const newHistory = [...prev, { timestamp, value: metrics.performance.errorRate }];
      return newHistory.slice(-maxDataPoints);
    });

    // 品質スコア履歴の更新
    setQualityHistory(prev => {
      const newHistory = [...prev, { timestamp, value: metrics.quality.overallScore }];
      return newHistory.slice(-maxDataPoints);
    });
  }, [metrics]);

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Charts</h3>
        <div className="text-center text-gray-500">
          Loading performance data...
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const SimpleLineChart = ({ 
    data, 
    title, 
    unit, 
    color = 'blue',
    maxValue,
    minValue = 0
  }: {
    data: ChartDataPoint[];
    title: string;
    unit: string;
    color?: string;
    maxValue?: number;
    minValue?: number;
  }) => {
    if (data.length === 0) {
      return (
        <div className="bg-gray-50 rounded-lg p-4 h-48 flex items-center justify-center">
          <span className="text-gray-500 text-sm">No data available</span>
        </div>
      );
    }

    const values = data.map(d => d.value);
    const actualMaxValue = maxValue || Math.max(...values);
    const actualMinValue = Math.min(minValue, Math.min(...values));
    const range = actualMaxValue - actualMinValue || 1;

    const svgWidth = 400;
    const svgHeight = 160;
    const padding = 20;
    const chartWidth = svgWidth - 2 * padding;
    const chartHeight = svgHeight - 2 * padding;

    // パスの作成
    const pathData = data.map((point, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((point.value - actualMinValue) / range) * chartHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const currentValue = values[values.length - 1] || 0;
    const previousValue = values[values.length - 2] || currentValue;
    const trend = currentValue > previousValue ? 'up' : currentValue < previousValue ? 'down' : 'stable';

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          <div className="flex items-center space-x-1">
            <span className={`text-lg font-bold text-${color}-600`}>
              {currentValue.toFixed(1)}{unit}
            </span>
            {trend === 'up' && (
              <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {trend === 'down' && (
              <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
        
        <div className="h-40">
          <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
            {/* グリッドライン */}
            <defs>
              <pattern id={`grid-${title}`} width="40" height="32" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 32" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width={svgWidth} height={svgHeight} fill={`url(#grid-${title})`} />
            
            {/* チャートライン */}
            <path 
              d={pathData} 
              fill="none" 
              stroke={`${color === 'blue' ? '#3b82f6' : color === 'green' ? '#10b981' : color === 'red' ? '#ef4444' : '#f59e0b'}`}
              strokeWidth="2"
            />
            
            {/* データポイント */}
            {data.map((point, index) => {
              const x = padding + (index / (data.length - 1)) * chartWidth;
              const y = padding + chartHeight - ((point.value - actualMinValue) / range) * chartHeight;
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="2"
                  fill={`${color === 'blue' ? '#3b82f6' : color === 'green' ? '#10b981' : color === 'red' ? '#ef4444' : '#f59e0b'}`}
                />
              );
            })}
          </svg>
        </div>
        
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>{data.length > 0 ? formatTime(data[0].timestamp) : ''}</span>
          <span>{data.length > 0 ? formatTime(data[data.length - 1].timestamp) : ''}</span>
        </div>
        
        <div className="mt-1 text-xs text-gray-400">
          Range: {actualMinValue.toFixed(1)}{unit} - {actualMaxValue.toFixed(1)}{unit}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Performance Charts</h3>
        <p className="text-sm text-gray-500">Real-time monitoring of WebSocket performance metrics</p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* レイテンシチャート */}
          <SimpleLineChart
            data={latencyHistory}
            title="Average Latency"
            unit="ms"
            color="blue"
          />

          {/* スループットチャート */}
          <SimpleLineChart
            data={throughputHistory}
            title="Message Throughput"
            unit=" msg/s"
            color="green"
          />

          {/* エラー率チャート */}
          <SimpleLineChart
            data={errorRateHistory}
            title="Error Rate"
            unit="%"
            color="red"
            maxValue={100}
          />

          {/* 品質スコアチャート */}
          <SimpleLineChart
            data={qualityHistory}
            title="Overall Quality Score"
            unit="/100"
            color="yellow"
            maxValue={100}
          />
        </div>

        {/* 現在の統計情報 */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-xs text-blue-600 font-medium">Peak Latency</div>
            <div className="text-lg font-bold text-blue-900">{metrics.performance.maxLatency.toFixed(0)}ms</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-xs text-green-600 font-medium">Min Latency</div>
            <div className="text-lg font-bold text-green-900">{metrics.performance.minLatency.toFixed(0)}ms</div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-xs text-purple-600 font-medium">Avg Message Size</div>
            <div className="text-lg font-bold text-purple-900">{metrics.messages.avgMessageSize.toFixed(0)}B</div>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-xs text-orange-600 font-medium">Data Integrity</div>
            <div className="text-lg font-bold text-orange-900">{metrics.quality.dataIntegrity}%</div>
          </div>
        </div>

        {/* パフォーマンスの説明 */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Performance Indicators</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <strong>Latency:</strong> Time taken for message round-trip. Lower is better.
            </div>
            <div>
              <strong>Throughput:</strong> Messages processed per second. Higher indicates better performance.
            </div>
            <div>
              <strong>Error Rate:</strong> Percentage of failed messages. Should be kept below 5%.
            </div>
            <div>
              <strong>Quality Score:</strong> Overall connection quality based on stability and performance.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}