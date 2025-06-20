import { createComponentLogger } from "./logger";

const logger = createComponentLogger('error-handler');

export interface WebSocketError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  recoverable: boolean;
  retryCount?: number;
}

export interface ErrorRecoveryStrategy {
  name: string;
  condition: (error: WebSocketError) => boolean;
  execute: (error: WebSocketError) => Promise<boolean>;
  maxRetries: number;
}

/**
 * WebSocket error handling and recovery manager
 */
export class WebSocketErrorHandler {
  private errorHistory: WebSocketError[] = [];
  private recoveryStrategies: ErrorRecoveryStrategy[] = [];
  private maxErrorHistory = 100;

  constructor() {
    this.setupDefaultStrategies();
  }

  /**
   * Record an error
   */
  recordError(error: any, context?: any): WebSocketError {
    const wsError: WebSocketError = {
      code: this.extractErrorCode(error),
      message: this.extractErrorMessage(error),
      details: { originalError: error, context },
      timestamp: Date.now(),
      recoverable: this.isRecoverable(error),
      retryCount: 0
    };

    this.errorHistory.push(wsError);
    
    // Limit error history size
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }

    logger.error('WebSocket error recorded', error, {
      code: wsError.code,
      recoverable: wsError.recoverable,
      context
    });

    return wsError;
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(error: WebSocketError): Promise<boolean> {
    if (!error.recoverable) {
      logger.info('Error is not recoverable, skipping recovery', {
        code: error.code,
        message: error.message
      });
      return false;
    }

    for (const strategy of this.recoveryStrategies) {
      if (strategy.condition(error)) {
        logger.info(`Attempting recovery with strategy: ${strategy.name}`, {
          errorCode: error.code,
          retryCount: error.retryCount || 0,
          maxRetries: strategy.maxRetries
        });

        try {
          if ((error.retryCount || 0) < strategy.maxRetries) {
            const success = await strategy.execute(error);
            if (success) {
              logger.info(`Recovery successful with strategy: ${strategy.name}`);
              return true;
            }
          } else {
            logger.warning(`Max retries exceeded for strategy: ${strategy.name}`, {
              retryCount: error.retryCount,
              maxRetries: strategy.maxRetries
            });
          }
        } catch (recoveryError) {
          logger.error(`Recovery strategy failed: ${strategy.name}`, recoveryError);
        }
      }
    }

    logger.warning('All recovery strategies failed', {
      errorCode: error.code,
      strategiesAttempted: this.recoveryStrategies.length
    });
    return false;
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const now = Date.now();
    const last5Minutes = this.errorHistory.filter(e => now - e.timestamp < 5 * 60 * 1000);
    const last1Hour = this.errorHistory.filter(e => now - e.timestamp < 60 * 60 * 1000);

    const errorsByCode = this.errorHistory.reduce((acc, error) => {
      acc[error.code] = (acc[error.code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: this.errorHistory.length,
      errorsLast5Minutes: last5Minutes.length,
      errorsLastHour: last1Hour.length,
      errorsByCode,
      recoverableErrors: this.errorHistory.filter(e => e.recoverable).length,
      nonRecoverableErrors: this.errorHistory.filter(e => !e.recoverable).length,
    };
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    logger.info('Error history cleared');
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    logger.info(`Added recovery strategy: ${strategy.name}`);
  }

  private setupDefaultStrategies(): void {
    // Connection lost recovery
    this.addRecoveryStrategy({
      name: 'Connection Lost Recovery',
      condition: (error) => ['CONNECTION_LOST', 'WEBSOCKET_CLOSED'].includes(error.code),
      execute: async (error) => {
        // Wait before attempting reconnection
        await this.delay(Math.min(1000 * Math.pow(2, error.retryCount || 0), 30000));
        error.retryCount = (error.retryCount || 0) + 1;
        return true; // Let the main reconnection logic handle this
      },
      maxRetries: 5
    });

    // Authentication failure recovery
    this.addRecoveryStrategy({
      name: 'Authentication Recovery',
      condition: (error) => ['AUTH_FAILED', 'UNAUTHORIZED'].includes(error.code),
      execute: async (error) => {
        logger.info('Attempting authentication recovery');
        // Request new auth token or refresh existing one
        error.retryCount = (error.retryCount || 0) + 1;
        return false; // Manual intervention required
      },
      maxRetries: 2
    });

    // Message parsing error recovery
    this.addRecoveryStrategy({
      name: 'Message Parsing Recovery',
      condition: (error) => ['PARSE_ERROR', 'INVALID_MESSAGE'].includes(error.code),
      execute: async (error) => {
        logger.info('Attempting message parsing recovery');
        // Clear any cached messages and continue
        error.retryCount = (error.retryCount || 0) + 1;
        return true;
      },
      maxRetries: 3
    });

    // Network timeout recovery
    this.addRecoveryStrategy({
      name: 'Network Timeout Recovery',
      condition: (error) => ['TIMEOUT', 'NETWORK_ERROR'].includes(error.code),
      execute: async (error) => {
        logger.info('Attempting network timeout recovery');
        await this.delay(2000); // Wait 2 seconds
        error.retryCount = (error.retryCount || 0) + 1;
        return true;
      },
      maxRetries: 3
    });
  }

  private extractErrorCode(error: any): string {
    if (error?.code) return error.code;
    if (error?.name) return error.name;
    if (error instanceof DOMException) return 'DOM_EXCEPTION';
    if (error instanceof TypeError) return 'TYPE_ERROR';
    if (error instanceof SyntaxError) return 'SYNTAX_ERROR';
    return 'UNKNOWN_ERROR';
  }

  private extractErrorMessage(error: any): string {
    if (error?.message) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error occurred';
  }

  private isRecoverable(error: any): boolean {
    const nonRecoverableCodes = [
      'FATAL_ERROR',
      'PERMISSION_DENIED',
      'INVALID_CREDENTIALS',
      'ACCOUNT_SUSPENDED'
    ];

    const errorCode = this.extractErrorCode(error);
    return !nonRecoverableCodes.includes(errorCode);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global error handler instance
 */
export const webSocketErrorHandler = new WebSocketErrorHandler();