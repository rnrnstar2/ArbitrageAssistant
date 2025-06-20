import { ProcessedAlert, NotificationManager as INotificationManager } from './alert-receiver';

export interface NotificationConfig {
  enableDesktop: boolean;
  enableSound: boolean;
  enableEmail: boolean;
  enableWebhook: boolean;
  soundVolume: number; // 0-100
  persistentCritical: boolean;
  emailConfig?: EmailConfig;
  webhookConfig?: WebhookConfig;
}

export interface EmailConfig {
  smtpServer: string;
  smtpPort: number;
  username: string;
  password: string;
  fromAddress: string;
  toAddresses: string[];
}

export interface WebhookConfig {
  urls: string[];
  timeout: number;
  retryAttempts: number;
  headers?: Record<string, string>;
}

export interface NotificationResult {
  success: boolean;
  method: string;
  error?: string;
  timestamp: Date;
}

export class NotificationManager implements INotificationManager {
  private config: NotificationConfig;
  private notificationQueue: ProcessedAlert[] = [];
  private isProcessingQueue = false;

  constructor(config?: Partial<NotificationConfig>) {
    this.config = {
      enableDesktop: true,
      enableSound: true,
      enableEmail: false,
      enableWebhook: false,
      soundVolume: 80,
      persistentCritical: true,
      ...config
    };
  }

  async sendDesktopNotification(alert: ProcessedAlert): Promise<void> {
    if (!this.config.enableDesktop) {
      return;
    }

    try {
      await this.execOSScript({
        title: 'ArbitrageAssistant Alert',
        subtitle: this.formatAlertSubtitle(alert),
        message: this.formatAlertMessage(alert),
        sound: this.getSoundForSeverity(alert.severity)
      });

      console.log(`Desktop notification sent for alert: ${alert.id}`);
    } catch (error) {
      console.error('Failed to send desktop notification:', error);
      throw error;
    }
  }

  async playSoundAlert(alert: ProcessedAlert): Promise<void> {
    if (!this.config.enableSound) {
      return;
    }

    try {
      const soundName = this.getSoundForSeverity(alert.severity);
      
      // Use osascript to play system sound
      await this.execCommand(`osascript -e 'beep'`);
      
      // For more sophisticated sound control, we could use:
      // await this.execCommand(`afplay /System/Library/Sounds/${soundName}.aiff`);
      
      console.log(`Sound alert played for alert: ${alert.id} (${soundName})`);
    } catch (error) {
      console.error('Failed to play sound alert:', error);
      throw error;
    }
  }

  async sendEmailNotification(alert: ProcessedAlert): Promise<void> {
    if (!this.config.enableEmail || !this.config.emailConfig) {
      return;
    }

    try {
      const emailData = {
        to: this.config.emailConfig.toAddresses,
        subject: `ArbitrageAssistant Alert: ${alert.type} - ${alert.severity}`,
        body: this.formatEmailBody(alert),
        priority: alert.severity === 'critical' ? 'high' : 'normal'
      };

      // Note: In a real implementation, you would use a proper email service
      // For now, we'll log the email that would be sent
      console.log('Email notification prepared:', emailData);
      
      // TODO: Implement actual email sending using nodemailer or similar
      // await this.sendEmail(emailData);
      
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw error;
    }
  }

  async sendWebhookNotification(alert: ProcessedAlert): Promise<void> {
    if (!this.config.enableWebhook || !this.config.webhookConfig) {
      return;
    }

    const webhookPayload = {
      alert: {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        accountId: alert.accountId,
        timestamp: alert.timestamp,
        priority: alert.priority,
        category: alert.category.name
      },
      timestamp: new Date(),
      source: 'ArbitrageAssistant'
    };

    for (const url of this.config.webhookConfig.urls) {
      try {
        await this.sendWebhookRequest(url, webhookPayload);
        console.log(`Webhook notification sent to: ${url}`);
      } catch (error) {
        console.error(`Failed to send webhook to ${url}:`, error);
      }
    }
  }

  private async execOSScript(params: {
    title: string;
    subtitle: string;
    message: string;
    sound: string;
  }): Promise<void> {
    const script = `display notification "${params.message}" with title "${params.title}" subtitle "${params.subtitle}" sound name "${params.sound}"`;
    
    try {
      await this.execCommand(`osascript -e '${script}'`);
    } catch (error) {
      // Fallback: try without sound if it fails
      const fallbackScript = `display notification "${params.message}" with title "${params.title}" subtitle "${params.subtitle}"`;
      await this.execCommand(`osascript -e '${fallbackScript}'`);
    }
  }

