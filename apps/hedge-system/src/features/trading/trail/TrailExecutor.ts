import { EventEmitter } from 'events';
import { WebSocketClient } from '../../../lib/websocket/websocket-client';
import { EAConnectionManager } from '../../ea-management/ea-connection-manager';
import { TrailSettings } from './types';
import { Position } from '../../ea-management/types';
import { WebSocketMessage, CommandMessage, COMMAND_ACTIONS, TrailResultMessage, isTrailResultMessage } from '../../../lib/websocket/message-types';
import { 
  getTrailNotificationManager, 
  TrailNotificationManager, 
  createTrailNotificationData 
} from '../../trail/notifications';

export interface TrailCommand {
  id: string;
  accountId: string;
  positionId: string;
  ticket: number;
  newStopLoss: number;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

export interface TrailExecutionResult {
  success: boolean;
  commandId: string;
  positionId: string;
  ticket: number;
  oldStopLoss: number;
  newStopLoss: number;
  executedAt: Date;
  error?: string;
  details?: any;
}

export interface TrailExecutionState {
  positionId: string;
  isExecuting: boolean;
  lastExecuted?: Date;
  lastStopLoss: number;
  highWaterMark: number;
  executionCount: number;
  errorCount: number;
  lastError?: string;
}

export interface TrailExecutorConfig {
  maxConcurrentExecutions: number;
  commandTimeout: number;
  retryCount: number;
  retryDelay: number;
  executionInterval: number;
  enablePriorityQueue: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableNotifications: boolean;
}

export interface TrailCalculationResult {
  shouldUpdate: boolean;
  newStopLoss: number;
  reason: string;
  profitChange: number;
  distanceFromCurrent: number;
}

export type TrailExecutorEvent = 
  | 'trail_executed'
  | 'trail_failed'
  | 'trail_calculated'
  | 'execution_started'
  | 'execution_completed'
  | 'max_concurrent_reached'
  | 'error';

const DEFAULT_CONFIG: TrailExecutorConfig = {
  maxConcurrentExecutions: 10,
  commandTimeout: 10000,
  retryCount: 3,
  retryDelay: 2000,
  executionInterval: 1000,
  enablePriorityQueue: true,
  logLevel: 'info',
  enableNotifications: true
};

export class TrailExecutor extends EventEmitter {
  private wsClient: WebSocketClient;
  private eaManager: EAConnectionManager;
  private config: TrailExecutorConfig;
  private executionStates: Map<string, TrailExecutionState> = new Map();
  private pendingCommands: Map<string, TrailCommand> = new Map();
  private executionQueue: TrailCommand[] = [];
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  private notificationManager: TrailNotificationManager;

  constructor(
    wsClient: WebSocketClient,
    eaManager: EAConnectionManager,
    config?: Partial<TrailExecutorConfig>
  ) {
    super();
    this.wsClient = wsClient;
    this.eaManager = eaManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.notificationManager = getTrailNotificationManager();
    
    this.setupEventHandlers();
    this.startProcessing();
    
    this.log('info', 'TrailExecutor initialized', {
      maxConcurrentExecutions: this.config.maxConcurrentExecutions,
      commandTimeout: this.config.commandTimeout,
      retryCount: this.config.retryCount,
      enableNotifications: this.config.enableNotifications
    });
  }

