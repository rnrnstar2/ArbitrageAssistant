'use client'

import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from 'react'
import { useRealtimeData, UseRealtimeDataOptions, UseRealtimeDataReturn } from '../hooks/useRealtimeData'
import { DashboardConfig, DashboardState, DashboardAction, DashboardFilter, Alert } from '../types'

export interface RealtimeDataContextState {
  // useRealtimeDataの結果
  realtimeData: UseRealtimeDataReturn
  
  // ダッシュボード設定
  config: DashboardConfig
  
  // ダッシュボード状態
  dashboardState: DashboardState
  
  // フィルター
  filter: DashboardFilter
}

export interface RealtimeDataContextActions {
  // 設定更新
  updateConfig: (config: Partial<DashboardConfig>) => void
  
  // フィルター操作
  setFilter: (filter: Partial<DashboardFilter>) => void
  resetFilter: () => void
  
  // アラート操作
  acknowledgeAlert: (alertId: string) => void
  clearAlerts: () => void
  
  // 状態操作
  updateDashboardState: (state: Partial<DashboardState>) => void
  
  // データ操作
  forceRefresh: () => void
  reconnect: () => void
}

export interface RealtimeDataContextValue extends RealtimeDataContextState, RealtimeDataContextActions {}

const RealtimeDataContext = createContext<RealtimeDataContextValue | null>(null)

// 初期設定
const defaultConfig: DashboardConfig = {
  updateFrequency: 1000,
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
      positionGrid: 50,
      marketData: 15,
      alerts: 10
    }
  },
  filters: {},
  alerts: {
    enableSounds: true,
    enablePopups: true,
    enableDesktopNotifications: false,
    soundVolume: 0.5
  }
}

const defaultDashboardState: DashboardState = {
  isLoading: false,
  error: null,
  lastUpdate: null,
  connectionStatus: 'disconnected',
  activeAlerts: [],
  selectedAccount: null,
  selectedPosition: null
}

const defaultFilter: DashboardFilter = {
  accountIds: [],
  clientPCIds: [],
  symbols: [],
  profitRange: {},
  dateRange: {},
  status: []
}

// Reducer for state management
function realtimeDataReducer(
  state: Pick<RealtimeDataContextState, 'config' | 'dashboardState' | 'filter'>,
  action: DashboardAction
): Pick<RealtimeDataContextState, 'config' | 'dashboardState' | 'filter'> {
  switch (action.type) {
    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.payload }
      }
    
    case 'UPDATE_STATE':
      return {
        ...state,
        dashboardState: { ...state.dashboardState, ...action.payload }
      }
    
    case 'SET_FILTER':
      return {
        ...state,
        filter: { ...state.filter, ...action.payload }
      }
    
    case 'RESET_FILTER':
      return {
        ...state,
        filter: { ...defaultFilter }
      }
    
    case 'ACKNOWLEDGE_ALERT':
      return {
        ...state,
        dashboardState: {
          ...state.dashboardState,
          activeAlerts: state.dashboardState.activeAlerts.map(alert =>
            alert.id === action.payload ? { ...alert, acknowledged: true } : alert
          )
        }
      }
    
    case 'CLEAR_ALERTS':
      return {
        ...state,
        dashboardState: {
          ...state.dashboardState,
          activeAlerts: []
        }
      }
    
    default:
      return state
  }
}

export interface RealtimeDataProviderProps {
  children: ReactNode
  options?: UseRealtimeDataOptions
  initialConfig?: Partial<DashboardConfig>
  enablePersistence?: boolean
}

