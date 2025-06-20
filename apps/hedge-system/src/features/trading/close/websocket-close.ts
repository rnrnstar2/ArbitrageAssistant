import { WebSocketClient } from "../../../../lib/websocket/websocket-client";
import { 
  ClosePositionParams, 
  CommandMessage, 
  COMMAND_ACTIONS, 
  WebSocketMessage,
  isAckMessage,
  isErrorMessage,
  CloseResultMessage,
  isCloseResultMessage
} from "../../../../lib/websocket/message-types";
import { DataSyncManager } from "../../ea-management/data-sync/data-sync-manager";
import { Position } from "../../ea-management/types";
import { DataChangeset } from "../../ea-management/data-sync/types";

export type CloseCommandStatus = 'idle' | 'sending' | 'success' | 'error';

export type CloseErrorType = 
  | 'connection_error'
  | 'validation_error' 
  | 'execution_error'
  | 'timeout_error'
  | 'insufficient_volume_error'
  | 'position_not_found_error'
  | 'sync_error'
  | 'unknown_error';

export interface CloseError {
  type: CloseErrorType;
  code?: string;
  message: string;
  userMessage: string;
  details?: any;
  timestamp: Date;
}

export interface CloseTimeoutConfig {
  commandTimeout: number; // 決済コマンドのタイムアウト (ms)
  connectionTimeout: number; // 接続確認のタイムアウト (ms)
  syncTimeout: number; // データ同期のタイムアウト (ms)
  retryCount: number; // タイムアウト時のリトライ回数
  retryDelay: number; // リトライ間隔 (ms)
}

export interface CloseServiceConfig {
  timeout: CloseTimeoutConfig;
  enableRetry: boolean;
  enableSyncWarning: boolean;
  enablePartialClose: boolean;
}

export interface ClosePositionCommand extends ClosePositionParams {
  accountId: string;
  closeType: 'market' | 'limit';
  quantity?: number; // 部分決済用のロット数
}

export interface CloseCommandResult {
  success: boolean;
  commandId?: string;
  error?: string;
  closeError?: CloseError;
  details?: any;
  positionId?: string;
  executedPrice?: number;
  executedTime?: string;
  actualClosedVolume?: number;
  remainingVolume?: number;
  profit?: number;
  accountId?: string;
  symbol?: string;
}

export interface CloseCommandState {
  status: CloseCommandStatus;
  error?: string;
  closeError?: CloseError;
  commandId?: string;
  positionId?: string;
  executedPrice?: number;
  executedTime?: string;
  actualClosedVolume?: number;
  remainingVolume?: number;
  profit?: number;
  accountId?: string;
  symbol?: string;
  createdAt?: Date;
  updatedAt?: Date;
  retryCount?: number;
  stateHistory?: CloseStateHistoryEntry[];
}

export interface CloseStateHistoryEntry {
  status: CloseCommandStatus;
  timestamp: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export type CloseStateEventType = 
  | 'state_changed'
  | 'state_created'
  | 'state_updated'
  | 'state_deleted'
  | 'state_error'
  | 'state_success';

export interface CloseStateEvent {
  type: CloseStateEventType;
  commandId: string;
  previousState?: CloseCommandState;
  currentState: CloseCommandState;
  timestamp: Date;
}

export type CloseStateEventHandler = (event: CloseStateEvent) => void;


const DEFAULT_CLOSE_TIMEOUT_CONFIG: CloseTimeoutConfig = {
  commandTimeout: 15000, // 15秒（決済は時間がかかる場合がある）
  connectionTimeout: 5000, // 5秒
  syncTimeout: 15000, // 15秒
  retryCount: 2,
  retryDelay: 3000 // 3秒
};

const DEFAULT_CLOSE_SERVICE_CONFIG: CloseServiceConfig = {
  timeout: DEFAULT_CLOSE_TIMEOUT_CONFIG,
  enableRetry: true,
  enableSyncWarning: true,
  enablePartialClose: true
};

export class WebSocketCloseService {
  private wsClient: WebSocketClient;
  private dataSyncManager?: DataSyncManager;
  private commandStates: Map<string, CloseCommandState> = new Map();
  private config: CloseServiceConfig;
  private stateEventHandlers: Map<CloseStateEventType, CloseStateEventHandler[]> = new Map();
  private stateHistory: Map<string, CloseStateHistoryEntry[]> = new Map();

  constructor(
    wsClient: WebSocketClient, 
    dataSyncManager?: DataSyncManager,
    config?: Partial<CloseServiceConfig>
  ) {
    this.wsClient = wsClient;
    this.dataSyncManager = dataSyncManager;
    this.config = { 
      ...DEFAULT_CLOSE_SERVICE_CONFIG, 
      ...config,
      timeout: { ...DEFAULT_CLOSE_TIMEOUT_CONFIG, ...config?.timeout }
    };
    this.initializeEventHandlers();
    this.setupMessageHandlers();
  }

  /**
   * Initialize event handler maps
   */
  private initializeEventHandlers(): void {
    const eventTypes: CloseStateEventType[] = [
      'state_changed',
      'state_created', 
      'state_updated',
      'state_deleted',
      'state_error',
      'state_success'
    ];
    
    eventTypes.forEach(eventType => {
      this.stateEventHandlers.set(eventType, []);
    });
  }