  /**
   * Execute trail update for a position
   */
  async executeTrail(
    position: Position,
    trailSettings: TrailSettings,
    currentPrice: number
  ): Promise<TrailExecutionResult> {
    const positionId = position.ticket.toString();
    
    try {
      this.log('debug', 'Starting trail execution', {
        positionId,
        currentStopLoss: position.sl,
        currentPrice,
        trailType: trailSettings.type
      });

      // Check if already executing for this position
      const state = this.executionStates.get(positionId);
      if (state?.isExecuting) {
        throw new Error(`Trail execution already in progress for position ${positionId}`);
      }

      // Calculate new stop loss
      const calculation = this.calculateTrailStopLoss(position, trailSettings, currentPrice);
      
      // Notify trail started (first time only)
      if (this.config.enableNotifications && !state?.lastExecuted) {
        await this.sendTrailStartedNotification(position, trailSettings, currentPrice);
      }
      
      if (!calculation.shouldUpdate) {
        this.log('debug', 'No trail update needed', {
          positionId,
          reason: calculation.reason,
          currentStopLoss: position.sl,
          calculatedStopLoss: calculation.newStopLoss
        });
        
        return {
          success: true,
          commandId: '',
          positionId,
          ticket: position.ticket,
          oldStopLoss: position.sl,
          newStopLoss: position.sl,
          executedAt: new Date()
        };
      }

      // Update execution state
      this.updateExecutionState(positionId, {
        positionId,
        isExecuting: true,
        lastStopLoss: position.sl,
        highWaterMark: Math.max(state?.highWaterMark || 0, currentPrice),
        executionCount: (state?.executionCount || 0) + 1,
        errorCount: state?.errorCount || 0
      });

      // Create trail command
      const command = this.createTrailCommand(position, calculation.newStopLoss);
      
      // Execute the command
      const result = await this.executeTrailCommand(command, position);
      
      // Update execution state
      this.updateExecutionState(positionId, {
        ...this.executionStates.get(positionId)!,
        isExecuting: false,
        lastExecuted: new Date(),
        lastStopLoss: calculation.newStopLoss
      });

      // Notify trail executed successfully
      if (this.config.enableNotifications) {
        await this.sendTrailUpdatedNotification(position, result.oldStopLoss, result.newStopLoss, currentPrice);
      }

      this.emit('trail_executed', result);
      return result;

    } catch (error) {
      // Update error state
      const currentState = this.executionStates.get(positionId);
      this.updateExecutionState(positionId, {
        ...currentState!,
        isExecuting: false,
        errorCount: (currentState?.errorCount || 0) + 1,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'Trail execution failed', {
        positionId,
        error: errorMessage,
        position: position.ticket
      });

      // Notify trail error
      if (this.config.enableNotifications) {
        await this.sendTrailErrorNotification(position, errorMessage, currentPrice);
      }

      const failedResult: TrailExecutionResult = {
        success: false,
        commandId: '',
        positionId,
        ticket: position.ticket,
        oldStopLoss: position.sl,
        newStopLoss: position.sl,
        executedAt: new Date(),
        error: errorMessage
      };

      this.emit('trail_failed', failedResult, error);
      return failedResult;
    }
  }

  /**
   * Calculate new stop loss based on trail settings
   */
  private calculateTrailStopLoss(
    position: Position,
    trailSettings: TrailSettings,
    currentPrice: number
  ): TrailCalculationResult {
    const isLong = position.type === 'buy';
    const currentStopLoss = position.sl;
    const openPrice = position.openPrice;
    const profit = position.profit;

    // Check if trail should start
    if (!this.shouldStartTrail(trailSettings, currentPrice, openPrice, profit, isLong)) {
      return {
        shouldUpdate: false,
        newStopLoss: currentStopLoss,
        reason: 'Trail start condition not met',
        profitChange: 0,
        distanceFromCurrent: 0
      };
    }

    let newStopLoss: number;
    
    switch (trailSettings.type) {
      case 'fixed':
        newStopLoss = this.calculateFixedTrail(currentPrice, trailSettings.trailAmount, isLong);
        break;
      
      case 'percentage':
        newStopLoss = this.calculatePercentageTrail(currentPrice, trailSettings.trailAmount, isLong);
        break;
      
      case 'atr':
        // For ATR trail, use the trail amount as ATR multiplier
        newStopLoss = this.calculateATRTrail(currentPrice, trailSettings.trailAmount, isLong);
        break;
      
      default:
        throw new Error(`Unsupported trail type: ${trailSettings.type}`);
    }

    // Validate new stop loss
    const shouldUpdate = this.validateStopLossUpdate(
      currentStopLoss,
      newStopLoss,
      currentPrice,
      isLong
    );

    if (!shouldUpdate) {
      return {
        shouldUpdate: false,
        newStopLoss: currentStopLoss,
        reason: 'New stop loss validation failed',
        profitChange: 0,
        distanceFromCurrent: Math.abs(currentPrice - newStopLoss)
      };
    }

    const profitChange = this.calculateProfitChange(
      currentStopLoss,
      newStopLoss,
      position.volume,
      isLong
    );

    this.emit('trail_calculated', {
      positionId: position.ticket.toString(),
      trailType: trailSettings.type,
      oldStopLoss: currentStopLoss,
      newStopLoss,
      currentPrice,
      profitChange
    });

    return {
      shouldUpdate: true,
      newStopLoss,
      reason: `${trailSettings.type} trail calculation`,
      profitChange,
      distanceFromCurrent: Math.abs(currentPrice - newStopLoss)
    };
  }

  /**
   * Check if trail should start based on start conditions
   */
  private shouldStartTrail(
    trailSettings: TrailSettings,
    currentPrice: number,
    openPrice: number,
    currentProfit: number,
    isLong: boolean
  ): boolean {
    switch (trailSettings.startCondition.type) {
      case 'immediate':
        return true;
      
      case 'profit_threshold':
        const profitThreshold = trailSettings.startCondition.value || 0;
        return currentProfit >= profitThreshold;
      
      case 'price_level':
        const priceLevel = trailSettings.startCondition.value || 0;
        if (isLong) {
          return currentPrice >= priceLevel;
        } else {
          return currentPrice <= priceLevel;
        }
      
      default:
        return false;
    }
  }

  /**
   * Calculate fixed trail stop loss
   */
  private calculateFixedTrail(currentPrice: number, trailAmount: number, isLong: boolean): number {
    if (isLong) {
      return currentPrice - trailAmount;
    } else {
      return currentPrice + trailAmount;
    }
  }

  /**
   * Calculate percentage trail stop loss
   */
  private calculatePercentageTrail(currentPrice: number, trailPercentage: number, isLong: boolean): number {
    const trailAmount = currentPrice * (trailPercentage / 100);
    if (isLong) {
      return currentPrice - trailAmount;
    } else {
      return currentPrice + trailAmount;
    }
  }

  /**
   * Calculate ATR-based trail stop loss
   */
  private calculateATRTrail(currentPrice: number, atrMultiplier: number, isLong: boolean): number {
    // For now, use a fixed ATR value. In a real implementation,
    // this would calculate actual ATR from recent price data
    const estimatedATR = currentPrice * 0.01; // 1% as estimated ATR
    const trailAmount = estimatedATR * atrMultiplier;
    
    if (isLong) {
      return currentPrice - trailAmount;
    } else {
      return currentPrice + trailAmount;
    }
  }

  /**
   * Validate if stop loss update is beneficial
   */
  private validateStopLossUpdate(
    currentStopLoss: number,
    newStopLoss: number,
    currentPrice: number,
    isLong: boolean
  ): boolean {
    // No stop loss set yet
    if (currentStopLoss === 0) {
      return true;
    }

    // For long positions, new stop loss should be higher
    // For short positions, new stop loss should be lower
    if (isLong) {
      return newStopLoss > currentStopLoss && newStopLoss < currentPrice;
    } else {
      return newStopLoss < currentStopLoss && newStopLoss > currentPrice;
    }
  }

  /**
   * Calculate profit change from stop loss update
   */
  private calculateProfitChange(
    oldStopLoss: number,
    newStopLoss: number,
    volume: number,
    isLong: boolean
  ): number {
    const stopLossChange = newStopLoss - oldStopLoss;
    const profitChange = isLong ? stopLossChange * volume : -stopLossChange * volume;
    return profitChange;
  }

  /**
   * Create trail command
   */
  private createTrailCommand(position: Position, newStopLoss: number): TrailCommand {
    return {
      id: this.generateCommandId(),
      accountId: position.accountId || '',
      positionId: position.ticket.toString(),
      ticket: position.ticket,
      newStopLoss,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.config.retryCount
    };
  }

  /**
   * Execute trail command via WebSocket
   */
  private async executeTrailCommand(command: TrailCommand, position?: Position): Promise<TrailExecutionResult> {
    this.log('info', 'Executing trail command', {
      commandId: command.id,
      positionId: command.positionId,
      ticket: command.ticket,
      newStopLoss: command.newStopLoss
    });

    // Check WebSocket connection
    if (this.wsClient.getConnectionState() !== 'connected') {
      throw new Error('WebSocket not connected');
    }

    // Check EA connection
    const connection = this.eaManager.getConnection(command.accountId);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`EA not connected for account ${command.accountId}`);
    }

