import { useState, useEffect } from 'react';
import { hedgeSystemCore } from '../../../lib/hedge-system-core';

interface SystemStatus {
  isInitialized: boolean;
  isRunning: boolean;
  connectedAccounts: number;
  totalAccounts: number;
  activeSubscriptions: number;
  lastUpdate: Date;
  trailMonitoring: {
    monitoredPositions: number;
    triggeredToday: number;
    lastTrigger: Date | null;
  };
  actionExecution: {
    executingActions: number;
    completedToday: number;
    lastExecution: Date | null;
  };
}

export function useSystemStatus() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateSystemStatus = async () => {
      try {
        // 実際のシステム状態取得
        const status = hedgeSystemCore.getSystemStatus();
        const trailStats = hedgeSystemCore.getTrailEngineStats();
        const actionStats = hedgeSystemCore.getActionSyncStats();
        
        setSystemStatus({
          ...status,
          trailMonitoring: {
            monitoredPositions: trailStats.monitoringCount,
            triggeredToday: trailStats.totalTriggered,
            lastTrigger: trailStats.lastUpdate
          },
          actionExecution: {
            executingActions: actionStats.executingActions.length,
            completedToday: actionStats.totalExecuted,
            lastExecution: actionStats.lastSyncTime ? new Date(actionStats.lastSyncTime) : null
          }
        });
        
      } catch (error) {
        console.error('Failed to get system status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // 初回読み込み
    updateSystemStatus();

    // 定期更新（1秒毎）
    const interval = setInterval(updateSystemStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    systemStatus,
    isLoading
  };
}