  /**
   * Send position close command to EA
   */
  async sendCloseCommand(closeCommand: ClosePositionCommand): Promise<CloseCommandResult> {
    const commandId = this.generateCommandId();
    
    try {
      // 入力値バリデーション
      const validation = this.validateCloseCommand(closeCommand);
      if (!validation.valid) {
        const closeError = this.createCloseError(
          'validation_error',
          `Validation failed: ${validation.errors.join(', ')}`,
          undefined,
          'VALIDATION_FAILED',
          { validationErrors: validation.errors }
        );
        throw closeError;
      }

      // Update state to sending
      this.updateCommandState(commandId, { 
        status: 'sending',
        positionId: closeCommand.positionId,
        accountId: closeCommand.accountId
      });

      // Create command message
      const commandMessage: CommandMessage = {
        type: "command",
        payload: {
          commandId,
          action: COMMAND_ACTIONS.CLOSE_POSITION,
          params: closeCommand,
          targetClientId: closeCommand.accountId,
        },
        timestamp: Date.now(),
      };

      // Check WebSocket connection
      if (this.wsClient.getConnectionState() !== 'connected') {
        const closeError = this.createCloseError(
          'connection_error',
          'WebSocket is not connected',
          undefined,
          'WS_NOT_CONNECTED'
        );
        throw closeError;
      }

      // Send command
      this.wsClient.send(commandMessage);

      // Wait for response with timeout
      const result = await this.waitForCommandResponse(commandId, this.config.timeout.commandTimeout);
      
      if (result.success) {
        this.updateCommandState(commandId, { 
          status: 'success', 
          commandId,
          positionId: result.positionId,
          executedPrice: result.executedPrice,
          executedTime: result.executedTime,
          actualClosedVolume: result.actualClosedVolume,
          remainingVolume: result.remainingVolume,
          profit: result.profit,
          accountId: result.accountId
        });
      } else {
        this.updateCommandState(commandId, { 
          status: 'error', 
          error: result.error,
          closeError: result.closeError,
          commandId,
          positionId: closeCommand.positionId
        });
      }

      return result;

    } catch (error) {
      let closeError: CloseError;
      let errorMessage: string;

      if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
        // It's already a CloseError
        closeError = error as CloseError;
        errorMessage = closeError.message;
      } else {
        // Convert to CloseError
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        closeError = this.createCloseError('unknown_error', errorMessage);
      }

      this.updateCommandState(commandId, { 
        status: 'error', 
        error: errorMessage,
        closeError,
        commandId,
        positionId: closeCommand.positionId
      });

      return {
        success: false,
        commandId,
        error: errorMessage,
        closeError,
        positionId: closeCommand.positionId,
        accountId: closeCommand.accountId
      };
    }
  }

