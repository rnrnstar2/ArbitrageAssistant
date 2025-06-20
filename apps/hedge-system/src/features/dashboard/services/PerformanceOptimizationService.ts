'use client'

/**
 * パフォーマンス最適化・メモリ管理サービス
 * 50台までのクライアント対応を実現するための最適化機能
 */

export interface PerformanceMetrics {
  memoryUsage: number
  cpuUsage: number
  renderTime: number
  wsMessageRate: number
  cacheHitRate: number
  dataUpdateRate: number
  connectionCount: number
}

export interface MemoryStats {
  totalMemory: number
  usedMemory: number
  freeMemory: number
  gcFrequency: number
  heapSize: number
  cacheSize: number
}

export interface OptimizationConfig {
  maxMemoryUsage: number // MB
  maxCacheSize: number
  gcThreshold: number
  renderOptimization: boolean
  dataCompression: boolean
  batchUpdates: boolean
  virtualScrolling: boolean
}

export interface DataCompressionResult {
  original: any
  compressed: string
  compressionRatio: number
  decompressTime: number
}

// リアルタイムデータキャッシュ
class RealTimeDataCache {
  private cache = new Map<string, {
    data: any
    timestamp: number
    accessCount: number
    size: number
  }>()
  private maxSize: number
  private totalSize = 0

  constructor(maxSize: number = 50 * 1024 * 1024) { // 50MB
    this.maxSize = maxSize
    this.startCleanupTimer()
  }

  set(key: string, data: any, ttl: number = 5000): void {
    const serialized = JSON.stringify(data)
    const size = new Blob([serialized]).size

    // メモリ制限チェック
    if (this.totalSize + size > this.maxSize) {
      this.evictOldest(size)
    }

    // 既存エントリがある場合、サイズを調整
    const existing = this.cache.get(key)
    if (existing) {
      this.totalSize -= existing.size
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      size
    })

    this.totalSize += size
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // TTLチェック（5秒）
    if (Date.now() - entry.timestamp > 5000) {
      this.totalSize -= entry.size
      this.cache.delete(key)
      return null
    }

    entry.accessCount++
    return entry.data
  }

  private evictOldest(requiredSize: number): void {
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

    let freedSize = 0
    for (const [key, entry] of entries) {
      this.cache.delete(key)
      this.totalSize -= entry.size
      freedSize += entry.size

      if (freedSize >= requiredSize) break
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > 30000) { // 30秒で期限切れ
          this.totalSize -= entry.size
          this.cache.delete(key)
        }
      }
    }, 10000) // 10秒ごとにクリーンアップ
  }

  getStats() {
    return {
      entryCount: this.cache.size,
      totalSize: this.totalSize,
      hitRate: this.calculateHitRate(),
      oldestEntry: this.getOldestEntryAge()
    }
  }

  private calculateHitRate(): number {
    const entries = Array.from(this.cache.values())
    if (entries.length === 0) return 0

    const totalAccess = entries.reduce((sum, entry) => sum + entry.accessCount, 0)
    return (totalAccess / entries.length) * 100
  }

  private getOldestEntryAge(): number {
    const entries = Array.from(this.cache.values())
    if (entries.length === 0) return 0

    const oldest = entries.reduce((oldest, entry) => 
      entry.timestamp < oldest.timestamp ? entry : oldest
    )
    return Date.now() - oldest.timestamp
  }
}

// データ圧縮マネージャー
class DataCompressionManager {
  compress(data: any): DataCompressionResult {
    const start = performance.now()
    const original = JSON.stringify(data)
    
    // 簡易圧縮（実際のプロダクションではLZ4やGzipを使用）
    const compressed = this.simpleCompress(original)
    const decompressTime = performance.now() - start

    return {
      original: data,
      compressed,
      compressionRatio: (1 - compressed.length / original.length) * 100,
      decompressTime
    }
  }

  decompress(compressed: string): any {
    const decompressed = this.simpleDecompress(compressed)
    return JSON.parse(decompressed)
  }

  private simpleCompress(str: string): string {
    // 簡易Run-Length Encoding
    return str.replace(/(.)\1+/g, (match, char) => `${char}${match.length}`)
  }

  private simpleDecompress(str: string): string {
    return str.replace(/(.)\d+/g, (match, char) => {
      const count = parseInt(match.slice(1))
      return char.repeat(count)
    })
  }
}

