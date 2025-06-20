'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Account, Alert, LossCutPrediction } from '../../features/monitoring/types'
import { MonitoringWebSocketClient } from '../../lib/websocket/monitoring-websocket-client'
import { ACCOUNT_UPDATE_SUBSCRIPTION } from '../../lib/graphql/monitoring-subscriptions'

interface UseAccountMonitoringOptions {
  accountIds: string[]
  enabled?: boolean
  alertThresholds?: {
    marginLevel: number
    profitLoss: number
    connectionTimeout: number
  }
}

interface UseAccountMonitoringReturn {
  accounts: Account[]
  alerts: Alert[]
  lossCutPredictions: LossCutPrediction[]
  loading: boolean
  error: Error | null
  acknowledgeAlert: (alertId: string) => void
  clearAlerts: () => void
}

export function useAccountMonitoring({
  accountIds,
  enabled = true,
  alertThresholds = {
    marginLevel: 150,
    profitLoss: -1000,
    connectionTimeout: 30000
  }
}: UseAccountMonitoringOptions): UseAccountMonitoringReturn {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [lossCutPredictions, setLossCutPredictions] = useState<LossCutPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const wsClientRef = useRef<MonitoringWebSocketClient | null>(null)
  const alertTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const subscriptionId = useRef<string>(`account-monitoring-${Math.random().toString(36).substr(2, 9)}`)

  const calculateLossCutPrediction = useCallback((account: Account): LossCutPrediction => {
    const marginLevel = account.marginLevel
    const lossCutLevel = 50 // 一般的なロスカットレベル
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical'
    let estimatedTimeToLossCut: number | undefined
    let requiredDeposit: number | undefined

    if (marginLevel > 200) {
      riskLevel = 'low'
    } else if (marginLevel > 100) {
      riskLevel = 'medium'
    } else if (marginLevel > lossCutLevel) {
      riskLevel = 'high'
      // 簡易的な時間予測（実際にはより複雑な計算が必要）
      const timeToLossCut = ((marginLevel - lossCutLevel) / (marginLevel * 0.1)) * 60 // 分単位
      estimatedTimeToLossCut = Math.max(timeToLossCut, 1)
      requiredDeposit = account.margin * ((100 - marginLevel) / 100)
    } else {
      riskLevel = 'critical'
      estimatedTimeToLossCut = 0
      requiredDeposit = account.margin * 0.5
    }

    return {
      accountId: account.id,
      currentMarginLevel: marginLevel,
      lossCutLevel,
      estimatedTimeToLossCut,
      requiredDeposit,
      riskLevel
    }
  }, [])

  const checkAlertConditions = useCallback((accounts: Account[]) => {
    const newAlerts: Alert[] = []

    accounts.forEach(account => {
      // 証拠金維持率アラート
      if (account.marginLevel < alertThresholds.marginLevel) {
        const alertId = `margin-${account.id}-${Date.now()}`
        newAlerts.push({
          id: alertId,
          ruleId: 'margin-level-warning',
          type: 'margin_level',
          message: `アカウント ${account.accountNumber} の証拠金維持率が ${account.marginLevel.toFixed(1)}% に低下しました`,
          severity: account.marginLevel < 100 ? 'critical' : 'high',
          timestamp: new Date(),
          accountId: account.id,
          acknowledged: false
        })
      }

      // 損失アラート
      const totalProfit = account.positions.reduce((sum, pos) => sum + pos.profit, 0)
      if (totalProfit < alertThresholds.profitLoss) {
        const alertId = `loss-${account.id}-${Date.now()}`
        newAlerts.push({
          id: alertId,
          ruleId: 'profit-loss-warning',
          type: 'profit_loss',
          message: `アカウント ${account.accountNumber} の損失が ${Math.abs(totalProfit).toFixed(2)} に達しました`,
          severity: totalProfit < alertThresholds.profitLoss * 2 ? 'critical' : 'high',
          timestamp: new Date(),
          accountId: account.id,
          acknowledged: false
        })
      }

      // 接続断アラート
      if (account.status === 'disconnected' || account.status === 'error') {
        const alertId = `connection-${account.id}-${Date.now()}`
        newAlerts.push({
          id: alertId,
          ruleId: 'connection-lost-warning',
          type: 'connection_lost',
          message: `アカウント ${account.accountNumber} との接続が失われました`,
          severity: 'medium',
          timestamp: new Date(),
          accountId: account.id,
          acknowledged: false
        })
      }
    })

    if (newAlerts.length > 0) {
      setAlerts(prevAlerts => [...prevAlerts, ...newAlerts])
    }
  }, [alertThresholds])

  const connect = useCallback(() => {
    if (!enabled) return

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080/graphql'
      wsClientRef.current = new MonitoringWebSocketClient(wsUrl, ['graphql-ws'])

      // イベントリスナーの設定
      wsClientRef.current.on('connected', () => {
        setLoading(false)
        setError(null)
        console.log('WebSocket connected for account monitoring')
      })

      wsClientRef.current.on('disconnected', (code: number, reason: string) => {
        console.log('Account monitoring WebSocket disconnected:', code, reason)
        setLoading(false)
      })

      wsClientRef.current.on('error', (error: Error) => {
        console.error('Account monitoring WebSocket error:', error)
        setError(error)
        setLoading(false)
      })

      wsClientRef.current.on('reconnecting', (attempt: number, delay: number) => {
        console.log(`Reconnecting account monitoring (attempt ${attempt}, delay ${delay}ms)`)
        setLoading(true)
      })

      // アカウントデータの受信処理
      wsClientRef.current.on(`data:${subscriptionId.current}`, (data: any) => {
        if (data?.onAccountUpdate) {
          const updatedAccounts = Array.isArray(data.onAccountUpdate) 
            ? data.onAccountUpdate 
            : [data.onAccountUpdate]
          
          setAccounts(updatedAccounts)
          
          // ロスカット予測の更新
          const predictions = updatedAccounts.map(calculateLossCutPrediction)
          setLossCutPredictions(predictions)
          
          // アラート条件のチェック
          checkAlertConditions(updatedAccounts)
        }
      })

      // 接続開始
      wsClientRef.current.connect().then(() => {
        // サブスクリプションの開始
        wsClientRef.current?.subscribe(subscriptionId.current, {
          query: ACCOUNT_UPDATE_SUBSCRIPTION,
          variables: { accountIds }
        })
      }).catch(err => {
        console.error('Failed to connect account monitoring WebSocket:', err)
        setError(err)
        setLoading(false)
      })

    } catch (err) {
      console.error('Error initializing account monitoring WebSocket:', err)
      setError(err as Error)
      setLoading(false)
    }
  }, [enabled, accountIds, calculateLossCutPrediction, checkAlertConditions])

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prevAlerts => 
      prevAlerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    )
  }, [])

  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  useEffect(() => {
    connect()

    return () => {
      // タイムアウトのクリーンアップ
      alertTimeoutRef.current.forEach(timeout => clearTimeout(timeout))
      alertTimeoutRef.current.clear()
      
      if (wsClientRef.current) {
        wsClientRef.current.unsubscribe(subscriptionId.current)
        wsClientRef.current.disconnect()
      }
    }
  }, [connect])

  // アカウントIDが変更された時のサブスクリプション更新
  useEffect(() => {
    if (wsClientRef.current?.isConnected) {
      wsClientRef.current.unsubscribe(subscriptionId.current)
      wsClientRef.current.subscribe(subscriptionId.current, {
        query: ACCOUNT_UPDATE_SUBSCRIPTION,
        variables: { accountIds }
      })
    }
  }, [accountIds])

  return {
    accounts,
    alerts,
    lossCutPredictions,
    loading,
    error,
    acknowledgeAlert,
    clearAlerts
  }
}