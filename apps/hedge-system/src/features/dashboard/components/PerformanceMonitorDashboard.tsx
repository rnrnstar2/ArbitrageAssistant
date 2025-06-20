'use client'

import React, { useState, useEffect } from 'react'
import { 
  usePerformanceOptimization,
  PerformanceMetrics,
  MemoryStats
} from '../services/PerformanceOptimizationService'

export interface PerformanceMonitorDashboardProps {
  className?: string
  onOptimizationTriggered?: () => void
}

export const PerformanceMonitorDashboard: React.FC<PerformanceMonitorDashboardProps> = ({
  className = '',
  onOptimizationTriggered
}) => {
  const {
    getMetrics,
    getMemoryStats,
    optimizeMemory,
    checkAlerts,
    setConnectionCount,
    setMessageRate,
    setUpdateRate
  } = usePerformanceOptimization()

  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [autoOptimize, setAutoOptimize] = useState(true)

  // パフォーマンス監視の更新
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(getMetrics())
      setMemoryStats(getMemoryStats())
      setAlerts(checkAlerts())
    }, 1000)

    return () => clearInterval(interval)
  }, [getMetrics, getMemoryStats, checkAlerts])

  // 自動最適化
  useEffect(() => {
    if (autoOptimize && alerts.length > 0) {
      const criticalAlerts = alerts.filter(alert => alert.level === 'critical')
      if (criticalAlerts.some(alert => alert.type === 'memory')) {
        optimizeMemory()
        onOptimizationTriggered?.()
      }
    }
  }, [alerts, autoOptimize, optimizeMemory, onOptimizationTriggered])

  const handleManualOptimization = () => {
    optimizeMemory()
    onOptimizationTriggered?.()
  }

  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toFixed(decimals)
  }

  const getMetricColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-600 bg-red-100'
    if (value >= thresholds.warning) return 'text-orange-600 bg-orange-100'
    return 'text-green-600 bg-green-100'
  }

  const getMemoryColor = (usedMemory: number) => {
    return getMetricColor(usedMemory, { warning: 300, critical: 500 })
  }

  const getRenderColor = (renderTime: number) => {
    return getMetricColor(renderTime, { warning: 16, critical: 33 })
  }

  const getCacheColor = (hitRate: number) => {
    if (hitRate >= 80) return 'text-green-600 bg-green-100'
    if (hitRate >= 50) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  if (!metrics || !memoryStats) {
    return (
      <div className={`border rounded-lg p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`border rounded-lg p-4 space-y-4 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">パフォーマンス監視</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleManualOptimization}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
          >
            最適化実行
          </button>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={autoOptimize}
              onChange={(e) => setAutoOptimize(e.target.checked)}
              className="rounded"
            />
            <span>自動最適化</span>
          </label>
        </div>
      </div>

      {/* アラート */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-2 rounded text-sm ${
                alert.level === 'critical'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-orange-100 text-orange-800 border border-orange-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {alert.level === 'critical' ? '🚨' : '⚠️'} {alert.message}
                </span>
                <span className="text-xs opacity-75">
                  {alert.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* メトリクス表示 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* メモリ使用量 */}
        <div className="bg-white border rounded p-3">
          <div className="text-sm text-gray-600 mb-1">メモリ使用量</div>
          <div className={`text-lg font-bold px-2 py-1 rounded ${getMemoryColor(metrics.memoryUsage)}`}>
            {formatNumber(metrics.memoryUsage)} MB
          </div>
          <div className="text-xs text-gray-500 mt-1">
            / {formatNumber(memoryStats.totalMemory / 1024 / 1024)} MB
          </div>
        </div>

        {/* レンダリング時間 */}
        <div className="bg-white border rounded p-3">
          <div className="text-sm text-gray-600 mb-1">レンダリング</div>
          <div className={`text-lg font-bold px-2 py-1 rounded ${getRenderColor(metrics.renderTime)}`}>
            {formatNumber(metrics.renderTime)} ms
          </div>
          <div className="text-xs text-gray-500 mt-1">
            平均時間
          </div>
        </div>

        {/* キャッシュヒット率 */}
        <div className="bg-white border rounded p-3">
          <div className="text-sm text-gray-600 mb-1">キャッシュ効率</div>
          <div className={`text-lg font-bold px-2 py-1 rounded ${getCacheColor(metrics.cacheHitRate)}`}>
            {formatNumber(metrics.cacheHitRate)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ヒット率
          </div>
        </div>

        {/* 接続数 */}
        <div className="bg-white border rounded p-3">
          <div className="text-sm text-gray-600 mb-1">接続数</div>
          <div className={`text-lg font-bold px-2 py-1 rounded ${
            getMetricColor(metrics.connectionCount, { warning: 40, critical: 50 })
          }`}>
            {metrics.connectionCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            クライアント
          </div>
        </div>
      </div>

      {/* 詳細メトリクス */}
      <div className="border-t pt-4">
        <h4 className="text-md font-medium mb-3">詳細メトリクス</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 通信統計 */}
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-gray-700">通信統計</h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>WebSocketメッセージ率:</span>
                <span className="font-mono">{formatNumber(metrics.wsMessageRate)} msg/s</span>
              </div>
              <div className="flex justify-between">
                <span>データ更新率:</span>
                <span className="font-mono">{formatNumber(metrics.dataUpdateRate)} upd/s</span>
              </div>
            </div>
          </div>

          {/* システム統計 */}
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-gray-700">システム統計</h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>ヒープサイズ:</span>
                <span className="font-mono">{formatNumber(memoryStats.heapSize)} MB</span>
              </div>
              <div className="flex justify-between">
                <span>空きメモリ:</span>
                <span className="font-mono">{formatNumber(memoryStats.freeMemory)} MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* システム制御 */}
      <div className="border-t pt-4">
        <h4 className="text-md font-medium mb-3">システム制御</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              接続数設定
            </label>
            <input
              type="number"
              min="0"
              max="50"
              defaultValue={metrics.connectionCount}
              onChange={(e) => setConnectionCount(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-1 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メッセージ率 (msg/s)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              defaultValue={metrics.wsMessageRate}
              onChange={(e) => setMessageRate(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              更新率 (upd/s)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              defaultValue={metrics.dataUpdateRate}
              onChange={(e) => setUpdateRate(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1 border rounded text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default PerformanceMonitorDashboard