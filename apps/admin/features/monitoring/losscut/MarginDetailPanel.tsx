'use client'

import { useState, useRef, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'

interface MarginHistoryPoint {
  timestamp: Date
  marginLevel: number
  balance: number
  equity: number
  usedMargin: number
}

interface MarginPrediction {
  trend: 'up' | 'down' | 'stable'
  nextLevelIn15min?: number
  nextLevelIn1hour?: number
  timeToCritical?: number // minutes
  requiredRecovery: number // USD
  confidence: number // 0-100
}

interface ActionSuggestion {
  id: string
  type: 'deposit' | 'close_positions' | 'hedge' | 'monitor'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  estimatedImpact: {
    marginChange: number
    riskReduction: number
  }
  isAvailable: boolean
}

interface MarginDetailPanelProps {
  accountId: string
  accountName: string
  currentLevel: number
  balance: number
  equity: number
  usedMargin: number
  freeMargin: number
  bonusAmount: number
  history: MarginHistoryPoint[]
  prediction: MarginPrediction
  suggestions: ActionSuggestion[]
  thresholds: {
    safe: number
    warning: number
    danger: number
    critical: number
  }
  onClose: () => void
  onActionTrigger: (actionId: string) => void
  onThresholdChange?: (thresholds: any) => void
}

export function MarginDetailPanel({
  accountId,
  accountName,
  currentLevel,
  balance,
  equity,
  usedMargin,
  freeMargin,
  bonusAmount,
  history,
  prediction,
  suggestions,
  thresholds,
  onClose,
  onActionTrigger,
  onThresholdChange
}: MarginDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'prediction' | 'actions'>('overview')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 履歴チャート描画
  useEffect(() => {
    if (!canvasRef.current || history.length === 0 || activeTab !== 'history') return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const width = rect.width
    const height = rect.height
    const padding = 40

    // データ範囲
    const marginLevels = history.map(h => h.marginLevel)
    const minLevel = Math.min(...marginLevels, thresholds.critical - 20)
    const maxLevel = Math.max(...marginLevels, thresholds.safe + 50)
    const levelRange = maxLevel - minLevel

    // 背景をクリア
    ctx.clearRect(0, 0, width, height)

    // 背景色分け
    const zones = [
      { threshold: thresholds.critical, color: '#fef2f2', label: '緊急' },
      { threshold: thresholds.danger, color: '#fef3c7', label: '危険' },
      { threshold: thresholds.warning, color: '#fefce8', label: '警告' },
      { threshold: thresholds.safe, color: '#f0fdf4', label: '安全' }
    ]

    zones.forEach((zone, index) => {
      const nextThreshold = zones[index + 1]?.threshold ?? maxLevel
      const yStart = height - padding - ((zone.threshold - minLevel) / levelRange) * (height - padding * 2)
      const yEnd = height - padding - ((nextThreshold - minLevel) / levelRange) * (height - padding * 2)
      
      ctx.fillStyle = zone.color
      ctx.fillRect(padding, yEnd, width - padding * 2, yStart - yEnd)
    })

    // グリッド描画
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1

    for (let i = 0; i <= 5; i++) {
      const y = padding + (height - padding * 2) * (i / 5)
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }

    // 閾値線描画
    Object.entries(thresholds).forEach(([key, value]) => {
      const y = height - padding - ((value - minLevel) / levelRange) * (height - padding * 2)
      const colors = {
        critical: '#ef4444',
        danger: '#f59e0b',
        warning: '#eab308',
        safe: '#22c55e'
      }
      
      ctx.strokeStyle = colors[key as keyof typeof colors]
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
      ctx.setLineDash([])
    })

    // データライン描画
    if (history.length > 1) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 3
      ctx.beginPath()

      history.forEach((point, index) => {
        const x = padding + (width - padding * 2) * (index / (history.length - 1))
        const y = height - padding - ((point.marginLevel - minLevel) / levelRange) * (height - padding * 2)

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        // データポイント
        ctx.fillStyle = '#3b82f6'
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, 2 * Math.PI)
        ctx.fill()
      })

      ctx.stroke()
    }

    // Y軸ラベル
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'

    for (let i = 0; i <= 5; i++) {
      const value = maxLevel - (levelRange / 5) * i
      const y = padding + (height - padding * 2) * (i / 5) + 4
      ctx.fillText(`${value.toFixed(0)}%`, padding - 10, y)
    }

  }, [history, activeTab, thresholds])

  const getRiskLevelInfo = () => {
    if (currentLevel <= thresholds.critical) return { level: 'critical', label: '緊急', color: 'text-red-600', bgColor: 'bg-red-50' }
    if (currentLevel <= thresholds.danger) return { level: 'danger', label: '危険', color: 'text-orange-600', bgColor: 'bg-orange-50' }
    if (currentLevel <= thresholds.warning) return { level: 'warning', label: '警告', color: 'text-yellow-600', bgColor: 'bg-yellow-50' }
    return { level: 'safe', label: '安全', color: 'text-green-600', bgColor: 'bg-green-50' }
  }

  const riskInfo = getRiskLevelInfo()

  const getTrendIcon = () => {
    switch (prediction.trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />
      case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />
      default: return <div className="w-4 h-4 rounded-full bg-gray-400" />
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />
      case 'medium': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      default: return <CheckCircle className="w-4 h-4 text-blue-500" />
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">証拠金維持率詳細</h3>
            <p className="text-sm text-gray-600">{accountName} ({accountId})</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b">
          {[
            { key: 'overview', label: '概要' },
            { key: 'history', label: '履歴' },
            { key: 'prediction', label: '予測' },
            { key: 'actions', label: 'アクション' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 font-medium ${
                activeTab === tab.key
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className={`p-4 rounded-lg ${riskInfo.bgColor}`}>
                <div className="flex items-center space-x-2">
                  <div className={`text-2xl font-bold ${riskInfo.color}`}>
                    {currentLevel.toFixed(1)}%
                  </div>
                  <div className={`px-2 py-1 rounded text-sm font-medium ${riskInfo.color} bg-white`}>
                    {riskInfo.label}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">口座情報</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">残高:</span>
                        <span className="font-medium">${balance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">有効証拠金:</span>
                        <span className="font-medium">${equity.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">使用証拠金:</span>
                        <span className="font-medium">${usedMargin.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">余剰証拠金:</span>
                        <span className="font-medium">${freeMargin.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">ボーナス:</span>
                        <span className="font-medium text-blue-600">${bonusAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">閾値設定</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">安全水準:</span>
                        <span className="font-medium text-green-600">{thresholds.safe}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">警告水準:</span>
                        <span className="font-medium text-yellow-600">{thresholds.warning}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">危険水準:</span>
                        <span className="font-medium text-orange-600">{thresholds.danger}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">緊急水準:</span>
                        <span className="font-medium text-red-600">{thresholds.critical}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="font-medium">証拠金維持率履歴</h4>
              <div className="border rounded">
                <canvas
                  ref={canvasRef}
                  className="w-full"
                  style={{ width: '100%', height: '300px' }}
                />
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>緊急 ({thresholds.critical}%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span>危険 ({thresholds.danger}%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span>警告 ({thresholds.warning}%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>安全 ({thresholds.safe}%)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prediction' && (
            <div className="space-y-4">
              <h4 className="font-medium">証拠金維持率予測</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    {getTrendIcon()}
                    <span className="font-medium">トレンド予測</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">15分後:</span>
                      <span className="font-medium">
                        {prediction.nextLevelIn15min ? `${prediction.nextLevelIn15min.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">1時間後:</span>
                      <span className="font-medium">
                        {prediction.nextLevelIn1hour ? `${prediction.nextLevelIn1hour.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">信頼度:</span>
                      <span className="font-medium">{prediction.confidence}%</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h5 className="font-medium mb-2">リスク分析</h5>
                  <div className="space-y-2 text-sm">
                    {prediction.timeToCritical && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">危険水準まで:</span>
                        <span className="font-medium text-red-600">
                          {Math.round(prediction.timeToCritical)}分
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">回復必要額:</span>
                      <span className="font-medium">
                        ${prediction.requiredRecovery.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-4">
              <h4 className="font-medium">推奨アクション</h4>
              <div className="space-y-3">
                {suggestions.map(suggestion => (
                  <div
                    key={suggestion.id}
                    className={`p-4 border rounded-lg ${
                      suggestion.priority === 'critical' ? 'border-red-200 bg-red-50' :
                      suggestion.priority === 'high' ? 'border-orange-200 bg-orange-50' :
                      suggestion.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                      'border-blue-200 bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          {getPriorityIcon(suggestion.priority)}
                          <h5 className="font-medium">{suggestion.title}</h5>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                        <div className="flex space-x-4 text-xs text-gray-500">
                          <span>証拠金変化: +{suggestion.estimatedImpact.marginChange.toFixed(1)}%</span>
                          <span>リスク軽減: {suggestion.estimatedImpact.riskReduction.toFixed(1)}%</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onActionTrigger(suggestion.id)}
                        disabled={!suggestion.isAvailable}
                        className={`ml-4 px-3 py-1 rounded text-sm font-medium ${
                          suggestion.isAvailable
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        実行
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}