    // Create WebSocket command message for trail update
    const wsMessage: CommandMessage = {
      type: 'command',
      payload: {
        commandId: command.id,
        action: COMMAND_ACTIONS.SET_TRAIL_STOP,
        params: {
          positionId: command.positionId,
          trailAmount: Math.abs(command.newStopLoss - (position?.currentPrice || 0)),
          startPrice: command.newStopLoss
        },
        targetClientId: command.accountId
      },
      timestamp: Date.now()
    };

    // Add to pending commands
    this.pendingCommands.set(command.id, command);

    try {
      // Send command
      this.wsClient.send(wsMessage);
      
      // Wait for response
      const result = await this.waitForCommandResponse(command);
      
      // Remove from pending
      this.pendingCommands.delete(command.id);
      
      this.log('info', 'Trail command executed successfully', {
        commandId: command.id,
        positionId: command.positionId,
        newStopLoss: command.newStopLoss
      });

      return result;

    } catch (error) {
      // Remove from pending
      this.pendingCommands.delete(command.id);
      
      // Handle retry if configured
      if (command.retryCount < command.maxRetries) {
        command.retryCount++;
        this.log('warn', 'Retrying trail command', {
          commandId: command.id,
          retryCount: command.retryCount,
          maxRetries: command.maxRetries
        });
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        
        return this.executeTrailCommand(command);
      }
      
      throw error;
    }
  }

