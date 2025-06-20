'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { HedgePosition, HedgeBalance, RiskMetrics } from '../types'
import { Position } from '../../close/types'

export interface TimeRange {
  label: string
  value: '1h' | '4h' | '24h' | '7d' | '30d'
  hours: number
}

export interface AnalyticsData {
  hedgePositions: HedgePosition[]
  statistics: HedgeStatistics
  performance: HedgePerformance
  riskMetrics: RiskMetrics
  timeSeriesData: TimeSeriesDataPoint[]
}

export interface HedgeStatistics {
  totalHedges: number
  activeHedges: number
  perfectHedges: number
  partialHedges: number
  crossAccountHedges: number
  averageBalance: number
  totalProfit: number
  winRate: number
}

export interface HedgePerformance {
  totalReturn: number
  averageReturn: number
  bestReturn: number
  worstReturn: number
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  profitFactor: number
}

export interface TimeSeriesDataPoint {
  timestamp: Date
  totalProfit: number
  totalBalance: number
  hedgeCount: number
  riskScore: number
}

export interface HedgeAnalyticsProps {
  hedgePositions: HedgePosition[]
  positions: Position[]
  timeRange: TimeRange
  onExportData: (data: AnalyticsData) => void
  className?: string
}

const TIME_RANGES: TimeRange[] = [
  { label: '1時間', value: '1h', hours: 1 },
  { label: '4時間', value: '4h', hours: 4 },
  { label: '24時間', value: '24h', hours: 24 },
  { label: '7日間', value: '7d', hours: 168 },
  { label: '30日間', value: '30d', hours: 720 }
]

