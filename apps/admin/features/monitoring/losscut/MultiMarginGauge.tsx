'use client'

import { useState, useMemo } from 'react'
import { MarginLevelGauge } from './MarginLevelGauge'
import { MarginDetailPanel } from './MarginDetailPanel'
import { ChevronDown, Filter, Settings, Eye, EyeOff } from 'lucide-react'

interface AccountMarginData {
  id: string
  name: string
  broker: string
  marginLevel: number
  balance: number
  equity: number
  usedMargin: number
  freeMargin: number
  bonusAmount: number
  status: 'connected' | 'disconnected' | 'error'
  lastUpdate: Date
  history?: Array<{
    timestamp: Date
    marginLevel: number
    balance: number
    equity: number
    usedMargin: number
  }>
  prediction?: {
    trend: 'up' | 'down' | 'stable'
    nextLevelIn15min?: number
    nextLevelIn1hour?: number
    timeToCritical?: number
    requiredRecovery: number
    confidence: number
  }
  suggestions?: Array<{
    id: string
    type: 'deposit' | 'close_positions' | 'hedge' | 'monitor'
    priority: 'low' | 'medium' | 'high' | 'critical'
    title: string
    description: string
    estimatedImpact: {
      marginChange: number
      riskReduction: number
    }
    isAvailable: boolean
  }>
}

interface MultiMarginGaugeProps {
  accounts: AccountMarginData[]
  thresholds: {
    safe: number
    warning: number
    danger: number
    critical: number
  }
  layout?: 'grid' | 'list' | 'compact'
  columns?: number
  showFilters?: boolean
  showOverallStats?: boolean
  onAccountClick?: (accountId: string) => void
  onActionTrigger?: (accountId: string, actionId: string) => void
  onThresholdChange?: (thresholds: any) => void
  className?: string
}

