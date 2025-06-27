'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert';
import { CheckCircle2, AlertTriangle, Activity, TrendingUp, Users, Zap, RefreshCw } from 'lucide-react';
import { Position, PositionStatus, Action, ActionStatus, Account } from '@repo/shared-types';
import { StatCard } from '../../../components/common';
import { MonitoringPanel } from './MonitoringPanel';

interface DashboardProps {
  positions: Position[];
  actions: Action[];
  accounts: Account[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

interface DashboardOverviewProps {
  accounts: Account[];
  positions: Position[];
  actions: Action[];
}

interface RecentActivityProps {
  positions: Position[];
  actions: Action[];
}

interface StatusChartProps {
  positions?: Position[];
  actions?: Action[];
}

interface PerformanceIndicatorsProps {
  positions: Position[];
  accounts: Account[];
}

/**
 * DashboardOverview - MVPシステム設計書 5-4. 管理者画面準拠
 * リアルタイム統計表示、アカウント・ポジション概要、パフォーマンス指標
 */
const DashboardOverview: React.FC<DashboardOverviewProps> = ({ accounts, positions, actions }) => {
  const stats = useMemo(() => {
    const activeAccounts = accounts.filter(acc => acc.isActive);
    const openPositions = positions.filter(p => p.status === PositionStatus.OPEN);
    const pendingActions = actions.filter(a => a.status === ActionStatus.PENDING);
    const executingActions = actions.filter(a => a.status === ActionStatus.EXECUTING);
    
    // 口座別残高・クレジット集計
    const totalBalance = activeAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const totalCredit = activeAccounts.reduce((sum, acc) => sum + (acc.credit || 0), 0);
    const totalEquity = activeAccounts.reduce((sum, acc) => sum + (acc.equity || 0), 0);
    
    // システムヘルス判定
    const systemHealth = activeAccounts.length > 0 && pendingActions.length === 0 && executingActions.length === 0;
    
    return {
      connectedAccounts: activeAccounts.length,
      totalAccounts: accounts.length,
      openPositions: openPositions.length,
      pendingActions: pendingActions.length,
      executingActions: executingActions.length,
      totalBalance,
      totalCredit,
      totalEquity,
      systemHealth,
      trailPositions: positions.filter(p => p.trailWidth && p.trailWidth > 0).length
    };
  }, [accounts, positions, actions]);

  return (
    <div className="space-y-6">
      {/* システム状態アラート */}
      <Alert variant={stats.systemHealth ? "default" : "destructive"}>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          {stats.systemHealth ? (
            <>
              システム正常動作中 - 
              <Badge variant="secondary" className="mx-1">{stats.connectedAccounts}口座接続</Badge>
              <Badge variant="secondary" className="mx-1">{stats.openPositions}ポジション監視</Badge>
              <Badge variant="secondary" className="mx-1">{stats.trailPositions}トレール設定</Badge>
            </>
          ) : (
            <>
              システム異常検出 - 
              {stats.connectedAccounts === 0 && <span className="text-red-600">口座未接続 </span>}
              {stats.executingActions > 0 && <span className="text-yellow-600">実行中アクション{stats.executingActions}件 </span>}
            </>
          )}
        </AlertDescription>
      </Alert>

      {/* 主要統計指標 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="接続中口座" 
          value={`${stats.connectedAccounts}/${stats.totalAccounts}`}
          color="blue"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard 
          title="実行中ポジション" 
          value={stats.openPositions}
          color="green"
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard 
          title="待機アクション" 
          value={stats.pendingActions}
          color="orange"
          icon={<Zap className="h-4 w-4" />}
        />
        <StatCard 
          title="トレール設定" 
          value={stats.trailPositions}
          color="purple"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* 資金概要 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">総残高</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{stats.totalBalance.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">総クレジット</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ¥{stats.totalCredit.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">有効証拠金</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ¥{stats.totalEquity.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/**
 * パフォーマンス指標 - 両建て管理とクレジット活用状況
 */
const PerformanceIndicators: React.FC<PerformanceIndicatorsProps> = ({ positions, accounts }) => {
  const performance = useMemo(() => {
    const openPositions = positions.filter(p => p.status === PositionStatus.OPEN);
    
    // 両建て状況の計算（簡易版）
    const symbolGroups = openPositions.reduce((acc, pos) => {
      if (!acc[pos.symbol]) acc[pos.symbol] = { buy: 0, sell: 0 };
      // ExecutionTypeに基づく方向判定（簡易実装）
      if (pos.executionType === 'ENTRY') {
        acc[pos.symbol].buy += pos.volume;
      } else {
        acc[pos.symbol].sell += pos.volume;
      }
      return acc;
    }, {} as Record<string, { buy: number; sell: number }>);
    
    const hedgedPairs = Object.values(symbolGroups).filter(
      group => group.buy > 0 && group.sell > 0
    ).length;
    
    // クレジット使用効率
    const totalCredit = accounts.reduce((sum, acc) => sum + (acc.credit || 0), 0);
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const creditUtilization = totalBalance > 0 ? (totalCredit / totalBalance) * 100 : 0;
    
    return {
      hedgedPairs,
      totalSymbols: Object.keys(symbolGroups).length,
      creditUtilization: Math.round(creditUtilization)
    };
  }, [positions, accounts]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">両建てペア</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {performance.hedgedPairs}/{performance.totalSymbols}
          </div>
          <p className="text-xs text-muted-foreground">
            両建て設定済み通貨ペア
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">クレジット活用率</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {performance.creditUtilization}%
          </div>
          <p className="text-xs text-muted-foreground">
            ボーナス活用効率
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">監視対象</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {performance.totalSymbols}
          </div>
          <p className="text-xs text-muted-foreground">
            アクティブ通貨ペア
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const RecentActivity: React.FC<RecentActivityProps> = ({ positions, actions }) => {
  const recentItems = useMemo(() => {
    const positionActivities = positions
      .filter(p => p.updatedAt)
      .map(p => ({
        id: p.id,
        type: 'position' as const,
        activity: `ポジション ${p.symbol} ${p.status}`,
        timestamp: p.updatedAt!,
        status: p.status
      }));

    const actionActivities = actions
      .filter(a => a.updatedAt)
      .map(a => ({
        id: a.id,
        type: 'action' as const,
        activity: `アクション ${a.type} ${a.status}`,
        timestamp: a.updatedAt!,
        status: a.status
      }));

    return [...positionActivities, ...actionActivities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [positions, actions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': case 'EXECUTED': return 'text-green-600';
      case 'PENDING': case 'OPENING': return 'text-yellow-600';
      case 'EXECUTING': return 'text-blue-600';
      case 'CLOSED': return 'text-gray-600';
      case 'FAILED': case 'STOPPED': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-6">
      <div className="space-y-3">
        {recentItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            最近のアクティビティはありません
          </div>
        ) : (
          recentItems.map((item) => (
            <div key={`${item.type}-${item.id}`} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center space-x-3">
                <Badge variant="outline" className="text-xs">
                  {item.type === 'position' ? 'POS' : 'ACT'}
                </Badge>
                <div className="text-sm">
                  {item.activity}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-medium ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
                <div className="text-xs text-gray-500">
                  {new Date(item.timestamp).toLocaleString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const PositionStatusChart: React.FC<StatusChartProps> = ({ positions = [] }) => {
  const statusCounts = useMemo(() => {
    const counts = positions.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts);
  }, [positions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'text-green-600';
      case 'PENDING': return 'text-yellow-600';
      case 'OPENING': case 'CLOSING': return 'text-blue-600';
      case 'CLOSED': return 'text-gray-600';
      case 'STOPPED': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-6">
      <div className="space-y-3">
        {statusCounts.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            ポジションデータがありません
          </div>
        ) : (
          statusCounts.map(([status, count]) => (
            <div key={status} className="flex justify-between items-center">
              <span className="text-sm">{status}</span>
              <span className={`font-semibold ${getStatusColor(status)}`}>{count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({
  positions,
  actions,
  accounts,
  loading = false,
  error = null,
  onRefresh
}) => {
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          データの読み込みに失敗しました: {error}
          {onRefresh && (
            <Button onClick={handleRefresh} variant="outline" size="sm" className="ml-4">
              再試行
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">管理ダッシュボード</h1>
          <p className="text-muted-foreground">
            ArbitrageAssistant 統合管理システム
          </p>
        </div>
        {onRefresh && (
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "更新中..." : "更新"}
          </Button>
        )}
      </div>

      {/* Dashboard Overview */}
      <DashboardOverview accounts={accounts} positions={positions} actions={actions} />

      {/* Performance Indicators */}
      <div>
        <h3 className="text-lg font-semibold mb-4">パフォーマンス指標</h3>
        <PerformanceIndicators positions={positions} accounts={accounts} />
      </div>

      {/* Monitoring Panel */}
      <MonitoringPanel 
        isLoading={loading}
        positions={positions}
        actions={actions}
        accounts={accounts}
      />

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Position Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ポジション状態</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PositionStatusChart positions={positions} />
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近のアクティビティ</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RecentActivity positions={positions} actions={actions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};