'use client';

import React, { useMemo } from 'react';
import { Card } from '@repo/ui/components/ui/card';
import { Position, PositionStatus, Action, ActionStatus, Account } from '@repo/shared-types';
import { StatCard } from '../../../components/common';

interface DashboardProps {
  positions: Position[];
  actions: Action[];
  accounts: Account[];
}

interface RecentActivityProps {
  positions: Position[];
  actions: Action[];
}

interface StatusChartProps {
  positions?: Position[];
  actions?: Action[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ positions, actions }) => {
  const recentItems = useMemo(() => {
    const positionActivities = positions
      .filter(p => p.updatedAt)
      .map(p => ({
        id: p.id,
        type: 'position' as const,
        activity: `ポジション ${p.symbol} ${p.status}`,
        timestamp: p.updatedAt!
      }));

    const actionActivities = actions
      .filter(a => a.updatedAt)
      .map(a => ({
        id: a.id,
        type: 'action' as const,
        activity: `アクション ${a.type} ${a.status}`,
        timestamp: a.updatedAt!
      }));

    return [...positionActivities, ...actionActivities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [positions, actions]);

  return (
    <div className="p-6">
      <div className="space-y-4">
        {recentItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            最近のアクティビティはありません
          </div>
        ) : (
          recentItems.map((item) => (
            <div key={`${item.type}-${item.id}`} className="flex justify-between items-center">
              <div className="text-sm">
                {item.activity}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(item.timestamp).toLocaleString('ja-JP')}
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

  return (
    <div className="p-6">
      <div className="space-y-2">
        {statusCounts.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            ポジションデータがありません
          </div>
        ) : (
          statusCounts.map(([status, count]) => (
            <div key={status} className="flex justify-between items-center">
              <span className="text-sm">{status}</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ActionStatusChart: React.FC<StatusChartProps> = ({ actions = [] }) => {
  const statusCounts = useMemo(() => {
    const counts = actions.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts);
  }, [actions]);

  return (
    <div className="p-6">
      <div className="space-y-2">
        {statusCounts.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            アクションデータがありません
          </div>
        ) : (
          statusCounts.map(([status, count]) => (
            <div key={status} className="flex justify-between items-center">
              <span className="text-sm">{status}</span>
              <span className="font-semibold">{count}</span>
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
  accounts
}) => {
  const stats = useMemo(() => ({
    connectedAccounts: accounts.filter(acc => acc.isConnected).length,
    totalAccounts: accounts.length,
    openPositions: positions.filter(p => p.status === PositionStatus.OPEN).length,
    pendingActions: actions.filter(a => a.status === ActionStatus.PENDING).length,
    systemHealth: accounts.filter(acc => acc.isConnected).length === accounts.length && accounts.length > 0 ? '正常' : '異常'
  }), [positions, actions, accounts]);

  return (
    <div className="space-y-6">
      {/* 基本統計情報 */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard 
          title="接続中口座数" 
          value={`${stats.connectedAccounts}/${stats.totalAccounts}`}
          color="blue"
        />
        <StatCard 
          title="実行中ポジション" 
          value={stats.openPositions}
          color="green"
        />
        <StatCard 
          title="待機中アクション" 
          value={stats.pendingActions}
          color="orange"
        />
        <StatCard 
          title="システム状態" 
          value={stats.systemHealth}
          color={stats.systemHealth === '正常' ? 'green' : 'red'}
        />
      </div>

      {/* 最近のアクティビティ */}
      <Card>
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">最近のアクティビティ</h3>
        </div>
        <RecentActivity positions={positions} actions={actions} />
      </Card>
    </div>
  );
};