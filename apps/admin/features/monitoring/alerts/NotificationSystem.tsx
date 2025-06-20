'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, AlertRule } from '../types'

interface NotificationSystemProps {
  alerts: Alert[]
  alertRules: AlertRule[]
  onAlertProcessed?: (alertId: string) => void
}

export function NotificationSystem({ 
  alerts, 
  alertRules, 
  onAlertProcessed 
}: NotificationSystemProps) {
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const processedAlertsRef = useRef<Set<string>>(new Set())
  const audioContextRef = useRef<AudioContext | null>(null)

  // 通知権限の要求
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setPermissionGranted(true)
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          setPermissionGranted(permission === 'granted')
        })
      }
    }
  }, [])

  // AudioContextの初期化
  useEffect(() => {
    if (soundEnabled && !audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch (error) {
        console.warn('AudioContext initialization failed:', error)
      }
    }
  }, [soundEnabled])

  // 新しいアラートの処理
  useEffect(() => {
    const unprocessedAlerts = alerts.filter(alert => 
      !alert.acknowledged && !processedAlertsRef.current.has(alert.id)
    )

    unprocessedAlerts.forEach(alert => {
      const rule = alertRules.find(r => r.id === alert.ruleId)
      if (rule?.isActive) {
        processAlert(alert, rule)
        processedAlertsRef.current.add(alert.id)
        onAlertProcessed?.(alert.id)
      }
    })
  }, [alerts, alertRules, onAlertProcessed])

  const processAlert = async (alert: Alert, rule: AlertRule) => {
    try {
      // ブラウザ通知
      if (rule.actions.showNotification && permissionGranted) {
        await showBrowserNotification(alert)
      }

      // サウンド再生
      if (rule.actions.playSound && soundEnabled) {
        await playAlertSound(alert.severity)
      }

      // メール通知（実際の実装では API 呼び出し）
      if (rule.actions.sendEmail) {
        await sendEmailNotification(alert)
      }

      // 自動決済（実装は慎重に）
      if (rule.actions.autoClose && alert.severity === 'critical') {
        console.warn('Auto-close action triggered for alert:', alert.id)
        // 実際の実装では確認プロセスを経てから実行
      }

    } catch (error) {
      console.error('Error processing alert:', error)
    }
  }

  const showBrowserNotification = async (alert: Alert): Promise<void> => {
    return new Promise((resolve) => {
      const notification = new Notification(`ArbitrageAssistant - ${getSeverityLabel(alert.severity)}`, {
        body: alert.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: alert.id,
        requireInteraction: alert.severity === 'critical',
        silent: false
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      notification.onshow = () => resolve()
      notification.onerror = () => resolve()

      // 自動的に閉じる（重要度に応じて）
      const autoCloseDelay = alert.severity === 'critical' ? 30000 : 
                            alert.severity === 'high' ? 15000 : 
                            alert.severity === 'medium' ? 10000 : 5000

      setTimeout(() => {
        notification.close()
      }, autoCloseDelay)
    })
  }

  const playAlertSound = async (severity: Alert['severity']): Promise<void> => {
    return new Promise((resolve) => {
      if (!audioContextRef.current) {
        resolve()
        return
      }

      const audioContext = audioContextRef.current
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // 重要度に応じた音の設定
      let frequency: number
      let duration: number
      let pattern: 'single' | 'double' | 'triple' | 'continuous'

      switch (severity) {
        case 'critical':
          frequency = 800
          duration = 2000
          pattern = 'continuous'
          break
        case 'high':
          frequency = 600
          duration = 1000
          pattern = 'triple'
          break
        case 'medium':
          frequency = 400
          duration = 500
          pattern = 'double'
          break
        default:
          frequency = 300
          duration = 300
          pattern = 'single'
      }

      const playBeep = (freq: number, startTime: number, duration: number) => {
        const osc = audioContext.createOscillator()
        const gain = audioContext.createGain()
        
        osc.connect(gain)
        gain.connect(audioContext.destination)
        
        osc.frequency.setValueAtTime(freq, startTime)
        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(0.1, startTime + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration / 1000)
        
        osc.start(startTime)
        osc.stop(startTime + duration / 1000)
        
        return startTime + duration / 1000
      }

      const currentTime = audioContext.currentTime
      let nextTime = currentTime

      switch (pattern) {
        case 'single':
          playBeep(frequency, nextTime, duration)
          break
        case 'double':
          nextTime = playBeep(frequency, nextTime, duration / 3)
          nextTime = playBeep(frequency, nextTime + 0.1, duration / 3)
          break
        case 'triple':
          nextTime = playBeep(frequency, nextTime, duration / 4)
          nextTime = playBeep(frequency, nextTime + 0.1, duration / 4)
          nextTime = playBeep(frequency, nextTime + 0.1, duration / 4)
          break
        case 'continuous':
          for (let i = 0; i < 3; i++) {
            nextTime = playBeep(frequency, nextTime, 200)
            nextTime = playBeep(frequency * 0.8, nextTime + 0.05, 200)
            nextTime += 0.3
          }
          break
      }

      setTimeout(resolve, duration + 1000)
    })
  }

  const sendEmailNotification = async (alert: Alert): Promise<void> => {
    try {
      // 実際の実装では API エンドポイントに POST
      const response = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alertId: alert.id,
          type: alert.type,
          message: alert.message,
          severity: alert.severity,
          timestamp: alert.timestamp
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send email notification')
      }

      console.log('Email notification sent for alert:', alert.id)
    } catch (error) {
      console.error('Failed to send email notification:', error)
    }
  }

  const getSeverityLabel = (severity: Alert['severity']): string => {
    switch (severity) {
      case 'critical': return '緊急アラート'
      case 'high': return '重要アラート'
      case 'medium': return '警告'
      case 'low': return '情報'
      default: return 'アラート'
    }
  }

  // 通知設定UI
  return (
    <div className="bg-white border rounded-lg p-4">
      <h4 className="font-medium mb-3">通知設定</h4>
      
      <div className="space-y-3">
        {/* ブラウザ通知設定 */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-sm">ブラウザ通知</label>
            <p className="text-xs text-gray-600">
              デスクトップ通知を表示します
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded ${
              permissionGranted 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {permissionGranted ? '許可済み' : '未許可'}
            </span>
            {!permissionGranted && (
              <button
                onClick={() => {
                  Notification.requestPermission().then(permission => {
                    setPermissionGranted(permission === 'granted')
                  })
                }}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
              >
                許可を要求
              </button>
            )}
          </div>
        </div>

        {/* サウンド設定 */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-sm">アラート音</label>
            <p className="text-xs text-gray-600">
              アラート発生時に音を再生します
            </p>
          </div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">有効</span>
          </label>
        </div>

        {/* 統計情報 */}
        <div className="border-t pt-3">
          <div className="text-sm text-gray-600">
            <div className="flex justify-between">
              <span>処理済みアラート:</span>
              <span>{processedAlertsRef.current.size}</span>
            </div>
            <div className="flex justify-between">
              <span>未処理アラート:</span>
              <span>{alerts.filter(a => !a.acknowledged).length}</span>
            </div>
          </div>
        </div>

        {/* テスト機能 */}
        <div className="border-t pt-3">
          <h5 className="font-medium text-sm mb-2">テスト</h5>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                const testAlert: Alert = {
                  id: `test-${Date.now()}`,
                  ruleId: 'test-rule',
                  type: 'margin_level',
                  message: 'テスト通知です',
                  severity: 'medium',
                  timestamp: new Date(),
                  acknowledged: false
                }
                showBrowserNotification(testAlert)
              }}
              className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
              disabled={!permissionGranted}
            >
              通知テスト
            </button>
            <button
              onClick={() => playAlertSound('medium')}
              className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
              disabled={!soundEnabled}
            >
              サウンドテスト
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 通知用のカスタムフック
export function useNotificationSystem() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    setIsSupported('Notification' in window)
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) return false
    
    const result = await Notification.requestPermission()
    setPermission(result)
    return result === 'granted'
  }

  const showNotification = (title: string, options?: NotificationOptions): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isSupported || permission !== 'granted') {
        reject(new Error('Notifications not supported or not permitted'))
        return
      }

      const notification = new Notification(title, options)
      notification.onshow = () => resolve()
      notification.onerror = (error) => reject(error)
    })
  }

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification
  }
}