  /**
   * Send batch close command for multiple positions
   */
  async sendBatchCloseCommand(closeCommands: ClosePositionCommand[]): Promise<CloseCommandResult[]> {
    const results: CloseCommandResult[] = [];
    
    // 並列実行で決済を送信
    const promises = closeCommands.map(command => this.sendCloseCommand(command));
    
    try {
      const batchResults = await Promise.allSettled(promises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Batch close failed',
            closeError: this.createCloseError(
              'execution_error',
              result.reason?.message || 'Batch close failed',
              '一括決済の処理に失敗しました。',
              'BATCH_CLOSE_FAILED',
              { originalError: result.reason }
            )
          });
        }
      }
    } catch (error) {
      console.error('Batch close command failed:', error);
      
      // すべてエラーとして扱う
      results.push(...closeCommands.map(cmd => ({
        success: false,
        error: error instanceof Error ? error.message : 'Batch close failed',
        positionId: cmd.positionId,
        accountId: cmd.accountId,
        closeError: this.createCloseError(
          'execution_error',
          error instanceof Error ? error.message : 'Batch close failed',
          '一括決済の処理に失敗しました。',
          'BATCH_CLOSE_FAILED',
          { originalError: error }
        )
      })));
    }
    
    return results;
  }

  /**
   * Get command state by ID
   */
  getCommandState(commandId: string): CloseCommandState | undefined {
    return this.commandStates.get(commandId);
  }

  /**
   * Get all command states
   */
  getAllCommandStates(): Map<string, CloseCommandState> {
    return new Map(this.commandStates);
  }

  /**
   * Clear completed or failed command states
   */
  clearCommandStates(): void {
    for (const [commandId, state] of this.commandStates.entries()) {
      if (state.status === 'success' || state.status === 'error') {
        this.commandStates.delete(commandId);
      }
    }
  }

  /**
   * Validate close command before sending
   */
  private validateCloseCommand(command: ClosePositionCommand): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!command.positionId || command.positionId.trim() === '') {
      errors.push('Position ID is required');
    }

    if (!command.accountId || command.accountId.trim() === '') {
      errors.push('Account ID is required');
    }

    if (!command.closeType || !['market', 'limit'].includes(command.closeType)) {
      errors.push('Close type must be market or limit');
    }

    // LIMIT close specific validation
    if (command.closeType === 'limit' && (command.price === undefined || command.price <= 0)) {
      errors.push('Price is required for LIMIT closes and must be greater than 0');
    }

    // Partial close validation
    if (command.quantity !== undefined) {
      if (!this.config.enablePartialClose) {
        errors.push('Partial close is not enabled');
      } else if (command.quantity <= 0) {
        errors.push('Quantity for partial close must be greater than 0');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private generateCommandId(): string {
    return `close_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateCommandState(commandId: string, newState: CloseCommandState): void {
    const previousState = this.commandStates.get(commandId);
    const now = new Date();
    
    // Enhanced state with metadata
    const enhancedState: CloseCommandState = {
      ...newState,
      commandId,
      updatedAt: now,
      createdAt: previousState?.createdAt || now,
      retryCount: previousState?.retryCount || 0,
      stateHistory: previousState?.stateHistory || []
    };

    // Add to state history
    if (previousState && previousState.status !== newState.status) {
      enhancedState.stateHistory!.push({
        status: previousState.status,
        timestamp: previousState.updatedAt || previousState.createdAt || now,
        error: previousState.error,
        metadata: {
          previousStatus: previousState.status,
          newStatus: newState.status
        }
      });
    }

    // Update retry count if this is a retry
    if (newState.status === 'sending' && previousState?.status === 'error') {
      enhancedState.retryCount = (previousState.retryCount || 0) + 1;
    }

    this.commandStates.set(commandId, enhancedState);

    // Emit appropriate events
    this.emitStateEvent('state_changed', commandId, previousState, enhancedState);
    
    if (!previousState) {
      this.emitStateEvent('state_created', commandId, undefined, enhancedState);
    } else {
      this.emitStateEvent('state_updated', commandId, previousState, enhancedState);
    }

    if (newState.status === 'error') {
      this.emitStateEvent('state_error', commandId, previousState, enhancedState);
    } else if (newState.status === 'success') {
      this.emitStateEvent('state_success', commandId, previousState, enhancedState);
    }
  }

  private createCloseError(
    type: CloseErrorType, 
    message: string, 
    userMessage?: string,
    code?: string,
    details?: any
  ): CloseError {
    return {
      type,
      code,
      message,
      userMessage: userMessage || this.getDefaultUserMessage(type, message),
      details,
      timestamp: new Date()
    };
  }

  private getDefaultUserMessage(type: CloseErrorType, message: string): string {
    switch (type) {
      case 'connection_error':
        return 'サーバーとの接続に問題があります。しばらくしてから再試行してください。';
      case 'validation_error':
        return '入力内容に問題があります。決済条件を確認してください。';
      case 'execution_error':
        return 'ポジションの決済に失敗しました。市場状況や口座状態を確認してください。';
      case 'timeout_error':
        return '決済がタイムアウトしました。サーバーの応答時間を確認してください。';
      case 'insufficient_volume_error':
        return '決済可能な数量が不足しています。ポジションの数量を確認してください。';
      case 'position_not_found_error':
        return '指定されたポジションが見つかりません。ポジション一覧を更新してください。';
      case 'sync_error':
        return 'データの同期に失敗しました。決済は実行されましたが、表示に遅延が生じる可能性があります。';
      case 'unknown_error':
      default:
        return '予期しないエラーが発生しました。サポートにお問い合わせください。';
    }
  }

  private setupMessageHandlers(): void {
    this.wsClient.on('message_received', (event, message: WebSocketMessage) => {
      if (isAckMessage(message)) {
        this.handleAckMessage(message);
      } else if (isCloseResultMessage(message)) {
        this.handleCloseResultMessage(message);
      } else if (isErrorMessage(message)) {
        this.handleErrorMessage(message);
      }
    });
  }

  private handleAckMessage(message: WebSocketMessage): void {
    if (message.payload && typeof message.payload === 'object') {
      const payload = message.payload as any;
      const messageId = payload.messageId;
      
      if (messageId && this.commandStates.has(messageId)) {
        if (payload.success) {
          // ACKだけでは完了とせず、実際の決済結果を待つ
          // ここでは状態を更新しない
          console.debug(`Close command ${messageId} acknowledged`);
        } else {
          this.updateCommandState(messageId, { 
            status: 'error', 
            error: payload.error || 'Command failed',
            commandId: messageId 
          });
        }
      }
    }
  }

  private handleCloseResultMessage(message: CloseResultMessage): void {
    const { 
      commandId, 
      success, 
      error, 
      positionId, 
      executedPrice, 
      executedTime,
      actualClosedVolume,
      remainingVolume,
      profit,
      accountId,
      symbol
    } = message.payload;
    
    if (commandId && this.commandStates.has(commandId)) {
      if (success) {
        this.updateCommandState(commandId, {
          status: 'success',
          commandId,
          positionId,
          executedPrice,
          executedTime,
          actualClosedVolume,
          remainingVolume,
          profit,
          accountId,
          symbol
        });

        // Sync position update to backend if DataSyncManager is available
        if (this.dataSyncManager && positionId && accountId) {
          this.syncPositionClose({
            commandId,
            positionId,
            executedPrice,
            executedTime,
            actualClosedVolume,
            remainingVolume,
            profit,
            accountId,
            symbol
          }).catch(syncError => {
            console.error('Failed to sync position close:', syncError);
            const closeError = this.createCloseError(
              'sync_error',
              syncError instanceof Error ? syncError.message : 'Position close sync failed',
              undefined,
              'SYNC_FAILED',
              { syncError, commandId, positionId }
            );
            
            // Update command state with sync error warning but keep success status
            this.updateCommandState(commandId, {
              status: 'success',
              commandId,
              positionId,
              executedPrice,
              executedTime,
              actualClosedVolume,
              remainingVolume,
              profit,
              accountId,
              symbol,
              closeError // Add warning about sync failure
            });
          });
        }
      } else {
        const closeError = this.createCloseError(
          'execution_error',
          error || 'Close command failed',
          undefined,
          'CLOSE_FAILED',
          { originalError: error, commandId, positionId }
        );
        
        this.updateCommandState(commandId, {
          status: 'error',
          error: error || 'Close command failed',
          closeError,
          commandId,
          positionId
        });
      }
    }
  }

  private handleErrorMessage(message: WebSocketMessage): void {
    if (message.payload && typeof message.payload === 'object') {
      const payload = message.payload as any;
      console.error('WebSocket error received:', payload);
      
      // Update all pending close commands to error state
      Array.from(this.commandStates.entries()).forEach(([commandId, state]) => {
        if (state.status === 'sending') {
          this.updateCommandState(commandId, {
            status: 'error',
            error: payload.message || 'WebSocket error',
            commandId,
            positionId: state.positionId
          });
        }
      });
    }
  }

  private async syncPositionClose(closeResult: {
    commandId: string;
    positionId: string;
    executedPrice?: number;
    executedTime?: string;
    actualClosedVolume?: number;
    remainingVolume?: number;
    profit?: number;
    accountId: string;
    symbol?: string;
  }): Promise<void> {
    if (!this.dataSyncManager) {
      throw new Error('DataSyncManager not available for position close sync');
    }

    // Create changeset for position close
    const changeset: DataChangeset = {
      accountId: closeResult.accountId,
      positions: {
        added: [],
        updated: [],
        removed: closeResult.remainingVolume === 0 ? [parseInt(closeResult.positionId)] : []
      },
      account: {
        updated: {} // Account balance will be updated by EA
      },
      connection: {
        updated: {}
      },
      timestamp: new Date()
    };

    // If partial close, update position with remaining volume
    if (closeResult.remainingVolume && closeResult.remainingVolume > 0) {
      // For partial close, we would need to create a new Position object with updated volume
      // This would require the original position data which we don't have in this context
      // The EA should handle this update and send a new position_update message
      console.log('Partial close completed, waiting for position update from EA');
    }

    await this.dataSyncManager.syncChangeset(changeset);
  }

  private waitForCommandResponse(commandId: string, timeoutMs: number): Promise<CloseCommandResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkResponse = () => {
        const state = this.commandStates.get(commandId);
        
        if (!state) {
          resolve({
            success: false,
            commandId,
            error: 'Command state not found'
          });
          return;
        }

        if (state.status === 'success') {
          resolve({
            success: true,
            commandId,
            positionId: state.positionId,
            executedPrice: state.executedPrice,
            executedTime: state.executedTime,
            actualClosedVolume: state.actualClosedVolume,
            remainingVolume: state.remainingVolume,
            profit: state.profit,
            accountId: state.accountId
          });
          return;
        }

        if (state.status === 'error') {
          resolve({
            success: false,
            commandId,
            error: state.error || 'Command failed',
            closeError: state.closeError,
            positionId: state.positionId,
            accountId: state.accountId
          });
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          const closeError = this.createCloseError(
            'timeout_error',
            `Close command timeout after ${timeoutMs}ms`,
            undefined,
            'COMMAND_TIMEOUT',
            { timeoutMs, commandId }
          );
          
          this.updateCommandState(commandId, {
            status: 'error',
            error: 'Command timeout',
            closeError,
            commandId,
            positionId: state.positionId
          });
          
          resolve({
            success: false,
            commandId,
            error: 'Command timeout',
            closeError,
            positionId: state.positionId,
            accountId: state.accountId
          });
          return;
        }

        // Continue checking
        setTimeout(checkResponse, 100);
      };

      checkResponse();
    });
  }

  /**
   * Get current timeout configuration
   */
  getTimeoutConfig(): CloseTimeoutConfig {
    return { ...this.config.timeout };
  }

  /**
   * Update timeout configuration
   */
  updateTimeoutConfig(config: Partial<CloseTimeoutConfig>): void {
    this.config.timeout = { ...this.config.timeout, ...config };
  }

  /**
   * Retry failed close command with exponential backoff
   */
  async retryCloseCommand(
    originalCommand: ClosePositionCommand, 
    attempt: number = 1
  ): Promise<CloseCommandResult> {
    const maxRetries = this.config.timeout.retryCount;
    
    if (attempt > maxRetries) {
      const closeError = this.createCloseError(
        'execution_error',
        `Close command failed after ${maxRetries} retry attempts`,
        '決済コマンドが最大再試行回数後も失敗しました。',
        'MAX_RETRIES_EXCEEDED',
        { attempt, maxRetries, originalCommand }
      );
      
      return {
        success: false,
        error: closeError.message,
        closeError,
        positionId: originalCommand.positionId,
        accountId: originalCommand.accountId
      };
    }

    // Exponential backoff: 2^attempt * base delay
    const delayMs = this.config.timeout.retryDelay * Math.pow(2, attempt - 1);
    await new Promise(resolve => setTimeout(resolve, delayMs));

    console.log(`Retrying close command for position ${originalCommand.positionId}, attempt ${attempt}/${maxRetries}`);

    try {
      return await this.sendCloseCommand(originalCommand);
    } catch (error) {
      console.error(`Retry attempt ${attempt} failed:`, error);
      
      // If this is the last attempt, return the error
      if (attempt === maxRetries) {
        const closeError = this.createCloseError(
          'execution_error',
          error instanceof Error ? error.message : 'Retry failed',
          undefined,
          'RETRY_FINAL_FAILURE',
          { attempt, maxRetries, originalError: error }
        );
        
        return {
          success: false,
          error: closeError.message,
          closeError,
          positionId: originalCommand.positionId,
          accountId: originalCommand.accountId
        };
      }

      // Continue retrying
      return this.retryCloseCommand(originalCommand, attempt + 1);
    }
  }

  /**
   * Attempt to recover from connection errors
   */
  async attemptConnectionRecovery(): Promise<boolean> {
    try {
      // Wait for connection to be re-established
      const maxWaitTime = this.config.timeout.connectionTimeout;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        if (this.wsClient.getConnectionState() === 'connected') {
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return false;
    } catch (error) {
      console.error('Connection recovery failed:', error);
      return false;
    }
  }

  /**
   * Handle critical errors with recovery strategies
   */
  private async handleCriticalError(
    error: CloseError,
    command: ClosePositionCommand
  ): Promise<CloseCommandResult> {
    console.error('Critical error in close operation:', error);

    // Strategy 1: Connection recovery for connection errors
    if (error.type === 'connection_error') {
      console.log('Attempting connection recovery...');
      const recovered = await this.attemptConnectionRecovery();
      
      if (recovered && this.config.enableRetry) {
        console.log('Connection recovered, retrying close command...');
        return this.retryCloseCommand(command);
      }
    }

    // Strategy 2: Retry for timeout errors
    if (error.type === 'timeout_error' && this.config.enableRetry) {
      console.log('Timeout detected, attempting retry...');
      return this.retryCloseCommand(command);
    }

    // Strategy 3: Validation error with suggestions
    if (error.type === 'validation_error') {
      // Try to fix common validation issues
      const fixedCommand = this.attemptValidationFix(command);
      if (fixedCommand) {
        console.log('Attempting to fix validation issues...');
        return this.sendCloseCommand(fixedCommand);
      }
    }

    // No recovery possible, return original error
    return {
      success: false,
      error: error.message,
      closeError: error,
      positionId: command.positionId,
      accountId: command.accountId
    };
  }

  /**
   * Attempt to fix common validation issues
   */
  private attemptValidationFix(command: ClosePositionCommand): ClosePositionCommand | null {
    try {
      const fixedCommand = { ...command };

      // Fix missing or invalid close type
      if (!fixedCommand.closeType || !['market', 'limit'].includes(fixedCommand.closeType)) {
        fixedCommand.closeType = 'market';
      }

      // Fix invalid quantity (round to valid lot size)
      if (fixedCommand.quantity && fixedCommand.quantity > 0) {
        fixedCommand.quantity = Math.round(fixedCommand.quantity * 100) / 100;
        fixedCommand.lots = fixedCommand.quantity;
      }

      // Remove price for market orders
      if (fixedCommand.closeType === 'market') {
        delete fixedCommand.price;
      }

      // Validate the fixed command
      const validation = this.validateCloseCommand(fixedCommand);
      return validation.valid ? fixedCommand : null;
    } catch (error) {
      console.error('Failed to fix validation issues:', error);
      return null;
    }
  }

  /**
   * Emergency close with fallback options
   */
  async emergencyClose(
    positionId: string,
    accountId: string,
    options: {
      forceMarketClose?: boolean;
      maxRetries?: number;
      ignoreValidation?: boolean;
    } = {}
  ): Promise<CloseCommandResult> {
    const emergency = {
      forceMarketClose: true,
      maxRetries: 5,
      ignoreValidation: false,
      ...options
    };

    console.log(`Emergency close initiated for position ${positionId}`);

    const emergencyCommand: ClosePositionCommand = {
      positionId,
      accountId,
      closeType: emergency.forceMarketClose ? 'market' : 'market',
      // Full close (no partial close in emergency)
    };

    // Override retry count for emergency
    const originalRetryCount = this.config.timeout.retryCount;
    this.config.timeout.retryCount = emergency.maxRetries;

    try {
      if (emergency.ignoreValidation) {
        // Skip validation and send directly
        const commandId = this.generateCommandId();
        this.updateCommandState(commandId, { 
          status: 'sending',
          positionId,
          accountId
        });

        const commandMessage: CommandMessage = {
          type: "command",
          payload: {
            commandId,
            action: COMMAND_ACTIONS.CLOSE_POSITION,
            params: emergencyCommand,
            targetClientId: accountId,
          },
          timestamp: Date.now(),
        };

        this.wsClient.send(commandMessage);
        return this.waitForCommandResponse(commandId, this.config.timeout.commandTimeout * 2); // Double timeout for emergency
      } else {
        return await this.sendCloseCommand(emergencyCommand);
      }
    } finally {
      // Restore original retry count
      this.config.timeout.retryCount = originalRetryCount;
    }
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalCommands: number;
    successCount: number;
    errorCount: number;
    errorsByType: Record<CloseErrorType, number>;
    successRate: number;
  } {
    const states = Array.from(this.commandStates.values());
    const totalCommands = states.length;
    const successCount = states.filter(s => s.status === 'success').length;
    const errorCount = states.filter(s => s.status === 'error').length;
    
    const errorsByType: Record<CloseErrorType, number> = {
      connection_error: 0,
      validation_error: 0,
      execution_error: 0,
      timeout_error: 0,
      insufficient_volume_error: 0,
      position_not_found_error: 0,
      sync_error: 0,
      unknown_error: 0
    };

    states.forEach(state => {
      if (state.closeError) {
        errorsByType[state.closeError.type]++;
      }
    });

    const successRate = totalCommands > 0 ? (successCount / totalCommands) * 100 : 0;

    return {
      totalCommands,
      successCount,
      errorCount,
      errorsByType,
      successRate: Math.round(successRate * 100) / 100
    };
  }

  /**
   * Clear error history and reset statistics
   */
  clearErrorHistory(): void {
    this.commandStates.clear();
    this.stateHistory.clear();
  }

  /**
   * Add state event listener
   */
  onStateEvent(eventType: CloseStateEventType, handler: CloseStateEventHandler): void {
    const handlers = this.stateEventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.stateEventHandlers.set(eventType, handlers);
  }

  /**
   * Remove state event listener
   */
  offStateEvent(eventType: CloseStateEventType, handler: CloseStateEventHandler): void {
    const handlers = this.stateEventHandlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.stateEventHandlers.set(eventType, handlers);
    }
  }

  /**
   * Emit state event to all listeners
   */
  private emitStateEvent(
    eventType: CloseStateEventType,
    commandId: string,
    previousState?: CloseCommandState,
    currentState?: CloseCommandState
  ): void {
    if (!currentState) return;

    const event: CloseStateEvent = {
      type: eventType,
      commandId,
      previousState,
      currentState,
      timestamp: new Date()
    };

    const handlers = this.stateEventHandlers.get(eventType) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in state event handler for ${eventType}:`, error);
      }
    });
  }

  /**
   * Get states by status
   */
  getStatesByStatus(status: CloseCommandStatus): CloseCommandState[] {
    return Array.from(this.commandStates.values()).filter(state => state.status === status);
  }

  /**
   * Get states by position ID
   */
  getStatesByPosition(positionId: string): CloseCommandState[] {
    return Array.from(this.commandStates.values()).filter(state => state.positionId === positionId);
  }

  /**
   * Get states by account ID
   */
  getStatesByAccount(accountId: string): CloseCommandState[] {
    return Array.from(this.commandStates.values()).filter(state => state.accountId === accountId);
  }

  /**
   * Get pending states (sending status)
   */
  getPendingStates(): CloseCommandState[] {
    return this.getStatesByStatus('sending');
  }

  /**
   * Get failed states (error status)
   */
  getFailedStates(): CloseCommandState[] {
    return this.getStatesByStatus('error');
  }

  /**
   * Get successful states
   */
  getSuccessfulStates(): CloseCommandState[] {
    return this.getStatesByStatus('success');
  }

  /**
   * Get state history for a command
   */
  getStateHistory(commandId: string): CloseStateHistoryEntry[] {
    const state = this.commandStates.get(commandId);
    return state?.stateHistory || [];
  }

  /**
   * Get all state history
   */
  getAllStateHistory(): Map<string, CloseStateHistoryEntry[]> {
    const allHistory = new Map<string, CloseStateHistoryEntry[]>();
    
    Array.from(this.commandStates.entries()).forEach(([commandId, state]) => {
      if (state.stateHistory && state.stateHistory.length > 0) {
        allHistory.set(commandId, state.stateHistory);
      }
    });
    
    return allHistory;
  }

  /**
   * Delete state by command ID
   */
  deleteState(commandId: string): boolean {
    const state = this.commandStates.get(commandId);
    if (state) {
      this.commandStates.delete(commandId);
      this.emitStateEvent('state_deleted', commandId, state, undefined);
      return true;
    }
    return false;
  }

  /**
   * Bulk delete states by status
   */
  deleteStatesByStatus(status: CloseCommandStatus): number {
    const statesToDelete = this.getStatesByStatus(status);
    let deletedCount = 0;

    statesToDelete.forEach(state => {
      if (state.commandId && this.deleteState(state.commandId)) {
        deletedCount++;
      }
    });

    return deletedCount;
  }

  /**
   * Cleanup old completed states
   */
  cleanupOldStates(maxAge: number = 24 * 60 * 60 * 1000): number { // Default 24 hours
    const cutoffTime = new Date(Date.now() - maxAge);
    let cleanedCount = 0;

    Array.from(this.commandStates.entries()).forEach(([commandId, state]) => {
      const isOld = state.updatedAt && state.updatedAt < cutoffTime;
      const isCompleted = state.status === 'success' || state.status === 'error';
      
      if (isOld && isCompleted) {
        this.deleteState(commandId);
        cleanedCount++;
      }
    });

    return cleanedCount;
  }

  /**
   * Export state data for persistence
   */
  exportStates(): string {
    const stateData = {
      states: Array.from(this.commandStates.entries()),
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    return JSON.stringify(stateData);
  }

  /**
   * Import state data from persistence
   */
  importStates(data: string): boolean {
    try {
      const stateData = JSON.parse(data);
      
      if (stateData.version !== '1.0') {
        console.warn('Incompatible state data version');
        return false;
      }

      // Clear current states
      this.commandStates.clear();

      // Import states
      for (const [commandId, state] of stateData.states) {
        // Convert date strings back to Date objects
        if (state.createdAt) state.createdAt = new Date(state.createdAt);
        if (state.updatedAt) state.updatedAt = new Date(state.updatedAt);
        if (state.stateHistory) {
          state.stateHistory.forEach((entry: CloseStateHistoryEntry) => {
            entry.timestamp = new Date(entry.timestamp);
          });
        }

        this.commandStates.set(commandId, state);
      }

      return true;
    } catch (error) {
      console.error('Failed to import state data:', error);
      return false;
    }
  }

  /**
   * Get state transition summary
   */
  getStateTransitionSummary(): {
    totalTransitions: number;
    transitionsByType: Record<string, number>;
    averageTimeToCompletion: number;
    retryStatistics: {
      commandsWithRetries: number;
      averageRetries: number;
      maxRetries: number;
    };
  } {
    const states = Array.from(this.commandStates.values());
    let totalTransitions = 0;
    const transitionsByType: Record<string, number> = {};
    const completionTimes: number[] = [];
    const retryStats = {
      commandsWithRetries: 0,
      totalRetries: 0,
      maxRetries: 0
    };

    states.forEach(state => {
      // Count transitions from state history
      if (state.stateHistory) {
        totalTransitions += state.stateHistory.length;
        
        state.stateHistory.forEach(historyEntry => {
          const transitionKey = `${historyEntry.status} -> ${state.status}`;
          transitionsByType[transitionKey] = (transitionsByType[transitionKey] || 0) + 1;
        });
      }

      // Calculate completion time for completed states
      if ((state.status === 'success' || state.status === 'error') && state.createdAt && state.updatedAt) {
        const completionTime = state.updatedAt.getTime() - state.createdAt.getTime();
        completionTimes.push(completionTime);
      }

      // Retry statistics
      if (state.retryCount && state.retryCount > 0) {
        retryStats.commandsWithRetries++;
        retryStats.totalRetries += state.retryCount;
        retryStats.maxRetries = Math.max(retryStats.maxRetries, state.retryCount);
      }
    });

    const averageTimeToCompletion = completionTimes.length > 0 
      ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length 
      : 0;

    const averageRetries = retryStats.commandsWithRetries > 0 
      ? retryStats.totalRetries / retryStats.commandsWithRetries 
      : 0;

    return {
      totalTransitions,
      transitionsByType,
      averageTimeToCompletion,
      retryStatistics: {
        commandsWithRetries: retryStats.commandsWithRetries,
        averageRetries: Math.round(averageRetries * 100) / 100,
        maxRetries: retryStats.maxRetries
      }
    };
  }
}

