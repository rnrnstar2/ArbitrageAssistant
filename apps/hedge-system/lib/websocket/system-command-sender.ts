import { 
  SystemCommand,
  SystemControlCommand,
  DiagnosticRequestCommand,
  AuthTokenUpdateCommand,
  SessionValidateCommand,
  LogLevelChangeCommand,
  CacheClearCommand,
  DataSyncRequestCommand,
  TestConnectionCommand,
  SystemConfigCommand,
  createSystemCommand,
  createMessageId
} from './message-types';

// ===== RESULT INTERFACES =====

export interface CommandResult {
  success: boolean;
  commandId: string;
  timestamp: Date;
  error?: string;
  data?: any;
}

export interface ConnectionTestResult extends CommandResult {
  latency?: number;
  eaVersion?: string;
  eaStatus?: string;
}

export interface DiagnosticResult extends CommandResult {
  requestType: string;
  data: PerformanceMetrics | HealthCheckResult | LogData | any;
}

export interface SessionValidationResult extends CommandResult {
  valid: boolean;
  expiresAt?: Date;
  permissions: string[];
  lastActivity?: Date;
}

// ===== DATA INTERFACES =====

export interface EAConfig {
  tradingEnabled: boolean;
  maxLotSize: number;
  maxSpread: number;
  maxMarginUsage: number;
  logLevel: 'debug' | 'info' | 'warning' | 'error';
  heartbeatInterval: number;
  dataUpdateInterval: number;
}

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  messageProcessingTime: number;
  orderExecutionTime: number;
}

export interface HealthCheckResult {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    connection: ComponentHealth;
    trading: ComponentHealth;
    dataSync: ComponentHealth;
    memory: ComponentHealth;
  };
  timestamp: Date;
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical';
  message?: string;
  metrics?: any;
}

export interface LogData {
  level: string;
  entries: LogEntry[];
  totalCount: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface LogEntry {
  timestamp: Date;
  level: string;
  component: string;
  message: string;
  data?: any;
}

// ===== SYSTEM COMMAND SENDER INTERFACE =====

export interface SystemCommandSender {
  sendTestConnection(): Promise<ConnectionTestResult>;
  sendConfigUpdate(config: EAConfig): Promise<CommandResult>;
  sendSystemControl(action: SystemControlCommand): Promise<CommandResult>;
  sendDataSyncRequest(syncRequest: DataSyncRequestCommand): Promise<CommandResult>;
  sendDiagnosticRequest(diagnostic: DiagnosticRequestCommand): Promise<DiagnosticResult>;
  sendAuthTokenUpdate(authUpdate: AuthTokenUpdateCommand): Promise<CommandResult>;
  sendSessionValidate(sessionValidate: SessionValidateCommand): Promise<SessionValidationResult>;
  sendLogLevelChange(logChange: LogLevelChangeCommand): Promise<CommandResult>;
  sendCacheClear(cacheClear: CacheClearCommand): Promise<CommandResult>;
}

// ===== SYSTEM COMMAND MANAGER CLASS =====

export class SystemCommandManager implements SystemCommandSender {
  private pendingCommands: Map<string, {
    commandId: string;
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
    type: string;
  }> = new Map();

  private readonly commandTimeout = 30000; // 30 seconds
  private sendCommand: (command: SystemCommand) => Promise<any>;

  constructor(sendCommandFunction: (command: SystemCommand) => Promise<any>) {
    this.sendCommand = sendCommandFunction;
  }

  /**
   * Send connection test command
   */
  async sendTestConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      const testCommand: TestConnectionCommand = {
        testType: 'ping',
        payload: `test_${Date.now()}`
      };

