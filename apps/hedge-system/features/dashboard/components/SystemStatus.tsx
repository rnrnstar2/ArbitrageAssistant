"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';

interface SystemStats {
  wsConnections: number;
  trailMonitoring: number;
  pendingActions: number;
  executingActions: number;
}

interface EngineStatus {
  actionSyncEngine: boolean;
  trailEngine: boolean;
  wsHandler: boolean;
}

export const SystemStatus: React.FC = () => {
  const [systemStats, setSystemStats] = useState<SystemStats>({
    wsConnections: 0,
    trailMonitoring: 0,
    pendingActions: 0,
    executingActions: 0
  });

  const [engineStatus, setEngineStatus] = useState<EngineStatus>({
    actionSyncEngine: false,
    trailEngine: false,
    wsHandler: false
  });

  useEffect(() => {
    const updateStats = async () => {
      try {
        // Mock data for now - would integrate with actual services
        setSystemStats({
          wsConnections: 4,
          trailMonitoring: 6,
          pendingActions: 2,
          executingActions: 1
        });

        setEngineStatus({
          actionSyncEngine: true,
          trailEngine: true,
          wsHandler: true
        });
      } catch (error) {
        console.error('Failed to update system stats:', error);
      }
    };

    const interval = setInterval(updateStats, 2000);
    updateStats();

    return () => clearInterval(interval);
  }, []);

  const handleStartSystem = () => {
    console.log('Starting system...');
  };

  const handleStopSystem = () => {
    console.log('Stopping system...');
  };

  const handleManualSync = () => {
    console.log('Manual sync triggered...');
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">システム状態</h3>
      
      {/* エンジン状態 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
            engineStatus.actionSyncEngine ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <div className="text-sm">Action Sync</div>
        </div>
        <div className="text-center">
          <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
            engineStatus.trailEngine ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <div className="text-sm">Trail Engine</div>
        </div>
        <div className="text-center">
          <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
            engineStatus.wsHandler ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <div className="text-sm">WebSocket</div>
        </div>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-2xl font-bold text-blue-600">{systemStats.wsConnections}</div>
          <div className="text-sm text-gray-600">EA接続数</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-2xl font-bold text-green-600">{systemStats.trailMonitoring}</div>
          <div className="text-sm text-gray-600">トレール監視中</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-2xl font-bold text-yellow-600">{systemStats.pendingActions}</div>
          <div className="text-sm text-gray-600">待機中アクション</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-2xl font-bold text-orange-600">{systemStats.executingActions}</div>
          <div className="text-sm text-gray-600">実行中アクション</div>
        </div>
      </div>

      {/* システム制御 */}
      <div className="mt-6 space-x-2">
        <Button size="sm" onClick={handleStartSystem}>システム開始</Button>
        <Button size="sm" variant="outline" onClick={handleStopSystem}>システム停止</Button>
        <Button size="sm" variant="outline" onClick={handleManualSync}>手動同期</Button>
      </div>
    </Card>
  );
};