/**
 * Helper function to create and send close command
 */
export async function sendCloseCommand(
  wsClient: WebSocketClient,
  closeCommand: ClosePositionCommand,
  dataSyncManager?: DataSyncManager,
  config?: Partial<CloseServiceConfig>
): Promise<CloseCommandResult> {
  const closeService = new WebSocketCloseService(wsClient, dataSyncManager, config);
  return closeService.sendCloseCommand(closeCommand);
}

/**
 * Helper function to send batch close commands
 */
export async function sendBatchCloseCommand(
  wsClient: WebSocketClient,
  closeCommands: ClosePositionCommand[],
  dataSyncManager?: DataSyncManager,
  config?: Partial<CloseServiceConfig>
): Promise<CloseCommandResult[]> {
  const closeService = new WebSocketCloseService(wsClient, dataSyncManager, config);
  return closeService.sendBatchCloseCommand(closeCommands);
}

/**
 * Partial close calculation utilities
 */
export class PartialCloseCalculator {
  /**
   * Calculate partial close parameters
   */
  static calculatePartialClose(position: Position, closePercentage: number): {
    closeVolume: number;
    remainingVolume: number;
    estimatedProfit: number;
  } {
    if (closePercentage <= 0 || closePercentage > 100) {
      throw new Error('Close percentage must be between 0 and 100');
    }

    const closeVolume = (position.volume * closePercentage) / 100;
    const remainingVolume = position.volume - closeVolume;
    const estimatedProfit = (position.profit * closePercentage) / 100;

    return {
      closeVolume: Math.round(closeVolume * 100) / 100, // Round to 2 decimal places
      remainingVolume: Math.round(remainingVolume * 100) / 100,
      estimatedProfit: Math.round(estimatedProfit * 100) / 100
    };
  }

