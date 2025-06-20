// リスク管理ダッシュボード関連コンポーネント
export { RiskDashboard } from './RiskDashboard'
export { AccountRiskCard } from './AccountRiskCard'
export { RiskAlertDisplay, EmergencyAlertBanner } from './RiskAlertDisplay'
export { RiskControlPanel } from './RiskControlPanel'

// 型定義（RiskDashboard.tsxから再エクスポート）
export interface RiskDisplayData {
  accountId: string
  accountName: string
  marginLevel: number
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical'
  freeMargin: number
  usedMargin: number
  activePositions: number
  nextAction?: string
  lastUpdate: Date
  predictions?: {
    trend: 'improving' | 'deteriorating' | 'stable'
    timeToLossCut?: number
  }
}

// 使用例とサンプルデータ
export const sampleRiskData: RiskDisplayData[] = [
  {
    accountId: 'acc1',
    accountName: 'XM Trading - 123456',
    marginLevel: 45.2,
    riskLevel: 'critical',
    freeMargin: -1500,
    usedMargin: 3000,
    activePositions: 5,
    nextAction: '部分決済を検討',
    lastUpdate: new Date(),
    predictions: {
      trend: 'deteriorating',
      timeToLossCut: 15
    }
  },
  {
    accountId: 'acc2',
    accountName: 'FXGT - 789012',
    marginLevel: 85.7,
    riskLevel: 'danger',
    freeMargin: 500,
    usedMargin: 2500,
    activePositions: 3,
    lastUpdate: new Date(),
    predictions: {
      trend: 'stable',
      timeToLossCut: 240
    }
  },
  {
    accountId: 'acc3',
    accountName: 'Exness - 345678',
    marginLevel: 165.3,
    riskLevel: 'warning',
    freeMargin: 1200,
    usedMargin: 1800,
    activePositions: 2,
    lastUpdate: new Date(),
    predictions: {
      trend: 'improving'
    }
  },
  {
    accountId: 'acc4',
    accountName: 'TitanFX - 901234',
    marginLevel: 250.8,
    riskLevel: 'safe',
    freeMargin: 2500,
    usedMargin: 1000,
    activePositions: 1,
    lastUpdate: new Date(),
    predictions: {
      trend: 'stable'
    }
  }
]