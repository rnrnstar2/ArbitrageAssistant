import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Activity, AlertTriangle, TrendingUp, Clock, Play, Square, Target } from "lucide-react";
import type { Position, Action, Account } from '@repo/shared-types';
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";

interface MonitoringPanelProps {
  isLoading: boolean;
  positions: Position[];
  actions: Action[];
  accounts: Account[];
}

interface ExecutionLog {
  id: string;
  type: 'position' | 'action';
  status: string;
  message: string;
  timestamp: Date;
  level: 'success' | 'info' | 'warning' | 'error';
}

interface Alert {
  id: string;
  type: 'margin' | 'trail' | 'execution' | 'system';
  level: 'info' | 'warning' | 'error';
  message: string;
  account?: Account;
}

export function MonitoringPanel({ 
  isLoading, 
  positions = [], 
  actions = [], 
  accounts = [] 
}: MonitoringPanelProps) {
  
  // 戦略実行ログ生成（リアルタイムデータベース）
  const executionLogs = useMemo((): ExecutionLog[] => {
    if (isLoading) return [];
    
    const logs: ExecutionLog[] = [];
    
    // Position履歴からログ生成
    positions.forEach(position => {
      const timestamp = position.updatedAt 
        ? new Date(position.updatedAt) 
        : position.createdAt 
          ? new Date(position.createdAt)
          : new Date();
      
      let message = '';
      let level: ExecutionLog['level'] = 'info';
      
      switch (position.status) {
        case 'OPEN':
          message = `${position.symbol}: ${position.executionType} ${position.volume}lot 実行完了`;
          level = 'success';
          break;
        case 'OPENING':
          message = `${position.symbol}: ${position.executionType} ${position.volume}lot 実行中`;
          level = 'info';
          break;
        case 'CLOSING':
          message = `${position.symbol}: 決済処理中 (${position.volume}lot)`;
          level = 'info';
          break;
        case 'CLOSED':
          message = `${position.symbol}: 決済完了 (${position.volume}lot)`;
          level = 'success';
          break;
        case 'STOPPED':
          message = `${position.symbol}: ロスカット実行 (${position.volume}lot)`;
          level = 'error';
          break;
        case 'CANCELED':
          message = `${position.symbol}: 実行キャンセル (${position.volume}lot)`;
          level = 'warning';
          break;
        default:
          return;
      }
      
      logs.push({
        id: `pos-${position.id}`,
        type: 'position',
        status: position.status,
        message,
        timestamp,
        level
      });
    });
    
    // Action履歴からログ生成
    actions.forEach(action => {
      const timestamp = action.updatedAt 
        ? new Date(action.updatedAt) 
        : action.createdAt 
          ? new Date(action.createdAt)
          : new Date();
      
      let message = '';
      let level: ExecutionLog['level'] = 'info';
      
      switch (action.status) {
        case 'EXECUTING':
          message = `${action.type} アクション実行中`;
          level = 'info';
          break;
        case 'EXECUTED':
          message = `${action.type} アクション実行完了`;
          level = 'success';
          break;
        case 'FAILED':
          message = `${action.type} アクション実行失敗`;
          level = 'error';
          break;
        default:
          return;
      }
      
      logs.push({
        id: `act-${action.id}`,
        type: 'action',
        status: action.status,
        message,
        timestamp,
        level
      });
    });
    
    // 新しい順にソート
    return logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10); // 最新10件のみ
  }, [positions, actions, isLoading]);
  
  // アラート・通知生成（リアルタイム監視）
  const alerts = useMemo((): Alert[] => {
    if (isLoading) return [];
    
    const alertList: Alert[] = [];
    
    // 証拠金アラート
    accounts.forEach(account => {
      if (!account.isActive) return;
      
      const marginLevel = account.equity && account.balance ? 
        (account.equity / account.balance) * 100 : 100;
      
      if (marginLevel < 100) {
        alertList.push({
          id: `margin-${account.id}`,
          type: 'margin',
          level: marginLevel < 50 ? 'error' : 'warning',
          message: `${account.displayName || account.accountNumber}: 証拠金率${marginLevel.toFixed(1)}%`,
          account
        });
      }
    });
    
    // トレール監視アラート
    const trailPositions = positions.filter(p => 
      p.status === 'OPEN' && p.trailWidth && p.trailWidth > 0
    );
    
    if (trailPositions.length > 0) {
      alertList.push({
        id: 'trail-monitoring',
        type: 'trail',
        level: 'info',
        message: `${trailPositions.length}件のポジションでトレール監視中`
      });
    }
    
    // 実行中アクションアラート
    const executingActions = actions.filter(a => a.status === 'EXECUTING');
    if (executingActions.length > 0) {
      alertList.push({
        id: 'executing-actions',
        type: 'execution',
        level: 'info',
        message: `${executingActions.length}件のアクション実行中`
      });
    }
    
    // 失敗アクションアラート
    const failedActions = actions.filter(a => a.status === 'FAILED');
    if (failedActions.length > 0) {
      alertList.push({
        id: 'failed-actions',
        type: 'execution',
        level: 'error',
        message: `${failedActions.length}件のアクション実行失敗`
      });
    }
    
    // システム健全性チェック
    const activeAccounts = accounts.filter(acc => acc.isActive);
    const openPositions = positions.filter(p => p.status === 'OPEN');
    
    if (activeAccounts.length === 0) {
      alertList.push({
        id: 'no-active-accounts',
        type: 'system',
        level: 'warning',
        message: '有効な口座がありません'
      });
    }
    
    if (openPositions.length > 20) {
      alertList.push({
        id: 'many-positions',
        type: 'system',
        level: 'warning',
        message: `多数のポジション保有中: ${openPositions.length}件`
      });
    }
    
    return alertList.slice(0, 6); // 最新6件のみ
  }, [accounts, positions, actions, isLoading]);
  
  const getLogIcon = (log: ExecutionLog) => {
    switch (log.level) {
      case 'success': return 'bg-green-500';
      case 'info': return 'bg-blue-500';
      case 'warning': return 'bg-orange-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getAlertIcon = (alert: Alert) => {
    switch (alert.type) {
      case 'margin': return AlertTriangle;
      case 'trail': return TrendingUp;
      case 'execution': return Play;
      case 'system': return Activity;
      default: return Activity;
    }
  };
  
  const getAlertColor = (alert: Alert) => {
    switch (alert.level) {
      case 'error': return 'bg-red-50 text-red-800';
      case 'warning': return 'bg-yellow-50 text-yellow-800';
      case 'info': return 'bg-blue-50 text-blue-800';
      default: return 'bg-gray-50 text-gray-800';
    }
  };
  
  const getAlertIconColor = (alert: Alert) => {
    switch (alert.level) {
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>リアルタイム監視パネル</span>
          {!isLoading && (
            <div className="ml-auto flex items-center space-x-1 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>ライブ</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <h4 className="font-medium mb-3 flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>実行ログ</span>
              {!isLoading && (
                <span className="text-xs text-gray-500">({executionLogs.length})</span>
              )}
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-gray-200 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="w-3/4 h-3 bg-gray-200 rounded animate-pulse mb-1" />
                      <div className="w-1/2 h-3 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))
              ) : executionLogs.length > 0 ? (
                executionLogs.map((log) => (
                  <div key={log.id} className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${getLogIcon(log)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{log.message}</p>
                      <p className="text-xs text-gray-500">
                        {formatDistanceToNow(log.timestamp, { 
                          addSuffix: true, 
                          locale: ja 
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center p-4 text-gray-500">
                  <Square className="h-4 w-4 mr-2" />
                  <span className="text-sm">実行ログがありません</span>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-3 flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>アラート・通知</span>
              {!isLoading && (
                <span className="text-xs text-gray-500">({alerts.length})</span>
              )}
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-2 bg-yellow-50 rounded">
                    <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="flex-1">
                      <div className="w-3/4 h-3 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))
              ) : alerts.length > 0 ? (
                alerts.map((alert) => {
                  const Icon = getAlertIcon(alert);
                  return (
                    <div key={alert.id} className={`flex items-center space-x-3 p-2 rounded ${getAlertColor(alert)}`}>
                      <Icon className={`h-4 w-4 ${getAlertIconColor(alert)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{alert.message}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center p-4 text-gray-500">
                  <Activity className="h-4 w-4 mr-2" />
                  <span className="text-sm">アラートはありません</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}