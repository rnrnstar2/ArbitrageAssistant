import { RiskAlertSystem } from '../RiskAlertSystem';
import { Account } from '../../../dashboard/types';

describe('RiskAlertSystem', () => {
  let alertSystem: RiskAlertSystem;
  let mockAccount: Account;

  beforeEach(() => {
    alertSystem = new RiskAlertSystem({
      autoStart: false,
      monitoringInterval: 1000,
      dispatcherConfig: {
        globalMute: true, // テスト中は通知を無効化
        testMode: true
      }
    });

    mockAccount = {
      id: 'test-account-1',
      clientPCId: 'test-client-1',
      broker: 'TestBroker',
      accountNumber: 'ACC001',
      balance: 10000,
      equity: 9500,
      margin: 2000,
      marginLevel: 475, // 475%
      bonusAmount: 500,
      status: 'connected',
      lastUpdate: new Date(),
      positions: []
    };
  });

  afterEach(() => {
    alertSystem.dispose();
  });

  describe('基本機能', () => {
    it('システムの開始と停止ができる', () => {
      expect(alertSystem.getSystemStatus().isRunning).toBe(false);
      
      alertSystem.start();
      expect(alertSystem.getSystemStatus().isRunning).toBe(true);
      
      alertSystem.stop();
      expect(alertSystem.getSystemStatus().isRunning).toBe(false);
    });

    it('口座の監視登録ができる', () => {
      alertSystem.addAccount(mockAccount);
      
      const status = alertSystem.getSystemStatus();
      expect(status.monitoredAccountsCount).toBe(1);
    });

    it('口座の監視解除ができる', () => {
      alertSystem.addAccount(mockAccount);
      alertSystem.removeAccount(mockAccount.id);
      
      const status = alertSystem.getSystemStatus();
      expect(status.monitoredAccountsCount).toBe(0);
    });
  });

  describe('アラート条件', () => {
    it('デフォルトのアラート条件が設定されている', () => {
      const conditions = alertSystem.getConditions();
      expect(conditions.length).toBeGreaterThan(0);
      
      // 証拠金維持率のアラート条件があることを確認
      const marginLevelConditions = conditions.filter(c => c.type === 'margin_level');
      expect(marginLevelConditions.length).toBeGreaterThan(0);
    });

    it('カスタムアラート条件を追加できる', () => {
      const conditionId = alertSystem.addCondition({
        type: 'margin_level',
        threshold: 100,
        severity: 'critical',
        cooldownPeriod: 60,
        isActive: true,
        comparison: 'less_than'
      });

      expect(conditionId).toBeDefined();
      
      const conditions = alertSystem.getConditions();
      const addedCondition = conditions.find(c => c.id === conditionId);
      expect(addedCondition).toBeDefined();
      expect(addedCondition?.threshold).toBe(100);
    });

    it('アラート条件を更新できる', () => {
      const conditionId = alertSystem.addCondition({
        type: 'margin_level',
        threshold: 100,
        severity: 'warning',
        cooldownPeriod: 60,
        isActive: true,
        comparison: 'less_than'
      });

      const updated = alertSystem.updateCondition(conditionId, {
        threshold: 150,
        severity: 'critical'
      });

      expect(updated).toBe(true);
      
      const conditions = alertSystem.getConditions();
      const updatedCondition = conditions.find(c => c.id === conditionId);
      expect(updatedCondition?.threshold).toBe(150);
      expect(updatedCondition?.severity).toBe('critical');
    });
  });

  describe('アラート発火', () => {
    it('証拠金維持率が閾値を下回った場合にアラートが発火する', () => {
      // 証拠金維持率が低い口座を作成
      const lowMarginAccount: Account = {
        ...mockAccount,
        marginLevel: 45 // 45% (50%を下回る)
      };

      alertSystem.addAccount(lowMarginAccount);
      alertSystem.updateAccount(lowMarginAccount);

      const activeAlerts = alertSystem.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      
      const marginAlert = activeAlerts.find(a => a.type === 'margin_level');
      expect(marginAlert).toBeDefined();
      expect(marginAlert?.severity).toBeDefined();
    });

    it('複数のアラートが同時に発火する場合', () => {
      // 複数の条件を満たす口座を作成
      const criticalAccount: Account = {
        ...mockAccount,
        marginLevel: 15, // 20%を下回る (critical)
        equity: 8000,
        margin: 7500 // フリーマージンが少ない
      };

      alertSystem.addAccount(criticalAccount);
      alertSystem.updateAccount(criticalAccount);

      const activeAlerts = alertSystem.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(1);
    });
  });

  describe('アラート管理', () => {
    beforeEach(() => {
      // テスト用のアラートを発火させる
      const lowMarginAccount: Account = {
        ...mockAccount,
        marginLevel: 25 // 30%を下回る
      };

      alertSystem.addAccount(lowMarginAccount);
      alertSystem.updateAccount(lowMarginAccount);
    });

    it('アラートを確認できる', () => {
      const activeAlerts = alertSystem.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      const alertId = activeAlerts[0].id;
      const acknowledged = alertSystem.acknowledgeAlert(alertId);
      expect(acknowledged).toBe(true);

      const updatedAlerts = alertSystem.getActiveAlerts();
      const acknowledgedAlert = updatedAlerts.find(a => a.id === alertId);
      expect(acknowledgedAlert?.isAcknowledged).toBe(true);
    });

    it('アラートを抑制できる', () => {
      const activeAlerts = alertSystem.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      const alertId = activeAlerts[0].id;
      const suppressed = alertSystem.suppressAlert(alertId, 5, 'test');
      expect(suppressed).toBe(true);

      const updatedAlerts = alertSystem.getActiveAlerts();
      const suppressedAlert = updatedAlerts.find(a => a.id === alertId);
      expect(suppressedAlert?.isSuppressed).toBe(true);
    });
  });

  describe('統計情報', () => {
    it('アラート統計を取得できる', () => {
      const stats = alertSystem.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalAlerts).toBeGreaterThanOrEqual(0);
      expect(stats.alertsBySeverity).toBeDefined();
      expect(stats.alertsByType).toBeDefined();
    });

    it('アラート履歴を取得できる', () => {
      const history = alertSystem.getAlertHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('口座別のアラート履歴を取得できる', () => {
      const accountHistory = alertSystem.getAlertHistory(mockAccount.id);
      expect(Array.isArray(accountHistory)).toBe(true);
    });
  });

  describe('システムヘルスチェック', () => {
    it('ヘルスチェックが実行できる', async () => {
      const health = await alertSystem.healthCheck();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.checks).toBeDefined();
      expect(health.details).toBeDefined();
    });

    it('システム状態を取得できる', () => {
      const status = alertSystem.getSystemStatus();
      expect(status).toBeDefined();
      expect(typeof status.isRunning).toBe('boolean');
      expect(typeof status.monitoredAccountsCount).toBe('number');
      expect(typeof status.activeAlertsCount).toBe('number');
    });
  });

  describe('設定のエクスポート/インポート', () => {
    it('設定をエクスポートできる', () => {
      const config = alertSystem.exportConfiguration();
      expect(typeof config).toBe('string');
      
      // JSONとしてパースできることを確認
      const parsed = JSON.parse(config);
      expect(parsed).toBeDefined();
      expect(parsed.system).toBeDefined();
    });

    it('設定をインポートできる', () => {
      const originalConfig = alertSystem.exportConfiguration();
      const imported = alertSystem.importConfiguration(originalConfig);
      expect(imported).toBe(true);
    });
  });

  describe('レポート生成', () => {
    it('統計レポートを生成できる', () => {
      const report = alertSystem.generateReport();
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.accountBreakdown).toBeDefined();
      expect(report.typeBreakdown).toBeDefined();
      expect(report.timelineData).toBeDefined();
    });

    it('期間指定でレポートを生成できる', () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24時間前
        end: new Date()
      };

      const report = alertSystem.generateReport(timeRange);
      expect(report).toBeDefined();
      expect(report.timelineData.length).toBeGreaterThanOrEqual(0);
    });
  });
});