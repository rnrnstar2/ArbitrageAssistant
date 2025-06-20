/**
 * リスク管理システム 型定義エクスポート
 */

export * from './prediction-types'

// 共通型定義
export interface RiskLevel {
  level: 'safe' | 'warning' | 'danger' | 'critical'
  score: number
  description: string
}

export interface MonitoringAlert {
  id: string
  accountId: string
  type: 'margin_level' | 'position_risk' | 'system_error'
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  timestamp: Date
  acknowledged: boolean
  resolvedAt?: Date
}

export interface RiskConfiguration {
  marginLevelThresholds: {
    critical: number
    danger: number
    warning: number
    safe: number
  }
  positionLimits: {
    maxLots: number
    maxExposure: number
    maxPositions: number
  }
  alertSettings: {
    emailNotifications: boolean
    soundAlerts: boolean
    pushNotifications: boolean
  }
}