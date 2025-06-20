'use client'

import { useState, useRef, useMemo } from 'react'
import { MarginLevelGauge } from './MarginLevelGauge'
import { Settings, Bell, Info, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

interface ThresholdSettings {
  safe: number
  warning: number
  danger: number
  critical: number
}

interface AlertSettings {
  enabled: boolean
  email: boolean
  sound: boolean
  popup: boolean
  thresholds: {
    critical: boolean
    danger: boolean
    warning: boolean
  }
}

interface HoverTooltipData {
  show: boolean
  x: number
  y: number
  content?: {
    marginLevel: number
    trend?: 'up' | 'down' | 'stable'
    lastUpdate: Date
    prediction?: {
      nextLevel15min?: number
      timeToCritical?: number
    }
    status: 'connected' | 'disconnected' | 'error'
  }
}

interface InteractiveMarginGaugeProps {
  marginLevel: number
  accountName: string
  accountId: string
  broker?: string
  balance?: number
  equity?: number
  usedMargin?: number
  bonusAmount?: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showPercentage?: boolean
  enableHoverTooltip?: boolean
  enableThresholdSettings?: boolean
  enableAlertSettings?: boolean
  thresholds?: ThresholdSettings
  alertSettings?: AlertSettings
  realtimeData?: {
    trend: 'up' | 'down' | 'stable'
    lastUpdate: Date
    prediction?: {
      nextLevel15min?: number
      timeToCritical?: number
    }
    status: 'connected' | 'disconnected' | 'error'
  }
  onThresholdChange?: (thresholds: ThresholdSettings) => void
  onAlertSettingsChange?: (settings: AlertSettings) => void
  onClick?: () => void
  className?: string
}

export function InteractiveMarginGauge({
  marginLevel,
  accountName,
  accountId,
  broker,
  balance,
  equity,
  usedMargin,
  bonusAmount,
  size = 'md',
  showLabel = true,
  showPercentage = true,
  enableHoverTooltip = true,
  enableThresholdSettings = false,
  enableAlertSettings = false,
  thresholds = { safe: 200, warning: 150, danger: 100, critical: 50 },
  alertSettings = {
    enabled: true,
    email: false,
    sound: true,
    popup: true,
    thresholds: { critical: true, danger: true, warning: false }
  },
  realtimeData,
  onThresholdChange,
  onAlertSettingsChange,
  onClick,
  className = ''
}: InteractiveMarginGaugeProps) {
  const [showTooltip, setShowTooltip] = useState<HoverTooltipData>({ show: false, x: 0, y: 0 })
  const [showThresholdSettings, setShowThresholdSettings] = useState(false)
  const [showAlertSettings, setShowAlertSettings] = useState(false)
  const [tempThresholds, setTempThresholds] = useState(thresholds)
  const [tempAlertSettings, setTempAlertSettings] = useState(alertSettings)
  const containerRef = useRef<HTMLDivElement>(null)

  const riskLevel = useMemo(() => {
    if (marginLevel <= thresholds.critical) return 'critical'
    if (marginLevel <= thresholds.danger) return 'danger'
    if (marginLevel <= thresholds.warning) return 'warning'
    return 'safe'
  }, [marginLevel, thresholds])

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!enableHoverTooltip || !realtimeData) return

    const rect = e.currentTarget.getBoundingClientRect()
    setShowTooltip({
      show: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      content: {
        marginLevel,
        trend: realtimeData.trend,
        lastUpdate: realtimeData.lastUpdate,
        prediction: realtimeData.prediction,
        status: realtimeData.status
      }
    })
  }

  const handleMouseLeave = () => {
    setShowTooltip({ show: false, x: 0, y: 0 })
  }

  const handleThresholdSave = () => {
    onThresholdChange?.(tempThresholds)
    setShowThresholdSettings(false)
  }

  const handleAlertSettingsSave = () => {
    onAlertSettingsChange?.(tempAlertSettings)
    setShowAlertSettings(false)
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-3 h-3 text-green-500" />
      case 'down': return <TrendingDown className="w-3 h-3 text-red-500" />
      default: return <div className="w-3 h-3 rounded-full bg-gray-400" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <div className="w-2 h-2 rounded-full bg-green-500" />
      case 'disconnected': return <div className="w-2 h-2 rounded-full bg-gray-400" />
      case 'error': return <div className="w-2 h-2 rounded-full bg-red-500" />
      default: return null
    }
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        className="relative group cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
      >
        <MarginLevelGauge
          marginLevel={marginLevel}
          accountName={accountName}
          size={size}
          showLabel={showLabel}
          showPercentage={showPercentage}
          lossCutLevel={thresholds.critical}
          warningLevel={thresholds.warning}
        />

        {/* ステータス・トレンドインジケーター */}
        {realtimeData && (
          <div className="absolute top-1 right-1 flex flex-col items-end space-y-1">
            {getStatusIcon(realtimeData.status)}
            {getTrendIcon(realtimeData.trend)}
          </div>
        )}

        {/* アラートインジケーター */}
        {alertSettings.enabled && (riskLevel === 'critical' || riskLevel === 'danger') && (
          <div className="absolute top-1 left-1">
            <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
        )}

        {/* 設定ボタン */}
        <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
          {enableThresholdSettings && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowThresholdSettings(true)
              }}
              className="p-1 bg-white bg-opacity-80 rounded-full hover:bg-opacity-100 transition-all"
              title="閾値設定"
            >
              <Settings className="w-3 h-3 text-gray-600" />
            </button>
          )}
          {enableAlertSettings && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowAlertSettings(true)
              }}
              className="p-1 bg-white bg-opacity-80 rounded-full hover:bg-opacity-100 transition-all"
              title="アラート設定"
            >
              <Bell className="w-3 h-3 text-gray-600" />
            </button>
          )}
        </div>

        {/* ブローカー情報 */}
        {broker && showLabel && (
          <div className="text-xs text-gray-500 text-center mt-1">
            {broker}
          </div>
        )}
      </div>

      {/* ホバーツールチップ */}
      {showTooltip.show && showTooltip.content && (
        <div
          className="fixed z-50 bg-white border rounded-lg shadow-lg p-3 min-w-48"
          style={{
            left: `${showTooltip.x - 96}px`,
            top: `${showTooltip.y - 120}px`
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{accountName}</span>
              <div className="flex items-center space-x-1">
                {getTrendIcon(showTooltip.content.trend || 'stable')}
                {getStatusIcon(showTooltip.content.status)}
              </div>
            </div>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">証拠金維持率:</span>
                <span className="font-medium">{showTooltip.content.marginLevel.toFixed(1)}%</span>
              </div>
              
              {balance && (
                <div className="flex justify-between">
                  <span className="text-gray-600">残高:</span>
                  <span className="font-medium">${balance.toLocaleString()}</span>
                </div>
              )}
              
              {showTooltip.content.prediction?.nextLevel15min && (
                <div className="flex justify-between">
                  <span className="text-gray-600">15分後予測:</span>
                  <span className="font-medium">{showTooltip.content.prediction.nextLevel15min.toFixed(1)}%</span>
                </div>
              )}
              
              {showTooltip.content.prediction?.timeToCritical && (
                <div className="flex justify-between">
                  <span className="text-gray-600">危険まで:</span>
                  <span className="font-medium text-red-600">{Math.round(showTooltip.content.prediction.timeToCritical)}分</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">最終更新:</span>
                <span className="font-medium">{showTooltip.content.lastUpdate.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 閾値設定ダイアログ */}
      {showThresholdSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-96">
            <h3 className="font-medium mb-4">閾値設定 - {accountName}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">安全水準 (%)</label>
                <input
                  type="number"
                  value={tempThresholds.safe}
                  onChange={(e) => setTempThresholds({...tempThresholds, safe: Number(e.target.value)})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">警告水準 (%)</label>
                <input
                  type="number"
                  value={tempThresholds.warning}
                  onChange={(e) => setTempThresholds({...tempThresholds, warning: Number(e.target.value)})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">危険水準 (%)</label>
                <input
                  type="number"
                  value={tempThresholds.danger}
                  onChange={(e) => setTempThresholds({...tempThresholds, danger: Number(e.target.value)})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">緊急水準 (%)</label>
                <input
                  type="number"
                  value={tempThresholds.critical}
                  onChange={(e) => setTempThresholds({...tempThresholds, critical: Number(e.target.value)})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setShowThresholdSettings(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                キャンセル
              </button>
              <button
                onClick={handleThresholdSave}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* アラート設定ダイアログ */}
      {showAlertSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-96">
            <h3 className="font-medium mb-4">アラート設定 - {accountName}</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={tempAlertSettings.enabled}
                  onChange={(e) => setTempAlertSettings({...tempAlertSettings, enabled: e.target.checked})}
                  className="rounded"
                />
                <label className="text-sm">アラートを有効にする</label>
              </div>

              <div className="pl-6 space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={tempAlertSettings.popup}
                    onChange={(e) => setTempAlertSettings({...tempAlertSettings, popup: e.target.checked})}
                    disabled={!tempAlertSettings.enabled}
                    className="rounded"
                  />
                  <label className="text-sm">ポップアップ通知</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={tempAlertSettings.sound}
                    onChange={(e) => setTempAlertSettings({...tempAlertSettings, sound: e.target.checked})}
                    disabled={!tempAlertSettings.enabled}
                    className="rounded"
                  />
                  <label className="text-sm">音声通知</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={tempAlertSettings.email}
                    onChange={(e) => setTempAlertSettings({...tempAlertSettings, email: e.target.checked})}
                    disabled={!tempAlertSettings.enabled}
                    className="rounded"
                  />
                  <label className="text-sm">メール通知</label>
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-medium mb-2">通知する閾値</h4>
                <div className="space-y-2 pl-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={tempAlertSettings.thresholds.critical}
                      onChange={(e) => setTempAlertSettings({
                        ...tempAlertSettings,
                        thresholds: {...tempAlertSettings.thresholds, critical: e.target.checked}
                      })}
                      disabled={!tempAlertSettings.enabled}
                      className="rounded"
                    />
                    <label className="text-sm text-red-600">緊急水準</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={tempAlertSettings.thresholds.danger}
                      onChange={(e) => setTempAlertSettings({
                        ...tempAlertSettings,
                        thresholds: {...tempAlertSettings.thresholds, danger: e.target.checked}
                      })}
                      disabled={!tempAlertSettings.enabled}
                      className="rounded"
                    />
                    <label className="text-sm text-orange-600">危険水準</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={tempAlertSettings.thresholds.warning}
                      onChange={(e) => setTempAlertSettings({
                        ...tempAlertSettings,
                        thresholds: {...tempAlertSettings.thresholds, warning: e.target.checked}
                      })}
                      disabled={!tempAlertSettings.enabled}
                      className="rounded"
                    />
                    <label className="text-sm text-yellow-600">警告水準</label>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setShowAlertSettings(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                キャンセル
              </button>
              <button
                onClick={handleAlertSettingsSave}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}