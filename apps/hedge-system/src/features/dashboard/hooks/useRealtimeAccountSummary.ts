'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ClientPC {
  id: string
  name: string
  status: 'online' | 'offline' | 'error'
  lastSeen: Date
  accounts: Account[]
}

interface Account {
  id: string
  clientPCId: string
  broker: string
  accountNumber: string
  balance: number
  equity: number
  margin: number
  marginLevel: number
  bonusAmount: number
  status: 'connected' | 'disconnected' | 'error'
  positions: Position[]
}

interface Position {
  id: string
  accountId: string
  symbol: string
  type: 'buy' | 'sell'
  lots: number
  openPrice: number
  currentPrice: number
  profit: number
}

interface UseRealtimeAccountSummaryOptions {
  updateInterval?: number
  enabled?: boolean
  autoReconnect?: boolean
}

interface UseRealtimeAccountSummaryReturn {
  clientPCs: ClientPC[]
  loading: boolean
  error: Error | null
  lastUpdate: Date | null
  refresh: () => void
  updateFrequency: number
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
}

export function useRealtimeAccountSummary({
  updateInterval = 1000,
  enabled = true,
  autoReconnect = true
}: UseRealtimeAccountSummaryOptions = {}): UseRealtimeAccountSummaryReturn {
  const [clientPCs, setClientPCs] = useState<ClientPC[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [updateFrequency, setUpdateFrequency] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected')

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const updateCountRef = useRef(0)
  const lastUpdateTimeRef = useRef(Date.now())
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const generateMockData = useCallback((): ClientPC[] => {
    // モックデータ生成（実際の実装では WebSocket や GraphQL からデータを取得）
    const mockClientPCs: ClientPC[] = [
      {
        id: 'client-1',
        name: 'Trading-PC-01',
        status: 'online',
        lastSeen: new Date(),
        accounts: [
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
            positions: [
              {
                id: 'pos-1',
                accountId: 'acc-1',
                symbol: 'USDJPY',
                type: 'buy',
                lots: 0.1,
                openPrice: 150.25,
                currentPrice: 150.25 + (Math.random() - 0.5) * 0.5,
                profit: (Math.random() - 0.5) * 100
              }
            ]
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
            positions: [
              {
                id: 'pos-2',
                accountId: 'acc-2',
                symbol: 'EURUSD',
                type: 'sell',
                lots: 0.05,
                openPrice: 1.0850,
                currentPrice: 1.0850 + (Math.random() - 0.5) * 0.002,
                profit: (Math.random() - 0.5) * 80
              }
            ]
          }
        ]
      },
      {
        id: 'client-2',
        name: 'Trading-PC-02',
        status: Math.random() > 0.3 ? 'online' : 'offline',
        lastSeen: new Date(Date.now() - Math.random() * 300000),
        accounts: [
          {
            id: 'acc-3',
            clientPCId: 'client-2',
            broker: 'Exness',
            accountNumber: '11223344',
            balance: 15000 + Math.random() * 1500,
            equity: 15800 + Math.random() * 1500,
            margin: 3000 + Math.random() * 600,
            marginLevel: 400 + Math.random() * 200,
            bonusAmount: 0,
            status: Math.random() > 0.2 ? 'connected' : 'disconnected',
            positions: []
          }
        ]
      }
    ]

    return mockClientPCs
  }, [])

  const connectWebSocket = useCallback(() => {
    if (!enabled) return

    setConnectionStatus('connecting')
    setLoading(true)

    try {
      // 実際の実装では WebSocket URL を使用
      // const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080/ws'
      // wsRef.current = new WebSocket(wsUrl)

      // モック実装：一定間隔でデータを更新
      const interval = setInterval(() => {
        try {
          const mockData = generateMockData()
          setClientPCs(mockData)
          setLastUpdate(new Date())
          setError(null)
          setConnectionStatus('connected')
          setLoading(false)

          // 更新頻度の計算
          updateCountRef.current++
          const currentTime = Date.now()
          const timeDiff = currentTime - lastUpdateTimeRef.current
          if (timeDiff >= 5000) {
            setUpdateFrequency(Math.round((updateCountRef.current * 1000) / timeDiff))
            updateCountRef.current = 0
            lastUpdateTimeRef.current = currentTime
          }

          reconnectAttempts.current = 0
        } catch (err) {
          console.error('Error updating account data:', err)
          setError(err as Error)
          setConnectionStatus('error')
        }
      }, updateInterval)

      // クリーンアップ関数を保存
      wsRef.current = { close: () => clearInterval(interval) } as any

      return () => {
        clearInterval(interval)
      }

    } catch (err) {
      console.error('Failed to connect WebSocket:', err)
      setError(err as Error)
      setConnectionStatus('error')
      setLoading(false)

      if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket()
        }, Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000))
      }
    }
  }, [enabled, updateInterval, generateMockData, autoReconnect])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    setConnectionStatus('disconnected')
  }, [])

  const refresh = useCallback(() => {
    if (connectionStatus === 'connected') {
      const mockData = generateMockData()
      setClientPCs(mockData)
      setLastUpdate(new Date())
    } else {
      disconnect()
      connectWebSocket()
    }
  }, [connectionStatus, generateMockData, disconnect, connectWebSocket])

  useEffect(() => {
    connectWebSocket()

    return () => {
      disconnect()
    }
  }, [connectWebSocket, disconnect])

  useEffect(() => {
    // コンポーネントがアンマウントされる際のクリーンアップ
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    clientPCs,
    loading,
    error,
    lastUpdate,
    refresh,
    updateFrequency,
    connectionStatus
  }
}