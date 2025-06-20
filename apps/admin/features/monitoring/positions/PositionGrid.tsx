'use client'

import { useState, useMemo } from 'react'
import { Position, Account, PositionFilters, PositionMonitorConfig } from '../types'

interface PositionGridProps {
  positions: Position[]
  accounts: Account[]
  config: PositionMonitorConfig
  selectedPositionId: string | null
  onPositionSelect: (positionId: string | null) => void
  onFilterChange: (filters: Partial<PositionFilters>) => void
}

export function PositionGrid({
  positions,
  accounts,
  config,
  selectedPositionId,
  onPositionSelect,
  onFilterChange
}: PositionGridProps) {
  const [sortField, setSortField] = useState<keyof Position>('updateTime')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // アカウント情報のマップ
  const accountMap = useMemo(() => {
    return accounts.reduce((map, account) => {
      map.set(account.id, account)
      return map
    }, new Map<string, Account>())
  }, [accounts])

  // ソートされたポジション
  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (aValue === bValue) return 0
      if (aValue === undefined && bValue === undefined) return 0
      if (aValue === undefined) return 1
      if (bValue === undefined) return -1
      
      const comparison = aValue > bValue ? 1 : -1
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [positions, sortField, sortDirection])

  const handleSort = (field: keyof Position) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getProfitColor = (profit: number) => {
    if (!config.displaySettings.showProfitColors) return 'text-gray-900'
    
    if (profit > 0) return 'text-green-600'
    if (profit < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getTrailIndicator = (position: Position) => {
    if (!config.displaySettings.showTrailIndicators || !position.trailSettings?.enabled) {
      return null
    }
    
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        トレール
      </span>
    )
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  return (
    <div className="h-full flex flex-col">
      {/* ツールバー */}
      <div className="bg-gray-50 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <select
              className="border rounded px-3 py-1 text-sm"
              onChange={(e) => onFilterChange({ 
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
              onChange={(e) => onFilterChange({ 
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

            <input
              type="number"
              placeholder="損益フィルタ"
              className="border rounded px-3 py-1 text-sm w-32"
              onChange={(e) => onFilterChange({ 
                profitThreshold: e.target.value ? parseFloat(e.target.value) : undefined 
              })}
            />
          </div>

          <div className="text-sm text-gray-600">
            {positions.length} ポジション表示中
          </div>
        </div>
      </div>

      {/* テーブル */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left p-3 border-b font-medium">
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
              <th className="text-left p-3 border-b font-medium">
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
              <th className="text-right p-3 border-b font-medium">
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
              <th className="text-right p-3 border-b font-medium">
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
              <th className="text-right p-3 border-b font-medium">
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
              <th className="text-right p-3 border-b font-medium">
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
              <th className="text-left p-3 border-b font-medium">アカウント</th>
              <th className="text-center p-3 border-b font-medium">状態</th>
              <th className="text-right p-3 border-b font-medium">
                <button
                  onClick={() => handleSort('updateTime')}
                  className="flex items-center justify-end hover:text-blue-600"
                >
                  更新時刻
                  {sortField === 'updateTime' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((position) => {
              const account = accountMap.get(position.accountId)
              const isSelected = position.id === selectedPositionId
              
              return (
                <tr
                  key={position.id}
                  onClick={() => onPositionSelect(position.id)}
                  className={`
                    border-b cursor-pointer hover:bg-gray-50 transition-colors
                    ${isSelected ? 'bg-blue-50 border-blue-200' : ''}
                    ${config.displaySettings.compactView ? 'h-8' : 'h-12'}
                  `}
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
                        <div className="text-gray-500">{account.accountNumber}</div>
                      </div>
                    )}
                  </td>
                  
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      {getTrailIndicator(position)}
                      {position.closeSettings && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          決済予約
                        </span>
                      )}
                    </div>
                  </td>
                  
                  <td className="p-3 text-right text-xs text-gray-500 font-mono">
                    {formatTime(position.updateTime)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {positions.length === 0 && (
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