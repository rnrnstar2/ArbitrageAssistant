import { v4 as uuidv4 } from 'uuid'
import { RiskMonitoringState } from './types/risk-types'
import { WebSocketClient } from '../../lib/websocket/websocket-client'
import { 
  CommandMessage, 
  COMMAND_ACTIONS, 
  MESSAGE_TYPES 
} from '../../lib/websocket/message-types'

/**
 * アクションステップの定義
 */
export interface ActionStep {
  type: 'close_position' | 'open_hedge' | 'rebalance' | 'notify'
  targetAccountId?: string
  parameters: Record<string, any>
  rollbackAction?: ActionStep
  timeout: number
  retryCount: number
}

/**
 * ネクストアクションの定義
 */
export interface NextAction {
  id: string
  positionId: string
  trigger: {
    type: 'margin_level' | 'loss_amount' | 'profit_target'
    threshold: number
    condition: 'above' | 'below' | 'equals'
  }
  actions: ActionStep[]
  isActive: boolean
  priority: number
  executionMode: 'sequential' | 'parallel'
}

/**
 * アクション実行結果
 */
export interface ActionExecutionResult {
  stepId: string
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled'
  error?: string
  result?: any
  startTime?: Date
  endTime?: Date
  rollbackRequired?: boolean
}

/**
 * チェーン実行結果
 */
export interface ChainExecutionResult {
  chainId: string
  actionId: string
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'partially_completed'
  results: Map<string, ActionExecutionResult>
  error?: string
  startTime: Date
  endTime?: Date
  rollbackExecuted?: boolean
  triggeredBy?: {
    accountId: string
    marginLevel: number
    riskLevel: string
  }
}

/**
 * 実行コンテキスト
 */
interface ExecutionContext {
  chainId: string
  actionId: string
  accountId: string
  currentState: RiskMonitoringState
  websocketClient?: WebSocketClient
  emergencyStop: boolean
  rollbackStates: Map<string, any>
}

/**
 * アクションチェーン実行エンジン
 */
export class ActionChainExecutor {
  private activeExecutions = new Map<string, ChainExecutionResult>()
  private nextActions = new Map<string, NextAction>()
  private executionHistory: ChainExecutionResult[] = []
  private websocketClient?: WebSocketClient
  private emergencyStop = false
  private maxConcurrentExecutions = 5
  private currentExecutions = 0

  private readonly DEFAULT_TIMEOUT = 30000 // 30秒
  private readonly DEFAULT_RETRY_COUNT = 2

  constructor(websocketClient?: WebSocketClient) {
    this.websocketClient = websocketClient
  }

  /**
   * ネクストアクションを登録
   */
  registerNextAction(action: NextAction): void {
    this.nextActions.set(action.id, action)
  }

  /**
   * ネクストアクションを削除
   */
  unregisterNextAction(actionId: string): void {
    this.nextActions.delete(actionId)
  }

  /**
   * 条件をチェックしてアクションを実行
   */
  async checkAndExecute(accountId: string, currentState: RiskMonitoringState): Promise<string[]> {
    if (this.emergencyStop) {
      return []
    }

    const executedChains: string[] = []
    const eligibleActions = this.findEligibleActions(accountId, currentState)

    for (const action of eligibleActions) {
      if (this.currentExecutions >= this.maxConcurrentExecutions) {
        console.warn(`Maximum concurrent executions (${this.maxConcurrentExecutions}) reached`)
        break
      }

      try {
        const chainId = await this.executeActionChain(action, accountId, currentState)
        executedChains.push(chainId)
      } catch (error) {
        console.error(`Failed to execute action chain for ${action.id}:`, error)
      }
    }

    return executedChains
  }

