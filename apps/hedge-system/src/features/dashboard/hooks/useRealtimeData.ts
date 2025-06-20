'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RealtimeDashboardData, Account, Position, MarketData, Alert, SystemStatus, DashboardAnalytics } from '../types'

export interface RealtimeDataCache<T> {
  data: T
  timestamp: number
  ttl: number
  hits: number
}

export class RealtimeDataCacheManager<T = any> {
  private cache = new Map<string, RealtimeDataCache<T>>()
  private maxSize = 1000
  private defaultTtl = 5000 // 5秒

  set(key: string, data: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
      hits: 0
    })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    entry.hits++
    return entry.data
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  private evictOldest(): void {
    let oldestKey = ''
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  cleanup(): number {
    const now = Date.now()
    let removedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        removedCount++
      }
    }

    return removedCount
  }

  getStats() {
    const totalEntries = this.cache.size
    const totalHits = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.hits, 0)
    
    return {
      size: totalEntries,
      totalHits,
      memoryUsage: totalEntries * 128 // 推定値
    }
  }
}

export interface UseRealtimeDataOptions {
  enabled?: boolean
  throttleMs?: number
  cacheEnabled?: boolean
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  updateFilters?: {
    accounts?: string[]
    symbols?: string[]
    dataTypes?: Array<'accounts' | 'positions' | 'marketData' | 'alerts' | 'systemStatus'>
  }
}

export interface UseRealtimeDataReturn {
  data: RealtimeDashboardData
  loading: boolean
  error: Error | null
  lastUpdate: Date | null
  updateFrequency: number
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
  cacheStats: {
    size: number
    totalHits: number
    memoryUsage: number
  }
  reconnect: () => void
  forceRefresh: () => void
}

