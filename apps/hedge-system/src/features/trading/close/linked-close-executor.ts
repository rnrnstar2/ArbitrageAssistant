import { v4 as uuidv4 } from 'uuid'
import { 
  LinkedCloseRequest, 
  LinkedCloseResult, 
  LinkedCloseAction, 
  CloseResult,
  Position
} from './types'
import { 
  CommandMessage, 
  ClosePositionParams,
  COMMAND_ACTIONS,
  MESSAGE_TYPES 
} from '../../../../lib/websocket/message-types'

export class LinkedCloseExecutor {
  private activeRequests = new Map<string, LinkedCloseRequest>()
  private results = new Map<string, LinkedCloseResult>()
  private websocketClient: any // WebSocketClientのインスタンス

  constructor(websocketClient: any) {
    this.websocketClient = websocketClient
  }

  /**
   * 連動決済リクエストを実行
   */
  async executeLinkedClose(request: LinkedCloseRequest): Promise<string> {
    const requestId = uuidv4()
    
    this.activeRequests.set(requestId, request)
    
    const result: LinkedCloseResult = {
      requestId,
      status: 'pending',
      results: new Map(),
      rollbackRequired: false
    }
    
    this.results.set(requestId, result)

    try {
      // 設定に基づいて実行方法を決定
      if (request.settings.closeOrder === 'simultaneous') {
        await this.executeSimultaneous(requestId, request)
      } else {
        await this.executeSequential(requestId, request)
      }
    } catch (error) {
      result.status = 'failed'
      result.error = error instanceof Error ? error.message : 'Unknown error'
      
      if (request.settings.rollbackOnFailure) {
        await this.rollbackPartialExecutions(requestId)
      }
    }

    return requestId
  }

  /**
   * 同時実行
   */
  private async executeSimultaneous(requestId: string, request: LinkedCloseRequest) {
    const result = this.results.get(requestId)!
    result.status = 'executing'

    const promises = request.actions.map(action => 
      this.executeCloseAction(requestId, action)
    )

    try {
      await Promise.allSettled(promises)
      this.checkExecutionCompletion(requestId)
    } catch (error) {
      result.status = 'failed'
      result.error = error instanceof Error ? error.message : 'Simultaneous execution failed'
      throw error
    }
  }

  /**
   * 順次実行
   */
  private async executeSequential(requestId: string, request: LinkedCloseRequest) {
    const result = this.results.get(requestId)!
    result.status = 'executing'

    // 優先度順にソート
    const sortedActions = [...request.actions].sort((a, b) => a.priority - b.priority)

    for (const action of sortedActions) {
      try {
        await this.executeCloseAction(requestId, action)
        
        // 遅延設定がある場合は待機
        if (request.settings.sequentialDelay && request.settings.sequentialDelay > 0) {
          await this.delay(request.settings.sequentialDelay * 1000)
        }
      } catch (error) {
        console.error(`Failed to execute action for position ${action.positionId}:`, error)
        
        if (request.settings.rollbackOnFailure) {
          result.rollbackRequired = true
          result.status = 'failed'
          result.error = `Sequential execution failed at position ${action.positionId}`
          throw error
        }
      }
    }

    this.checkExecutionCompletion(requestId)
  }

  /**
   * 個別決済アクションを実行
   */
  private async executeCloseAction(requestId: string, action: LinkedCloseAction): Promise<void> {
    if (action.action === 'none') {
      return
    }

    const commandId = uuidv4()
    const result = this.results.get(requestId)!

    const closeResult: CloseResult = {
      positionId: action.positionId,
      status: 'pending'
    }

    result.results.set(action.positionId, closeResult)

    try {
      if (action.action === 'close') {
        await this.sendCloseCommand(commandId, action)
      } else if (action.action === 'trail') {
        await this.sendTrailCommand(commandId, action)
      }

      // 結果待ちのタイムアウト設定（30秒）
      await this.waitForResult(commandId, 30000)
      
    } catch (error) {
      closeResult.status = 'failed'
      closeResult.error = error instanceof Error ? error.message : 'Unknown error'
      throw error
    }
  }

