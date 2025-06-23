"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Action } from '@repo/shared-types';

interface ActionSyncStats {
  isRunning: boolean;
  executingActions: Action[];
  recentActions: Action[];
  totalExecuted: number;
  totalFailed: number;
  lastSyncTime: string | null;
  subscriptionErrors: number;
}

interface ActionQueueProps {
  hedgeSystemCore?: any; // HedgeSystemCoreインスタンス
}

export const ActionQueue: React.FC<ActionQueueProps> = ({ hedgeSystemCore }) => {
  const [actionStats, setActionStats] = useState<ActionSyncStats>({
    isRunning: false,
    executingActions: [],
    recentActions: [],
    totalExecuted: 0,
    totalFailed: 0,
    lastSyncTime: null,
    subscriptionErrors: 0
  });

  useEffect(() => {
    const updateActionStats = async () => {
      try {
        if (hedgeSystemCore && hedgeSystemCore.getActionSyncStats) {
          const stats = hedgeSystemCore.getActionSyncStats();
          setActionStats(stats);
        } else {
          // Mock data for development
          const mockStats: ActionSyncStats = {
            isRunning: true,
            executingActions: [
              {
                id: 'action1',
                userId: 'user1',
                accountId: '12345678',
                positionId: 'pos1',
                type: 'ENTRY' as any,
                status: 'EXECUTING' as any,
                createdAt: new Date().toISOString()
              }
            ],
            recentActions: [
              {
                id: 'action2',
                userId: 'user1',
                accountId: '87654321',
                positionId: 'pos2',
                type: 'CLOSE' as any,
                status: 'EXECUTED' as any,
                createdAt: new Date(Date.now() - 30000).toISOString()
              },
              {
                id: 'action3',
                userId: 'user1',
                accountId: '11111111',
                positionId: 'pos3',
                type: 'ENTRY' as any,
                status: 'FAILED' as any,
                createdAt: new Date(Date.now() - 60000).toISOString()
              }
            ],
            totalExecuted: 24,
            totalFailed: 2,
            lastSyncTime: new Date().toISOString(),
            subscriptionErrors: 0
          };
          setActionStats(mockStats);
        }
      } catch (error) {
        console.error('Failed to update action stats:', error);
      }
    };

    const interval = setInterval(updateActionStats, 1000);
    updateActionStats();

    return () => clearInterval(interval);
  }, [hedgeSystemCore]);

  const formatTime = (date: Date | string | null) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EXECUTING': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'EXECUTED': return 'bg-green-50 text-green-600 border-green-200';
      case 'FAILED': return 'bg-red-50 text-red-600 border-red-200';
      case 'PENDING': return 'bg-yellow-50 text-yellow-600 border-yellow-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* 統計情報カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">エンジン状態</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${actionStats.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-lg font-bold">
                {actionStats.isRunning ? '稼働中' : '停止'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">実行中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {actionStats.executingActions.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">成功</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {actionStats.totalExecuted}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">失敗</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {actionStats.totalFailed}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 実行中アクション */}
      <Card>
        <CardHeader>
          <CardTitle>実行中アクション</CardTitle>
        </CardHeader>
        <CardContent>
          {actionStats.executingActions.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              実行中のアクションはありません
            </div>
          ) : (
            <div className="space-y-3">
              {actionStats.executingActions.map(action => (
                <div key={action.id} className={`p-4 rounded-lg border ${getStatusColor(action.status)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-lg">{action.type}</div>
                      <div className="text-sm opacity-75">
                        ID: {action.id.slice(-8)} | 口座: {action.accountId}
                      </div>
                      <div className="text-xs opacity-60">
                        ポジション: {action.positionId}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">実行中</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* アクション履歴 */}
      <Card>
        <CardHeader>
          <CardTitle>最近のアクション履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {actionStats.recentActions.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              履歴はありません
            </div>
          ) : (
            <div className="space-y-2">
              {actionStats.recentActions.slice(0, 10).map(action => (
                <div key={action.id} className={`p-3 rounded border ${getStatusColor(action.status)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{action.type}</div>
                      <div className="text-sm opacity-75">
                        ID: {action.id.slice(-8)} | {formatTime(action.createdAt || null)}
                      </div>
                    </div>
                    <div className="text-sm font-medium">
                      {action.status === 'EXECUTED' ? '✅ 完了' : 
                       action.status === 'FAILED' ? '❌ 失敗' : action.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* システム情報 */}
      <Card>
        <CardHeader>
          <CardTitle>システム情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">最終同期:</span> {formatTime(actionStats.lastSyncTime)}
            </div>
            <div>
              <span className="font-medium">エラー数:</span> {actionStats.subscriptionErrors}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};