/**
 * ロスカット予測・警告システム
 * 証拠金維持率の変化を分析し、ロスカット発生時刻とリカバリー必要額を予測
 */

import {
  LossCutPrediction,
  MarginLevelHistory,
  TrendAnalysis,
  RecoveryScenario,
  PredictionConfig,
  EarlyWarning,
  PredictionResult,
  PredictionMetrics
} from '../types/prediction-types'

export class LossCutPredictor {
  private readonly config: PredictionConfig
  private historyData: Map<string, MarginLevelHistory[]> = new Map()
  private predictions: Map<string, LossCutPrediction> = new Map()
  private warnings: Map<string, EarlyWarning[]> = new Map()
  private metrics: PredictionMetrics
  private updateTimer?: NodeJS.Timeout

  constructor(config: Partial<PredictionConfig> = {}) {
    this.config = {
      minDataPoints: 5,
      predictionWindowMinutes: [15, 30, 60],
      trendSensitivity: 0.1,
      volatilityWindow: 10,
      confidenceThreshold: 0.7,
      updateIntervalMs: 30000, // 30秒
      ...config
    }

    this.metrics = {
      accuracy: 0,
      falsePositiveRate: 0,
      falseNegativeRate: 0,
      averageLeadTime: 0,
      totalPredictions: 0,
      successfulPredictions: 0
    }

    this.startContinuousMonitoring()
  }

  /**
   * 新しい証拠金データを追加
   */
  addMarginData(accountId: string, data: Omit<MarginLevelHistory, 'timestamp'>): void {
    const history = this.historyData.get(accountId) || []
    const newData: MarginLevelHistory = {
      ...data,
      timestamp: new Date()
    }

    history.push(newData)

    // 古いデータを削除（過去2時間のみ保持）
    const cutoffTime = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const filteredHistory = history.filter(h => h.timestamp > cutoffTime)

    this.historyData.set(accountId, filteredHistory)

    // 予測を更新
    this.updatePrediction(accountId)
  }

  /**
   * 予測結果を取得
   */
  getPrediction(accountId: string): PredictionResult | null {
    const prediction = this.predictions.get(accountId)
    if (!prediction) return null

    const history = this.historyData.get(accountId) || []
    const trend = this.analyzeTrend(history)
    const warnings = this.warnings.get(accountId) || []
    const recoveryScenarios = this.calculateRecoveryScenarios(prediction)

    return {
      prediction,
      trend,
      warnings: warnings.filter(w => w.isActive),
      recoveryScenarios,
      nextUpdateAt: new Date(Date.now() + this.config.updateIntervalMs)
    }
  }

  /**
   * 全アカウントの予測結果を取得
   */
  getAllPredictions(): Map<string, PredictionResult> {
    const results = new Map<string, PredictionResult>()
    
    for (const accountId of this.predictions.keys()) {
      const result = this.getPrediction(accountId)
      if (result) {
        results.set(accountId, result)
      }
    }

    return results
  }

