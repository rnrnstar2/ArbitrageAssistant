/**
 * Margin Level Monitor
 * 証拠金維持率監視クラス
 */

import { EventEmitter } from 'events'
import type {
  LossCutMonitorConfig,
  AccountMarginInfo,
  RiskMonitoringState
} from '../types/risk-types'
import {
  calculateRiskLevel,
  predictTimeToCritical,
  getMarginCallThreshold
} from '../utils/margin-calculations'

export class MarginLevelMonitor extends EventEmitter {
  private config: LossCutMonitorConfig
  private monitoringTimers = new Map<string, NodeJS.Timeout>()
  private lastMarginLevels = new Map<string, number>()
  private marginTrends = new Map<string, number[]>()
  private readonly trendHistorySize = 10

  constructor(config: LossCutMonitorConfig) {
    super()
    this.config = config
    this.setMaxListeners(50)
  }

  /**
   * アカウントの監視を開始
   */
  startMonitoring(accountId: string, broker: string = ''): void {
    if (this.monitoringTimers.has(accountId)) {
      this.stopMonitoring(accountId)
    }

    const timer = setInterval(() => {
      this.checkMarginLevel(accountId, broker)
    }, this.config.pollingInterval)

    this.monitoringTimers.set(accountId, timer)
    this.emit('monitoringStarted', accountId)
  }

  /**
   * アカウントの監視を停止
   */
  stopMonitoring(accountId: string): void {
    const timer = this.monitoringTimers.get(accountId)
    if (timer) {
      clearInterval(timer)
      this.monitoringTimers.delete(accountId)
      this.emit('monitoringStopped', accountId)
    }
  }

  /**
   * 証拠金維持率をチェック
   */
  private checkMarginLevel(accountId: string, broker: string): void {
    // 実際の実装では、EAConnectionManagerから最新データを取得
    // ここではダミーデータでの処理例を示す
    this.emit('requestMarginData', accountId)
  }

  /**
   * 証拠金維持率データを処理
   */
  processMarginLevel(accountId: string, marginInfo: AccountMarginInfo, broker: string = ''): void {
    const { marginLevel } = marginInfo
    const previousLevel = this.lastMarginLevels.get(accountId)
    
    // 履歴を更新
    this.updateTrendHistory(accountId, marginLevel)
    this.lastMarginLevels.set(accountId, marginLevel)

    // リスクレベルを計算
    const riskLevel = calculateRiskLevel(marginLevel)
    const thresholds = getMarginCallThreshold(broker)

    // しきい値チェック
    this.checkThresholds(accountId, marginLevel, thresholds, riskLevel)

    // 予測計算
    const trend = this.marginTrends.get(accountId) || []
    const timeToCritical = predictTimeToCritical(marginLevel, trend, thresholds.losscut)

    // 証拠金維持率変化を通知
    this.emit('marginLevelChanged', {
      accountId,
      marginLevel,
      previousLevel,
      riskLevel,
      timeToCritical,
      trend: this.calculateTrendDirection(trend)
    })

    // 急激な変化をチェック
    if (previousLevel !== undefined) {
      this.checkRapidChange(accountId, previousLevel, marginLevel)
    }
  }

  /**
   * しきい値チェック
   */
  private checkThresholds(
    accountId: string,
    marginLevel: number,
    thresholds: { marginCall: number; losscut: number },
    riskLevel: RiskMonitoringState['riskLevel']
  ): void {
    const { warning, danger, critical } = this.config.marginLevelThresholds

    // 警告レベル
    if (marginLevel <= warning && marginLevel > danger) {
      this.emit('warningThresholdReached', {
        accountId,
        marginLevel,
        threshold: warning,
        message: `Warning: Margin level is ${marginLevel.toFixed(2)}%`
      })
    }

    // 危険レベル
    if (marginLevel <= danger && marginLevel > critical) {
      this.emit('dangerThresholdReached', {
        accountId,
        marginLevel,
        threshold: danger,
        message: `Danger: Margin level is ${marginLevel.toFixed(2)}%`
      })
    }

    // クリティカルレベル
    if (marginLevel <= critical) {
      this.emit('criticalThresholdReached', {
        accountId,
        marginLevel,
        threshold: critical,
        message: `Critical: Margin level is ${marginLevel.toFixed(2)}%`
      })
    }

    // ロスカットレベル
    if (marginLevel <= thresholds.losscut) {
      this.emit('losscutLevelReached', {
        accountId,
        marginLevel,
        threshold: thresholds.losscut,
        message: `Losscut imminent: Margin level is ${marginLevel.toFixed(2)}%`
      })
    }
  }

