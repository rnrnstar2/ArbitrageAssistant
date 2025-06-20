# Task 07: 証拠金維持率ゲージコンポーネントの実装

## 概要
証拠金維持率を視覚的に表示するゲージコンポーネントを実装する。危険レベルを直感的に把握できる円形ゲージUI。

## 実装対象ファイル
- `apps/admin/src/components/ui/MarginLevelGauge.tsx`
- `apps/admin/src/components/ui/CircularProgress.tsx`
- `apps/admin/src/components/ui/RiskLevelIndicator.tsx`
- `apps/admin/src/hooks/useGaugeAnimation.ts`

## 具体的な実装内容

### MarginLevelGauge.tsx
```typescript
interface MarginLevelGaugeProps {
  value: number                    // 現在の証拠金維持率 (%)
  size?: 'sm' | 'md' | 'lg'       // ゲージサイズ
  dangerLevel?: number             // 危険レベル (デフォルト: 30%)
  criticalLevel?: number           // 緊急レベル (デフォルト: 20%)
  showPercentage?: boolean         // パーセント表示
  animated?: boolean               // アニメーション有効
  onThresholdCrossed?: (level: RiskLevel) => void
}

export const MarginLevelGauge: React.FC<MarginLevelGaugeProps> = ({
  value,
  size = 'md',
  dangerLevel = 30,
  criticalLevel = 20,
  showPercentage = true,
  animated = true,
  onThresholdCrossed
}) => {
  const { animatedValue, riskLevel } = useGaugeAnimation(
    value,
    { dangerLevel, criticalLevel },
    onThresholdCrossed
  )
  
  const gaugeSize = {
    sm: 80,
    md: 120,
    lg: 160
  }[size]
  
  return (
    <div className="margin-level-gauge">
      <div className="gauge-container" style={{ width: gaugeSize, height: gaugeSize }}>
        <CircularProgress
          value={animatedValue}
          max={100}
          size={gaugeSize}
          strokeWidth={8}
          color={getGaugeColor(riskLevel)}
          backgroundColor="#e5e7eb"
          animated={animated}
        />
        
        {/* 危険レベル線 */}
        <GaugeThresholdLine
          value={dangerLevel}
          color="orange"
          size={gaugeSize}
          label="危険"
        />
        
        {/* 緊急レベル線 */}
        <GaugeThresholdLine
          value={criticalLevel}
          color="red"
          size={gaugeSize}
          label="緊急"
        />
        
        {/* 中央表示 */}
        <div className="gauge-center">
          {showPercentage && (
            <div className="gauge-value">
              <span className="value-number">{Math.round(animatedValue)}</span>
              <span className="value-unit">%</span>
            </div>
          )}
          <div className="gauge-label">証拠金維持率</div>
        </div>
      </div>
      
      <RiskLevelIndicator level={riskLevel} />
    </div>
  )
}
```

### CircularProgress.tsx
```typescript
interface CircularProgressProps {
  value: number
  max: number
  size: number
  strokeWidth: number
  color: string
  backgroundColor: string
  animated?: boolean
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max,
  size,
  strokeWidth,
  color,
  backgroundColor,
  animated = true
}) => {
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (value / max) * circumference
  
  return (
    <svg
      width={size}
      height={size}
      className="circular-progress"
    >
      {/* 背景円 */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke={backgroundColor}
        strokeWidth={strokeWidth}
      />
      
      {/* プログレス円 */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
        className={animated ? "progress-animated" : ""}
      />
    </svg>
  )
}
```

### GaugeThresholdLine.tsx
```typescript
interface GaugeThresholdLineProps {
  value: number        // 閾値 (%)
  color: string        // 線の色
  size: number         // ゲージサイズ
  label: string        // ラベル
}

const GaugeThresholdLine: React.FC<GaugeThresholdLineProps> = ({
  value,
  color,
  size,
  label
}) => {
  const center = size / 2
  const radius = center - 20
  const angle = (value / 100) * 270 - 135 // -135°から135°の範囲
  const radian = (angle * Math.PI) / 180
  
  const x1 = center + (radius - 10) * Math.cos(radian)
  const y1 = center + (radius - 10) * Math.sin(radian)
  const x2 = center + (radius + 5) * Math.cos(radian)
  const y2 = center + (radius + 5) * Math.sin(radian)
  
  return (
    <g className="threshold-line">
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        className="threshold-marker"
      />
      <text
        x={center + (radius + 15) * Math.cos(radian)}
        y={center + (radius + 15) * Math.sin(radian)}
        fill={color}
        fontSize="10"
        textAnchor="middle"
        className="threshold-label"
      >
        {label}
      </text>
    </g>
  )
}
```

