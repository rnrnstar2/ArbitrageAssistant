'use client'

import { useMemo, useCallback, useRef, useEffect } from 'react'

// パフォーマンス統計情報
export interface PerformanceStats {
  renderCount: number
  averageRenderTime: number
  lastRenderTime: number
  memoryUsage: number
  updateFrequency: number
  cacheHitRate: number
}

// メモ化キャッシュ
class MemoizationCache<T = any> {
  private cache = new Map<string, { value: T; timestamp: number; accessed: number }>()
  private maxSize = 100
  private ttl = 5000 // 5秒

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed()
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessed: 1
    })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // TTLチェック
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // アクセス回数更新
    entry.accessed++
    return entry.value
  }

  private evictLeastRecentlyUsed(): void {
    let lruKey = ''
    let lruAccessed = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessed < lruAccessed) {
        lruAccessed = entry.accessed
        lruKey = key
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey)
    }
  }

  clear(): void {
    this.cache.clear()
  }

  getStats() {
    return {
      size: this.cache.size,
      totalAccessed: Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.accessed, 0)
    }
  }
}

// グローバルキャッシュインスタンス
const globalMemoCache = new MemoizationCache()

// 計算結果のメモ化フック
export function useMemoizedCalculation<T>(
  calculateFn: () => T,
  dependencies: any[],
  cacheKey?: string
): T {
  const key = cacheKey || JSON.stringify(dependencies)
  
  return useMemo(() => {
    // キャッシュから取得を試行
    const cached = globalMemoCache.get(key)
    if (cached !== null) {
      return cached
    }

    // 計算実行
    const result = calculateFn()
    
    // 結果をキャッシュ
    globalMemoCache.set(key, result)
    
    return result
  }, dependencies)
}

// パフォーマンス監視フック
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0)
  const renderTimesRef = useRef<number[]>([])
  const lastRenderStartRef = useRef(0)

  // レンダー開始時間記録
  lastRenderStartRef.current = performance.now()

  useEffect(() => {
    // レンダー完了時間記録
    const renderTime = performance.now() - lastRenderStartRef.current
    renderCountRef.current++
    renderTimesRef.current.push(renderTime)

    // 直近10回のレンダー時間のみ保持
    if (renderTimesRef.current.length > 10) {
      renderTimesRef.current.shift()
    }

    // デバッグログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(`${componentName}: Slow render detected (${renderTime.toFixed(2)}ms)`)
    }
  })

  const getStats = useCallback((): PerformanceStats => {
    const averageRenderTime = renderTimesRef.current.length > 0
      ? renderTimesRef.current.reduce((sum, time) => sum + time, 0) / renderTimesRef.current.length
      : 0

    const lastRenderTime = renderTimesRef.current[renderTimesRef.current.length - 1] || 0

    // メモリ使用量の推定
    const memoryUsage = typeof window !== 'undefined' && (window.performance as any).memory
      ? (window.performance as any).memory.usedJSHeapSize / 1024 / 1024 // MB
      : 0

    const cacheStats = globalMemoCache.getStats()
    const cacheHitRate = cacheStats.totalAccessed > 0 ? (cacheStats.totalAccessed / cacheStats.size) * 100 : 0

    return {
      renderCount: renderCountRef.current,
      averageRenderTime: Number(averageRenderTime.toFixed(2)),
      lastRenderTime: Number(lastRenderTime.toFixed(2)),
      memoryUsage: Number(memoryUsage.toFixed(2)),
      updateFrequency: 0, // この値は呼び出し側で設定
      cacheHitRate: Number(cacheHitRate.toFixed(2))
    }
  }, [])

  return { getStats }
}

// 効率的な配列差分更新
export function useEfficientArrayUpdate<T extends { id: string | number }>(
  newArray: T[],
  keySelector: (item: T) => string | number = (item) => item.id
) {
  const previousArrayRef = useRef<T[]>([])
  const previousMapRef = useRef<Map<string | number, T>>(new Map())

  return useMemo(() => {
    const newMap = new Map<string | number, T>()
    const changes: {
      added: T[]
      updated: T[]
      removed: T[]
      unchanged: T[]
    } = {
      added: [],
      updated: [],
      removed: [],
      unchanged: []
    }

    // 新しい配列をマップに変換
    newArray.forEach(item => {
      const key = keySelector(item)
      newMap.set(key, item)
    })

    // 追加・更新の検出
    for (const [key, newItem] of newMap.entries()) {
      const oldItem = previousMapRef.current.get(key)
      if (!oldItem) {
        changes.added.push(newItem)
      } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
        changes.updated.push(newItem)
      } else {
        changes.unchanged.push(newItem)
      }
    }

    // 削除の検出
    for (const [key, oldItem] of previousMapRef.current.entries()) {
      if (!newMap.has(key)) {
        changes.removed.push(oldItem)
      }
    }

    // 参照を更新
    previousArrayRef.current = newArray
    previousMapRef.current = newMap

    return {
      array: newArray,
      changes,
      hasChanges: changes.added.length > 0 || changes.updated.length > 0 || changes.removed.length > 0
    }
  }, [newArray, keySelector])
}

// スロットルされたコールバック
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallRef.current

    if (timeSinceLastCall >= delay) {
      lastCallRef.current = now
      return callback(...args)
    } else {
      // スロットル中の場合、遅延実行
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now()
        callback(...args)
      }, delay - timeSinceLastCall)
    }
  }, [callback, delay]) as T
}

