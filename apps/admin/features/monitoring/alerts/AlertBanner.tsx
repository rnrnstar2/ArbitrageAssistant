'use client'

import { useState, useEffect } from 'react'
import { Alert } from '../types'

interface AlertBannerProps {
  alerts: Alert[]
  onAcknowledge: (alertId: string) => void
  onClearAll: () => void
}

export function AlertBanner({ alerts, onAcknowledge, onClearAll }: AlertBannerProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0)

  // 表示対象のアラート（未承認且つ非表示にしていないもの）
  const visibleAlerts = alerts.filter(alert => 
    !alert.acknowledged && !dismissedAlerts.has(alert.id)
  )

  // アラートの自動切り替え
  useEffect(() => {
    if (visibleAlerts.length <= 1) return

    const interval = setInterval(() => {
      setCurrentAlertIndex(prev => (prev + 1) % visibleAlerts.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [visibleAlerts.length])

  // アラートのサウンド再生
  useEffect(() => {
    const criticalAlerts = visibleAlerts.filter(alert => alert.severity === 'critical')
    
    if (criticalAlerts.length > 0) {
      // 実際の実装では、Web Audio API やHTML5 Audioを使用
      if ('AudioContext' in window || 'webkitAudioContext' in window) {
        playAlertSound('critical')
      }
    }
  }, [visibleAlerts])

  const playAlertSound = (severity: string) => {
    // サウンド再生の実装
    // 実際の実装では音声ファイルまたは合成音を再生
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      if (severity === 'critical') {
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.1)
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2)
      } else {
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
      }
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.warn('Alert sound playback failed:', error)
    }
  }

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]))
  }

  const handleAcknowledge = (alertId: string) => {
    onAcknowledge(alertId)
    setDismissedAlerts(prev => new Set([...prev, alertId]))
  }

  const getSeverityStyle = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 border-red-500 text-red-800'
      case 'high':
        return 'bg-orange-100 border-orange-500 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 border-yellow-500 text-yellow-800'
      case 'low':
        return 'bg-blue-100 border-blue-500 text-blue-800'
      default:
        return 'bg-gray-100 border-gray-500 text-gray-800'
    }
  }

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return '🚨'
      case 'high':
        return '⚠️'
      case 'medium':
        return '⚡'
      case 'low':
        return 'ℹ️'
      default:
        return '📢'
    }
  }

  const formatRelativeTime = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'たった今'
    if (minutes < 60) return `${minutes}分前`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}時間前`
    
    const days = Math.floor(hours / 24)
    return `${days}日前`
  }

  if (visibleAlerts.length === 0) return null

  const currentAlert = visibleAlerts[currentAlertIndex]
  if (!currentAlert) return null
  
  const severityStats = visibleAlerts.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className={`border-l-4 p-4 mb-4 ${getSeverityStyle(currentAlert.severity)}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="text-xl">
            {getSeverityIcon(currentAlert.severity)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-sm font-medium">
                {currentAlert.type === 'margin_level' && '証拠金維持率警告'}
                {currentAlert.type === 'profit_loss' && '損失警告'}
                {currentAlert.type === 'connection_lost' && '接続断警告'}
              </h3>
              
              <span className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                {formatRelativeTime(currentAlert.timestamp)}
              </span>
              
              {visibleAlerts.length > 1 && (
                <span className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                  {currentAlertIndex + 1} / {visibleAlerts.length}
                </span>
              )}
            </div>
            
            <p className="text-sm">
              {currentAlert.message}
            </p>
            
            {visibleAlerts.length > 1 && (
              <div className="mt-2 flex items-center space-x-4 text-xs">
                {Object.entries(severityStats).map(([severity, count]) => (
                  <span key={severity} className="flex items-center space-x-1">
                    <span>{getSeverityIcon(severity as Alert['severity'])}</span>
                    <span>{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          {/* アラート切り替えボタン */}
          {visibleAlerts.length > 1 && (
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentAlertIndex(prev => 
                  prev === 0 ? visibleAlerts.length - 1 : prev - 1
                )}
                className="p-1 rounded hover:bg-white hover:bg-opacity-50"
                title="前のアラート"
              >
                ←
              </button>
              <button
                onClick={() => setCurrentAlertIndex(prev => 
                  (prev + 1) % visibleAlerts.length
                )}
                className="p-1 rounded hover:bg-white hover:bg-opacity-50"
                title="次のアラート"
              >
                →
              </button>
            </div>
          )}
          
          {/* アクションボタン */}
          <button
            onClick={() => handleAcknowledge(currentAlert.id)}
            className="text-xs bg-white bg-opacity-80 hover:bg-opacity-100 px-3 py-1 rounded font-medium transition-colors"
          >
            確認
          </button>
          
          <button
            onClick={() => handleDismiss(currentAlert.id)}
            className="text-xs bg-white bg-opacity-50 hover:bg-opacity-80 px-2 py-1 rounded transition-colors"
            title="非表示"
          >
            ×
          </button>
          
          {visibleAlerts.length > 1 && (
            <button
              onClick={onClearAll}
              className="text-xs bg-white bg-opacity-80 hover:bg-opacity-100 px-3 py-1 rounded font-medium transition-colors"
              title="全て確認"
            >
              全確認
            </button>
          )}
        </div>
      </div>
      
      {/* プログレスバー（自動切り替え用） */}
      {visibleAlerts.length > 1 && (
        <div className="mt-3 w-full bg-white bg-opacity-30 rounded-full h-1">
          <div 
            className="bg-white h-1 rounded-full transition-all duration-5000 ease-linear"
            style={{
              animation: 'alertProgress 5s linear infinite',
              width: `${((currentAlertIndex + 1) / visibleAlerts.length) * 100}%`
            }}
          />
        </div>
      )}
      
      <style jsx>{`
        @keyframes alertProgress {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>
    </div>
  )
}