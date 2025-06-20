/**
 * 価格監視システムの使用例
 * PriceMonitor の統合デモンストレーション
 */

import React, { useCallback, useEffect, useState } from 'react'
import { usePriceMonitor } from './hooks/usePriceMonitor'
import { PriceData, MonitoredPosition, TrailJudgmentResult } from './PriceMonitor'
import { TrailSettings } from './types'

interface PriceMonitorExampleProps {
  className?: string
}

export const PriceMonitorExample: React.FC<PriceMonitorExampleProps> = ({ className }) => {
  const [logs, setLogs] = useState<string[]>([])
  const [simulationActive, setSimulationActive] = useState(false)

  // ログ追加ヘルパー
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 49)]) // 最新50件を保持
  }, [])

  // トレール判定結果の処理
  const handleTrailJudgment = useCallback((result: TrailJudgmentResult) => {
    if (result.shouldUpdate) {
      addLog(`🎯 Trail update needed for ${result.positionId}: ${result.previousStopLoss} → ${result.newStopLoss}`)
    } else {
      addLog(`📊 Trail checked for ${result.positionId}: ${result.reason}`)
    }
  }, [addLog])

  // 価格更新の処理
  const handlePriceUpdate = useCallback((symbol: string, price: PriceData) => {
    addLog(`📈 Price update: ${symbol} Bid=${price.bid} Ask=${price.ask} Spread=${price.spread.toFixed(5)}`)
  }, [addLog])

  // 異常価格の処理
  const handleAbnormalPrice = useCallback((symbol: string, price: PriceData) => {
    addLog(`⚠️ Abnormal price detected: ${symbol} - excessive spread`)
  }, [addLog])

  // PriceMonitor フック
  const {
    stats,
    isActive,
    addPosition,
    removePosition,
    updatePrice,
    start,
    stop
  } = usePriceMonitor({
    enabled: true,
    abnormalDetectionConfig: {
      maxSpreadThreshold: 5.0, // 5pips
      priceVolatilityThreshold: 0.3, // 0.3%
      consecutiveAbnormalLimit: 3
    },
    performanceConfig: {
      maxCachedPrices: 100,
      priceDataTtl: 10000, // 10秒
      calculationThrottleMs: 100,
      memoryCleanupInterval: 30000 // 30秒
    },
    onTrailJudgment: handleTrailJudgment,
    onPriceUpdate: handlePriceUpdate,
    onAbnormalPrice: handleAbnormalPrice
  })

  // サンプルポジションの追加
  const addSamplePosition = useCallback(() => {
    const samplePosition: MonitoredPosition = {
      id: `pos-${Date.now()}`,
      accountId: 'acc-demo',
      symbol: 'USDJPY',
      type: 'buy',
      lots: 0.1,
      openPrice: 150.000,
      currentPrice: 150.050,
      profit: 50,
      trailSettings: {
        id: `trail-${Date.now()}`,
        positionId: `pos-${Date.now()}`,
        type: 'fixed',
        trailAmount: 20, // 20pips
        startCondition: {
          type: 'profit_threshold',
          value: 100 // 100円の利益で開始
        },
        isActive: true,
        currentStopLoss: 149.800,
        maxProfit: 75,
        lastUpdated: new Date()
      } as TrailSettings
    }
    
    addPosition(samplePosition)
    addLog(`➕ Sample position added: ${samplePosition.id}`)
  }, [addPosition, addLog])

  // 価格シミュレーション
  const startPriceSimulation = useCallback(() => {
    setSimulationActive(true)
    addLog('🎮 Price simulation started')

    const interval = setInterval(() => {
      // USDJPY の価格をランダムに生成
      const basePrice = 150.000
      const variation = (Math.random() - 0.5) * 0.200 // ±20pips の変動
      const bid = basePrice + variation
      const ask = bid + 0.002 // 2pips spread
      
      // 時々異常なスプレッドを生成
      const spread = Math.random() > 0.9 ? 0.010 : ask - bid // 10% の確率で異常スプレッド

      const priceData: PriceData = {
        symbol: 'USDJPY',
        bid,
        ask: bid + spread,
        spread,
        timestamp: new Date(),
        volume: Math.floor(Math.random() * 5000) + 1000
      }

      updatePrice(priceData)
    }, 1000) // 1秒間隔

    // 10秒後に自動停止
    setTimeout(() => {
      clearInterval(interval)
      setSimulationActive(false)
      addLog('⏹️ Price simulation stopped')
    }, 10000)
  }, [updatePrice, addLog])

  return (
    <div className={`p-6 bg-white rounded-lg shadow-lg ${className}`}>
      <h2 className="text-2xl font-bold mb-4">Price Monitor Example</h2>
      
      {/* 統計情報 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-3 rounded">
          <div className="text-sm text-blue-600">Monitored Positions</div>
          <div className="text-xl font-bold">{stats.monitoredPositions}</div>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <div className="text-sm text-green-600">Cached Prices</div>
          <div className="text-xl font-bold">{stats.cachedPrices}</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded">
          <div className="text-sm text-yellow-600">Trail Cache</div>
          <div className="text-xl font-bold">{stats.trailCalculationCache}</div>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <div className="text-sm text-purple-600">Memory (KB)</div>
          <div className="text-xl font-bold">{Math.round(stats.memoryUsage / 1024)}</div>
        </div>
      </div>

      {/* 制御ボタン */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={isActive ? stop : start}
          className={`px-4 py-2 rounded font-medium ${
            isActive 
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isActive ? 'Stop Monitor' : 'Start Monitor'}
        </button>
        
        <button
          onClick={addSamplePosition}
          disabled={!isActive}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium disabled:bg-gray-300"
        >
          Add Sample Position
        </button>
        
        <button
          onClick={startPriceSimulation}
          disabled={!isActive || simulationActive}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded font-medium disabled:bg-gray-300"
        >
          {simulationActive ? 'Simulating...' : 'Start Price Simulation'}
        </button>
      </div>

      {/* ステータス */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <span className="font-medium">
            Status: {isActive ? 'Active' : 'Inactive'}
          </span>
          {simulationActive && (
            <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
              Simulating
            </span>
          )}
        </div>
      </div>

      {/* ログ表示 */}
      <div className="bg-gray-100 rounded p-4">
        <h3 className="font-bold mb-2">Activity Log</h3>
        <div className="h-64 overflow-y-auto text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500 italic">No activity yet...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1 font-mono">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 説明 */}
      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Usage:</strong></p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Click "Start Monitor" to activate price monitoring</li>
          <li>Click "Add Sample Position" to add a position with trail settings</li>
          <li>Click "Start Price Simulation" to simulate price updates</li>
          <li>Watch the activity log for trail judgments and price updates</li>
        </ol>
      </div>
    </div>
  )
}