  /**
   * Wait for command response with timeout
   */
  private async waitForCommandResponse(command: TrailCommand): Promise<TrailExecutionResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout after ${this.config.commandTimeout}ms`));
      }, this.config.commandTimeout);

      // Listen for command response
      const handleResponse = (event: string, message: WebSocketMessage) => {
        // Handle trail result specifically
        if (isTrailResultMessage(message) && message.payload.commandId === command.id) {
          clearTimeout(timeout);
          this.wsClient.off('message_received', handleResponse);
          
          const payload = message.payload;
          if (payload.success) {
            resolve({
              success: true,
              commandId: command.id,
              positionId: command.positionId,
              ticket: command.ticket,
              oldStopLoss: payload.oldStopLoss || 0,
              newStopLoss: payload.newStopLoss || command.newStopLoss,
              executedAt: new Date(payload.executedTime || Date.now()),
              details: payload
            });
          } else {
            reject(new Error(payload.error || 'Trail command failed'));
          }
        }
        // Handle generic ack message
        else if (message.type === 'ack') {
          const payload = message.payload as any;
          if (payload?.messageId === command.id) {
            clearTimeout(timeout);
            this.wsClient.off('message_received', handleResponse);
            
            if (payload.success) {
              resolve({
                success: true,
                commandId: command.id,
                positionId: command.positionId,
                ticket: command.ticket,
                oldStopLoss: 0,
                newStopLoss: command.newStopLoss,
                executedAt: new Date(),
                details: payload
              });
            } else {
              reject(new Error(payload.error || 'Command failed'));
            }
          }
        }
      };

      this.wsClient.on('message_received', handleResponse);
    });
  }

  /**
   * Get execution state for a position
   */
  getExecutionState(positionId: string): TrailExecutionState | undefined {
    return this.executionStates.get(positionId);
  }

  /**
   * Get all execution states
   */
  getAllExecutionStates(): Map<string, TrailExecutionState> {
    return new Map(this.executionStates);
  }

  /**
   * Clear execution state for a position
   */
  clearExecutionState(positionId: string): void {
    this.executionStates.delete(positionId);
  }

  /**
   * Get pending commands count
   */
  getPendingCommandsCount(): number {
    return this.pendingCommands.size;
  }

  /**
   * Check if executor is at max capacity
   */
  isAtMaxCapacity(): boolean {
    return this.pendingCommands.size >= this.config.maxConcurrentExecutions;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TrailExecutorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('info', 'Configuration updated', newConfig);
  }

  /**
   * Stop the executor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.isProcessing = false;
    this.log('info', 'TrailExecutor stopped');
  }

  private updateExecutionState(positionId: string, state: TrailExecutionState): void {
    this.executionStates.set(positionId, state);
  }

  private generateCommandId(): string {
    return `trail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventHandlers(): void {
    // Handle WebSocket messages
    this.wsClient.on('message_received', (event, message: WebSocketMessage) => {
      if (message.type === 'ack' || message.type === 'trail_result') {
        this.handleCommandResponse(message);
      }
    });

    // Handle EA connection events
    this.eaManager.on('connectionTimeout', async (connection) => {
      this.log('warn', 'EA connection timeout detected', {
        accountId: connection.accountId
      });
      
      // Send connection lost notification
      if (this.config.enableNotifications) {
        await this.sendConnectionLostNotification(connection.accountId);
      }
    });
  }

  private handleCommandResponse(message: WebSocketMessage): void {
    const payload = message.payload as any;
    const commandId = payload?.commandId;
    
    if (commandId && this.pendingCommands.has(commandId)) {
      // Command response will be handled by waitForCommandResponse
      this.log('debug', 'Received trail command response', {
        commandId,
        messageType: message.type,
        success: payload?.success,
        error: payload?.error
      });
    }
  }

