/**
 * Alert System Integration - Task 08-07 Implementation
 * 
 * This module provides a complete alert management system for EA-WebSocket integration.
 * It handles alert reception, processing, notification, and history management.
 */

import { AlertDataReceiver } from './alert-receiver';
import { AlertManager, AlertConfiguration } from './alert-manager';
import { NotificationManager, NotificationConfig } from './notification-manager';
import { AlertHistoryManager } from './alert-history-manager';
import { WebSocketClient } from './websocket-client';
import { EAMessage, isLosscutAlertMessage } from './message-types';

export interface AlertSystemConfig {
  alertConfig?: Partial<AlertConfiguration>;
  notificationConfig?: Partial<NotificationConfig>;
  enableAutoStart?: boolean;
}

export interface AlertSystemStats {
  isRunning: boolean;
  alertsProcessed: number;
  alertsInHistory: number;
  lastAlertTime?: Date;
  systemHealth: 'healthy' | 'degraded' | 'error';
}

/**
 * Complete Alert System that integrates all alert-related functionality
 */
export class AlertSystem {
  private alertManager: AlertManager;
  private notificationManager: NotificationManager;
  private alertHistory: AlertHistoryManager;
  private alertReceiver: AlertDataReceiver;
  private isRunning = false;
  private alertsProcessed = 0;
  private lastAlertTime?: Date;
  private websocketClients: Set<WebSocketClient> = new Set();

  constructor(config?: AlertSystemConfig) {
    // Initialize components
    this.alertManager = new AlertManager(config?.alertConfig);
    this.notificationManager = new NotificationManager(config?.notificationConfig);
    this.alertHistory = new AlertHistoryManager();
    
    // Initialize alert receiver with dependencies
    this.alertReceiver = new AlertDataReceiver(
      this.alertManager,
      this.notificationManager,
      this.alertHistory
    );

    if (config?.enableAutoStart !== false) {
      this.start();
    }
  }

  /**
   * Start the alert system
   */
  public start(): void {
    if (this.isRunning) {
      console.warn('Alert system is already running');
      return;
    }

    this.isRunning = true;
    console.log('Alert System started');
  }

  /**
   * Stop the alert system
   */
  public stop(): void {
    if (!this.isRunning) {
      console.warn('Alert system is not running');
      return;
    }

    this.isRunning = false;
    console.log('Alert System stopped');
  }

  /**
   * Connect WebSocket client to the alert system
   */
  public connectWebSocket(client: WebSocketClient): void {
    if (this.websocketClients.has(client)) {
      return;
    }

    // Setup message handler for alerts
    client.on('message_received', (_, message) => {
      this.handleWebSocketMessage(message);
    });

    this.websocketClients.add(client);
    console.log('WebSocket client connected to alert system');
  }

  /**
   * Disconnect WebSocket client from the alert system
   */
  public disconnectWebSocket(client: WebSocketClient): void {
    this.websocketClients.delete(client);
    console.log('WebSocket client disconnected from alert system');
  }

  /**
   * Process incoming EA message for alerts
   */
  public async processEAMessage(message: EAMessage): Promise<void> {
    if (!this.isRunning) {
      console.warn('Alert system is not running, ignoring message');
      return;
    }

    try {
      await this.alertReceiver.onAlertReceived(message);
      this.alertsProcessed++;
      this.lastAlertTime = new Date();
    } catch (error) {
      console.error('Error processing EA message in alert system:', error);
    }
  }

  /**
   * Send a test notification
   */
  public async testNotification(severity: 'info' | 'warning' | 'error' | 'critical' = 'info'): Promise<void> {
    return this.notificationManager.testNotification(severity);
  }

  /**
   * Test all notification methods
   */
  public async testAllNotifications(): Promise<any> {
    return this.notificationManager.testAllNotificationMethods();
  }

  /**
   * Get alert system statistics
   */
  public getStats(): AlertSystemStats {
    const historySize = this.alertHistory.getCacheSize();
    
    return {
      isRunning: this.isRunning,
      alertsProcessed: this.alertsProcessed,
      alertsInHistory: historySize,
      lastAlertTime: this.lastAlertTime,
      systemHealth: this.determineSystemHealth()
    };
  }

  /**
   * Get alert history for specific account
   */
  public async getAlertHistory(accountId: string, limit?: number): Promise<any> {
    return this.alertHistory.getAlertHistory(accountId, limit);
  }

  /**
   * Search alerts by criteria
   */
  public async searchAlerts(criteria: any): Promise<any> {
    return this.alertHistory.searchAlerts(criteria);
  }

  /**
   * Get alert statistics
   */
  public async getAlertStatistics(): Promise<any> {
    return this.alertHistory.getAlertStatistics();
  }

  /**
   * Export alert history
   */
  public async exportHistory(format: 'json' | 'csv' = 'json'): Promise<string> {
    return this.alertHistory.exportHistory(format);
  }

  /**
   * Clear alert history
   */
  public async clearHistory(accountId?: string): Promise<void> {
    return this.alertHistory.clearHistory(accountId);
  }

  /**
   * Update alert system configuration
   */
  public updateConfiguration(config: {
    alertConfig?: Partial<AlertConfiguration>;
    notificationConfig?: Partial<NotificationConfig>;
  }): void {
    if (config.alertConfig) {
      this.alertManager.updateConfiguration(config.alertConfig);
    }
    
    if (config.notificationConfig) {
      this.notificationManager.updateConfiguration(config.notificationConfig);
    }
  }

  /**
   * Get current configurations
   */
  public getConfiguration() {
    return {
      alertConfig: this.alertManager.getConfiguration(),
      notificationConfig: this.notificationManager.getConfiguration()
    };
  }

  private async handleWebSocketMessage(message: any): Promise<void> {
    try {
      // Check if this is an alert message
      if (isLosscutAlertMessage(message)) {
        await this.processEAMessage(message);
      }
    } catch (error) {
      console.error('Error handling WebSocket message in alert system:', error);
    }
  }

  private determineSystemHealth(): 'healthy' | 'degraded' | 'error' {
    if (!this.isRunning) {
      return 'error';
    }

    // Check if we've processed recent alerts (system is active)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (this.lastAlertTime && this.lastAlertTime > fiveMinutesAgo) {
      return 'healthy';
    }

    // If no recent activity but system is running, consider it healthy
    return 'healthy';
  }
}

/**
 * Convenience function to create and configure alert system
 */
export function createAlertSystem(config?: AlertSystemConfig): AlertSystem {
  return new AlertSystem(config);
}

/**
 * Default alert system instance (singleton pattern)
 */
let defaultAlertSystem: AlertSystem | null = null;

/**
 * Get or create the default alert system instance
 */
export function getDefaultAlertSystem(config?: AlertSystemConfig): AlertSystem {
  if (!defaultAlertSystem) {
    defaultAlertSystem = new AlertSystem(config);
  }
  return defaultAlertSystem;
}

// Re-export important types and classes for convenience
export {
  AlertDataReceiver,
  AlertManager,
  NotificationManager,
  AlertHistoryManager
} from './alert-receiver';

export type {
  BaseAlert,
  ProcessedAlert,
  AlertType,
  AlertSearchCriteria
} from './alert-receiver';

export type {
  AlertConfiguration
} from './alert-manager';

export type {
  NotificationConfig,
  NotificationResult
} from './notification-manager';

export default AlertSystem;