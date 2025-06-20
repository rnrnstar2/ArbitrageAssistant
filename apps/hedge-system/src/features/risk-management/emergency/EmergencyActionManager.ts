/**
 * Emergency Action Manager
 * 緊急対応管理システム - ロスカット発生時の自動対応を管理
 */

import { RiskMonitoringState, AccountMarginInfo } from '../types/risk-types'

export interface EmergencyStrategy {
  scenarioType: 'single_account' | 'multi_account' | 'correlated_positions'
  actions: EmergencyAction[]
  maxExecutionTime: number
  successCriteria: EmergencySuccessCriteria
}

export interface EmergencyAction {
  type: 'immediate_close' | 'partial_close' | 'hedge_open' | 'balance_transfer'
  priority: number
  targetPositions: string[]
  parameters: {
    percentage?: number
    maxLoss?: number
    hedgeRatio?: number
    amount?: number
  }
}

export interface EmergencySuccessCriteria {
  marginLevelTarget: number
  maxAcceptableLoss: number
  timeoutMinutes: number
}

export interface EmergencyResponse {
  id: string
  accountId: string
  strategy: EmergencyStrategy
  executedActions: EmergencyActionResult[]
  status: 'executing' | 'completed' | 'failed' | 'timeout'
  startTime: Date
  endTime?: Date
  totalLossAvoidance?: number
}

export interface EmergencyActionResult {
  action: EmergencyAction
  success: boolean
  executionTime: number
  result?: string
  error?: string
  lossReduction?: number
}

export interface EmergencyMode {
  isActive: boolean
  triggeredAt?: Date
  triggeredBy: string
  affectedAccounts: string[]
  suspendedOperations: string[]
  recoveryActions: string[]
}

export class EmergencyActionManager {
  private emergencyMode: EmergencyMode = {
    isActive: false,
    triggeredBy: '',
    affectedAccounts: [],
    suspendedOperations: [],
    recoveryActions: []
  }
  
  private activeResponses = new Map<string, EmergencyResponse>()
  private strategyRegistry = new Map<string, EmergencyStrategy>()
  private executionHistory: EmergencyResponse[] = []

  constructor() {
    this.initializeDefaultStrategies()
  }

  /**
   * ロスカット検知時の緊急対応実行
   */
  async handleLossCutDetection(
    accountId: string,
    riskState: RiskMonitoringState,
    relatedPositions: string[] = []
  ): Promise<EmergencyResponse> {
    console.log(`[EmergencyActionManager] Loss cut detected for account: ${accountId}`)

    // 緊急モード発動
    this.activateEmergencyMode(accountId, 'losscut_detection')

    // 適切な戦略選択
    const strategy = this.selectStrategy(riskState, relatedPositions)
    
    // 緊急対応実行
    const response = await this.executeEmergencyResponse(accountId, strategy, riskState)
    
    return response
  }

  /**
   * 証拠金維持率危険レベルでの予防的対応
   */
  async handleCriticalMarginLevel(
    accountId: string,
    marginLevel: number,
    marginInfo: AccountMarginInfo
  ): Promise<EmergencyResponse | null> {
    if (marginLevel > 50) {
      return null // 危険レベルではない
    }

    console.log(`[EmergencyActionManager] Critical margin level detected: ${marginLevel}% for account: ${accountId}`)

    const riskState: RiskMonitoringState = {
      accountId,
      marginLevel,
      freeMargin: marginInfo.freeMargin,
      usedMargin: marginInfo.usedMargin,
      balance: marginInfo.balance,
      equity: marginInfo.equity,
      bonusAmount: marginInfo.bonusAmount,
      riskLevel: 'critical',
      lastUpdate: new Date(),
      lossCutLevel: 20, // 一般的なロスカットレベル
      predictions: {
        timeToCritical: 0, // 既に危険
        requiredRecovery: marginInfo.usedMargin * 0.3 // 回復に必要な金額
      }
    }

    // 予防的戦略選択
    const strategy = this.selectPreventiveStrategy(riskState)
    
    // 予防的対応実行
    return await this.executeEmergencyResponse(accountId, strategy, riskState)
  }

  /**
   * 戦略選択ロジック
   */
  private selectStrategy(
    riskState: RiskMonitoringState,
    relatedPositions: string[]
  ): EmergencyStrategy {
    const scenarioType = this.determineScenarioType(riskState, relatedPositions)
    
    const strategyKey = `${scenarioType}_${riskState.riskLevel}`
    const strategy = this.strategyRegistry.get(strategyKey) || this.getDefaultStrategy()

    console.log(`[EmergencyActionManager] Selected strategy: ${strategyKey}`)
    return strategy
  }

  /**
   * 予防的戦略選択
   */
  private selectPreventiveStrategy(riskState: RiskMonitoringState): EmergencyStrategy {
    return this.strategyRegistry.get('preventive_critical') || this.getPreventiveStrategy()
  }

