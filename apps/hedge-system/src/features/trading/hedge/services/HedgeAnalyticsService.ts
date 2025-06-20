import { HedgePosition, RiskMetrics } from '../types'
import { Position } from '../../close/types'

export interface AdvancedHedgeStatistics {
  totalHedges: number
  activeHedges: number
  completedHedges: number
  perfectHedges: number
  partialHedges: number
  crossAccountHedges: number
  averageBalance: number
  totalProfit: number
  winRate: number
  avgHoldingTime: number // 時間単位
  profitability: number // 収益性指標
}

export interface HedgePerformanceMetrics {
  totalReturn: number
  averageReturn: number
  medianReturn: number
  bestReturn: number
  worstReturn: number
  volatility: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  maxDrawdownDuration: number // 時間単位
  profitFactor: number
  calmarRatio: number
  recoveryFactor: number
  expectedValue: number
}

export interface HedgeRiskAnalysis {
  totalExposure: number
  netExposure: number
  maxPositionSize: number
  averagePositionSize: number
  positionSizeStdDev: number
  diversificationRatio: number
  concentrationRisk: number
  correlationRisk: number
  liquidityRisk: number
  leverageRatio: number
  marginUtilization: number
}

export interface SymbolAnalysis {
  symbol: string
  totalPositions: number
  totalLots: number
  netLots: number
  totalProfit: number
  winRate: number
  averageProfit: number
  maxProfit: number
  minProfit: number
  volatility: number
  sharpeRatio: number
  isBalanced: boolean
  balanceRatio: number
  riskLevel: 'low' | 'medium' | 'high'
  exposurePercentage: number
}

export interface TimeSeriesAnalytics {
  timestamp: Date
  totalProfit: number
  cumulativeProfit: number
  drawdown: number
  runningBalance: number
  hedgeCount: number
  activeHedgeCount: number
  riskScore: number
  exposureLevel: number
  balanceRatio: number
}

export interface HedgeCorrelation {
  symbol1: string
  symbol2: string
  correlation: number
  significance: number
}

export interface HedgeSeasonality {
  hour: number
  dayOfWeek: number
  month: number
  avgProfit: number
  tradeCount: number
  winRate: number
}

export class HedgeAnalyticsService {
  private hedgePositions: HedgePosition[]
  private positions: Position[]
  private cacheKey: string | null = null
  private cachedAnalytics: any = null

  constructor(hedgePositions: HedgePosition[], positions: Position[] = []) {
    this.hedgePositions = hedgePositions
    this.positions = positions
  }

  /**
   * 基本統計の計算
   */
  calculateBasicStatistics(timeWindowHours: number = 24): AdvancedHedgeStatistics {
    const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000)
    const filteredHedges = this.hedgePositions.filter(h => h.createdAt >= cutoffTime)

    // 保有時間の計算
    const holdingTimes = filteredHedges.map(hedge => {
      const endTime = hedge.lastRebalanced || new Date()
      return (endTime.getTime() - hedge.createdAt.getTime()) / (1000 * 60 * 60) // 時間単位
    })

    const avgHoldingTime = holdingTimes.length > 0 
      ? holdingTimes.reduce((sum, time) => sum + time, 0) / holdingTimes.length 
      : 0

    // 収益性指標
    const totalInvestment = filteredHedges.reduce((sum, h) => 
      sum + (h.totalLots.buy + h.totalLots.sell) * 100000, 0
    )
    const profitability = totalInvestment > 0 
      ? (filteredHedges.reduce((sum, h) => sum + h.totalProfit, 0) / totalInvestment) * 100 
      : 0

