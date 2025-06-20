'use client'

import { useState, useEffect } from 'react'

interface ConnectionInfo {
  id: string
  type: 'admin_server' | 'ea_connection' | 'price_feed'
  name: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  lastHeartbeat?: Date
  errorMessage?: string
  url?: string
  accountId?: string
  metadata?: Record<string, any>
}

interface ConnectionStatusProps {
  connections: ConnectionInfo[]
  onReconnect?: (connectionId: string) => void
  onDisconnect?: (connectionId: string) => void
  className?: string
}

export function ConnectionStatus({ 
  connections, 
  onReconnect, 
  onDisconnect,
  className = '' 
}: ConnectionStatusProps) {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // 自動更新
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      setLastUpdate(new Date())
    }, 2000) // 2秒ごと

    return () => clearInterval(interval)
  }, [autoRefresh])

  const getStatusColor = (status: ConnectionInfo['status']) => {
    switch (status) {
      case 'connected': return 'bg-green-500'
      case 'connecting': return 'bg-yellow-500 animate-pulse'
      case 'disconnected': return 'bg-gray-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: ConnectionInfo['status']) => {
    switch (status) {
      case 'connected': return '接続中'
      case 'connecting': return '接続中...'
      case 'disconnected': return '切断'
      case 'error': return 'エラー'
      default: return '不明'
    }
  }

  const getStatusTextColor = (status: ConnectionInfo['status']) => {
    switch (status) {
      case 'connected': return 'text-green-600'
      case 'connecting': return 'text-yellow-600'
      case 'disconnected': return 'text-gray-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getTypeIcon = (type: ConnectionInfo['type']) => {
    switch (type) {
      case 'admin_server': return '🌐'
      case 'ea_connection': return '🔗'
      case 'price_feed': return '📈'
      default: return '❓'
    }
  }

  const getTypeLabel = (type: ConnectionInfo['type']) => {
    switch (type) {
      case 'admin_server': return '管理サーバー'
      case 'ea_connection': return 'EA接続'
      case 'price_feed': return '価格フィード'
      default: return '不明'
    }
  }

  const getConnectionQuality = (connection: ConnectionInfo) => {
    if (connection.status !== 'connected') return null

    const now = new Date()
    const lastHeartbeat = connection.lastHeartbeat
    
    if (!lastHeartbeat) return 'unknown'

    const timeDiff = now.getTime() - lastHeartbeat.getTime()
    
    if (timeDiff < 5000) return 'excellent'      // 5秒以内
    if (timeDiff < 15000) return 'good'          // 15秒以内
    if (timeDiff < 30000) return 'fair'          // 30秒以内
    return 'poor'                                 // 30秒以上
  }

  const getQualityColor = (quality: string | null) => {
    switch (quality) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'fair': return 'text-yellow-600'
      case 'poor': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getQualityLabel = (quality: string | null) => {
    switch (quality) {
      case 'excellent': return '優秀'
      case 'good': return '良好'
      case 'fair': return '普通'
      case 'poor': return '悪い'
      default: return '不明'
    }
  }

  const formatLastHeartbeat = (date?: Date) => {
    if (!date) return '不明'
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (seconds < 60) return `${seconds}秒前`
    if (minutes < 60) return `${minutes}分前`
    if (hours < 24) return `${hours}時間前`
    return date.toLocaleString('ja-JP')
  }

  // 接続統計
  const stats = {
    total: connections.length,
    connected: connections.filter(c => c.status === 'connected').length,
    disconnected: connections.filter(c => c.status === 'disconnected').length,
    error: connections.filter(c => c.status === 'error').length,
    connecting: connections.filter(c => c.status === 'connecting').length
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* ヘッダー */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">接続状態</h3>
          <div className="flex items-center space-x-3">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              自動更新
            </label>
            <span className="text-sm text-gray-600">
              {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* 統計サマリー */}
      <div className="p-4 border-b bg-blue-50">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">総接続数</div>
            <div className="text-lg font-bold text-gray-800">{stats.total}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">接続中</div>
            <div className="text-lg font-bold text-green-600">{stats.connected}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">接続試行中</div>
            <div className="text-lg font-bold text-yellow-600">{stats.connecting}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">切断</div>
            <div className="text-lg font-bold text-gray-600">{stats.disconnected}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">エラー</div>
            <div className="text-lg font-bold text-red-600">{stats.error}</div>
          </div>
        </div>
      </div>

      {/* 接続一覧 */}
      <div className="p-4">
        <div className="space-y-3">
          {connections.map((connection) => {
            const quality = getConnectionQuality(connection)
            
            return (
              <div
                key={connection.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                {/* ヘッダー行 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="text-xl">{getTypeIcon(connection.type)}</div>
                    <div>
                      <div className="font-medium text-gray-800">{connection.name}</div>
                      <div className="text-sm text-gray-600">{getTypeLabel(connection.type)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(connection.status)}`} />
                    <span className={`text-sm font-medium ${getStatusTextColor(connection.status)}`}>
                      {getStatusText(connection.status)}
                    </span>
                  </div>
                </div>

                {/* 詳細情報 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  {connection.url && (
                    <div>
                      <span className="text-gray-600">URL:</span>
                      <div className="font-mono text-xs break-all">{connection.url}</div>
                    </div>
                  )}
                  
                  {connection.accountId && (
                    <div>
                      <span className="text-gray-600">アカウント:</span>
                      <div className="font-medium">{connection.accountId}</div>
                    </div>
                  )}
                  
                  <div>
                    <span className="text-gray-600">最終通信:</span>
                    <div className="font-medium">{formatLastHeartbeat(connection.lastHeartbeat)}</div>
                  </div>
                  
                  {quality && (
                    <div>
                      <span className="text-gray-600">接続品質:</span>
                      <div className={`font-medium ${getQualityColor(quality)}`}>
                        {getQualityLabel(quality)}
                      </div>
                    </div>
                  )}
                </div>

                {/* エラーメッセージ */}
                {connection.errorMessage && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                    <div className="text-sm text-red-800">
                      <strong>エラー:</strong> {connection.errorMessage}
                    </div>
                  </div>
                )}

                {/* メタデータ */}
                {connection.metadata && Object.keys(connection.metadata).length > 0 && (
                  <div className="mt-3">
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                        詳細情報 ▼
                      </summary>
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <pre className="whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(connection.metadata, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>
                )}

                {/* アクションボタン */}
                <div className="mt-3 flex space-x-2">
                  {(connection.status === 'disconnected' || connection.status === 'error') && (
                    <button
                      onClick={() => onReconnect?.(connection.id)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      再接続
                    </button>
                  )}
                  
                  {connection.status === 'connected' && (
                    <button
                      onClick={() => onDisconnect?.(connection.id)}
                      className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 transition-colors"
                    >
                      切断
                    </button>
                  )}
                  
                  {connection.status === 'connecting' && (
                    <button
                      onClick={() => onDisconnect?.(connection.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                    >
                      キャンセル
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {connections.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🔌</div>
            <p>接続情報がありません</p>
            <p className="text-sm">システムの初期化中かもしれません</p>
          </div>
        )}
      </div>

      {/* 全体の接続健全性 */}
      {connections.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-gray-600">システム健全性: </span>
              <span className={`font-medium ${
                stats.error > 0 ? 'text-red-600' :
                stats.disconnected > 0 ? 'text-yellow-600' :
                stats.connected === stats.total ? 'text-green-600' : 'text-gray-600'
              }`}>
                {stats.error > 0 ? 'エラーあり' :
                 stats.disconnected > 0 ? '一部切断' :
                 stats.connected === stats.total ? '正常' : '接続中'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              接続率: {stats.total > 0 ? Math.round((stats.connected / stats.total) * 100) : 0}%
            </div>
          </div>
        </div>
      )}
    </div>
  )
}