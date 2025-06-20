'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Position, PositionFilters } from '../../features/monitoring/types'
import { MonitoringWebSocketClient } from '../../lib/websocket/monitoring-websocket-client'
import { POSITION_UPDATE_SUBSCRIPTION } from '../../lib/graphql/monitoring-subscriptions'

interface UseRealtimePositionsOptions {
  filters?: PositionFilters
  throttleMs?: number
  enabled?: boolean
}

interface UseRealtimePositionsReturn {
  positions: Position[]
  loading: boolean
  error: Error | null
  lastUpdate: Date | null
  reconnect: () => void
  updateFrequency: number
}

export function useRealtimePositions({
  filters,
  throttleMs = 1000,
  enabled = true
}: UseRealtimePositionsOptions = {}): UseRealtimePositionsReturn {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [updateFrequency, setUpdateFrequency] = useState(0)

  const wsClientRef = useRef<MonitoringWebSocketClient | null>(null)
  const throttleRef = useRef<NodeJS.Timeout | null>(null)
  const updateCountRef = useRef(0)
  const lastUpdateTimeRef = useRef(Date.now())
  const subscriptionId = useRef<string>(`position-updates-${Math.random().toString(36).substr(2, 9)}`)

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
        console.log('WebSocket connected for position monitoring')
      })

      wsClientRef.current.on('disconnected', (code: number, reason: string) => {
        console.log('Position monitoring WebSocket disconnected:', code, reason)
        setLoading(false)
      })

      wsClientRef.current.on('error', (error: Error) => {
        console.error('Position monitoring WebSocket error:', error)
        setError(error)
        setLoading(false)
      })

      wsClientRef.current.on('reconnecting', (attempt: number, delay: number) => {
        console.log(`Reconnecting position monitoring (attempt ${attempt}, delay ${delay}ms)`)
        setLoading(true)
      })

      // ポジションデータの受信処理
      wsClientRef.current.on(`data:${subscriptionId.current}`, (data: any) => {
        if (data?.onPositionUpdate) {
          const newPositions = Array.isArray(data.onPositionUpdate) 
            ? data.onPositionUpdate 
            : [data.onPositionUpdate]
          
          // スロットル処理
          if (throttleRef.current) {
            clearTimeout(throttleRef.current)
          }
          
          throttleRef.current = setTimeout(() => {
            setPositions(prevPositions => {
              // 差分更新の実装
              const positionMap = new Map(prevPositions.map(p => [p.id, p]))
              
              newPositions.forEach((newPos: Position) => {
                positionMap.set(newPos.id, {
                  ...newPos,
                  openTime: new Date(newPos.openTime),
                  updateTime: new Date(newPos.updateTime)
                })
              })
              
              return Array.from(positionMap.values())
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
          query: POSITION_UPDATE_SUBSCRIPTION,
          variables: { filters }
        })
      }).catch(err => {
        console.error('Failed to connect position monitoring WebSocket:', err)
        setError(err)
        setLoading(false)
      })

    } catch (err) {
      console.error('Error initializing position monitoring WebSocket:', err)
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
        query: POSITION_UPDATE_SUBSCRIPTION,
        variables: { filters }
      })
    }
  }, [filters])

  return {
    positions,
    loading,
    error,
    lastUpdate,
    reconnect,
    updateFrequency
  }
}