export function RealtimeDataProvider({
  children,
  options = {},
  initialConfig = {},
  enablePersistence = true
}: RealtimeDataProviderProps) {
  // ローカルストレージから設定を読み込み
  const loadConfigFromStorage = useCallback((): DashboardConfig => {
    if (!enablePersistence || typeof window === 'undefined') {
      return { ...defaultConfig, ...initialConfig }
    }

    try {
      const stored = localStorage.getItem('dashboard-config')
      if (stored) {
        const parsedConfig = JSON.parse(stored)
        return { ...defaultConfig, ...parsedConfig, ...initialConfig }
      }
    } catch (error) {
      console.warn('Failed to load dashboard config from localStorage:', error)
    }

    return { ...defaultConfig, ...initialConfig }
  }, [initialConfig, enablePersistence])

  // 初期状態
  const [state, dispatch] = useReducer(realtimeDataReducer, {
    config: loadConfigFromStorage(),
    dashboardState: defaultDashboardState,
    filter: defaultFilter
  })

  // 設定をローカルストレージに保存
  const saveConfigToStorage = useCallback((config: DashboardConfig) => {
    if (!enablePersistence || typeof window === 'undefined') return

    try {
      localStorage.setItem('dashboard-config', JSON.stringify(config))
    } catch (error) {
      console.warn('Failed to save dashboard config to localStorage:', error)
    }
  }, [enablePersistence])

  // useRealtimeDataオプションの動的生成
  const realtimeOptions = useMemo((): UseRealtimeDataOptions => {
    const filterOptions: UseRealtimeDataOptions['updateFilters'] = {}
    
    if (state.filter.accountIds.length > 0) {
      filterOptions.accounts = state.filter.accountIds
    }
    
    if (state.filter.symbols.length > 0) {
      filterOptions.symbols = state.filter.symbols
    }

    return {
      enabled: state.config.autoRefresh,
      throttleMs: state.config.updateFrequency,
      updateFilters: filterOptions,
      ...options
    }
  }, [state.config.autoRefresh, state.config.updateFrequency, state.filter, options])

  // リアルタイムデータフック
  const realtimeData = useRealtimeData(realtimeOptions)

  // アクション関数
  const updateConfig = useCallback((newConfig: Partial<DashboardConfig>) => {
    const updatedConfig = { ...state.config, ...newConfig }
    dispatch({ type: 'UPDATE_CONFIG', payload: newConfig })
    saveConfigToStorage(updatedConfig)
  }, [state.config, saveConfigToStorage])

  const setFilter = useCallback((filter: Partial<DashboardFilter>) => {
    dispatch({ type: 'SET_FILTER', payload: filter })
  }, [])

  const resetFilter = useCallback(() => {
    dispatch({ type: 'RESET_FILTER' })
  }, [])

  const acknowledgeAlert = useCallback((alertId: string) => {
    dispatch({ type: 'ACKNOWLEDGE_ALERT', payload: alertId })
  }, [])

  const clearAlerts = useCallback(() => {
    dispatch({ type: 'CLEAR_ALERTS' })
  }, [])

  const updateDashboardState = useCallback((newState: Partial<DashboardState>) => {
    dispatch({ type: 'UPDATE_STATE', payload: newState })
  }, [])

  const forceRefresh = useCallback(() => {
    realtimeData.forceRefresh()
  }, [realtimeData])

  const reconnect = useCallback(() => {
    realtimeData.reconnect()
  }, [realtimeData])

  // ダッシュボード状態の同期
  React.useEffect(() => {
    const newState: Partial<DashboardState> = {
      isLoading: realtimeData.loading,
      error: realtimeData.error?.message || null,
      lastUpdate: realtimeData.lastUpdate,
      connectionStatus: realtimeData.connectionStatus,
      activeAlerts: realtimeData.data.alerts
    }

    dispatch({ type: 'UPDATE_STATE', payload: newState })
  }, [
    realtimeData.loading,
    realtimeData.error,
    realtimeData.lastUpdate,
    realtimeData.connectionStatus,
    realtimeData.data.alerts
  ])

  // コンテキスト値
  const contextValue: RealtimeDataContextValue = useMemo(() => ({
    // State
    realtimeData,
    config: state.config,
    dashboardState: state.dashboardState,
    filter: state.filter,
    
    // Actions
    updateConfig,
    setFilter,
    resetFilter,
    acknowledgeAlert,
    clearAlerts,
    updateDashboardState,
    forceRefresh,
    reconnect
  }), [
    realtimeData,
    state.config,
    state.dashboardState,
    state.filter,
    updateConfig,
    setFilter,
    resetFilter,
    acknowledgeAlert,
    clearAlerts,
    updateDashboardState,
    forceRefresh,
    reconnect
  ])

  return (
    <RealtimeDataContext.Provider value={contextValue}>
      {children}
    </RealtimeDataContext.Provider>
  )
}

// Context hook
export function useRealtimeDataContext(): RealtimeDataContextValue {
  const context = useContext(RealtimeDataContext)
  if (!context) {
    throw new Error('useRealtimeDataContext must be used within a RealtimeDataProvider')
  }
  return context
}

// 便利な個別フック
export function useRealtimeAccountData() {
  const { realtimeData } = useRealtimeDataContext()
  return {
    accounts: realtimeData.data.accounts,
    loading: realtimeData.loading,
    error: realtimeData.error
  }
}

export function useRealtimePositions() {
  const { realtimeData } = useRealtimeDataContext()
  return {
    positions: realtimeData.data.positions,
    loading: realtimeData.loading,
    error: realtimeData.error
  }
}

export function useRealtimeMarketData() {
  const { realtimeData } = useRealtimeDataContext()
  return {
    marketData: realtimeData.data.marketData,
    loading: realtimeData.loading,
    error: realtimeData.error
  }
}

export function useRealtimeAnalytics() {
  const { realtimeData } = useRealtimeDataContext()
  return {
    analytics: realtimeData.data.analytics,
    loading: realtimeData.loading,
    error: realtimeData.error
  }
}

export function useDashboardConfig() {
  const { config, updateConfig } = useRealtimeDataContext()
  return {
    config,
    updateConfig
  }
}

export function useDashboardFilter() {
  const { filter, setFilter, resetFilter } = useRealtimeDataContext()
  return {
    filter,
    setFilter,
    resetFilter
  }
}

export function useDashboardAlerts() {
  const { dashboardState, acknowledgeAlert, clearAlerts } = useRealtimeDataContext()
  return {
    alerts: dashboardState.activeAlerts,
    acknowledgeAlert,
    clearAlerts
  }
}