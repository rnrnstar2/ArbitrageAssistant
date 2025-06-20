import { EAMessage, LosscutAlert, isLosscutAlertMessage, BaseMessage } from './message-types';

export interface BaseAlert {
  id: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: Date;
  accountId: string;
  message: string;
  data?: any;
}

export type AlertType = 
  | 'losscut' 
  | 'margin_call' 
  | 'system_error' 
  | 'trade_error'
  | 'connection_error'
  | 'data_error';

export interface ProcessedAlert extends BaseAlert {
  category: AlertCategory;
  priority: number;
  rules: AlertRule[];
  actions: AlertAction[];
  expiresAt?: Date;
}

export interface AlertCategory {
  name: string;
  level: number;
  autoActions: string[];
}

export interface AlertRule {
  id: string;
  condition: string;
  action: AlertAction;
  enabled: boolean;
}

export interface AlertAction {
  type: 'notify' | 'email' | 'webhook' | 'auto_trade' | 'emergency_stop';
  config: any;
}

export interface LosscutAlertData extends BaseAlert {
  type: 'losscut';
  positionId: string;
  symbol: string;
  closedPrice: number;
  loss: number;
  marginLevel: number;
}

export interface MarginCallAlert extends BaseAlert {
  type: 'margin_call';
  currentMarginLevel: number;
  requiredMarginLevel: number;
  timeToLosscut?: number;
}

export interface SystemErrorAlert extends BaseAlert {
  type: 'system_error';
  errorCode: string;
  errorDetails: any;
}

export interface TradeErrorAlert extends BaseAlert {
  type: 'trade_error';
  commandId: string;
  errorCode: string;
  symbol?: string;
  operation?: string;
}

export interface ConnectionErrorAlert extends BaseAlert {
  type: 'connection_error';
  connectionId: string;
  errorType: 'timeout' | 'disconnect' | 'auth_failure';
}

export interface DataErrorAlert extends BaseAlert {
  type: 'data_error';
  dataType: string;
  validationErrors: string[];
}

export type AlertData = 
  | LosscutAlertData 
  | MarginCallAlert 
  | SystemErrorAlert 
  | TradeErrorAlert
  | ConnectionErrorAlert
  | DataErrorAlert;

export interface AlertReceiver {
  onAlertReceived(message: EAMessage): Promise<void>;
  onLosscutAlert(data: LosscutAlert): Promise<void>;
  onMarginCallAlert(data: MarginCallAlert): Promise<void>;
  onSystemErrorAlert(data: SystemErrorAlert): Promise<void>;
  onTradeErrorAlert(data: TradeErrorAlert): Promise<void>;
  onConnectionErrorAlert(data: ConnectionErrorAlert): Promise<void>;
  onDataErrorAlert(data: DataErrorAlert): Promise<void>;
}

export interface AlertManager {
  processAlert(alert: BaseAlert): Promise<ProcessedAlert>;
  categorizeAlert(alert: BaseAlert): AlertCategory;
  calculatePriority(alert: BaseAlert): number;
  checkAlertRules(alert: BaseAlert): AlertRule[];
}

export interface NotificationManager {
  sendDesktopNotification(alert: ProcessedAlert): Promise<void>;
  playSoundAlert(alert: ProcessedAlert): Promise<void>;
  sendEmailNotification(alert: ProcessedAlert): Promise<void>;
  sendWebhookNotification(alert: ProcessedAlert): Promise<void>;
}

export interface AlertHistoryManager {
  saveAlert(alert: ProcessedAlert): Promise<void>;
  getAlertHistory(accountId: string, limit?: number): Promise<ProcessedAlert[]>;
  deleteExpiredAlerts(): Promise<void>;
  searchAlerts(criteria: AlertSearchCriteria): Promise<ProcessedAlert[]>;
}

export interface AlertSearchCriteria {
  accountId?: string;
  type?: AlertType;
  severity?: BaseAlert['severity'];
  startDate?: Date;
  endDate?: Date;
}

export class AlertDataReceiver implements AlertReceiver {
  private alertManager: AlertManager;
  private notificationManager: NotificationManager;
  private alertHistory: AlertHistoryManager;
  private alertCache: Map<string, ProcessedAlert> = new Map();
  private duplicateThreshold = 60000; // 1 minute

  constructor(
    alertManager: AlertManager,
    notificationManager: NotificationManager,
    alertHistory: AlertHistoryManager
  ) {
    this.alertManager = alertManager;
    this.notificationManager = notificationManager;
    this.alertHistory = alertHistory;
    
    // Clean expired alerts every 5 minutes
    setInterval(() => {
      this.cleanExpiredAlertsFromCache();
    }, 5 * 60 * 1000);
  }

