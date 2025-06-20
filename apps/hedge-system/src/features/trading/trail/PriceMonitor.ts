/**
 * リアルタイム価格監視とトレール判定システム
 * 効率的な価格データ管理と異常価格検出機能を提供
 */

import { TrailSettings } from './types'

// 価格データのインターフェース
export interface PriceData {
  symbol: string
  bid: number
  ask: number
  timestamp: Date
  spread: number
  volume?: number
}

// 監視対象ポジションのインターフェース
export interface MonitoredPosition {
  id: string
  accountId: string
  symbol: string
  type: 'buy' | 'sell'
  lots: number
  openPrice: number
  currentPrice: number
  profit: number
  trailSettings?: TrailSettings
}

// トレール判定結果のインターフェース
export interface TrailJudgmentResult {
  positionId: string
  shouldUpdate: boolean
  newStopLoss?: number
  previousStopLoss?: number
  reason: string
  timestamp: Date
}

// 異常価格検出の設定
export interface AbnormalPriceDetectionConfig {
  maxSpreadThreshold: number
  priceVolatilityThreshold: number
  consecutiveAbnormalLimit: number
  volumeThreshold?: number
}

// パフォーマンス最適化設定
export interface PerformanceConfig {
  maxCachedPrices: number
  priceDataTtl: number
  calculationThrottleMs: number
  memoryCleanupInterval: number
}

// 価格データキャッシュエントリ
interface PriceDataCacheEntry {
  data: PriceData
  timestamp: number
  accessCount: number
}

// トレール計算キャッシュエントリ
interface TrailCalculationCache {
  positionId: string
  lastPrice: number
  lastStopLoss: number
  lastCalculation: Date
  result: TrailJudgmentResult | null
}

// 異常価格統計
interface AbnormalPriceStats {
  symbol: string
  consecutiveAbnormalCount: number
  lastNormalPrice: PriceData | null
  abnormalPriceHistory: PriceData[]
}

export class PriceMonitor {
  private priceDataCache = new Map<string, PriceDataCacheEntry>()
  private trailCalculationCache = new Map<string, TrailCalculationCache>()
  private abnormalPriceStats = new Map<string, AbnormalPriceStats>()
  private monitoredPositions = new Map<string, MonitoredPosition>()
  
  private priceUpdateListeners: ((symbol: string, price: PriceData) => void)[] = []
  private trailJudgmentListeners: ((result: TrailJudgmentResult) => void)[] = []
  
  private cleanupTimer: NodeJS.Timeout | null = null
  private lastCleanup = Date.now()
  
  private readonly abnormalDetectionConfig: AbnormalPriceDetectionConfig
  private readonly performanceConfig: PerformanceConfig

  constructor(
    abnormalDetectionConfig: Partial<AbnormalPriceDetectionConfig> = {},
    performanceConfig: Partial<PerformanceConfig> = {}
  ) {
    this.abnormalDetectionConfig = {
      maxSpreadThreshold: 10.0, // 最大スプレッド閾値（pips）
      priceVolatilityThreshold: 0.5, // 価格変動閾値（%）
      consecutiveAbnormalLimit: 3, // 連続異常価格の限界
      volumeThreshold: 1000, // 最小取引量閾値
      ...abnormalDetectionConfig
    }

    this.performanceConfig = {
      maxCachedPrices: 1000, // 最大キャッシュ価格数
      priceDataTtl: 10000, // 価格データTTL（ms）
      calculationThrottleMs: 100, // 計算スロットル時間（ms）
      memoryCleanupInterval: 60000, // メモリクリーンアップ間隔（ms）
      ...performanceConfig
    }

    this.startMemoryCleanup()
  }

  /**
   * 監視対象ポジションを追加
   */
  addMonitoredPosition(position: MonitoredPosition): void {
    this.monitoredPositions.set(position.id, position)
    
    // トレール計算キャッシュを初期化
    if (position.trailSettings) {
      this.trailCalculationCache.set(position.id, {
        positionId: position.id,
        lastPrice: position.currentPrice,
        lastStopLoss: position.trailSettings.currentStopLoss,
        lastCalculation: new Date(),
        result: null
      })
    }
  }