// 仮想化のためのアイテム計算
export function useVirtualizedItems<T>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  buffer: number = 5
) {
  return useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const totalCount = items.length
    const bufferCount = Math.min(buffer, totalCount)

    return {
      visibleCount,
      totalCount,
      bufferCount,
      totalHeight: totalCount * itemHeight,
      getVisibleItems: (scrollTop: number) => {
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferCount)
        const endIndex = Math.min(totalCount - 1, startIndex + visibleCount + bufferCount * 2)
        
        return {
          startIndex,
          endIndex,
          items: items.slice(startIndex, endIndex + 1),
          offsetY: startIndex * itemHeight
        }
      }
    }
  }, [items, containerHeight, itemHeight, buffer])
}

// WebWorkerでの重い計算処理
export class CalculationWorkerManager {
  private worker: Worker | null = null
  private pendingCalculations = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
  }>()

  constructor() {
    if (typeof window !== 'undefined' && window.Worker) {
      try {
        // インラインWebWorkerの作成
        const workerScript = `
          self.onmessage = function(e) {
            const { id, type, data } = e.data;
            
            try {
              let result;
              
              switch (type) {
                case 'calculate-profit-loss':
                  result = calculateProfitLoss(data);
                  break;
                case 'calculate-risk-metrics':
                  result = calculateRiskMetrics(data);
                  break;
                case 'analyze-positions':
                  result = analyzePositions(data);
                  break;
                default:
                  throw new Error('Unknown calculation type: ' + type);
              }
              
              self.postMessage({ id, result });
            } catch (error) {
              self.postMessage({ id, error: error.message });
            }
          };
          
          function calculateProfitLoss(positions) {
            return positions.map(pos => ({
              ...pos,
              profit: (pos.currentPrice - pos.openPrice) * pos.lots * (pos.type === 'buy' ? 1 : -1) * 100000
            }));
          }
          
          function calculateRiskMetrics(accounts) {
            const totalEquity = accounts.reduce((sum, acc) => sum + acc.equity, 0);
            const totalMargin = accounts.reduce((sum, acc) => sum + acc.margin, 0);
            const marginLevel = totalEquity > 0 ? (totalMargin / totalEquity) * 100 : 0;
            
            return {
              totalEquity,
              totalMargin,
              marginLevel,
              riskScore: Math.min(100, marginLevel + 10)
            };
          }
          
          function analyzePositions(positions) {
            const bySymbol = {};
            const byType = { buy: 0, sell: 0 };
            
            positions.forEach(pos => {
              bySymbol[pos.symbol] = (bySymbol[pos.symbol] || 0) + pos.lots;
              byType[pos.type] += pos.lots;
            });
            
            return { bySymbol, byType };
          }
        `
        
        const blob = new Blob([workerScript], { type: 'application/javascript' })
        this.worker = new Worker(URL.createObjectURL(blob))
        
        this.worker.onmessage = (e) => {
          const { id, result, error } = e.data
          const pending = this.pendingCalculations.get(id)
          
          if (pending) {
            this.pendingCalculations.delete(id)
            if (error) {
              pending.reject(new Error(error))
            } else {
              pending.resolve(result)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to create WebWorker:', error)
      }
    }
  }

  calculate<T>(type: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        // WebWorkerが使用できない場合はメインスレッドで実行
        reject(new Error('WebWorker not available'))
        return
      }

      const id = Math.random().toString(36).substr(2, 9)
      this.pendingCalculations.set(id, { resolve, reject })
      
      this.worker.postMessage({ id, type, data })
      
      // タイムアウト処理
      setTimeout(() => {
        if (this.pendingCalculations.has(id)) {
          this.pendingCalculations.delete(id)
          reject(new Error('Calculation timeout'))
        }
      }, 5000)
    })
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pendingCalculations.clear()
  }
}

// グローバルワーカーマネージャー
let globalWorkerManager: CalculationWorkerManager | null = null

export function getCalculationWorker(): CalculationWorkerManager {
  if (!globalWorkerManager) {
    globalWorkerManager = new CalculationWorkerManager()
  }
  return globalWorkerManager
}

// デバッグ用のパフォーマンス情報表示
export function usePerformanceDebugger(enabled: boolean = false) {
  const statsRef = useRef<PerformanceStats[]>([])

  const addStats = useCallback((stats: PerformanceStats) => {
    statsRef.current.push(stats)
    if (statsRef.current.length > 100) {
      statsRef.current.shift()
    }
  }, [])

  const logStats = useCallback(() => {
    if (enabled && statsRef.current.length > 0) {
      const latest = statsRef.current[statsRef.current.length - 1]
      console.group('Performance Stats')
      console.log('Render Count:', latest.renderCount)
      console.log('Average Render Time:', latest.averageRenderTime + 'ms')
      console.log('Memory Usage:', latest.memoryUsage + 'MB')
      console.log('Cache Hit Rate:', latest.cacheHitRate + '%')
      console.groupEnd()
    }
  }, [enabled])

  useEffect(() => {
    if (enabled) {
      const interval = setInterval(logStats, 10000) // 10秒ごと
      return () => clearInterval(interval)
    }
  }, [enabled, logStats])

  return { addStats, logStats }
}