  /**
   * Calculate partial close by target volume
   */
  static calculatePartialCloseByVolume(position: Position, targetCloseVolume: number): {
    closeVolume: number;
    remainingVolume: number;
    closePercentage: number;
    estimatedProfit: number;
  } {
    if (targetCloseVolume <= 0 || targetCloseVolume > position.volume) {
      throw new Error(`Target close volume must be between 0 and ${position.volume}`);
    }

    const closeVolume = targetCloseVolume;
    const remainingVolume = position.volume - closeVolume;
    const closePercentage = (closeVolume / position.volume) * 100;
    const estimatedProfit = (position.profit * closePercentage) / 100;

    return {
      closeVolume: Math.round(closeVolume * 100) / 100,
      remainingVolume: Math.round(remainingVolume * 100) / 100,
      closePercentage: Math.round(closePercentage * 100) / 100,
      estimatedProfit: Math.round(estimatedProfit * 100) / 100
    };
  }

  /**
   * Calculate partial close to achieve target profit
   */
  static calculatePartialCloseByTargetProfit(position: Position, targetProfit: number): {
    closeVolume: number;
    remainingVolume: number;
    closePercentage: number;
    estimatedProfit: number;
  } | null {
    if (position.profit === 0) {
      return null; // Cannot calculate when current profit is zero
    }

    if (targetProfit <= 0 || Math.abs(targetProfit) > Math.abs(position.profit)) {
      return null; // Target profit is not achievable
    }

    const closePercentage = (Math.abs(targetProfit) / Math.abs(position.profit)) * 100;
    const baseResult = this.calculatePartialClose(position, closePercentage);
    
    return {
      ...baseResult,
      closePercentage: Math.round(closePercentage * 100) / 100
    };
  }

