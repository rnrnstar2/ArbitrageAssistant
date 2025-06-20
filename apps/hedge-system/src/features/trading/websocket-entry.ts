import { WebSocketClient } from "../../../lib/websocket/websocket-client";
import { 
  EntryCommand, 
  CommandMessage, 
  COMMAND_ACTIONS, 
  WebSocketMessage,
  EntryResultMessage,
  isEntryResultMessage
} from "../../../lib/websocket/message-types";
import { DataSyncManager } from "../ea-management/data-sync/data-sync-manager";
import { Position } from "../ea-management/types";

export type EntryCommandStatus = 'idle' | 'sending' | 'success' | 'error';

export type EntryErrorType = 
  | 'connection_error'
  | 'validation_error' 
  | 'execution_error'
  | 'timeout_error'
  | 'sync_error'
  | 'unknown_error';

export interface EntryError {
  type: EntryErrorType;
  code?: string;
  message: string;
  userMessage: string;
  details?: any;
  timestamp: Date;
}

export interface TimeoutConfig {
  commandTimeout: number; // エントリーコマンドのタイムアウト (ms)
  connectionTimeout: number; // 接続確認のタイムアウト (ms)
  syncTimeout: number; // データ同期のタイムアウト (ms)
  retryCount: number; // タイムアウト時のリトライ回数
  retryDelay: number; // リトライ間隔 (ms)
}

export interface EntryServiceConfig {
  timeout: TimeoutConfig;
  enableRetry: boolean;
  enableSyncWarning: boolean;
}

export interface EntryCommandResult {
  success: boolean;
  commandId?: string;
  error?: string;
  entryError?: EntryError;
  details?: any;
  positionId?: string;
  executedPrice?: number;
  executedTime?: string;
  accountId?: string;
  symbol?: string;
  direction?: 'BUY' | 'SELL';
  lotSize?: number;
}

export interface EntryCommandState {
  status: EntryCommandStatus;
  error?: string;
  entryError?: EntryError;
  commandId?: string;
  positionId?: string;
  executedPrice?: number;
  executedTime?: string;
  accountId?: string;
  symbol?: string;
  direction?: 'BUY' | 'SELL';
  lotSize?: number;
}

const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  commandTimeout: 10000, // 10秒
  connectionTimeout: 5000, // 5秒
  syncTimeout: 15000, // 15秒
  retryCount: 2,
  retryDelay: 2000 // 2秒
};

const DEFAULT_SERVICE_CONFIG: EntryServiceConfig = {
  timeout: DEFAULT_TIMEOUT_CONFIG,
  enableRetry: true,
  enableSyncWarning: true
};

export class WebSocketEntryService {
  private wsClient: WebSocketClient;
  private dataSyncManager?: DataSyncManager;
  private commandStates: Map<string, EntryCommandState> = new Map();
  private config: EntryServiceConfig;

  constructor(
    wsClient: WebSocketClient, 
    dataSyncManager?: DataSyncManager,
    config?: Partial<EntryServiceConfig>
  ) {
    this.wsClient = wsClient;
    this.dataSyncManager = dataSyncManager;
    this.config = { 
      ...DEFAULT_SERVICE_CONFIG, 
      ...config,
      timeout: { ...DEFAULT_TIMEOUT_CONFIG, ...config?.timeout }
    };
    this.setupMessageHandlers();
  }

