// ===== LOGGING INTERFACES =====

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  components: string[];
  maxEntries: number;
  enableConsole: boolean;
  enableFile: boolean;
  filename?: string;
  enableRemote: boolean;
  remoteEndpoint?: string;
}

export interface LogFilter {
  level?: LogLevel;
  component?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}

// ===== ERROR INTERFACES =====

export interface ErrorInfo {
  code: string;
  message: string;
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  context?: any;
  stackTrace?: string;
  user?: string;
  session?: string;
}

export interface ErrorHandler {
  handleError(error: Error | string, context?: any): void;
  getErrorStats(): ErrorStats;
  getRecentErrors(limit?: number): ErrorInfo[];
}

export interface ErrorStats {
  total: number;
  byLevel: Record<string, number>;
  byComponent: Record<string, number>;
  lastHour: number;
  lastDay: number;
}

// ===== LOGGER IMPLEMENTATION =====

export class WebSocketLogger {
  private config: LoggerConfig;
  private entries: LogEntry[] = [];
  private errorStats: ErrorStats = {
    total: 0,
    byLevel: {},
    byComponent: {},
    lastHour: 0,
    lastDay: 0
  };

  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warning: 2,
    error: 3
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      components: ['*'],
      maxEntries: 10000,
      enableConsole: true,
      enableFile: false,
      enableRemote: false,
      ...config
    };
  }

  /**
   * Log debug message
   */
  debug(component: string, message: string, data?: any): void {
    this.log('debug', component, message, data);
  }

  /**
   * Log info message
   */
  info(component: string, message: string, data?: any): void {
    this.log('info', component, message, data);
  }

  /**
   * Log warning message
   */
  warning(component: string, message: string, data?: any): void {
    this.log('warning', component, message, data);
  }

  /**
   * Log error message
   */
  error(component: string, message: string, error?: Error, data?: any): void {
    this.log('error', component, message, data, error);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, component: string, message: string, data?: any, error?: Error): void {
    // Check if logging is enabled for this level and component
    if (!this.shouldLog(level, component)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      component,
      message,
      data,
      error,
      metadata: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    // Add to entries
    this.entries.push(entry);
    
    // Maintain max entries limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries.shift();
    }

    // Update error stats if error level
    if (level === 'error') {
      this.updateErrorStats(entry);
    }

    // Output to various sinks
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    if (this.config.enableFile && this.config.filename) {
      this.logToFile(entry);
    }

    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.logToRemote(entry);
    }
  }

  /**
   * Get log entries with optional filtering
   */
  getLogs(filter?: LogFilter): LogEntry[] {
    let filteredEntries = [...this.entries];

    if (filter) {
      if (filter.level) {
        const minLevel = WebSocketLogger.LOG_LEVELS[filter.level];
        filteredEntries = filteredEntries.filter(entry => 
          WebSocketLogger.LOG_LEVELS[entry.level] >= minLevel
        );
      }

      if (filter.component) {
        filteredEntries = filteredEntries.filter(entry => 
          entry.component === filter.component
        );
      }

      if (filter.since) {
        filteredEntries = filteredEntries.filter(entry => 
          entry.timestamp >= filter.since!
        );
      }

      if (filter.until) {
        filteredEntries = filteredEntries.filter(entry => 
          entry.timestamp <= filter.until!
        );
      }

      if (filter.limit) {
        filteredEntries = filteredEntries.slice(-filter.limit);
      }
    }

    return filteredEntries;
  }

  /**
   * Clear all log entries
   */
  clearLogs(): void {
    this.entries = [];
    this.resetErrorStats();
  }

  /**
   * Update log level
   */
  setLogLevel(level: LogLevel): void {
    this.config.level = level;
    this.info('logger', `Log level changed to ${level}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Get logger statistics
   */
  getStats(): {
    totalEntries: number;
    entriesByLevel: Record<LogLevel, number>;
    entriesByComponent: Record<string, number>;
    memoryUsage: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const entriesByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warning: 0,
      error: 0
    };

    const entriesByComponent: Record<string, number> = {};

    this.entries.forEach(entry => {
      entriesByLevel[entry.level]++;
      entriesByComponent[entry.component] = (entriesByComponent[entry.component] || 0) + 1;
    });

    return {
      totalEntries: this.entries.length,
      entriesByLevel,
      entriesByComponent,
      memoryUsage: JSON.stringify(this.entries).length,
      oldestEntry: this.entries[0]?.timestamp,
      newestEntry: this.entries[this.entries.length - 1]?.timestamp
    };
  }

  // === PRIVATE HELPER METHODS ===

  private shouldLog(level: LogLevel, component: string): boolean {
    // Check log level
    if (WebSocketLogger.LOG_LEVELS[level] < WebSocketLogger.LOG_LEVELS[this.config.level]) {
      return false;
    }

    // Check component filter
    if (!this.config.components.includes('*') && !this.config.components.includes(component)) {
      return false;
    }

    return true;
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelUpper = entry.level.toUpperCase().padEnd(7);
    const component = entry.component.padEnd(15);
    
    let output = `[${timestamp}] ${levelUpper} [${component}] ${entry.message}`;
    
    if (entry.data) {
      output += ` | Data: ${JSON.stringify(entry.data)}`;
    }

    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warning':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        if (entry.error) {
          console.error('Error details:', entry.error);
        }
        break;
    }
  }

  private logToFile(entry: LogEntry): void {
    // File logging implementation would go here
    // For now, this is a placeholder
    console.log(`[FILE] ${JSON.stringify(entry)}`);
  }

  private logToRemote(entry: LogEntry): void {
    // Remote logging implementation would go here
    // For now, this is a placeholder
    console.log(`[REMOTE] ${JSON.stringify(entry)}`);
  }

  private updateErrorStats(entry: LogEntry): void {
    this.errorStats.total++;
    this.errorStats.byLevel[entry.level] = (this.errorStats.byLevel[entry.level] || 0) + 1;
    this.errorStats.byComponent[entry.component] = (this.errorStats.byComponent[entry.component] || 0) + 1;

    // Update time-based stats
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    this.errorStats.lastHour = this.entries.filter(e => 
      e.level === 'error' && e.timestamp >= oneHourAgo
    ).length;

    this.errorStats.lastDay = this.entries.filter(e => 
      e.level === 'error' && e.timestamp >= oneDayAgo
    ).length;
  }

  private resetErrorStats(): void {
    this.errorStats = {
      total: 0,
      byLevel: {},
      byComponent: {},
      lastHour: 0,
      lastDay: 0
    };
  }
}

// ===== ERROR HANDLER IMPLEMENTATION =====

export class WebSocketErrorHandler implements ErrorHandler {
  private logger: WebSocketLogger;
  private errors: ErrorInfo[] = [];
  private maxErrors = 1000;

  constructor(logger: WebSocketLogger) {
    this.logger = logger;
  }

  /**
   * Handle an error
   */
  handleError(error: Error | string, context?: any): void {
    const errorInfo: ErrorInfo = {
      code: this.generateErrorCode(error),
      message: error instanceof Error ? error.message : error,
      component: context?.component || 'unknown',
      severity: this.determineSeverity(error, context),
      timestamp: new Date(),
      context,
      stackTrace: error instanceof Error ? error.stack : undefined,
      user: context?.user,
      session: context?.session
    };

    // Add to error list
    this.errors.push(errorInfo);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log the error
    this.logger.error(
      errorInfo.component,
      `[${errorInfo.code}] ${errorInfo.message}`,
      error instanceof Error ? error : undefined,
      { severity: errorInfo.severity, context }
    );

    // Handle critical errors
    if (errorInfo.severity === 'critical') {
      this.handleCriticalError(errorInfo);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    const stats: ErrorStats = {
      total: this.errors.length,
      byLevel: {},
      byComponent: {},
      lastHour: 0,
      lastDay: 0
    };

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    this.errors.forEach(error => {
      // By severity
      stats.byLevel[error.severity] = (stats.byLevel[error.severity] || 0) + 1;
      
      // By component
      stats.byComponent[error.component] = (stats.byComponent[error.component] || 0) + 1;
      
      // Time-based
      if (error.timestamp >= oneHourAgo) {
        stats.lastHour++;
      }
      if (error.timestamp >= oneDayAgo) {
        stats.lastDay++;
      }
    });

    return stats;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): ErrorInfo[] {
    return this.errors.slice(-limit);
  }

  /**
   * Clear error history
   */
  clearErrors(): void {
    this.errors = [];
  }

  // === PRIVATE HELPER METHODS ===

  private generateErrorCode(error: Error | string): string {
    if (error instanceof Error) {
      // Generate a code based on error type and message
      const errorType = error.constructor.name;
      const hash = this.simpleHash(error.message);
      return `${errorType}_${hash}`;
    } else {
      const hash = this.simpleHash(error);
      return `STRING_${hash}`;
    }
  }

  private determineSeverity(error: Error | string, context?: any): 'low' | 'medium' | 'high' | 'critical' {
    // Determine severity based on error type and context
    if (context?.severity) {
      return context.severity;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('connection') || message.includes('network')) {
        return 'high';
      }
      if (message.includes('timeout') || message.includes('abort')) {
        return 'medium';
      }
      if (message.includes('validation') || message.includes('format')) {
        return 'low';
      }
      if (message.includes('critical') || message.includes('fatal')) {
        return 'critical';
      }
    }

    return 'medium'; // Default severity
  }

  private handleCriticalError(errorInfo: ErrorInfo): void {
    // Handle critical errors - could send notifications, trigger alerts, etc.
    console.error(`CRITICAL ERROR in ${errorInfo.component}: ${errorInfo.message}`);
    
    // You could add additional handling here:
    // - Send email/Slack notifications
    // - Trigger system recovery procedures
    // - Create incident tickets
    // - etc.
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substr(0, 6);
  }
}

// ===== SINGLETON INSTANCES =====

// Create singleton instances for global use
export const logger = new WebSocketLogger({
  level: 'info',
  components: ['*'],
  enableConsole: true,
  enableFile: false,
  enableRemote: false
});

export const errorHandler = new WebSocketErrorHandler(logger);

// ===== UTILITY FUNCTIONS =====

/**
 * Create a logger for a specific component
 */
export function createComponentLogger(component: string) {
  return {
    debug: (message: string, data?: any) => logger.debug(component, message, data),
    info: (message: string, data?: any) => logger.info(component, message, data),
    warning: (message: string, data?: any) => logger.warning(component, message, data),
    error: (message: string, error?: Error, data?: any) => logger.error(component, message, error, data),
    handleError: (error: Error | string, context?: any) => 
      errorHandler.handleError(error, { ...context, component })
  };
}

/**
 * Decorator for automatic error handling
 */
export function withErrorHandling(component: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        errorHandler.handleError(error, {
          component,
          method: propertyKey,
          args: args.length > 0 ? '[redacted]' : undefined
        });
        throw error;
      }
    };

    return descriptor;
  };
}