  /**
   * Validate partial close parameters
   */
  static validatePartialCloseParams(position: Position, closeVolume: number): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (closeVolume <= 0) {
      errors.push('Close volume must be greater than 0');
    }

    if (closeVolume > position.volume) {
      errors.push(`Close volume (${closeVolume}) cannot exceed position volume (${position.volume})`);
    }

    // Broker-specific minimums (common values)
    const minLotSize = 0.01;
    if (closeVolume < minLotSize) {
      errors.push(`Close volume (${closeVolume}) is below minimum lot size (${minLotSize})`);
    }

    const remainingVolume = position.volume - closeVolume;
    if (remainingVolume > 0 && remainingVolume < minLotSize) {
      errors.push(`Remaining volume (${remainingVolume}) would be below minimum lot size (${minLotSize})`);
    }

    // Warnings for small partial closes
    const closePercentage = (closeVolume / position.volume) * 100;
    if (closePercentage < 10) {
      warnings.push(`Closing only ${closePercentage.toFixed(1)}% of position may not be cost-effective`);
    }

    if (remainingVolume > 0 && remainingVolume / position.volume < 0.1) {
      warnings.push(`Remaining volume would be less than 10% of original position`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create partial close command
   */
  static createPartialCloseCommand(
    position: Position,
    accountId: string,
    closeVolume: number,
    closeType: 'market' | 'limit' = 'market',
    targetPrice?: number
  ): ClosePositionCommand {
    const validation = this.validatePartialCloseParams(position, closeVolume);
    if (!validation.valid) {
      throw new Error(`Invalid partial close parameters: ${validation.errors.join(', ')}`);
    }

    const command: ClosePositionCommand = {
      positionId: position.ticket.toString(),
      accountId,
      closeType,
      quantity: closeVolume,
      lots: closeVolume // For compatibility with ClosePositionParams
    };

    if (closeType === 'limit' && targetPrice) {
      command.price = targetPrice;
    }

    return command;
  }

  /**
   * Create sequential partial close commands (for gradual closing)
   */
  static createSequentialPartialCloseCommands(
    position: Position,
    accountId: string,
    steps: number,
    closeType: 'market' | 'limit' = 'market',
    priceRange?: { start: number; end: number }
  ): ClosePositionCommand[] {
    if (steps <= 0) {
      throw new Error('Steps must be greater than 0');
    }

    const volumePerStep = position.volume / steps;
    const commands: ClosePositionCommand[] = [];

    for (let i = 0; i < steps; i++) {
      let closeVolume = volumePerStep;
      
      // Last step closes remaining volume to avoid rounding issues
      if (i === steps - 1) {
        const totalClosed = volumePerStep * i;
        closeVolume = position.volume - totalClosed;
      }

      let targetPrice: number | undefined;
      if (closeType === 'limit' && priceRange) {
        // Calculate price for this step
        const priceStep = (priceRange.end - priceRange.start) / (steps - 1);
        targetPrice = priceRange.start + (priceStep * i);
      }

      const command = this.createPartialCloseCommand(
        position,
        accountId,
        closeVolume,
        closeType,
        targetPrice
      );

      commands.push(command);
    }

    return commands;
  }
}

/**
 * Helper function for percentage-based partial close
 */
export function createPartialCloseByPercentage(
  position: Position,
  accountId: string,
  percentage: number,
  closeType: 'market' | 'limit' = 'market',
  targetPrice?: number
): ClosePositionCommand {
  const calculation = PartialCloseCalculator.calculatePartialClose(position, percentage);
  return PartialCloseCalculator.createPartialCloseCommand(
    position,
    accountId,
    calculation.closeVolume,
    closeType,
    targetPrice
  );
}

/**
 * Helper function for volume-based partial close
 */
export function createPartialCloseByVolume(
  position: Position,
  accountId: string,
  volume: number,
  closeType: 'market' | 'limit' = 'market',
  targetPrice?: number
): ClosePositionCommand {
  return PartialCloseCalculator.createPartialCloseCommand(
    position,
    accountId,
    volume,
    closeType,
    targetPrice
  );
}

