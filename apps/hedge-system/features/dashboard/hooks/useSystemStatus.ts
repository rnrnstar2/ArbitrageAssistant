import { useState, useEffect } from 'react';
import { hedgeSystemCore } from '../../../lib/hedge-system-core';
import { 
  PositionService,
  ActionService,
  AccountService 
} from '@repo/shared-amplify/services';

// サービスインスタンス作成
const positionService = new PositionService();
const actionService = new ActionService();
const accountService = new AccountService();
import type { PositionStatus, ActionStatus } from '@repo/shared-amplify/types';

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
        // システム状態取得（MVP簡略版）
        const coreStatus = hedgeSystemCore.getStatus();
        
        // shared-amplifyサービスから統計データを取得（修正版）
        const accounts = await accountService.listUserAccounts();
        const positions = await positionService.listUserPositions();
        const actions = await actionService.listUserActions();
        
        // トレール監視中のポジションを計算
        const trailPositions = positions.filter((p: any) => 
          p.status === 'OPEN' && p.trailWidth && p.trailWidth > 0
        );
        
        // 実行中のアクション
        const executingActions = actions.filter((a: any) => a.status === 'EXECUTING');
        
        // 今日の完了アクション数
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const completedToday = actions.filter((a: any) => 
          a.status === 'EXECUTED' && 
          new Date(a.updatedAt) >= today
        ).length;
        
        setSystemStatus({
          isInitialized: true,
          isRunning: typeof coreStatus === 'object' ? coreStatus.isRunning : coreStatus === 'RUNNING',
          connectedAccounts: accounts.length,
          totalAccounts: accounts.length,
          activeSubscriptions: 1, // MVP: 固定値
          lastUpdate: new Date(),
          trailMonitoring: {
            monitoredPositions: trailPositions.length,
            triggeredToday: 0, // MVP: 仮値
            lastTrigger: null // MVP: 仮値
          },
          actionExecution: {
            executingActions: executingActions.length,
            completedToday,
            lastExecution: executingActions.length > 0 ? 
              new Date(Math.max(...executingActions.map((a: any) => new Date(a.updatedAt).getTime()))) : 
              null
          }
        });
        
      } catch (error) {
        console.error('Failed to get system status:', error);
        // エラー時のフォールバック
        setSystemStatus({
          isInitialized: false,
          isRunning: false,
          connectedAccounts: 0,
          totalAccounts: 0,
          activeSubscriptions: 0,
          lastUpdate: new Date(),
          trailMonitoring: {
            monitoredPositions: 0,
            triggeredToday: 0,
            lastTrigger: null
          },
          actionExecution: {
            executingActions: 0,
            completedToday: 0,
            lastExecution: null
          }
        });
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