  /**
   * シナリオタイプ判定
   */
  private determineScenarioType(
    riskState: RiskMonitoringState,
    relatedPositions: string[]
  ): EmergencyStrategy['scenarioType'] {
    if (relatedPositions.length > 5) {
      return 'correlated_positions'
    }
    
    // 複数口座の関連性チェック（将来実装）
    // if (this.hasMultiAccountCorrelation(riskState.accountId)) {
    //   return 'multi_account'
    // }

    return 'single_account'
  }

  /**
   * 緊急対応実行
   */
  private async executeEmergencyResponse(
    accountId: string,
    strategy: EmergencyStrategy,
    riskState: RiskMonitoringState
  ): Promise<EmergencyResponse> {
    const responseId = `emergency_${accountId}_${Date.now()}`
    
    const response: EmergencyResponse = {
      id: responseId,
      accountId,
      strategy,
      executedActions: [],
      status: 'executing',
      startTime: new Date()
    }

    this.activeResponses.set(responseId, response)

    try {
      // アクションを優先度順にソート
      const sortedActions = [...strategy.actions].sort((a, b) => b.priority - a.priority)

      for (const action of sortedActions) {
        const actionResult = await this.executeAction(action, riskState)
        response.executedActions.push(actionResult)

        if (!actionResult.success) {
          console.error(`[EmergencyActionManager] Action failed: ${action.type}`, actionResult.error)
        }

        // 成功条件チェック
        if (await this.checkSuccessCriteria(response, strategy.successCriteria)) {
          response.status = 'completed'
          break
        }
      }

      // タイムアウトチェック
      const executionTime = Date.now() - response.startTime.getTime()
      if (executionTime > strategy.maxExecutionTime) {
        response.status = 'timeout'
      }

      if (response.status === 'executing') {
        response.status = 'failed'
      }

    } catch (error) {
      console.error('[EmergencyActionManager] Emergency response failed:', error)
      response.status = 'failed'
    }

    response.endTime = new Date()
    response.totalLossAvoidance = this.calculateLossAvoidance(response)
    
    this.activeResponses.delete(responseId)
    this.executionHistory.push(response)

    console.log(`[EmergencyActionManager] Emergency response completed: ${response.status}`)
    return response
  }

