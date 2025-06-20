import { EventEmitter } from 'events'
import notificationService, { NotificationType, SoundType } from './NotificationService'
import { ConditionMonitoringService, MonitoringCondition, MonitoringEvent } from './ConditionMonitoringService'
import { Alert } from '../types'

export interface NotificationTriggerConfig {
  enableAutoTrigger: boolean
  soundMappings: {
    [priority in MonitoringCondition['priority']]: SoundType
  }
  notificationMappings: {
    [priority in MonitoringCondition['priority']]: NotificationType
  }
  customNotificationFormats: {
    titleTemplate: string
    bodyTemplate: string
    useCustomIcons: boolean
  }
  rateLimiting: {
    maxNotificationsPerMinute: number
    cooldownBetweenSimilarAlerts: number // ms
  }
}

export class NotificationTrigger extends EventEmitter {
  private config: NotificationTriggerConfig
  private monitoringService: ConditionMonitoringService
  private notificationHistory = new Map<string, number>() // conditionId -> lastNotificationTime
  private recentNotifications: { conditionId: string; timestamp: number }[] = []
  
  constructor(monitoringService: ConditionMonitoringService, config?: Partial<NotificationTriggerConfig>) {
    super()
    this.monitoringService = monitoringService
    this.config = this.mergeWithDefaultConfig(config)
    this.setupEventListeners()
  }
  
  private mergeWithDefaultConfig(config?: Partial<NotificationTriggerConfig>): NotificationTriggerConfig {
    const defaultConfig: NotificationTriggerConfig = {
      enableAutoTrigger: true,
      soundMappings: {
        low: 'ping',
        medium: 'glass',
        high: 'blow',
        critical: 'basso'
      },
      notificationMappings: {
        low: 'info',
        medium: 'warning',
        high: 'error',
        critical: 'critical'
      },
      customNotificationFormats: {
        titleTemplate: 'ArbitrageAssistant - {conditionName}',
        bodyTemplate: '{message}',
        useCustomIcons: true
      },
      rateLimiting: {
        maxNotificationsPerMinute: 10,
        cooldownBetweenSimilarAlerts: 30000 // 30秒
      }
    }
    
    return {
      ...defaultConfig,
      ...config,
      soundMappings: { ...defaultConfig.soundMappings, ...config?.soundMappings },
      notificationMappings: { ...defaultConfig.notificationMappings, ...config?.notificationMappings },
      customNotificationFormats: { ...defaultConfig.customNotificationFormats, ...config?.customNotificationFormats },
      rateLimiting: { ...defaultConfig.rateLimiting, ...config?.rateLimiting }
    }
  }
  
  private setupEventListeners(): void {
    // 条件がトリガーされた時の処理
    this.monitoringService.on('condition_triggered', this.handleConditionTriggered.bind(this))
    
    // アラートが解決された時の処理
    this.monitoringService.on('alert_resolved', this.handleAlertResolved.bind(this))
    
    // 評価エラーが発生した時の処理
    this.monitoringService.on('evaluation_error', this.handleEvaluationError.bind(this))
    
    // 評価完了時の統計情報表示
    this.monitoringService.on('evaluation_completed', this.handleEvaluationCompleted.bind(this))
  }
  
