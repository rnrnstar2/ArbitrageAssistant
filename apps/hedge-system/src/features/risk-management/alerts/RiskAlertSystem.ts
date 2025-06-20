import { RiskAlertManager } from './RiskAlertManager';
import { AlertDispatcher } from './AlertDispatcher';
import { AlertCondition, RiskAlertState, AlertDispatchConfig, AlertStats } from './types';
import { Account } from '../../dashboard/types';

export interface RiskAlertSystemConfig {
  alertManagerConfig?: any;
  dispatcherConfig?: Partial<AlertDispatchConfig>;
  autoStart?: boolean;
  monitoringInterval?: number; // ミリ秒
}

export class RiskAlertSystem {
  private alertManager: RiskAlertManager;
  private dispatcher: AlertDispatcher;
  private isRunning: boolean = false;
  private monitoringInterval: number;
  private intervalId: NodeJS.Timeout | null = null;
  private monitoredAccounts: Map<string, Account> = new Map();

  constructor(config?: RiskAlertSystemConfig) {
    this.alertManager = new RiskAlertManager();
    this.dispatcher = new AlertDispatcher(config?.dispatcherConfig);
    this.monitoringInterval = config?.monitoringInterval || 5000; // 5秒

    // アラートマネージャーのイベントをリッスン
    this.setupEventListeners();

    if (config?.autoStart) {
      this.start();
    }
  }

  // イベントリスナーのセットアップ
  private setupEventListeners(): void {
    this.alertManager.on('alert:triggered', async (alert: RiskAlertState) => {
      try {
        const results = await this.dispatcher.dispatch(alert);
        const success = results.some(r => r);
        
        if (!success) {
          console.error('All alert dispatch channels failed for alert:', alert.id);
        }
      } catch (error) {
        console.error('Failed to dispatch alert:', error);
      }
    });

    this.alertManager.on('alert:acknowledged', (alert: RiskAlertState) => {
      console.log('Alert acknowledged:', alert.id);
    });

    this.alertManager.on('alert:suppressed', (alert: RiskAlertState) => {
      console.log('Alert suppressed:', alert.id);
    });
  }

  // システム開始
  public start(): void {
    if (this.isRunning) {
      console.warn('Risk Alert System is already running');
      return;
    }

    this.isRunning = true;
    
    // 監視ループ開始
    this.intervalId = setInterval(() => {
      this.monitorAllAccounts();
    }, this.monitoringInterval);

    console.log(`Risk Alert System started with ${this.monitoringInterval}ms interval`);
  }

