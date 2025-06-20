'use client'

import React, { useState, useEffect, useRef } from 'react'
import { usePerformanceOptimization } from '../services/PerformanceOptimizationService'

export interface MemoryUsageChartProps {
  width?: number
  height?: number
  className?: string
  updateInterval?: number
  maxDataPoints?: number
  showGrid?: boolean
  showLabels?: boolean
}

export const MemoryUsageChart: React.FC<MemoryUsageChartProps> = ({
  width = 400,
  height = 200,
  className = '',
  updateInterval = 1000,
  maxDataPoints = 60,
  showGrid = true,
  showLabels = true
}) => {
  const { getMemoryStats } = usePerformanceOptimization()
  const [memoryHistory, setMemoryHistory] = useState<Array<{
    timestamp: number
    usedMemory: number
    totalMemory: number
    freeMemory: number
  }>>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // メモリデータの更新
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = getMemoryStats()
      const dataPoint = {
        timestamp: Date.now(),
        usedMemory: stats.usedMemory,
        totalMemory: stats.totalMemory / 1024 / 1024, // バイトをMBに変換
        freeMemory: stats.freeMemory
      }

      setMemoryHistory(prev => {
        const newHistory = [...prev, dataPoint]
        // 最大データポイント数を超えた場合、古いデータを削除
        return newHistory.slice(-maxDataPoints)
      })
    }, updateInterval)

    return () => clearInterval(interval)
  }, [getMemoryStats, updateInterval, maxDataPoints])

  // チャートの描画
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || memoryHistory.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Canvasのサイズ設定
    canvas.width = width
    canvas.height = height

    // 背景をクリア
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // データの範囲を計算
    const maxMemory = Math.max(
      ...memoryHistory.map(d => Math.max(d.usedMemory, d.totalMemory))
    )
    const minMemory = 0

    // 描画エリアのマージン
    const margin = { top: 20, right: 20, bottom: 20, left: 40 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    // スケール関数
    const xScale = (index: number) => 
      margin.left + (index / (memoryHistory.length - 1)) * chartWidth
    const yScale = (value: number) => 
      margin.top + ((maxMemory - value) / (maxMemory - minMemory)) * chartHeight

    // グリッドの描画
    if (showGrid) {
      ctx.strokeStyle = '#f0f0f0'
      ctx.lineWidth = 1

      // 横線
      for (let i = 0; i <= 5; i++) {
        const y = margin.top + (i / 5) * chartHeight
        ctx.beginPath()
        ctx.moveTo(margin.left, y)
        ctx.lineTo(margin.left + chartWidth, y)
        ctx.stroke()
      }

      // 縦線
      for (let i = 0; i <= 10; i++) {
        const x = margin.left + (i / 10) * chartWidth
        ctx.beginPath()
        ctx.moveTo(x, margin.top)
        ctx.lineTo(x, margin.top + chartHeight)
        ctx.stroke()
      }
    }

    // 使用メモリのライン（赤）
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    memoryHistory.forEach((point, index) => {
      const x = xScale(index)
      const y = yScale(point.usedMemory)
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // 総メモリのライン（青、点線）
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    memoryHistory.forEach((point, index) => {
      const x = xScale(index)
      const y = yScale(point.totalMemory)
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()
    ctx.setLineDash([]) // 点線をリセット

    // 使用メモリエリアの塗りつぶし
    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)'
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top + chartHeight)
    memoryHistory.forEach((point, index) => {
      const x = xScale(index)
      const y = yScale(point.usedMemory)
      ctx.lineTo(x, y)
    })
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight)
    ctx.closePath()
    ctx.fill()

    // ラベルの描画
    if (showLabels) {
      ctx.fillStyle = '#374151'
      ctx.font = '12px system-ui'

      // Y軸ラベル
      for (let i = 0; i <= 5; i++) {
        const value = maxMemory - (i / 5) * (maxMemory - minMemory)
        const y = margin.top + (i / 5) * chartHeight
        ctx.fillText(`${value.toFixed(0)}MB`, 5, y + 4)
      }

      // 現在値の表示
      if (memoryHistory.length > 0) {
        const latest = memoryHistory[memoryHistory.length - 1]
        ctx.fillStyle = '#ef4444'
        ctx.font = 'bold 14px system-ui'
        ctx.fillText(
          `使用: ${latest.usedMemory.toFixed(1)}MB`,
          margin.left + 10,
          margin.top + 20
        )
        
        ctx.fillStyle = '#3b82f6'
        ctx.fillText(
          `総計: ${latest.totalMemory.toFixed(1)}MB`,
          margin.left + 10,
          margin.top + 40
        )
      }
    }

    // 境界線の描画
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 1
    ctx.strokeRect(margin.left, margin.top, chartWidth, chartHeight)

  }, [memoryHistory, width, height, showGrid, showLabels])

  const currentStats = memoryHistory.length > 0 ? memoryHistory[memoryHistory.length - 1] : null

  return (
    <div className={`bg-white border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">メモリ使用量推移</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>使用メモリ</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 border-2 border-blue-500 border-dashed rounded"></div>
            <span>総メモリ</span>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="border border-gray-200 rounded"
      />

      {currentStats && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-gray-600">使用メモリ</div>
            <div className="text-lg font-bold text-red-600">
              {currentStats.usedMemory.toFixed(1)} MB
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-600">空きメモリ</div>
            <div className="text-lg font-bold text-green-600">
              {currentStats.freeMemory.toFixed(1)} MB
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-600">使用率</div>
            <div className="text-lg font-bold text-blue-600">
              {((currentStats.usedMemory / currentStats.totalMemory) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500 text-center">
        直近 {memoryHistory.length} データポイント（{updateInterval}ms間隔）
      </div>
    </div>
  )
}

export default MemoryUsageChart