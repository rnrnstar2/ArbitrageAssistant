'use client';

import React, { useState, useEffect } from 'react';
import { RiskAlertSystem } from '../RiskAlertSystem';
import { Account } from '../../../dashboard/types';
import { RiskAlertState, AlertCondition } from '../types';

export function RiskAlertDemo() {
  const [alertSystem, setAlertSystem] = useState<RiskAlertSystem | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<RiskAlertState[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>({});
  const [testAccount, setTestAccount] = useState<Account>({
    id: 'demo-account-1',
    clientPCId: 'demo-client-1',
    broker: 'DemoBroker',
    accountNumber: 'DEMO001',
    balance: 10000,
    equity: 9500,
    margin: 2000,
    marginLevel: 475,
    bonusAmount: 500,
    status: 'connected',
    lastUpdate: new Date(),
    positions: []
  });
  const [isSystemRunning, setIsSystemRunning] = useState(false);

  // アラートシステムの初期化
  useEffect(() => {
    const system = new RiskAlertSystem({
      autoStart: false,
      monitoringInterval: 2000, // 2秒間隔でデモ
      dispatcherConfig: {
        globalMute: false,
        testMode: true
      }
    });

    setAlertSystem(system);

    // 定期的にステータスを更新
    const statusInterval = setInterval(() => {
      setActiveAlerts(system.getActiveAlerts());
      setSystemStatus(system.getSystemStatus());
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      system.dispose();
    };
  }, []);

  // システム開始
  const handleStartSystem = () => {
    if (!alertSystem) return;
    
    alertSystem.addAccount(testAccount);
    alertSystem.start();
    setIsSystemRunning(true);
  };

  // システム停止
  const handleStopSystem = () => {
    if (!alertSystem) return;
    
    alertSystem.stop();
    setIsSystemRunning(false);
  };

  // 証拠金維持率変更
  const handleMarginLevelChange = (marginLevel: number) => {
    const updatedAccount = {
      ...testAccount,
      marginLevel,
      equity: testAccount.balance * (marginLevel / 100),
      lastUpdate: new Date()
    };
    
    setTestAccount(updatedAccount);
    
    if (alertSystem && isSystemRunning) {
      alertSystem.updateAccount(updatedAccount);
    }
  };

  // テストアラート実行
  const handleTestAlerts = async () => {
    if (!alertSystem) return;
    await alertSystem.testAlerts();
  };

  // アラート確認
  const handleAcknowledgeAlert = (alertId: string) => {
    if (!alertSystem) return;
    alertSystem.acknowledgeAlert(alertId);
  };

  // アラート抑制
  const handleSuppressAlert = (alertId: string) => {
    if (!alertSystem) return;
    alertSystem.suppressAlert(alertId, 5, 'demo');
  };

  const getSeverityColor = (severity: RiskAlertState['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'danger': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityEmoji = (severity: RiskAlertState['severity']) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'danger': return '⚠️';
      case 'warning': return '⚡';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">リスクアラート管理システム - デモ</h2>
          <p className="text-sm text-gray-600 mt-1">
            証拠金維持率を変更してアラートの動作を確認できます
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* システムコントロール */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handleStartSystem}
              disabled={isSystemRunning}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              システム開始
            </button>
            
            <button
              onClick={handleStopSystem}
              disabled={!isSystemRunning}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              システム停止
            </button>

            <button
              onClick={handleTestAlerts}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              テストアラート実行
            </button>

            <div className={`px-3 py-1 rounded text-sm font-medium ${
              isSystemRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {isSystemRunning ? '動作中' : '停止中'}
            </div>
          </div>

          {/* テスト口座設定 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-3">テスト口座設定</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">口座番号</label>
                <input
                  type="text"
                  value={testAccount.accountNumber}
                  disabled
                  className="w-full border rounded px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">証拠金維持率 (%)</label>
                <input
                  type="number"
                  value={testAccount.marginLevel}
                  onChange={(e) => handleMarginLevelChange(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-2"
                  min="0"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">残高 ($)</label>
                <input
                  type="number"
                  value={testAccount.balance}
                  disabled
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">有効証拠金 ($)</label>
                <input
                  type="number"
                  value={testAccount.equity.toFixed(2)}
                  disabled
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>
            </div>

            {/* 証拠金維持率のプリセット */}
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">プリセット</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleMarginLevelChange(500)}
                  className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm hover:bg-green-200"
                >
                  安全 (500%)
                </button>
                <button
                  onClick={() => handleMarginLevelChange(75)}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm hover:bg-blue-200"
                >
                  情報 (75%)
                </button>
                <button
                  onClick={() => handleMarginLevelChange(45)}
                  className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm hover:bg-yellow-200"
                >
                  警告 (45%)
                </button>
                <button
                  onClick={() => handleMarginLevelChange(25)}
                  className="bg-orange-100 text-orange-800 px-3 py-1 rounded text-sm hover:bg-orange-200"
                >
                  危険 (25%)
                </button>
                <button
                  onClick={() => handleMarginLevelChange(15)}
                  className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200"
                >
                  緊急 (15%)
                </button>
              </div>
            </div>
          </div>

          {/* システムステータス */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-3">システムステータス</h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">監視口座数</div>
                <div className="font-medium">{systemStatus.monitoredAccountsCount || 0}</div>
              </div>
              <div>
                <div className="text-gray-600">アクティブアラート</div>
                <div className="font-medium">{systemStatus.activeAlertsCount || 0}</div>
              </div>
              <div>
                <div className="text-gray-600">設定条件数</div>
                <div className="font-medium">{systemStatus.totalConditions || 0}</div>
              </div>
              <div>
                <div className="text-gray-600">監視間隔</div>
                <div className="font-medium">{systemStatus.monitoringInterval || 0}ms</div>
              </div>
            </div>
          </div>

          {/* アクティブアラート */}
          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b">
              <h3 className="font-medium">アクティブアラート</h3>
            </div>
            <div className="p-4">
              {activeAlerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-3xl mb-2">🔔</div>
                  <p>アクティブなアラートはありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="text-xl">
                            {getSeverityEmoji(alert.severity)}
                          </div>
                          <div>
                            <div className="font-medium">
                              {alert.type === 'margin_level' && '証拠金維持率アラート'}
                              {alert.type === 'free_margin' && 'フリーマージンアラート'}
                              {alert.type === 'floating_loss' && '含み損アラート'}
                            </div>
                            <div className="text-sm mt-1">{alert.message}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {alert.timestamp.toLocaleString('ja-JP')}
                            </div>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          {!alert.isAcknowledged && (
                            <button
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                            >
                              確認
                            </button>
                          )}
                          {!alert.isSuppressed && (
                            <button
                              onClick={() => handleSuppressAlert(alert.id)}
                              className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
                            >
                              抑制
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ステータスバッジ */}
                      <div className="flex space-x-2 mt-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        {alert.isAcknowledged && (
                          <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                            確認済み
                          </span>
                        )}
                        {alert.isSuppressed && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                            抑制中
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}