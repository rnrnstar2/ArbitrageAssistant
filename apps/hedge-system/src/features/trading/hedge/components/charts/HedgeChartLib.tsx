'use client'

import React, { useRef, useEffect, useCallback } from 'react'

export interface ChartPoint {
  x: number
  y: number
  label?: string
  color?: string
}

export interface ChartSeries {
  name: string
  data: ChartPoint[]
  color: string
  type: 'line' | 'bar' | 'area'
  strokeWidth?: number
  fillOpacity?: number
}

export interface ChartConfig {
  width: number
  height: number
  margin: {
    top: number
    right: number
    bottom: number
    left: number
  }
  grid: {
    show: boolean
    color: string
    strokeWidth: number
  }
  axes: {
    x: {
      show: boolean
      label?: string
      tickCount?: number
      format?: (value: number) => string
    }
    y: {
      show: boolean
      label?: string
      tickCount?: number
      format?: (value: number) => string
    }
  }
  legend: {
    show: boolean
    position: 'top' | 'bottom' | 'left' | 'right'
  }
  tooltip: {
    show: boolean
    format?: (point: ChartPoint, series: ChartSeries) => string
  }
}

export interface HedgeChartProps {
  series: ChartSeries[]
  config: Partial<ChartConfig>
  className?: string
  onPointClick?: (point: ChartPoint, series: ChartSeries) => void
  onPointHover?: (point: ChartPoint | null, series: ChartSeries | null) => void
}

const DEFAULT_CONFIG: ChartConfig = {
  width: 800,
  height: 400,
  margin: { top: 20, right: 20, bottom: 40, left: 60 },
  grid: { show: true, color: '#f0f0f0', strokeWidth: 1 },
  axes: {
    x: { show: true, tickCount: 5 },
    y: { show: true, tickCount: 5 }
  },
  legend: { show: true, position: 'top' },
  tooltip: { show: true }
}

