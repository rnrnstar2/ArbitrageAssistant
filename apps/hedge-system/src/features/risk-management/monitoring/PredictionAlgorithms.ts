/**
 * 高度な予測アルゴリズム
 * 複数の数学的手法を組み合わせてロスカット予測の精度を向上
 */

import { MarginLevelHistory, TrendAnalysis } from '../types/prediction-types'

export interface PredictionPoint {
  timestamp: Date
  value: number
  confidence: number
}

export interface AlgorithmResult {
  prediction: number
  confidence: number
  method: string
}

export class PredictionAlgorithms {
  /**
   * 移動平均による予測
   */
  static movingAveragePrediction(
    history: MarginLevelHistory[],
    windowSize: number = 5,
    minutesAhead: number = 30
  ): AlgorithmResult {
    if (history.length < windowSize) {
      return { prediction: 0, confidence: 0, method: 'moving_average' }
    }

    const recentData = history.slice(-windowSize)
    const average = recentData.reduce((sum, h) => sum + h.marginLevel, 0) / windowSize
    
    // トレンドを計算
    const trend = this.calculateSimpleTrend(recentData)
    const prediction = average + (trend * minutesAhead)
    
    // 信頼度はデータ点数とトレンドの一貫性から
    const confidence = Math.min(1, windowSize / 10) * (1 - Math.abs(trend) / 10)

    return { prediction, confidence, method: 'moving_average' }
  }

  /**
   * 指数移動平均による予測
   */
  static exponentialMovingAveragePrediction(
    history: MarginLevelHistory[],
    alpha: number = 0.3,
    minutesAhead: number = 30
  ): AlgorithmResult {
    if (history.length < 2) {
      return { prediction: 0, confidence: 0, method: 'exponential_moving_average' }
    }

    let ema = history[0].marginLevel
    const emaHistory: number[] = [ema]

    // EMA計算
    for (let i = 1; i < history.length; i++) {
      ema = alpha * history[i].marginLevel + (1 - alpha) * ema
      emaHistory.push(ema)
    }

    // EMAのトレンドから予測
    const emaTrend = this.calculateTrendFromArray(emaHistory)
    const prediction = ema + (emaTrend * minutesAhead)
    
    const confidence = Math.min(1, history.length / 15) * 0.8

    return { prediction, confidence, method: 'exponential_moving_average' }
  }

  /**
   * 線形回帰による予測
   */
  static linearRegressionPrediction(
    history: MarginLevelHistory[],
    minutesAhead: number = 30
  ): AlgorithmResult {
    if (history.length < 3) {
      return { prediction: 0, confidence: 0, method: 'linear_regression' }
    }

    const points = history.map((h, i) => ({
      x: i,
      y: h.marginLevel
    }))

    const regression = this.calculateLinearRegression(points)
    const nextX = history.length + (minutesAhead / 5) // 5分間隔のデータ
    const prediction = regression.slope * nextX + regression.intercept
    
    return { 
      prediction, 
      confidence: regression.r2, 
      method: 'linear_regression' 
    }
  }

  /**
   * 多項式回帰による予測（2次）
   */
  static polynomialRegressionPrediction(
    history: MarginLevelHistory[],
    minutesAhead: number = 30
  ): AlgorithmResult {
    if (history.length < 5) {
      return { prediction: 0, confidence: 0, method: 'polynomial_regression' }
    }

    const points = history.map((h, i) => ({
      x: i,
      y: h.marginLevel
    }))

    const poly = this.calculatePolynomialRegression(points, 2)
    const nextX = history.length + (minutesAhead / 5)
    const prediction = poly.coefficients[0] + 
                      poly.coefficients[1] * nextX + 
                      poly.coefficients[2] * nextX * nextX

    return { 
      prediction, 
      confidence: poly.r2 * 0.9, // 多項式は若干信頼度を下げる
      method: 'polynomial_regression' 
    }
  }

  /**
   * ARIMA風の予測（簡易版）
   */
  static arimaLikePrediction(
    history: MarginLevelHistory[],
    minutesAhead: number = 30
  ): AlgorithmResult {
    if (history.length < 10) {
      return { prediction: 0, confidence: 0, method: 'arima_like' }
    }

    // 1次差分を計算
    const diffs = []
    for (let i = 1; i < history.length; i++) {
      diffs.push(history[i].marginLevel - history[i-1].marginLevel)
    }

    // 差分の移動平均
    const windowSize = Math.min(5, diffs.length)
    const recentDiffs = diffs.slice(-windowSize)
    const avgDiff = recentDiffs.reduce((sum, d) => sum + d, 0) / windowSize

    // 予測
    const stepsAhead = minutesAhead / 5
    const prediction = history[history.length - 1].marginLevel + (avgDiff * stepsAhead)

    // 信頼度は差分の安定性から
    const diffStdDev = Math.sqrt(
      recentDiffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / windowSize
    )
    const confidence = Math.max(0, 1 - (diffStdDev / 5))

    return { prediction, confidence, method: 'arima_like' }
  }

