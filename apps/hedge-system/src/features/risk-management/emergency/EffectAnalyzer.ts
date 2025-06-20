/**
 * Emergency Action Effect Analyzer
 * 緊急対応効果測定・分析システム
 */

import { EmergencyResponse, EmergencyActionResult } from './EmergencyActionManager'
import { RiskMonitoringState } from '../types/risk-types'

export interface EffectMeasurement {
  id: string
  responseId: string
  accountId: string
  measurementTime: Date
  
  // 前後比較
  beforeState: {
    marginLevel: number
    totalLoss: number
    usedMargin: number
    positionCount: number
    riskLevel: string
  }
  afterState: {
    marginLevel: number
    totalLoss: number
    usedMargin: number
    positionCount: number
    riskLevel: string
  }
  
  // 効果指標
  effects: {
    lossReduction: number
    marginImprovement: number
    riskLevelChange: number
    executionTime: number
    successRate: number
  }
  
  // 評価
  evaluation: {
    effectiveness: number // 0-1
    efficiency: number // 0-1
    overallScore: number // 0-1
    recommendations: string[]
  }
}

export interface PerformanceMetrics {
  totalResponses: number
  successfulResponses: number
  averageExecutionTime: number
  averageLossReduction: number
  averageMarginImprovement: number
  
  // 成功率分析
  successRateByScenario: Record<string, number>
  successRateByRiskLevel: Record<string, number>
  
  // 時間分析
  executionTimeAnalysis: {
    fastest: number
    slowest: number
    median: number
    percentile95: number
  }
  
  // 改善提案
  improvements: {
    category: string
    description: string
    priority: 'low' | 'medium' | 'high'
    estimatedImpact: number
  }[]
}

export interface TrendAnalysis {
  period: string
  dataPoints: Array<{
    date: Date
    averageEffectiveness: number
    totalActions: number
    successRate: number
  }>
  trends: {
    effectiveness: 'improving' | 'declining' | 'stable'
    efficiency: 'improving' | 'declining' | 'stable'
    reliability: 'improving' | 'declining' | 'stable'
  }
}

export class EffectAnalyzer {
  private measurements: Map<string, EffectMeasurement> = new Map()
  private performanceHistory: PerformanceMetrics[] = []

  /**
   * 緊急対応効果測定実行
   */
  measureEmergencyResponse(
    response: EmergencyResponse,
    beforeState: RiskMonitoringState,
    afterState: RiskMonitoringState
  ): EffectMeasurement {
    console.log(`[EffectAnalyzer] Measuring effect for response: ${response.id}`)

    const measurement: EffectMeasurement = {
      id: `measurement_${response.id}_${Date.now()}`,
      responseId: response.id,
      accountId: response.accountId,
      measurementTime: new Date(),
      
      beforeState: {
        marginLevel: beforeState.marginLevel,
        totalLoss: this.calculateTotalLoss(beforeState),
        usedMargin: beforeState.usedMargin,
        positionCount: this.estimatePositionCount(beforeState),
        riskLevel: beforeState.riskLevel
      },
      
      afterState: {
        marginLevel: afterState.marginLevel,
        totalLoss: this.calculateTotalLoss(afterState),
        usedMargin: afterState.usedMargin,
        positionCount: this.estimatePositionCount(afterState),
        riskLevel: afterState.riskLevel
      },
      
      effects: this.calculateEffects(response, beforeState, afterState),
      evaluation: { effectiveness: 0, efficiency: 0, overallScore: 0, recommendations: [] }
    }

    // 評価実行
    measurement.evaluation = this.evaluateResponse(measurement, response)
    
    // 保存
    this.measurements.set(measurement.id, measurement)
    
    console.log(`[EffectAnalyzer] Effect measurement completed: ${measurement.evaluation.overallScore.toFixed(2)} score`)
    
    return measurement
  }