### useGaugeAnimation.ts
```typescript
interface GaugeThresholds {
  dangerLevel: number
  criticalLevel: number
}

export const useGaugeAnimation = (
  targetValue: number,
  thresholds: GaugeThresholds,
  onThresholdCrossed?: (level: RiskLevel) => void
) => {
  const [animatedValue, setAnimatedValue] = useState(0)
  const [currentRiskLevel, setCurrentRiskLevel] = useState<RiskLevel>('safe')
  const previousRiskLevel = useRef<RiskLevel>('safe')
  
  const getRiskLevel = useCallback((value: number): RiskLevel => {
    if (value <= thresholds.criticalLevel) return 'critical'
    if (value <= thresholds.dangerLevel) return 'danger'
    if (value <= 50) return 'warning'
    return 'safe'
  }, [thresholds])
  
  useEffect(() => {
    const newRiskLevel = getRiskLevel(targetValue)
    
    // リスクレベル変更時のコールバック
    if (newRiskLevel !== previousRiskLevel.current && onThresholdCrossed) {
      onThresholdCrossed(newRiskLevel)
    }
    
    setCurrentRiskLevel(newRiskLevel)
    previousRiskLevel.current = newRiskLevel
    
    // アニメーション実行
    const startValue = animatedValue
    const duration = 1000 // 1秒
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // easeOutQuart イージング
      const easedProgress = 1 - Math.pow(1 - progress, 4)
      const currentValue = startValue + (targetValue - startValue) * easedProgress
      
      setAnimatedValue(currentValue)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    animate()
  }, [targetValue, animatedValue, getRiskLevel, onThresholdCrossed])
  
  return {
    animatedValue,
    riskLevel: currentRiskLevel
  }
}
```

## ゲージカラーテーマ
```typescript
const getGaugeColor = (riskLevel: RiskLevel): string => {
  switch (riskLevel) {
    case 'safe':
      return '#10b981'      // green-500
    case 'warning':
      return '#f59e0b'      // amber-500
    case 'danger':
      return '#f97316'      // orange-500
    case 'critical':
      return '#ef4444'      // red-500
    default:
      return '#6b7280'      // gray-500
  }
}
```

## スタイリング (CSS)
```css
.margin-level-gauge {
  @apply relative flex flex-col items-center;
}

.gauge-container {
  @apply relative;
}

.gauge-center {
  @apply absolute inset-0 flex flex-col items-center justify-center;
}

.gauge-value {
  @apply flex items-baseline;
}

.value-number {
  @apply text-2xl font-bold;
}

.value-unit {
  @apply text-sm font-medium ml-1;
}

.gauge-label {
  @apply text-xs text-gray-600 mt-1;
}

.progress-animated {
  transition: stroke-dashoffset 0.3s ease-out;
}

.threshold-line {
  pointer-events: none;
}

.threshold-marker {
  @apply drop-shadow-sm;
}

.threshold-label {
  @apply font-semibold;
}
```

## 完了条件
- [ ] MarginLevelGauge コンポーネント実装
- [ ] CircularProgress コンポーネント実装
- [ ] GaugeThresholdLine コンポーネント実装
- [ ] useGaugeAnimation hook実装
- [ ] 閾値線表示機能
- [ ] スムーズアニメーション
- [ ] リスクレベル変更検知
- [ ] レスポンシブ対応
- [ ] コンポーネントテスト実装

## 機能要件
- 0-100%の範囲表示
- 危険/緊急レベル線表示
- スムーズなアニメーション
- リスクレベル変更時コールバック
- サイズバリエーション (sm/md/lg)
- カスタマイズ可能な閾値

## 参考ファイル
- 既存のプログレスコンポーネント
- チャート・グラフコンポーネント

## 注意事項
- パフォーマンス最適化（アニメーション）
- アクセシビリティ対応（スクリーンリーダー）
- 色覚異常への配慮
- 高DPI画面での描画品質