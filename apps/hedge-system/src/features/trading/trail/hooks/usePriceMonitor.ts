/**
 * React hook for PriceMonitor integration
 * リアルタイム価格監視とトレール判定のReact統合
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { 
  PriceMonitor, 
  PriceData, 
  MonitoredPosition, 
  TrailJudgmentResult,
  AbnormalPriceDetectionConfig,
  PerformanceConfig
} from '../PriceMonitor'

export interface UsePriceMonitorOptions {
  enabled?: boolean
  abnormalDetectionConfig?: Partial<AbnormalPriceDetectionConfig>
  performanceConfig?: Partial<PerformanceConfig>
  onTrailJudgment?: (result: TrailJudgmentResult) => void
  onPriceUpdate?: (symbol: string, price: PriceData) => void
  onAbnormalPrice?: (symbol: string, price: PriceData) => void
}

export interface UsePriceMonitorReturn {
  priceMonitor: PriceMonitor | null
  stats: {
    monitoredPositions: number
    cachedPrices: number
    trailCalculationCache: number
    abnormalPriceStats: number
    lastCleanup: Date
    memoryUsage: number
  }
  isActive: boolean
  addPosition: (position: MonitoredPosition) => void
  removePosition: (positionId: string) => void
  updatePrice: (priceData: PriceData) => void
  start: () => void
  stop: () => void
}

export function usePriceMonitor({
  enabled = true,
  abnormalDetectionConfig,
  performanceConfig,
  onTrailJudgment,
  onPriceUpdate,
  onAbnormalPrice
}: UsePriceMonitorOptions = {}): UsePriceMonitorReturn {
  const priceMonitorRef = useRef<PriceMonitor | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [stats, setStats] = useState({
    monitoredPositions: 0,
    cachedPrices: 0,
    trailCalculationCache: 0,
    abnormalPriceStats: 0,
    lastCleanup: new Date(),
    memoryUsage: 0
  })

  // PriceMonitorの初期化
  const initializePriceMonitor = useCallback(() => {
    if (priceMonitorRef.current) {
      priceMonitorRef.current.dispose()
    }

    const monitor = new PriceMonitor(abnormalDetectionConfig, performanceConfig)
    
    // トレール判定リスナーの設定
    if (onTrailJudgment) {
      monitor.onTrailJudgment(onTrailJudgment)
    }

    // 価格更新リスナーの設定
    if (onPriceUpdate) {
      monitor.onPriceUpdate(onPriceUpdate)
    }

    // 異常価格検出時の追加処理
    if (onAbnormalPrice) {
      monitor.onPriceUpdate((symbol, price) => {
        // 簡易的な異常価格判定（実際の判定は PriceMonitor 内部で行われる）
        // ここでは外部通知用のフック
        const pipValue = symbol.includes('JPY') ? 0.01 : 0.0001
        const spreadInPips = price.spread / pipValue
        
        if (spreadInPips > (abnormalDetectionConfig?.maxSpreadThreshold || 10)) {
          onAbnormalPrice(symbol, price)
        }
      })
    }

    priceMonitorRef.current = monitor
    setIsActive(true)

    return monitor
  }, [abnormalDetectionConfig, performanceConfig, onTrailJudgment, onPriceUpdate, onAbnormalPrice])

  // 統計情報の更新
  const updateStats = useCallback(() => {
    if (priceMonitorRef.current) {
      const newStats = priceMonitorRef.current.getStats()
      setStats(newStats)
    }
  }, [])

  // ポジション追加
  const addPosition = useCallback((position: MonitoredPosition) => {
    if (priceMonitorRef.current && isActive) {
      priceMonitorRef.current.addMonitoredPosition(position)
      updateStats()
    }
  }, [isActive, updateStats])

  // ポジション削除
  const removePosition = useCallback((positionId: string) => {
    if (priceMonitorRef.current && isActive) {
      priceMonitorRef.current.removeMonitoredPosition(positionId)
      updateStats()
    }
  }, [isActive, updateStats])

  // 価格更新
  const updatePrice = useCallback((priceData: PriceData) => {
    if (priceMonitorRef.current && isActive) {
      priceMonitorRef.current.updatePrice(priceData)
      updateStats()
    }
  }, [isActive, updateStats])

  // 監視開始
  const start = useCallback(() => {
    if (!priceMonitorRef.current) {
      initializePriceMonitor()
    }
    setIsActive(true)
  }, [initializePriceMonitor])

  // 監視停止
  const stop = useCallback(() => {
    setIsActive(false)
  }, [])

  // 初期化と定期的な統計更新
  useEffect(() => {
    if (enabled) {
      initializePriceMonitor()
    }

    // 統計情報の定期更新
    const statsInterval = setInterval(updateStats, 5000) // 5秒間隔

    return () => {
      clearInterval(statsInterval)
    }
  }, [enabled, initializePriceMonitor, updateStats])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (priceMonitorRef.current) {
        priceMonitorRef.current.dispose()
        priceMonitorRef.current = null
      }
    }
  }, [])

  return {
    priceMonitor: priceMonitorRef.current,
    stats,
    isActive,
    addPosition,
    removePosition,
    updatePrice,
    start,
    stop
  }
}