  /**
   * 監視対象ポジションを削除
   */
  removeMonitoredPosition(positionId: string): void {
    this.monitoredPositions.delete(positionId)
    this.trailCalculationCache.delete(positionId)
  }

  /**
   * 価格データを更新し、トレール判定を実行
   */
  updatePrice(priceData: PriceData): void {
    // 異常価格検出
    if (this.isAbnormalPrice(priceData)) {
      console.warn(`Abnormal price detected for ${priceData.symbol}:`, priceData)
      return
    }

    // 価格データをキャッシュに保存
    this.cachePriceData(priceData)

    // 価格更新リスナーに通知
    this.priceUpdateListeners.forEach(listener => {
      try {
        listener(priceData.symbol, priceData)
      } catch (error) {
        console.error('Error in price update listener:', error)
      }
    })

    // 該当シンボルのポジションに対してトレール判定を実行
    this.executeTrailJudgment(priceData)
  }

  /**
   * トレール判定を実行
   */
  private executeTrailJudgment(priceData: PriceData): void {
    const relevantPositions = Array.from(this.monitoredPositions.values())
      .filter(pos => pos.symbol === priceData.symbol && pos.trailSettings?.isActive)

    relevantPositions.forEach(position => {
      const cacheEntry = this.trailCalculationCache.get(position.id)
      
      // スロットリング制御
      if (cacheEntry && 
          Date.now() - cacheEntry.lastCalculation.getTime() < this.performanceConfig.calculationThrottleMs) {
        return
      }

      const judgment = this.calculateTrailJudgment(position, priceData)
      
      // キャッシュを更新
      this.trailCalculationCache.set(position.id, {
        positionId: position.id,
        lastPrice: priceData.bid,
        lastStopLoss: judgment.newStopLoss || position.trailSettings!.currentStopLoss,
        lastCalculation: new Date(),
        result: judgment
      })

      // トレール判定リスナーに通知
      if (judgment.shouldUpdate) {
        this.trailJudgmentListeners.forEach(listener => {
          try {
            listener(judgment)
          } catch (error) {
            console.error('Error in trail judgment listener:', error)
          }
        })
      }
    })
  }

  /**
   * 個別ポジションのトレール判定を計算
   */
  private calculateTrailJudgment(position: MonitoredPosition, priceData: PriceData): TrailJudgmentResult {
    const { trailSettings } = position
    if (!trailSettings) {
      return {
        positionId: position.id,
        shouldUpdate: false,
        reason: 'No trail settings',
        timestamp: new Date()
      }
    }

    const currentPrice = position.type === 'buy' ? priceData.bid : priceData.ask
    const currentStopLoss = trailSettings.currentStopLoss
    
    // 開始条件チェック
    if (!this.checkStartCondition(position, currentPrice, trailSettings)) {
      return {
        positionId: position.id,
        shouldUpdate: false,
        reason: 'Start condition not met',
        timestamp: new Date()
      }
    }

    // トレール計算
    const newStopLoss = this.calculateNewStopLoss(position, currentPrice, trailSettings)
    
    // 更新が必要かチェック
    const shouldUpdate = this.shouldUpdateStopLoss(position, currentStopLoss, newStopLoss)
    
    return {
      positionId: position.id,
      shouldUpdate,
      newStopLoss: shouldUpdate ? newStopLoss : undefined,
      previousStopLoss: currentStopLoss,
      reason: shouldUpdate ? 'Trail condition met' : 'No update needed',
      timestamp: new Date()
    }
  }

  /**
   * トレール開始条件をチェック
   */
  private checkStartCondition(
    position: MonitoredPosition,
    currentPrice: number,
    trailSettings: TrailSettings
  ): boolean {
    const { startCondition } = trailSettings
    
    switch (startCondition.type) {
      case 'immediate':
        return true
        
      case 'profit_threshold':
        if (!startCondition.value) return false
        const currentProfit = (currentPrice - position.openPrice) * 
          (position.type === 'buy' ? 1 : -1) * position.lots * 100000
        return currentProfit >= startCondition.value
        
      case 'price_level':
        if (!startCondition.value) return false
        return position.type === 'buy' ? 
          currentPrice >= startCondition.value : 
          currentPrice <= startCondition.value
          
      default:
        return false
    }
  }

