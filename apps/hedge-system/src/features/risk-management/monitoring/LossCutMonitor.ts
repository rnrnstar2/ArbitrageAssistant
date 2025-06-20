/**
 * Loss Cut Monitor
 * ロスカット監視メインエンジン
 */

import { EventEmitter } from 'events'
import { RiskStateManager } from './RiskStateManager'
import { MarginLevelMonitor } from './MarginLevelMonitor'
import type {
  LossCutMonitorConfig,
  MonitoringCallbacks,
  AccountMarginInfo,
  RiskMonitoringState,
  MonitoringStatus,
  MonitoringResult
} from '../types/risk-types'
import { validateMarginData } from '../utils/margin-calculations'

export class LossCutMonitor extends EventEmitter {
  private riskStateManager: RiskStateManager
  private marginLevelMonitor: MarginLevelMonitor
  private config: LossCutMonitorConfig
  private callbacks: Partial<MonitoringCallbacks>
  private isRunning = false
  private heartbeatTimer?: NodeJS.Timeout

  constructor(config: LossCutMonitorConfig, callbacks?: Partial<MonitoringCallbacks>) {
    super()
    this.config = config
    this.callbacks = callbacks || {}
    
    this.riskStateManager = new RiskStateManager()
    this.marginLevelMonitor = new MarginLevelMonitor(config)
    
    this.setupEventListeners()
    this.setMaxListeners(50)
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    // RiskStateManagerのイベント
    this.riskStateManager.on('riskLevelChanged', (accountId: string, riskLevel: RiskMonitoringState['riskLevel']) => {
      this.callbacks.onRiskLevelChanged?.(accountId, riskLevel)
      this.emit('riskLevelChanged', accountId, riskLevel)
    })

    this.riskStateManager.on('lossCutDetected', (accountId: string, marginLevel: number) => {
      this.callbacks.onLossCutDetected?.(accountId, marginLevel)
      this.emit('lossCutDetected', accountId, marginLevel)
    })

    this.riskStateManager.on('marginLevelUpdate', (accountId: string, marginLevel: number) => {
      this.callbacks.onMarginLevelUpdate?.(accountId, marginLevel)
      this.emit('marginLevelUpdate', accountId, marginLevel)
    })

    this.riskStateManager.on('error', (accountId: string, error: string) => {
      this.callbacks.onError?.(accountId, error)
      this.emit('error', accountId, error)
    })

    this.riskStateManager.on('alertGenerated', (accountId: string, alert: any) => {
      this.emit('alertGenerated', accountId, alert)
    })

    // MarginLevelMonitorのイベント
    this.marginLevelMonitor.on('warningThresholdReached', (data) => {
      this.emit('warningThresholdReached', data)
    })

    this.marginLevelMonitor.on('dangerThresholdReached', (data) => {
      this.emit('dangerThresholdReached', data)
    })

    this.marginLevelMonitor.on('criticalThresholdReached', (data) => {
      this.emit('criticalThresholdReached', data)
    })

    this.marginLevelMonitor.on('losscutLevelReached', (data) => {
      this.emit('losscutLevelReached', data)
    })

    this.marginLevelMonitor.on('rapidMarginChange', (data) => {
      this.emit('rapidMarginChange', data)
    })

    this.marginLevelMonitor.on('requestMarginData', (accountId: string) => {
      // EA接続マネージャーからデータを要求
      this.emit('requestMarginData', accountId)
    })
  }

  /**
   * 監視を開始
   */
  start(): void {
    if (this.isRunning) {
      console.warn('LossCutMonitor is already running')
      return
    }

    if (!this.config.enabled) {
      console.warn('LossCutMonitor is disabled in config')
      return
    }

    this.isRunning = true
    this.startHeartbeat()
    this.emit('started')
    
    console.log('LossCutMonitor started')
  }

  /**
   * 監視を停止
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    this.stopHeartbeat()
    this.marginLevelMonitor.stopAllMonitoring()
    this.emit('stopped')
    
    console.log('LossCutMonitor stopped')
  }

  /**
   * アカウントを監視に追加
   */
  addAccount(accountId: string, broker: string = ''): void {
    if (!this.isRunning) {
      throw new Error('LossCutMonitor is not running')
    }

    this.marginLevelMonitor.startMonitoring(accountId, broker)
    this.emit('accountAdded', accountId)
  }