export const HedgeChart: React.FC<HedgeChartProps> = ({
  series,
  config,
  className = '',
  onPointClick,
  onPointHover
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const mergedConfig = { ...DEFAULT_CONFIG, ...config } as ChartConfig

  // データの範囲を計算
  const getDataBounds = useCallback(() => {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    series.forEach(s => {
      s.data.forEach(point => {
        minX = Math.min(minX, point.x)
        maxX = Math.max(maxX, point.x)
        minY = Math.min(minY, point.y)
        maxY = Math.max(maxY, point.y)
      })
    })

    return { minX, maxX, minY, maxY }
  }, [series])

  // スケール関数を作成
  const createScales = useCallback((bounds: ReturnType<typeof getDataBounds>) => {
    const { width, height, margin } = mergedConfig
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const xScale = (value: number) => 
      margin.left + ((value - bounds.minX) / (bounds.maxX - bounds.minX)) * chartWidth

    const yScale = (value: number) => 
      margin.top + ((bounds.maxY - value) / (bounds.maxY - bounds.minY)) * chartHeight

    return { xScale, yScale, chartWidth, chartHeight }
  }, [mergedConfig])

  // チャートを描画
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Canvas サイズを設定
    canvas.width = mergedConfig.width
    canvas.height = mergedConfig.height

    // 背景をクリア
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, mergedConfig.width, mergedConfig.height)

    if (series.length === 0) return

    const bounds = getDataBounds()
    const { xScale, yScale, chartWidth, chartHeight } = createScales(bounds)

    // グリッドを描画
    if (mergedConfig.grid.show) {
      drawGrid(ctx, xScale, yScale, chartWidth, chartHeight, bounds)
    }

    // 軸を描画
    if (mergedConfig.axes.x.show || mergedConfig.axes.y.show) {
      drawAxes(ctx, xScale, yScale, chartWidth, chartHeight, bounds)
    }

    // データシリーズを描画
    series.forEach(s => {
      drawSeries(ctx, s, xScale, yScale)
    })

    // 凡例を描画
    if (mergedConfig.legend.show) {
      drawLegend(ctx)
    }
  }, [series, mergedConfig, getDataBounds, createScales])

  // グリッド描画
  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    xScale: (v: number) => number,
    yScale: (v: number) => number,
    chartWidth: number,
    chartHeight: number,
    bounds: ReturnType<typeof getDataBounds>
  ) => {
    const { grid, margin } = mergedConfig
    
    ctx.strokeStyle = grid.color
    ctx.lineWidth = grid.strokeWidth
    ctx.setLineDash([])

    // 横線
    const yTicks = 5
    for (let i = 0; i <= yTicks; i++) {
      const y = margin.top + (i / yTicks) * chartHeight
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(margin.left + chartWidth, y)
      ctx.stroke()
    }

    // 縦線
    const xTicks = 5
    for (let i = 0; i <= xTicks; i++) {
      const x = margin.left + (i / xTicks) * chartWidth
      ctx.beginPath()
      ctx.moveTo(x, margin.top)
      ctx.lineTo(x, margin.top + chartHeight)
      ctx.stroke()
    }
  }

  // 軸描画
  const drawAxes = (
    ctx: CanvasRenderingContext2D,
    xScale: (v: number) => number,
    yScale: (v: number) => number,
    chartWidth: number,
    chartHeight: number,
    bounds: ReturnType<typeof getDataBounds>
  ) => {
    const { axes, margin } = mergedConfig
    
    ctx.fillStyle = '#374151'
    ctx.font = '12px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // X軸ラベル
    if (axes.x.show) {
      const xTicks = axes.x.tickCount || 5
      for (let i = 0; i <= xTicks; i++) {
        const value = bounds.minX + (i / xTicks) * (bounds.maxX - bounds.minX)
        const x = margin.left + (i / xTicks) * chartWidth
        const displayValue = axes.x.format ? axes.x.format(value) : value.toFixed(1)
        ctx.fillText(displayValue, x, margin.top + chartHeight + 10)
      }

      if (axes.x.label) {
        ctx.font = '14px system-ui'
        ctx.fillText(
          axes.x.label, 
          margin.left + chartWidth / 2, 
          mergedConfig.height - 10
        )
        ctx.font = '12px system-ui'
      }
    }

    // Y軸ラベル
    if (axes.y.show) {
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      
      const yTicks = axes.y.tickCount || 5
      for (let i = 0; i <= yTicks; i++) {
        const value = bounds.maxY - (i / yTicks) * (bounds.maxY - bounds.minY)
        const y = margin.top + (i / yTicks) * chartHeight
        const displayValue = axes.y.format ? axes.y.format(value) : value.toFixed(1)
        ctx.fillText(displayValue, margin.left - 10, y)
      }

      if (axes.y.label) {
        ctx.save()
        ctx.translate(15, margin.top + chartHeight / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.font = '14px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(axes.y.label, 0, 0)
        ctx.restore()
      }
    }
  }

  // データシリーズ描画
  const drawSeries = (
    ctx: CanvasRenderingContext2D,
    series: ChartSeries,
    xScale: (v: number) => number,
    yScale: (v: number) => number
  ) => {
    if (series.data.length === 0) return

    ctx.strokeStyle = series.color
    ctx.fillStyle = series.color
    ctx.lineWidth = series.strokeWidth || 2

    switch (series.type) {
      case 'line':
        drawLineChart(ctx, series, xScale, yScale)
        break
      case 'area':
        drawAreaChart(ctx, series, xScale, yScale)
        break
      case 'bar':
        drawBarChart(ctx, series, xScale, yScale)
        break
    }
  }

  // 線グラフ描画
  const drawLineChart = (
    ctx: CanvasRenderingContext2D,
    series: ChartSeries,
    xScale: (v: number) => number,
    yScale: (v: number) => number
  ) => {
    ctx.beginPath()
    series.data.forEach((point, index) => {
      const x = xScale(point.x)
      const y = yScale(point.y)
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // データポイント
    series.data.forEach(point => {
      const x = xScale(point.x)
      const y = yScale(point.y)
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fill()
    })
  }

  // エリアチャート描画
  const drawAreaChart = (
    ctx: CanvasRenderingContext2D,
    series: ChartSeries,
    xScale: (v: number) => number,
    yScale: (v: number) => number
  ) => {
    if (series.data.length === 0) return

    const { margin } = mergedConfig
    const baselineY = yScale(0)

    // 塗りつぶし
    ctx.globalAlpha = series.fillOpacity || 0.3
    ctx.beginPath()
    
    const firstPoint = series.data[0]
    ctx.moveTo(xScale(firstPoint.x), baselineY)
    
    series.data.forEach(point => {
      ctx.lineTo(xScale(point.x), yScale(point.y))
    })
    
    const lastPoint = series.data[series.data.length - 1]
    ctx.lineTo(xScale(lastPoint.x), baselineY)
    ctx.closePath()
    ctx.fill()

    // 線
    ctx.globalAlpha = 1
    drawLineChart(ctx, series, xScale, yScale)
  }

  // 棒グラフ描画
  const drawBarChart = (
    ctx: CanvasRenderingContext2D,
    series: ChartSeries,
    xScale: (v: number) => number,
    yScale: (v: number) => number
  ) => {
    const bounds = getDataBounds()
    const barWidth = (mergedConfig.width - mergedConfig.margin.left - mergedConfig.margin.right) / series.data.length * 0.8
    const baselineY = yScale(0)

    series.data.forEach(point => {
      const x = xScale(point.x) - barWidth / 2
      const y = yScale(point.y)
      const height = Math.abs(baselineY - y)
      
      ctx.fillRect(x, Math.min(y, baselineY), barWidth, height)
    })
  }

  // 凡例描画
  const drawLegend = (ctx: CanvasRenderingContext2D) => {
    const { legend, margin } = mergedConfig
    let startX = margin.left
    let startY = 10

    if (legend.position === 'bottom') {
      startY = mergedConfig.height - 30
    }

    ctx.font = '12px system-ui'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    series.forEach((s, index) => {
      const x = startX + index * 120
      
      // 色の四角
      ctx.fillStyle = s.color
      ctx.fillRect(x, startY, 12, 12)
      
      // テキスト
      ctx.fillStyle = '#374151'
      ctx.fillText(s.name, x + 18, startY + 6)
    })
  }

  // マウスイベント処理
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPointHover) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    // 最も近いポイントを探す
    let closestPoint: ChartPoint | null = null
    let closestSeries: ChartSeries | null = null
    let minDistance = Infinity

    const bounds = getDataBounds()
    const { xScale, yScale } = createScales(bounds)

    series.forEach(s => {
      s.data.forEach(point => {
        const x = xScale(point.x)
        const y = yScale(point.y)
        const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2))
        
        if (distance < minDistance && distance < 20) { // 20px以内
          minDistance = distance
          closestPoint = point
          closestSeries = s
        }
      })
    })

    onPointHover(closestPoint, closestSeries)

    // ツールチップ表示
    if (closestPoint && closestSeries && tooltipRef.current) {
      const tooltip = tooltipRef.current
      tooltip.style.display = 'block'
      tooltip.style.left = `${event.clientX + 10}px`
      tooltip.style.top = `${event.clientY - 30}px`
      
      const content = mergedConfig.tooltip.format 
        ? mergedConfig.tooltip.format(closestPoint, closestSeries)
        : `${closestSeries.name}: (${closestPoint.x.toFixed(2)}, ${closestPoint.y.toFixed(2)})`
      
      tooltip.textContent = content
    } else if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none'
    }
  }, [series, onPointHover, mergedConfig, getDataBounds, createScales])

  const handleMouseLeave = useCallback(() => {
    if (onPointHover) {
      onPointHover(null, null)
    }
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none'
    }
  }, [onPointHover])

  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPointClick) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    const bounds = getDataBounds()
    const { xScale, yScale } = createScales(bounds)

    // クリックされたポイントを探す
    series.forEach(s => {
      s.data.forEach(point => {
        const x = xScale(point.x)
        const y = yScale(point.y)
        const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2))
        
        if (distance < 10) { // 10px以内
          onPointClick(point, s)
        }
      })
    })
  }, [series, onPointClick, getDataBounds, createScales])

  // チャート描画
  useEffect(() => {
    drawChart()
  }, [drawChart])

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="border border-gray-200 rounded cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      {mergedConfig.tooltip.show && (
        <div
          ref={tooltipRef}
          className="absolute bg-gray-800 text-white px-2 py-1 rounded text-sm pointer-events-none z-10 hidden"
          style={{ position: 'fixed' }}
        />
      )}
    </div>
  )
}

