'use client'

import { useState, useMemo } from 'react'
import { HedgePosition } from '../types'
import { Position } from '../../close/types'

interface Account {
  id: string
  broker: string
  accountNumber: string
}

interface HedgePositionGridProps {
  hedgePositions: HedgePosition[]
  positions: Position[]
  accounts: Account[]
  onSelectHedge?: (hedge: HedgePosition) => void
  onUpdateHedge?: (hedgeId: string, updates: Partial<HedgePosition>) => void
  className?: string
}

export function HedgePositionGrid({ 
  hedgePositions, 
  positions,
  accounts, 
  onSelectHedge,
  onUpdateHedge,
  className = '' 
}: HedgePositionGridProps) {
  const [sortField, setSortField] = useState<keyof HedgePosition>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filterSymbol, setFilterSymbol] = useState<string>('')
  const [filterType, setFilterType] = useState<'all' | 'perfect' | 'partial' | 'cross_account'>('all')
  const [filterBalance, setFilterBalance] = useState<'all' | 'balanced' | 'unbalanced'>('all')

  // アカウント情報のマップ
  const accountMap = useMemo(() => {
    return accounts.reduce((map, account) => {
      map.set(account.id, account)
      return map
    }, new Map<string, Account>())
  }, [accounts])

  // ポジション情報のマップ
  const positionMap = useMemo(() => {
    return positions.reduce((map, position) => {
      map.set(position.id, position)
      return map
    }, new Map<string, Position>())
  }, [positions])

  // フィルタリングとソート
  const processedHedgePositions = useMemo(() => {
    let filtered = [...hedgePositions]

    // フィルタリング
    if (filterSymbol) {
      filtered = filtered.filter(hedge => hedge.symbol.includes(filterSymbol.toUpperCase()))
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(hedge => hedge.hedgeType === filterType)
    }
    if (filterBalance !== 'all') {
      filtered = filtered.filter(hedge => 
        filterBalance === 'balanced' ? hedge.isBalanced : !hedge.isBalanced
      )
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
  }, [hedgePositions, filterSymbol, filterType, filterBalance, sortField, sortDirection])

  // 統計情報
  const stats = useMemo(() => {
    const totalProfit = processedHedgePositions.reduce((sum, hedge) => sum + hedge.totalProfit, 0)
    const balancedHedges = processedHedgePositions.filter(hedge => hedge.isBalanced).length
    const unbalancedHedges = processedHedgePositions.filter(hedge => !hedge.isBalanced).length
    const perfectHedges = processedHedgePositions.filter(hedge => hedge.hedgeType === 'perfect').length
    const partialHedges = processedHedgePositions.filter(hedge => hedge.hedgeType === 'partial').length
    const crossAccountHedges = processedHedgePositions.filter(hedge => hedge.hedgeType === 'cross_account').length

    return {
      total: processedHedgePositions.length,
      totalProfit,
      balanced: balancedHedges,
      unbalanced: unbalancedHedges,
      perfect: perfectHedges,
      partial: partialHedges,
      crossAccount: crossAccountHedges
    }
  }, [processedHedgePositions])

  const handleSort = (field: keyof HedgePosition) => {
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

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  const getProfitColor = (profit: number) => {
    if (profit > 0) return 'text-green-600'
    if (profit < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getHedgeTypeColor = (type: string) => {
    switch (type) {
      case 'perfect':
        return 'bg-green-100 text-green-800'
      case 'partial':
        return 'bg-yellow-100 text-yellow-800'
      case 'cross_account':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getHedgeTypeLabel = (type: string) => {
    switch (type) {
      case 'perfect':
        return '完全'
      case 'partial':
        return '部分'
      case 'cross_account':
        return 'クロス'
      default:
        return type
    }
  }

  const getBalanceIndicator = (hedge: HedgePosition) => {
    const buyLots = hedge.totalLots.buy
    const sellLots = hedge.totalLots.sell
    const imbalance = Math.abs(buyLots - sellLots)
    const imbalancePercent = buyLots + sellLots > 0 ? (imbalance / (buyLots + sellLots)) * 100 : 0

    if (hedge.isBalanced) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ✓ バランス
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          ⚠ 不均衡 {formatNumber(imbalancePercent, 1)}%
        </span>
      )
    }
  }

  const getRelatedAccounts = (hedge: HedgePosition) => {
    return hedge.accounts.map(accountId => accountMap.get(accountId)).filter(Boolean)
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* ヘッダー */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">両建てポジション</h3>
          <div className="text-sm text-gray-600">
            {stats.total}両建て
          </div>
        </div>
      </div>

      {/* 統計サマリー */}
      <div className="p-4 border-b bg-blue-50">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">総両建て</div>
            <div className="text-lg font-bold text-gray-800">{stats.total}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">総損益</div>
            <div className={`text-lg font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatNumber(stats.totalProfit, 2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">バランス</div>
            <div className="text-lg font-bold text-green-600">{stats.balanced}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">不均衡</div>
            <div className="text-lg font-bold text-red-600">{stats.unbalanced}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">完全両建て</div>
            <div className="text-lg font-bold text-green-600">{stats.perfect}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">部分両建て</div>
            <div className="text-lg font-bold text-yellow-600">{stats.partial}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">クロス両建て</div>
            <div className="text-lg font-bold text-blue-600">{stats.crossAccount}</div>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-wrap items-center gap-4">
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
              <option value="perfect">完全両建て</option>
              <option value="partial">部分両建て</option>
              <option value="cross_account">クロス両建て</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">バランス:</label>
            <select
              value={filterBalance}
              onChange={(e) => setFilterBalance(e.target.value as any)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">すべて</option>
              <option value="balanced">バランス</option>
              <option value="unbalanced">不均衡</option>
            </select>
          </div>

          <div className="text-sm text-gray-600">
            {processedHedgePositions.length} / {hedgePositions.length} 表示中
          </div>
        </div>
      </div>

      {/* 両建てポジション一覧 */}
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
                  onClick={() => handleSort('hedgeType')}
                  className="flex items-center hover:text-blue-600"
                >
                  タイプ
                  {sortField === 'hedgeType' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-center p-3 font-medium">バランス</th>
              <th className="text-right p-3 font-medium">買い/売りロット</th>
              <th className="text-right p-3 font-medium">
                <button
                  onClick={() => handleSort('totalProfit')}
                  className="flex items-center justify-end hover:text-blue-600"
                >
                  総損益
                  {sortField === 'totalProfit' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-left p-3 font-medium">ポジション数</th>
              <th className="text-left p-3 font-medium">関連口座</th>
              <th className="text-right p-3 font-medium">
                <button
                  onClick={() => handleSort('createdAt')}
                  className="flex items-center justify-end hover:text-blue-600"
                >
                  作成時刻
                  {sortField === 'createdAt' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {processedHedgePositions.map((hedge) => {
              const relatedAccounts = getRelatedAccounts(hedge)
              
              return (
                <tr
                  key={hedge.id}
                  onClick={() => onSelectHedge?.(hedge)}
                  className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <div className="font-medium">{hedge.symbol}</div>
                  </td>
                  
                  <td className="p-3">
                    <span className={`
                      inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                      ${getHedgeTypeColor(hedge.hedgeType)}
                    `}>
                      {getHedgeTypeLabel(hedge.hedgeType)}
                    </span>
                  </td>
                  
                  <td className="p-3 text-center">
                    {getBalanceIndicator(hedge)}
                  </td>
                  
                  <td className="p-3 text-right">
                    <div className="space-y-1">
                      <div className="text-green-600">
                        買い: {formatNumber(hedge.totalLots.buy, 2)}
                      </div>
                      <div className="text-red-600">
                        売り: {formatNumber(hedge.totalLots.sell, 2)}
                      </div>
                    </div>
                  </td>
                  
                  <td className={`p-3 text-right font-mono font-medium ${getProfitColor(hedge.totalProfit)}`}>
                    {formatNumber(hedge.totalProfit, 2)}
                  </td>
                  
                  <td className="p-3">
                    <div className="text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {hedge.positionIds.length}ポジション
                      </span>
                    </div>
                  </td>
                  
                  <td className="p-3">
                    <div className="space-y-1">
                      {relatedAccounts.slice(0, 2).map((account) => (
                        <div key={account.id} className="text-xs">
                          <div className="font-medium">{account.broker}</div>
                          <div className="text-gray-500">{account.accountNumber.slice(-4)}</div>
                        </div>
                      ))}
                      {relatedAccounts.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{relatedAccounts.length - 2}口座
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="p-3 text-right text-xs text-gray-500 font-mono">
                    {formatTime(hedge.createdAt)}
                    {hedge.lastRebalanced && (
                      <div className="text-blue-500">
                        再調整: {formatTime(hedge.lastRebalanced)}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {processedHedgePositions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <div className="text-4xl mb-2">⚖️</div>
              <p>
                {hedgePositions.length === 0 
                  ? '両建てポジションはありません' 
                  : 'フィルター条件に一致する両建てポジションはありません'
                }
              </p>
              {hedgePositions.length === 0 && (
                <p className="text-sm">両建てが検出されるとここに表示されます</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* フッター統計 */}
      {processedHedgePositions.length > 0 && (
        <div className="p-4 border-t bg-gray-50 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div>合計買いロット: {formatNumber(
                processedHedgePositions.reduce((sum, hedge) => sum + hedge.totalLots.buy, 0), 2
              )}</div>
              <div>合計売りロット: {formatNumber(
                processedHedgePositions.reduce((sum, hedge) => sum + hedge.totalLots.sell, 0), 2
              )}</div>
            </div>
            <div className="space-y-1">
              <div>平均損益: {formatNumber(stats.totalProfit / stats.total, 2)}</div>
              <div>バランス率: {formatNumber((stats.balanced / stats.total) * 100, 1)}%</div>
            </div>
            <div className="space-y-1">
              <div>自動リバランス有効: {processedHedgePositions.filter(h => h.settings.autoRebalance).length}</div>
              <div>クローズ時維持: {processedHedgePositions.filter(h => h.settings.maintainOnClose).length}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}