export const HedgeAnalytics: React.FC<HedgeAnalyticsProps> = ({
  hedgePositions,
  positions,
  timeRange,
  onExportData,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'risk' | 'balance'>('overview')
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(timeRange)
  const chartCanvasRef = useRef<HTMLCanvasElement>(null)

  // 統計計算
  const analytics = useMemo(() => {
    const cutoffTime = new Date(Date.now() - selectedTimeRange.hours * 60 * 60 * 1000)
    
    // 期間内のヘッジポジションをフィルタ
    const filteredHedges = hedgePositions.filter(hedge => 
      hedge.createdAt >= cutoffTime
    )

    // 基本統計
    const statistics: HedgeStatistics = {
      totalHedges: filteredHedges.length,
      activeHedges: filteredHedges.filter(h => h.isBalanced).length,
      perfectHedges: filteredHedges.filter(h => h.hedgeType === 'perfect').length,
      partialHedges: filteredHedges.filter(h => h.hedgeType === 'partial').length,
      crossAccountHedges: filteredHedges.filter(h => h.hedgeType === 'cross_account').length,
      averageBalance: filteredHedges.length > 0 
        ? filteredHedges.reduce((sum, h) => sum + Math.abs(h.totalLots.buy - h.totalLots.sell), 0) / filteredHedges.length
        : 0,
      totalProfit: filteredHedges.reduce((sum, h) => sum + h.totalProfit, 0),
      winRate: filteredHedges.length > 0
        ? (filteredHedges.filter(h => h.totalProfit > 0).length / filteredHedges.length) * 100
        : 0
    }

    // パフォーマンス計算
    const profits = filteredHedges.map(h => h.totalProfit).filter(p => p !== 0)
    const performance: HedgePerformance = {
      totalReturn: statistics.totalProfit,
      averageReturn: profits.length > 0 ? profits.reduce((sum, p) => sum + p, 0) / profits.length : 0,
      bestReturn: profits.length > 0 ? Math.max(...profits) : 0,
      worstReturn: profits.length > 0 ? Math.min(...profits) : 0,
      volatility: profits.length > 1 ? calculateVolatility(profits) : 0,
      sharpeRatio: 0, // 簡易実装では0
      maxDrawdown: 0, // 簡易実装では0
      profitFactor: calculateProfitFactor(profits)
    }

    // 時系列データ生成（デモデータ）
    const timeSeriesData: TimeSeriesDataPoint[] = generateTimeSeriesData(
      filteredHedges, 
      selectedTimeRange
    )

    // リスクメトリクス
    const riskMetrics: RiskMetrics = {
      totalExposure: filteredHedges.reduce((sum, h) => 
        sum + (h.totalLots.buy + h.totalLots.sell) * 100000, 0
      ),
      netExposure: filteredHedges.reduce((sum, h) => 
        sum + Math.abs(h.totalLots.buy - h.totalLots.sell) * 100000, 0
      ),
      maxPositionSize: Math.max(...filteredHedges.map(h => 
        Math.max(h.totalLots.buy, h.totalLots.sell)
      ), 0),
      diversificationRatio: calculateDiversificationRatio(filteredHedges),
      correlationRisk: 0.5 // 簡易実装
    }

    return {
      hedgePositions: filteredHedges,
      statistics,
      performance,
      riskMetrics,
      timeSeriesData
    }
  }, [hedgePositions, selectedTimeRange])

  // チャート描画
  useEffect(() => {
    const canvas = chartCanvasRef.current
    if (!canvas || analytics.timeSeriesData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    drawChart(ctx, analytics.timeSeriesData, canvas.width, canvas.height)
  }, [analytics.timeSeriesData])

  const handleExportData = () => {
    onExportData(analytics)
  }

  const formatNumber = (num: number, decimals: number = 2): string => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'USD'
    }).format(num)
  }

  const tabs = [
    { id: 'overview', label: '概要', icon: '📊' },
    { id: 'performance', label: 'パフォーマンス', icon: '📈' },
    { id: 'risk', label: 'リスク', icon: '⚠️' },
    { id: 'balance', label: 'バランス', icon: '⚖️' }
  ]

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* ヘッダー */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">両建て分析・統計</h3>
          <div className="flex items-center space-x-2">
            <select
              value={selectedTimeRange.value}
              onChange={(e) => {
                const range = TIME_RANGES.find(r => r.value === e.target.value)
                if (range) setSelectedTimeRange(range)
              }}
              className="border rounded px-3 py-1 text-sm"
            >
              {TIME_RANGES.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleExportData}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              エクスポート
            </button>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="border-b">
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* コンテンツ */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <OverviewTab
            statistics={analytics.statistics}
            performance={analytics.performance}
            formatNumber={formatNumber}
            formatCurrency={formatCurrency}
          />
        )}

        {activeTab === 'performance' && (
          <PerformanceTab
            performance={analytics.performance}
            timeSeriesData={analytics.timeSeriesData}
            chartCanvasRef={chartCanvasRef}
            formatNumber={formatNumber}
            formatCurrency={formatCurrency}
          />
        )}

        {activeTab === 'risk' && (
          <RiskTab
            riskMetrics={analytics.riskMetrics}
            hedgePositions={analytics.hedgePositions}
            formatNumber={formatNumber}
            formatCurrency={formatCurrency}
          />
        )}

        {activeTab === 'balance' && (
          <BalanceTab
            hedgePositions={analytics.hedgePositions}
            formatNumber={formatNumber}
          />
        )}
      </div>
    </div>
  )
}

// 概要タブ
interface OverviewTabProps {
  statistics: HedgeStatistics
  performance: HedgePerformance
  formatNumber: (num: number, decimals?: number) => string
  formatCurrency: (num: number) => string
}