  async onAlertReceived(message: EAMessage): Promise<void> {
    try {
      if (isLosscutAlertMessage(message)) {
        await this.onLosscutAlert(message.data as LosscutAlert);
      } else {
        console.warn('Received unknown alert message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing alert message:', error);
      
      // Create system error alert for processing failure
      const systemErrorAlert: SystemErrorAlert = {
        id: this.generateAlertId(),
        type: 'system_error',
        severity: 'error',
        timestamp: new Date(),
        accountId: message.accountId,
        message: 'Failed to process incoming alert',
        errorCode: 'ALERT_PROCESSING_ERROR',
        errorDetails: {
          originalMessage: message,
          error: error instanceof Error ? error.message : String(error)
        }
      };
      
      await this.onSystemErrorAlert(systemErrorAlert);
    }
  }

  async onLosscutAlert(data: LosscutAlert): Promise<void> {
    const alert: LosscutAlertData = {
      id: this.generateAlertId(),
      type: 'losscut',
      severity: this.determineLosscutSeverity(data),
      timestamp: new Date(),
      accountId: 'unknown', // Will be provided by message context
      message: this.createLosscutMessage(data),
      positionId: data.affectedPositions[0] || 'unknown',
      symbol: 'unknown', // Will be determined from position data
      closedPrice: 0, // Will be determined from position data
      loss: data.estimatedLoss,
      marginLevel: data.marginLevel
    };

    await this.processAndNotifyAlert(alert);
  }

  async onMarginCallAlert(data: MarginCallAlert): Promise<void> {
    await this.processAndNotifyAlert(data);
  }

  async onSystemErrorAlert(data: SystemErrorAlert): Promise<void> {
    await this.processAndNotifyAlert(data);
  }

  async onTradeErrorAlert(data: TradeErrorAlert): Promise<void> {
    await this.processAndNotifyAlert(data);
  }

  async onConnectionErrorAlert(data: ConnectionErrorAlert): Promise<void> {
    await this.processAndNotifyAlert(data);
  }

  async onDataErrorAlert(data: DataErrorAlert): Promise<void> {
    await this.processAndNotifyAlert(data);
  }

  private async processAndNotifyAlert(alertData: AlertData): Promise<void> {
    try {
      // Check for duplicate alerts
      if (await this.isDuplicateAlert(alertData)) {
        console.debug('Duplicate alert ignored:', alertData.id);
        return;
      }

      // Process alert through alert manager
      const processedAlert = await this.alertManager.processAlert(alertData);

      // Add to cache for duplicate detection
      this.alertCache.set(this.generateCacheKey(alertData), processedAlert);

      // Save to history
      await this.alertHistory.saveAlert(processedAlert);

      // Send notifications
      await this.sendNotifications(processedAlert);

      // Update UI (emit event for components to listen)
      this.emitAlertEvent('alert_received', processedAlert);

      console.info(`Alert processed: ${processedAlert.type} - ${processedAlert.severity}`, {
        id: processedAlert.id,
        accountId: processedAlert.accountId,
        message: processedAlert.message
      });

    } catch (error) {
      console.error('Error in processAndNotifyAlert:', error, alertData);
    }
  }

  private async isDuplicateAlert(alert: AlertData): Promise<boolean> {
    const cacheKey = this.generateCacheKey(alert);
    const existingAlert = this.alertCache.get(cacheKey);
    
    if (!existingAlert) {
      return false;
    }

    // Check if the existing alert is within the duplicate threshold
    const timeDiff = Date.now() - existingAlert.timestamp.getTime();
    return timeDiff < this.duplicateThreshold;
  }

  private generateCacheKey(alert: AlertData): string {
    // Generate a key that identifies similar alerts
    return `${alert.accountId}:${alert.type}:${alert.message.substring(0, 50)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineLosscutSeverity(data: LosscutAlert): BaseAlert['severity'] {
    switch (data.alertType) {
      case 'critical':
      case 'executed':
        return 'critical';
      case 'warning':
        return 'warning';
      default:
        return 'error';
    }
  }

  private createLosscutMessage(data: LosscutAlert): string {
    switch (data.alertType) {
      case 'warning':
        return `Margin level warning: ${data.marginLevel.toFixed(2)}%`;
      case 'critical':
        return `Critical margin level: ${data.marginLevel.toFixed(2)}% - Losscut imminent`;
      case 'executed':
        return `Losscut executed - Estimated loss: ${data.estimatedLoss}`;
      default:
        return data.message || 'Losscut alert received';
    }
  }

  private async sendNotifications(alert: ProcessedAlert): Promise<void> {
    try {
      // Send desktop notification
      await this.notificationManager.sendDesktopNotification(alert);

      // Play sound alert based on severity
      await this.notificationManager.playSoundAlert(alert);

      // Send additional notifications based on alert actions
      for (const action of alert.actions) {
        switch (action.type) {
          case 'email':
            await this.notificationManager.sendEmailNotification(alert);
            break;
          case 'webhook':
            await this.notificationManager.sendWebhookNotification(alert);
            break;
          case 'emergency_stop':
            this.emitAlertEvent('emergency_stop_requested', alert);
            break;
        }
      }
    } catch (error) {
      console.error('Error sending notifications for alert:', alert.id, error);
    }
  }

  private cleanExpiredAlertsFromCache(): void {
    const now = Date.now();
    for (const [key, alert] of Array.from(this.alertCache.entries())) {
      const age = now - alert.timestamp.getTime();
      if (age > this.duplicateThreshold * 2) { // Keep for 2x duplicate threshold
        this.alertCache.delete(key);
      }
    }
  }

  private emitAlertEvent(eventType: string, data: any): void {
    // Emit custom event for UI components to listen
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`alert:${eventType}`, { detail: data }));
    }
  }

  // Public methods for external access
  public getAlertCache(): Map<string, ProcessedAlert> {
    return new Map(this.alertCache);
  }

  public clearAlertCache(): void {
    this.alertCache.clear();
  }

  public setDuplicateThreshold(milliseconds: number): void {
    this.duplicateThreshold = milliseconds;
  }
}