  /**
   * 条件に合致するアクションを検索
   */
  private findEligibleActions(accountId: string, currentState: RiskMonitoringState): NextAction[] {
    const eligibleActions: NextAction[] = []

    for (const action of this.nextActions.values()) {
      if (!action.isActive) continue

      const isEligible = this.evaluateCondition(action, accountId, currentState)
      if (isEligible) {
        eligibleActions.push(action)
      }
    }

    // 優先度順にソート
    return eligibleActions.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 条件評価
   */
  private evaluateCondition(action: NextAction, accountId: string, currentState: RiskMonitoringState): boolean {
    const { trigger } = action

    let currentValue: number
    switch (trigger.type) {
      case 'margin_level':
        currentValue = currentState.marginLevel
        break
      case 'loss_amount':
        // 損失額の計算が必要な場合
        currentValue = currentState.equity - currentState.balance
        break
      case 'profit_target':
        // 利益目標の計算が必要な場合
        currentValue = currentState.equity - currentState.balance
        break
      default:
        return false
    }

    switch (trigger.condition) {
      case 'above':
        return currentValue > trigger.threshold
      case 'below':
        return currentValue < trigger.threshold
      case 'equals':
        return Math.abs(currentValue - trigger.threshold) < 0.01
      default:
        return false
    }
  }

  /**
   * アクションチェーンを実行
   */
  async executeActionChain(
    action: NextAction, 
    accountId: string, 
    currentState: RiskMonitoringState
  ): Promise<string> {
    const chainId = uuidv4()
    this.currentExecutions++

    const result: ChainExecutionResult = {
      chainId,
      actionId: action.id,
      status: 'pending',
      results: new Map(),
      startTime: new Date(),
      triggeredBy: {
        accountId,
        marginLevel: currentState.marginLevel,
        riskLevel: currentState.riskLevel
      }
    }

    this.activeExecutions.set(chainId, result)

    const context: ExecutionContext = {
      chainId,
      actionId: action.id,
      accountId,
      currentState,
      websocketClient: this.websocketClient,
      emergencyStop: false,
      rollbackStates: new Map()
    }

    try {
      result.status = 'executing'

      if (action.executionMode === 'parallel') {
        await this.executeParallel(action.actions, context)
      } else {
        await this.executeSequential(action.actions, context)
      }

      this.checkExecutionCompletion(chainId)
    } catch (error) {
      result.status = 'failed'
      result.error = error instanceof Error ? error.message : 'Unknown error'
      result.endTime = new Date()

      // ロールバックが必要かチェック
      if (this.shouldRollback(result)) {
        await this.executeRollback(context)
      }
    } finally {
      this.currentExecutions--
      this.executionHistory.push(result)
      
      // 完了したチェーンをアクティブリストから削除
      if (result.status !== 'executing') {
        this.activeExecutions.delete(chainId)
      }
    }

    return chainId
  }

  /**
   * 並列実行
   */
  private async executeParallel(actions: ActionStep[], context: ExecutionContext): Promise<void> {
    const promises = actions.map(action => this.executeAction(action, context))
    await Promise.allSettled(promises)
  }

  /**
   * 順次実行
   */
  private async executeSequential(actions: ActionStep[], context: ExecutionContext): Promise<void> {
    for (const action of actions) {
      if (context.emergencyStop || this.emergencyStop) {
        break
      }
      await this.executeAction(action, context)
    }
  }

  /**
   * 個別アクションを実行
   */
  private async executeAction(step: ActionStep, context: ExecutionContext): Promise<void> {
    const stepId = uuidv4()
    const result: ActionExecutionResult = {
      stepId,
      status: 'pending',
      startTime: new Date()
    }

    const chainResult = this.activeExecutions.get(context.chainId)!
    chainResult.results.set(stepId, result)

    try {
      result.status = 'executing'

      // 実行前の状態を保存（ロールバック用）
      if (step.rollbackAction) {
        context.rollbackStates.set(stepId, await this.captureStateForRollback(step, context))
      }

      switch (step.type) {
        case 'close_position':
          await this.executeClosePosition(step, context)
          break
        case 'open_hedge':
          await this.executeOpenHedge(step, context)
          break
        case 'rebalance':
          await this.executeRebalance(step, context)
          break
        case 'notify':
          await this.executeNotify(step, context)
          break
        default:
          throw new Error(`Unknown action type: ${step.type}`)
      }

      result.status = 'completed'
      result.endTime = new Date()
    } catch (error) {
      result.status = 'failed'
      result.error = error instanceof Error ? error.message : 'Unknown error'
      result.endTime = new Date()
      result.rollbackRequired = !!step.rollbackAction
      throw error
    }
  }

  /**
   * ポジション決済アクション
   */
  private async executeClosePosition(step: ActionStep, context: ExecutionContext): Promise<void> {
    if (!context.websocketClient) {
      throw new Error('WebSocket client not available for position close')
    }

    const { positionId, price } = step.parameters
    const commandId = uuidv4()

    const message: CommandMessage = {
      type: MESSAGE_TYPES.COMMAND,
      payload: {
        commandId,
        action: COMMAND_ACTIONS.CLOSE_POSITION,
        params: {
          positionId,
          price
        }
      },
      timestamp: Date.now()
    }

    context.websocketClient.send(message)
    await this.waitForCommandResult(commandId, step.timeout || this.DEFAULT_TIMEOUT)
  }

  /**
   * ヘッジポジション開設アクション
   */
  private async executeOpenHedge(step: ActionStep, context: ExecutionContext): Promise<void> {
    if (!context.websocketClient) {
      throw new Error('WebSocket client not available for hedge position')
    }

    const { symbol, direction, lotSize, targetAccountId } = step.parameters
    const commandId = uuidv4()

    const message: CommandMessage = {
      type: MESSAGE_TYPES.COMMAND,
      payload: {
        commandId,
        action: COMMAND_ACTIONS.ENTRY,
        params: {
          symbol,
          direction,
          lotSize,
          orderType: 'MARKET',
          accountId: targetAccountId || context.accountId
        }
      },
      timestamp: Date.now()
    }

    context.websocketClient.send(message)
    await this.waitForCommandResult(commandId, step.timeout || this.DEFAULT_TIMEOUT)
  }

  /**
   * リバランスアクション
   */
  private async executeRebalance(step: ActionStep, context: ExecutionContext): Promise<void> {
    // 口座間リバランスの実装
    const { sourceAccountId, targetAccountId, amount } = step.parameters
    
    console.log(`Executing rebalance: ${amount} from ${sourceAccountId} to ${targetAccountId}`)
    
    // 実際のリバランス処理は外部システムとの連携が必要
    // ここではログ出力のみ
  }

  /**
   * 通知アクション
   */
  private async executeNotify(step: ActionStep, context: ExecutionContext): Promise<void> {
    const { message, severity, channels } = step.parameters

    console.log(`Risk management notification [${severity}]: ${message}`)

    // デスクトップ通知
    if (channels?.includes('desktop')) {
      // Tauri通知API呼び出し（実装必要）
    }

    // 音声通知
    if (channels?.includes('sound')) {
      // 音声再生（実装必要）
    }

    // メール通知
    if (channels?.includes('email')) {
      // メール送信（実装必要）
    }
  }

  /**
   * コマンド結果待ち
   */
  private async waitForCommandResult(commandId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command ${commandId} timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      // WebSocketからの結果受信処理
      const handleResult = (message: any) => {
        if (message.commandId === commandId) {
          clearTimeout(timeout)
          
          if (message.success) {
            resolve()
          } else {
            reject(new Error(message.error || 'Command failed'))
          }
        }
      }

      // リスナー登録（実際の実装では適切なイベント処理が必要）
      if (this.websocketClient) {
        this.websocketClient.on('command_result', handleResult)
      }
    })
  }

  /**
   * 実行完了チェック
   */
  private checkExecutionCompletion(chainId: string): void {
    const result = this.activeExecutions.get(chainId)!
    const resultValues = Array.from(result.results.values())
    
    const completedCount = resultValues.filter(r => 
      r.status === 'completed' || r.status === 'failed'
    ).length
    const totalCount = resultValues.length

    if (completedCount === totalCount) {
      const failedCount = resultValues.filter(r => r.status === 'failed').length
      
      if (failedCount === 0) {
        result.status = 'completed'
      } else if (failedCount < totalCount) {
        result.status = 'partially_completed'
      } else {
        result.status = 'failed'
      }

      result.endTime = new Date()
    }
  }

  /**
   * ロールバック実行判定
   */
  private shouldRollback(result: ChainExecutionResult): boolean {
    const hasRollbackRequired = Array.from(result.results.values())
      .some(r => r.rollbackRequired && r.status === 'failed')
    
    return hasRollbackRequired && result.status === 'failed'
  }

  /**
   * ロールバック実行
   */
  private async executeRollback(context: ExecutionContext): Promise<void> {
    const chainResult = this.activeExecutions.get(context.chainId)!
    chainResult.rollbackExecuted = true

    console.log(`Executing rollback for chain ${context.chainId}`)

    for (const [stepId, state] of context.rollbackStates.entries()) {
      try {
        await this.executeRollbackStep(stepId, state, context)
      } catch (error) {
        console.error(`Rollback failed for step ${stepId}:`, error)
      }
    }
  }

  /**
   * 個別ステップのロールバック
   */
  private async executeRollbackStep(stepId: string, state: any, context: ExecutionContext): Promise<void> {
    // ロールバック処理の実装
    console.log(`Rolling back step ${stepId}`)
  }

  /**
   * ロールバック用状態キャプチャ
   */
  private async captureStateForRollback(step: ActionStep, context: ExecutionContext): Promise<any> {
    // 必要な状態情報をキャプチャ
    return {
      timestamp: new Date(),
      accountId: context.accountId,
      step: step.type,
      parameters: step.parameters
    }
  }

  /**
   * 緊急停止
   */
  emergencyStopAll(): void {
    this.emergencyStop = true
    
    for (const result of this.activeExecutions.values()) {
      if (result.status === 'executing') {
        result.status = 'cancelled'
        result.endTime = new Date()
      }
    }
  }

  /**
   * 緊急停止解除
   */
  resumeOperations(): void {
    this.emergencyStop = false
  }

  /**
   * 特定チェーンの実行を停止
   */
  stopExecution(chainId: string): boolean {
    const result = this.activeExecutions.get(chainId)
    if (result && result.status === 'executing') {
      result.status = 'cancelled'
      result.endTime = new Date()
      return true
    }
    return false
  }

  /**
   * 実行状態取得
   */
  getExecutionStatus(chainId: string): ChainExecutionResult | undefined {
    return this.activeExecutions.get(chainId)
  }

  /**
   * 全実行状態取得
   */
  getAllExecutions(): ChainExecutionResult[] {
    return Array.from(this.activeExecutions.values())
  }

  /**
   * 実行履歴取得
   */
  getExecutionHistory(): ChainExecutionResult[] {
    return [...this.executionHistory]
  }

  /**
   * 登録されたアクション一覧取得
   */
  getRegisteredActions(): NextAction[] {
    return Array.from(this.nextActions.values())
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.activeExecutions.clear()
    this.nextActions.clear()
    this.executionHistory.length = 0
    this.emergencyStop = false
    this.currentExecutions = 0
  }

  /**
   * 同時実行数制限設定
   */
  setMaxConcurrentExecutions(max: number): void {
    this.maxConcurrentExecutions = Math.max(1, max)
  }

  /**
   * WebSocketクライアント更新
   */
  updateWebSocketClient(client: WebSocketClient): void {
    this.websocketClient = client
  }
}