function OverviewTab({ statistics, performance, formatNumber, formatCurrency }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* キーメトリクス */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 mb-1">総両建て数</div>
          <div className="text-2xl font-bold text-blue-800">
            {statistics.totalHedges}
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 mb-1">アクティブ</div>
          <div className="text-2xl font-bold text-green-800">
            {statistics.activeHedges}
          </div>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-orange-600 mb-1">総損益</div>
          <div className="text-2xl font-bold text-orange-800">
            {formatCurrency(statistics.totalProfit)}
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 mb-1">勝率</div>
          <div className="text-2xl font-bold text-purple-800">
            {formatNumber(statistics.winRate, 1)}%
          </div>
        </div>
      </div>

      {/* 両建てタイプ別分析 */}
      <div>
        <h4 className="font-medium mb-3">両建てタイプ別分析</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">完全両建て</span>
              <span className="text-2xl font-bold text-green-600">
                {statistics.perfectHedges}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              リスクが完全にヘッジされた両建て
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">部分両建て</span>
              <span className="text-2xl font-bold text-orange-600">
                {statistics.partialHedges}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              一部リスクが残る両建て
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">クロスアカウント</span>
              <span className="text-2xl font-bold text-blue-600">
                {statistics.crossAccountHedges}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              複数口座間での両建て
            </div>
          </div>
        </div>
      </div>

      {/* パフォーマンスサマリー */}
      <div>
        <h4 className="font-medium mb-3">パフォーマンスサマリー</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600 mb-1">平均リターン</div>
            <div className="text-lg font-bold">
              {formatCurrency(performance.averageReturn)}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600 mb-1">最高リターン</div>
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(performance.bestReturn)}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600 mb-1">最低リターン</div>
            <div className="text-lg font-bold text-red-600">
              {formatCurrency(performance.worstReturn)}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600 mb-1">プロフィットファクター</div>
            <div className="text-lg font-bold">
              {formatNumber(performance.profitFactor, 2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// パフォーマンスタブ
interface PerformanceTabProps {
  performance: HedgePerformance
  timeSeriesData: TimeSeriesDataPoint[]
  chartCanvasRef: React.RefObject<HTMLCanvasElement>
  formatNumber: (num: number, decimals?: number) => string
  formatCurrency: (num: number) => string
}

function PerformanceTab({ 
  performance, 
  timeSeriesData, 
  chartCanvasRef, 
  formatNumber, 
  formatCurrency 
}: PerformanceTabProps) {
  return (
    <div className="space-y-6">
      {/* チャート */}
      <div>
        <h4 className="font-medium mb-3">損益推移</h4>
        <div className="border rounded p-4">
          <canvas
            ref={chartCanvasRef}
            width={800}
            height={300}
            className="w-full h-auto border border-gray-200 rounded"
          />
        </div>
      </div>

      {/* 詳細メトリクス */}
      <div>
        <h4 className="font-medium mb-3">詳細パフォーマンス</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span>総リターン:</span>
              <span className="font-bold">{formatCurrency(performance.totalReturn)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span>平均リターン:</span>
              <span className="font-bold">{formatCurrency(performance.averageReturn)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span>ボラティリティ:</span>
              <span className="font-bold">{formatNumber(performance.volatility, 2)}%</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span>シャープレシオ:</span>
              <span className="font-bold">{formatNumber(performance.sharpeRatio, 2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span>最大ドローダウン:</span>
              <span className="font-bold text-red-600">{formatNumber(performance.maxDrawdown, 2)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span>プロフィットファクター:</span>
              <span className="font-bold">{formatNumber(performance.profitFactor, 2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// リスクタブ
interface RiskTabProps {
  riskMetrics: RiskMetrics
  hedgePositions: HedgePosition[]
  formatNumber: (num: number, decimals?: number) => string
  formatCurrency: (num: number) => string
}

function RiskTab({ riskMetrics, hedgePositions, formatNumber, formatCurrency }: RiskTabProps) {
  return (
    <div className="space-y-6">
      {/* リスクメトリクス */}
      <div>
        <h4 className="font-medium mb-3">リスクメトリクス</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm text-red-600 mb-1">総エクスポージャー</div>
            <div className="text-xl font-bold text-red-800">
              {formatCurrency(riskMetrics.totalExposure)}
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-sm text-orange-600 mb-1">ネットエクスポージャー</div>
            <div className="text-xl font-bold text-orange-800">
              {formatCurrency(riskMetrics.netExposure)}
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm text-yellow-600 mb-1">最大ポジションサイズ</div>
            <div className="text-xl font-bold text-yellow-800">
              {formatNumber(riskMetrics.maxPositionSize, 2)}
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 mb-1">分散化比率</div>
            <div className="text-xl font-bold text-blue-800">
              {formatNumber(riskMetrics.diversificationRatio, 2)}
            </div>
          </div>
        </div>
      </div>

      {/* 通貨ペア別リスク */}
      <div>
        <h4 className="font-medium mb-3">通貨ペア別リスク分析</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">通貨ペア</th>
                <th className="text-right p-3">ポジション数</th>
                <th className="text-right p-3">総ロット</th>
                <th className="text-right p-3">バランス状況</th>
                <th className="text-right p-3">リスクレベル</th>
              </tr>
            </thead>
            <tbody>
              {getSymbolRiskAnalysis(hedgePositions).map((item, index) => (
                <tr key={index} className="border-b">
                  <td className="p-3 font-medium">{item.symbol}</td>
                  <td className="p-3 text-right">{item.positionCount}</td>
                  <td className="p-3 text-right">{formatNumber(item.totalLots, 2)}</td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {item.isBalanced ? 'バランス' : 'アンバランス'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                      item.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.riskLevel === 'low' ? '低' : 
                       item.riskLevel === 'medium' ? '中' : '高'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// バランスタブ
interface BalanceTabProps {
  hedgePositions: HedgePosition[]
  formatNumber: (num: number, decimals?: number) => string
}

function BalanceTab({ hedgePositions, formatNumber }: BalanceTabProps) {
  return (
    <div className="space-y-6">
      {/* バランス状況 */}
      <div>
        <h4 className="font-medium mb-3">バランス状況</h4>
        <div className="space-y-3">
          {hedgePositions.map((hedge) => (
            <div key={hedge.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-medium">{hedge.symbol}</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    hedge.isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {hedge.isBalanced ? 'バランス' : 'アンバランス'}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {hedge.hedgeType}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">買いロット</div>
                  <div className="text-lg font-bold text-blue-600">
                    {formatNumber(hedge.totalLots.buy, 2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">売りロット</div>
                  <div className="text-lg font-bold text-red-600">
                    {formatNumber(hedge.totalLots.sell, 2)}
                  </div>
                </div>
              </div>
              
              <div className="mt-3">
                <div className="text-sm text-gray-600 mb-1">バランス差</div>
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className={`h-2 rounded-full ${
                        Math.abs(hedge.totalLots.buy - hedge.totalLots.sell) < 0.1 
                          ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ 
                        width: `${Math.min(Math.abs(hedge.totalLots.buy - hedge.totalLots.sell) * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {formatNumber(Math.abs(hedge.totalLots.buy - hedge.totalLots.sell), 2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ユーティリティ関数
function calculateVolatility(profits: number[]): number {
  if (profits.length < 2) return 0
  const mean = profits.reduce((sum, p) => sum + p, 0) / profits.length
  const variance = profits.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / (profits.length - 1)
  return Math.sqrt(variance)
}

function calculateProfitFactor(profits: number[]): number {
  const wins = profits.filter(p => p > 0)
  const losses = profits.filter(p => p < 0)
  
  if (losses.length === 0) return wins.length > 0 ? Infinity : 0
  
  const totalWins = wins.reduce((sum, p) => sum + p, 0)
  const totalLosses = Math.abs(losses.reduce((sum, p) => sum + p, 0))
  
  return totalLosses > 0 ? totalWins / totalLosses : 0
}

function calculateDiversificationRatio(hedges: HedgePosition[]): number {
  const symbols = new Set(hedges.map(h => h.symbol))
  return symbols.size / Math.max(hedges.length, 1)
}

function generateTimeSeriesData(hedges: HedgePosition[], timeRange: TimeRange): TimeSeriesDataPoint[] {
  const points: TimeSeriesDataPoint[] = []
  const now = new Date()
  const stepSize = timeRange.hours * 60 * 60 * 1000 / 20 // 20ポイント
  
  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(now.getTime() - (19 - i) * stepSize)
    const relevantHedges = hedges.filter(h => h.createdAt <= timestamp)
    
    points.push({
      timestamp,
      totalProfit: relevantHedges.reduce((sum, h) => sum + h.totalProfit, 0),
      totalBalance: relevantHedges.reduce((sum, h) => 
        sum + Math.abs(h.totalLots.buy - h.totalLots.sell), 0
      ),
      hedgeCount: relevantHedges.length,
      riskScore: relevantHedges.length * 10 // 簡易計算
    })
  }
  
  return points
}

function getSymbolRiskAnalysis(hedges: HedgePosition[]) {
  const symbolMap = new Map<string, {
    symbol: string
    positionCount: number
    totalLots: number
    isBalanced: boolean
    riskLevel: 'low' | 'medium' | 'high'
  }>()
  
  hedges.forEach(hedge => {
    const existing = symbolMap.get(hedge.symbol) || {
      symbol: hedge.symbol,
      positionCount: 0,
      totalLots: 0,
      isBalanced: true,
      riskLevel: 'low' as const
    }
    
    existing.positionCount++
    existing.totalLots += hedge.totalLots.buy + hedge.totalLots.sell
    existing.isBalanced = existing.isBalanced && hedge.isBalanced
    
    // リスクレベルの計算
    if (existing.totalLots > 10) {
      existing.riskLevel = 'high'
    } else if (existing.totalLots > 5) {
      existing.riskLevel = 'medium'
    }
    
    symbolMap.set(hedge.symbol, existing)
  })
  
  return Array.from(symbolMap.values())
}

function drawChart(
  ctx: CanvasRenderingContext2D, 
  data: TimeSeriesDataPoint[], 
  width: number, 
  height: number
) {
  // 背景をクリア
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  
  if (data.length === 0) return
  
  // マージン
  const margin = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom
  
  // データの範囲
  const profits = data.map(d => d.totalProfit)
  const minProfit = Math.min(...profits)
  const maxProfit = Math.max(...profits)
  const profitRange = maxProfit - minProfit || 1
  
  // スケール関数
  const xScale = (index: number) => 
    margin.left + (index / (data.length - 1)) * chartWidth
  const yScale = (value: number) => 
    margin.top + ((maxProfit - value) / profitRange) * chartHeight
  
  // グリッド描画
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
  for (let i = 0; i <= 5; i++) {
    const x = margin.left + (i / 5) * chartWidth
    ctx.beginPath()
    ctx.moveTo(x, margin.top)
    ctx.lineTo(x, margin.top + chartHeight)
    ctx.stroke()
  }
  
  // 損益ライン
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.beginPath()
  data.forEach((point, index) => {
    const x = xScale(index)
    const y = yScale(point.totalProfit)
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.stroke()
  
  // データポイント
  ctx.fillStyle = '#3b82f6'
  data.forEach((point, index) => {
    const x = xScale(index)
    const y = yScale(point.totalProfit)
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, 2 * Math.PI)
    ctx.fill()
  })
  
  // 軸ラベル
  ctx.fillStyle = '#374151'
  ctx.font = '12px system-ui'
  
  // Y軸ラベル
  for (let i = 0; i <= 5; i++) {
    const value = maxProfit - (i / 5) * profitRange
    const y = margin.top + (i / 5) * chartHeight
    ctx.fillText(`$${value.toFixed(0)}`, 5, y + 4)
  }
  
  // 枠線
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1
  ctx.strokeRect(margin.left, margin.top, chartWidth, chartHeight)
}

export default HedgeAnalytics