export function useRealtimeData({
  enabled = true,
  throttleMs = 1000,
  cacheEnabled = true,
  autoReconnect = true,
  maxReconnectAttempts = 5,
  updateFilters
}: UseRealtimeDataOptions = {}): UseRealtimeDataReturn {
  const [data, setData] = useState<RealtimeDashboardData>({
    accounts: [],
    positions: [],
    marketData: [],
    alerts: [],
    systemStatus: {
      uptime: 0,
      connectionCount: 0,
      dataLatency: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastHealthCheck: new Date(),
      version: '1.0.0'
    },
    analytics: {
      totalAccounts: 0,
      connectedAccounts: 0,
      totalPositions: 0,
      totalProfit: 0,
      totalExposure: 0,
      riskScore: 0,
      marginUtilization: 0,
      exposureBySymbol: {},
      profitByAccount: {}
    }
  })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [updateFrequency, setUpdateFrequency] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected')

  const wsRef = useRef<WebSocket | null>(null)
  const cacheManagerRef = useRef<RealtimeDataCacheManager>(new RealtimeDataCacheManager())
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const updateCountRef = useRef(0)
  const lastUpdateTimeRef = useRef(Date.now())
  const subscriptionId = useRef(`realtime-data-${Math.random().toString(36).substr(2, 9)}`)

  const generateAnalytics = useCallback((accounts: Account[], positions: Position[]): DashboardAnalytics => {
    const connectedAccounts = accounts.filter(acc => acc.status === 'connected')
    const totalProfit = positions.reduce((sum, pos) => sum + pos.profit, 0)
    const totalExposure = positions.reduce((sum, pos) => sum + (pos.lots * pos.currentPrice), 0)
    
    const exposureBySymbol: Record<string, number> = {}
    const profitByAccount: Record<string, number> = {}
    
    positions.forEach(pos => {
      exposureBySymbol[pos.symbol] = (exposureBySymbol[pos.symbol] || 0) + (pos.lots * pos.currentPrice)
      profitByAccount[pos.accountId] = (profitByAccount[pos.accountId] || 0) + pos.profit
    })

    const totalMargin = accounts.reduce((sum, acc) => sum + acc.margin, 0)
    const totalEquity = accounts.reduce((sum, acc) => sum + acc.equity, 0)
    const marginUtilization = totalEquity > 0 ? (totalMargin / totalEquity) * 100 : 0
    
    // リスクスコア計算（簡易版）
    const riskScore = Math.min(100, Math.max(0, marginUtilization + (Math.abs(totalProfit) / 10000) * 10))

    return {
      totalAccounts: accounts.length,
      connectedAccounts: connectedAccounts.length,
      totalPositions: positions.length,
      totalProfit,
      totalExposure,
      riskScore,
      marginUtilization,
      exposureBySymbol,
      profitByAccount
    }
  }, [])

  const generateMockData = useCallback((): RealtimeDashboardData => {
    const accounts: Account[] = [
      {
        id: 'acc-1',
        clientPCId: 'client-1',
        broker: 'XM Trading',
        accountNumber: '12345678',
        balance: 10000 + Math.random() * 1000,
        equity: 10500 + Math.random() * 1000,
        margin: 2000 + Math.random() * 500,
        marginLevel: 300 + Math.random() * 200,
        bonusAmount: 5000 + Math.random() * 1000,
        status: 'connected',
        lastUpdate: new Date(),
        positions: []
      },
      {
        id: 'acc-2',
        clientPCId: 'client-1',
        broker: 'FXGT',
        accountNumber: '87654321',
        balance: 8000 + Math.random() * 800,
        equity: 8300 + Math.random() * 800,
        margin: 1500 + Math.random() * 300,
        marginLevel: 250 + Math.random() * 150,
        bonusAmount: 3000 + Math.random() * 500,
        status: 'connected',
        lastUpdate: new Date(),
        positions: []
      }
    ]

    const positions: Position[] = [
      {
        id: 'pos-1',
        accountId: 'acc-1',
        symbol: 'USDJPY',
        type: 'buy',
        lots: 0.1,
        openPrice: 150.25,
        currentPrice: 150.25 + (Math.random() - 0.5) * 0.5,
        profit: (Math.random() - 0.5) * 100,
        openTime: new Date(Date.now() - 3600000),
        updateTime: new Date()
      },
      {
        id: 'pos-2',
        accountId: 'acc-2',
        symbol: 'EURUSD',
        type: 'sell',
        lots: 0.05,
        openPrice: 1.0850,
        currentPrice: 1.0850 + (Math.random() - 0.5) * 0.002,
        profit: (Math.random() - 0.5) * 80,
        openTime: new Date(Date.now() - 1800000),
        updateTime: new Date()
      }
    ]

    // アカウントにポジションを割り当て
    accounts.forEach(acc => {
      acc.positions = positions.filter(pos => pos.accountId === acc.id)
    })

    const marketData: MarketData[] = [
      {
        symbol: 'USDJPY',
        bid: 150.245,
        ask: 150.255,
        spread: 0.01,
        timestamp: new Date(),
        volume: 1000000,
        high24h: 150.5,
        low24h: 149.8,
        change24h: 0.15
      },
      {
        symbol: 'EURUSD',
        bid: 1.0849,
        ask: 1.0851,
        spread: 0.0002,
        timestamp: new Date(),
        volume: 2000000,
        high24h: 1.0890,
        low24h: 1.0820,
        change24h: -0.12
      }
    ]

    const alerts: Alert[] = Math.random() > 0.7 ? [{
      id: 'alert-1',
      type: 'margin_level',
      severity: 'medium',
      message: 'Margin level approaching warning threshold',
      timestamp: new Date(),
      accountId: 'acc-1',
      acknowledged: false,
      autoResolve: false
    }] : []

    const systemStatus: SystemStatus = {
      uptime: Date.now() - 86400000, // 24時間
      connectionCount: 2,
      dataLatency: Math.random() * 100,
      memoryUsage: 50 + Math.random() * 30,
      cpuUsage: 20 + Math.random() * 20,
      lastHealthCheck: new Date(),
      version: '1.0.0'
    }

    const analytics = generateAnalytics(accounts, positions)

    return {
      accounts,
      positions,
      marketData,
      alerts,
      systemStatus,
      analytics
    }
  }, [generateAnalytics])

  const handleDataUpdate = useCallback((newData: RealtimeDashboardData) => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current)
    }

    throttleTimerRef.current = setTimeout(() => {
      // キャッシュ処理
      if (cacheEnabled) {
        const cacheKey = `realtime-data-${Date.now()}`
        cacheManagerRef.current.set(cacheKey, newData, 10000) // 10秒TTL
      }

      // フィルタリング処理
      let filteredData = { ...newData }
      if (updateFilters) {
        if (updateFilters.accounts && updateFilters.accounts.length > 0) {
          filteredData.accounts = filteredData.accounts.filter(acc => 
            updateFilters.accounts!.includes(acc.id)
          )
          filteredData.positions = filteredData.positions.filter(pos => 
            updateFilters.accounts!.includes(pos.accountId)
          )
        }

        if (updateFilters.symbols && updateFilters.symbols.length > 0) {
          filteredData.positions = filteredData.positions.filter(pos => 
            updateFilters.symbols!.includes(pos.symbol)
          )
          filteredData.marketData = filteredData.marketData.filter(market => 
            updateFilters.symbols!.includes(market.symbol)
          )
        }
      }

      setData(filteredData)
      setLastUpdate(new Date())
      setError(null)

      // 更新頻度の計算
      updateCountRef.current++
      const currentTime = Date.now()
      const timeDiff = currentTime - lastUpdateTimeRef.current
      if (timeDiff >= 5000) { // 5秒ごとに更新頻度を計算
        setUpdateFrequency(Math.round((updateCountRef.current * 1000) / timeDiff))
        updateCountRef.current = 0
        lastUpdateTimeRef.current = currentTime
      }
    }, throttleMs)
  }, [throttleMs, cacheEnabled, updateFilters])

  const connectWebSocket = useCallback(() => {
    if (!enabled) return

    setConnectionStatus('connecting')
    setLoading(true)

    try {
      // 実際の実装では WebSocket を使用
      // const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080/ws'
      // wsRef.current = new WebSocket(wsUrl)

      // モック実装：一定間隔でデータを更新
      const interval = setInterval(() => {
        try {
          const mockData = generateMockData()
          handleDataUpdate(mockData)
          setConnectionStatus('connected')
          setLoading(false)
          reconnectAttempts.current = 0
        } catch (err) {
          console.error('Error updating realtime data:', err)
          setError(err as Error)
          setConnectionStatus('error')
        }
      }, 1000) // 1秒間隔

      // クリーンアップ関数を保存
      wsRef.current = { close: () => clearInterval(interval) } as any

    } catch (err) {
      console.error('Failed to connect WebSocket:', err)
      setError(err as Error)
      setConnectionStatus('error')
      setLoading(false)

      if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket()
        }, delay)
      }
    }
  }, [enabled, generateMockData, handleDataUpdate, autoReconnect, maxReconnectAttempts])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = null
    }
    setConnectionStatus('disconnected')
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    reconnectAttempts.current = 0
    connectWebSocket()
  }, [disconnect, connectWebSocket])

  const forceRefresh = useCallback(() => {
    if (connectionStatus === 'connected') {
      const mockData = generateMockData()
      handleDataUpdate(mockData)
    } else {
      reconnect()
    }
  }, [connectionStatus, generateMockData, handleDataUpdate, reconnect])

  useEffect(() => {
    connectWebSocket()

    // 定期的なキャッシュクリーンアップ
    const cleanupInterval = setInterval(() => {
      if (cacheEnabled) {
        cacheManagerRef.current.cleanup()
      }
    }, 60000) // 1分間隔

    return () => {
      disconnect()
      clearInterval(cleanupInterval)
    }
  }, [connectWebSocket, disconnect, cacheEnabled])

  const cacheStats = cacheEnabled ? cacheManagerRef.current.getStats() : { size: 0, totalHits: 0, memoryUsage: 0 }

  return {
    data,
    loading,
    error,
    lastUpdate,
    updateFrequency,
    connectionStatus,
    cacheStats,
    reconnect,
    forceRefresh
  }
}