    return {
      totalHedges: filteredHedges.length,
      activeHedges: filteredHedges.filter(h => h.isBalanced).length,
      completedHedges: filteredHedges.filter(h => !h.isBalanced).length,
      perfectHedges: filteredHedges.filter(h => h.hedgeType === 'perfect').length,
      partialHedges: filteredHedges.filter(h => h.hedgeType === 'partial').length,
      crossAccountHedges: filteredHedges.filter(h => h.hedgeType === 'cross_account').length,
      averageBalance: filteredHedges.length > 0 
        ? filteredHedges.reduce((sum, h) => sum + Math.abs(h.totalLots.buy - h.totalLots.sell), 0) / filteredHedges.length
        : 0,
      totalProfit: filteredHedges.reduce((sum, h) => sum + h.totalProfit, 0),
      winRate: filteredHedges.length > 0
        ? (filteredHedges.filter(h => h.totalProfit > 0).length / filteredHedges.length) * 100
        : 0,
      avgHoldingTime,
      profitability
    }
  }

  /**
   * パフォーマンスメトリクスの計算
   */
  calculatePerformanceMetrics(timeWindowHours: number = 24): HedgePerformanceMetrics {
    const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000)
    const filteredHedges = this.hedgePositions.filter(h => h.createdAt >= cutoffTime)
    
    const profits = filteredHedges.map(h => h.totalProfit).filter(p => p !== 0)
    const returns = profits // 簡易的にprofitをreturnとして扱う

    if (profits.length === 0) {
      return this.getEmptyPerformanceMetrics()
    }

    // 基本統計
    const totalReturn = profits.reduce((sum, p) => sum + p, 0)
    const averageReturn = totalReturn / profits.length
    const sortedProfits = [...profits].sort((a, b) => a - b)
    const medianReturn = this.calculateMedian(sortedProfits)
    const bestReturn = Math.max(...profits)
    const worstReturn = Math.min(...profits)

    // ボラティリティ
    const volatility = this.calculateVolatility(returns)

    // シャープレシオ（リスクフリーレートを0として計算）
    const sharpeRatio = volatility > 0 ? averageReturn / volatility : 0

    // ソルティーノレシオ
    const downside = returns.filter(r => r < 0)
    const downsideVolatility = downside.length > 1 ? this.calculateVolatility(downside) : 0
    const sortinoRatio = downsideVolatility > 0 ? averageReturn / downsideVolatility : 0

    // ドローダウン計算
    const { maxDrawdown, maxDrawdownDuration } = this.calculateDrawdowns(
      this.generateCumulativeReturns(filteredHedges)
    )

    // プロフィットファクター
    const profitFactor = this.calculateProfitFactor(profits)

    // その他の高度なメトリクス
    const calmarRatio = maxDrawdown > 0 ? (totalReturn / maxDrawdown) : 0
    const recoveryFactor = maxDrawdown > 0 ? totalReturn / Math.abs(maxDrawdown) : 0

    return {
      totalReturn,
      averageReturn,
      medianReturn,
      bestReturn,
      worstReturn,
      volatility,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      maxDrawdownDuration,
      profitFactor,
      calmarRatio,
      recoveryFactor,
      expectedValue: averageReturn
    }
  }

  /**
   * リスク分析の計算
   */
  calculateRiskAnalysis(): HedgeRiskAnalysis {
    const totalExposure = this.hedgePositions.reduce((sum, h) => 
      sum + (h.totalLots.buy + h.totalLots.sell) * 100000, 0
    )

    const netExposure = this.hedgePositions.reduce((sum, h) => 
      sum + Math.abs(h.totalLots.buy - h.totalLots.sell) * 100000, 0
    )

    const positionSizes = this.hedgePositions.map(h => h.totalLots.buy + h.totalLots.sell)
    const maxPositionSize = Math.max(...positionSizes, 0)
    const averagePositionSize = positionSizes.length > 0 
      ? positionSizes.reduce((sum, size) => sum + size, 0) / positionSizes.length 
      : 0

    const positionSizeStdDev = this.calculateStandardDeviation(positionSizes)

    // 多様化比率
    const symbols = new Set(this.hedgePositions.map(h => h.symbol))
    const diversificationRatio = symbols.size / Math.max(this.hedgePositions.length, 1)

    // 集中リスク（ハーフィンダール指数）
    const symbolWeights = this.calculateSymbolWeights()
    const concentrationRisk = symbolWeights.reduce((sum, weight) => sum + weight * weight, 0)

    // 相関リスク（簡易計算）
    const correlationRisk = this.estimateCorrelationRisk()

    return {
      totalExposure,
      netExposure,
      maxPositionSize,
      averagePositionSize,
      positionSizeStdDev,
      diversificationRatio,
      concentrationRisk,
      correlationRisk,
      liquidityRisk: 0.3, // 簡易値
      leverageRatio: totalExposure / Math.max(netExposure, 1),
      marginUtilization: 0.5 // 簡易値
    }
  }

  /**
   * 通貨ペア別分析
   */
  calculateSymbolAnalysis(): SymbolAnalysis[] {
    const symbolMap = new Map<string, HedgePosition[]>()
    
    // 通貨ペア別にグループ化
    this.hedgePositions.forEach(hedge => {
      if (!symbolMap.has(hedge.symbol)) {
        symbolMap.set(hedge.symbol, [])
      }
      symbolMap.get(hedge.symbol)!.push(hedge)
    })

    const totalExposure = this.hedgePositions.reduce((sum, h) => 
      sum + (h.totalLots.buy + h.totalLots.sell) * 100000, 0
    )

    return Array.from(symbolMap.entries()).map(([symbol, hedges]) => {
      const profits = hedges.map(h => h.totalProfit)
      const totalLots = hedges.reduce((sum, h) => sum + h.totalLots.buy + h.totalLots.sell, 0)
      const netLots = hedges.reduce((sum, h) => sum + h.totalLots.buy - h.totalLots.sell, 0)
      const totalProfit = profits.reduce((sum, p) => sum + p, 0)
      const exposure = totalLots * 100000

      // バランス状況
      const buyLots = hedges.reduce((sum, h) => sum + h.totalLots.buy, 0)
      const sellLots = hedges.reduce((sum, h) => sum + h.totalLots.sell, 0)
      const balanceRatio = Math.min(buyLots, sellLots) / Math.max(buyLots, sellLots, 0.001)
      const isBalanced = balanceRatio > 0.9

      // リスクレベル判定
      const exposurePercentage = (exposure / Math.max(totalExposure, 1)) * 100
      let riskLevel: 'low' | 'medium' | 'high' = 'low'
      if (exposurePercentage > 30) riskLevel = 'high'
      else if (exposurePercentage > 15) riskLevel = 'medium'

      return {
        symbol,
        totalPositions: hedges.length,
        totalLots,
        netLots,
        totalProfit,
        winRate: hedges.length > 0 ? (profits.filter(p => p > 0).length / hedges.length) * 100 : 0,
        averageProfit: profits.length > 0 ? totalProfit / profits.length : 0,
        maxProfit: profits.length > 0 ? Math.max(...profits) : 0,
        minProfit: profits.length > 0 ? Math.min(...profits) : 0,
        volatility: this.calculateVolatility(profits),
        sharpeRatio: 0, // 簡易実装では0
        isBalanced,
        balanceRatio,
        riskLevel,
        exposurePercentage
      }
    })
  }

  /**
   * 時系列分析データの生成
   */
  generateTimeSeriesAnalytics(
    timeWindowHours: number = 24, 
    dataPoints: number = 20
  ): TimeSeriesAnalytics[] {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - timeWindowHours * 60 * 60 * 1000)
    const stepSize = (timeWindowHours * 60 * 60 * 1000) / dataPoints

    const timeSeriesData: TimeSeriesAnalytics[] = []
    let cumulativeProfit = 0
    let maxCumulativeProfit = 0

    for (let i = 0; i < dataPoints; i++) {
      const timestamp = new Date(startTime.getTime() + i * stepSize)
      const relevantHedges = this.hedgePositions.filter(h => h.createdAt <= timestamp)
      
      const currentProfit = relevantHedges.reduce((sum, h) => sum + h.totalProfit, 0)
      cumulativeProfit = currentProfit
      maxCumulativeProfit = Math.max(maxCumulativeProfit, cumulativeProfit)
      
      const drawdown = maxCumulativeProfit > 0 
        ? (maxCumulativeProfit - cumulativeProfit) / maxCumulativeProfit * 100 
        : 0

      const totalLots = relevantHedges.reduce((sum, h) => 
        sum + h.totalLots.buy + h.totalLots.sell, 0
      )
      const balancedLots = relevantHedges.reduce((sum, h) => 
        sum + Math.min(h.totalLots.buy, h.totalLots.sell), 0
      )
      const balanceRatio = totalLots > 0 ? (balancedLots * 2) / totalLots : 0

      timeSeriesData.push({
        timestamp,
        totalProfit: currentProfit,
        cumulativeProfit,
        drawdown,
        runningBalance: balanceRatio,
        hedgeCount: relevantHedges.length,
        activeHedgeCount: relevantHedges.filter(h => h.isBalanced).length,
        riskScore: this.calculateRiskScore(relevantHedges),
        exposureLevel: totalLots * 100000,
        balanceRatio
      })
    }

    return timeSeriesData
  }

  // プライベートヘルパーメソッド

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1)
    return Math.sqrt(variance)
  }

  private calculateStandardDeviation(values: number[]): number {
    return this.calculateVolatility(values)
  }

  private calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2)
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid]
  }

  private calculateProfitFactor(profits: number[]): number {
    const wins = profits.filter(p => p > 0)
    const losses = profits.filter(p => p < 0)
    
    if (losses.length === 0) return wins.length > 0 ? Infinity : 0
    
    const totalWins = wins.reduce((sum, p) => sum + p, 0)
    const totalLosses = Math.abs(losses.reduce((sum, p) => sum + p, 0))
    
    return totalLosses > 0 ? totalWins / totalLosses : 0
  }

  private generateCumulativeReturns(hedges: HedgePosition[]): number[] {
    const sortedHedges = [...hedges].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const cumulative: number[] = []
    let sum = 0
    
    sortedHedges.forEach(hedge => {
      sum += hedge.totalProfit
      cumulative.push(sum)
    })
    
    return cumulative
  }

  private calculateDrawdowns(cumulativeReturns: number[]): { 
    maxDrawdown: number, 
    maxDrawdownDuration: number 
  } {
    let maxDrawdown = 0
    let maxDrawdownDuration = 0
    let peak = cumulativeReturns[0] || 0
    let drawdownStart = 0
    let currentDrawdownDuration = 0

    cumulativeReturns.forEach((value, index) => {
      if (value > peak) {
        peak = value
        if (currentDrawdownDuration > maxDrawdownDuration) {
          maxDrawdownDuration = currentDrawdownDuration
        }
        currentDrawdownDuration = 0
        drawdownStart = index
      } else {
        const drawdown = (peak - value) / Math.max(peak, 1) * 100
        maxDrawdown = Math.max(maxDrawdown, drawdown)
        currentDrawdownDuration = index - drawdownStart
      }
    })

    return { maxDrawdown, maxDrawdownDuration: currentDrawdownDuration }
  }

  private calculateSymbolWeights(): number[] {
    const totalExposure = this.hedgePositions.reduce((sum, h) => 
      sum + (h.totalLots.buy + h.totalLots.sell) * 100000, 0
    )

    const symbolExposures = new Map<string, number>()
    
    this.hedgePositions.forEach(hedge => {
      const exposure = (hedge.totalLots.buy + hedge.totalLots.sell) * 100000
      symbolExposures.set(
        hedge.symbol, 
        (symbolExposures.get(hedge.symbol) || 0) + exposure
      )
    })

    return Array.from(symbolExposures.values()).map(exposure => 
      exposure / Math.max(totalExposure, 1)
    )
  }

  private estimateCorrelationRisk(): number {
    // 簡易的な相関リスク計算（実際の実装では価格データが必要）
    const symbols = new Set(this.hedgePositions.map(h => h.symbol))
    const uniqueSymbols = Array.from(symbols)
    
    // 通貨ペアの共通通貨による相関を簡易推定
    let correlatedPairs = 0
    for (let i = 0; i < uniqueSymbols.length; i++) {
      for (let j = i + 1; j < uniqueSymbols.length; j++) {
        const symbol1 = uniqueSymbols[i]
        const symbol2 = uniqueSymbols[j]
        
        // 共通通貨があるかチェック（例：EURUSD と EURGBP）
        if (this.hasCommonCurrency(symbol1, symbol2)) {
          correlatedPairs++
        }
      }
    }
    
    const totalPairs = (uniqueSymbols.length * (uniqueSymbols.length - 1)) / 2
    return totalPairs > 0 ? correlatedPairs / totalPairs : 0
  }

  private hasCommonCurrency(symbol1: string, symbol2: string): boolean {
    if (symbol1.length !== 6 || symbol2.length !== 6) return false
    
    const base1 = symbol1.substring(0, 3)
    const quote1 = symbol1.substring(3, 6)
    const base2 = symbol2.substring(0, 3)
    const quote2 = symbol2.substring(3, 6)
    
    return base1 === base2 || base1 === quote2 || quote1 === base2 || quote1 === quote2
  }

  private calculateRiskScore(hedges: HedgePosition[]): number {
    const totalLots = hedges.reduce((sum, h) => sum + h.totalLots.buy + h.totalLots.sell, 0)
    const imbalancedHedges = hedges.filter(h => !h.isBalanced).length
    const totalHedges = hedges.length
    
    const lotScore = Math.min(totalLots / 10, 10) // 0-10スケール
    const balanceScore = totalHedges > 0 ? (imbalancedHedges / totalHedges) * 10 : 0
    
    return Math.min(lotScore + balanceScore, 10)
  }

  private getEmptyPerformanceMetrics(): HedgePerformanceMetrics {
    return {
      totalReturn: 0,
      averageReturn: 0,
      medianReturn: 0,
      bestReturn: 0,
      worstReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      profitFactor: 0,
      calmarRatio: 0,
      recoveryFactor: 0,
      expectedValue: 0
    }
  }
}

export default HedgeAnalyticsService