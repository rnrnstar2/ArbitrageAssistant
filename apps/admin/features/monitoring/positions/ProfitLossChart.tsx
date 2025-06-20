'use client'

import { useState, useEffect, useRef } from 'react'

interface ProfitLossChartProps {
  positionId: string
  symbol: string
}

interface ChartDataPoint {
  timestamp: Date
  profit: number
  price: number
}

export function ProfitLossChart({ positionId, symbol }: ProfitLossChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'1h' | '4h' | '24h' | '7d'>('1h')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // チャートデータの取得（モック実装）
  useEffect(() => {
    const generateMockData = () => {
      const now = new Date()
      const points: ChartDataPoint[] = []
      const dataPoints = timeRange === '1h' ? 60 : timeRange === '4h' ? 240 : timeRange === '24h' ? 1440 : 10080
      const intervalMs = timeRange === '1h' ? 60000 : timeRange === '4h' ? 60000 : timeRange === '24h' ? 60000 : 60000

      let lastProfit = Math.random() * 200 - 100
      let lastPrice = 1.1000 + Math.random() * 0.01

      for (let i = dataPoints; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * intervalMs)
        
        // ランダムウォーク
        lastProfit += (Math.random() - 0.5) * 10
        lastPrice += (Math.random() - 0.5) * 0.0001

        points.push({
          timestamp,
          profit: lastProfit,
          price: lastPrice
        })
      }

      return points
    }

    setIsLoading(true)
    // 実際の実装では API からデータを取得
    setTimeout(() => {
      setChartData(generateMockData())
      setIsLoading(false)
    }, 500)
  }, [positionId, timeRange])

  // チャートの描画
  useEffect(() => {
    if (!canvasRef.current || chartData.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Canvas のサイズ設定
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // チャートの描画エリア
    const padding = 40
    const chartWidth = rect.width - padding * 2
    const chartHeight = rect.height - padding * 2

    // データの範囲
    const minProfit = Math.min(...chartData.map(d => d.profit))
    const maxProfit = Math.max(...chartData.map(d => d.profit))
    const profitRange = maxProfit - minProfit

    // 背景をクリア
    ctx.clearRect(0, 0, rect.width, rect.height)

    // グリッドの描画
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1

    // 水平グリッド
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(padding + chartWidth, y)
      ctx.stroke()
    }

    // 垂直グリッド
    for (let i = 0; i <= 10; i++) {
      const x = padding + (chartWidth / 10) * i
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, padding + chartHeight)
      ctx.stroke()
    }

    // ゼロライン
    if (minProfit < 0 && maxProfit > 0) {
      const zeroY = padding + chartHeight - ((0 - minProfit) / profitRange) * chartHeight
      ctx.strokeStyle = '#6b7280'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(padding, zeroY)
      ctx.lineTo(padding + chartWidth, zeroY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 損益ラインの描画
    const lastPoint = chartData[chartData.length - 1]
    ctx.strokeStyle = (lastPoint?.profit ?? 0) >= 0 ? '#10b981' : '#ef4444'
    ctx.lineWidth = 2
    ctx.beginPath()

    chartData.forEach((point, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth
      const y = padding + chartHeight - ((point.profit - minProfit) / profitRange) * chartHeight

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()

    // エリアの塗りつぶし
    ctx.globalAlpha = 0.1
    ctx.fillStyle = (lastPoint?.profit ?? 0) >= 0 ? '#10b981' : '#ef4444'
    ctx.lineTo(padding + chartWidth, padding + chartHeight)
    ctx.lineTo(padding, padding + chartHeight)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1

    // Y軸ラベル
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'
    
    for (let i = 0; i <= 5; i++) {
      const value = maxProfit - (profitRange / 5) * i
      const y = padding + (chartHeight / 5) * i + 4
      ctx.fillText(value.toFixed(1), padding - 10, y)
    }

    // X軸ラベル
    ctx.textAlign = 'center'
    const timeLabels = 6
    for (let i = 0; i <= timeLabels; i++) {
      const dataIndex = Math.floor((chartData.length - 1) * (i / timeLabels))
      const point = chartData[dataIndex]
      if (!point) continue

      const x = padding + (chartWidth / timeLabels) * i
      const timeStr = point.timestamp.toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      ctx.fillText(timeStr, x, rect.height - 10)
    }

  }, [chartData])

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const getCurrentStats = () => {
    if (chartData.length === 0) return null

    const current = chartData[chartData.length - 1]
    const start = chartData[0]
    
    if (!current || !start) {
      return { current: 0, change: 0, changePercent: 0 }
    }
    
    const change = current.profit - start.profit

    return {
      current: current.profit,
      change,
      changePercent: start.profit !== 0 ? (change / Math.abs(start.profit)) * 100 : 0
    }
  }

  const stats = getCurrentStats()

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">損益推移</h4>
          <div className="flex space-x-1">
            {(['1h', '4h', '24h', '7d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-1 text-xs rounded ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {stats && (
          <div className="flex items-center space-x-4 text-sm">
            <div>
              <span className="text-gray-600">現在:</span>
              <span className={`ml-1 font-medium ${
                stats.current >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatNumber(stats.current, 2)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">変動:</span>
              <span className={`ml-1 font-medium ${
                stats.change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.change >= 0 ? '+' : ''}{formatNumber(stats.change, 2)}
                <span className="text-xs ml-1">
                  ({stats.changePercent >= 0 ? '+' : ''}{formatNumber(stats.changePercent, 1)}%)
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* チャート */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">チャートを読み込み中...</p>
            </div>
          </div>
        ) : (
          <div className="h-full relative">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}
      </div>

      {/* フッター統計 */}
      <div className="p-4 border-t bg-gray-50">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="text-gray-600">最大益</div>
            <div className="font-medium text-green-600">
              {chartData.length > 0 && formatNumber(Math.max(...chartData.map(d => d.profit)), 2)}
            </div>
          </div>
          <div>
            <div className="text-gray-600">最大損</div>
            <div className="font-medium text-red-600">
              {chartData.length > 0 && formatNumber(Math.min(...chartData.map(d => d.profit)), 2)}
            </div>
          </div>
          <div>
            <div className="text-gray-600">データ数</div>
            <div className="font-medium text-gray-800">
              {chartData.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}