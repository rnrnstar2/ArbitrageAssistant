'use client'

import { useState, useEffect, useCallback } from 'react'
import { Monitor, Wallet, Gift, TrendingUp, Users, Activity, Wifi, WifiOff, AlertTriangle } from 'lucide-react'

interface ClientPC {
  id: string
  name: string
  status: 'online' | 'offline' | 'error'
  lastSeen: Date
  accounts: Account[]
}

interface Account {
  id: string
  clientPCId: string
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
  accountId: string
  symbol: string
  type: 'buy' | 'sell'
  lots: number
  openPrice: number
  currentPrice: number
  profit: number
}

interface AccountSummaryDashboardProps {
  clientPCs: ClientPC[]
  onRefresh?: () => void
  className?: string
  updateInterval?: number
}

export function AccountSummaryDashboard({ 
  clientPCs, 
  onRefresh, 
  className = '', 
  updateInterval = 1000 
}: AccountSummaryDashboardProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)

  // 自動更新
  useEffect(() => {
    if (!isAutoRefresh) return

    const interval = setInterval(() => {
      setLastUpdate(new Date())
      onRefresh?.()
    }, updateInterval)

    return () => clearInterval(interval)
  }, [onRefresh, updateInterval, isAutoRefresh])

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const getStatusIcon = (status: ClientPC['status']) => {
    switch (status) {
      case 'online': return <Wifi className="h-4 w-4 text-green-500" />
      case 'offline': return <WifiOff className="h-4 w-4 text-gray-500" />
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />
      default: return <WifiOff className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: ClientPC['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'offline': return 'bg-gray-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getMarginLevelColor = (level: number) => {
    if (level < 100) return 'text-red-600 bg-red-100'
    if (level < 200) return 'text-orange-600 bg-orange-100'
    return 'text-green-600 bg-green-100'
  }

  const getGlobalStats = useCallback(() => {
    const allAccounts = clientPCs.flatMap(client => client.accounts)
    
    return {
      connectedClients: clientPCs.filter(client => client.status === 'online').length,
      totalClients: clientPCs.length,
      totalAccounts: allAccounts.length,
      connectedAccounts: allAccounts.filter(acc => acc.status === 'connected').length,
      totalBalance: allAccounts.reduce((sum, acc) => sum + acc.balance, 0),
      totalEquity: allAccounts.reduce((sum, acc) => sum + acc.equity, 0),
      totalMargin: allAccounts.reduce((sum, acc) => sum + acc.margin, 0),
      totalBonus: allAccounts.reduce((sum, acc) => sum + acc.bonusAmount, 0),
      totalPositions: allAccounts.reduce((sum, acc) => sum + acc.positions.length, 0),
      totalProfit: allAccounts.reduce((sum, acc) => 
        sum + acc.positions.reduce((posSum, pos) => posSum + pos.profit, 0), 0
      ),
      averageMarginLevel: allAccounts.length > 0 
        ? allAccounts.reduce((sum, acc) => sum + acc.marginLevel, 0) / allAccounts.length 
        : 0
    }
  }, [clientPCs])

  const globalStats = getGlobalStats()

  const statCards = [
    {
      title: "接続中クライアント",
      value: `${globalStats.connectedClients}/${globalStats.totalClients}`,
      icon: Monitor,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "接続中アカウント",
      value: `${globalStats.connectedAccounts}/${globalStats.totalAccounts}`,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "総有効証拠金",
      value: formatCurrency(globalStats.totalEquity),
      icon: Wallet,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "総ボーナス額",
      value: formatCurrency(globalStats.totalBonus),
      icon: Gift,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "オープンポジション",
      value: globalStats.totalPositions,
      icon: Activity,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "総損益",
      value: formatCurrency(globalStats.totalProfit),
      icon: TrendingUp,
      color: globalStats.totalProfit >= 0 ? "text-green-600" : "text-red-600",
      bgColor: globalStats.totalProfit >= 0 ? "bg-green-50" : "bg-red-50",
    },
  ]

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* ヘッダー */}
      <div className="p-6 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">アカウントサマリーダッシュボード</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">自動更新:</span>
              <button
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  isAutoRefresh 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isAutoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>
            <span className="text-sm text-gray-600">
              最終更新: {lastUpdate.toLocaleTimeString()}
            </span>
            <button
              onClick={onRefresh}
              className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition-colors"
            >
              手動更新
            </button>
          </div>
        </div>
      </div>

      {/* 統計カード */}
      <div className="p-6 border-b bg-blue-50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card, index) => {
            const Icon = card.icon
            return (
              <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
                  <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* クライアントPC一覧 */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">接続中クライアントPC</h3>
        
        {clientPCs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Monitor className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg">接続中のクライアントPCがありません</p>
            <p className="text-sm">Hedge Systemの起動を確認してください</p>
          </div>
        ) : (
          <div className="space-y-4">
            {clientPCs.map((client) => (
              <div
                key={client.id}
                onClick={() => setSelectedClientId(client.id === selectedClientId ? null : client.id)}
                className={`
                  border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md
                  ${selectedClientId === client.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}
                `}
              >
                {/* クライアント基本情報 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(client.status)}
                    <div>
                      <div className="font-semibold text-gray-800">{client.name}</div>
                      <div className="text-sm text-gray-600">
                        最終接続: {client.lastSeen.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-600">アカウント数</div>
                      <div className="font-bold text-gray-800">{client.accounts.length}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">総残高</div>
                      <div className="font-bold text-gray-800">
                        {formatCurrency(client.accounts.reduce((sum, acc) => sum + acc.balance, 0))}
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(client.status)}`} />
                  </div>
                </div>

                {/* 口座サマリー */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div className="bg-green-50 p-3 rounded">
                    <span className="text-green-600 font-medium">接続中:</span>
                    <div className="font-bold text-green-800">
                      {client.accounts.filter(acc => acc.status === 'connected').length}口座
                    </div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded">
                    <span className="text-blue-600 font-medium">総有効証拠金:</span>
                    <div className="font-bold text-blue-800">
                      {formatCurrency(client.accounts.reduce((sum, acc) => sum + acc.equity, 0))}
                    </div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded">
                    <span className="text-orange-600 font-medium">ボーナス:</span>
                    <div className="font-bold text-orange-800">
                      {formatCurrency(client.accounts.reduce((sum, acc) => sum + acc.bonusAmount, 0))}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <span className="text-purple-600 font-medium">ポジション:</span>
                    <div className="font-bold text-purple-800">
                      {client.accounts.reduce((sum, acc) => sum + acc.positions.length, 0)}
                    </div>
                  </div>
                </div>

                {/* 展開されたアカウント詳細 */}
                {selectedClientId === client.id && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-800 mb-3">アカウント詳細</h4>
                    <div className="space-y-3">
                      {client.accounts.map((account) => (
                        <div key={account.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${getStatusColor(account.status)}`} />
                              <span className="font-medium">{account.broker}</span>
                              <span className="text-sm text-gray-600">#{account.accountNumber}</span>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getMarginLevelColor(account.marginLevel)}`}>
                              {formatNumber(account.marginLevel, 1)}%
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-gray-600">残高:</span>
                              <div className="font-medium">{formatCurrency(account.balance)}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">有効証拠金:</span>
                              <div className="font-medium">{formatCurrency(account.equity)}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">必要証拠金:</span>
                              <div className="font-medium">{formatCurrency(account.margin)}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">損益:</span>
                              <div className={`font-medium ${
                                account.positions.reduce((sum, pos) => sum + pos.profit, 0) >= 0 
                                  ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(account.positions.reduce((sum, pos) => sum + pos.profit, 0))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}