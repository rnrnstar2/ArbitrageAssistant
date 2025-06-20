/**
 * Emergency Mode Manager
 * 緊急モード管理システム - システム全体の緊急状態を管理
 */

export interface EmergencyModeState {
  isActive: boolean
  level: 'low' | 'medium' | 'high' | 'critical'
  triggeredAt?: Date
  triggeredBy: string
  reason: string
  affectedAccounts: string[]
  suspendedOperations: OperationType[]
  allowedOperations: OperationType[]
  autoRecoveryEnabled: boolean
  manualInterventionRequired: boolean
  estimatedRecoveryTime?: number // minutes
}

export type OperationType = 
  | 'auto_trading'
  | 'new_positions'
  | 'position_modifications'
  | 'account_switching'
  | 'bulk_operations'
  | 'api_integrations'
  | 'notification_sending'
  | 'data_sync'
  | 'monitoring'
  | 'manual_trading'

export interface EmergencyTrigger {
  id: string
  type: 'losscut' | 'margin_critical' | 'system_error' | 'network_issue' | 'manual'
  severity: 'low' | 'medium' | 'high' | 'critical'
  accountId?: string
  details: Record<string, any>
  timestamp: Date
}

export interface RecoveryAction {
  id: string
  type: 'position_validation' | 'margin_check' | 'system_health' | 'connectivity_test'
  description: string
  required: boolean
  completed: boolean
  result?: 'success' | 'failed' | 'skipped'
  executedAt?: Date
}

export interface EmergencyModeConfig {
  autoActivationThresholds: {
    marginLevel: number
    consecutiveErrors: number
    networkTimeoutMs: number
  }
  suspendedOperationsByLevel: Record<EmergencyModeState['level'], OperationType[]>
  autoRecoveryEnabled: boolean
  autoRecoveryTimeoutMs: number
  notificationChannels: string[]
}

export class EmergencyModeManager {
  private state: EmergencyModeState
  private config: EmergencyModeConfig
  private history: Array<EmergencyModeState & { deactivatedAt?: Date }> = []
  private activeRecoveryActions: RecoveryAction[] = []
  private listeners: Set<(state: EmergencyModeState) => void> = new Set()

  constructor(config: EmergencyModeConfig) {
    this.config = config
    this.state = this.createInitialState()
  }

  /**
   * 緊急モード手動発動
   */
  activateEmergencyMode(trigger: EmergencyTrigger, level?: EmergencyModeState['level']): void {
    const emergencyLevel = level || this.determineLevelFromTrigger(trigger)
    
    console.log(`[EmergencyModeManager] Activating emergency mode: ${emergencyLevel} - ${trigger.type}`)

    const previousState = { ...this.state }
    
    this.state = {
      isActive: true,
      level: emergencyLevel,
      triggeredAt: new Date(),
      triggeredBy: trigger.type,
      reason: this.buildReasonText(trigger),
      affectedAccounts: trigger.accountId ? [trigger.accountId] : [],
      suspendedOperations: this.config.suspendedOperationsByLevel[emergencyLevel] || [],
      allowedOperations: this.getAllowedOperations(emergencyLevel),
      autoRecoveryEnabled: this.config.autoRecoveryEnabled && emergencyLevel !== 'critical',
      manualInterventionRequired: emergencyLevel === 'critical' || trigger.type === 'manual',
      estimatedRecoveryTime: this.estimateRecoveryTime(emergencyLevel, trigger)
    }

    // 履歴保存
    if (previousState.isActive) {
      this.history.push({
        ...previousState,
        deactivatedAt: new Date()
      })
    }

    // 回復アクション初期化
    this.initializeRecoveryActions(emergencyLevel, trigger)

    // 通知
    this.notifyStateChange()

    // 自動回復タイマー設定
    if (this.state.autoRecoveryEnabled) {
      this.scheduleAutoRecovery()
    }
  }

  /**
   * 緊急モード解除
   */
  deactivateEmergencyMode(reason: string = 'manual'): boolean {
    if (!this.state.isActive) {
      console.log('[EmergencyModeManager] Emergency mode is not active')
      return false
    }

    // 回復条件チェック
    if (this.state.manualInterventionRequired && reason !== 'manual') {
      console.log('[EmergencyModeManager] Manual intervention required, cannot auto-deactivate')
      return false
    }

    // 回復アクション完了チェック
    const requiredActions = this.activeRecoveryActions.filter(a => a.required)
    const completedRequired = requiredActions.filter(a => a.completed && a.result === 'success')
    
    if (completedRequired.length < requiredActions.length) {
      console.log('[EmergencyModeManager] Required recovery actions not completed')
      return false
    }

    console.log(`[EmergencyModeManager] Deactivating emergency mode - ${reason}`)

    // 履歴保存
    this.history.push({
      ...this.state,
      deactivatedAt: new Date()
    })

    // 状態リセット
    this.state = this.createInitialState()
    this.activeRecoveryActions = []

    // 通知
    this.notifyStateChange()

    return true
  }