export function MultiMarginGauge({
  accounts,
  thresholds,
  layout = 'grid',
  columns = 4,
  showFilters = true,
  showOverallStats = true,
  onAccountClick,
  onActionTrigger,
  onThresholdChange,
  className = ''
}: MultiMarginGaugeProps) {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'margin' | 'risk' | 'status'>('risk')
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'disconnected' | 'error'>('all')
  const [filterRisk, setFilterRisk] = useState<'all' | 'critical' | 'danger' | 'warning' | 'safe'>('all')
  const [hiddenAccounts, setHiddenAccounts] = useState<Set<string>>(new Set())

  // フィルタリングとソート
  const processedAccounts = useMemo(() => {
    let filtered = accounts.filter(account => {
      if (filterStatus !== 'all' && account.status !== filterStatus) return false
      
      if (filterRisk !== 'all') {
        const riskLevel = 
          account.marginLevel <= thresholds.critical ? 'critical' :
          account.marginLevel <= thresholds.danger ? 'danger' :
          account.marginLevel <= thresholds.warning ? 'warning' : 'safe'
        if (riskLevel !== filterRisk) return false
      }

      return !hiddenAccounts.has(account.id)
    })

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name)
        case 'margin': return a.marginLevel - b.marginLevel
        case 'risk': {
          const getRiskScore = (level: number) => {
            if (level <= thresholds.critical) return 4
            if (level <= thresholds.danger) return 3
            if (level <= thresholds.warning) return 2
            return 1
          }
          return getRiskScore(b.marginLevel) - getRiskScore(a.marginLevel)
        }
        case 'status': return a.status.localeCompare(b.status)
        default: return 0
      }
    })
  }, [accounts, sortBy, filterStatus, filterRisk, hiddenAccounts, thresholds])

  // 統計計算
  const overallStats = useMemo(() => {
    const connected = accounts.filter(a => a.status === 'connected')
    const totalBalance = connected.reduce((sum, a) => sum + a.balance, 0)
    const totalEquity = connected.reduce((sum, a) => sum + a.equity, 0)
    const totalUsedMargin = connected.reduce((sum, a) => sum + a.usedMargin, 0)
    const totalBonusAmount = connected.reduce((sum, a) => sum + a.bonusAmount, 0)
    const averageMarginLevel = connected.length > 0 ? connected.reduce((sum, a) => sum + a.marginLevel, 0) / connected.length : 0

    const riskCounts = {
      critical: connected.filter(a => a.marginLevel <= thresholds.critical).length,
      danger: connected.filter(a => a.marginLevel <= thresholds.danger && a.marginLevel > thresholds.critical).length,
      warning: connected.filter(a => a.marginLevel <= thresholds.warning && a.marginLevel > thresholds.danger).length,
      safe: connected.filter(a => a.marginLevel > thresholds.warning).length
    }

    return {
      totalAccounts: accounts.length,
      connectedAccounts: connected.length,
      totalBalance,
      totalEquity,
      totalUsedMargin,
      totalBonusAmount,
      averageMarginLevel,
      overallMarginLevel: totalUsedMargin > 0 ? (totalEquity / totalUsedMargin) * 100 : 0,
      riskCounts
    }
  }, [accounts, thresholds])

  const handleAccountClick = (accountId: string) => {
    setSelectedAccount(accountId)
    onAccountClick?.(accountId)
  }

  const toggleAccountVisibility = (accountId: string) => {
    const newHidden = new Set(hiddenAccounts)
    if (newHidden.has(accountId)) {
      newHidden.delete(accountId)
    } else {
      newHidden.add(accountId)
    }
    setHiddenAccounts(newHidden)
  }

  const selectedAccountData = selectedAccount ? accounts.find(a => a.id === selectedAccount) : null

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 統計サマリー */}
      {showOverallStats && (
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="font-medium mb-3">全体統計</h3>
          <div className="grid grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{overallStats.connectedAccounts}</div>
              <div className="text-xs text-gray-600">接続中</div>
              <div className="text-xs text-gray-500">/ {overallStats.totalAccounts}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{overallStats.averageMarginLevel.toFixed(1)}%</div>
              <div className="text-xs text-gray-600">平均証拠金維持率</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">${(overallStats.totalBalance / 1000).toFixed(0)}K</div>
              <div className="text-xs text-gray-600">総残高</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">${(overallStats.totalBonusAmount / 1000).toFixed(0)}K</div>
              <div className="text-xs text-gray-600">総ボーナス</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">${(overallStats.totalUsedMargin / 1000).toFixed(0)}K</div>
              <div className="text-xs text-gray-600">使用証拠金</div>
            </div>
            <div className="text-center">
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="text-red-600 font-bold">{overallStats.riskCounts.critical}</div>
                <div className="text-orange-600 font-bold">{overallStats.riskCounts.danger}</div>
                <div className="text-yellow-600 font-bold">{overallStats.riskCounts.warning}</div>
                <div className="text-green-600 font-bold">{overallStats.riskCounts.safe}</div>
              </div>
              <div className="text-xs text-gray-600">リスク分布</div>
            </div>
          </div>
        </div>
      )}

      {/* フィルター・ソート */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="risk">リスク順</option>
                <option value="margin">証拠金維持率順</option>
                <option value="name">名前順</option>
                <option value="status">ステータス順</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">ステータス:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="all">すべて</option>
                <option value="connected">接続中</option>
                <option value="disconnected">切断</option>
                <option value="error">エラー</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">リスク:</span>
              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value as any)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="all">すべて</option>
                <option value="critical">緊急</option>
                <option value="danger">危険</option>
                <option value="warning">警告</option>
                <option value="safe">安全</option>
              </select>
            </div>

            <div className="text-sm text-gray-600">
              表示中: {processedAccounts.length} / {accounts.length} 口座
            </div>
          </div>
        </div>
      )}

      {/* ゲージ表示 */}
      <div className="bg-white p-4 rounded-lg border">
        {layout === 'grid' && (
          <div 
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {processedAccounts.map((account) => (
              <div key={account.id} className="relative group">
                <div
                  onClick={() => handleAccountClick(account.id)}
                  className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors relative"
                >
                  <MarginLevelGauge
                    marginLevel={account.marginLevel}
                    accountName={account.name}
                    size="md"
                    showLabel={true}
                    showPercentage={true}
                    lossCutLevel={thresholds.critical}
                    warningLevel={thresholds.warning}
                  />
                  
                  {/* ステータス表示 */}
                  <div className="absolute top-1 right-1">
                    <div className={`w-3 h-3 rounded-full ${
                      account.status === 'connected' ? 'bg-green-500' :
                      account.status === 'disconnected' ? 'bg-gray-400' :
                      'bg-red-500'
                    }`} />
                  </div>

                  {/* ブローカー表示 */}
                  <div className="text-xs text-gray-500 text-center mt-1">
                    {account.broker}
                  </div>
                </div>

                {/* 表示切替ボタン */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleAccountVisibility(account.id)
                  }}
                  className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {hiddenAccounts.has(account.id) ? 
                    <EyeOff className="w-4 h-4 text-gray-400" /> :
                    <Eye className="w-4 h-4 text-gray-400" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}

        {layout === 'list' && (
          <div className="space-y-2">
            {processedAccounts.map((account) => (
              <div
                key={account.id}
                onClick={() => handleAccountClick(account.id)}
                className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg cursor-pointer border"
              >
                <div className="flex-shrink-0">
                  <MarginLevelGauge
                    marginLevel={account.marginLevel}
                    accountName=""
                    size="sm"
                    showLabel={false}
                    showPercentage={true}
                    lossCutLevel={thresholds.critical}
                    warningLevel={thresholds.warning}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium truncate">{account.name}</h4>
                      <p className="text-sm text-gray-600">{account.broker}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${account.balance.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">
                        最終更新: {account.lastUpdate.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  account.status === 'connected' ? 'bg-green-500' :
                  account.status === 'disconnected' ? 'bg-gray-400' :
                  'bg-red-500'
                }`} />
              </div>
            ))}
          </div>
        )}

        {layout === 'compact' && (
          <div className="grid grid-cols-8 gap-2">
            {processedAccounts.map((account) => (
              <div
                key={account.id}
                onClick={() => handleAccountClick(account.id)}
                className="cursor-pointer hover:bg-gray-50 p-2 rounded text-center border"
              >
                <MarginLevelGauge
                  marginLevel={account.marginLevel}
                  accountName=""
                  size="sm"
                  showLabel={false}
                  showPercentage={false}
                  lossCutLevel={thresholds.critical}
                  warningLevel={thresholds.warning}
                />
                <div className="text-xs font-medium truncate mt-1" title={account.name}>
                  {account.name.split(' ')[0]}
                </div>
                <div className="text-xs text-gray-600">
                  {account.marginLevel.toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 詳細パネル */}
      {selectedAccountData && (
        <MarginDetailPanel
          accountId={selectedAccountData.id}
          accountName={selectedAccountData.name}
          currentLevel={selectedAccountData.marginLevel}
          balance={selectedAccountData.balance}
          equity={selectedAccountData.equity}
          usedMargin={selectedAccountData.usedMargin}
          freeMargin={selectedAccountData.freeMargin}
          bonusAmount={selectedAccountData.bonusAmount}
          history={selectedAccountData.history || []}
          prediction={selectedAccountData.prediction || {
            trend: 'stable',
            requiredRecovery: 0,
            confidence: 0
          }}
          suggestions={selectedAccountData.suggestions || []}
          thresholds={thresholds}
          onClose={() => setSelectedAccount(null)}
          onActionTrigger={(actionId) => onActionTrigger?.(selectedAccountData.id, actionId)}
          onThresholdChange={onThresholdChange}
        />
      )}
    </div>
  )
}