  private startProcessing(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.config.executionInterval);
    
    this.isProcessing = true;
    this.log('debug', 'Started execution queue processing');
  }

  private processQueue(): void {
    if (this.executionQueue.length === 0) {
      return;
    }

    if (this.isAtMaxCapacity()) {
      this.emit('max_concurrent_reached', {
        pendingCount: this.pendingCommands.size,
        queueLength: this.executionQueue.length
      });
      return;
    }

    // Process next command in queue
    const command = this.executionQueue.shift();
    if (command) {
      this.executeTrailCommand(command).catch(error => {
        this.log('error', 'Queue command execution failed', {
          commandId: command.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    }
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [TrailExecutor] [${level.toUpperCase()}] ${message}`, data || '');
    }
  }

  /**
   * 通知メソッド群
   */
  private async sendTrailStartedNotification(
    position: Position, 
    trailSettings: TrailSettings, 
    currentPrice: number
  ): Promise<void> {
    try {
      const data = createTrailNotificationData(
        position.ticket.toString(),
        position.symbol,
        position.accountId || 'unknown',
        `trail_${position.ticket}_${Date.now()}`,
        {
          currentPrice,
          stopLossPrice: position.sl,
          profit: position.profit,
          trailType: trailSettings.type,
          trailAmount: trailSettings.trailAmount
        }
      );
      
      await this.notificationManager.notifyTrailStarted(data);
    } catch (error) {
      this.log('warn', 'Failed to send trail started notification', { error });
    }
  }

  private async sendTrailUpdatedNotification(
    position: Position,
    oldStopLoss: number,
    newStopLoss: number,
    currentPrice: number
  ): Promise<void> {
    try {
      const data = createTrailNotificationData(
        position.ticket.toString(),
        position.symbol,
        position.accountId || 'unknown',
        `trail_${position.ticket}_${Date.now()}`,
        {
          oldValue: oldStopLoss,
          newValue: newStopLoss,
          currentPrice,
          stopLossPrice: newStopLoss,
          profit: position.profit
        }
      );
      
      await this.notificationManager.notifyTrailUpdated(data);
    } catch (error) {
      this.log('warn', 'Failed to send trail updated notification', { error });
    }
  }

  private async sendTrailErrorNotification(
    position: Position,
    errorMessage: string,
    currentPrice: number
  ): Promise<void> {
    try {
      const data = createTrailNotificationData(
        position.ticket.toString(),
        position.symbol,
        position.accountId || 'unknown',
        `trail_${position.ticket}_${Date.now()}`,
        {
          currentPrice,
          stopLossPrice: position.sl,
          profit: position.profit,
          error: errorMessage
        }
      );
      
      await this.notificationManager.notifyTrailError(data, errorMessage);
    } catch (error) {
      this.log('warn', 'Failed to send trail error notification', { error });
    }
  }

  private async sendConnectionLostNotification(accountId: string): Promise<void> {
    try {
      const data = createTrailNotificationData(
        'system',
        'SYSTEM',
        accountId,
        `connection_lost_${Date.now()}`,
        { error: 'EA connection lost' }
      );
      
      await this.notificationManager.notifyConnectionLost(data);
    } catch (error) {
      this.log('warn', 'Failed to send connection lost notification', { error });
    }
  }

  /**
   * 通知マネージャーへのアクセス
   */
  public getNotificationManager(): TrailNotificationManager {
    return this.notificationManager;
  }

  /**
   * 通知設定の更新
   */
  public enableNotifications(enabled: boolean): void {
    this.config.enableNotifications = enabled;
    this.log('info', `Trail notifications ${enabled ? 'enabled' : 'disabled'}`);
  }
}

/**
 * Create and initialize a TrailExecutor instance
 */
export function createTrailExecutor(
  wsClient: WebSocketClient,
  eaManager: EAConnectionManager,
  config?: Partial<TrailExecutorConfig>
): TrailExecutor {
  return new TrailExecutor(wsClient, eaManager, config);
}

/**
 * Trail execution helper function
 */
export async function executePositionTrail(
  executor: TrailExecutor,
  position: Position,
  trailSettings: TrailSettings,
  currentPrice: number
): Promise<TrailExecutionResult> {
  return executor.executeTrail(position, trailSettings, currentPrice);
}