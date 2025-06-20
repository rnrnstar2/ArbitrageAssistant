export interface Position {
  id: string
  accountId: string
  symbol: string
  type: 'buy' | 'sell'
  lots: number
  openPrice: number
  currentPrice: number
  profit: number
  trailSettings?: TrailSettings
  nextAction?: NextAction
  relatedPositionId?: string
  closeSettings?: CloseSettings
  openTime: Date
  updateTime: Date
}

export interface Account {
  id: string
  clientPCId: string
  broker: string
  accountNumber: string
  balance: number
  equity: number
  margin: number
  marginLevel: number
  bonusAmount: number
  positions: Position[]
  status: 'connected' | 'disconnected' | 'error'
}

export interface ClientPC {
  id: string
  userId: string
  name: string
  status: 'online' | 'offline'
  accounts: Account[]
  lastHeartbeat: Date
}

export interface TrailSettings {
  enabled: boolean
  trailDistance: number
  stepSize: number
  startTrigger: number
}

export interface NextAction {
  type: 'close' | 'trail' | 'hedge' | 'wait'
  conditions: Record<string, any>
  priority: number
}

export interface CloseSettings {
  targetPrice: number
  trailSettings?: TrailSettings
  linkedCloseAction?: {
    positionId: string
    action: 'close' | 'trail'
    settings?: TrailSettings
  }
}

export interface PositionFilters {
  accountIds?: string[]
  symbols?: string[]
  profitThreshold?: number
  clientPCIds?: string[]
  status?: ('open' | 'closed')[]
}

export interface AlertRule {
  id: string
  name: string
  type: 'margin_level' | 'profit_loss' | 'connection_lost' | 'large_position'
  threshold: number
  actions: {
    showNotification: boolean
    playSound: boolean
    sendEmail: boolean
    autoClose?: boolean
  }
  isActive: boolean
  conditions: Record<string, any>
}

export interface Alert {
  id: string
  ruleId: string
  type: AlertRule['type']
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  accountId?: string
  positionId?: string
  acknowledged: boolean
}

export interface LossCutPrediction {
  accountId: string
  currentMarginLevel: number
  lossCutLevel: number
  estimatedTimeToLossCut?: number
  requiredDeposit?: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface RealtimeAnalytics {
  totalExposure: number
  netPosition: number
  totalProfit: number
  totalLoss: number
  riskScore: number
  exposureBySymbol: Record<string, number>
  marginUtilization: number
  averageSpread: number
}

export interface PositionMonitorConfig {
  updateFrequency: number
  filters: PositionFilters
  displaySettings: {
    showProfitColors: boolean
    showTrailIndicators: boolean
    showRiskMetrics: boolean
    compactView: boolean
  }
  alertSettings: {
    enableSounds: boolean
    enablePopups: boolean
    autoRefresh: boolean
  }
}