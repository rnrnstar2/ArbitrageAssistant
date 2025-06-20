/**
 * ロスカット予測システムの型定義
 */

export interface LossCutPrediction {
  accountId: string
  currentMarginLevel: number
  predictedLossCutTime?: Date
  timeToLossCut?: number // 分
  requiredRecovery: number // USD
  confidenceLevel: number // 0-1
  trendDirection: 'improving' | 'deteriorating' | 'stable'
  predictions: {
    in15min: number // 予測証拠金維持率
    in30min: number
    in1hour: number
  }
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical'
  lastUpdate: Date
}

export interface MarginLevelHistory {
  timestamp: Date
  marginLevel: number
  equity: number
  freeMargin: number
  usedMargin: number
  unrealizedPL: number
  bonusAmount: number
}

export interface TrendAnalysis {
  slope: number
  trend: 'improving' | 'deteriorating' | 'stable'
  volatility: number
  confidence: number
  dataPoints: number
  lastUpdate: Date
}

export interface RecoveryScenario {
  type: 'deposit' | 'position_reduction' | 'profit_taking' | 'cross_account'
  description: string
  requiredAmount: number
  impact: number // 予測改善度
  urgency: 'low' | 'medium' | 'high' | 'critical'
  feasibility: number // 0-1
  instructions: string[]
}

export interface PredictionConfig {
  minDataPoints: number
  predictionWindowMinutes: number[]
  trendSensitivity: number
  volatilityWindow: number
  confidenceThreshold: number
  updateIntervalMs: number
}

export interface EarlyWarning {
  accountId: string
  level: 'info' | 'warning' | 'danger' | 'critical'
  message: string
  timeToAction?: number // 分
  suggestedActions: RecoveryScenario[]
  isActive: boolean
  createdAt: Date
  acknowledgedAt?: Date
}

export interface PredictionResult {
  prediction: LossCutPrediction
  trend: TrendAnalysis
  warnings: EarlyWarning[]
  recoveryScenarios: RecoveryScenario[]
  nextUpdateAt: Date
}

export interface PredictionMetrics {
  accuracy: number
  falsePositiveRate: number
  falseNegativeRate: number
  averageLeadTime: number // 分
  totalPredictions: number
  successfulPredictions: number
}