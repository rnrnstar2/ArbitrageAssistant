'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card'
import { Badge } from '@repo/ui/components/ui/badge'
import { MarginLevelGauge } from '../losscut/MarginLevelGauge'
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Clock,
  DollarSign,
  Activity,
  Shield,
  Zap,
  AlertCircle
} from 'lucide-react'

interface RiskDisplayData {
  accountId: string
  accountName: string
  marginLevel: number
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical'
  freeMargin: number
  usedMargin: number
  activePositions: number
  nextAction?: string
  lastUpdate: Date
  predictions?: {
    trend: 'improving' | 'deteriorating' | 'stable'
    timeToLossCut?: number
  }
}

interface AccountRiskCardProps {
  riskData: RiskDisplayData
  isSelected?: boolean
  onClick?: () => void
  onManualIntervention?: () => void
}

export function AccountRiskCard({
  riskData,
  isSelected = false,
  onClick,
  onManualIntervention
}: AccountRiskCardProps) {
  const {
    accountName,
    marginLevel,
    riskLevel,
    freeMargin,
    usedMargin,
    activePositions,
    nextAction,
    predictions
  } = riskData

  // リスクレベルごとの設定
  const riskConfig = useMemo(() => {
    switch (riskLevel) {
      case 'critical':
        return {
          color: 'red',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          textColor: 'text-red-800',
          badgeVariant: 'destructive' as const,
          icon: AlertTriangle,
          label: '緊急',
          pulseEffect: true
        }
      case 'danger':
        return {
          color: 'orange',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-300',
          textColor: 'text-orange-800',
          badgeVariant: 'secondary' as const,
          icon: AlertCircle,
          label: '危険',
          pulseEffect: false
        }
      case 'warning':
        return {
          color: 'yellow',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-300',
          textColor: 'text-yellow-800',
          badgeVariant: 'secondary' as const,
          icon: Zap,
          label: '警告',
          pulseEffect: false
        }
      default:
        return {
          color: 'green',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-300',
          textColor: 'text-green-800',
          badgeVariant: 'secondary' as const,
          icon: Shield,
          label: '安全',
          pulseEffect: false
        }
    }
  }, [riskLevel])

  // トレンドアイコンとラベル
  const trendConfig = useMemo(() => {
    switch (predictions?.trend) {
      case 'improving':
        return {
          icon: TrendingUp,
          color: 'text-green-600',
          label: '改善中'
        }
      case 'deteriorating':
        return {
          icon: TrendingDown,
          color: 'text-red-600',
          label: '悪化中'
        }
      default:
        return {
          icon: Minus,
          color: 'text-gray-600',
          label: '安定'
        }
    }
  }, [predictions?.trend])

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}分`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = Math.round(minutes % 60)
    return `${hours}時間${remainingMinutes}分`
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return `${diffInSeconds}秒前`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分前`
    return `${Math.floor(diffInSeconds / 3600)}時間前`
  }

  const RiskIcon = riskConfig.icon
  const TrendIcon = trendConfig.icon

  return (
    <Card 
      className={`
        transition-all duration-200 cursor-pointer relative
        ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'}
        ${riskConfig.borderColor}
        ${riskConfig.bgColor}
        ${riskConfig.pulseEffect ? 'animate-pulse' : ''}
      `}
      onClick={onClick}
    >
      {/* 緊急時の脈動エフェクト */}
      {riskLevel === 'critical' && (
        <div className="absolute inset-0 bg-red-500 opacity-10 animate-ping rounded-lg" />
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 truncate" title={accountName}>
              {accountName}
            </h4>
            <div className="flex items-center mt-1">
              <Badge variant={riskConfig.badgeVariant} className="flex items-center mr-2">
                <RiskIcon className="h-3 w-3 mr-1" />
                {riskConfig.label}
              </Badge>
              <div className={`flex items-center text-xs ${trendConfig.color}`}>
                <TrendIcon className="h-3 w-3 mr-1" />
                {trendConfig.label}
              </div>
            </div>
          </div>

          {/* 証拠金維持率ゲージ（小） */}
          <div className="ml-2">
            <MarginLevelGauge
              marginLevel={marginLevel}
              accountName=""
              size="sm"
              showLabel={false}
              showPercentage={true}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 主要指標 */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center text-gray-600">
              <DollarSign className="h-3 w-3 mr-1" />
              <span>自由証拠金</span>
            </div>
            <div className={`font-medium ${freeMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${formatNumber(freeMargin)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-gray-600">
              <Activity className="h-3 w-3 mr-1" />
              <span>ポジション</span>
            </div>
            <div className="font-medium text-gray-900">
              {activePositions}件
            </div>
          </div>
        </div>

        {/* 証拠金維持率バー */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">証拠金維持率</span>
            <span className={`text-sm font-bold ${riskConfig.textColor}`}>
              {formatNumber(marginLevel, 1)}%
            </span>
          </div>
          
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  marginLevel > 200 ? 'bg-green-500' :
                  marginLevel > 150 ? 'bg-yellow-500' :
                  marginLevel > 100 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ 
                  width: `${Math.min(100, (marginLevel / 300) * 100)}%` 
                }}
              />
            </div>
            
            {/* ロスカットラインマーカー */}
            <div 
              className="absolute top-0 h-2 w-0.5 bg-red-600"
              style={{ left: `${(50 / 300) * 100}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span className="text-red-600 font-medium">LC:50%</span>
            <span>300%</span>
          </div>
        </div>

        {/* 予測情報 */}
        {predictions?.timeToLossCut !== undefined && (
          <div className={`p-2 rounded border-l-4 ${
            predictions.timeToLossCut === 0 ? 'border-red-500 bg-red-50' :
            predictions.timeToLossCut < 60 ? 'border-orange-500 bg-orange-50' :
            'border-yellow-500 bg-yellow-50'
          }`}>
            <div className="flex items-center text-xs">
              <Clock className="h-3 w-3 mr-1" />
              <span className="text-gray-600">ロスカット予測:</span>
              <span className={`ml-1 font-medium ${
                predictions.timeToLossCut === 0 ? 'text-red-600' :
                predictions.timeToLossCut < 60 ? 'text-orange-600' :
                'text-yellow-600'
              }`}>
                {predictions.timeToLossCut === 0 
                  ? '即座' 
                  : formatTime(predictions.timeToLossCut)
                }
              </span>
            </div>
          </div>
        )}

        {/* 次のアクション */}
        {nextAction && (
          <div className="p-2 bg-blue-50 rounded border border-blue-200">
            <div className="text-xs text-blue-800">
              <span className="font-medium">次のアクション:</span>
              <span className="ml-1">{nextAction}</span>
            </div>
          </div>
        )}

        {/* アクションボタン（緊急時のみ） */}
        {(riskLevel === 'critical' || riskLevel === 'danger') && (
          <div className="flex space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onManualIntervention?.()
              }}
              className={`flex-1 text-xs py-2 px-3 rounded font-medium transition-colors ${
                riskLevel === 'critical' 
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {riskLevel === 'critical' ? '緊急介入' : '手動対応'}
            </button>
          </div>
        )}

        {/* 最終更新時刻 */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-200">
          <span>最終更新</span>
          <span>{formatTimeAgo(riskData.lastUpdate)}</span>
        </div>
      </CardContent>
    </Card>
  )
}