  /**
   * 操作許可チェック
   */
  isOperationAllowed(operation: OperationType, accountId?: string): boolean {
    if (!this.state.isActive) {
      return true
    }

    // アカウント固有チェック
    if (accountId && this.state.affectedAccounts.includes(accountId)) {
      return this.state.allowedOperations.includes(operation)
    }

    // 一般的な操作チェック
    return !this.state.suspendedOperations.includes(operation)
  }

  /**
   * レベル上げ
   */
  escalateLevel(): void {
    if (!this.state.isActive) {
      return
    }

    const currentLevel = this.state.level
    let newLevel: EmergencyModeState['level']

    switch (currentLevel) {
      case 'low':
        newLevel = 'medium'
        break
      case 'medium':
        newLevel = 'high'
        break
      case 'high':
        newLevel = 'critical'
        break
      case 'critical':
        return // 最高レベル
    }

    console.log(`[EmergencyModeManager] Escalating emergency level: ${currentLevel} -> ${newLevel}`)

    this.state.level = newLevel
    this.state.suspendedOperations = this.config.suspendedOperationsByLevel[newLevel] || []
    this.state.allowedOperations = this.getAllowedOperations(newLevel)
    
    if (newLevel === 'critical') {
      this.state.manualInterventionRequired = true
      this.state.autoRecoveryEnabled = false
    }

    this.notifyStateChange()
  }

  /**
   * レベル下げ
   */
  de_escalateLevel(): void {
    if (!this.state.isActive) {
      return
    }

    const currentLevel = this.state.level
    let newLevel: EmergencyModeState['level']

    switch (currentLevel) {
      case 'critical':
        newLevel = 'high'
        break
      case 'high':
        newLevel = 'medium'
        break
      case 'medium':
        newLevel = 'low'
        break
      case 'low':
        // 低レベルから更に下げる場合は解除
        this.deactivateEmergencyMode('auto_de_escalation')
        return
    }

    console.log(`[EmergencyModeManager] De-escalating emergency level: ${currentLevel} -> ${newLevel}`)

    this.state.level = newLevel
    this.state.suspendedOperations = this.config.suspendedOperationsByLevel[newLevel] || []
    this.state.allowedOperations = this.getAllowedOperations(newLevel)
    
    if (newLevel !== 'critical') {
      this.state.manualInterventionRequired = false
      this.state.autoRecoveryEnabled = this.config.autoRecoveryEnabled
    }

    this.notifyStateChange()
  }

  /**
   * 回復アクション実行
   */
  executeRecoveryAction(actionId: string): Promise<boolean> {
    const action = this.activeRecoveryActions.find(a => a.id === actionId)
    if (!action) {
      throw new Error(`Recovery action not found: ${actionId}`)
    }

    if (action.completed) {
      throw new Error(`Recovery action already completed: ${actionId}`)
    }

    return this.performRecoveryAction(action)
  }

  /**
   * 全回復アクション実行
   */
  async executeAllRecoveryActions(): Promise<number> {
    const pendingActions = this.activeRecoveryActions.filter(a => !a.completed)
    let successCount = 0

    for (const action of pendingActions) {
      try {
        const success = await this.performRecoveryAction(action)
        if (success) successCount++
      } catch (error) {
        console.error(`[EmergencyModeManager] Recovery action failed: ${action.id}`, error)
      }
    }

    // 完了チェック
    this.checkRecoveryCompletion()

    return successCount
  }

