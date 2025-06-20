/**
 * Risk State Manager
 * リスク状態管理クラス
 */

import { EventEmitter } from 'events'
import type {
  RiskMonitoringState,
  MonitoringEvent,
  LossCutAlert,
  MonitoringStatus,
  AccountMarginInfo
} from '../types/risk-types'
import {
  createRiskMonitoringState,
  calculateRiskLevel,
  validateMarginData
} from '../utils/margin-calculations'

export class RiskStateManager extends EventEmitter {
  private riskStates = new Map<string, RiskMonitoringState>()
  private alerts = new Map<string, LossCutAlert[]>()
  private events = new Map<string, MonitoringEvent[]>()
  private marginLevelHistory = new Map<string, number[]>()
  private readonly historyLimit = 100

  constructor() {
    super()
    this.setMaxListeners(50)
  }

  /**
   * アカウントのマージン情報を更新
   */
  updateMarginInfo(marginInfo: AccountMarginInfo): void {
    if (!validateMarginData(marginInfo)) {
      this.emit('error', marginInfo.accountId, 'Invalid margin data')
      return
    }

    const { accountId } = marginInfo
    const previousState = this.riskStates.get(accountId)
    const newState = createRiskMonitoringState(marginInfo)

    // 履歴を更新
    this.updateMarginLevelHistory(accountId, marginInfo.marginLevel)

    // 状態を更新
    this.riskStates.set(accountId, newState)

    // イベントを記録
    this.recordEvent(accountId, 'margin_level_changed', {
      previousLevel: previousState?.marginLevel,
      currentLevel: marginInfo.marginLevel,
      riskLevel: newState.riskLevel
    })

    // リスクレベルが変化した場合
    if (previousState && previousState.riskLevel !== newState.riskLevel) {
      this.handleRiskLevelChange(accountId, previousState.riskLevel, newState.riskLevel)
    }

    // 証拠金維持率更新を通知
    this.emit('marginLevelUpdate', accountId, marginInfo.marginLevel)

    // クリティカル状態の場合、アラートを生成
    if (newState.riskLevel === 'critical') {
      this.generateCriticalAlert(accountId, marginInfo.marginLevel)
    }
  }

  /**
   * リスクレベル変化の処理
   */
  private handleRiskLevelChange(
    accountId: string,
    previousLevel: RiskMonitoringState['riskLevel'],
    newLevel: RiskMonitoringState['riskLevel']
  ): void {
    this.recordEvent(accountId, 'risk_level_changed', {
      currentLevel: 0, // marginLevelは別途記録済み
      riskLevel: newLevel,
      message: `Risk level changed from ${previousLevel} to ${newLevel}`
    })

    this.emit('riskLevelChanged', accountId, newLevel)

    // クリティカル状態に入った場合
    if (newLevel === 'critical' && previousLevel !== 'critical') {
      this.emit('lossCutDetected', accountId, this.riskStates.get(accountId)?.marginLevel || 0)
    }
  }

  /**
   * クリティカルアラートを生成
   */
  private generateCriticalAlert(accountId: string, marginLevel: number): void {
    const alert: LossCutAlert = {
      id: `${accountId}-critical-${Date.now()}`,
      accountId,
      severity: 'critical',
      marginLevel,
      message: `Critical margin level: ${marginLevel.toFixed(2)}%`,
      timestamp: new Date(),
      acknowledged: false,
      autoResolve: false
    }

    this.addAlert(accountId, alert)
  }

  /**
   * アラートを追加
   */
  addAlert(accountId: string, alert: LossCutAlert): void {
    const accountAlerts = this.alerts.get(accountId) || []
    accountAlerts.push(alert)
    this.alerts.set(accountId, accountAlerts)

    this.emit('alertGenerated', accountId, alert)
  }