  /**
   * パフォーマンス分析実行
   */
  analyzePerformance(timeRangeHours: number = 24): PerformanceMetrics {
    const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000)
    const recentMeasurements = Array.from(this.measurements.values())
      .filter(m => m.measurementTime >= cutoffTime)

    const metrics: PerformanceMetrics = {
      totalResponses: recentMeasurements.length,
      successfulResponses: recentMeasurements.filter(m => m.evaluation.effectiveness > 0.7).length,
      averageExecutionTime: this.calculateAverageExecutionTime(recentMeasurements),
      averageLossReduction: this.calculateAverageLossReduction(recentMeasurements),
      averageMarginImprovement: this.calculateAverageMarginImprovement(recentMeasurements),
      
      successRateByScenario: this.analyzeSuccessRateByScenario(recentMeasurements),
      successRateByRiskLevel: this.analyzeSuccessRateByRiskLevel(recentMeasurements),
      
      executionTimeAnalysis: this.analyzeExecutionTimes(recentMeasurements),
      
      improvements: this.generateImprovements(recentMeasurements)
    }

    this.performanceHistory.push(metrics)
    return metrics
  }

  /**
   * トレンド分析
   */
  analyzeTrends(daysPeriod: number = 7): TrendAnalysis {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - daysPeriod * 24 * 60 * 60 * 1000)
    
    const dataPoints = this.generateDailyDataPoints(startDate, endDate)
    
    return {
      period: `${daysPeriod} days`,
      dataPoints,
      trends: {
        effectiveness: this.determineTrend(dataPoints.map(d => d.averageEffectiveness)),
        efficiency: this.determineTrend(dataPoints.map(d => d.totalActions / Math.max(d.successRate, 0.1))),
        reliability: this.determineTrend(dataPoints.map(d => d.successRate))
      }
    }
  }

  /**
   * 詳細レポート生成
   */
  generateDetailedReport(measurementId: string): string {
    const measurement = this.measurements.get(measurementId)
    if (!measurement) {
      throw new Error(`Measurement not found: ${measurementId}`)
    }

    const report = [
      `# 緊急対応効果レポート`,
      ``,
      `## 基本情報`,
      `- 対応ID: ${measurement.responseId}`,
      `- 口座ID: ${measurement.accountId}`,
      `- 測定時刻: ${measurement.measurementTime.toLocaleString()}`,
      ``,
      `## 状態変化`,
      `### 対応前`,
      `- 証拠金維持率: ${measurement.beforeState.marginLevel.toFixed(2)}%`,
      `- 総損失: $${measurement.beforeState.totalLoss.toFixed(2)}`,
      `- 使用証拠金: $${measurement.beforeState.usedMargin.toFixed(2)}`,
      `- リスクレベル: ${measurement.beforeState.riskLevel}`,
      ``,
      `### 対応後`,
      `- 証拠金維持率: ${measurement.afterState.marginLevel.toFixed(2)}%`,
      `- 総損失: $${measurement.afterState.totalLoss.toFixed(2)}`,
      `- 使用証拠金: $${measurement.afterState.usedMargin.toFixed(2)}`,
      `- リスクレベル: ${measurement.afterState.riskLevel}`,
      ``,
      `## 効果測定`,
      `- 損失削減: $${measurement.effects.lossReduction.toFixed(2)}`,
      `- 証拠金改善: $${measurement.effects.marginImprovement.toFixed(2)}`,
      `- 実行時間: ${measurement.effects.executionTime.toFixed(0)}ms`,
      `- 成功率: ${(measurement.effects.successRate * 100).toFixed(1)}%`,
      ``,
      `## 評価`,
      `- 有効性: ${(measurement.evaluation.effectiveness * 100).toFixed(1)}%`,
      `- 効率性: ${(measurement.evaluation.efficiency * 100).toFixed(1)}%`,
      `- 総合評価: ${(measurement.evaluation.overallScore * 100).toFixed(1)}%`,
      ``,
      `## 推奨事項`,
      ...measurement.evaluation.recommendations.map(r => `- ${r}`)
    ].join('\n')

    return report
  }

  // 内部計算メソッド

  private calculateTotalLoss(state: RiskMonitoringState): number {
    // 実装では実際のポジション損益から計算
    return Math.max(0, state.usedMargin - state.freeMargin) * 0.1
  }

  private estimatePositionCount(state: RiskMonitoringState): number {
    // 証拠金使用量から推定
    return Math.max(1, Math.floor(state.usedMargin / 1000))
  }

  private calculateEffects(
    response: EmergencyResponse,
    beforeState: RiskMonitoringState,
    afterState: RiskMonitoringState
  ) {
    const lossReduction = Math.max(0, 
      this.calculateTotalLoss(beforeState) - this.calculateTotalLoss(afterState)
    )
    
    const marginImprovement = afterState.marginLevel - beforeState.marginLevel
    
    const riskLevelChange = this.calculateRiskLevelChange(
      beforeState.riskLevel, afterState.riskLevel
    )
    
    const executionTime = response.endTime && response.startTime
      ? response.endTime.getTime() - response.startTime.getTime()
      : 0
    
    const successRate = response.executedActions.length > 0
      ? response.executedActions.filter(a => a.success).length / response.executedActions.length
      : 0

    return {
      lossReduction,
      marginImprovement,
      riskLevelChange,
      executionTime,
      successRate
    }
  }

  private calculateRiskLevelChange(before: string, after: string): number {
    const levels = { 'safe': 4, 'warning': 3, 'danger': 2, 'critical': 1 }
    return (levels[after as keyof typeof levels] || 1) - (levels[before as keyof typeof levels] || 1)
  }

  private evaluateResponse(measurement: EffectMeasurement, response: EmergencyResponse) {
    // 有効性評価（目標達成度）
    let effectiveness = 0
    if (measurement.effects.marginImprovement > 0) effectiveness += 0.4
    if (measurement.effects.lossReduction > 0) effectiveness += 0.4
    if (measurement.effects.riskLevelChange > 0) effectiveness += 0.2

    // 効率性評価（時間・リソース効率）
    let efficiency = 0
    if (measurement.effects.executionTime < 30000) efficiency += 0.4 // 30秒以内
    if (measurement.effects.successRate > 0.8) efficiency += 0.4 // 80%以上成功
    if (response.executedActions.length <= 3) efficiency += 0.2 // 最小限のアクション

    // 総合評価
    const overallScore = (effectiveness * 0.6 + efficiency * 0.4)

    // 推奨事項生成
    const recommendations = this.generateRecommendations(measurement, response)

    return {
      effectiveness: Math.min(1, effectiveness),
      efficiency: Math.min(1, efficiency),
      overallScore: Math.min(1, overallScore),
      recommendations
    }
  }

  private generateRecommendations(measurement: EffectMeasurement, response: EmergencyResponse): string[] {
    const recommendations: string[] = []

    if (measurement.effects.executionTime > 60000) {
      recommendations.push('実行時間が長すぎます。戦略の簡素化を検討してください')
    }

    if (measurement.effects.successRate < 0.7) {
      recommendations.push('成功率が低いです。アクションの信頼性向上が必要です')
    }

    if (measurement.effects.marginImprovement < 10) {
      recommendations.push('証拠金改善効果が小さいです。より積極的な戦略を検討してください')
    }

    if (response.executedActions.length > 5) {
      recommendations.push('アクション数が多すぎます。効率的な戦略への見直しが必要です')
    }

    if (measurement.evaluation.overallScore < 0.5) {
      recommendations.push('全体的な効果が低いです。戦略の根本的見直しを推奨します')
    }

    return recommendations
  }

  private calculateAverageExecutionTime(measurements: EffectMeasurement[]): number {
    if (measurements.length === 0) return 0
    return measurements.reduce((sum, m) => sum + m.effects.executionTime, 0) / measurements.length
  }

  private calculateAverageLossReduction(measurements: EffectMeasurement[]): number {
    if (measurements.length === 0) return 0
    return measurements.reduce((sum, m) => sum + m.effects.lossReduction, 0) / measurements.length
  }

  private calculateAverageMarginImprovement(measurements: EffectMeasurement[]): number {
    if (measurements.length === 0) return 0
    return measurements.reduce((sum, m) => sum + m.effects.marginImprovement, 0) / measurements.length
  }

  private analyzeSuccessRateByScenario(measurements: EffectMeasurement[]): Record<string, number> {
    // シナリオ別成功率分析（簡易実装）
    return {
      'single_account': 0.85,
      'multi_account': 0.72,
      'correlated_positions': 0.68
    }
  }

  private analyzeSuccessRateByRiskLevel(measurements: EffectMeasurement[]): Record<string, number> {
    const riskLevels = ['safe', 'warning', 'danger', 'critical']
    const result: Record<string, number> = {}

    for (const level of riskLevels) {
      const filtered = measurements.filter(m => m.beforeState.riskLevel === level)
      const successful = filtered.filter(m => m.evaluation.effectiveness > 0.7)
      result[level] = filtered.length > 0 ? successful.length / filtered.length : 0
    }

    return result
  }

  private analyzeExecutionTimes(measurements: EffectMeasurement[]) {
    const times = measurements.map(m => m.effects.executionTime).sort((a, b) => a - b)
    
    return {
      fastest: times[0] || 0,
      slowest: times[times.length - 1] || 0,
      median: times[Math.floor(times.length / 2)] || 0,
      percentile95: times[Math.floor(times.length * 0.95)] || 0
    }
  }

  private generateImprovements(measurements: EffectMeasurement[]) {
    const improvements = []

    const avgEffectiveness = measurements.length > 0
      ? measurements.reduce((sum, m) => sum + m.evaluation.effectiveness, 0) / measurements.length
      : 0

    if (avgEffectiveness < 0.7) {
      improvements.push({
        category: '戦略改善',
        description: '緊急対応戦略の効果が低下しています。戦略の見直しが必要です',
        priority: 'high' as const,
        estimatedImpact: 0.3
      })
    }

    const slowResponses = measurements.filter(m => m.effects.executionTime > 30000).length
    if (slowResponses > measurements.length * 0.3) {
      improvements.push({
        category: '速度改善',
        description: '実行時間が長すぎる対応が多いです。パフォーマンスの最適化が必要です',
        priority: 'medium' as const,
        estimatedImpact: 0.2
      })
    }

    return improvements
  }

  private generateDailyDataPoints(startDate: Date, endDate: Date) {
    const dataPoints = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate)
      const dayEnd = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      
      const dayMeasurements = Array.from(this.measurements.values())
        .filter(m => m.measurementTime >= dayStart && m.measurementTime < dayEnd)

      dataPoints.push({
        date: new Date(currentDate),
        averageEffectiveness: dayMeasurements.length > 0
          ? dayMeasurements.reduce((sum, m) => sum + m.evaluation.effectiveness, 0) / dayMeasurements.length
          : 0,
        totalActions: dayMeasurements.length,
        successRate: dayMeasurements.length > 0
          ? dayMeasurements.filter(m => m.evaluation.effectiveness > 0.7).length / dayMeasurements.length
          : 0
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return dataPoints
  }

  private determineTrend(values: number[]): 'improving' | 'declining' | 'stable' {
    if (values.length < 2) return 'stable'
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))
    
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length
    
    const change = (secondAvg - firstAvg) / firstAvg
    
    if (change > 0.1) return 'improving'
    if (change < -0.1) return 'declining'
    return 'stable'
  }

  // ゲッター

  getMeasurement(id: string): EffectMeasurement | undefined {
    return this.measurements.get(id)
  }

  getAllMeasurements(): EffectMeasurement[] {
    return Array.from(this.measurements.values())
  }

  getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory]
  }
}