  /**
   * 新しいストップロスレベルを計算
   */
  private calculateNewStopLoss(
    position: MonitoredPosition,
    currentPrice: number,
    trailSettings: TrailSettings
  ): number {
    const { type, trailAmount } = trailSettings
    
    switch (type) {
      case 'fixed':
        // 固定幅トレール（pips）
        const pipValue = this.getPipValue(position.symbol)
        return position.type === 'buy' ?
          currentPrice - (trailAmount * pipValue) :
          currentPrice + (trailAmount * pipValue)
          
      case 'percentage':
        // パーセンテージトレール
        const percentageOffset = currentPrice * (trailAmount / 100)
        return position.type === 'buy' ?
          currentPrice - percentageOffset :
          currentPrice + percentageOffset
          
      case 'atr':
        // ATRベーストレール（簡易実装）
        const atrValue = this.getAtrValue(position.symbol) || 0.001
        const atrOffset = atrValue * trailAmount
        return position.type === 'buy' ?
          currentPrice - atrOffset :
          currentPrice + atrOffset
          
      default:
        return trailSettings.currentStopLoss
    }
  }

  /**
   * ストップロス更新が必要かチェック
   */
  private shouldUpdateStopLoss(
    position: MonitoredPosition,
    currentStopLoss: number,
    newStopLoss: number
  ): boolean {
    // 買いポジションの場合、新しいストップロスが現在より高い場合のみ更新
    // 売りポジションの場合、新しいストップロスが現在より低い場合のみ更新
    return position.type === 'buy' ?
      newStopLoss > currentStopLoss :
      newStopLoss < currentStopLoss
  }

  /**
   * 異常価格を検出
   */
  private isAbnormalPrice(priceData: PriceData): boolean {
    const stats = this.abnormalPriceStats.get(priceData.symbol)
    
    // スプレッドチェック
    const spreadInPips = priceData.spread / this.getPipValue(priceData.symbol)
    if (spreadInPips > this.abnormalDetectionConfig.maxSpreadThreshold) {
      this.recordAbnormalPrice(priceData, 'excessive_spread')
      return true
    }

    // 価格変動チェック
    if (stats?.lastNormalPrice) {
      const priceChange = Math.abs(priceData.bid - stats.lastNormalPrice.bid) / stats.lastNormalPrice.bid
      if (priceChange > this.abnormalDetectionConfig.priceVolatilityThreshold / 100) {
        this.recordAbnormalPrice(priceData, 'excessive_volatility')
        return true
      }
    }

    // ボリュームチェック
    if (priceData.volume !== undefined && 
        priceData.volume < this.abnormalDetectionConfig.volumeThreshold!) {
      this.recordAbnormalPrice(priceData, 'low_volume')
      return true
    }

    // 正常価格として記録
    this.recordNormalPrice(priceData)
    return false
  }

  /**
   * 異常価格を記録
   */
  private recordAbnormalPrice(priceData: PriceData, reason: string): void {
    let stats = this.abnormalPriceStats.get(priceData.symbol)
    if (!stats) {
      stats = {
        symbol: priceData.symbol,
        consecutiveAbnormalCount: 0,
        lastNormalPrice: null,
        abnormalPriceHistory: []
      }
      this.abnormalPriceStats.set(priceData.symbol, stats)
    }

    stats.consecutiveAbnormalCount++
    stats.abnormalPriceHistory.push(priceData)
    
    // 履歴サイズ制限
    if (stats.abnormalPriceHistory.length > 10) {
      stats.abnormalPriceHistory.shift()
    }

    console.warn(`Abnormal price for ${priceData.symbol}: ${reason}`, {
      price: priceData,
      consecutiveCount: stats.consecutiveAbnormalCount
    })
  }