// メモリ監視マネージャー
class MemoryMonitor {
  private memoryStats: MemoryStats[] = []
  private isMonitoring = false

  startMonitoring(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    const monitor = () => {
      if (!this.isMonitoring) return

      const stats = this.collectMemoryStats()
      this.memoryStats.push(stats)

      // 直近100件のみ保持
      if (this.memoryStats.length > 100) {
        this.memoryStats.shift()
      }

      // メモリ使用量が閾値を超えた場合の警告
      if (stats.usedMemory > 500) { // 500MB
        console.warn('High memory usage detected:', stats.usedMemory, 'MB')
        this.triggerGarbageCollection()
      }

      setTimeout(monitor, 5000) // 5秒ごと
    }

    monitor()
  }

  stopMonitoring(): void {
    this.isMonitoring = false
  }

  private collectMemoryStats(): MemoryStats {
    // Tauri環境でのメモリ統計収集
    let memoryInfo: any = {}
    
    try {
      // ブラウザのメモリAPI（Chrome/Edge）
      if ('memory' in performance) {
        memoryInfo = (performance as any).memory
      }
    } catch (error) {
      // メモリ情報が取得できない場合のフォールバック
    }

    return {
      totalMemory: memoryInfo.totalJSHeapSize || 0,
      usedMemory: (memoryInfo.usedJSHeapSize || 0) / 1024 / 1024, // MB
      freeMemory: (memoryInfo.totalJSHeapSize - memoryInfo.usedJSHeapSize || 0) / 1024 / 1024,
      gcFrequency: 0, // 別途計測
      heapSize: (memoryInfo.totalJSHeapSize || 0) / 1024 / 1024,
      cacheSize: 0 // キャッシュマネージャーから取得
    }
  }

  private triggerGarbageCollection(): void {
    // 手動GCトリガー（開発環境のみ）
    if (typeof globalThis.gc === 'function') {
      globalThis.gc()
    }
  }

  getMemoryTrend(): {
    current: MemoryStats
    average: MemoryStats
    peak: MemoryStats
    trend: 'increasing' | 'decreasing' | 'stable'
  } {
    if (this.memoryStats.length === 0) {
      const empty: MemoryStats = {
        totalMemory: 0, usedMemory: 0, freeMemory: 0,
        gcFrequency: 0, heapSize: 0, cacheSize: 0
      }
      return { current: empty, average: empty, peak: empty, trend: 'stable' }
    }

    const current = this.memoryStats[this.memoryStats.length - 1]
    const peak = this.memoryStats.reduce((max, stats) => 
      stats.usedMemory > max.usedMemory ? stats : max
    )

    const sum = this.memoryStats.reduce((acc, stats) => ({
      totalMemory: acc.totalMemory + stats.totalMemory,
      usedMemory: acc.usedMemory + stats.usedMemory,
      freeMemory: acc.freeMemory + stats.freeMemory,
      gcFrequency: acc.gcFrequency + stats.gcFrequency,
      heapSize: acc.heapSize + stats.heapSize,
      cacheSize: acc.cacheSize + stats.cacheSize
    }))

    const average: MemoryStats = {
      totalMemory: sum.totalMemory / this.memoryStats.length,
      usedMemory: sum.usedMemory / this.memoryStats.length,
      freeMemory: sum.freeMemory / this.memoryStats.length,
      gcFrequency: sum.gcFrequency / this.memoryStats.length,
      heapSize: sum.heapSize / this.memoryStats.length,
      cacheSize: sum.cacheSize / this.memoryStats.length
    }

    // トレンド計算（直近10件）
    const recent = this.memoryStats.slice(-10)
    const recentAvg = recent.reduce((sum, stats) => sum + stats.usedMemory, 0) / recent.length
    const prevAvg = this.memoryStats.slice(-20, -10)
      .reduce((sum, stats) => sum + stats.usedMemory, 0) / 10

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (recentAvg > prevAvg * 1.1) trend = 'increasing'
    else if (recentAvg < prevAvg * 0.9) trend = 'decreasing'

    return { current, average, peak, trend }
  }
}

// レンダリング最適化マネージャー
class RenderOptimizer {
  private renderTimes: number[] = []
  private throttledCallbacks = new Map<string, NodeJS.Timeout>()