  /**
   * イベントを記録
   */
  private recordEvent(
    accountId: string,
    type: MonitoringEvent['type'],
    data: MonitoringEvent['data']
  ): void {
    const event: MonitoringEvent = {
      id: `${accountId}-${type}-${Date.now()}`,
      accountId,
      type,
      timestamp: new Date(),
      data
    }

    const accountEvents = this.events.get(accountId) || []
    accountEvents.push(event)

    // 最新100件を保持
    if (accountEvents.length > this.historyLimit) {
      accountEvents.splice(0, accountEvents.length - this.historyLimit)
    }

    this.events.set(accountId, accountEvents)
    this.emit('eventRecorded', accountId, event)
  }

  /**
   * 証拠金維持率履歴を更新
   */
  private updateMarginLevelHistory(accountId: string, marginLevel: number): void {
    const history = this.marginLevelHistory.get(accountId) || []
    history.push(marginLevel)

    // 最新100件を保持
    if (history.length > this.historyLimit) {
      history.splice(0, history.length - this.historyLimit)
    }

    this.marginLevelHistory.set(accountId, history)
  }

  /**
   * アカウントのリスク状態を取得
   */
  getRiskState(accountId: string): RiskMonitoringState | undefined {
    return this.riskStates.get(accountId)
  }

  /**
   * すべてのリスク状態を取得
   */
  getAllRiskStates(): Map<string, RiskMonitoringState> {
    return new Map(this.riskStates)
  }

  /**
   * アカウントのアラートを取得
   */
  getAlerts(accountId: string): LossCutAlert[] {
    return this.alerts.get(accountId) || []
  }

  /**
   * アカウントのイベントを取得
   */
  getEvents(accountId: string): MonitoringEvent[] {
    return this.events.get(accountId) || []
  }

  /**
   * 証拠金維持率履歴を取得
   */
  getMarginLevelHistory(accountId: string): number[] {
    return this.marginLevelHistory.get(accountId) || []
  }

  /**
   * アラートを確認済みにする
   */
  acknowledgeAlert(alertId: string): void {
    for (const accountAlerts of this.alerts.values()) {
      const alert = accountAlerts.find(a => a.id === alertId)
      if (alert) {
        alert.acknowledged = true
        this.emit('alertAcknowledged', alert.accountId, alertId)
        break
      }
    }
  }

  /**
   * 監視状態を取得
   */
  getMonitoringStatus(): MonitoringStatus {
    const connectedAccounts = Array.from(this.riskStates.keys())
    const errors: string[] = []

    // 古いデータをチェック
    const now = Date.now()
    for (const [accountId, state] of this.riskStates) {
      if (now - state.lastUpdate.getTime() > 60000) { // 1分以上更新がない
        errors.push(`Account ${accountId}: No data for over 1 minute`)
      }
    }

    return {
      isActive: connectedAccounts.length > 0,
      connectedAccounts,
      lastUpdate: new Date(),
      errors
    }
  }

  /**
   * アカウントの監視を停止
   */
  removeAccount(accountId: string): void {
    this.riskStates.delete(accountId)
    this.alerts.delete(accountId)
    this.events.delete(accountId)
    this.marginLevelHistory.delete(accountId)

    this.emit('accountRemoved', accountId)
  }

  /**
   * すべてのデータをクリア
   */
  clear(): void {
    this.riskStates.clear()
    this.alerts.clear()
    this.events.clear()
    this.marginLevelHistory.clear()

    this.emit('cleared')
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    const states = Array.from(this.riskStates.values())
    const riskLevels = {
      safe: states.filter(s => s.riskLevel === 'safe').length,
      warning: states.filter(s => s.riskLevel === 'warning').length,
      danger: states.filter(s => s.riskLevel === 'danger').length,
      critical: states.filter(s => s.riskLevel === 'critical').length
    }

    const totalAlerts = Array.from(this.alerts.values())
      .reduce((total, alerts) => total + alerts.length, 0)

    const unacknowledgedAlerts = Array.from(this.alerts.values())
      .reduce((total, alerts) => total + alerts.filter(a => !a.acknowledged).length, 0)

    return {
      totalAccounts: states.length,
      riskLevels,
      totalAlerts,
      unacknowledgedAlerts,
      averageMarginLevel: states.length > 0 
        ? states.reduce((sum, s) => sum + s.marginLevel, 0) / states.length
        : 0
    }
  }
}