  /**
   * 状態リスナー追加
   */
  addStateListener(listener: (state: EmergencyModeState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 現在の状態取得
   */
  getState(): EmergencyModeState {
    return { ...this.state }
  }

  /**
   * 履歴取得
   */
  getHistory(): Array<EmergencyModeState & { deactivatedAt?: Date }> {
    return [...this.history]
  }

  /**
   * 回復アクション取得
   */
  getRecoveryActions(): RecoveryAction[] {
    return [...this.activeRecoveryActions]
  }

  // 内部メソッド

  private createInitialState(): EmergencyModeState {
    return {
      isActive: false,
      level: 'low',
      triggeredBy: '',
      reason: '',
      affectedAccounts: [],
      suspendedOperations: [],
      allowedOperations: [],
      autoRecoveryEnabled: false,
      manualInterventionRequired: false
    }
  }

  private determineLevelFromTrigger(trigger: EmergencyTrigger): EmergencyModeState['level'] {
    switch (trigger.severity) {
      case 'critical':
        return 'critical'
      case 'high':
        return 'high'
      case 'medium':
        return 'medium'
      case 'low':
      default:
        return 'low'
    }
  }

  private buildReasonText(trigger: EmergencyTrigger): string {
    const typeText = {
      'losscut': 'ロスカット発生',
      'margin_critical': '証拠金維持率危険',
      'system_error': 'システムエラー',
      'network_issue': 'ネットワーク問題',
      'manual': '手動発動'
    }

    let reason = typeText[trigger.type] || '不明な理由'
    
    if (trigger.accountId) {
      reason += ` (口座: ${trigger.accountId})`
    }

    if (trigger.details.marginLevel) {
      reason += ` 証拠金維持率: ${trigger.details.marginLevel}%`
    }

    return reason
  }

  private getAllowedOperations(level: EmergencyModeState['level']): OperationType[] {
    const allOperations: OperationType[] = [
      'auto_trading', 'new_positions', 'position_modifications',
      'account_switching', 'bulk_operations', 'api_integrations',
      'notification_sending', 'data_sync', 'monitoring', 'manual_trading'
    ]

    const suspended = this.config.suspendedOperationsByLevel[level] || []
    return allOperations.filter(op => !suspended.includes(op))
  }

  private estimateRecoveryTime(level: EmergencyModeState['level'], trigger: EmergencyTrigger): number {
    const baseTime = {
      'low': 5,      // 5分
      'medium': 15,  // 15分
      'high': 30,    // 30分
      'critical': 60 // 60分
    }

    let time = baseTime[level]

    // トリガータイプによる調整
    if (trigger.type === 'losscut') {
      time *= 1.5
    } else if (trigger.type === 'system_error') {
      time *= 2
    }

    return Math.round(time)
  }

  private initializeRecoveryActions(level: EmergencyModeState['level'], trigger: EmergencyTrigger): void {
    this.activeRecoveryActions = []

    // 基本アクション
    this.activeRecoveryActions.push({
      id: 'position_validation',
      type: 'position_validation',
      description: 'ポジション状態の検証',
      required: true,
      completed: false
    })

    if (trigger.type === 'losscut' || trigger.type === 'margin_critical') {
      this.activeRecoveryActions.push({
        id: 'margin_check',
        type: 'margin_check',
        description: '証拠金レベルの確認',
        required: true,
        completed: false
      })
    }

    if (level === 'high' || level === 'critical') {
      this.activeRecoveryActions.push({
        id: 'system_health',
        type: 'system_health',
        description: 'システムヘルスチェック',
        required: true,
        completed: false
      })
    }

    this.activeRecoveryActions.push({
      id: 'connectivity_test',
      type: 'connectivity_test',
      description: '接続状態の確認',
      required: false,
      completed: false
    })
  }

  private async performRecoveryAction(action: RecoveryAction): Promise<boolean> {
    console.log(`[EmergencyModeManager] Executing recovery action: ${action.id}`)

    action.executedAt = new Date()

    try {
      // アクションタイプに応じた処理
      switch (action.type) {
        case 'position_validation':
          await this.validatePositions()
          break
        case 'margin_check':
          await this.checkMarginLevels()
          break
        case 'system_health':
          await this.checkSystemHealth()
          break
        case 'connectivity_test':
          await this.testConnectivity()
          break
        default:
          throw new Error(`Unknown recovery action type: ${action.type}`)
      }

      action.completed = true
      action.result = 'success'
      console.log(`[EmergencyModeManager] Recovery action completed: ${action.id}`)
      return true

    } catch (error) {
      action.completed = true
      action.result = 'failed'
      console.error(`[EmergencyModeManager] Recovery action failed: ${action.id}`, error)
      return false
    }
  }

  private async validatePositions(): Promise<void> {
    // ポジション検証ロジック
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  private async checkMarginLevels(): Promise<void> {
    // 証拠金レベル確認ロジック
    await new Promise(resolve => setTimeout(resolve, 1500))
  }

  private async checkSystemHealth(): Promise<void> {
    // システムヘルスチェックロジック
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  private async testConnectivity(): Promise<void> {
    // 接続テストロジック
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  private checkRecoveryCompletion(): void {
    const requiredActions = this.activeRecoveryActions.filter(a => a.required)
    const completedRequired = requiredActions.filter(a => a.completed && a.result === 'success')

    if (completedRequired.length >= requiredActions.length && this.state.autoRecoveryEnabled) {
      setTimeout(() => {
        this.deactivateEmergencyMode('auto_recovery')
      }, 5000) // 5秒後に自動解除
    }
  }

  private scheduleAutoRecovery(): void {
    if (!this.state.autoRecoveryEnabled || !this.state.estimatedRecoveryTime) {
      return
    }

    setTimeout(() => {
      if (this.state.isActive && this.state.autoRecoveryEnabled) {
        this.executeAllRecoveryActions()
      }
    }, this.state.estimatedRecoveryTime * 60 * 1000)
  }

  private notifyStateChange(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state)
      } catch (error) {
        console.error('[EmergencyModeManager] State listener error:', error)
      }
    })
  }
}