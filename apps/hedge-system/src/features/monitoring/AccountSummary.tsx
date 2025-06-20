'use client'

import { useState, useEffect } from 'react'

interface Account {
  id: string
  broker: string
  accountNumber: string
  balance: number
  equity: number
  margin: number
  marginLevel: number
  bonusAmount: number
  status: 'connected' | 'disconnected' | 'error'
  positions: Position[]
}

interface Position {
  id: string
  symbol: string
  type: 'buy' | 'sell'
  lots: number
  openPrice: number
  currentPrice: number
  profit: number
}

interface AccountSummaryProps {
  accounts: Account[]
  onRefresh?: () => void
  className?: string
}

export function AccountSummary({ accounts, onRefresh, className = '' }: AccountSummaryProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // 自動更新
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date())
      onRefresh?.()
    }, 5000) // 5秒ごと

    return () => clearInterval(interval)
  }, [onRefresh])

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const getStatusColor = (status: Account['status']) => {
    switch (status) {
      case 'connected': return 'bg-green-500'
      case 'disconnected': return 'bg-gray-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getMarginLevelColor = (level: number) => {
    if (level < 100) return 'text-red-600 bg-red-100'
    if (level < 200) return 'text-orange-600 bg-orange-100'
    return 'text-green-600 bg-green-100'
  }

  const getTotalStats = () => {
    return accounts.reduce((stats, account) => {
      stats.totalBalance += account.balance
      stats.totalEquity += account.equity
      stats.totalMargin += account.margin
      stats.totalBonus += account.bonusAmount
      stats.totalPositions += account.positions.length
      stats.totalProfit += account.positions.reduce((sum, pos) => sum + pos.profit, 0)
      return stats
    }, {
      totalBalance: 0,
      totalEquity: 0,
      totalMargin: 0,
      totalBonus: 0,
      totalPositions: 0,
      totalProfit: 0
    })
  }

  const totalStats = getTotalStats()
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId)

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* ヘッダー */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">アカウントサマリー</h3>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              最終更新: {lastUpdate.toLocaleTimeString()}
            </span>
            <button
              onClick={onRefresh}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
            >
              更新
            </button>
          </div>
        </div>
      </div>

      {/* 全体統計 */}
      <div className="p-4 border-b bg-blue-50">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">アカウント数</div>
            <div className="text-lg font-bold text-gray-800">{accounts.length}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">総残高</div>
            <div className="text-lg font-bold text-gray-800">{formatNumber(totalStats.totalBalance, 0)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">有効証拠金</div>
            <div className="text-lg font-bold text-gray-800">{formatNumber(totalStats.totalEquity, 0)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">ボーナス</div>
            <div className="text-lg font-bold text-blue-600">{formatNumber(totalStats.totalBonus, 0)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">ポジション数</div>
            <div className="text-lg font-bold text-gray-800">{totalStats.totalPositions}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">総損益</div>
            <div className={`text-lg font-bold ${
              totalStats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatNumber(totalStats.totalProfit, 2)}
            </div>
          </div>
        </div>
      </div>

      {/* アカウント一覧 */}
      <div className="p-4">
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              onClick={() => setSelectedAccountId(account.id === selectedAccountId ? null : account.id)}
              className={`
                border rounded-lg p-3 cursor-pointer transition-all hover:bg-gray-50
                ${selectedAccountId === account.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
              `}
            >
              {/* アカウント基本情報 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(account.status)}`} />
                  <div>
                    <div className="font-medium text-gray-800">{account.broker}</div>
                    <div className="text-sm text-gray-600">{account.accountNumber}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getMarginLevelColor(account.marginLevel)}`}>
                    {formatNumber(account.marginLevel, 1)}%
                  </span>
                  <span className="text-sm text-gray-600">
                    {account.positions.length}ポジション
                  </span>
                </div>
              </div>

              {/* アカウント詳細情報 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">残高:</span>
                  <div className="font-medium">{formatNumber(account.balance)}</div>
                </div>
                <div>
                  <span className="text-gray-600">有効証拠金:</span>
                  <div className="font-medium">{formatNumber(account.equity)}</div>
                </div>
                <div>
                  <span className="text-gray-600">必要証拠金:</span>
                  <div className="font-medium">{formatNumber(account.margin)}</div>
                </div>
                <div>
                  <span className="text-gray-600">ボーナス:</span>
                  <div className="font-medium text-blue-600">{formatNumber(account.bonusAmount)}</div>
                </div>
              </div>

              {/* 証拠金維持率バー */}
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-600">証拠金維持率</span>
                  <span className={`text-xs font-medium ${
                    account.marginLevel < 100 ? 'text-red-600' :
                    account.marginLevel < 200 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {formatNumber(account.marginLevel, 1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      account.marginLevel < 100 ? 'bg-red-500' :
                      account.marginLevel < 200 ? 'bg-orange-500' : 'bg-green-500'
                    }`}
                    style={{ 
                      width: `${Math.min(100, (account.marginLevel / 300) * 100)}%` 
                    }}
                  />
                </div>
              </div>

              {/* 拡張情報（選択時） */}
              {selectedAccountId === account.id && (
                <div className="mt-4 pt-3 border-t">
                  <PositionList positions={account.positions} />
                </div>
              )}
            </div>
          ))}
        </div>

        {accounts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">💰</div>
            <p>アカウントが見つかりません</p>
            <p className="text-sm">EA接続を確認してください</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ポジション一覧コンポーネント
interface PositionListProps {
  positions: Position[]
}

function PositionList({ positions }: PositionListProps) {
  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        アクティブなポジションはありません
      </div>
    )
  }

  return (
    <div>
      <h4 className="font-medium text-gray-800 mb-2">アクティブポジション ({positions.length})</h4>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {positions.map((position) => (
          <div key={position.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
            <div className="flex items-center space-x-2">
              <span className="font-medium">{position.symbol}</span>
              <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                position.type === 'buy' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {position.type.toUpperCase()}
              </span>
              <span className="text-gray-600">{formatNumber(position.lots, 2)}</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="font-mono text-xs">{formatNumber(position.openPrice, 5)}</div>
                <div className="font-mono text-xs text-gray-500">→ {formatNumber(position.currentPrice, 5)}</div>
              </div>
              <div className={`font-medium ${
                position.profit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatNumber(position.profit, 2)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}