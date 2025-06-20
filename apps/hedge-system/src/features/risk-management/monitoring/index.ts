/**
 * ロスカット予測・監視システム エクスポート
 */

export { LossCutPredictor } from './LossCutPredictor'
export { PredictionAlgorithms } from './PredictionAlgorithms'
export { RecoveryCalculator } from './RecoveryCalculator'

export type {
  PredictionPoint,
  AlgorithmResult
} from './PredictionAlgorithms'

export type {
  AccountState,
  PositionInfo,
  CrossAccountInfo,
  OptimizationResult
} from './RecoveryCalculator'

// 設定のエクスポート
export const DEFAULT_PREDICTION_CONFIG = {
  minDataPoints: 5,
  predictionWindowMinutes: [15, 30, 60],
  trendSensitivity: 0.1,
  volatilityWindow: 10,
  confidenceThreshold: 0.7,
  updateIntervalMs: 30000
}

// 危険レベルの閾値
export const RISK_THRESHOLDS = {
  CRITICAL: 50,
  DANGER: 100,
  WARNING: 150,
  SAFE: 200
} as const

// ロスカットレベル設定
export const LOSSCUT_LEVELS = {
  STANDARD: 20,
  BONUS_ACCOUNT: 0,
  CONSERVATIVE: 50
} as const