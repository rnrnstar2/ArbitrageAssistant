import { AlertCondition, RiskAlertState, AlertHistory, AlertStats, AlertSuppression } from './types';
import { Account } from '../../dashboard/types';

export class RiskAlertManager {
  private conditions: Map<string, AlertCondition> = new Map();
  private activeAlerts: Map<string, RiskAlertState> = new Map();
  private alertHistory: AlertHistory = {
    alerts: [],
    lastCleanup: new Date(),
    retentionDays: 30
  };
  private suppressions: Map<string, AlertSuppression> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.initializeDefaultConditions();
    this.startCleanupScheduler();
  }

  // デフォルトアラート条件の初期化
  private initializeDefaultConditions(): void {
    const defaultConditions: Omit<AlertCondition, 'id'>[] = [
      {
        type: 'margin_level',
        threshold: 80,
        severity: 'info',
        cooldownPeriod: 300, // 5分
        isActive: true,
        comparison: 'less_than'
      },
      {
        type: 'margin_level',
        threshold: 50,
        severity: 'warning',
        cooldownPeriod: 180, // 3分
        isActive: true,
        comparison: 'less_than'
      },
      {
        type: 'margin_level',
        threshold: 30,
        severity: 'danger',
        cooldownPeriod: 60, // 1分
        isActive: true,
        comparison: 'less_than'
      },
      {
        type: 'margin_level',
        threshold: 20,
        severity: 'critical',
        cooldownPeriod: 30, // 30秒
        isActive: true,
        comparison: 'less_than'
      },
      {
        type: 'free_margin',
        threshold: 100, // $100
        severity: 'warning',
        cooldownPeriod: 300,
        isActive: true,
        comparison: 'less_than'
      },
      {
        type: 'floating_loss',
        threshold: 1000, // $1000
        severity: 'danger',
        cooldownPeriod: 180,
        isActive: true,
        comparison: 'less_than'
      }
    ];

    defaultConditions.forEach((condition, index) => {
      const id = `default-${condition.type}-${index}`;
      this.conditions.set(id, { ...condition, id });
    });
  }

  // アカウントデータの監視とアラート判定
  public monitorAccount(account: Account): RiskAlertState[] {
    const triggeredAlerts: RiskAlertState[] = [];

    for (const [conditionId, condition] of Array.from(this.conditions.entries())) {
      if (!condition.isActive) continue;
      if (condition.accountId && condition.accountId !== account.id) continue;

      const alert = this.evaluateCondition(account, condition);
      if (alert && this.shouldTriggerAlert(alert)) {
        const suppression = this.createSuppression(alert);
        this.suppressions.set(alert.id, suppression);
        
        this.activeAlerts.set(alert.id, alert);
        this.alertHistory.alerts.push(alert);
        triggeredAlerts.push(alert);

        this.emitEvent('alert:triggered', alert);
      }
    }

    return triggeredAlerts;
  }

  // 条件評価
  private evaluateCondition(account: Account, condition: AlertCondition): RiskAlertState | null {
    let value: number;
    let message: string;

    switch (condition.type) {
      case 'margin_level':
        value = account.marginLevel;
        message = `証拠金維持率: ${value.toFixed(1)}%`;
        break;
      
      case 'free_margin':
        value = account.equity - account.margin;
        message = `フリーマージン: $${value.toFixed(2)}`;
        break;
      
      case 'floating_loss':
        value = account.positions.reduce((sum, pos) => sum + Math.min(0, pos.profit), 0);
        message = `含み損: $${Math.abs(value).toFixed(2)}`;
        break;
      
      case 'profit_target':
        value = account.positions.reduce((sum, pos) => sum + Math.max(0, pos.profit), 0);
        message = `含み益: $${value.toFixed(2)}`;
        break;
      
      default:
        return null;
    }

    // 条件判定
    const isTriggered = this.checkCondition(value, condition.threshold, condition.comparison);
    
    if (!isTriggered) return null;

    return {
      id: `alert-${account.id}-${condition.id}-${Date.now()}`,
      conditionId: condition.id,
      accountId: account.id,
      type: condition.type,
      severity: condition.severity,
      message,
      value,
      threshold: condition.threshold,
      timestamp: new Date(),
      isAcknowledged: false,
      isSuppressed: false,
      metadata: {
        accountNumber: account.accountNumber,
        broker: account.broker,
        balance: account.balance,
        equity: account.equity
      }
    };
  }

  // 条件チェック
  private checkCondition(value: number, threshold: number, comparison: string): boolean {
    switch (comparison) {
      case 'less_than':
        return value < threshold;
      case 'greater_than':
        return value > threshold;
      case 'equals':
        return Math.abs(value - threshold) < 0.01;
      default:
        return false;
    }
  }

  // アラート発火判定（誤発報防止）
  private shouldTriggerAlert(alert: RiskAlertState): boolean {
    // 既存の抑制チェック
    const existingSuppression = Array.from(this.suppressions.values())
      .find(s => 
        s.alertId.includes(alert.accountId) && 
        s.alertId.includes(alert.conditionId) &&
        s.suppressUntil > new Date()
      );

    if (existingSuppression) {
      existingSuppression.count++;
      return false;
    }

    // 振動防止（短時間で同種のアラートが多発する場合）
    const recentAlerts = this.alertHistory.alerts
      .filter(a => 
        a.accountId === alert.accountId &&
        a.type === alert.type &&
        (Date.now() - a.timestamp.getTime()) < 60000 // 1分以内
      );

    if (recentAlerts.length >= 3) {
      // 振動と判定し、5分間抑制
      const suppression: AlertSuppression = {
        alertId: alert.id,
        suppressUntil: new Date(Date.now() + 300000), // 5分
        reason: 'oscillation',
        count: 1
      };
      this.suppressions.set(alert.id, suppression);
      return false;
    }

    return true;
  }

  // 抑制情報作成
  private createSuppression(alert: RiskAlertState): AlertSuppression {
    const condition = this.conditions.get(alert.conditionId);
    const cooldownMs = (condition?.cooldownPeriod || 60) * 1000;

    return {
      alertId: alert.id,
      suppressUntil: new Date(Date.now() + cooldownMs),
      reason: 'cooldown',
      count: 1
    };
  }

  // アラート確認
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.isAcknowledged = true;
    this.emitEvent('alert:acknowledged', alert);
    return true;
  }

  // アラート抑制
  public suppressAlert(alertId: string, durationMinutes: number, reason: string = 'manual'): boolean {
    const suppression: AlertSuppression = {
      alertId,
      suppressUntil: new Date(Date.now() + durationMinutes * 60000),
      reason: reason as any,
      count: 1
    };

    this.suppressions.set(alertId, suppression);
    
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.isSuppressed = true;
      this.emitEvent('alert:suppressed', alert);
    }

    return true;
  }

  // 条件管理
  public addCondition(condition: Omit<AlertCondition, 'id'>): string {
    const id = `condition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.conditions.set(id, { ...condition, id });
    this.emitEvent('condition:added', { id, condition });
    return id;
  }

  public updateCondition(id: string, updates: Partial<AlertCondition>): boolean {
    const condition = this.conditions.get(id);
    if (!condition) return false;

    const updated = { ...condition, ...updates };
    this.conditions.set(id, updated);
    this.emitEvent('condition:updated', updated);
    return true;
  }

  public removeCondition(id: string): boolean {
    const removed = this.conditions.delete(id);
    if (removed) {
      this.emitEvent('condition:removed', { id });
    }
    return removed;
  }

  // ゲッター
  public getActiveAlerts(): RiskAlertState[] {
    return Array.from(this.activeAlerts.values());
  }

  public getConditions(): AlertCondition[] {
    return Array.from(this.conditions.values());
  }

  public getAlertHistory(accountId?: string): RiskAlertState[] {
    if (accountId) {
      return this.alertHistory.alerts.filter(a => a.accountId === accountId);
    }
    return [...this.alertHistory.alerts];
  }

  public getStats(): AlertStats {
    const alerts = this.alertHistory.alerts;
    const stats: AlertStats = {
      totalAlerts: alerts.length,
      alertsBySeverity: {
        info: 0,
        warning: 0,
        danger: 0,
        critical: 0
      },
      alertsByType: {
        margin_level: 0,
        free_margin: 0,
        floating_loss: 0,
        profit_target: 0
      },
      suppressedAlerts: Array.from(this.suppressions.values()).length,
      acknowledgedAlerts: alerts.filter(a => a.isAcknowledged).length
    };

    alerts.forEach(alert => {
      stats.alertsBySeverity[alert.severity]++;
      stats.alertsByType[alert.type]++;
    });

    if (alerts.length > 0) {
      stats.lastAlertTime = new Date(Math.max(...alerts.map(a => a.timestamp.getTime())));
    }

    return stats;
  }

  // イベント管理
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  // クリーンアップ
  private startCleanupScheduler(): void {
    const cleanup = () => {
      const now = new Date();
      const retentionMs = this.alertHistory.retentionDays * 24 * 60 * 60 * 1000;

      // 古いアラート履歴の削除
      this.alertHistory.alerts = this.alertHistory.alerts.filter(
        alert => (now.getTime() - alert.timestamp.getTime()) < retentionMs
      );

      // 期限切れの抑制を削除
      for (const [id, suppression] of Array.from(this.suppressions.entries())) {
        if (suppression.suppressUntil <= now) {
          this.suppressions.delete(id);
        }
      }

      // 確認済みの古いアクティブアラートを削除
      for (const [id, alert] of Array.from(this.activeAlerts.entries())) {
        if (alert.isAcknowledged && (now.getTime() - alert.timestamp.getTime()) > 3600000) { // 1時間
          this.activeAlerts.delete(id);
        }
      }

      this.alertHistory.lastCleanup = now;
    };

    // 1時間ごとにクリーンアップ実行
    setInterval(cleanup, 3600000);
    
    // 初回実行
    cleanup();
  }

  // リセット・デバッグ用
  public clearAllAlerts(): void {
    this.activeAlerts.clear();
    this.suppressions.clear();
    this.emitEvent('alerts:cleared', {});
  }

  public exportSettings(): string {
    return JSON.stringify({
      conditions: Array.from(this.conditions.entries()),
      history: this.alertHistory,
      suppressions: Array.from(this.suppressions.entries())
    }, null, 2);
  }

  public importSettings(settingsJson: string): boolean {
    try {
      const settings = JSON.parse(settingsJson);
      
      if (settings.conditions) {
        this.conditions = new Map(settings.conditions);
      }
      
      if (settings.suppressions) {
        this.suppressions = new Map(settings.suppressions);
      }

      this.emitEvent('settings:imported', settings);
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }
}