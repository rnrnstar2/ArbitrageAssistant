// import { existsSync, readFileSync, writeFileSync } from 'fs';
// import { join } from 'path';
import { WSErrorHandler, LogLevel } from './ws-error-handler';

export interface HedgeSystemConfig {
  websocket: {
    port: number;
    host: string;
    authToken: string;
    maxConnections: number;
    heartbeatInterval: number;
    connectionTimeout: number;
    maxPayloadSize: number;
    enableSSL: boolean;
    sslCert?: string;
    sslKey?: string;
  };
  ea: {
    connectionTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    authTimeout: number;
    maxMessageSize: number;
    requireAuth: boolean;
  };
  logging: {
    level: LogLevel;
    maxLogEntries: number;
    enableFileLogging: boolean;
    logFilePath?: string;
    enableConsoleLogging: boolean;
  };
  performance: {
    maxConcurrentMessages: number;
    messageQueueSize: number;
    enableMetrics: boolean;
    metricsInterval: number;
  };
  security: {
    enableRateLimit: boolean;
    rateLimitWindow: number;
    rateLimitMax: number;
    allowedOrigins: string[];
    enableIPWhitelist: boolean;
    ipWhitelist: string[];
  };
}

export const DEFAULT_CONFIG: HedgeSystemConfig = {
  websocket: {
    port: 8080,
    host: '127.0.0.1',
    authToken: 'hedge-system-default-token-change-me',
    maxConnections: 10,
    heartbeatInterval: 30000, // 30秒
    connectionTimeout: 300000, // 5分
    maxPayloadSize: 64 * 1024, // 64KB
    enableSSL: false
  },
  ea: {
    connectionTimeout: 60000, // 1分
    retryAttempts: 3,
    retryDelay: 5000, // 5秒
    authTimeout: 30000, // 30秒
    maxMessageSize: 32 * 1024, // 32KB
    requireAuth: true
  },
  logging: {
    level: LogLevel.INFO,
    maxLogEntries: 10000,
    enableFileLogging: false,
    enableConsoleLogging: true
  },
  performance: {
    maxConcurrentMessages: 100,
    messageQueueSize: 1000,
    enableMetrics: false,
    metricsInterval: 60000 // 1分
  },
  security: {
    enableRateLimit: true,
    rateLimitWindow: 60000, // 1分
    rateLimitMax: 1000, // 1分間に1000メッセージまで
    allowedOrigins: ['*'],
    enableIPWhitelist: false,
    ipWhitelist: ['127.0.0.1', '::1']
  }
};