  /**
   * 重要な警告のみを取得
   */
  getCriticalWarnings(): EarlyWarning[] {
    const criticalWarnings: EarlyWarning[] = []
    
    for (const warnings of this.warnings.values()) {
      criticalWarnings.push(
        ...warnings.filter(w => w.isActive && (w.level === 'critical' || w.level === 'danger'))
      )
    }

    return criticalWarnings.sort((a, b) => {
      if (a.level === 'critical' && b.level !== 'critical') return -1
      if (b.level === 'critical' && a.level !== 'critical') return 1
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  }

  /**
   * 予測精度メトリクスを取得
   */
  getMetrics(): PredictionMetrics {
    return { ...this.metrics }
  }

  /**
   * 予測を更新
   */
  private updatePrediction(accountId: string): void {
    const history = this.historyData.get(accountId) || []
    
    if (history.length < this.config.minDataPoints) {
      return
    }

    const latestData = history[history.length - 1]
    const trend = this.analyzeTrend(history)
    const prediction = this.predictLossCut(accountId, history, trend)

    this.predictions.set(accountId, prediction)
    this.updateWarnings(accountId, prediction)
  }

  /**
   * トレンド分析
   */
  private analyzeTrend(history: MarginLevelHistory[]): TrendAnalysis {
    if (history.length < 2) {
      return {
        slope: 0,
        trend: 'stable',
        volatility: 0,
        confidence: 0,
        dataPoints: history.length,
        lastUpdate: new Date()
      }
    }

    // 線形回帰によるトレンド計算
    const points = history.map((h, i) => ({
      x: i,
      y: h.marginLevel
    }))

    const n = points.length
    const sumX = points.reduce((sum, p) => sum + p.x, 0)
    const sumY = points.reduce((sum, p) => sum + p.y, 0)
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0)
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    
    // ボラティリティ計算
    const values = history.slice(-this.config.volatilityWindow).map(h => h.marginLevel)
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    const volatility = Math.sqrt(variance)

    // トレンド判定
    let trend: 'improving' | 'deteriorating' | 'stable'
    if (Math.abs(slope) < this.config.trendSensitivity) {
      trend = 'stable'
    } else if (slope > 0) {
      trend = 'improving'
    } else {
      trend = 'deteriorating'
    }

    // 信頼度計算（データ点数とボラティリティから）
    const confidence = Math.min(1, (n / 20) * (1 - volatility / 100))

    return {
      slope,
      trend,
      volatility,
      confidence,
      dataPoints: n,
      lastUpdate: new Date()
    }
  }

  /**
   * ロスカット予測計算
   */
  private predictLossCut(
    accountId: string, 
    history: MarginLevelHistory[], 
    trend: TrendAnalysis
  ): LossCutPrediction {
    const latest = history[history.length - 1]
    const lossCutLevel = 20 // 20%でロスカット
    
    let predictedLossCutTime: Date | undefined
    let timeToLossCut: number | undefined

    // トレンドが悪化している場合のみ予測
    if (trend.trend === 'deteriorating' && trend.confidence > this.config.confidenceThreshold) {
      const ratePerMinute = Math.abs(trend.slope) / 5 // 5分間隔のデータから1分あたりの変化率
      
      if (ratePerMinute > 0) {
        const marginToLossCut = latest.marginLevel - lossCutLevel
        timeToLossCut = marginToLossCut / ratePerMinute
        predictedLossCutTime = new Date(Date.now() + timeToLossCut * 60 * 1000)
      }
    }

    // 将来の証拠金維持率予測
    const predictions = {
      in15min: this.predictMarginLevel(history, trend, 15),
      in30min: this.predictMarginLevel(history, trend, 30),
      in1hour: this.predictMarginLevel(history, trend, 60)
    }

    // リスクレベル判定
    let riskLevel: LossCutPrediction['riskLevel']
    if (latest.marginLevel < 50) {
      riskLevel = 'critical'
    } else if (latest.marginLevel < 100 || (timeToLossCut && timeToLossCut < 30)) {
      riskLevel = 'danger'
    } else if (latest.marginLevel < 150 || (timeToLossCut && timeToLossCut < 60)) {
      riskLevel = 'warning'
    } else {
      riskLevel = 'safe'
    }

    // 必要リカバリー額計算
    const requiredRecovery = this.calculateRequiredRecovery(latest, lossCutLevel)

    return {
      accountId,
      currentMarginLevel: latest.marginLevel,
      predictedLossCutTime,
      timeToLossCut,
      requiredRecovery,
      confidenceLevel: trend.confidence,
      trendDirection: trend.trend,
      predictions,
      riskLevel,
      lastUpdate: new Date()
    }
  }

  /**
   * 指定時間後の証拠金維持率を予測
   */
  private predictMarginLevel(
    history: MarginLevelHistory[], 
    trend: TrendAnalysis, 
    minutesAhead: number
  ): number {
    if (history.length === 0) return 0

    const latest = history[history.length - 1]
    const ratePerMinute = trend.slope / 5 // 5分間隔から1分あたりの変化率

    // ボラティリティを考慮した予測範囲
    const basePredict = latest.marginLevel + (ratePerMinute * minutesAhead)
    const volatilityAdjustment = trend.volatility * 0.1 // ボラティリティ調整

    return Math.max(0, basePredict - volatilityAdjustment)
  }

  /**
   * 必要リカバリー額を計算
   */
  private calculateRequiredRecovery(latest: MarginLevelHistory, targetLevel: number): number {
    if (latest.marginLevel >= targetLevel) return 0

    // 目標レベル（通常は200%）まで回復するのに必要な資金
    const targetMarginLevel = Math.max(targetLevel, 200)
    const currentEquity = latest.equity
    const requiredEquity = (latest.usedMargin * targetMarginLevel) / 100

    return Math.max(0, requiredEquity - currentEquity)
  }

  /**
   * リカバリーシナリオを計算
   */
  private calculateRecoveryScenarios(prediction: LossCutPrediction): RecoveryScenario[] {
    const scenarios: RecoveryScenario[] = []

    if (prediction.requiredRecovery > 0) {
      // 入金シナリオ
      scenarios.push({
        type: 'deposit',
        description: '追加入金による証拠金維持率回復',
        requiredAmount: prediction.requiredRecovery,
        impact: 100,
        urgency: this.getUrgencyLevel(prediction),
        feasibility: 0.8,
        instructions: [
          `${prediction.requiredRecovery.toFixed(0)}USD の追加入金`,
          '入金確認後の証拠金維持率確認',
          'ポジション整理の検討'
        ]
      })

      // ポジション削減シナリオ
      scenarios.push({
        type: 'position_reduction',
        description: '損失ポジションの部分決済',
        requiredAmount: prediction.requiredRecovery * 0.5,
        impact: 60,
        urgency: this.getUrgencyLevel(prediction),
        feasibility: 0.9,
        instructions: [
          '最も損失の大きいポジションを特定',
          'ロット数の50%を決済',
          '証拠金維持率の改善を確認'
        ]
      })

      // 利益確定シナリオ
      scenarios.push({
        type: 'profit_taking',
        description: '利益ポジションの決済',
        requiredAmount: 0,
        impact: 40,
        urgency: 'medium',
        feasibility: 0.7,
        instructions: [
          '利益ポジションを確認',
          '部分利益確定を実行',
          'フリーマージンの増加を確認'
        ]
      })

      // クロスアカウント調整
      scenarios.push({
        type: 'cross_account',
        description: '他口座からの資金移動',
        requiredAmount: prediction.requiredRecovery,
        impact: 80,
        urgency: this.getUrgencyLevel(prediction),
        feasibility: 0.6,
        instructions: [
          '他口座の余裕資金を確認',
          '資金移動手続きを実行',
          '移動完了後の証拠金確認'
        ]
      })
    }

    return scenarios.sort((a, b) => {
      // 実行可能性と緊急度で並び替え
      const urgencyWeight = { low: 1, medium: 2, high: 3, critical: 4 }
      const aScore = a.feasibility * urgencyWeight[a.urgency]
      const bScore = b.feasibility * urgencyWeight[b.urgency]
      return bScore - aScore
    })
  }

  /**
   * 緊急度レベルを取得
   */
  private getUrgencyLevel(prediction: LossCutPrediction): RecoveryScenario['urgency'] {
    if (prediction.riskLevel === 'critical') return 'critical'
    if (prediction.riskLevel === 'danger') return 'high'
    if (prediction.riskLevel === 'warning') return 'medium'
    return 'low'
  }

  /**
   * 警告を更新
   */
  private updateWarnings(accountId: string, prediction: LossCutPrediction): void {
    const existingWarnings = this.warnings.get(accountId) || []
    
    // 既存の警告を非アクティブに
    existingWarnings.forEach(w => w.isActive = false)

    const newWarnings: EarlyWarning[] = []

    // 危険レベルに応じた警告生成
    if (prediction.riskLevel === 'critical') {
      newWarnings.push({
        accountId,
        level: 'critical',
        message: `緊急: 証拠金維持率が${prediction.currentMarginLevel.toFixed(1)}%まで低下`,
        timeToAction: prediction.timeToLossCut,
        suggestedActions: this.calculateRecoveryScenarios(prediction).slice(0, 2),
        isActive: true,
        createdAt: new Date()
      })
    } else if (prediction.riskLevel === 'danger') {
      newWarnings.push({
        accountId,
        level: 'danger',
        message: `警告: ロスカットリスクが高まっています (${prediction.currentMarginLevel.toFixed(1)}%)`,
        timeToAction: prediction.timeToLossCut,
        suggestedActions: this.calculateRecoveryScenarios(prediction).slice(0, 3),
        isActive: true,
        createdAt: new Date()
      })
    } else if (prediction.riskLevel === 'warning') {
      newWarnings.push({
        accountId,
        level: 'warning',
        message: `注意: 証拠金維持率が低下傾向 (${prediction.currentMarginLevel.toFixed(1)}%)`,
        suggestedActions: this.calculateRecoveryScenarios(prediction),
        isActive: true,
        createdAt: new Date()
      })
    }

    this.warnings.set(accountId, [...existingWarnings, ...newWarnings])
  }

  /**
   * 継続監視を開始
   */
  private startContinuousMonitoring(): void {
    this.updateTimer = setInterval(() => {
      // 全アカウントの予測を更新
      for (const accountId of this.historyData.keys()) {
        this.updatePrediction(accountId)
      }
    }, this.config.updateIntervalMs)
  }

  /**
   * 監視を停止
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = undefined
    }
  }

  /**
   * 予測精度を更新（実際のロスカット発生時に呼び出し）
   */
  updateMetrics(accountId: string, actualLossCut: boolean, actualTime?: Date): void {
    const prediction = this.predictions.get(accountId)
    if (!prediction) return

    this.metrics.totalPredictions++

    if (actualLossCut && prediction.predictedLossCutTime && actualTime) {
      const timeDiff = Math.abs(actualTime.getTime() - prediction.predictedLossCutTime.getTime())
      const leadTime = timeDiff / (60 * 1000) // 分

      if (leadTime <= 30) { // 30分以内の予測を成功とみなす
        this.metrics.successfulPredictions++
      }

      this.metrics.averageLeadTime = 
        (this.metrics.averageLeadTime * (this.metrics.totalPredictions - 1) + leadTime) / 
        this.metrics.totalPredictions
    }

    this.metrics.accuracy = this.metrics.successfulPredictions / this.metrics.totalPredictions
  }
}