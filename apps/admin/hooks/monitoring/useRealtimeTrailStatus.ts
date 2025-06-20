'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TrailStatus } from '../../features/trading/trail/TrailStatusDisplay'
import { MonitoringWebSocketClient } from '../../lib/websocket/monitoring-websocket-client'

interface TrailStatusFilters {
  accountIds?: string[]
  symbols?: string[]
  positionIds?: string[]
  statuses?: ('active' | 'paused' | 'stopped' | 'triggered')[]
}

interface UseRealtimeTrailStatusOptions {
  filters?: TrailStatusFilters
  throttleMs?: number
  enabled?: boolean
}

interface UseRealtimeTrailStatusReturn {
  trailStatuses: TrailStatus[]
  loading: boolean
  error: Error | null
  lastUpdate: Date | null
  reconnect: () => void
  updateFrequency: number
  toggleTrail: (trailId: string, isActive: boolean) => Promise<void>
  stopTrail: (trailId: string) => Promise<void>
}

const TRAIL_STATUS_SUBSCRIPTION = `
  subscription TrailStatusUpdate($filters: TrailStatusFilters) {
    onTrailStatusUpdate(filters: $filters) {
      id
      positionId
      accountId
      accountName
      symbol
      positionType
      currentPrice
      openPrice
      currentProfit
      trailSettings {
        id
        type
        trailAmount
        currentStopLoss
        maxProfit
        isActive
        startCondition {
          type
          value
        }
        lastUpdated
      }
      status
      performance {
        totalMoved
        maxProfit
        trailEfficiency
        timeSinceStart
      }
      lastUpdate
      nextUpdate
      alerts {
        level
        message
        timestamp
      }
    }
  }
`

const TRAIL_COMMAND_MUTATION = `
  mutation TrailCommand($command: TrailCommand!) {
    trailCommand(command: $command) {
      success
      message
      trailId
    }
  }
`

