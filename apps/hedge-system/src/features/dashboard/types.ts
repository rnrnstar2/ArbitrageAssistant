export interface DashboardConfig {
  updateFrequency: number
  autoRefresh: boolean
  displaySettings: {
    compactView: boolean
    showProfitColors: boolean
    showRiskMetrics: boolean
    showConnectionStatus: boolean
    showAlertsPanel: boolean
  }
  layout: {
    showAccountSummary: boolean
    showPositionGrid: boolean
    showMarketData: boolean
    showAlerts: boolean
    panelSizes: {
      accountSummary: number
      positionGrid: number
      marketData: number
      alerts: number
    }
  }
  filters: {
    accountIds?: string[]
    clientPCIds?: string[]
    symbols?: string[]
    profitThreshold?: number
  }
  alerts: {
    enableSounds: boolean
    enablePopups: boolean
    enableDesktopNotifications: boolean
    soundVolume: number
  }
}

export interface DashboardState {
  isLoading: boolean
  error: string | null
  lastUpdate: Date | null
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
  activeAlerts: Alert[]
  selectedAccount: string | null
  selectedPosition: string | null
}

export interface RealtimeDashboardData {
  accounts: Account[]
  positions: Position[]
  marketData: MarketData[]
  alerts: Alert[]
  systemStatus: SystemStatus
  analytics: DashboardAnalytics
}

export interface DashboardAnalytics {
  totalAccounts: number
  connectedAccounts: number
  totalPositions: number
  totalProfit: number
  totalExposure: number
  riskScore: number
  marginUtilization: number
  exposureBySymbol: Record<string, number>
  profitByAccount: Record<string, number>
}

export interface MarketData {
  symbol: string
  bid: number
  ask: number
  spread: number
  timestamp: Date
  volume?: number
  high24h?: number
  low24h?: number
  change24h?: number
}

export interface SystemStatus {
  uptime: number
  connectionCount: number
  dataLatency: number
  memoryUsage: number
  cpuUsage: number
  lastHealthCheck: Date
  version: string
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
  status: 'connected' | 'disconnected' | 'error'
  lastUpdate: Date
  positions: Position[]
}

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

export interface Alert {
  id: string
  type: 'margin_level' | 'profit_loss' | 'connection_lost' | 'large_position' | 'system_error'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
  accountId?: string
  positionId?: string
  acknowledged: boolean
  autoResolve: boolean
  data?: Record<string, any>
}

export interface DashboardViewMode {
  mode: 'overview' | 'positions' | 'accounts' | 'analytics' | 'alerts'
  subMode?: string
}

export interface DashboardFilter {
  accountIds: string[]
  clientPCIds: string[]
  symbols: string[]
  profitRange: {
    min?: number
    max?: number
  }
  dateRange: {
    start?: Date
    end?: Date
  }
  status: string[]
}

export interface DashboardAction {
  type: 'UPDATE_CONFIG' | 'UPDATE_STATE' | 'UPDATE_DATA' | 'ACKNOWLEDGE_ALERT' | 'CLEAR_ALERTS' | 'SET_FILTER' | 'RESET_FILTER'
  payload?: any
}