  /**
   * Send entry command to EA
   */
  async sendEntryCommand(entryCommand: EntryCommand): Promise<EntryCommandResult> {
    const commandId = this.generateCommandId();
    
    try {
      // Update state to sending
      this.updateCommandState(commandId, { status: 'sending' });

      // Create command message
      const commandMessage: CommandMessage = {
        type: "command",
        payload: {
          commandId,
          action: COMMAND_ACTIONS.ENTRY,
          params: entryCommand,
          targetClientId: entryCommand.accountId,
        },
        timestamp: Date.now(),
      };

      // Check WebSocket connection
      if (this.wsClient.getConnectionState() !== 'connected') {
        const entryError = this.createEntryError(
          'connection_error',
          'WebSocket is not connected',
          undefined,
          'WS_NOT_CONNECTED'
        );
        throw entryError;
      }

      // Send command
      this.wsClient.send(commandMessage);

      // Wait for response with timeout
      const result = await this.waitForCommandResponse(commandId, this.config.timeout.commandTimeout);
      
      if (result.success) {
        this.updateCommandState(commandId, { status: 'success', commandId });
      } else {
        this.updateCommandState(commandId, { 
          status: 'error', 
          error: result.error,
          commandId 
        });
      }

      return result;

    } catch (error) {
      let entryError: EntryError;
      let errorMessage: string;

      if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
        // It's already an EntryError
        entryError = error as EntryError;
        errorMessage = entryError.message;
      } else {
        // Convert to EntryError
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        entryError = this.createEntryError('unknown_error', errorMessage);
      }

      this.updateCommandState(commandId, { 
        status: 'error', 
        error: errorMessage,
        entryError,
        commandId 
      });

      return {
        success: false,
        commandId,
        error: errorMessage,
        entryError,
      };
    }
  }

  /**
   * Get command state by ID
   */
  getCommandState(commandId: string): EntryCommandState | undefined {
    return this.commandStates.get(commandId);
  }

  /**
   * Get all command states
   */
  getAllCommandStates(): Map<string, EntryCommandState> {
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

  private generateCommandId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateCommandState(commandId: string, state: EntryCommandState): void {
    this.commandStates.set(commandId, state);
  }

  private createEntryError(
    type: EntryErrorType, 
    message: string, 
    userMessage?: string,
    code?: string,
    details?: any
  ): EntryError {
    return {
      type,
      code,
      message,
      userMessage: userMessage || this.getDefaultUserMessage(type, message),
      details,
      timestamp: new Date()
    };
  }

  private getDefaultUserMessage(type: EntryErrorType, message: string): string {
    switch (type) {
      case 'connection_error':
        return 'サーバーとの接続に問題があります。しばらくしてから再試行してください。';
      case 'validation_error':
        return '入力内容に問題があります。入力値を確認してください。';
      case 'execution_error':
        return 'エントリーの実行に失敗しました。取引条件を確認してください。';
      case 'timeout_error':
        return 'エントリーがタイムアウトしました。サーバーの応答時間を確認してください。';
      case 'sync_error':
        return 'データの同期に失敗しました。取引は実行されましたが、表示に遅延が生じる可能性があります。';
      case 'unknown_error':
      default:
        return '予期しないエラーが発生しました。サポートにお問い合わせください。';
    }
  }

  private setupMessageHandlers(): void {
    this.wsClient.on('message_received', (event, message: WebSocketMessage) => {
      if (message.type === 'ack') {
        this.handleAckMessage(message);
      } else if (message.type === 'entry_result') {
        this.handleEntryResultMessage(message);
      } else if (message.type === 'error') {
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
          this.updateCommandState(messageId, { 
            status: 'success', 
            commandId: messageId 
          });
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

  private handleEntryResultMessage(message: WebSocketMessage): void {
    if (isEntryResultMessage(message)) {
      const { 
        commandId, 
        success, 
        error, 
        positionId, 
        executedPrice, 
        executedTime,
        accountId,
        symbol,
        direction,
        lotSize
      } = message.payload;
      
      if (commandId && this.commandStates.has(commandId)) {
        if (success) {
          this.updateCommandState(commandId, {
            status: 'success',
            commandId,
            positionId,
            executedPrice,
            executedTime,
            accountId,
            symbol,
            direction,
            lotSize
          });

          // Sync new position to backend if DataSyncManager is available
          if (this.dataSyncManager && positionId && executedPrice && symbol && direction && lotSize) {
            this.syncNewPosition({
              commandId,
              positionId,
              executedPrice,
              executedTime,
              accountId,
              symbol,
              direction,
              lotSize
            }).catch(syncError => {
              console.error('Failed to sync new position:', syncError);
              const entryError = this.createEntryError(
                'sync_error',
                syncError instanceof Error ? syncError.message : 'Position sync failed',
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
                accountId,
                symbol,
                direction,
                lotSize,
                entryError // Add warning about sync failure
              });
            });
          }
        } else {
          const entryError = this.createEntryError(
            'execution_error',
            error || 'Entry command failed',
            undefined,
            'ENTRY_FAILED',
            { originalError: error, commandId }
          );
          
          this.updateCommandState(commandId, {
            status: 'error',
            error: error || 'Entry command failed',
            entryError,
            commandId
          });
        }
      }
    }
  }

  private handleErrorMessage(message: WebSocketMessage): void {
    if (message.payload && typeof message.payload === 'object') {
      const payload = message.payload as any;
      console.error('WebSocket error received:', payload);
      
      // Update all pending commands to error state
      for (const [commandId, state] of this.commandStates.entries()) {
        if (state.status === 'sending') {
          this.updateCommandState(commandId, {
            status: 'error',
            error: payload.message || 'WebSocket error',
            commandId
          });
        }
      }
    }
  }

  private async syncNewPosition(entryResult: {
    commandId: string;
    positionId: string;
    executedPrice: number;
    executedTime?: string;
    accountId: string;
    symbol: string;
    direction: 'BUY' | 'SELL';
    lotSize: number;
  }): Promise<void> {
    if (!this.dataSyncManager) {
      throw new Error('DataSyncManager not available for position sync');
    }

    // Convert entry result to Position format
    const position: Position = {
      ticket: parseInt(entryResult.positionId),
      symbol: entryResult.symbol,
      type: entryResult.direction.toLowerCase() as 'buy' | 'sell',
      volume: entryResult.lotSize,
      openPrice: entryResult.executedPrice,
      currentPrice: entryResult.executedPrice, // Initially same as open price
      profit: 0, // Initially no profit
      swap: 0, // Initially no swap
      sl: 0, // No stop loss initially
      tp: 0, // No take profit initially
      openTime: entryResult.executedTime ? new Date(entryResult.executedTime) : new Date(),
      comment: `Entry via WebSocket: ${entryResult.commandId}`
    };

    // Use DataSyncManager to create the position
    const changeset = {
      accountId: entryResult.accountId,
      positions: {
        added: [position],
        updated: [],
        removed: []
      },
      account: {
        updated: {}
      },
      connection: {
        updated: {}
      },
      timestamp: new Date()
    };

    await this.dataSyncManager.syncChangeset(changeset);
  }

  private waitForCommandResponse(commandId: string, timeoutMs: number): Promise<EntryCommandResult> {
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
            accountId: state.accountId,
            symbol: state.symbol,
            direction: state.direction,
            lotSize: state.lotSize
          });
          return;
        }

        if (state.status === 'error') {
          resolve({
            success: false,
            commandId,
            error: state.error || 'Command failed'
          });
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          const entryError = this.createEntryError(
            'timeout_error',
            `Command timeout after ${timeoutMs}ms`,
            undefined,
            'COMMAND_TIMEOUT',
            { timeoutMs, commandId }
          );
          
          this.updateCommandState(commandId, {
            status: 'error',
            error: 'Command timeout',
            entryError,
            commandId
          });
          
          resolve({
            success: false,
            commandId,
            error: 'Command timeout',
            entryError
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
  getTimeoutConfig(): TimeoutConfig {
    return { ...this.config.timeout };
  }

  /**
   * Update timeout configuration
   */
  updateTimeoutConfig(config: Partial<TimeoutConfig>): void {
    this.config.timeout = { ...this.config.timeout, ...config };
  }

  /**
   * Handle command timeout with retry logic
   */
  private async handleCommandTimeout(
    commandId: string, 
    entryCommand: EntryCommand, 
    attempt: number = 1
  ): Promise<EntryCommandResult> {
    const maxRetries = this.config.timeout.retryCount;
    
    if (attempt <= maxRetries && this.config.enableRetry) {
      console.log(`Retrying command ${commandId}, attempt ${attempt}/${maxRetries}`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.config.timeout.retryDelay));
      
      // Clear previous command state
      this.commandStates.delete(commandId);
      
      // Retry the command
      try {
        return await this.sendEntryCommand(entryCommand);
      } catch (error) {
        if (attempt === maxRetries) {
          // Final attempt failed
          const entryError = this.createEntryError(
            'timeout_error',
            `Command failed after ${maxRetries} retries`,
            'エントリーコマンドが複数回の再試行後も失敗しました。',
            'MAX_RETRIES_EXCEEDED',
            { attempt, maxRetries, originalError: error }
          );
          
          return {
            success: false,
            commandId,
            error: entryError.message,
            entryError
          };
        }
        
        // Continue retrying
        return this.handleCommandTimeout(commandId, entryCommand, attempt + 1);
      }
    }
    
    // No retry or max retries exceeded
    const entryError = this.createEntryError(
      'timeout_error',
      'Command timeout - no retry attempted',
      undefined,
      'TIMEOUT_NO_RETRY',
      { attempt, maxRetries, retryEnabled: this.config.enableRetry }
    );
    
    return {
      success: false,
      commandId,
      error: entryError.message,
      entryError
    };
  }
}

/**
 * Helper function to create and send entry command
 */
export async function sendEntryCommand(
  wsClient: WebSocketClient,
  entryCommand: EntryCommand,
  dataSyncManager?: DataSyncManager,
  config?: Partial<EntryServiceConfig>
): Promise<EntryCommandResult> {
  const entryService = new WebSocketEntryService(wsClient, dataSyncManager, config);
  return entryService.sendEntryCommand(entryCommand);
}

/**
 * Validate entry command before sending
 */
export function validateEntryCommand(command: EntryCommand): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!command.symbol || command.symbol.trim() === '') {
    errors.push('Symbol is required');
  }

  if (!command.direction || !['BUY', 'SELL'].includes(command.direction)) {
    errors.push('Direction must be BUY or SELL');
  }

  if (!command.lotSize || command.lotSize <= 0) {
    errors.push('Lot size must be greater than 0');
  }

  if (!command.orderType || !['MARKET', 'LIMIT'].includes(command.orderType)) {
    errors.push('Order type must be MARKET or LIMIT');
  }

  if (!command.accountId || command.accountId.trim() === '') {
    errors.push('Account ID is required');
  }

  // LIMIT order specific validation
  if (command.orderType === 'LIMIT' && (command.price === undefined || command.price <= 0)) {
    errors.push('Price is required for LIMIT orders and must be greater than 0');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}