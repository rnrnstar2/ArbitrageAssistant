'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRealtimePositions } from '../../trading/hooks/useRealtimePositions'
import { Position, Account } from '../../trading/graphql/queries'
import { DashboardConfig } from '../types'

interface RealtimePositionGridProps {
  config: DashboardConfig
  onPositionSelect?: (position: Position | null) => void
  selectedPositionId?: string | null
  className?: string
  height?: number
  autoRefreshInterval?: number
  onActionClick?: (action: 'close' | 'trail' | 'hedge', position: Position) => void
}

interface PositionFilters {
  symbols?: string[]
  accountIds?: string[]
  type?: 'buy' | 'sell'
  profitThreshold?: number
}

export function RealtimePositionGrid({
  config,
  onPositionSelect,
  selectedPositionId,
  className = '',
  height = 400,
  autoRefreshInterval = 1000,
  onActionClick
}: RealtimePositionGridProps) {
  const { positions, accounts, loading, error, refetch, connectionStatus } = useRealtimePositions()
  const [sortField, setSortField] = useState<keyof Position>('updatedAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState<PositionFilters>({})
  const [scrollTop, setScrollTop] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // バーチャル化のための設定
  const itemHeight = config.displaySettings.compactView ? 40 : 60
  const visibleCount = Math.ceil(height / itemHeight)
  const startIndex = Math.floor(scrollTop / itemHeight)

  // リアルタイム更新
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const interval = setInterval(() => {
        refetch()
      }, autoRefreshInterval)
      
      return () => clearInterval(interval)
    }
  }, [autoRefreshInterval, refetch])

  // アカウント情報のマップ（パフォーマンス最適化）
  const accountMap = useMemo(() => {
    return accounts.reduce((map, account) => {
      map.set(account.id, account)
      return map
    }, new Map<string, Account>())
  }, [accounts])

  // フィルタリングとソート済みのポジション
  const processedPositions = useMemo(() => {
    let filtered = [...positions]

    // 設定に基づくフィルタリング
    if (config.filters.accountIds?.length) {
      filtered = filtered.filter(p => config.filters.accountIds!.includes(p.accountId))
    }
    if (config.filters.symbols?.length) {
      filtered = filtered.filter(p => config.filters.symbols!.includes(p.symbol))
    }
    if (config.filters.profitThreshold !== undefined) {
      filtered = filtered.filter(p => p.profit >= config.filters.profitThreshold!)
    }

    // 追加フィルタリング
    if (filters.symbols?.length) {
      filtered = filtered.filter(p => filters.symbols!.includes(p.symbol))
    }
    if (filters.accountIds?.length) {
      filtered = filtered.filter(p => filters.accountIds!.includes(p.accountId))
    }
    if (filters.type) {
      filtered = filtered.filter(p => p.type === filters.type)
    }
    if (filters.profitThreshold !== undefined) {
      if (filters.profitThreshold > 0) {
        filtered = filtered.filter(p => p.profit >= filters.profitThreshold!)
      } else {
        filtered = filtered.filter(p => p.profit <= filters.profitThreshold!)
      }
    }

    // ソート
    filtered.sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (aValue === bValue) return 0
      if (aValue === undefined && bValue === undefined) return 0
      if (aValue === undefined) return 1
      if (bValue === undefined) return -1
      
      let comparison = 0
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue)
      } else {
        comparison = aValue > bValue ? 1 : -1
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [positions, config.filters, filters, sortField, sortDirection])

  // バーチャル化のための表示アイテム
  const visibleItems = useMemo(() => {
    const endIndex = Math.min(startIndex + visibleCount + 1, processedPositions.length)
    return processedPositions.slice(startIndex, endIndex).map((position, index) => ({
      position,
      index: startIndex + index,
      account: accountMap.get(position.accountId)
    }))
  }, [processedPositions, accountMap, startIndex, visibleCount])

  const handleSort = useCallback((field: keyof Position) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const handleFilterChange = useCallback((newFilters: Partial<PositionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const formatNumber = useCallback((num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }, [])

  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }, [])

  const getProfitColor = useCallback((profit: number) => {
    if (!config.displaySettings.showProfitColors) return 'text-gray-900'
    
    if (profit > 0) return 'text-green-600'
    if (profit < 0) return 'text-red-600'
    return 'text-gray-600'
  }, [config.displaySettings.showProfitColors])

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600'
      case 'connecting': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      case 'disconnected': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">ポジションを読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border flex flex-col ${className}`} style={{ height }}>
      {/* ヘッダー */}
      <div className="flex-shrink-0 bg-gray-50 border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-800">リアルタイム ポジション</h3>
            <div className={`text-sm ${getConnectionStatusColor(connectionStatus)}`}>
              <span className="inline-block w-2 h-2 rounded-full mr-2 bg-current"></span>
              {connectionStatus === 'connected' ? 'リアルタイム接続中' : '接続中...'}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">{processedPositions.length} ポジション</span>
            <button
              onClick={() => refetch()}
              className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-300 hover:border-blue-500"
              disabled={loading}
            >
              更新
            </button>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex items-center space-x-4">
          <select
            className="border rounded px-3 py-1 text-sm"
            value={filters.symbols?.[0] || ''}
            onChange={(e) => handleFilterChange({ 
              symbols: e.target.value ? [e.target.value] : undefined 
            })}
          >
            <option value="">全通貨ペア</option>
            {Array.from(new Set(positions.map(p => p.symbol))).map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
          
          <select
            className="border rounded px-3 py-1 text-sm"
            value={filters.accountIds?.[0] || ''}
            onChange={(e) => handleFilterChange({ 
              accountIds: e.target.value ? [e.target.value] : undefined 
            })}
          >
            <option value="">全アカウント</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.broker} - {account.accountNumber}
              </option>
            ))}
          </select>

          <select
            className="border rounded px-3 py-1 text-sm"
            value={filters.type || ''}
            onChange={(e) => handleFilterChange({ 
              type: e.target.value as 'buy' | 'sell' | undefined 
            })}
          >
            <option value="">全方向</option>
            <option value="buy">買い</option>
            <option value="sell">売り</option>
          </select>

          <input
            type="number"
            placeholder="損益フィルタ"
            className="border rounded px-3 py-1 text-sm w-32"
            onChange={(e) => handleFilterChange({ 
              profitThreshold: e.target.value ? parseFloat(e.target.value) : undefined 
            })}
          />
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="flex-shrink-0 p-4 border-b bg-red-50">
          <div className="flex items-center space-x-2">
            <div className="text-red-600">⚠️</div>
            <div>
              <div className="text-sm font-medium text-red-800">接続エラー</div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* テーブルヘッダー */}
      <div className="flex-shrink-0 bg-gray-50 border-b">
        <div className="flex items-center px-4 py-2 text-sm font-medium text-gray-700">
          <SortButton
            label="通貨ペア"
            field="symbol"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={handleSort}
            className="w-20"
          />
          <SortButton
            label="方向"
            field="type"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={handleSort}
            className="w-16"
          />
          <SortButton
            label="ロット"
            field="lots"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={handleSort}
            className="w-16 text-right"
          />
          <SortButton
            label="約定価格"
            field="openPrice"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={handleSort}
            className="w-24 text-right"
          />
          <SortButton
            label="現在価格"
            field="currentPrice"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={handleSort}
            className="w-24 text-right"
          />
          <SortButton
            label="損益"
            field="profit"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={handleSort}
            className="w-20 text-right"
          />
          <div className="w-24">アカウント</div>
          <div className="w-24">アクション</div>
          <SortButton
            label="更新時刻"
            field="updatedAt"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={handleSort}
            className="w-20 text-right"
          />
        </div>
      </div>

      {/* バーチャル化されたコンテンツ */}
      <div 
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
        ref={scrollContainerRef}
      >
        <div style={{ height: processedPositions.length * itemHeight, position: 'relative' }}>
          {visibleItems.map(({ position, index, account }) => (
            <PositionRow
              key={position.id}
              position={position}
              account={account}
              index={index}
              itemHeight={itemHeight}
              isSelected={position.id === selectedPositionId}
              isCompact={config.displaySettings.compactView}
              onSelect={() => onPositionSelect?.(position)}
              onActionClick={onActionClick}
              formatNumber={formatNumber}
              formatTime={formatTime}
              getProfitColor={getProfitColor}
            />
          ))}
        </div>

        {processedPositions.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">📈</div>
              <p>ポジションがありません</p>
              <p className="text-sm">トレードを開始するとここに表示されます</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ソート可能ヘッダーボタン
interface SortButtonProps {
  label: string
  field: keyof Position
  currentField: keyof Position
  currentDirection: 'asc' | 'desc'
  onSort: (field: keyof Position) => void
  className?: string
}

function SortButton({ label, field, currentField, currentDirection, onSort, className = '' }: SortButtonProps) {
  return (
    <div className={className}>
      <button
        onClick={() => onSort(field)}
        className="flex items-center hover:text-blue-600 transition-colors"
      >
        {label}
        {currentField === field && (
          <span className="ml-1 text-xs">
            {currentDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    </div>
  )
}

// 最適化されたポジション行コンポーネント
interface PositionRowProps {
  position: Position
  account?: Account
  index: number
  itemHeight: number
  isSelected: boolean
  isCompact: boolean
  onSelect: () => void
  onActionClick?: (action: 'close' | 'trail' | 'hedge', position: Position) => void
  formatNumber: (num: number, decimals?: number) => string
  formatTime: (dateString: string) => string
  getProfitColor: (profit: number) => string
}

const PositionRow = React.memo<PositionRowProps>(({
  position,
  account,
  index,
  itemHeight,
  isSelected,
  isCompact,
  onSelect,
  onActionClick,
  formatNumber,
  formatTime,
  getProfitColor
}) => {
  return (
    <div
      className={`
        absolute w-full border-b cursor-pointer hover:bg-gray-50 transition-colors flex items-center px-4
        ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}
      `}
      style={{
        top: index * itemHeight,
        height: itemHeight
      }}
      onClick={onSelect}
    >
      {/* 通貨ペア */}
      <div className="w-20 font-medium text-sm">{position.symbol}</div>
      
      {/* 方向 */}
      <div className="w-16">
        <span className={`
          inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
          ${position.type === 'buy' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
          }
        `}>
          {position.type === 'buy' ? 'BUY' : 'SELL'}
        </span>
      </div>
      
      {/* ロット */}
      <div className="w-16 text-right text-sm">
        {formatNumber(position.lots, 2)}
      </div>
      
      {/* 約定価格 */}
      <div className="w-24 text-right text-sm font-mono">
        {formatNumber(position.openPrice, 5)}
      </div>
      
      {/* 現在価格 */}
      <div className="w-24 text-right text-sm font-mono">
        {formatNumber(position.currentPrice, 5)}
      </div>
      
      {/* 損益 */}
      <div className={`w-20 text-right text-sm font-mono font-medium ${getProfitColor(position.profit)}`}>
        {formatNumber(position.profit, 2)}
      </div>
      
      {/* アカウント */}
      <div className="w-24 text-xs">
        {account && (
          <>
            <div className="font-medium truncate">{account.broker}</div>
            {!isCompact && (
              <div className="text-gray-500 truncate">{account.accountNumber.slice(-4)}</div>
            )}
          </>
        )}
      </div>
      
      {/* アクション */}
      <div className="w-24 flex items-center space-x-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onActionClick?.('close', position)
          }}
          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          title="決済"
        >
          決済
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onActionClick?.('trail', position)
          }}
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          title="トレール"
        >
          T
        </button>
      </div>
      
      {/* 更新時刻 */}
      <div className="w-20 text-right text-xs text-gray-500 font-mono">
        {formatTime(position.updatedAt)}
      </div>
    </div>
  )
})

PositionRow.displayName = 'PositionRow'