  /**
   * 急激な変化をチェック
   */
  private checkRapidChange(accountId: string, previousLevel: number, currentLevel: number): void {
    const change = currentLevel - previousLevel
    const percentChange = (change / previousLevel) * 100

    // 5%以上の急激な変化をチェック
    if (Math.abs(percentChange) >= 5) {
      this.emit('rapidMarginChange', {
        accountId,
        previousLevel,
        currentLevel,
        change,
        percentChange,
        direction: change > 0 ? 'improving' : 'deteriorating'
      })
    }
  }

  /**
   * トレンド履歴を更新
   */
  private updateTrendHistory(accountId: string, marginLevel: number): void {
    const trend = this.marginTrends.get(accountId) || []
    trend.push(marginLevel)

    // 指定サイズを超えた場合、古いデータを削除
    if (trend.length > this.trendHistorySize) {
      trend.splice(0, trend.length - this.trendHistorySize)
    }

    this.marginTrends.set(accountId, trend)
  }

  /**
   * トレンドの方向を計算
   */
  private calculateTrendDirection(trend: number[]): 'improving' | 'deteriorating' | 'stable' {
    if (trend.length < 3) return 'stable'

    const recent = trend.slice(-3)
    const first = recent[0]
    const last = recent[recent.length - 1]
    const change = last - first

    if (change > 5) return 'improving'
    if (change < -5) return 'deteriorating'
    return 'stable'
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<LossCutMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.emit('configUpdated', this.config)

    // ポーリング間隔が変更された場合、全監視を再開
    if (newConfig.pollingInterval && newConfig.pollingInterval !== this.config.pollingInterval) {
      this.restartAllMonitoring()
    }
  }

  /**
   * すべての監視を再開
   */
  private restartAllMonitoring(): void {
    const accountIds = Array.from(this.monitoringTimers.keys())
    accountIds.forEach(accountId => {
      this.stopMonitoring(accountId)
      this.startMonitoring(accountId)
    })
  }

  /**
   * 監視中のアカウント一覧を取得
   */
  getMonitoringAccounts(): string[] {
    return Array.from(this.monitoringTimers.keys())
  }

  /**
   * アカウントのトレンド履歴を取得
   */
  getTrendHistory(accountId: string): number[] {
    return this.marginTrends.get(accountId) || []
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): LossCutMonitorConfig {
    return { ...this.config }
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    const monitoringCount = this.monitoringTimers.size
    const latestLevels = Array.from(this.lastMarginLevels.values())
    const averageLevel = latestLevels.length > 0 
      ? latestLevels.reduce((sum, level) => sum + level, 0) / latestLevels.length
      : 0

    const riskDistribution = {
      safe: latestLevels.filter(level => level >= 200).length,
      warning: latestLevels.filter(level => level >= 150 && level < 200).length,
      danger: latestLevels.filter(level => level >= 100 && level < 150).length,
      critical: latestLevels.filter(level => level < 100).length
    }

    return {
      monitoringCount,
      averageLevel,
      riskDistribution,
      isEnabled: this.config.enabled,
      pollingInterval: this.config.pollingInterval
    }
  }

  /**
   * すべての監視を停止
   */
  stopAllMonitoring(): void {
    for (const accountId of this.monitoringTimers.keys()) {
      this.stopMonitoring(accountId)
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.stopAllMonitoring()
    this.lastMarginLevels.clear()
    this.marginTrends.clear()
    this.removeAllListeners()
  }
}