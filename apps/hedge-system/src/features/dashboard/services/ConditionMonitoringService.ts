import { EventEmitter } from 'events'
import { Alert, Account, Position, MarketData, SystemStatus } from '../types'

// 条件監視関連の型定義
export interface MonitoringCondition {
  id: string
  name: string
  type: 'margin_level' | 'profit_loss' | 'connection_status' | 'position_size' | 'system_health' | 'composite'
  enabled: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  
  // 条件設定
  threshold?: {
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
    value: number
  }
  
  // 複合条件サポート
  compositeConditions?: {
    logic: 'and' | 'or'
    conditions: MonitoringCondition[]
  }
  
  // フィルター条件
  filters?: {
    accountIds?: string[]
    symbols?: string[]
    positionTypes?: ('buy' | 'sell')[]
  }
  
  // 通知設定
  notifications: {
    sound: boolean
    desktop: boolean
    email: boolean
    popup: boolean
    soundType?: 'info' | 'warning' | 'error' | 'critical'
  }
  
  // 制御設定
  cooldownMs: number
  autoResolve: boolean
  maxTriggersPerHour: number
  
  // メタデータ
  description?: string
  createdAt: Date
  updatedAt: Date
  lastTriggered?: Date
  triggerCount: number
}

export interface MonitoringEvent {
  conditionId: string
  type: 'triggered' | 'resolved' | 'cooldown_ended'
  timestamp: Date
  data: any
  severity: Alert['severity']
}

export interface ConditionEvaluationContext {
  accounts: Account[]
  positions: Position[]
  marketData: MarketData[]
  systemStatus: SystemStatus
  timestamp: Date
}

export interface MonitoringStatistics {
  totalConditions: number
  activeConditions: number
  triggeredLast24h: number
  conditionsByType: Record<string, number>
  conditionsBySeverity: Record<string, number>
  averageEvaluationTime: number
  evaluationCount: number
}

// 条件監視サービス
export class ConditionMonitoringService extends EventEmitter {
  private conditions = new Map<string, MonitoringCondition>()
  private activeAlerts = new Map<string, Alert>()
  private cooldowns = new Map<string, number>()
  private triggerCounts = new Map<string, { count: number; resetTime: number }>()
  private evaluationMetrics = {
    totalEvaluations: 0,
    totalEvaluationTime: 0,
    lastEvaluationTime: 0
  }
  
  private isRunning = false
  private evaluationInterval?: NodeJS.Timeout
  private readonly intervalMs: number
  
  constructor(intervalMs: number = 1000) {
    super()
    this.intervalMs = intervalMs
  }
  
  /**
   * 監視サービスを開始
   */
  start(): void {
    if (this.isRunning) {
      return
    }
    
    this.isRunning = true
    this.evaluationInterval = setInterval(() => {
      this.emit('evaluation_requested')
    }, this.intervalMs)
    
    console.log(`Condition monitoring service started (interval: ${this.intervalMs}ms)`)
  }
  
  /**
   * 監視サービスを停止
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }
    
    this.isRunning = false
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval)
      this.evaluationInterval = undefined
    }
    
    console.log('Condition monitoring service stopped')
  }
  
  /**
   * 条件を追加
   */
  addCondition(condition: Omit<MonitoringCondition, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'>): string {
    const id = this.generateConditionId()
    const now = new Date()
    
    const fullCondition: MonitoringCondition = {
      ...condition,
      id,
      createdAt: now,
      updatedAt: now,
      triggerCount: 0
    }
    
    this.conditions.set(id, fullCondition)
    
    this.emit('condition_added', { condition: fullCondition })
    return id
  }
  
  /**
   * 条件を更新
   */
  updateCondition(id: string, updates: Partial<MonitoringCondition>): boolean {
    const condition = this.conditions.get(id)
    if (!condition) {
      return false
    }
    
    const updatedCondition = {
      ...condition,
      ...updates,
      id, // IDは変更不可
      createdAt: condition.createdAt, // 作成日時は変更不可
      updatedAt: new Date()
    }
    
    this.conditions.set(id, updatedCondition)
    
    this.emit('condition_updated', { condition: updatedCondition })
    return true
  }
  
