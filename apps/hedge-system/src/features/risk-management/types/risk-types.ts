/**
 * Risk Management Types
 * リスク管理システムの型定義
 */

/**
 * リスク監視状態
 */
export interface RiskMonitoringState {
  accountId: string
  marginLevel: number
  freeMargin: number
  usedMargin: number
  balance: number
  equity: number
  bonusAmount: number
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical'
  lastUpdate: Date
  lossCutLevel: number
  predictions: {
    timeToCritical?: number // 分
    requiredRecovery: number // USD
  }
}

/**
 * リスクレベル設定
 */
export interface RiskLevelConfig {
  safe: {
    marginLevel: number // 200%以上
    color: string
  }
  warning: {
    marginLevel: number // 150%以上
    color: string
  }
  danger: {
    marginLevel: number // 100%以上
    color: string
  }
  critical: {
    marginLevel: number // 50%以下
    color: string
  }
}

/**
 * ロスカット監視設定
 */
export interface LossCutMonitorConfig {
  enabled: boolean
  pollingInterval: number // ms
  marginLevelThresholds: {
    warning: number // 150%
    danger: number // 100%
    critical: number // 50%
  }
  alertSettings: {
    enableSound: boolean
    enableDesktopNotification: boolean
    enableEmailAlert: boolean
  }
}

/**
 * 監視イベント
 */
export interface MonitoringEvent {
  id: string
  accountId: string
  type: 'margin_level_changed' | 'losscut_detected' | 'risk_level_changed'
  timestamp: Date
  data: {
    previousLevel?: number
    currentLevel: number
    riskLevel: RiskMonitoringState['riskLevel']
    message?: string
  }
}

/**
 * ロスカット警告
 */
export interface LossCutAlert {
  id: string
  accountId: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  marginLevel: number
  message: string
  timestamp: Date
  acknowledged: boolean
  autoResolve: boolean
}

/**
 * 監視状態
 */
export interface MonitoringStatus {
  isActive: boolean
  connectedAccounts: string[]
  lastUpdate: Date
  errors: string[]
}

/**
 * 監視エンジンのコールバック
 */
export interface MonitoringCallbacks {
  onRiskLevelChanged: (accountId: string, riskLevel: RiskMonitoringState['riskLevel']) => void
  onLossCutDetected: (accountId: string, marginLevel: number) => void
  onMarginLevelUpdate: (accountId: string, marginLevel: number) => void
  onError: (accountId: string, error: string) => void
}

/**
 * 口座のマージン情報
 */
export interface AccountMarginInfo {
  accountId: string
  balance: number
  equity: number
  freeMargin: number
  usedMargin: number
  marginLevel: number
  bonusAmount: number
  lastUpdate: Date
}

/**
 * 監視結果
 */
export interface MonitoringResult {
  accountId: string
  riskState: RiskMonitoringState
  alerts: LossCutAlert[]
  events: MonitoringEvent[]
}