  measureRenderTime(componentName: string, renderFn: () => void): void {
    const start = performance.now()
    renderFn()
    const renderTime = performance.now() - start

    this.renderTimes.push(renderTime)
    if (this.renderTimes.length > 50) {
      this.renderTimes.shift()
    }

    // 遅いレンダリングの警告
    if (renderTime > 16) { // 60fps = 16.67ms
      console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`)
    }
  }

  throttleCallback(key: string, callback: () => void, delay: number): void {
    const existing = this.throttledCallbacks.get(key)
    if (existing) {
      clearTimeout(existing)
    }

    const timeout = setTimeout(() => {
      callback()
      this.throttledCallbacks.delete(key)
    }, delay)

    this.throttledCallbacks.set(key, timeout)
  }

  batchUpdates<T>(updates: Array<() => T>): T[] {
    // React 18のバッチ更新を活用
    return updates.map(update => update())
  }

  getAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0
    return this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length
  }
}

// メインのパフォーマンス最適化サービス
export class PerformanceOptimizationService {
  private cache: RealTimeDataCache
  private compression: DataCompressionManager
  private memoryMonitor: MemoryMonitor
  private renderOptimizer: RenderOptimizer
  private config: OptimizationConfig
  private metrics: PerformanceMetrics
  private isEnabled = true

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      maxMemoryUsage: 500, // 500MB
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      gcThreshold: 400, // 400MB
      renderOptimization: true,
      dataCompression: true,
      batchUpdates: true,
      virtualScrolling: true,
      ...config
    }

    this.cache = new RealTimeDataCache(this.config.maxCacheSize)
    this.compression = new DataCompressionManager()
    this.memoryMonitor = new MemoryMonitor()
    this.renderOptimizer = new RenderOptimizer()

    this.metrics = {
      memoryUsage: 0,
      cpuUsage: 0,
      renderTime: 0,
      wsMessageRate: 0,
      cacheHitRate: 0,
      dataUpdateRate: 0,
      connectionCount: 0
    }

    this.initialize()
  }

  private initialize(): void {
    if (this.isEnabled) {
      this.memoryMonitor.startMonitoring()
      this.startMetricsCollection()
    }
  }

  // データキャッシュ操作
  cacheData(key: string, data: any, ttl?: number): void {
    if (this.config.dataCompression && this.shouldCompress(data)) {
      const compressed = this.compression.compress(data)
      this.cache.set(`${key}:compressed`, compressed.compressed, ttl)
    } else {
      this.cache.set(key, data, ttl)
    }
  }

  getCachedData(key: string): any | null {
    let data = this.cache.get(key)
    if (!data) {
      // 圧縮データをチェック
      const compressed = this.cache.get(`${key}:compressed`)
      if (compressed) {
        data = this.compression.decompress(compressed)
      }
    }
    return data
  }

  // メモリ最適化
  optimizeMemory(): void {
    const memoryTrend = this.memoryMonitor.getMemoryTrend()
    
    if (memoryTrend.current.usedMemory > this.config.maxMemoryUsage) {
      console.log('Memory optimization triggered')
      
      // キャッシュのクリーンアップ
      this.cache = new RealTimeDataCache(this.config.maxCacheSize)
      
      // 明示的なガベージコレクション
      if (typeof globalThis.gc === 'function') {
        globalThis.gc()
      }
    }
  }

  // レンダリング最適化
  optimizeRender(componentName: string, renderFn: () => void): void {
    if (this.config.renderOptimization) {
      this.renderOptimizer.measureRenderTime(componentName, renderFn)
    } else {
      renderFn()
    }
  }

  throttleUpdate(key: string, updateFn: () => void, delay: number = 100): void {
    this.renderOptimizer.throttleCallback(key, updateFn, delay)
  }

  batchDataUpdates<T>(updates: Array<() => T>): T[] {
    if (this.config.batchUpdates) {
      return this.renderOptimizer.batchUpdates(updates)
    }
    return updates.map(update => update())
  }

  // パフォーマンス監視
  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics()
    }, 1000) // 1秒ごと
  }

  private updateMetrics(): void {
    const memoryTrend = this.memoryMonitor.getMemoryTrend()
    const cacheStats = this.cache.getStats()

    this.metrics = {
      memoryUsage: memoryTrend.current.usedMemory,
      cpuUsage: 0, // TODO: CPU使用率の計測
      renderTime: this.renderOptimizer.getAverageRenderTime(),
      wsMessageRate: 0, // WebSocketメッセージレートは外部から設定
      cacheHitRate: cacheStats.hitRate,
      dataUpdateRate: 0, // データ更新レートは外部から設定
      connectionCount: 0 // 接続数は外部から設定
    }
  }

  // 設定とメトリクス取得
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  getMemoryStats(): MemoryStats {
    return this.memoryMonitor.getMemoryTrend().current
  }

  updateConfig(config: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  setConnectionCount(count: number): void {
    this.metrics.connectionCount = count
  }

  setWebSocketMessageRate(rate: number): void {
    this.metrics.wsMessageRate = rate
  }

  setDataUpdateRate(rate: number): void {
    this.metrics.dataUpdateRate = rate
  }

  // データサイズチェック
  private shouldCompress(data: any): boolean {
    const size = new Blob([JSON.stringify(data)]).size
    return size > 1024 // 1KB以上で圧縮
  }

  // アラート機能
  checkPerformanceAlerts(): {
    type: 'memory' | 'render' | 'cache' | 'connection'
    level: 'warning' | 'critical'
    message: string
  }[] {
    const alerts: {
      type: 'memory' | 'render' | 'cache' | 'connection'
      level: 'warning' | 'critical'
      message: string
    }[] = []

    // メモリアラート
    if (this.metrics.memoryUsage > this.config.maxMemoryUsage * 0.9) {
      alerts.push({
        type: 'memory',
        level: this.metrics.memoryUsage > this.config.maxMemoryUsage ? 'critical' : 'warning',
        message: `High memory usage: ${this.metrics.memoryUsage.toFixed(1)}MB`
      })
    }

    // レンダリングアラート
    if (this.metrics.renderTime > 33) { // 30fps
      alerts.push({
        type: 'render',
        level: this.metrics.renderTime > 66 ? 'critical' : 'warning',
        message: `Slow rendering: ${this.metrics.renderTime.toFixed(1)}ms`
      })
    }

    // キャッシュアラート
    if (this.metrics.cacheHitRate < 50) {
      alerts.push({
        type: 'cache',
        level: this.metrics.cacheHitRate < 25 ? 'critical' : 'warning',
        message: `Low cache hit rate: ${this.metrics.cacheHitRate.toFixed(1)}%`
      })
    }

    // 接続数アラート
    if (this.metrics.connectionCount > 40) {
      alerts.push({
        type: 'connection',
        level: this.metrics.connectionCount > 50 ? 'critical' : 'warning',
        message: `High connection count: ${this.metrics.connectionCount}`
      })
    }

    return alerts
  }

  // サービスの停止
  dispose(): void {
    this.isEnabled = false
    this.memoryMonitor.stopMonitoring()
  }
}

// シングルトンインスタンス
let performanceService: PerformanceOptimizationService | null = null

export function getPerformanceOptimizationService(
  config?: Partial<OptimizationConfig>
): PerformanceOptimizationService {
  if (!performanceService) {
    performanceService = new PerformanceOptimizationService(config)
  }
  return performanceService
}

// React Hook
export function usePerformanceOptimization() {
  const service = getPerformanceOptimizationService()
  
  return {
    cacheData: (key: string, data: any, ttl?: number) => service.cacheData(key, data, ttl),
    getCachedData: (key: string) => service.getCachedData(key),
    optimizeMemory: () => service.optimizeMemory(),
    optimizeRender: (componentName: string, renderFn: () => void) => 
      service.optimizeRender(componentName, renderFn),
    throttleUpdate: (key: string, updateFn: () => void, delay?: number) => 
      service.throttleUpdate(key, updateFn, delay),
    batchUpdates: <T>(updates: Array<() => T>) => service.batchDataUpdates(updates),
    getMetrics: () => service.getMetrics(),
    getMemoryStats: () => service.getMemoryStats(),
    checkAlerts: () => service.checkPerformanceAlerts(),
    setConnectionCount: (count: number) => service.setConnectionCount(count),
    setMessageRate: (rate: number) => service.setWebSocketMessageRate(rate),
    setUpdateRate: (rate: number) => service.setDataUpdateRate(rate)
  }
}