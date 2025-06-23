"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { Action } from '@repo/shared-types';

export const ActionQueue: React.FC = () => {
  const [pendingActions, setPendingActions] = useState<Action[]>([]);
  const [executingActions, setExecutingActions] = useState<Action[]>([]);

  useEffect(() => {
    const updateActions = async () => {
      try {
        // Mock executing actions
        const mockExecuting: Action[] = [
          {
            id: 'action1',
            userId: 'user1',
            accountId: '12345678',
            positionId: 'pos1',
            type: 'ENTRY' as any,
            status: 'EXECUTING' as any,
            createdAt: new Date().toISOString()
          }
        ];

        // Mock pending actions
        const mockPending: Action[] = [
          {
            id: 'action2',
            userId: 'user1',
            accountId: '87654321',
            positionId: 'pos2',
            triggerPositionId: 'pos1',
            type: 'CLOSE' as any,
            status: 'PENDING' as any,
            createdAt: new Date().toISOString()
          },
          {
            id: 'action3',
            userId: 'user1',
            accountId: '11111111',
            positionId: 'pos3',
            type: 'ENTRY' as any,
            status: 'PENDING' as any,
            createdAt: new Date().toISOString()
          }
        ];
        
        setExecutingActions(mockExecuting);
        setPendingActions(mockPending);
      } catch (error) {
        console.error('Failed to update actions:', error);
      }
    };

    const interval = setInterval(updateActions, 1000);
    updateActions();

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* 実行中アクション */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">実行中アクション</h3>
        
        {executingActions.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            実行中のアクションはありません
          </div>
        ) : (
          <div className="space-y-2">
            {executingActions.map(action => (
              <div key={action.id} className="flex items-center justify-between p-3 bg-orange-50 rounded">
                <div>
                  <div className="font-medium">{action.type}</div>
                  <div className="text-sm text-gray-500">
                    ID: {action.id.slice(-8)}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-orange-600">実行中</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 待機中アクション */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">待機中アクション</h3>
        
        {pendingActions.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            待機中のアクションはありません
          </div>
        ) : (
          <div className="space-y-2">
            {pendingActions.map(action => (
              <div key={action.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                <div>
                  <div className="font-medium">{action.type}</div>
                  <div className="text-sm text-gray-500">
                    ID: {action.id.slice(-8)}
                  </div>
                  {action.triggerPositionId && (
                    <div className="text-xs text-gray-400">
                      トリガー元: {action.triggerPositionId.slice(-8)}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-yellow-600">待機中</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};