import { DashboardConfig } from './types'

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  updateFrequency: 1,
  autoRefresh: true,
  displaySettings: {
    compactView: false,
    showProfitColors: true,
    showRiskMetrics: true,
    showConnectionStatus: true,
    showAlertsPanel: true
  },
  layout: {
    showAccountSummary: true,
    showPositionGrid: true,
    showMarketData: true,
    showAlerts: true,
    panelSizes: {
      accountSummary: 25,
      positionGrid: 40,
      marketData: 20,
      alerts: 15
    }
  },
  filters: {},
  alerts: {
    enableSounds: true,
    enablePopups: true,
    enableDesktopNotifications: true,
    soundVolume: 0.5
  }
}

export const DASHBOARD_UPDATE_INTERVALS = {
  REALTIME: 1000,
  FAST: 2000,
  NORMAL: 5000,
  SLOW: 10000
} as const

export const DASHBOARD_THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  AUTO: 'auto'
} as const

export const RISK_LEVELS = {
  LOW: {
    threshold: 0.3,
    color: 'green',
    label: '低リスク'
  },
  MEDIUM: {
    threshold: 0.6,
    color: 'yellow',
    label: '中リスク'
  },
  HIGH: {
    threshold: 0.8,
    color: 'orange',
    label: '高リスク'
  },
  CRITICAL: {
    threshold: 1.0,
    color: 'red',
    label: '危険'
  }
} as const

export const ALERT_SEVERITIES = {
  LOW: {
    color: 'blue',
    priority: 1,
    autoResolve: true,
    sound: false
  },
  MEDIUM: {
    color: 'yellow',
    priority: 2,
    autoResolve: false,
    sound: true
  },
  HIGH: {
    color: 'orange',
    priority: 3,
    autoResolve: false,
    sound: true
  },
  CRITICAL: {
    color: 'red',
    priority: 4,
    autoResolve: false,
    sound: true
  }
} as const

export const CONNECTION_STATUS = {
  CONNECTED: {
    color: 'green',
    label: '接続中',
    icon: '🟢'
  },
  DISCONNECTED: {
    color: 'gray',
    label: '切断',
    icon: '⚫'
  },
  CONNECTING: {
    color: 'yellow',
    label: '接続中...',
    icon: '🟡'
  },
  ERROR: {
    color: 'red',
    label: 'エラー',
    icon: '🔴'
  }
} as const

export const POSITION_TYPES = {
  BUY: {
    label: '買い',
    color: 'blue',
    icon: '📈'
  },
  SELL: {
    label: '売り',
    color: 'red',
    icon: '📉'
  }
} as const

export const DASHBOARD_LAYOUT_PRESETS = {
  COMPACT: {
    name: 'コンパクト',
    panelSizes: {
      accountSummary: 30,
      positionGrid: 50,
      marketData: 20,
      alerts: 0
    },
    displaySettings: {
      compactView: true,
      showProfitColors: true,
      showRiskMetrics: false,
      showConnectionStatus: true,
      showAlertsPanel: false
    }
  },
  STANDARD: {
    name: 'スタンダード',
    panelSizes: {
      accountSummary: 25,
      positionGrid: 40,
      marketData: 20,
      alerts: 15
    },
    displaySettings: {
      compactView: false,
      showProfitColors: true,
      showRiskMetrics: true,
      showConnectionStatus: true,
      showAlertsPanel: true
    }
  },
  DETAILED: {
    name: '詳細',
    panelSizes: {
      accountSummary: 20,
      positionGrid: 35,
      marketData: 25,
      alerts: 20
    },
    displaySettings: {
      compactView: false,
      showProfitColors: true,
      showRiskMetrics: true,
      showConnectionStatus: true,
      showAlertsPanel: true
    }
  }
} as const

export const MARKET_SYMBOLS = [
  'USDJPY',
  'EURJPY',
  'GBPJPY',
  'AUDJPY',
  'EURUSD',
  'GBPUSD',
  'AUDUSD',
  'USDCAD',
  'USDCHF',
  'NZDUSD'
] as const

export const BROKERS = [
  'XMTrading',
  'GEMFOREX',
  'FXGT',
  'Exness',
  'TitanFX',
  'iFOREX',
  'HotForex',
  'FBS',
  'IC Markets',
  'Axiory'
] as const

export const PERFORMANCE_METRICS = {
  DATA_LATENCY: {
    excellent: 100,
    good: 500,
    fair: 1000,
    poor: 2000
  },
  UPDATE_FREQUENCY: {
    min: 0.1,
    max: 10.0,
    default: 1.0
  },
  CONNECTION_TIMEOUT: {
    default: 30000,
    min: 5000,
    max: 120000
  }
} as const