      const response = await this.sendCommandWithResponse<any>(
        'test_connection',
        'system',
        testCommand
      );
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      return {
        success: true,
        commandId: response.commandId,
        timestamp: new Date(),
        latency,
        eaVersion: response.data?.version,
        eaStatus: response.data?.status
      };
    } catch (error) {
      return {
        success: false,
        commandId: createMessageId(),
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send EA configuration update
   */
  async sendConfigUpdate(config: EAConfig): Promise<CommandResult> {
    try {
      // Validate configuration
      this.validateConfig(config);
      
      const configCommand: SystemConfigCommand = {
        configType: 'heartbeat_interval', // Will be extended to support more config types
        settings: config as any
      };

      const response = await this.sendCommandWithResponse<any>(
        'system_config',
        'system',
        configCommand
      );

      return {
        success: true,
        commandId: response.commandId,
        timestamp: new Date(),
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        commandId: createMessageId(),
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Configuration update failed'
      };
    }
  }

  /**
   * Send system control command
   */
  async sendSystemControl(action: SystemControlCommand): Promise<CommandResult> {
    try {
      const response = await this.sendCommandWithResponse<any>(
        'system_control',
        'system',
        action
      );

      return {
        success: true,
        commandId: response.commandId,
        timestamp: new Date(),
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        commandId: createMessageId(),
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'System control command failed'
      };
    }
  }

  /**
   * Send data synchronization request
   */
  async sendDataSyncRequest(syncRequest: DataSyncRequestCommand): Promise<CommandResult> {
    try {
      const response = await this.sendCommandWithResponse<any>(
        'data_sync_request',
        'system',
        syncRequest
      );

      return {
        success: true,
        commandId: response.commandId,
        timestamp: new Date(),
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        commandId: createMessageId(),
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Data sync request failed'
      };
    }
  }

  /**
   * Send diagnostic request
   */
  async sendDiagnosticRequest(diagnostic: DiagnosticRequestCommand): Promise<DiagnosticResult> {
    try {
      const response = await this.sendCommandWithResponse<any>(
        'diagnostic_request',
        'system',
        diagnostic
      );

      return {
        success: true,
        commandId: response.commandId,
        timestamp: new Date(),
        requestType: diagnostic.requestType,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        commandId: createMessageId(),
        timestamp: new Date(),
        requestType: diagnostic.requestType,
        error: error instanceof Error ? error.message : 'Diagnostic request failed',
        data: null
      };
    }
  }

  /**
   * Send authentication token update
   */
  async sendAuthTokenUpdate(authUpdate: AuthTokenUpdateCommand): Promise<CommandResult> {
    try {
      // Validate token
      if (!this.validateToken(authUpdate.token)) {
        throw new Error('Invalid authentication token');
      }

      const response = await this.sendCommandWithResponse<any>(
        'auth_token_update',
        'system',
        authUpdate
      );

      return {
        success: true,
        commandId: response.commandId,
        timestamp: new Date(),
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        commandId: createMessageId(),
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Auth token update failed'
      };
    }
  }

  /**
   * Send session validation request
   */
  async sendSessionValidate(sessionValidate: SessionValidateCommand): Promise<SessionValidationResult> {
    try {
      const response = await this.sendCommandWithResponse<any>(
        'session_validate',
        'system',
        sessionValidate
      );

      return {
        success: true,
        commandId: response.commandId,
        timestamp: new Date(),
        valid: response.data?.valid || false,
        expiresAt: response.data?.expiresAt ? new Date(response.data.expiresAt) : undefined,
        permissions: response.data?.permissions || [],
        lastActivity: response.data?.lastActivity ? new Date(response.data.lastActivity) : undefined
      };
    } catch (error) {
      return {
        success: false,
        commandId: createMessageId(),
        timestamp: new Date(),
        valid: false,
        permissions: [],
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
    }
  }

  /**
   * Send log level change command
   */
  async sendLogLevelChange(logChange: LogLevelChangeCommand): Promise<CommandResult> {
    try {
      const response = await this.sendCommandWithResponse<any>(
        'log_level_change',
        'system',
        logChange
      );

      return {
        success: true,
        commandId: response.commandId,
        timestamp: new Date(),
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        commandId: createMessageId(),
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Log level change failed'
      };
    }
  }

  /**
   * Send cache clear command
   */
  async sendCacheClear(cacheClear: CacheClearCommand): Promise<CommandResult> {
    try {
      const response = await this.sendCommandWithResponse<any>(
        'cache_clear',
        'system',
        cacheClear
      );

      return {
        success: true,
        commandId: response.commandId,
        timestamp: new Date(),
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        commandId: createMessageId(),
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Cache clear failed'
      };
    }
  }

  /**
   * Handle command response
   */
  handleCommandResponse(commandId: string, success: boolean, data?: any, error?: string): void {
    const pendingCommand = this.pendingCommands.get(commandId);
    if (!pendingCommand) {
      console.warn(`Received response for unknown command: ${commandId}`);
      return;
    }

    clearTimeout(pendingCommand.timeout);
    this.pendingCommands.delete(commandId);

    if (success) {
      pendingCommand.resolve({ commandId, success: true, data });
    } else {
      pendingCommand.reject(new Error(error || 'Command failed'));
    }
  }

  /**
   * Clean up expired commands
   */
  cleanup(): void {
    this.pendingCommands.forEach((command, commandId) => {
      clearTimeout(command.timeout);
      command.reject(new Error('System shutdown'));
    });
    this.pendingCommands.clear();
  }

  // === PRIVATE HELPER METHODS ===

  private async sendCommandWithResponse<T>(
    type: SystemCommand['type'],
    accountId: string,
    data: any
  ): Promise<T> {
    const command = createSystemCommand(type, accountId, data);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(command.commandId);
        reject(new Error(`Command timeout after ${this.commandTimeout}ms`));
      }, this.commandTimeout);

      this.pendingCommands.set(command.commandId, {
        commandId: command.commandId,
        resolve,
        reject,
        timeout,
        type
      });

      this.sendCommand(command).catch(error => {
        clearTimeout(timeout);
        this.pendingCommands.delete(command.commandId);
        reject(error);
      });
    });
  }

  private validateConfig(config: EAConfig): void {
    if (config.maxLotSize <= 0) {
      throw new Error('Max lot size must be positive');
    }
    if (config.maxSpread < 0) {
      throw new Error('Max spread cannot be negative');
    }
    if (config.maxMarginUsage <= 0 || config.maxMarginUsage > 100) {
      throw new Error('Max margin usage must be between 0 and 100');
    }
    if (config.heartbeatInterval < 1000) {
      throw new Error('Heartbeat interval must be at least 1000ms');
    }
    if (config.dataUpdateInterval < 100) {
      throw new Error('Data update interval must be at least 100ms');
    }
  }

  private validateToken(token: string): boolean {
    // Basic token validation - implement according to your auth system
    return token.length > 10 && token.includes('.');
  }

  private generateCommandId(): string {
    return createMessageId();
  }
}