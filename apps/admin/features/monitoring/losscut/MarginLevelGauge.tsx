'use client'

import { useMemo } from 'react'

interface MarginLevelGaugeProps {
  marginLevel: number
  accountName: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showPercentage?: boolean
  lossCutLevel?: number
  warningLevel?: number
  className?: string
}

export function MarginLevelGauge({
  marginLevel,
  accountName,
  size = 'md',
  showLabel = true,
  showPercentage = true,
  lossCutLevel = 50,
  warningLevel = 150,
  className = ''
}: MarginLevelGaugeProps) {
  const dimensions = useMemo(() => {
    switch (size) {
      case 'sm': return { width: 120, height: 120, strokeWidth: 8, fontSize: 12 }
      case 'lg': return { width: 200, height: 200, strokeWidth: 16, fontSize: 18 }
      default: return { width: 150, height: 150, strokeWidth: 12, fontSize: 14 }
    }
  }, [size])

  const { width, height, strokeWidth, fontSize } = dimensions
  const radius = (width - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // 角度の計算（0% = 下、300% = 270度）
  const maxMarginLevel = 300
  const angleRange = 270 // 270度の範囲
  const angle = Math.min(marginLevel, maxMarginLevel) * (angleRange / maxMarginLevel)
  
  // パスの計算
  const startAngle = 135 // 開始角度（下から左回り）
  const endAngle = startAngle + angle
  
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    }
  }

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle)
    const end = polarToCartesian(x, y, radius, startAngle)
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
  }

  // 色の決定
  const getColor = () => {
    if (marginLevel <= lossCutLevel) return '#ef4444' // red-500
    if (marginLevel <= warningLevel) return '#f59e0b' // amber-500
    if (marginLevel <= 200) return '#eab308' // yellow-500
    return '#22c55e' // green-500
  }

  // リスクレベルの決定
  const getRiskLevel = () => {
    if (marginLevel <= lossCutLevel) return { level: 'critical', label: '緊急', color: 'text-red-600' }
    if (marginLevel <= warningLevel) return { level: 'high', label: '警告', color: 'text-orange-600' }
    if (marginLevel <= 200) return { level: 'medium', label: '注意', color: 'text-yellow-600' }
    return { level: 'low', label: '安全', color: 'text-green-600' }
  }

  const riskInfo = getRiskLevel()
  const color = getColor()
  const center = width / 2

  // マーカーライン（ロスカットライン、警告ライン）
  const getMarkerLine = (level: number, color: string, label: string) => {
    const markerAngle = Math.min(level, maxMarginLevel) * (angleRange / maxMarginLevel) + startAngle
    const innerRadius = radius - strokeWidth / 2 + 2
    const outerRadius = radius + strokeWidth / 2 - 2
    
    const inner = polarToCartesian(center, center, innerRadius, markerAngle)
    const outer = polarToCartesian(center, center, outerRadius, markerAngle)
    
    return (
      <g key={label}>
        <line
          x1={inner.x}
          y1={inner.y}
          x2={outer.x}
          y2={outer.y}
          stroke={color}
          strokeWidth="2"
        />
        <text
          x={outer.x}
          y={outer.y - 5}
          fontSize="10"
          fill={color}
          textAnchor="middle"
          className="font-medium"
        >
          {label}
        </text>
      </g>
    )
  }

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="relative">
        <svg width={width} height={height} className="transform -rotate-45">
          {/* 背景円 */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeDashoffset={circumference * 0.25}
          />
          
          {/* プログレス円 */}
          <path
            d={describeArc(center, center, radius, startAngle, endAngle)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))'
            }}
          />
          
          {/* マーカーライン */}
          {getMarkerLine(lossCutLevel, '#ef4444', 'LC')}
          {getMarkerLine(warningLevel, '#f59e0b', 'W')}
          {getMarkerLine(200, '#22c55e', '200')}
        </svg>

        {/* 中央の数値表示 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            {showPercentage && (
              <div 
                className={`font-bold ${riskInfo.color}`}
                style={{ fontSize: `${fontSize}px` }}
              >
                {marginLevel.toFixed(1)}%
              </div>
            )}
            <div 
              className={`text-xs ${riskInfo.color} font-medium`}
              style={{ fontSize: `${fontSize * 0.7}px` }}
            >
              {riskInfo.label}
            </div>
          </div>
        </div>

        {/* 脈動エフェクト（緊急時） */}
        {riskInfo.level === 'critical' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="rounded-full bg-red-500 opacity-20 animate-ping"
              style={{ 
                width: width * 0.8, 
                height: height * 0.8 
              }}
            />
          </div>
        )}
      </div>

      {/* ラベル */}
      {showLabel && (
        <div className="mt-2 text-center">
          <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]" title={accountName}>
            {accountName}
          </div>
          <div className="text-xs text-gray-500">
            証拠金維持率
          </div>
        </div>
      )}

      {/* 詳細情報（大きいサイズの場合） */}
      {size === 'lg' && (
        <div className="mt-3 text-center space-y-1">
          <div className="flex justify-center space-x-4 text-xs text-gray-600">
            <span>LC: {lossCutLevel}%</span>
            <span>警告: {warningLevel}%</span>
            <span>安全: 200%+</span>
          </div>
          <div className={`text-sm font-medium ${riskInfo.color}`}>
            {marginLevel <= lossCutLevel && '⚠️ 即座に対応が必要'}
            {marginLevel > lossCutLevel && marginLevel <= warningLevel && '⚡ 注意深く監視'}
            {marginLevel > warningLevel && marginLevel <= 200 && 'ℹ️ 正常範囲'}
            {marginLevel > 200 && '✅ 安全な水準'}
          </div>
        </div>
      )}
    </div>
  )
}

// 複数のゲージを並べて表示するコンポーネント
interface MarginLevelGaugeGridProps {
  accounts: Array<{
    id: string
    name: string
    marginLevel: number
  }>
  size?: 'sm' | 'md' | 'lg'
  columns?: number
  onAccountClick?: (accountId: string) => void
}

export function MarginLevelGaugeGrid({
  accounts,
  size = 'sm',
  columns = 4,
  onAccountClick
}: MarginLevelGaugeGridProps) {
  const sortedAccounts = [...accounts].sort((a, b) => a.marginLevel - b.marginLevel)

  return (
    <div 
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {sortedAccounts.map((account) => (
        <div
          key={account.id}
          onClick={() => onAccountClick?.(account.id)}
          className={`${onAccountClick ? 'cursor-pointer hover:bg-gray-50' : ''} p-2 rounded-lg transition-colors`}
        >
          <MarginLevelGauge
            marginLevel={account.marginLevel}
            accountName={account.name}
            size={size}
            showLabel={true}
            showPercentage={true}
          />
        </div>
      ))}
    </div>
  )
}

// リアルタイム更新対応のゲージコンポーネント
interface RealtimeMarginGaugeProps extends MarginLevelGaugeProps {
  updateInterval?: number
  onDataUpdate?: () => void
}

export function RealtimeMarginGauge({
  updateInterval = 1000,
  onDataUpdate,
  ...props
}: RealtimeMarginGaugeProps) {
  // 実際の実装では useEffect でリアルタイムデータ更新を処理
  return <MarginLevelGauge {...props} />
}