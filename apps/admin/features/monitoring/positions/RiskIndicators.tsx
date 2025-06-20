'use client'

import { useMemo } from 'react'
import { Account, LossCutPrediction } from '../types'

interface RiskIndicatorsProps {
  accounts: Account[]
  lossCutPredictions: LossCutPrediction[]
  analytics: {
    totalProfit: number
    totalLoss: number
    totalExposure: number
    positionCount: number
    exposureBySymbol: Record<string, number>
  }
}

export function RiskIndicators({ accounts, lossCutPredictions, analytics }: RiskIndicatorsProps) {
  // リスク指標の計算
  const riskMetrics = useMemo(() => {
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)
    const totalEquity = accounts.reduce((sum, acc) => sum + acc.equity, 0)
    const totalMargin = accounts.reduce((sum, acc) => sum + acc.margin, 0)
    const totalBonus = accounts.reduce((sum, acc) => sum + acc.bonusAmount, 0)
    
    const avgMarginLevel = accounts.length > 0 
      ? accounts.reduce((sum, acc) => sum + acc.marginLevel, 0) / accounts.length 
      : 0

    const criticalAccounts = accounts.filter(acc => acc.marginLevel < 100).length
    const warningAccounts = accounts.filter(acc => acc.marginLevel < 200 && acc.marginLevel >= 100).length

    const riskScore = Math.max(0, Math.min(100, 
      100 - (avgMarginLevel / 5) + (criticalAccounts * 30) + (warningAccounts * 10)
    ))

    return {
      totalBalance,
      totalEquity,
      totalMargin,
      totalBonus,
      avgMarginLevel,
      criticalAccounts,
      warningAccounts,
      riskScore,
      drawdown: totalBalance > 0 ? ((totalBalance - totalEquity) / totalBalance) * 100 : 0
    }
  }, [accounts])

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const getRiskScoreColor = (score: number) => {
    if (score < 30) return 'text-green-600 bg-green-100'
    if (score < 60) return 'text-yellow-600 bg-yellow-100'
    if (score < 80) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  const getMarginLevelColor = (level: number) => {
    if (level > 200) return 'text-green-600'
    if (level > 100) return 'text-yellow-600'
    return 'text-red-600'
  }

  const MarginLevelGauge = ({ level, accountName }: { level: number; accountName: string }) => {
    const percentage = Math.min(100, (level / 300) * 100)
    const color = level > 200 ? 'bg-green-500' : level > 100 ? 'bg-yellow-500' : 'bg-red-500'
    
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="w-16 text-xs truncate" title={accountName}>{accountName}</div>
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className={`w-16 text-right font-medium ${getMarginLevelColor(level)}`}>
          {formatNumber(level, 0)}%
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* 総合リスクスコア */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">リスクスコア</h3>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskScoreColor(riskMetrics.riskScore)}`}>
            {riskMetrics.riskScore < 30 ? '低' : riskMetrics.riskScore < 60 ? '中' : riskMetrics.riskScore < 80 ? '高' : '危険'}
          </div>
        </div>
        <div className="text-2xl font-bold mb-1">
          {formatNumber(riskMetrics.riskScore, 0)}
        </div>
        <div className="text-xs text-gray-600">
          危険アカウント: {riskMetrics.criticalAccounts}個
        </div>
      </div>

      {/* ポートフォリオ概要 */}
      <div className="bg-white p-4 rounded-lg border">
        <h3 className="text-sm font-medium text-gray-700 mb-2">ポートフォリオ</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">総残高:</span>
            <span className="font-medium">{formatNumber(riskMetrics.totalBalance, 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">有効証拠金:</span>
            <span className="font-medium">{formatNumber(riskMetrics.totalEquity, 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">必要証拠金:</span>
            <span className="font-medium">{formatNumber(riskMetrics.totalMargin, 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">ボーナス:</span>
            <span className="font-medium text-blue-600">{formatNumber(riskMetrics.totalBonus, 0)}</span>
          </div>
        </div>
      </div>

      {/* 損益情報 */}
      <div className="bg-white p-4 rounded-lg border">
        <h3 className="text-sm font-medium text-gray-700 mb-2">損益状況</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">総損益:</span>
            <span className={`font-medium ${analytics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatNumber(analytics.totalProfit, 2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">エクスポージャー:</span>
            <span className="font-medium">{formatNumber(analytics.totalExposure, 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">ドローダウン:</span>
            <span className={`font-medium ${riskMetrics.drawdown > 10 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatNumber(riskMetrics.drawdown, 1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">ポジション数:</span>
            <span className="font-medium">{analytics.positionCount}</span>
          </div>
        </div>
      </div>

      {/* 証拠金維持率 */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">証拠金維持率</h3>
          <div className="text-lg font-bold">
            <span className={getMarginLevelColor(riskMetrics.avgMarginLevel)}>
              {formatNumber(riskMetrics.avgMarginLevel, 0)}%
            </span>
          </div>
        </div>
        
        <div className="space-y-2 max-h-24 overflow-y-auto">
          {accounts.slice(0, 4).map((account) => (
            <MarginLevelGauge
              key={account.id}
              level={account.marginLevel}
              accountName={`${account.broker}-${account.accountNumber.slice(-4)}`}
            />
          ))}
          {accounts.length > 4 && (
            <div className="text-xs text-gray-500 text-center">
              他 {accounts.length - 4} アカウント
            </div>
          )}
        </div>
      </div>

      {/* ロスカット警告 */}
      {lossCutPredictions.filter(p => p.riskLevel === 'critical' || p.riskLevel === 'high').length > 0 && (
        <div className="lg:col-span-2 bg-red-50 border border-red-200 p-4 rounded-lg">
          <div className="flex items-center mb-3">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
            <h3 className="text-sm font-medium text-red-800">ロスカット警告</h3>
          </div>
          
          <div className="space-y-2">
            {lossCutPredictions
              .filter(p => p.riskLevel === 'critical' || p.riskLevel === 'high')
              .slice(0, 3)
              .map((prediction) => {
                const account = accounts.find(acc => acc.id === prediction.accountId)
                return (
                  <div key={prediction.accountId} className="text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {account?.broker} - {account?.accountNumber.slice(-4)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        prediction.riskLevel === 'critical' 
                          ? 'bg-red-600 text-white' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {prediction.riskLevel === 'critical' ? '緊急' : '警告'}
                      </span>
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      証拠金維持率: {formatNumber(prediction.currentMarginLevel, 1)}%
                      {prediction.estimatedTimeToLossCut && prediction.estimatedTimeToLossCut > 0 && (
                        <span className="ml-2">
                          予想時間: {Math.round(prediction.estimatedTimeToLossCut)}分
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* エクスポージャー分析 */}
      <div className="lg:col-span-2 bg-white p-4 rounded-lg border">
        <h3 className="text-sm font-medium text-gray-700 mb-3">通貨ペア別エクスポージャー</h3>
        
        <div className="space-y-2">
          {Object.entries(analytics.exposureBySymbol)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 6)
            .map(([symbol, exposure]) => {
              const percentage = analytics.totalExposure > 0 ? (exposure / analytics.totalExposure) * 100 : 0
              return (
                <div key={symbol} className="flex items-center space-x-3">
                  <div className="w-16 text-sm font-medium">{symbol}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-sm">
                    <div className="font-medium">{formatNumber(exposure, 0)}</div>
                    <div className="text-xs text-gray-500">{formatNumber(percentage, 1)}%</div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}