  /**
   * 決済コマンドを送信
   */
  private async sendCloseCommand(commandId: string, action: LinkedCloseAction) {
    const params: ClosePositionParams = {
      positionId: action.positionId,
      price: action.closeType === 'limit' ? action.targetPrice : undefined
    }

    const message: CommandMessage = {
      type: MESSAGE_TYPES.COMMAND,
      payload: {
        commandId,
        action: COMMAND_ACTIONS.CLOSE_POSITION,
        params
      },
      timestamp: Date.now()
    }

    return this.websocketClient.sendMessage(message)
  }

  /**
   * トレールコマンドを送信
   */
  private async sendTrailCommand(commandId: string, action: LinkedCloseAction) {
    if (!action.trailSettings) {
      throw new Error('Trail settings required for trail action')
    }

    const message: CommandMessage = {
      type: MESSAGE_TYPES.COMMAND,
      payload: {
        commandId,
        action: COMMAND_ACTIONS.SET_TRAIL_STOP,
        params: {
          positionId: action.positionId,
          trailAmount: action.trailSettings.trailAmount,
          startPrice: action.trailSettings.startPrice,
          step: action.trailSettings.step
        }
      },
      timestamp: Date.now()
    }

    return this.websocketClient.sendMessage(message)
  }

  /**
   * コマンド結果を待機
   */
  private async waitForResult(commandId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command ${commandId} timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      // 結果受信のイベントリスナーを設定
      const handleResult = (message: any) => {
        if (message.commandId === commandId) {
          clearTimeout(timeout)
          
          if (message.success) {
            resolve()
          } else {
            reject(new Error(message.error || 'Command failed'))
          }
          
          // リスナーを削除
          this.websocketClient.removeListener('command_result', handleResult)
        }
      }

      this.websocketClient.on('command_result', handleResult)
    })
  }

  /**
   * 実行完了チェック
   */
  private checkExecutionCompletion(requestId: string) {
    const result = this.results.get(requestId)!
    const request = this.activeRequests.get(requestId)!

    const totalActions = request.actions.filter(a => a.action !== 'none').length
    const completedActions = Array.from(result.results.values())
      .filter(r => r.status === 'executed' || r.status === 'failed').length

    if (completedActions === totalActions) {
      const failedCount = Array.from(result.results.values())
        .filter(r => r.status === 'failed').length

      if (failedCount === 0) {
        result.status = 'completed'
      } else if (failedCount < totalActions) {
        result.status = 'partially_completed'
      } else {
        result.status = 'failed'
      }

      result.completedAt = new Date()
    }
  }

  /**
   * 部分実行のロールバック
   */
  private async rollbackPartialExecutions(requestId: string): Promise<void> {
    const result = this.results.get(requestId)!
    
    // 成功した決済を復元（実際の実装では複雑な処理が必要）
    console.warn(`Rollback required for request ${requestId}, but rollback is not fully implemented`)
    
    // 簡単な例：失敗をログに記録
    const succeededPositions = Array.from(result.results.entries())
      .filter(([, r]) => r.status === 'executed')
      .map(([positionId]) => positionId)

    if (succeededPositions.length > 0) {
      console.error(`Partial execution detected. Successfully closed positions: ${succeededPositions.join(', ')}`)
    }
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 実行結果を取得
   */
  getResult(requestId: string): LinkedCloseResult | undefined {
    return this.results.get(requestId)
  }

  /**
   * 実行状況を取得
   */
  getStatus(requestId: string): string | undefined {
    return this.results.get(requestId)?.status
  }

  /**
   * アクティブな実行を取得
   */
  getActiveRequests(): string[] {
    return Array.from(this.activeRequests.keys())
  }

  /**
   * 実行をキャンセル（未実装）
   */
  async cancelExecution(requestId: string): Promise<void> {
    // 実装が必要：進行中の実行をキャンセルする機能
    console.warn(`Cancel execution for ${requestId} is not implemented`)
  }

  /**
   * クリーンアップ
   */
  cleanup(requestId: string) {
    this.activeRequests.delete(requestId)
    this.results.delete(requestId)
  }
}