  /**
   * 条件を削除
   */
  removeCondition(id: string): boolean {
    const condition = this.conditions.get(id)
    if (!condition) {
      return false
    }
    
    this.conditions.delete(id)
    this.cooldowns.delete(id)
    this.triggerCounts.delete(id)
    
    // 関連するアクティブアラートも削除
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.data?.conditionId === id) {
        this.activeAlerts.delete(alertId)
      }
    }
    
    this.emit('condition_removed', { conditionId: id })
    return true
  }
  
  /**
   * 条件評価を実行
   */
  async evaluateConditions(context: ConditionEvaluationContext): Promise<Alert[]> {
    const startTime = Date.now()
    const newAlerts: Alert[] = []
    
    for (const [id, condition] of this.conditions) {
      if (!condition.enabled) {
        continue
      }
      
      // クールダウンチェック
      if (this.isInCooldown(id)) {
        continue
      }
      
      // トリガー制限チェック
      if (this.exceedsRateLimit(id)) {
        continue
      }
      
      try {
        const result = await this.evaluateSingleCondition(condition, context)
        
        if (result.triggered) {
          // アラート生成
          const alert = this.createAlertFromCondition(condition, result.data, context)
          newAlerts.push(alert)
          
          // アクティブアラートに追加
          this.activeAlerts.set(alert.id, alert)
          
          // クールダウン設定
          this.setCooldown(id)
          
          // トリガーカウント更新
          this.incrementTriggerCount(id)
          
          // 条件のトリガー統計更新
          this.updateConditionTriggerStats(id)
          
          // イベント発火
          this.emit('condition_triggered', {
            condition,
            alert,
            context
          })
        } else if (result.resolved && condition.autoResolve) {
          // 自動解決
          this.resolveConditionAlerts(id)
        }
        
      } catch (error) {
        console.error(`Error evaluating condition ${id}:`, error)
        this.emit('evaluation_error', {
          conditionId: id,
          error,
          context
        })
      }
    }
    
    // 評価メトリクス更新
    const evaluationTime = Date.now() - startTime
    this.updateEvaluationMetrics(evaluationTime)
    
    this.emit('evaluation_completed', {
      newAlerts,
      evaluationTime,
      conditionsEvaluated: this.conditions.size
    })
    
    return newAlerts
  }
  
  /**
   * 単一条件の評価
   */
  private async evaluateSingleCondition(
    condition: MonitoringCondition,
    context: ConditionEvaluationContext
  ): Promise<{ triggered: boolean; resolved: boolean; data: any }> {
    
    switch (condition.type) {
      case 'margin_level':
        return this.evaluateMarginLevelCondition(condition, context)
      case 'profit_loss':
        return this.evaluateProfitLossCondition(condition, context)
      case 'connection_status':
        return this.evaluateConnectionStatusCondition(condition, context)
      case 'position_size':
        return this.evaluatePositionSizeCondition(condition, context)
      case 'system_health':
        return this.evaluateSystemHealthCondition(condition, context)
      case 'composite':
        return this.evaluateCompositeCondition(condition, context)
      default:
        return { triggered: false, resolved: false, data: null }
    }
  }
  
  /**
   * 証拠金維持率条件の評価
   */
  private async evaluateMarginLevelCondition(
    condition: MonitoringCondition,
    context: ConditionEvaluationContext
  ): Promise<{ triggered: boolean; resolved: boolean; data: any }> {
    
    const filteredAccounts = this.filterAccounts(context.accounts, condition.filters)
    const threshold = condition.threshold
    
    if (!threshold) {
      return { triggered: false, resolved: false, data: null }
    }
    
    for (const account of filteredAccounts) {
      const marginLevel = account.marginLevel
      const triggered = this.compareValue(marginLevel, threshold.operator, threshold.value)
      
      if (triggered) {
        return {
          triggered: true,
          resolved: false,
          data: {
            accountId: account.id,
            marginLevel,
            threshold: threshold.value,
            broker: account.broker
          }
        }
      }
    }
    
    // すべてのアカウントが条件を満たさない = 解決
    return { triggered: false, resolved: true, data: null }
  }
  
  /**
   * 損益条件の評価
   */
  private async evaluateProfitLossCondition(
    condition: MonitoringCondition,
    context: ConditionEvaluationContext
  ): Promise<{ triggered: boolean; resolved: boolean; data: any }> {
    
    const filteredPositions = this.filterPositions(context.positions, condition.filters)
    const threshold = condition.threshold
    
    if (!threshold) {
      return { triggered: false, resolved: false, data: null }
    }
    
    // 個別ポジションまたは合計損益のチェック
    let totalProfit = 0
    const problematicPositions: Position[] = []
    
    for (const position of filteredPositions) {
      totalProfit += position.profit
      
      const triggered = this.compareValue(position.profit, threshold.operator, threshold.value)
      if (triggered) {
        problematicPositions.push(position)
      }
    }
    
    // 個別ポジション条件
    if (problematicPositions.length > 0) {
      return {
        triggered: true,
        resolved: false,
        data: {
          positions: problematicPositions,
          totalProfit,
          threshold: threshold.value
        }
      }
    }
    
    return { triggered: false, resolved: true, data: { totalProfit } }
  }
  
  /**
   * 接続状態条件の評価
   */
  private async evaluateConnectionStatusCondition(
    condition: MonitoringCondition,
    context: ConditionEvaluationContext
  ): Promise<{ triggered: boolean; resolved: boolean; data: any }> {
    
    const filteredAccounts = this.filterAccounts(context.accounts, condition.filters)
    const disconnectedAccounts = filteredAccounts.filter(account => 
      account.status === 'disconnected' || account.status === 'error'
    )
    
    if (disconnectedAccounts.length > 0) {
      return {
        triggered: true,
        resolved: false,
        data: {
          disconnectedAccounts: disconnectedAccounts.map(a => ({
            id: a.id,
            broker: a.broker,
            status: a.status,
            lastUpdate: a.lastUpdate
          }))
        }
      }
    }
    
    return { triggered: false, resolved: true, data: null }
  }
  
  /**
   * ポジションサイズ条件の評価
   */
  private async evaluatePositionSizeCondition(
    condition: MonitoringCondition,
    context: ConditionEvaluationContext
  ): Promise<{ triggered: boolean; resolved: boolean; data: any }> {
    
    const filteredPositions = this.filterPositions(context.positions, condition.filters)
    const threshold = condition.threshold
    
    if (!threshold) {
      return { triggered: false, resolved: false, data: null }
    }
    
    const largePositions = filteredPositions.filter(position => 
      this.compareValue(position.lots, threshold.operator, threshold.value)
    )
    
    if (largePositions.length > 0) {
      return {
        triggered: true,
        resolved: false,
        data: {
          positions: largePositions,
          threshold: threshold.value
        }
      }
    }
    
    return { triggered: false, resolved: true, data: null }
  }
  
  /**
   * システムヘルス条件の評価
   */
  private async evaluateSystemHealthCondition(
    condition: MonitoringCondition,
    context: ConditionEvaluationContext
  ): Promise<{ triggered: boolean; resolved: boolean; data: any }> {
    
    const { systemStatus } = context
    const threshold = condition.threshold
    
    if (!threshold) {
      return { triggered: false, resolved: false, data: null }
    }
    
    // CPU使用率、メモリ使用率、データ遅延などをチェック
    const healthIssues: string[] = []
    
    if (this.compareValue(systemStatus.cpuUsage, 'gt', 80)) {
      healthIssues.push(`High CPU usage: ${systemStatus.cpuUsage}%`)
    }
    
    if (this.compareValue(systemStatus.memoryUsage, 'gt', 80)) {
      healthIssues.push(`High memory usage: ${systemStatus.memoryUsage}%`)
    }
    
    if (this.compareValue(systemStatus.dataLatency, 'gt', 5000)) {
      healthIssues.push(`High data latency: ${systemStatus.dataLatency}ms`)
    }
    
    if (healthIssues.length > 0) {
      return {
        triggered: true,
        resolved: false,
        data: {
          issues: healthIssues,
          systemStatus
        }
      }
    }
    
    return { triggered: false, resolved: true, data: null }
  }
  
  /**
   * 複合条件の評価
   */
  private async evaluateCompositeCondition(
    condition: MonitoringCondition,
    context: ConditionEvaluationContext
  ): Promise<{ triggered: boolean; resolved: boolean; data: any }> {
    
    const { compositeConditions } = condition
    if (!compositeConditions || !compositeConditions.conditions.length) {
      return { triggered: false, resolved: false, data: null }
    }
    
    const results = await Promise.all(
      compositeConditions.conditions.map(subCondition => 
        this.evaluateSingleCondition(subCondition, context)
      )
    )
    
    let triggered: boolean
    if (compositeConditions.logic === 'and') {
      triggered = results.every(r => r.triggered)
    } else {
      triggered = results.some(r => r.triggered)
    }
    
    const resolved = results.every(r => r.resolved)
    
    return {
      triggered,
      resolved,
      data: {
        subResults: results,
        logic: compositeConditions.logic
      }
    }
  }
  
  /**
   * 値の比較
   */
  private compareValue(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold
      case 'gte': return value >= threshold
      case 'lt': return value < threshold
      case 'lte': return value <= threshold
      case 'eq': return value === threshold
      case 'neq': return value !== threshold
      default: return false
    }
  }
  
  /**
   * アカウントのフィルタリング
   */
  private filterAccounts(accounts: Account[], filters?: MonitoringCondition['filters']): Account[] {
    if (!filters) return accounts
    
    return accounts.filter(account => {
      if (filters.accountIds && !filters.accountIds.includes(account.id)) {
        return false
      }
      return true
    })
  }
  
  /**
   * ポジションのフィルタリング
   */
  private filterPositions(positions: Position[], filters?: MonitoringCondition['filters']): Position[] {
    if (!filters) return positions
    
    return positions.filter(position => {
      if (filters.accountIds && !filters.accountIds.includes(position.accountId)) {
        return false
      }
      if (filters.symbols && !filters.symbols.includes(position.symbol)) {
        return false
      }
      if (filters.positionTypes && !filters.positionTypes.includes(position.type)) {
        return false
      }
      return true
    })
  }
  
  /**
   * 条件からアラートを生成
   */
  private createAlertFromCondition(
    condition: MonitoringCondition,
    data: any,
    context: ConditionEvaluationContext
  ): Alert {
    return {
      id: this.generateAlertId(),
      type: condition.type === 'composite' ? 'system_error' : condition.type,
      severity: this.mapPriorityToSeverity(condition.priority),
      message: this.generateAlertMessage(condition, data),
      timestamp: context.timestamp,
      accountId: data?.accountId,
      positionId: data?.positions?.[0]?.id,
      acknowledged: false,
      autoResolve: condition.autoResolve,
      data: {
        conditionId: condition.id,
        conditionName: condition.name,
        ...data
      }
    }
  }
  
  /**
   * 優先度から重要度への変換
   */
  private mapPriorityToSeverity(priority: MonitoringCondition['priority']): Alert['severity'] {
    switch (priority) {
      case 'low': return 'low'
      case 'medium': return 'medium'
      case 'high': return 'high'
      case 'critical': return 'critical'
      default: return 'medium'
    }
  }
  
  /**
   * アラートメッセージの生成
   */
  private generateAlertMessage(condition: MonitoringCondition, data: any): string {
    switch (condition.type) {
      case 'margin_level':
        return `証拠金維持率警告: ${data?.marginLevel?.toFixed(2)}% (閾値: ${data?.threshold}%)`
      case 'profit_loss':
        return `損益警告: ${data?.positions?.length || 0}件のポジションが条件に該当`
      case 'connection_status':
        return `接続警告: ${data?.disconnectedAccounts?.length || 0}件のアカウントが切断中`
      case 'position_size':
        return `ポジションサイズ警告: ${data?.positions?.length || 0}件の大口ポジション`
      case 'system_health':
        return `システム警告: ${data?.issues?.join(', ') || '複数の問題'}`
      default:
        return `${condition.name}: 条件が満たされました`
    }
  }
  
  /**
   * クールダウン管理
   */
  private isInCooldown(conditionId: string): boolean {
    const cooldownEnd = this.cooldowns.get(conditionId)
    return cooldownEnd ? Date.now() < cooldownEnd : false
  }
  
  private setCooldown(conditionId: string): void {
    const condition = this.conditions.get(conditionId)
    if (condition) {
      const cooldownEnd = Date.now() + condition.cooldownMs
      this.cooldowns.set(conditionId, cooldownEnd)
    }
  }
  
  /**
   * レート制限管理
   */
  private exceedsRateLimit(conditionId: string): boolean {
    const condition = this.conditions.get(conditionId)
    if (!condition || condition.maxTriggersPerHour <= 0) {
      return false
    }
    
    const now = Date.now()
    const hourMs = 60 * 60 * 1000
    const counter = this.triggerCounts.get(conditionId)
    
    if (!counter) {
      return false
    }
    
    // 1時間経過でリセット
    if (now >= counter.resetTime) {
      this.triggerCounts.set(conditionId, { count: 0, resetTime: now + hourMs })
      return false
    }
    
    return counter.count >= condition.maxTriggersPerHour
  }
  
  private incrementTriggerCount(conditionId: string): void {
    const now = Date.now()
    const hourMs = 60 * 60 * 1000
    let counter = this.triggerCounts.get(conditionId)
    
    if (!counter || now >= counter.resetTime) {
      counter = { count: 0, resetTime: now + hourMs }
    }
    
    counter.count++
    this.triggerCounts.set(conditionId, counter)
  }
  
  /**
   * 統計情報の更新
   */
  private updateConditionTriggerStats(conditionId: string): void {
    const condition = this.conditions.get(conditionId)
    if (condition) {
      condition.triggerCount++
      condition.lastTriggered = new Date()
      this.conditions.set(conditionId, condition)
    }
  }
  
  private updateEvaluationMetrics(evaluationTime: number): void {
    this.evaluationMetrics.totalEvaluations++
    this.evaluationMetrics.totalEvaluationTime += evaluationTime
    this.evaluationMetrics.lastEvaluationTime = evaluationTime
  }
  
  /**
   * 条件に関連するアラートの解決
   */
  private resolveConditionAlerts(conditionId: string): void {
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.data?.conditionId === conditionId) {
        this.activeAlerts.delete(alertId)
        this.emit('alert_resolved', { alert, conditionId })
      }
    }
  }
  
  /**
   * 統計情報取得
   */
  getStatistics(): MonitoringStatistics {
    const conditions = Array.from(this.conditions.values())
    const activeConditions = conditions.filter(c => c.enabled)
    
    // 過去24時間のトリガー数
    const last24h = Date.now() - (24 * 60 * 60 * 1000)
    const triggeredLast24h = conditions.filter(c => 
      c.lastTriggered && c.lastTriggered.getTime() > last24h
    ).length
    
    // 型別集計
    const conditionsByType = conditions.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // 重要度別集計
    const conditionsBySeverity = conditions.reduce((acc, c) => {
      acc[c.priority] = (acc[c.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // 平均評価時間
    const averageEvaluationTime = this.evaluationMetrics.totalEvaluations > 0 
      ? this.evaluationMetrics.totalEvaluationTime / this.evaluationMetrics.totalEvaluations
      : 0
    
    return {
      totalConditions: conditions.length,
      activeConditions: activeConditions.length,
      triggeredLast24h,
      conditionsByType,
      conditionsBySeverity,
      averageEvaluationTime,
      evaluationCount: this.evaluationMetrics.totalEvaluations
    }
  }
  
  /**
   * ユーティリティメソッド
   */
  getConditions(): MonitoringCondition[] {
    return Array.from(this.conditions.values())
  }
  
  getCondition(id: string): MonitoringCondition | undefined {
    return this.conditions.get(id)
  }
  
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
  }
  
  clearAllAlerts(): void {
    this.activeAlerts.clear()
    this.emit('all_alerts_cleared')
  }
  
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (alert) {
      alert.acknowledged = true
      this.emit('alert_acknowledged', { alert })
      return true
    }
    return false
  }
  
  private generateConditionId(): string {
    return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * リソースの解放
   */
  dispose(): void {
    this.stop()
    this.removeAllListeners()
    this.conditions.clear()
    this.activeAlerts.clear()
    this.cooldowns.clear()
    this.triggerCounts.clear()
  }
}

// デフォルトの条件テンプレート
export const DEFAULT_CONDITIONS: Omit<MonitoringCondition, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'>[] = [
  {
    name: '証拠金維持率警告',
    type: 'margin_level',
    enabled: true,
    priority: 'high',
    threshold: {
      operator: 'lt',
      value: 150
    },
    notifications: {
      sound: true,
      desktop: true,
      email: false,
      popup: true,
      soundType: 'warning'
    },
    cooldownMs: 300000, // 5分
    autoResolve: true,
    maxTriggersPerHour: 5,
    description: '証拠金維持率が150%を下回った時のアラート'
  },
  {
    name: '証拠金維持率危険',
    type: 'margin_level',
    enabled: true,
    priority: 'critical',
    threshold: {
      operator: 'lt',
      value: 100
    },
    notifications: {
      sound: true,
      desktop: true,
      email: true,
      popup: true,
      soundType: 'critical'
    },
    cooldownMs: 60000, // 1分
    autoResolve: true,
    maxTriggersPerHour: 10,
    description: '証拠金維持率が100%を下回った危険な状態'
  },
  {
    name: '大きな損失警告',
    type: 'profit_loss',
    enabled: true,
    priority: 'high',
    threshold: {
      operator: 'lt',
      value: -1000
    },
    notifications: {
      sound: true,
      desktop: true,
      email: true,
      popup: true,
      soundType: 'error'
    },
    cooldownMs: 180000, // 3分
    autoResolve: false,
    maxTriggersPerHour: 3,
    description: '1000以上の損失が発生した時のアラート'
  },
  {
    name: 'EA接続断',
    type: 'connection_status',
    enabled: true,
    priority: 'medium',
    notifications: {
      sound: false,
      desktop: true,
      email: true,
      popup: true,
      soundType: 'info'
    },
    cooldownMs: 600000, // 10分
    autoResolve: true,
    maxTriggersPerHour: 6,
    description: 'EAとの接続が切断された時のアラート'
  }
]