  /**
   * 正常価格を記録
   */
  private recordNormalPrice(priceData: PriceData): void {
    let stats = this.abnormalPriceStats.get(priceData.symbol)
    if (!stats) {
      stats = {
        symbol: priceData.symbol,
        consecutiveAbnormalCount: 0,
        lastNormalPrice: null,
        abnormalPriceHistory: []
      }
      this.abnormalPriceStats.set(priceData.symbol, stats)
    }

    stats.consecutiveAbnormalCount = 0
    stats.lastNormalPrice = priceData
  }

  /**
   * 価格データをキャッシュに保存
   */
  private cachePriceData(priceData: PriceData): void {
    // キャッシュサイズ制限
    if (this.priceDataCache.size >= this.performanceConfig.maxCachedPrices) {
      this.evictOldestPriceData()
    }

    this.priceDataCache.set(priceData.symbol, {
      data: priceData,
      timestamp: Date.now(),
      accessCount: 1
    })
  }

  /**
   * 最古の価格データを除去
   */
  private evictOldestPriceData(): void {
    let oldestKey = ''
    let oldestTime = Date.now()

    for (const [key, entry] of this.priceDataCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.priceDataCache.delete(oldestKey)
    }
  }

  /**
   * メモリクリーンアップを開始
   */
  private startMemoryCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.performMemoryCleanup()
    }, this.performanceConfig.memoryCleanupInterval)
  }

  /**
   * メモリクリーンアップを実行
   */
  private performMemoryCleanup(): void {
    const now = Date.now()
    let removedCount = 0

    // 期限切れ価格データの削除
    for (const [key, entry] of this.priceDataCache.entries()) {
      if (now - entry.timestamp > this.performanceConfig.priceDataTtl) {
        this.priceDataCache.delete(key)
        removedCount++
      }
    }

    // 古いトレール計算キャッシュの削除
    for (const [key, entry] of this.trailCalculationCache.entries()) {
      if (now - entry.lastCalculation.getTime() > this.performanceConfig.priceDataTtl * 2) {
        this.trailCalculationCache.delete(key)
        removedCount++
      }
    }

    this.lastCleanup = now
    
    if (removedCount > 0) {
      console.debug(`Memory cleanup completed: ${removedCount} entries removed`)
    }
  }

  /**
   * シンボルのpip値を取得
   */
  private getPipValue(symbol: string): number {
    // 簡易実装 - 実際にはシンボル情報から正確な値を取得する必要あり
    if (symbol.includes('JPY')) {
      return 0.01 // JPYペアは第2小数点がpip
    }
    return 0.0001 // その他は第4小数点がpip
  }

  /**
   * シンボルのATR値を取得（簡易実装）
   */
  private getAtrValue(symbol: string): number {
    // 実際の実装では過去のATR値を計算する必要がある
    return this.getPipValue(symbol) * 20 // 簡易的に20pips相当を返す
  }

  /**
   * 価格更新リスナーを追加
   */
  onPriceUpdate(listener: (symbol: string, price: PriceData) => void): void {
    this.priceUpdateListeners.push(listener)
  }

  /**
   * トレール判定リスナーを追加
   */
  onTrailJudgment(listener: (result: TrailJudgmentResult) => void): void {
    this.trailJudgmentListeners.push(listener)
  }

  /**
   * 統計情報を取得
   */
  getStats() {
    return {
      monitoredPositions: this.monitoredPositions.size,
      cachedPrices: this.priceDataCache.size,
      trailCalculationCache: this.trailCalculationCache.size,
      abnormalPriceStats: this.abnormalPriceStats.size,
      lastCleanup: new Date(this.lastCleanup),
      memoryUsage: this.priceDataCache.size * 256 + this.trailCalculationCache.size * 128 // 推定値
    }
  }

  /**
   * 破棄処理
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    
    this.priceDataCache.clear()
    this.trailCalculationCache.clear()
    this.abnormalPriceStats.clear()
    this.monitoredPositions.clear()
    this.priceUpdateListeners.length = 0
    this.trailJudgmentListeners.length = 0
  }
}