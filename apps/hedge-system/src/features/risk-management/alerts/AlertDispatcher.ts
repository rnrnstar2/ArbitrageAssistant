import { RiskAlertState, AlertChannel, AlertDispatchConfig } from './types';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
}

interface SoundConfig {
  frequency: number;
  duration: number;
  pattern: 'single' | 'double' | 'triple' | 'continuous';
  volume: number;
}

export class AlertDispatcher {
  private config: AlertDispatchConfig;
  private audioContext: AudioContext | null = null;
  private permissionGranted: boolean = false;
  private emailEndpoint: string = '/api/notifications/email';

  constructor(config?: Partial<AlertDispatchConfig>) {
    this.config = {
      channels: [
        { type: 'desktop', enabled: true },
        { type: 'sound', enabled: true },
        { type: 'email', enabled: false }
      ],
      priorityThresholds: {
        info: ['desktop'],
        warning: ['desktop', 'sound'],
        danger: ['desktop', 'sound', 'email'],
        critical: ['desktop', 'sound', 'email']
      },
      globalMute: false,
      testMode: false,
      ...config
    };

    this.initializeNotifications();
    this.initializeAudio();
  }

  // 通知権限の初期化
  private async initializeNotifications(): Promise<void> {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        this.permissionGranted = true;
      } else if (Notification.permission !== 'denied') {
        try {
          const permission = await Notification.requestPermission();
          this.permissionGranted = permission === 'granted';
        } catch (error) {
          console.warn('Failed to request notification permission:', error);
        }
      }
    }
  }

  // オーディオコンテキストの初期化
  private initializeAudio(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('AudioContext initialization failed:', error);
    }
  }

  // メインディスパッチメソッド
  public async dispatch(alert: RiskAlertState): Promise<boolean[]> {
    if (this.config.globalMute && !this.config.testMode) {
      console.log('Alert dispatch suppressed due to global mute:', alert.id);
      return [];
    }

    const enabledChannels = this.getEnabledChannelsForSeverity(alert.severity);
    const results: boolean[] = [];

    for (const channelType of enabledChannels) {
      try {
        const success = await this.dispatchToChannel(alert, channelType);
        results.push(success);
        
        if (this.config.testMode) {
          console.log(`Test mode: ${channelType} dispatch ${success ? 'succeeded' : 'failed'} for alert ${alert.id}`);
        }
      } catch (error) {
        console.error(`Failed to dispatch alert ${alert.id} to ${channelType}:`, error);
        results.push(false);
      }
    }

    return results;
  }

  // 有効なチャンネルの取得
  private getEnabledChannelsForSeverity(severity: RiskAlertState['severity']): AlertChannel['type'][] {
    const channelTypes = this.config.priorityThresholds[severity] || [];
    return channelTypes.filter(type => {
      const channel = this.config.channels.find(c => c.type === type);
      return channel?.enabled;
    }) as AlertChannel['type'][];
  }

  // チャンネル別ディスパッチ
  private async dispatchToChannel(alert: RiskAlertState, channelType: AlertChannel['type']): Promise<boolean> {
    switch (channelType) {
      case 'desktop':
        return this.sendDesktopNotification(alert);
      
      case 'sound':
        return this.playAlertSound(alert);
      
      case 'email':
        return this.sendEmailNotification(alert);
      
      case 'webhook':
        return this.sendWebhookNotification(alert);
      
      default:
        console.warn(`Unknown channel type: ${channelType}`);
        return false;
    }
  }

  // デスクトップ通知
  private async sendDesktopNotification(alert: RiskAlertState): Promise<boolean> {
    if (!this.permissionGranted) {
      console.warn('Desktop notifications not permitted');
      return false;
    }

    return new Promise((resolve) => {
      const options: NotificationOptions = {
        title: `${this.getSeverityEmoji(alert.severity)} ${this.getSeverityLabel(alert.severity)}`,
        body: `${alert.message}\n口座: ${alert.metadata?.accountNumber || alert.accountId}`,
        icon: '/favicon.ico',
        requireInteraction: alert.severity === 'critical',
        silent: false,
        tag: `alert-${alert.accountId}-${alert.type}`
      };

      const notification = new Notification(options.title, options);

      notification.onclick = () => {
        window.focus();
        notification.close();
        // アラート詳細画面への遷移などを実装可能
      };

      notification.onshow = () => resolve(true);
      notification.onerror = () => resolve(false);

      // 自動閉じる設定
      const autoCloseDelay = this.getAutoCloseDelay(alert.severity);
      setTimeout(() => notification.close(), autoCloseDelay);
    });
  }

  // アラート音再生
  private async playAlertSound(alert: RiskAlertState): Promise<boolean> {
    if (!this.audioContext) return false;

    return new Promise((resolve) => {
      const soundConfig = this.getSoundConfig(alert.severity);
      
      try {
        this.playBeepPattern(soundConfig);
        resolve(true);
      } catch (error) {
        console.error('Failed to play alert sound:', error);
        resolve(false);
      }
    });
  }

  // ビープ音パターン再生
  private playBeepPattern(config: SoundConfig): void {
    if (!this.audioContext) return;

    const currentTime = this.audioContext.currentTime;
    let nextTime = currentTime;

    const playBeep = (frequency: number, startTime: number, duration: number) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      oscillator.frequency.setValueAtTime(frequency, startTime);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(config.volume, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration / 1000);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration / 1000);

      return startTime + duration / 1000;
    };

    switch (config.pattern) {
      case 'single':
        playBeep(config.frequency, nextTime, config.duration);
        break;

      case 'double':
        nextTime = playBeep(config.frequency, nextTime, config.duration / 3);
        nextTime = playBeep(config.frequency, nextTime + 0.1, config.duration / 3);
        break;

      case 'triple':
        nextTime = playBeep(config.frequency, nextTime, config.duration / 4);
        nextTime = playBeep(config.frequency, nextTime + 0.1, config.duration / 4);
        nextTime = playBeep(config.frequency, nextTime + 0.1, config.duration / 4);
        break;

      case 'continuous':
        for (let i = 0; i < 3; i++) {
          nextTime = playBeep(config.frequency, nextTime, 200);
          nextTime = playBeep(config.frequency * 0.8, nextTime + 0.05, 200);
          nextTime += 0.3;
        }
        break;
    }
  }

  // メール通知
  private async sendEmailNotification(alert: RiskAlertState): Promise<boolean> {
    try {
      const emailData = {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        accountId: alert.accountId,
        value: alert.value,
        threshold: alert.threshold,
        timestamp: alert.timestamp,
        metadata: alert.metadata
      };

      const response = await fetch(this.emailEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('Email notification sent for alert:', alert.id);
      return true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
      return false;
    }
  }

  // Webhook通知
  private async sendWebhookNotification(alert: RiskAlertState): Promise<boolean> {
    const webhookChannel = this.config.channels.find(c => c.type === 'webhook');
    if (!webhookChannel?.config?.url) {
      console.warn('Webhook URL not configured');
      return false;
    }

    try {
      const payload = {
        event: 'risk_alert',
        alert: {
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          accountId: alert.accountId,
          value: alert.value,
          threshold: alert.threshold,
          timestamp: alert.timestamp.toISOString()
        },
        metadata: alert.metadata
      };

      const response = await fetch(webhookChannel.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...webhookChannel.config.headers
        },
        body: JSON.stringify(payload)
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
      return false;
    }
  }

  // ヘルパーメソッド
  private getSeverityEmoji(severity: RiskAlertState['severity']): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'danger': return '⚠️';
      case 'warning': return '⚡';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  }

  private getSeverityLabel(severity: RiskAlertState['severity']): string {
    switch (severity) {
      case 'critical': return '緊急アラート';
      case 'danger': return '危険アラート';
      case 'warning': return '警告';
      case 'info': return '情報';
      default: return 'アラート';
    }
  }

  private getSoundConfig(severity: RiskAlertState['severity']): SoundConfig {
    switch (severity) {
      case 'critical':
        return { frequency: 800, duration: 2000, pattern: 'continuous', volume: 0.3 };
      case 'danger':
        return { frequency: 600, duration: 1000, pattern: 'triple', volume: 0.2 };
      case 'warning':
        return { frequency: 400, duration: 500, pattern: 'double', volume: 0.15 };
      case 'info':
        return { frequency: 300, duration: 300, pattern: 'single', volume: 0.1 };
      default:
        return { frequency: 300, duration: 300, pattern: 'single', volume: 0.1 };
    }
  }

  private getAutoCloseDelay(severity: RiskAlertState['severity']): number {
    switch (severity) {
      case 'critical': return 30000; // 30秒
      case 'danger': return 15000;   // 15秒
      case 'warning': return 10000;  // 10秒
      case 'info': return 5000;      // 5秒
      default: return 5000;
    }
  }

  // 設定管理
  public updateConfig(updates: Partial<AlertDispatchConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): AlertDispatchConfig {
    return { ...this.config };
  }

  public enableChannel(channelType: AlertChannel['type']): void {
    const channel = this.config.channels.find(c => c.type === channelType);
    if (channel) {
      channel.enabled = true;
    }
  }

  public disableChannel(channelType: AlertChannel['type']): void {
    const channel = this.config.channels.find(c => c.type === channelType);
    if (channel) {
      channel.enabled = false;
    }
  }

  public setGlobalMute(muted: boolean): void {
    this.config.globalMute = muted;
  }

  public setTestMode(testMode: boolean): void {
    this.config.testMode = testMode;
  }

  // テスト機能
  public async testAlert(severity: RiskAlertState['severity'] = 'warning'): Promise<boolean[]> {
    const testAlert: RiskAlertState = {
      id: `test-${Date.now()}`,
      conditionId: 'test-condition',
      accountId: 'test-account',
      type: 'margin_level',
      severity,
      message: `テスト${this.getSeverityLabel(severity)}です`,
      value: severity === 'critical' ? 15 : 
             severity === 'danger' ? 25 : 
             severity === 'warning' ? 45 : 75,
      threshold: severity === 'critical' ? 20 : 
                severity === 'danger' ? 30 : 
                severity === 'warning' ? 50 : 80,
      timestamp: new Date(),
      isAcknowledged: false,
      isSuppressed: false,
      metadata: {
        accountNumber: 'TEST001',
        broker: 'TestBroker'
      }
    };

    const originalTestMode = this.config.testMode;
    this.config.testMode = true;
    
    const results = await this.dispatch(testAlert);
    
    this.config.testMode = originalTestMode;
    return results;
  }

  // 統計情報
  public getDispatchStats(): { [channel: string]: { sent: number; failed: number } } {
    // 実装では、実際のディスパッチ統計を記録する必要があります
    // ここでは基本的な構造のみ提供
    return {
      desktop: { sent: 0, failed: 0 },
      sound: { sent: 0, failed: 0 },
      email: { sent: 0, failed: 0 },
      webhook: { sent: 0, failed: 0 }
    };
  }

  // リソースのクリーンアップ
  public dispose(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}