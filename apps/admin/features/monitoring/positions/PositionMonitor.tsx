'use client'

import { useState, useMemo } from 'react'
import { PositionFilters, PositionMonitorConfig } from '../types'
import { useRealtimePositions } from '../../../hooks/monitoring/useRealtimePositions'
import { useAccountMonitoring } from '../../../hooks/monitoring/useAccountMonitoring'
import { PositionGrid } from './PositionGrid'
import { PositionDetails } from './PositionDetails'
import { ProfitLossChart } from './ProfitLossChart'
import { RiskIndicators } from './RiskIndicators'
import { AlertBanner } from '../alerts/AlertBanner'

interface PositionMonitorProps {
  initialConfig?: Partial<PositionMonitorConfig>
  accountIds?: string[]
}

export function PositionMonitor({ 
  initialConfig = {},
  accountIds = []
}: PositionMonitorProps) {
  const [config, setConfig] = useState<PositionMonitorConfig>({
    updateFrequency: 1,
    filters: {},
    displaySettings: {
      showProfitColors: true,
      showTrailIndicators: true,
      showRiskMetrics: true,
      compactView: false
    },
    alertSettings: {
      enableSounds: true,
      enablePopups: true,
      autoRefresh: true
    },
    ...initialConfig
  })

  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)

  // リアルタイムデータの取得
  const {
    positions,
    loading: positionsLoading,
    error: positionsError,
    lastUpdate,
    updateFrequency,
    reconnect
  } = useRealtimePositions({
    filters: config.filters,
    throttleMs: 1000 / config.updateFrequency,
    enabled: true
  })

  const {
    accounts,
    alerts,
    lossCutPredictions,
    loading: accountsLoading,
    error: accountsError,
    acknowledgeAlert,
    clearAlerts
  } = useAccountMonitoring({
    accountIds,
    enabled: true,
    alertThresholds: {
      marginLevel: 150,
      profitLoss: -1000,
      connectionTimeout: 30000
    }
  })

  // フィルタリングされたポジション
  const filteredPositions = useMemo(() => {
    return positions.filter(position => {
      const { filters } = config
      
      if (filters.accountIds?.length && !filters.accountIds.includes(position.accountId)) {
        return false
      }
      
      if (filters.symbols?.length && !filters.symbols.includes(position.symbol)) {
        return false
      }
      
      if (filters.profitThreshold !== undefined) {
        if (filters.profitThreshold > 0 && position.profit < filters.profitThreshold) {
          return false
        }
        if (filters.profitThreshold < 0 && position.profit > filters.profitThreshold) {
          return false
        }
      }
      
      return true
    })
  }, [positions, config.filters])

  // 集計データ
  const analytics = useMemo(() => {
    const totalProfit = filteredPositions.reduce((sum, pos) => sum + pos.profit, 0)
    const totalLoss = filteredPositions.filter(pos => pos.profit < 0).reduce((sum, pos) => sum + pos.profit, 0)
    const totalExposure = filteredPositions.reduce((sum, pos) => sum + (pos.lots * pos.currentPrice), 0)
    
    const exposureBySymbol = filteredPositions.reduce((acc, pos) => {
      acc[pos.symbol] = (acc[pos.symbol] || 0) + (pos.lots * pos.currentPrice)
      return acc
    }, {} as Record<string, number>)

    return {
      totalProfit,
      totalLoss,
      totalExposure,
      positionCount: filteredPositions.length,
      exposureBySymbol
    }
  }, [filteredPositions])

  const selectedPosition = filteredPositions.find(pos => pos.id === selectedPositionId)

  const handleFilterChange = (newFilters: Partial<PositionFilters>) => {
    setConfig(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters }
    }))
  }

  const handleConfigChange = (newConfig: Partial<PositionMonitorConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
  }

  if (positionsLoading && accountsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">リアルタイムデータを読み込み中...</p>
        </div>
      </div>
    )
  }

  if (positionsError || accountsError) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium mb-2">接続エラー</h3>
          <p className="text-red-600 mb-4">
            {positionsError?.message || accountsError?.message || '不明なエラーが発生しました'}
          </p>
          <button
            onClick={reconnect}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            再接続
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* アラートバナー */}
      {alerts.length > 0 && (
        <AlertBanner
          alerts={alerts}
          onAcknowledge={acknowledgeAlert}
          onClearAll={clearAlerts}
        />
      )}

      {/* ヘッダー情報 */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h2 className="text-xl font-semibold">リアルタイムポジション監視</h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>ポジション数: {analytics.positionCount}</span>
              <span>総損益: <span className={analytics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                {analytics.totalProfit.toFixed(2)}
              </span></span>
              <span>更新頻度: {updateFrequency}/秒</span>
              {lastUpdate && (
                <span>最終更新: {lastUpdate.toLocaleTimeString()}</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setConfig(prev => ({ 
                ...prev, 
                displaySettings: { ...prev.displaySettings, compactView: !prev.displaySettings.compactView }
              }))}
              className={`px-3 py-1 rounded text-sm ${
                config.displaySettings.compactView 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              コンパクト表示
            </button>
            <button
              onClick={reconnect}
              className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
            >
              再接続
            </button>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex">
        {/* 左パネル：ポジショングリッドとリスク指標 */}
        <div className="flex-1 flex flex-col">
          {/* リスク指標 */}
          <div className="bg-white border-b p-4">
            <RiskIndicators
              accounts={accounts}
              lossCutPredictions={lossCutPredictions}
              analytics={analytics}
            />
          </div>

          {/* ポジショングリッド */}
          <div className="flex-1 overflow-hidden">
            <PositionGrid
              positions={filteredPositions}
              accounts={accounts}
              config={config}
              selectedPositionId={selectedPositionId}
              onPositionSelect={setSelectedPositionId}
              onFilterChange={handleFilterChange}
            />
          </div>
        </div>

        {/* 右パネル：詳細とチャート */}
        <div className="w-96 border-l bg-white flex flex-col">
          {selectedPosition ? (
            <>
              <PositionDetails
                position={selectedPosition}
                account={accounts.find(acc => acc.id === selectedPosition.accountId)}
              />
              <div className="flex-1 border-t">
                <ProfitLossChart
                  positionId={selectedPosition.id}
                  symbol={selectedPosition.symbol}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <p>ポジションを選択してください</p>
                <p className="text-sm">詳細情報とチャートが表示されます</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}