  /**
   * アンサンブル予測（複数手法の組み合わせ）
   */
  static ensemblePrediction(
    history: MarginLevelHistory[],
    minutesAhead: number = 30
  ): AlgorithmResult {
    const methods = [
      this.movingAveragePrediction(history, 5, minutesAhead),
      this.exponentialMovingAveragePrediction(history, 0.3, minutesAhead),
      this.linearRegressionPrediction(history, minutesAhead),
      this.polynomialRegressionPrediction(history, minutesAhead),
      this.arimaLikePrediction(history, minutesAhead)
    ]

    // 信頼度による重み付き平均
    const totalWeight = methods.reduce((sum, m) => sum + m.confidence, 0)
    
    if (totalWeight === 0) {
      return { prediction: 0, confidence: 0, method: 'ensemble' }
    }

    const weightedPrediction = methods.reduce(
      (sum, m) => sum + (m.prediction * m.confidence), 
      0
    ) / totalWeight

    const avgConfidence = totalWeight / methods.length

    return { 
      prediction: weightedPrediction, 
      confidence: avgConfidence, 
      method: 'ensemble' 
    }
  }

  /**
   * 変動性考慮予測
   */
  static volatilityAdjustedPrediction(
    history: MarginLevelHistory[],
    minutesAhead: number = 30
  ): AlgorithmResult {
    const baseResult = this.ensemblePrediction(history, minutesAhead)
    
    if (history.length < 10) {
      return baseResult
    }

    // ボラティリティ計算
    const values = history.map(h => h.marginLevel)
    const volatility = this.calculateVolatility(values)
    
    // ボラティリティによる信頼度調整
    const volatilityFactor = Math.max(0.1, 1 - (volatility / 50))
    const adjustedConfidence = baseResult.confidence * volatilityFactor

    // 悲観的予測（下方リスクを重視）
    const pessimisticAdjustment = volatility * 0.1 * Math.sqrt(minutesAhead / 30)
    const adjustedPrediction = baseResult.prediction - pessimisticAdjustment

    return {
      prediction: adjustedPrediction,
      confidence: adjustedConfidence,
      method: 'volatility_adjusted'
    }
  }

  // ユーティリティ関数

  private static calculateSimpleTrend(data: MarginLevelHistory[]): number {
    if (data.length < 2) return 0
    
    const first = data[0].marginLevel
    const last = data[data.length - 1].marginLevel
    return (last - first) / (data.length - 1)
  }

  private static calculateTrendFromArray(values: number[]): number {
    if (values.length < 2) return 0
    
    const points = values.map((v, i) => ({ x: i, y: v }))
    return this.calculateLinearRegression(points).slope
  }

  private static calculateLinearRegression(points: { x: number; y: number }[]) {
    const n = points.length
    const sumX = points.reduce((sum, p) => sum + p.x, 0)
    const sumY = points.reduce((sum, p) => sum + p.y, 0)
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0)
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0)
    const sumYY = points.reduce((sum, p) => sum + p.y * p.y, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // R²計算
    const meanY = sumY / n
    const ssRes = points.reduce((sum, p) => {
      const predicted = slope * p.x + intercept
      return sum + Math.pow(p.y - predicted, 2)
    }, 0)
    const ssTot = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0)
    const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0

    return { slope, intercept, r2 }
  }

  private static calculatePolynomialRegression(
    points: { x: number; y: number }[], 
    degree: number
  ) {
    // 簡易的な2次多項式回帰
    if (degree === 2 && points.length >= 3) {
      // 正規方程式を使用した2次回帰
      const n = points.length
      let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0
      let sumY = 0, sumXY = 0, sumX2Y = 0

      points.forEach(p => {
        sumX += p.x
        sumX2 += p.x * p.x
        sumX3 += p.x * p.x * p.x
        sumX4 += p.x * p.x * p.x * p.x
        sumY += p.y
        sumXY += p.x * p.y
        sumX2Y += p.x * p.x * p.y
      })

      // 行列計算（簡略化）
      const a0 = sumY / n // 簡易計算
      const a1 = sumXY / sumX2
      const a2 = (sumX2Y - a1 * sumX3) / sumX4

      // R²の簡易計算
      const meanY = sumY / n
      let ssRes = 0, ssTot = 0
      points.forEach(p => {
        const predicted = a0 + a1 * p.x + a2 * p.x * p.x
        ssRes += Math.pow(p.y - predicted, 2)
        ssTot += Math.pow(p.y - meanY, 2)
      })
      const r2 = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0

      return { coefficients: [a0, a1, a2], r2 }
    }

    // フォールバック
    return { coefficients: [0, 0, 0], r2: 0 }
  }

  private static calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    return Math.sqrt(variance)
  }
}