  /**
   * 個別アクション実行
   */
  private async executeAction(
    action: EmergencyAction,
    riskState: RiskMonitoringState
  ): Promise<EmergencyActionResult> {
    const startTime = Date.now()
    
    try {
      switch (action.type) {
        case 'immediate_close':
          return await this.executeImmediateClose(action, riskState)
        case 'partial_close':
          return await this.executePartialClose(action, riskState)
        case 'hedge_open':
          return await this.executeHedgeOpen(action, riskState)
        case 'balance_transfer':
          return await this.executeBalanceTransfer(action, riskState)
        default:
          throw new Error(`Unknown action type: ${action.type}`)
      }
    } catch (error) {
      return {
        action,
        success: false,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 即座決済実行
   */
  private async executeImmediateClose(
    action: EmergencyAction,
    riskState: RiskMonitoringState
  ): Promise<EmergencyActionResult> {
    const startTime = Date.now()
    
    // TODO: 実際のポジション決済APIを呼び出し
    console.log(`[EmergencyActionManager] Executing immediate close for positions: ${action.targetPositions.join(', ')}`)
    
    // シミュレーション
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return {
      action,
      success: true,
      executionTime: Date.now() - startTime,
      result: `Closed ${action.targetPositions.length} positions`,
      lossReduction: action.parameters.maxLoss || 0
    }
  }

  /**
   * 部分決済実行
   */
  private async executePartialClose(
    action: EmergencyAction,
    riskState: RiskMonitoringState
  ): Promise<EmergencyActionResult> {
    const startTime = Date.now()
    
    console.log(`[EmergencyActionManager] Executing partial close: ${action.parameters.percentage}%`)
    
    // シミュレーション
    await new Promise(resolve => setTimeout(resolve, 150))
    
    return {
      action,
      success: true,
      executionTime: Date.now() - startTime,
      result: `Partially closed ${action.parameters.percentage}% of positions`,
      lossReduction: (action.parameters.maxLoss || 0) * (action.parameters.percentage || 50) / 100
    }
  }

  /**
   * ヘッジポジション作成実行
   */
  private async executeHedgeOpen(
    action: EmergencyAction,
    riskState: RiskMonitoringState
  ): Promise<EmergencyActionResult> {
    const startTime = Date.now()
    
    console.log(`[EmergencyActionManager] Executing hedge open with ratio: ${action.parameters.hedgeRatio}`)
    
    // シミュレーション
    await new Promise(resolve => setTimeout(resolve, 200))
    
    return {
      action,
      success: true,
      executionTime: Date.now() - startTime,
      result: `Opened hedge positions with ratio ${action.parameters.hedgeRatio}`,
      lossReduction: riskState.usedMargin * 0.1 // 仮の損失回避額
    }
  }

  /**
   * 口座間資金移動実行
   */
  private async executeBalanceTransfer(
    action: EmergencyAction,
    riskState: RiskMonitoringState
  ): Promise<EmergencyActionResult> {
    const startTime = Date.now()
    
    console.log(`[EmergencyActionManager] Executing balance transfer: $${action.parameters.amount}`)
    
    // シミュレーション
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return {
      action,
      success: true,
      executionTime: Date.now() - startTime,
      result: `Transferred $${action.parameters.amount} to account`,
      lossReduction: action.parameters.amount || 0
    }
  }

  /**
   * 成功条件チェック
   */
  private async checkSuccessCriteria(
    response: EmergencyResponse,
    criteria: EmergencySuccessCriteria
  ): Promise<boolean> {
    // 実際の証拠金維持率を取得してチェック
    // TODO: リアルタイム証拠金情報取得API実装
    
    const executionTime = Date.now() - response.startTime.getTime()
    if (executionTime > criteria.timeoutMinutes * 60 * 1000) {
      return false
    }

    const totalLossAvoidance = response.executedActions.reduce(
      (sum, result) => sum + (result.lossReduction || 0), 0
    )

    return totalLossAvoidance >= criteria.maxAcceptableLoss
  }

  /**
   * 損失回避額計算
   */
  private calculateLossAvoidance(response: EmergencyResponse): number {
    return response.executedActions.reduce(
      (sum, result) => sum + (result.lossReduction || 0), 0
    )
  }

  /**
   * 緊急モード発動
   */
  private activateEmergencyMode(accountId: string, trigger: string): void {
    this.emergencyMode = {
      isActive: true,
      triggeredAt: new Date(),
      triggeredBy: trigger,
      affectedAccounts: [accountId],
      suspendedOperations: ['auto_trading', 'new_positions'],
      recoveryActions: ['monitor_recovery', 'validate_safety']
    }

    console.log(`[EmergencyActionManager] Emergency mode activated for account: ${accountId}`)
  }

  /**
   * 緊急モード解除
   */
  deactivateEmergencyMode(): void {
    this.emergencyMode.isActive = false
    console.log('[EmergencyActionManager] Emergency mode deactivated')
  }

  /**
   * デフォルト戦略初期化
   */
  private initializeDefaultStrategies(): void {
    // 単一口座・危険レベル戦略
    this.strategyRegistry.set('single_account_critical', {
      scenarioType: 'single_account',
      maxExecutionTime: 30000, // 30秒
      successCriteria: {
        marginLevelTarget: 100,
        maxAcceptableLoss: 1000,
        timeoutMinutes: 0.5
      },
      actions: [
        {
          type: 'immediate_close',
          priority: 10,
          targetPositions: [],
          parameters: { maxLoss: 500 }
        },
        {
          type: 'partial_close',
          priority: 8,
          targetPositions: [],
          parameters: { percentage: 50, maxLoss: 300 }
        }
      ]
    })

    // 予防的戦略
    this.strategyRegistry.set('preventive_critical', {
      scenarioType: 'single_account',
      maxExecutionTime: 60000, // 60秒
      successCriteria: {
        marginLevelTarget: 150,
        maxAcceptableLoss: 500,
        timeoutMinutes: 1
      },
      actions: [
        {
          type: 'hedge_open',
          priority: 9,
          targetPositions: [],
          parameters: { hedgeRatio: 0.5 }
        },
        {
          type: 'partial_close',
          priority: 7,
          targetPositions: [],
          parameters: { percentage: 25, maxLoss: 200 }
        }
      ]
    })
  }

  /**
   * デフォルト戦略取得
   */
  private getDefaultStrategy(): EmergencyStrategy {
    return this.strategyRegistry.get('single_account_critical') || {
      scenarioType: 'single_account',
      maxExecutionTime: 30000,
      successCriteria: {
        marginLevelTarget: 100,
        maxAcceptableLoss: 1000,
        timeoutMinutes: 0.5
      },
      actions: [
        {
          type: 'immediate_close',
          priority: 10,
          targetPositions: [],
          parameters: { maxLoss: 1000 }
        }
      ]
    }
  }

  /**
   * 予防的戦略取得
   */
  private getPreventiveStrategy(): EmergencyStrategy {
    return this.strategyRegistry.get('preventive_critical') || {
      scenarioType: 'single_account',
      maxExecutionTime: 60000,
      successCriteria: {
        marginLevelTarget: 150,
        maxAcceptableLoss: 500,
        timeoutMinutes: 1
      },
      actions: [
        {
          type: 'hedge_open',
          priority: 9,
          targetPositions: [],
          parameters: { hedgeRatio: 0.5 }
        }
      ]
    }
  }

  // ゲッター
  getEmergencyMode(): EmergencyMode {
    return { ...this.emergencyMode }
  }

  getActiveResponses(): EmergencyResponse[] {
    return Array.from(this.activeResponses.values())
  }

  getExecutionHistory(): EmergencyResponse[] {
    return [...this.executionHistory]
  }

  isEmergencyModeActive(): boolean {
    return this.emergencyMode.isActive
  }
}