  // システム停止
  public stop(): void {
    if (!this.isRunning) {
      console.warn('Risk Alert System is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('Risk Alert System stopped');
  }

  // 口座の監視登録
  public addAccount(account: Account): void {
    this.monitoredAccounts.set(account.id, account);
    console.log(`Account ${account.id} added to monitoring`);
  }

  // 口座の監視解除
  public removeAccount(accountId: string): void {
    this.monitoredAccounts.delete(accountId);
    console.log(`Account ${accountId} removed from monitoring`);
  }

  // 口座データの更新
  public updateAccount(account: Account): void {
    this.monitoredAccounts.set(account.id, account);
    
    // 即座に監視実行（リアルタイム更新対応）
    if (this.isRunning) {
      this.monitorAccount(account);
    }
  }

  // 全口座の監視実行
  private monitorAllAccounts(): void {
    for (const account of Array.from(this.monitoredAccounts.values())) {
      this.monitorAccount(account);
    }
  }

  // 個別口座の監視実行
  private monitorAccount(account: Account): void {
    try {
      const triggeredAlerts = this.alertManager.monitorAccount(account);
      
      if (triggeredAlerts.length > 0) {
        console.log(`Triggered ${triggeredAlerts.length} alerts for account ${account.id}`);
      }
    } catch (error) {
      console.error(`Error monitoring account ${account.id}:`, error);
    }
  }

  // アラート管理メソッド
  public acknowledgeAlert(alertId: string): boolean {
    return this.alertManager.acknowledgeAlert(alertId);
  }

  public suppressAlert(alertId: string, durationMinutes: number, reason?: string): boolean {
    return this.alertManager.suppressAlert(alertId, durationMinutes, reason);
  }

  public getActiveAlerts(): RiskAlertState[] {
    return this.alertManager.getActiveAlerts();
  }

  public getAlertHistory(accountId?: string): RiskAlertState[] {
    return this.alertManager.getAlertHistory(accountId);
  }

  public getStats(): AlertStats {
    return this.alertManager.getStats();
  }

  // 条件管理メソッド
  public addCondition(condition: Omit<AlertCondition, 'id'>): string {
    return this.alertManager.addCondition(condition);
  }

  public updateCondition(id: string, updates: Partial<AlertCondition>): boolean {
    return this.alertManager.updateCondition(id, updates);
  }

  public removeCondition(id: string): boolean {
    return this.alertManager.removeCondition(id);
  }

  public getConditions(): AlertCondition[] {
    return this.alertManager.getConditions();
  }

  // ディスパッチャー設定メソッド
  public updateDispatchConfig(updates: Partial<AlertDispatchConfig>): void {
    this.dispatcher.updateConfig(updates);
  }

  public getDispatchConfig(): AlertDispatchConfig {
    return this.dispatcher.getConfig();
  }

  public enableChannel(channelType: 'desktop' | 'sound' | 'email' | 'webhook'): void {
    this.dispatcher.enableChannel(channelType);
  }

  public disableChannel(channelType: 'desktop' | 'sound' | 'email' | 'webhook'): void {
    this.dispatcher.disableChannel(channelType);
  }

  public setGlobalMute(muted: boolean): void {
    this.dispatcher.setGlobalMute(muted);
  }

  // テスト機能
  public async testAlerts(): Promise<void> {
    console.log('Testing alert system...');
    
    const severities: RiskAlertState['severity'][] = ['info', 'warning', 'danger', 'critical'];
    
    for (const severity of severities) {
      console.log(`Testing ${severity} alert...`);
      const results = await this.dispatcher.testAlert(severity);
      console.log(`${severity} alert test results:`, results);
      
      // テスト間の間隔
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  public async testNotificationPermissions(): Promise<boolean> {
    try {
      const results = await this.dispatcher.testAlert('info');
      return results.some(r => r);
    } catch (error) {
      console.error('Failed to test notification permissions:', error);
      return false;
    }
  }

  // 設定のエクスポート/インポート
  public exportConfiguration(): string {
    const config = {
      alertManager: this.alertManager.exportSettings(),
      dispatcher: this.dispatcher.getConfig(),
      system: {
        monitoringInterval: this.monitoringInterval,
        isRunning: this.isRunning,
        monitoredAccounts: Array.from(this.monitoredAccounts.keys())
      }
    };

    return JSON.stringify(config, null, 2);
  }

  public importConfiguration(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);
      
      if (config.alertManager) {
        this.alertManager.importSettings(config.alertManager);
      }

      if (config.dispatcher) {
        this.dispatcher.updateConfig(config.dispatcher);
      }

      if (config.system) {
        this.monitoringInterval = config.system.monitoringInterval || this.monitoringInterval;
        
        // システムが動作中の場合は再起動
        if (this.isRunning) {
          this.stop();
          this.start();
        }
      }

      console.log('Configuration imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }

  // システム状態の取得
  public getSystemStatus(): {
    isRunning: boolean;
    monitoredAccountsCount: number;
    activeAlertsCount: number;
    totalConditions: number;
    monitoringInterval: number;
    uptime?: number;
  } {
    return {
      isRunning: this.isRunning,
      monitoredAccountsCount: this.monitoredAccounts.size,
      activeAlertsCount: this.getActiveAlerts().length,
      totalConditions: this.getConditions().length,
      monitoringInterval: this.monitoringInterval
    };
  }

  // システムのヘルスチェック
  public async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    checks: { [key: string]: boolean };
    details: string[];
  }> {
    const checks: { [key: string]: boolean } = {};
    const details: string[] = [];
    let status: 'healthy' | 'warning' | 'error' = 'healthy';

    // 基本動作チェック
    checks.systemRunning = this.isRunning;
    if (!this.isRunning) {
      details.push('Alert system is not running');
      status = 'warning';
    }

    // 監視口座数チェック
    checks.hasMonitoredAccounts = this.monitoredAccounts.size > 0;
    if (this.monitoredAccounts.size === 0) {
      details.push('No accounts are being monitored');
      status = 'warning';
    }

    // 通知権限チェック
    try {
      checks.notificationPermissions = await this.testNotificationPermissions();
      if (!checks.notificationPermissions) {
        details.push('Notification permissions not granted or failed');
        status = 'warning';
      }
    } catch (error) {
      checks.notificationPermissions = false;
      details.push('Failed to test notification permissions');
      status = 'error';
    }

    // アクティブ条件チェック
    const activeConditions = this.getConditions().filter(c => c.isActive);
    checks.hasActiveConditions = activeConditions.length > 0;
    if (activeConditions.length === 0) {
      details.push('No active alert conditions');
      status = 'warning';
    }

    if (details.length === 0) {
      details.push('All systems operating normally');
    }

    return { status, checks, details };
  }

  // リソースのクリーンアップ
  public dispose(): void {
    this.stop();
    this.dispatcher.dispose();
    this.monitoredAccounts.clear();
    console.log('Risk Alert System disposed');
  }

  // 統計レポート
  public generateReport(timeRange?: { start: Date; end: Date }): {
    summary: AlertStats;
    accountBreakdown: { [accountId: string]: number };
    typeBreakdown: { [type: string]: number };
    timelineData: { timestamp: Date; count: number }[];
  } {
    const stats = this.getStats();
    const history = this.getAlertHistory();
    
    const filteredHistory = timeRange ? 
      history.filter(a => a.timestamp >= timeRange.start && a.timestamp <= timeRange.end) :
      history;

    const accountBreakdown: { [accountId: string]: number } = {};
    const typeBreakdown: { [type: string]: number } = {};
    
    filteredHistory.forEach(alert => {
      accountBreakdown[alert.accountId] = (accountBreakdown[alert.accountId] || 0) + 1;
      typeBreakdown[alert.type] = (typeBreakdown[alert.type] || 0) + 1;
    });

    // 時系列データの作成（1時間ごと）
    const timelineData: { timestamp: Date; count: number }[] = [];
    if (filteredHistory.length > 0) {
      const startTime = timeRange?.start || new Date(Math.min(...filteredHistory.map(a => a.timestamp.getTime())));
      const endTime = timeRange?.end || new Date();
      
      for (let time = new Date(startTime); time <= endTime; time.setHours(time.getHours() + 1)) {
        const hourStart = new Date(time);
        const hourEnd = new Date(time.getTime() + 3600000);
        
        const count = filteredHistory.filter(a => 
          a.timestamp >= hourStart && a.timestamp < hourEnd
        ).length;
        
        timelineData.push({ timestamp: new Date(hourStart), count });
      }
    }

    return {
      summary: stats,
      accountBreakdown,
      typeBreakdown,
      timelineData
    };
  }
}