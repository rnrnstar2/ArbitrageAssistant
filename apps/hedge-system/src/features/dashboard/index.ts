// Types
export type {
  DashboardConfig,
  DashboardState,
  RealtimeDashboardData,
  DashboardAnalytics,
  MarketData,
  SystemStatus,
  Account,
  Position,
  TrailSettings,
  NextAction,
  CloseSettings,
  Alert,
  DashboardViewMode,
  DashboardFilter,
  DashboardAction
} from './types'

// Configuration
export {
  DEFAULT_DASHBOARD_CONFIG,
  DASHBOARD_UPDATE_INTERVALS,
  DASHBOARD_THEMES,
  RISK_LEVELS,
  ALERT_SEVERITIES,
  CONNECTION_STATUS,
  POSITION_TYPES,
  DASHBOARD_LAYOUT_PRESETS,
  MARKET_SYMBOLS,
  BROKERS,
  PERFORMANCE_METRICS
} from './dashboard-config'

// Components
export { AccountSummaryDashboard } from './components/AccountSummaryDashboard'
// TODO: Implement remaining dashboard components in future tasks
// export { RealtimePositionGrid } from './components/RealtimePositionGrid'
// export { MarketDataDisplay } from './components/MarketDataDisplay'
// export { AlertManager } from './components/AlertManager'
// export { DashboardLayout } from './components/DashboardLayout'

// Hooks
export { useRealtimeAccountSummary } from './hooks/useRealtimeAccountSummary'
export { 
  useRealtimeData, 
  RealtimeDataCacheManager,
  type UseRealtimeDataOptions,
  type UseRealtimeDataReturn 
} from './hooks/useRealtimeData'

// Context
export {
  RealtimeDataProvider,
  useRealtimeDataContext,
  useRealtimeAccountData,
  useRealtimePositions,
  useRealtimeMarketData,
  useRealtimeAnalytics,
  useDashboardConfig,
  useDashboardFilter,
  useDashboardAlerts,
  type RealtimeDataContextValue,
  type RealtimeDataProviderProps
} from './context/RealtimeDataContext'

// Performance Optimization
export {
  useMemoizedCalculation,
  usePerformanceMonitor,
  useEfficientArrayUpdate,
  useThrottledCallback,
  useVirtualizedItems,
  usePerformanceDebugger,
  CalculationWorkerManager,
  getCalculationWorker,
  type PerformanceStats
} from './utils/performance-optimizer'

// Data Persistence Services
export {
  DataPersistenceService,
  PositionPersistenceService,
  MarketDataPersistenceService,
  getPersistenceService,
  usePersistence,
  usePositionPersistence,
  useMarketDataPersistence,
  PersistenceManager,
  PersistenceMonitor,
  exportAllData,
  importAllData,
  createPersistenceManager,
  initializePersistence,
  type PersistenceEntry,
  type HistoryEntry,
  type PersistenceStats,
  type PersistenceConfig,
  type DataChanges,
  type PersistenceHookOptions
} from './services'

// TODO: Implement remaining dashboard hooks in future tasks
// export { useDashboardState } from './hooks/useDashboardState'
// export { useRealtimeDashboard } from './hooks/useRealtimeDashboard'