/**
 * Hedge System設定管理クラス
 * 設定ファイルの読み込み、検証、更新を管理
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: HedgeSystemConfig;
  private configPath: string;
  private watchers: Array<(config: HedgeSystemConfig) => void> = [];

  private constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.loadConfig();
  }

  /**
   * シングルトンインスタンス取得
   */
  static getInstance(configPath?: string): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configPath);
    }
    return ConfigManager.instance;
  }

  /**
   * 設定取得
   */
  getConfig(): HedgeSystemConfig {
    return { ...this.config };
  }

  /**
   * WebSocket設定取得
   */
  getWebSocketConfig() {
    return { ...this.config.websocket };
  }

  /**
   * EA設定取得
   */
  getEAConfig() {
    return { ...this.config.ea };
  }

  /**
   * ログ設定取得
   */
  getLoggingConfig() {
    return { ...this.config.logging };
  }

  /**
   * パフォーマンス設定取得
   */
  getPerformanceConfig() {
    return { ...this.config.performance };
  }

  /**
   * セキュリティ設定取得
   */
  getSecurityConfig() {
    return { ...this.config.security };
  }

  /**
   * 設定更新
   */
  updateConfig(updates: Partial<HedgeSystemConfig>): void {
    const newConfig = this.mergeConfig(this.config, updates);
    
    if (!this.validateConfig(newConfig)) {
      throw new Error('Invalid configuration provided');
    }

    this.config = newConfig;
    this.saveConfig();
    this.notifyWatchers();

    WSErrorHandler.logEvent('CONFIG_UPDATED', {
      updatedKeys: Object.keys(updates),
      configPath: this.configPath
    });
  }

  /**
   * 部分設定更新
   */
  updateWebSocketConfig(updates: Partial<HedgeSystemConfig['websocket']>): void {
    this.updateConfig({ websocket: { ...this.config.websocket, ...updates } });
  }

  updateEAConfig(updates: Partial<HedgeSystemConfig['ea']>): void {
    this.updateConfig({ ea: { ...this.config.ea, ...updates } });
  }

  updateLoggingConfig(updates: Partial<HedgeSystemConfig['logging']>): void {
    this.updateConfig({ logging: { ...this.config.logging, ...updates } });
  }

  /**
   * 設定リロード
   */
  reloadConfig(): void {
    try {
      const newConfig = this.loadConfig();
      this.config = newConfig;
      this.notifyWatchers();
      
      WSErrorHandler.logEvent('CONFIG_RELOADED', {
        configPath: this.configPath
      });

    } catch (error) {
      WSErrorHandler.handleCriticalError(error as Error, {
        action: 'config_reload',
        configPath: this.configPath
      });
      throw error;
    }
  }

  /**
   * 設定リセット（デフォルトに戻す）
   */
  resetToDefault(): void {
    this.config = this.deepClone(DEFAULT_CONFIG);
    this.saveConfig();
    this.notifyWatchers();

    WSErrorHandler.logEvent('CONFIG_RESET', {
      configPath: this.configPath
    });
  }

  /**
   * 設定ウォッチャー登録
   */
  watch(callback: (config: HedgeSystemConfig) => void): void {
    this.watchers.push(callback);
  }

  /**
   * 設定検証
   */
  validateCurrentConfig(): { isValid: boolean; errors: string[] } {
    return this.validateConfigDetailed(this.config);
  }

  /**
   * プライベートメソッド
   */
  private getDefaultConfigPath(): string {
    // Temporarily using memory-only config for MVP
    return 'memory-config';
  }

  private loadConfig(): HedgeSystemConfig {
    // Temporarily using default config for MVP (memory-only)
    WSErrorHandler.logEvent('CONFIG_LOADED_DEFAULT', {
      configPath: this.configPath
    });
    return this.deepClone(DEFAULT_CONFIG);
  }

  private saveConfig(config?: HedgeSystemConfig): void {
    // Temporarily disabled for MVP (memory-only config)
    WSErrorHandler.logEvent('CONFIG_SAVE_SKIPPED', {
      configPath: this.configPath
    });
  }

  private validateConfig(config: HedgeSystemConfig): boolean {
    const result = this.validateConfigDetailed(config);
    return result.isValid;
  }

  private validateConfigDetailed(config: HedgeSystemConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // WebSocket設定検証
    if (config.websocket.port < 1 || config.websocket.port > 65535) {
      errors.push('WebSocket port must be between 1 and 65535');
    }
    
    if (!config.websocket.host || config.websocket.host.trim() === '') {
      errors.push('WebSocket host cannot be empty');
    }
    
    if (config.websocket.maxConnections < 1) {
      errors.push('Max connections must be at least 1');
    }
    
    if (config.websocket.heartbeatInterval < 1000) {
      errors.push('Heartbeat interval must be at least 1000ms');
    }

    // EA設定検証
    if (config.ea.connectionTimeout < 1000) {
      errors.push('EA connection timeout must be at least 1000ms');
    }
    
    if (config.ea.retryAttempts < 0) {
      errors.push('EA retry attempts cannot be negative');
    }

    // セキュリティ設定検証
    if (config.security.enableRateLimit && config.security.rateLimitMax < 1) {
      errors.push('Rate limit max must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private mergeConfig(base: HedgeSystemConfig, updates: any): HedgeSystemConfig {
    const result = this.deepClone(base);
    
    // 再帰的にマージ
    const merge = (target: any, source: any): void => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };

    merge(result, updates);
    return result;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private notifyWatchers(): void {
    this.watchers.forEach(callback => {
      try {
        callback(this.config);
      } catch (error) {
        WSErrorHandler.handleCriticalError(error as Error, {
          action: 'config_watcher_callback'
        });
      }
    });
  }

  private createBackup(): void {
    // Temporarily disabled for MVP (memory-only config)
    WSErrorHandler.logEvent('CONFIG_BACKUP_SKIPPED', {
      configPath: this.configPath
    });
  }
}

/**
 * ヘルパー関数
 */
export function loadConfig(configPath?: string): HedgeSystemConfig {
  return ConfigManager.getInstance(configPath).getConfig();
}

export function updateConfig(updates: Partial<HedgeSystemConfig>, configPath?: string): void {
  ConfigManager.getInstance(configPath).updateConfig(updates);
}

export function getWebSocketConfig(configPath?: string) {
  return ConfigManager.getInstance(configPath).getWebSocketConfig();
}

export function getEAConfig(configPath?: string) {
  return ConfigManager.getInstance(configPath).getEAConfig();
}