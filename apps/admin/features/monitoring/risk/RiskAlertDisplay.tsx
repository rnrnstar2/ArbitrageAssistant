'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Badge } from '@repo/ui/components/ui/badge'
import { Alert } from '../types'
import { 
  AlertTriangle, 
  AlertCircle,
  Info,
  CheckCircle,
  X,
  Clock,
  Filter,
  RotateCcw
} from 'lucide-react'

interface RiskAlertDisplayProps {
  alerts: Alert[]
  onAcknowledge?: (alertId: string) => void
  onDismiss?: (alertId: string) => void
  onClearAll?: () => void
  maxDisplayCount?: number
}

export function RiskAlertDisplay({
  alerts,
  onAcknowledge,
  onDismiss,
  onClearAll,
  maxDisplayCount = 10
}: RiskAlertDisplayProps) {
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'critical' | 'high'>('unacknowledged')
  const [sortBy, setSortBy] = useState<'timestamp' | 'severity'>('timestamp')

  // アラートのフィルタリングとソート
  const filteredAndSortedAlerts = useMemo(() => {
    let filtered = alerts

    // フィルタリング
    switch (filter) {
      case 'unacknowledged':
        filtered = filtered.filter(alert => !alert.acknowledged)
        break
      case 'critical':
        filtered = filtered.filter(alert => alert.severity === 'critical')
        break
      case 'high':
        filtered = filtered.filter(alert => alert.severity === 'high')
        break
    }

    // ソート
    filtered.sort((a, b) => {
      if (sortBy === 'severity') {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        const comparison = severityOrder[a.severity] - severityOrder[b.severity]
        if (comparison !== 0) return comparison
      }
      // タイムスタンプでのソート（新しい順）
      return b.timestamp.getTime() - a.timestamp.getTime()
    })

    return filtered.slice(0, maxDisplayCount)
  }, [alerts, filter, sortBy, maxDisplayCount])

  // 統計情報
  const alertStats = useMemo(() => {
    const stats = { critical: 0, high: 0, medium: 0, low: 0, unacknowledged: 0 }
    alerts.forEach(alert => {
      stats[alert.severity]++
      if (!alert.acknowledged) stats.unacknowledged++
    })
    return stats
  }, [alerts])

  const getSeverityConfig = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          badgeVariant: 'destructive' as const,
          label: '緊急'
        }
      case 'high':
        return {
          icon: AlertCircle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-300',
          badgeVariant: 'secondary' as const,
          label: '重要'
        }
      case 'medium':
        return {
          icon: Info,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-300',
          badgeVariant: 'secondary' as const,
          label: '警告'
        }
      default:
        return {
          icon: Info,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-300',
          badgeVariant: 'secondary' as const,
          label: '情報'
        }
    }
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  const getTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return `${diffInSeconds}秒前`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分前`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}時間前`
    return `${Math.floor(diffInSeconds / 86400)}日前`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
            リスクアラート
          </CardTitle>
          
          {/* 統計バッジ */}
          <div className="flex items-center space-x-2">
            {alertStats.critical > 0 && (
              <Badge variant="destructive" className="text-xs">
                緊急: {alertStats.critical}
              </Badge>
            )}
            {alertStats.high > 0 && (
              <Badge variant="secondary" className="text-xs">
                重要: {alertStats.high}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              未対応: {alertStats.unacknowledged}
            </Badge>
          </div>
        </div>
        
        {/* フィルターとコントロール */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="all">すべて</option>
                <option value="unacknowledged">未対応</option>
                <option value="critical">緊急のみ</option>
                <option value="high">重要のみ</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">ソート:</span>
              <button
                onClick={() => setSortBy(sortBy === 'timestamp' ? 'severity' : 'timestamp')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {sortBy === 'timestamp' ? '時刻順' : '重要度順'}
              </button>
            </div>
          </div>
          
          {alertStats.unacknowledged > 0 && (
            <button
              onClick={onClearAll}
              className="flex items-center text-sm text-gray-600 hover:text-gray-800"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              すべて確認済み
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {filteredAndSortedAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="font-medium">アラートはありません</p>
            <p className="text-sm">
              {filter === 'unacknowledged' 
                ? 'すべてのアラートが確認済みです' 
                : 'フィルター条件に一致するアラートがありません'
              }
            </p>
          </div>
        ) : (
          <>
            {filteredAndSortedAlerts.map((alert) => {
              const config = getSeverityConfig(alert.severity)
              const Icon = config.icon
              
              return (
                <div
                  key={alert.id}
                  className={`
                    p-3 rounded-lg border-l-4 transition-all
                    ${config.borderColor} ${config.bgColor}
                    ${alert.acknowledged ? 'opacity-60' : ''}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant={config.badgeVariant} className="text-xs">
                            {config.label}
                          </Badge>
                          <span className="text-xs text-gray-500 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {getTimeAgo(alert.timestamp)}
                          </span>
                          {alert.acknowledged && (
                            <Badge variant="outline" className="text-xs">
                              確認済み
                            </Badge>
                          )}
                        </div>
                        
                        <p className={`text-sm ${config.color} font-medium mb-1`}>
                          {alert.message}
                        </p>
                        
                        <div className="text-xs text-gray-600">
                          {formatTime(alert.timestamp)}
                          {alert.accountId && (
                            <span className="ml-2">
                              口座ID: {alert.accountId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* アクションボタン */}
                    <div className="flex items-center space-x-2 ml-3">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => onAcknowledge?.(alert.id)}
                          className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                          title="確認済みにする"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => onDismiss?.(alert.id)}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title="削除"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            
            {/* 表示制限の通知 */}
            {alerts.length > maxDisplayCount && (
              <div className="text-center py-2 text-sm text-gray-500 border-t">
                {alerts.length - maxDisplayCount}件のアラートが非表示
                <button className="ml-2 text-blue-600 hover:text-blue-800">
                  すべて表示
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// 緊急アラート専用の簡易表示コンポーネント
interface EmergencyAlertBannerProps {
  alerts: Alert[]
  onDismiss?: (alertId: string) => void
}

export function EmergencyAlertBanner({ alerts, onDismiss }: EmergencyAlertBannerProps) {
  const emergencyAlerts = alerts.filter(alert => 
    alert.severity === 'critical' && !alert.acknowledged
  )

  if (emergencyAlerts.length === 0) return null

  return (
    <div className="bg-red-600 text-white p-3 rounded-lg shadow-lg animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <span className="font-medium">
            緊急アラート: {emergencyAlerts.length}件の重要な問題が発生しています
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="text-red-100 hover:text-white text-sm underline">
            詳細を確認
          </button>
          <button
            onClick={() => emergencyAlerts.forEach(alert => onDismiss?.(alert.id))}
            className="text-red-100 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {emergencyAlerts.length > 0 && (
        <div className="mt-2 text-sm text-red-100">
          最新: {emergencyAlerts[0].message}
        </div>
      )}
    </div>
  )
}