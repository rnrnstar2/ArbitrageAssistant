/**
 * トレール通知システム - 管理クラス
 */

import { 
  TrailNotification, 
  TrailNotificationData, 
  TrailNotificationSettings, 
  TrailNotificationType,
  TrailSoundType,
  TRAIL_NOTIFICATION_TEMPLATES,
  DEFAULT_TRAIL_NOTIFICATION_SETTINGS
} from './trail-notification-types';

export class TrailNotificationManager {
  private settings: TrailNotificationSettings;
  private notifications: TrailNotification[] = [];
  private subscribers: Array<(notification: TrailNotification) => void> = [];

  constructor(settings?: Partial<TrailNotificationSettings>) {
    this.settings = { ...DEFAULT_TRAIL_NOTIFICATION_SETTINGS, ...settings };
    this.loadSettings();
  }

  /**
   * 設定の保存・読み込み
   */
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('trail-notification-settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Failed to load trail notification settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('trail-notification-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save trail notification settings:', error);
    }
  }

  /**
   * 通知の作成・送信
   */
  public async notify(
    type: TrailNotificationType, 
    data: TrailNotificationData, 
    customMessage?: string
  ): Promise<void> {
    if (!this.settings.enabled || !this.settings.levels[type]) {
      return;
    }

    const template = TRAIL_NOTIFICATION_TEMPLATES[type];
    const notification = this.createNotification(type, data, template, customMessage);
    
    // 通知履歴に追加
    this.notifications.unshift(notification);
    this.cleanupNotifications();

    // 購読者に通知
    this.subscribers.forEach(callback => callback(notification));

    // 各種通知方法で送信
    await this.sendNotifications(notification);
  }

  private createNotification(
    type: TrailNotificationType,
    data: TrailNotificationData,
    template: typeof TRAIL_NOTIFICATION_TEMPLATES[TrailNotificationType],
    customMessage?: string
  ): TrailNotification {
    const title = this.formatMessage(template.titleTemplate, data);
    const message = customMessage || this.formatMessage(template.messageTemplate, data);

    return {
      id: `trail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: template.severity,
      title,
      message,
      data,
      timestamp: new Date(),
      acknowledged: false,
      autoClose: template.autoClose && this.settings.autoClose,
      soundType: this.settings.sounds[type] || template.soundType
    };
  }

  private formatMessage(template: string, data: TrailNotificationData): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = (data as any)[key];
      if (value === undefined || value === null) return match;
      
      // 数値のフォーマット
      if (typeof value === 'number') {
        if (key.includes('price') || key === 'profit') {
          return value.toFixed(2);
        }
        return value.toString();
      }
      
      return String(value);
    });
  }

  /**
   * 各種通知方法での送信
   */
  private async sendNotifications(notification: TrailNotification): Promise<void> {
    const promises: Promise<void>[] = [];

    // デスクトップ通知
    if (this.settings.showDesktopNotifications && 'Notification' in window) {
      promises.push(this.sendDesktopNotification(notification));
    }

    // macOS通知 (osascript)
    if (this.settings.enableMacOSNotifications) {
      promises.push(this.sendMacOSNotification(notification));
    }

    // 音声通知
    if (this.settings.enableSounds) {
      promises.push(this.playNotificationSound(notification));
    }

    await Promise.allSettled(promises);

    // 自動クローズ
    if (notification.autoClose) {
      setTimeout(() => {
        this.acknowledgeNotification(notification.id);
      }, this.settings.autoCloseDelay * 1000);
    }
  }

  private async sendDesktopNotification(notification: TrailNotification): Promise<void> {
    try {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
      }

      const desktopNotification = new Notification(notification.title, {
        body: notification.message,
        icon: this.getNotificationIcon(notification.severity),
        tag: notification.id,
        requireInteraction: !notification.autoClose
      });

      desktopNotification.onclick = () => {
        this.acknowledgeNotification(notification.id);
        desktopNotification.close();
      };

      if (notification.autoClose) {
        setTimeout(() => {
          desktopNotification.close();
        }, this.settings.autoCloseDelay * 1000);
      }
    } catch (error) {
      console.error('Failed to send desktop notification:', error);
    }
  }

  private async sendMacOSNotification(notification: TrailNotification): Promise<void> {
    if (typeof window === 'undefined' || !(window as any).__TAURI_INVOKE__) {
      return;
    }

    try {
      // Tauri shell APIを使用してosascriptを実行
      const { Command } = await import('@tauri-apps/api/shell');
      
      const soundName = this.mapSoundTypeToMacOS(notification.soundType || 'glass');
      const script = `display notification "${this.escapeForOSScript(notification.message)}" with title "${this.escapeForOSScript(notification.title)}" subtitle "トレール通知" sound name "${soundName}"`;
      
      await Command.create('osascript', ['-e', script]).execute();
    } catch (error) {
      console.error('Failed to send macOS notification:', error);
    }
  }

  private async playNotificationSound(notification: TrailNotification): Promise<void> {
    if (typeof window === 'undefined' || !(window as any).__TAURI_INVOKE__) {
      // ブラウザ環境ではHTML5 Audioを使用
      try {
        const audio = new Audio(`/sounds/${notification.soundType || 'glass'}.mp3`);
        await audio.play();
      } catch (error) {
        console.warn('Failed to play browser sound:', error);
      }
      return;
    }

    try {
      // Tauri環境ではシステムサウンドを再生
      const { Command } = await import('@tauri-apps/api/shell');
      const soundName = this.mapSoundTypeToMacOS(notification.soundType || 'glass');
      
      await Command.create('osascript', ['-e', `beep`]).execute();
      // より詳細な音の制御が必要な場合:
      // await Command.create('afplay', [`/System/Library/Sounds/${soundName}.aiff`]).execute();
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }

  /**
   * ユーティリティメソッド
   */
  private getNotificationIcon(severity: TrailNotification['severity']): string {
    const iconMap = {
      info: '/icons/info.png',
      success: '/icons/success.png',
      warning: '/icons/warning.png',
      error: '/icons/error.png',
      critical: '/icons/critical.png'
    };
    return iconMap[severity] || iconMap.info;
  }

  private mapSoundTypeToMacOS(soundType: TrailSoundType): string {
    const soundMap: Record<TrailSoundType, string> = {
      glass: 'Glass',
      basso: 'Basso',
      purr: 'Purr',
      sosumi: 'Sosumi',
      ping: 'Ping',
      funk: 'Funk',
      hero: 'Hero',
      tink: 'Tink'
    };
    return soundMap[soundType] || 'Glass';
  }

  private escapeForOSScript(text: string): string {
    return text.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
  }

  /**
   * 通知履歴管理
   */
  private cleanupNotifications(): void {
    const maxNotifications = 100;
    const maxAge = 24 * 60 * 60 * 1000; // 24時間
    const cutoffTime = Date.now() - maxAge;

    this.notifications = this.notifications
      .filter(n => n.timestamp.getTime() > cutoffTime)
      .slice(0, maxNotifications);
  }

  /**
   * 公開API
   */
  public getNotifications(): TrailNotification[] {
    return [...this.notifications];
  }

  public getUnacknowledgedNotifications(): TrailNotification[] {
    return this.notifications.filter(n => !n.acknowledged);
  }

  public acknowledgeNotification(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.acknowledged = true;
    }
  }

  public clearNotifications(): void {
    this.notifications = [];
  }

  public updateSettings(newSettings: Partial<TrailNotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  public getSettings(): TrailNotificationSettings {
    return { ...this.settings };
  }

  public subscribe(callback: (notification: TrailNotification) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * 便利メソッド - 各種通知の送信
   */
  public async notifyTrailStarted(data: TrailNotificationData): Promise<void> {
    await this.notify('trail_started', data);
  }

  public async notifyTrailUpdated(data: TrailNotificationData): Promise<void> {
    await this.notify('trail_updated', data);
  }

  public async notifyTrailStopped(data: TrailNotificationData): Promise<void> {
    await this.notify('trail_stopped', data);
  }

  public async notifyTrailExecuted(data: TrailNotificationData): Promise<void> {
    await this.notify('trail_executed', data);
  }

  public async notifyTrailError(data: TrailNotificationData, error: string): Promise<void> {
    await this.notify('trail_error', { ...data, error });
  }

  public async notifyTrailWarning(data: TrailNotificationData, warning: string): Promise<void> {
    await this.notify('trail_warning', { ...data, error: warning });
  }

  public async notifyPriceThreshold(data: TrailNotificationData): Promise<void> {
    await this.notify('price_threshold', data);
  }

  public async notifyConnectionLost(data: TrailNotificationData): Promise<void> {
    await this.notify('connection_lost', data);
  }

  public async notifyMaxProfitUpdated(data: TrailNotificationData): Promise<void> {
    await this.notify('max_profit_updated', data);
  }

  /**
   * テスト用メソッド
   */
  public async testNotification(type?: TrailNotificationType): Promise<void> {
    const testType = type || 'trail_started';
    const testData: TrailNotificationData = {
      positionId: 'TEST_POS_001',
      symbol: 'USDJPY',
      accountId: 'TEST_ACCOUNT',
      trailId: 'TEST_TRAIL_001',
      currentPrice: 110.50,
      stopLossPrice: 110.00,
      profit: 500.00,
      trailType: 'fixed' as const,
      trailAmount: 50,
      timestamp: new Date()
    };

    await this.notify(testType, testData, 'これはテスト通知です。');
  }
}

// シングルトンインスタンス
let instance: TrailNotificationManager | null = null;

export function getTrailNotificationManager(): TrailNotificationManager {
  if (!instance) {
    instance = new TrailNotificationManager();
  }
  return instance;
}

export function createTrailNotificationManager(settings?: Partial<TrailNotificationSettings>): TrailNotificationManager {
  return new TrailNotificationManager(settings);
}