  private async handleConditionTriggered(event: {
    condition: MonitoringCondition
    alert: Alert
    context: any
  }): Promise<void> {
    if (!this.config.enableAutoTrigger) {
      return
    }
    
    const { condition, alert } = event
    
    // レート制限チェック
    if (!this.checkRateLimit(condition.id)) {
      console.log(`Rate limit exceeded for condition: ${condition.name}`)
      return
    }
    
    try {
      await this.sendNotificationForCondition(condition, alert)
      this.updateNotificationHistory(condition.id)
      
      this.emit('notification_sent', {
        conditionId: condition.id,
        conditionName: condition.name,
        alertId: alert.id,
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('Failed to send notification for condition trigger:', error)
      this.emit('notification_error', {
        conditionId: condition.id,
        error,
        timestamp: new Date()
      })
    }
  }
  
  private async handleAlertResolved(event: {
    alert: Alert
    conditionId: string
  }): Promise<void> {
    const { alert, conditionId } = event
    const condition = this.monitoringService.getCondition(conditionId)
    
    if (!condition) {
      return
    }
    
    // 解決通知が有効な場合のみ送信
    if (condition.notifications.popup) {
      try {
        await notificationService.success(
          this.formatNotificationTitle(condition, '解決'),
          this.formatNotificationBody(condition, `${alert.message} - 問題が解決されました`),
          {
            sound: 'glass',
            persistent: false
          }
        )
        
        this.emit('resolution_notification_sent', {
          conditionId,
          alertId: alert.id,
          timestamp: new Date()
        })
        
      } catch (error) {
        console.error('Failed to send resolution notification:', error)
      }
    }
  }
  
  private async handleEvaluationError(event: {
    conditionId: string
    error: any
    context: any
  }): Promise<void> {
    const { conditionId, error } = event
    const condition = this.monitoringService.getCondition(conditionId)
    
    if (!condition) {
      return
    }
    
    // 評価エラーは重要度に関わらず通知
    try {
      await notificationService.error(
        '条件評価エラー',
        `条件「${condition.name}」の評価中にエラーが発生しました: ${error.message || error}`,
        {
          sound: 'basso',
          persistent: true
        }
      )
      
    } catch (notificationError) {
      console.error('Failed to send evaluation error notification:', notificationError)
    }
  }
  
  private async handleEvaluationCompleted(event: {
    newAlerts: Alert[]
    evaluationTime: number
    conditionsEvaluated: number
  }): Promise<void> {
    // 評価完了の統計情報（デバッグ時のみ）
    if (process.env.NODE_ENV === 'development') {
      const { newAlerts, evaluationTime, conditionsEvaluated } = event
      
      if (newAlerts.length > 0) {
        console.log(`Condition evaluation completed: ${conditionsEvaluated} conditions, ${newAlerts.length} new alerts, ${evaluationTime}ms`)
      }
    }
  }
  
  private async sendNotificationForCondition(
    condition: MonitoringCondition,
    alert: Alert
  ): Promise<void> {
    const title = this.formatNotificationTitle(condition)
    const body = this.formatNotificationBody(condition, alert.message)
    const notificationType = this.config.notificationMappings[condition.priority]
    const soundType = this.config.soundMappings[condition.priority]
    
    // 基本の通知オプション
    const baseOptions = {
      sound: condition.notifications.sound ? soundType : false,
      persistent: condition.notifications.popup && (condition.priority === 'critical' || condition.priority === 'high'),
      tag: `condition-${condition.id}`
    }
    
    // デスクトップ通知
    if (condition.notifications.desktop) {
      await notificationService.notify({
        title,
        body,
        type: notificationType,
        ...baseOptions
      })
    }
    
    // サウンドのみの通知（デスクトップ通知が無効でもサウンドは再生）
    if (condition.notifications.sound && !condition.notifications.desktop) {
      await notificationService.testSound(soundType)
    }
    
    // 重要度が高い場合は追加のmacOS通知
    if (condition.priority === 'critical' || condition.priority === 'high') {
      await this.sendHighPriorityNotification(condition, alert, title, body)
    }
    
    // メール通知（将来的な実装のためのフック）
    if (condition.notifications.email) {
      await this.sendEmailNotification(condition, alert)
    }
  }
  
  private async sendHighPriorityNotification(
    condition: MonitoringCondition,
    alert: Alert,
    title: string,
    body: string
  ): Promise<void> {
    try {
      // macOS osascript通知で確実に通知
      await notificationService.notifyTaskError(condition.name, alert.message)
      
    } catch (error) {
      console.warn('Failed to send high priority notification:', error)
    }
  }
  
  private async sendEmailNotification(
    condition: MonitoringCondition,
    alert: Alert
  ): Promise<void> {
    // メール通知の実装は将来的に追加
    console.log(`Email notification would be sent for condition: ${condition.name}`)
    
    this.emit('email_notification_requested', {
      conditionId: condition.id,
      conditionName: condition.name,
      alert,
      timestamp: new Date()
    })
  }
  
  private formatNotificationTitle(condition: MonitoringCondition, suffix?: string): string {
    const template = this.config.customNotificationFormats.titleTemplate
    let title = template.replace('{conditionName}', condition.name)
    
    if (suffix) {
      title += ` - ${suffix}`
    }
    
    return title
  }
  
  private formatNotificationBody(condition: MonitoringCondition, message: string): string {
    const template = this.config.customNotificationFormats.bodyTemplate
    return template
      .replace('{message}', message)
      .replace('{conditionName}', condition.name)
      .replace('{priority}', condition.priority)
      .replace('{type}', condition.type)
  }
  
  private checkRateLimit(conditionId: string): boolean {
    const now = Date.now()
    const lastNotification = this.notificationHistory.get(conditionId)
    
    // 同じ条件のクールダウンチェック
    if (lastNotification && (now - lastNotification) < this.config.rateLimiting.cooldownBetweenSimilarAlerts) {
      return false
    }
    
    // 全体的なレート制限チェック（1分間の制限）
    const oneMinuteAgo = now - 60000
    this.recentNotifications = this.recentNotifications.filter(n => n.timestamp > oneMinuteAgo)
    
    if (this.recentNotifications.length >= this.config.rateLimiting.maxNotificationsPerMinute) {
      return false
    }
    
    return true
  }
  
  private updateNotificationHistory(conditionId: string): void {
    const now = Date.now()
    this.notificationHistory.set(conditionId, now)
    this.recentNotifications.push({ conditionId, timestamp: now })
    
    // 古い履歴の削除（1時間以上前）
    const oneHourAgo = now - 3600000
    for (const [id, timestamp] of this.notificationHistory) {
      if (timestamp < oneHourAgo) {
        this.notificationHistory.delete(id)
      }
    }
  }
  
  /**
   * 手動で条件の通知をテスト
   */
  async testConditionNotification(conditionId: string): Promise<boolean> {
    const condition = this.monitoringService.getCondition(conditionId)
    if (!condition) {
      return false
    }
    
    // テスト用のアラートを作成
    const testAlert: Alert = {
      id: `test-${Date.now()}`,
      type: condition.type === 'composite' ? 'system_error' : condition.type,
      severity: condition.priority === 'low' ? 'low' : 
                condition.priority === 'medium' ? 'medium' :
                condition.priority === 'high' ? 'high' : 'critical',
      message: `テスト通知: ${condition.name}`,
      timestamp: new Date(),
      acknowledged: false,
      autoResolve: false,
      data: { test: true }
    }
    
    try {
      await this.sendNotificationForCondition(condition, testAlert)
      return true
    } catch (error) {
      console.error('Failed to send test notification:', error)
      return false
    }
  }
  
  /**
   * 通知設定を更新
   */
  updateConfig(newConfig: Partial<NotificationTriggerConfig>): void {
    this.config = this.mergeWithDefaultConfig(newConfig)
    this.emit('config_updated', this.config)
  }
  
  /**
   * 設定取得
   */
  getConfig(): NotificationTriggerConfig {
    return { ...this.config }
  }
  
  /**
   * 通知統計取得
   */
  getNotificationStatistics() {
    const now = Date.now()
    const oneHourAgo = now - 3600000
    const oneDayAgo = now - 86400000
    
    // 時間別統計
    const last1Hour = this.recentNotifications.filter(n => n.timestamp > oneHourAgo).length
    const last24Hours = Array.from(this.notificationHistory.values()).filter(t => t > oneDayAgo).length
    
    // 条件別統計
    const notificationsByCondition = new Map<string, number>()
    for (const { conditionId } of this.recentNotifications.filter(n => n.timestamp > oneDayAgo)) {
      notificationsByCondition.set(conditionId, (notificationsByCondition.get(conditionId) || 0) + 1)
    }
    
    return {
      totalNotificationsLast1Hour: last1Hour,
      totalNotificationsLast24Hours: last24Hours,
      notificationsByCondition: Object.fromEntries(notificationsByCondition),
      averageNotificationsPerHour: last24Hours / 24,
      config: this.config
    }
  }
  
  /**
   * リソースの解放
   */
  dispose(): void {
    this.removeAllListeners()
    this.notificationHistory.clear()
    this.recentNotifications = []
  }
}

// 便利な関数：デフォルト設定でNotificationTriggerを作成
export function createNotificationTrigger(
  monitoringService: ConditionMonitoringService,
  config?: Partial<NotificationTriggerConfig>
): NotificationTrigger {
  return new NotificationTrigger(monitoringService, config)
}

// デフォルトの通知設定
export const DEFAULT_NOTIFICATION_CONFIG: NotificationTriggerConfig = {
  enableAutoTrigger: true,
  soundMappings: {
    low: 'ping',
    medium: 'glass',
    high: 'blow',
    critical: 'basso'
  },
  notificationMappings: {
    low: 'info',
    medium: 'warning',
    high: 'error',
    critical: 'critical'
  },
  customNotificationFormats: {
    titleTemplate: 'ArbitrageAssistant - {conditionName}',
    bodyTemplate: '{message}',
    useCustomIcons: true
  },
  rateLimiting: {
    maxNotificationsPerMinute: 10,
    cooldownBetweenSimilarAlerts: 30000
  }
}