export function useRealtimeTrailStatus({
  filters,
  throttleMs = 1000,
  enabled = true
}: UseRealtimeTrailStatusOptions = {}): UseRealtimeTrailStatusReturn {
  const [trailStatuses, setTrailStatuses] = useState<TrailStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [updateFrequency, setUpdateFrequency] = useState(0)

  const wsClientRef = useRef<MonitoringWebSocketClient | null>(null)
  const throttleRef = useRef<NodeJS.Timeout | null>(null)
  const updateCountRef = useRef(0)
  const lastUpdateTimeRef = useRef(Date.now())
  const subscriptionId = useRef<string>(`trail-updates-${Math.random().toString(36).substr(2, 9)}`)

  const connect = useCallback(() => {
    if (!enabled) return

    try {
      // WebSocketクライアントの初期化
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080/graphql'
      wsClientRef.current = new MonitoringWebSocketClient(wsUrl, ['graphql-ws'])

      // イベントリスナーの設定
      wsClientRef.current.on('connected', () => {
        setLoading(false)
        setError(null)
        console.log('WebSocket connected for trail status monitoring')
      })

      wsClientRef.current.on('disconnected', (code: number, reason: string) => {
        console.log('Trail status monitoring WebSocket disconnected:', code, reason)
        setLoading(false)
      })

      wsClientRef.current.on('error', (error: Error) => {
        console.error('Trail status monitoring WebSocket error:', error)
        setError(error)
        setLoading(false)
      })

      wsClientRef.current.on('reconnecting', (attempt: number, delay: number) => {
        console.log(`Reconnecting trail status monitoring (attempt ${attempt}, delay ${delay}ms)`)
        setLoading(true)
      })

      // トレール状況データの受信処理
      wsClientRef.current.on(`data:${subscriptionId.current}`, (data: any) => {
        if (data?.onTrailStatusUpdate) {
          const newTrailStatuses = Array.isArray(data.onTrailStatusUpdate) 
            ? data.onTrailStatusUpdate 
            : [data.onTrailStatusUpdate]
          
          // スロットル処理
          if (throttleRef.current) {
            clearTimeout(throttleRef.current)
          }
          
          throttleRef.current = setTimeout(() => {
            setTrailStatuses(prevStatuses => {
              // 差分更新の実装
              const statusMap = new Map(prevStatuses.map(s => [s.id, s]))
              
              newTrailStatuses.forEach((newStatus: any) => {
                const parsedStatus: TrailStatus = {
                  ...newStatus,
                  lastUpdate: new Date(newStatus.lastUpdate),
                  nextUpdate: newStatus.nextUpdate ? new Date(newStatus.nextUpdate) : undefined,
                  trailSettings: {
                    ...newStatus.trailSettings,
                    lastUpdated: new Date(newStatus.trailSettings.lastUpdated)
                  },
                  alerts: newStatus.alerts?.map((alert: any) => ({
                    ...alert,
                    timestamp: new Date(alert.timestamp)
                  })) || []
                }
                statusMap.set(parsedStatus.id, parsedStatus)
              })
              
              return Array.from(statusMap.values())
            })
            
            setLastUpdate(new Date())
            
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
        }
      })

      // 接続開始
      wsClientRef.current.connect().then(() => {
        // サブスクリプションの開始
        wsClientRef.current?.subscribe(subscriptionId.current, {
          query: TRAIL_STATUS_SUBSCRIPTION,
          variables: { filters }
        })
      }).catch(err => {
        console.error('Failed to connect trail status monitoring WebSocket:', err)
        setError(err)
        setLoading(false)
      })

    } catch (err) {
      console.error('Error initializing trail status monitoring WebSocket:', err)
      setError(err as Error)
      setLoading(false)
    }
  }, [enabled, filters, throttleMs])

  const reconnect = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect()
    }
    connect()
  }, [connect])

  // トレール状態の変更（アクティブ/一時停止）
  const toggleTrail = useCallback(async (trailId: string, isActive: boolean) => {
    if (!wsClientRef.current?.isConnected) {
      throw new Error('WebSocket未接続です')
    }

    try {
      const response = await wsClientRef.current.query({
        query: TRAIL_COMMAND_MUTATION,
        variables: {
          command: {
            type: isActive ? 'start' : 'pause',
            trailId: trailId
          }
        }
      })

      if (!response.data?.trailCommand?.success) {
        throw new Error(response.data?.trailCommand?.message || 'コマンドの実行に失敗しました')
      }

      console.log(`Trail ${trailId} ${isActive ? 'started' : 'paused'} successfully`)
    } catch (error) {
      console.error('Failed to toggle trail:', error)
      throw error
    }
  }, [])

  // トレール停止
  const stopTrail = useCallback(async (trailId: string) => {
    if (!wsClientRef.current?.isConnected) {
      throw new Error('WebSocket未接続です')
    }

    try {
      const response = await wsClientRef.current.query({
        query: TRAIL_COMMAND_MUTATION,
        variables: {
          command: {
            type: 'stop',
            trailId: trailId
          }
        }
      })

      if (!response.data?.trailCommand?.success) {
        throw new Error(response.data?.trailCommand?.message || 'コマンドの実行に失敗しました')
      }

      console.log(`Trail ${trailId} stopped successfully`)
    } catch (error) {
      console.error('Failed to stop trail:', error)
      throw error
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current)
      }
      if (wsClientRef.current) {
        wsClientRef.current.unsubscribe(subscriptionId.current)
        wsClientRef.current.disconnect()
      }
    }
  }, [connect])

  // フィルタが変更された時のサブスクリプション更新
  useEffect(() => {
    if (wsClientRef.current?.isConnected) {
      wsClientRef.current.unsubscribe(subscriptionId.current)
      wsClientRef.current.subscribe(subscriptionId.current, {
        query: TRAIL_STATUS_SUBSCRIPTION,
        variables: { filters }
      })
    }
  }, [filters])

  return {
    trailStatuses,
    loading,
    error,
    lastUpdate,
    reconnect,
    updateFrequency,
    toggleTrail,
    stopTrail
  }
}