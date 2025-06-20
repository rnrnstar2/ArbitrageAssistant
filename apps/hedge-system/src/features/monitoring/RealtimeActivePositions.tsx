'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRealtimePositions } from '../trading/hooks/useRealtimePositions'
import { Position, Account } from '../trading/graphql/queries'

interface RealtimeActivePositionsProps {
  onPositionClick?: (position: Position) => void
  className?: string
  autoRefreshInterval?: number // in milliseconds
}

export function RealtimeActivePositions({ 
  onPositionClick,
  className = '',
  autoRefreshInterval = 30000 // 30 seconds default
}: RealtimeActivePositionsProps) {
  const { positions, accounts, loading, error, refetch, connectionStatus } = useRealtimePositions()
  const [sortField, setSortField] = useState<keyof Position>('updatedAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filterSymbol, setFilterSymbol] = useState<string>('')
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Auto-refresh every interval
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const interval = setInterval(() => {
        refetch()
        setLastRefresh(new Date())
      }, autoRefreshInterval)
      
      return () => clearInterval(interval)
    }
  }, [autoRefreshInterval, refetch])

  // アカウント情報のマップ
  const accountMap = useMemo(() => {
    return accounts.reduce((map, account) => {
      map.set(account.id, account)
      return map
    }, new Map<string, Account>())
  }, [accounts])

  // フィルタリングとソート
  const processedPositions = useMemo(() => {
    let filtered = [...positions]

    // フィルタリング
    if (filterSymbol) {
      filtered = filtered.filter(pos => pos.symbol.includes(filterSymbol.toUpperCase()))
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(pos => pos.type === filterType)
    }

    // ソート
    filtered.sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (aValue === bValue) return 0
      
      let comparison = 0
      if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime()
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue)
      } else {
        comparison = aValue > bValue ? 1 : -1
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [positions, filterSymbol, filterType, sortField, sortDirection])

  // 統計情報
  const stats = useMemo(() => {
    const totalProfit = processedPositions.reduce((sum, pos) => sum + pos.profit, 0)
    const profitablePositions = processedPositions.filter(pos => pos.profit > 0).length
    const losingPositions = processedPositions.filter(pos => pos.profit < 0).length
    const buyPositions = processedPositions.filter(pos => pos.type === 'buy').length
    const sellPositions = processedPositions.filter(pos => pos.type === 'sell').length

    return {
      total: processedPositions.length,
      totalProfit,
      profitable: profitablePositions,
      losing: losingPositions,
      buy: buyPositions,
      sell: sellPositions
    }
  }, [processedPositions])

  const handleSort = (field: keyof Position) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getProfitColor = (profit: number) => {
    if (profit > 0) return 'text-green-600'
    if (profit < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600'
      case 'connecting': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      case 'disconnected': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getConnectionStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'リアルタイム接続中'
      case 'connecting': return '接続中...'
      case 'error': return '接続エラー'
      case 'disconnected': return '切断'
      default: return '不明'
    }
  }

  const handleManualRefresh = () => {
    refetch()
    setLastRefresh(new Date())
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">ポジションデータを読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* ヘッダー */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-800">リアルタイム ポジション</h3>
            <div className={`text-sm ${getConnectionStatusColor(connectionStatus)}`}>
              <span className="inline-block w-2 h-2 rounded-full mr-2 bg-current"></span>
              {getConnectionStatusText(connectionStatus)}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-600">
              {stats.total}ポジション
            </div>
            <button
              onClick={handleManualRefresh}
              className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-300 hover:border-blue-500"
              disabled={loading}
            >
              更新
            </button>
          </div>
        </div>
        {lastRefresh && (
          <div className="text-xs text-gray-500 mt-1">
            最終更新: {formatTime(lastRefresh.toISOString())}
          </div>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="p-4 border-b bg-red-50">
          <div className="flex items-center space-x-2">
            <div className="text-red-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-red-800">接続エラー</div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* 統計サマリー */}
      <div className="p-4 border-b bg-blue-50">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">総ポジション</div>
            <div className="text-lg font-bold text-gray-800">{stats.total}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">総損益</div>
            <div className={`text-lg font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatNumber(stats.totalProfit, 2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">利益ポジション</div>
            <div className="text-lg font-bold text-green-600">{stats.profitable}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">損失ポジション</div>
            <div className="text-lg font-bold text-red-600">{stats.losing}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">買いポジション</div>
            <div className="text-lg font-bold text-blue-600">{stats.buy}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">売りポジション</div>
            <div className="text-lg font-bold text-purple-600">{stats.sell}</div>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">通貨ペア:</label>
            <input
              type="text"
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
              placeholder="例: EUR, USD"
              className="border rounded px-2 py-1 text-sm w-32"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">タイプ:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">すべて</option>
              <option value="buy">買い</option>
              <option value="sell">売り</option>
            </select>
          </div>

          <div className="text-sm text-gray-600">
            {processedPositions.length} / {positions.length} 表示中
          </div>
        </div>
      </div>

      {/* ポジション一覧 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">
                <button
                  onClick={() => handleSort('symbol')}
                  className="flex items-center hover:text-blue-600"
                >
                  通貨ペア
                  {sortField === 'symbol' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-left p-3 font-medium">
                <button
                  onClick={() => handleSort('type')}
                  className="flex items-center hover:text-blue-600"
                >
                  方向
                  {sortField === 'type' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-right p-3 font-medium">
                <button
                  onClick={() => handleSort('lots')}
                  className="flex items-center justify-end hover:text-blue-600"
                >
                  ロット
                  {sortField === 'lots' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-right p-3 font-medium">
                <button
                  onClick={() => handleSort('openPrice')}
                  className="flex items-center justify-end hover:text-blue-600"
                >
                  約定価格
                  {sortField === 'openPrice' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-right p-3 font-medium">
                <button
                  onClick={() => handleSort('currentPrice')}
                  className="flex items-center justify-end hover:text-blue-600"
                >
                  現在価格
                  {sortField === 'currentPrice' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-right p-3 font-medium">
                <button
                  onClick={() => handleSort('profit')}
                  className="flex items-center justify-end hover:text-blue-600"
                >
                  損益
                  {sortField === 'profit' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-left p-3 font-medium">アカウント</th>
              <th className="text-right p-3 font-medium">
                <button
                  onClick={() => handleSort('openedAt')}
                  className="flex items-center justify-end hover:text-blue-600"
                >
                  開始時刻
                  {sortField === 'openedAt' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-right p-3 font-medium">
                <button
                  onClick={() => handleSort('updatedAt')}
                  className="flex items-center justify-end hover:text-blue-600"
                >
                  更新時刻
                  {sortField === 'updatedAt' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {processedPositions.map((position) => {
              const account = accountMap.get(position.accountId) || position.account
              
              return (
                <tr
                  key={position.id}
                  onClick={() => onPositionClick?.(position)}
                  className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <div className="font-medium">{position.symbol}</div>
                  </td>
                  
                  <td className="p-3">
                    <span className={`
                      inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                      ${position.type === 'buy' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                      }
                    `}>
                      {position.type === 'buy' ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  
                  <td className="p-3 text-right">
                    {formatNumber(position.lots, 2)}
                  </td>
                  
                  <td className="p-3 text-right font-mono">
                    {formatNumber(position.openPrice, 5)}
                  </td>
                  
                  <td className="p-3 text-right font-mono">
                    {formatNumber(position.currentPrice, 5)}
                  </td>
                  
                  <td className={`p-3 text-right font-mono font-medium ${getProfitColor(position.profit)}`}>
                    {formatNumber(position.profit, 2)}
                  </td>
                  
                  <td className="p-3">
                    {account && (
                      <div className="text-xs">
                        <div className="font-medium">{account.broker}</div>
                        <div className="text-gray-500">{account.accountNumber.slice(-4)}</div>
                      </div>
                    )}
                  </td>
                  
                  <td className="p-3 text-right text-xs text-gray-500 font-mono">
                    {formatDateTime(position.openedAt)}
                  </td>
                  
                  <td className="p-3 text-right text-xs text-gray-500 font-mono">
                    {formatTime(position.updatedAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {processedPositions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <div className="text-4xl mb-2">📈</div>
              <p>
                {positions.length === 0 
                  ? 'アクティブなポジションはありません' 
                  : 'フィルター条件に一致するポジションはありません'
                }
              </p>
              {positions.length === 0 && (
                <p className="text-sm">トレードを開始するとここに表示されます</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* フッター統計 */}
      {processedPositions.length > 0 && (
        <div className="p-4 border-t bg-gray-50 text-sm">
          <div className="flex justify-between items-center">
            <div className="space-x-4">
              <span>合計ロット: {formatNumber(processedPositions.reduce((sum, pos) => sum + pos.lots, 0), 2)}</span>
              <span>平均損益: {formatNumber(stats.totalProfit / stats.total, 2)}</span>
            </div>
            <div className="text-gray-600">
              勝率: {formatNumber((stats.profitable / stats.total) * 100, 1)}%
            </div>
          </div>
        </div>
      )}
    </div>
  )
}