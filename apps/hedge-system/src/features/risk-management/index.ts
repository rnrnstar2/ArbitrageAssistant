/**
 * Risk Management Feature Exports
 * リスク管理機能のエクスポート
 */

// 監視コンポーネント
export { LossCutMonitor } from './monitoring/LossCutMonitor'
export { MarginLevelMonitor } from './monitoring/MarginLevelMonitor'
export { RiskStateManager } from './monitoring/RiskStateManager'

// 緊急対応システム
export {
  EmergencyActionManager,
  EmergencyStrategies,
  LossMinimizer,
  EmergencyModeManager,
  EffectAnalyzer
} from './emergency'

// 型定義
export type {
  RiskMonitoringState,
  RiskLevelConfig,
  LossCutMonitorConfig,
  MonitoringEvent,
  LossCutAlert,
  MonitoringStatus,
  MonitoringCallbacks,
  AccountMarginInfo,
  MonitoringResult
} from './types/risk-types'

// 緊急対応型定義
export type {
  EmergencyStrategy,
  EmergencyAction,
  EmergencyResponse,
  EmergencyMode,
  StrategyTemplate,
  DynamicActionParameters,
  Position,
  MinimizationResult,
  LossMinimizationConfig,
  EmergencyModeState,
  OperationType,
  EmergencyTrigger,
  RecoveryAction,
  EmergencyModeConfig,
  EffectMeasurement,
  PerformanceMetrics,
  TrendAnalysis
} from './emergency'

// ユーティリティ
export {
  calculateRiskLevel,
  calculateMarginLevel,
  calculateFreeMargin,
  predictTimeToCritical,
  calculateRequiredRecovery,
  normalizeMarginInfo,
  createRiskMonitoringState,
  validateMarginData,
  calculateEffectiveEquity,
  getMarginCallThreshold
} from './utils/margin-calculations'

// デフォルト設定
export const DEFAULT_LOSSCUT_CONFIG: LossCutMonitorConfig = {
  enabled: true,
  pollingInterval: 1000, // 1秒
  marginLevelThresholds: {
    warning: 150, // 150%
    danger: 100,  // 100%
    critical: 50  // 50%
  },
  alertSettings: {
    enableSound: true,
    enableDesktopNotification: true,
    enableEmailAlert: false
  }
}

export const DEFAULT_RISK_LEVEL_CONFIG: RiskLevelConfig = {
  safe: {
    marginLevel: 200,
    color: '#10B981' // green
  },
  warning: {
    marginLevel: 150,
    color: '#F59E0B' // amber
  },
  danger: {
    marginLevel: 100,
    color: '#EF4444' // red
  },
  critical: {
    marginLevel: 50,
    color: '#DC2626' // dark red
  }
}

// 緊急対応デフォルト設定
export const DEFAULT_EMERGENCY_MODE_CONFIG: EmergencyModeConfig = {
  autoActivationThresholds: {
    marginLevel: 50,
    consecutiveErrors: 3,
    networkTimeoutMs: 5000
  },
  suspendedOperationsByLevel: {
    low: ['auto_trading'],
    medium: ['auto_trading', 'new_positions'],
    high: ['auto_trading', 'new_positions', 'position_modifications'],
    critical: ['auto_trading', 'new_positions', 'position_modifications', 'bulk_operations']
  },
  autoRecoveryEnabled: true,
  autoRecoveryTimeoutMs: 300000, // 5分
  notificationChannels: ['desktop', 'sound']
}

export const DEFAULT_LOSS_MINIMIZATION_CONFIG: LossMinimizationConfig = {
  maxLossPercentage: 10,
  preferPartialClose: true,
  enableHedging: true,
  hedgeRatio: 0.5,
  prioritizeMarginEfficiency: true,
  considerSwapCosts: true
}