  /**
   * アカウントを監視から削除
   */
  removeAccount(accountId: string): void {
    this.marginLevelMonitor.stopMonitoring(accountId)
    this.riskStateManager.removeAccount(accountId)
    this.emit('accountRemoved', accountId)
  }

  /**
   * マージンデータを処理
   */
  processMarginData(marginInfo: AccountMarginInfo, broker: string = ''): void {
    if (!this.isRunning) {
      return
    }

    if (!validateMarginData(marginInfo)) {
      this.emit('error', marginInfo.accountId, 'Invalid margin data received')
      return
    }

    try {
      // RiskStateManagerでリスク状態を更新
      this.riskStateManager.updateMarginInfo(marginInfo)
      
      // MarginLevelMonitorで詳細な監視処理
      this.marginLevelMonitor.processMarginLevel(marginInfo, broker)
      
      this.emit('dataProcessed', marginInfo.accountId)
    } catch (error) {
      this.emit('error', marginInfo.accountId, `Failed to process margin data: ${error}`)
    }
  }

  /**
   * 監視結果を取得
   */
  getMonitoringResult(accountId: string): MonitoringResult | undefined {
    const riskState = this.riskStateManager.getRiskState(accountId)
    if (!riskState) {
      return undefined
    }

    const alerts = this.riskStateManager.getAlerts(accountId)
    const events = this.riskStateManager.getEvents(accountId)

    return {
      accountId,
      riskState,
      alerts,
      events
    }
  }

  /**
   * すべての監視結果を取得
   */
  getAllMonitoringResults(): MonitoringResult[] {
    const results: MonitoringResult[] = []
    const allStates = this.riskStateManager.getAllRiskStates()

    for (const [accountId, riskState] of allStates) {
      const alerts = this.riskStateManager.getAlerts(accountId)
      const events = this.riskStateManager.getEvents(accountId)
      
      results.push({
        accountId,
        riskState,
        alerts,
        events
      })
    }

    return results
  }

  /**
   * 監視ステータスを取得
   */
  getStatus(): MonitoringStatus {
    const baseStatus = this.riskStateManager.getMonitoringStatus()
    
    return {
      ...baseStatus,
      isActive: this.isRunning && baseStatus.isActive
    }
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<LossCutMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.marginLevelMonitor.updateConfig(newConfig)
    this.emit('configUpdated', this.config)

    // 有効/無効の状態が変わった場合
    if (newConfig.enabled !== undefined) {
      if (newConfig.enabled && !this.isRunning) {
        this.start()
      } else if (!newConfig.enabled && this.isRunning) {
        this.stop()
      }
    }
  }

  /**
   * アラートを確認済みにする
   */
  acknowledgeAlert(alertId: string): void {
    this.riskStateManager.acknowledgeAlert(alertId)
  }

  /**
   * ハートビートを開始
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.emit('heartbeat', {
        timestamp: new Date(),
        status: this.getStatus(),
        statistics: this.getStatistics()
      })
    }, 30000) // 30秒間隔
  }

  /**
   * ハートビートを停止
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    const riskStats = this.riskStateManager.getStatistics()
    const monitorStats = this.marginLevelMonitor.getStatistics()

    return {
      ...riskStats,
      ...monitorStats,
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - (this.startTime || Date.now()) : 0
    }
  }

  private startTime?: number

  /**
   * 監視システムを初期化
   */
  initialize(): void {
    this.startTime = Date.now()
    this.emit('initialized')
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.stop()
    this.marginLevelMonitor.destroy()
    this.riskStateManager.clear()
    this.removeAllListeners()
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): LossCutMonitorConfig {
    return { ...this.config }
  }

  /**
   * 監視中のアカウント一覧を取得
   */
  getMonitoringAccounts(): string[] {
    return this.marginLevelMonitor.getMonitoringAccounts()
  }

  /**
   * 緊急停止
   */
  emergencyStop(): void {
    console.warn('Emergency stop triggered')
    this.stop()
    this.emit('emergencyStop')
  }

  /**
   * システムヘルスチェック
   */
  healthCheck(): { healthy: boolean; issues: string[] } {
    const issues: string[] = []

    if (!this.isRunning) {
      issues.push('Monitor is not running')
    }

    const status = this.getStatus()
    if (status.errors.length > 0) {
      issues.push(...status.errors)
    }

    const monitoringAccounts = this.getMonitoringAccounts()
    if (monitoringAccounts.length === 0) {
      issues.push('No accounts being monitored')
    }

    return {
      healthy: issues.length === 0,
      issues
    }
  }
}