// 特化したチャートコンポーネント

export interface ProfitChartProps {
  data: { timestamp: Date; profit: number }[]
  height?: number
  className?: string
}

export const HedgeProfitChart: React.FC<ProfitChartProps> = ({
  data,
  height = 300,
  className = ''
}) => {
  const series: ChartSeries[] = [{
    name: '損益',
    type: 'area',
    color: '#3b82f6',
    fillOpacity: 0.2,
    data: data.map((item, index) => ({
      x: index,
      y: item.profit
    }))
  }]

  const config: Partial<ChartConfig> = {
    height,
    axes: {
      x: {
        show: true,
        label: '時間',
        format: (value) => {
          const index = Math.floor(value)
          return data[index] ? data[index].timestamp.toLocaleTimeString() : ''
        }
      },
      y: {
        show: true,
        label: '損益 ($)',
        format: (value) => `$${value.toFixed(2)}`
      }
    }
  }

  return <HedgeChart series={series} config={config} className={className} />
}

export interface BalanceChartProps {
  hedgePositions: Array<{
    symbol: string
    buyLots: number
    sellLots: number
  }>
  className?: string
}

export const HedgeBalanceChart: React.FC<BalanceChartProps> = ({
  hedgePositions,
  className = ''
}) => {
  const series: ChartSeries[] = [
    {
      name: '買いロット',
      type: 'bar',
      color: '#10b981',
      data: hedgePositions.map((pos, index) => ({
        x: index,
        y: pos.buyLots
      }))
    },
    {
      name: '売りロット',
      type: 'bar',
      color: '#ef4444',
      data: hedgePositions.map((pos, index) => ({
        x: index,
        y: -pos.sellLots // 負の値で表示
      }))
    }
  ]

  const config: Partial<ChartConfig> = {
    height: 250,
    axes: {
      x: {
        show: true,
        label: '通貨ペア',
        format: (value) => {
          const index = Math.floor(value)
          return hedgePositions[index] ? hedgePositions[index].symbol : ''
        }
      },
      y: {
        show: true,
        label: 'ロット数',
        format: (value) => `${Math.abs(value).toFixed(2)}`
      }
    }
  }

  return <HedgeChart series={series} config={config} className={className} />
}

export default HedgeChart