  private async execCommand(command: string): Promise<string> {
    // In Tauri environment, try to use the Tauri API
    if (typeof window !== 'undefined' && (window as any).__TAURI_INVOKE__) {
      try {
        // Try to import Tauri shell API - may not be available in all environments
        let tauriShell = null;
        try {
          // @ts-ignore - Tauri API may not be available in all environments
          tauriShell = await import('@tauri-apps/api/shell');
        } catch {
          // Tauri API not available
          tauriShell = null;
        }
        
        if (tauriShell?.Command) {
          const result = await tauriShell.Command.create('bash', ['-c', command]).execute();
          
          if (result.code !== 0) {
            throw new Error(`Command failed with code ${result.code}: ${result.stderr}`);
          }
          
          return result.stdout;
        } else {
          throw new Error('Tauri shell API not available');
        }
      } catch (error) {
        console.warn('Tauri command execution failed, using fallback:', error);
        // Fallback: just log the command that would be executed
        console.log('Would execute command:', command);
        return '';
      }
    } else if (typeof process !== 'undefined' && process.versions?.node) {
      // Server-side execution (Node.js)
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        const result = await execAsync(command);
        return result.stdout;
      } catch (error) {
        console.error('Node.js command execution failed:', error);
        return '';
      }
    } else {
      // Browser environment - cannot execute shell commands
      console.log('Browser environment - would execute command:', command);
      return '';
    }
  }

  private async sendWebhookRequest(url: string, payload: any): Promise<void> {
    const config = this.config.webhookConfig!;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeout || 5000)
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }
  }

  private getSoundForSeverity(severity: string): string {
    switch (severity) {
      case 'critical': return 'Basso';
      case 'error': return 'Sosumi';
      case 'warning': return 'Purr';
      default: return 'Glass';
    }
  }

  private formatAlertSubtitle(alert: ProcessedAlert): string {
    return `${alert.type.replace('_', ' ').toUpperCase()} - ${alert.severity.toUpperCase()}`;
  }

  private formatAlertMessage(alert: ProcessedAlert): string {
    const maxLength = 100; // macOS notification character limit
    let message = alert.message;
    
    if (message.length > maxLength) {
      message = message.substring(0, maxLength - 3) + '...';
    }
    
    return message;
  }

  private formatEmailBody(alert: ProcessedAlert): string {
    return `
ArbitrageAssistant Alert Report

Alert Details:
- ID: ${alert.id}
- Type: ${alert.type}
- Severity: ${alert.severity}
- Account: ${alert.accountId}
- Priority: ${alert.priority}/100
- Category: ${alert.category.name}
- Timestamp: ${alert.timestamp.toISOString()}

Message:
${alert.message}

Additional Data:
${alert.data ? JSON.stringify(alert.data, null, 2) : 'None'}

Actions Applied:
${alert.actions.map(action => `- ${action.type}: ${JSON.stringify(action.config)}`).join('\n')}

---
This alert was generated by ArbitrageAssistant EA monitoring system.
    `.trim();
  }

  // Queue management for high-frequency notifications
  public queueNotification(alert: ProcessedAlert): void {
    this.notificationQueue.push(alert);
    
    if (!this.isProcessingQueue) {
      this.processNotificationQueue();
    }
  }

  private async processNotificationQueue(): Promise<void> {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.notificationQueue.length > 0) {
        const alert = this.notificationQueue.shift()!;
        
        try {
          // Send all configured notifications for this alert
          const promises: Promise<void>[] = [];
          
          promises.push(this.sendDesktopNotification(alert));
          promises.push(this.playSoundAlert(alert));
          
          if (this.config.enableEmail) {
            promises.push(this.sendEmailNotification(alert));
          }
          
          if (this.config.enableWebhook) {
            promises.push(this.sendWebhookNotification(alert));
          }
          
          await Promise.allSettled(promises);
          
          // Add delay between notifications to prevent spam
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error('Error processing notification:', error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Configuration management
  public updateConfiguration(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfiguration(): NotificationConfig {
    return { ...this.config };
  }

  public testNotification(severity: ProcessedAlert['severity'] = 'info'): Promise<void> {
    const testAlert: ProcessedAlert = {
      id: `test_${Date.now()}`,
      type: 'system_error',
      severity,
      timestamp: new Date(),
      accountId: 'test_account',
      message: 'This is a test notification',
      category: {
        name: 'Test',
        level: 1,
        autoActions: ['notify']
      },
      priority: 50,
      rules: [],
      actions: [{ type: 'notify', config: {} }]
    };

    return this.sendDesktopNotification(testAlert);
  }

  public async testAllNotificationMethods(): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const testAlert: ProcessedAlert = {
      id: `test_all_${Date.now()}`,
      type: 'system_error',
      severity: 'warning',
      timestamp: new Date(),
      accountId: 'test_account',
      message: 'Testing all notification methods',
      category: {
        name: 'Test',
        level: 1,
        autoActions: ['notify']
      },
      priority: 50,
      rules: [],
      actions: [{ type: 'notify', config: {} }]
    };

    // Test desktop notification
    try {
      await this.sendDesktopNotification(testAlert);
      results.push({
        success: true,
        method: 'desktop',
        timestamp: new Date()
      });
    } catch (error) {
      results.push({
        success: false,
        method: 'desktop',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
    }

    // Test sound alert
    try {
      await this.playSoundAlert(testAlert);
      results.push({
        success: true,
        method: 'sound',
        timestamp: new Date()
      });
    } catch (error) {
      results.push({
        success: false,
        method: 'sound',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
    }

    return results;
  }
}