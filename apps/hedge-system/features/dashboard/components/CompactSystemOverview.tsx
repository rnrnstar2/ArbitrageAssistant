"use client";

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Wifi, WifiOff, Activity, TrendingUp, AlertCircle, Play, Square } from 'lucide-react';

interface SystemOverviewData {
  // WebSocket状態
  wsServerRunning: boolean;
  connectedEAs: number;
  wsUptime: number;
  wsErrors: number;
  
  // エンジン状態
  actionSyncRunning: boolean;
  trailEngineRunning: boolean;
  
  // アクティブな状況
  executingActions: number;
  monitoringPositions: number;
  recentTriggers: number;
  
  // 最新の重要情報
  lastActivity: string | null;
}

export const CompactSystemOverview: React.FC = () => {
  const [systemData, setSystemData] = useState<SystemOverviewData>({
    wsServerRunning: false,
    connectedEAs: 0,
    wsUptime: 0,
    wsErrors: 0,
    actionSyncRunning: false,
    trailEngineRunning: false,
    executingActions: 0,
    monitoringPositions: 0,
    recentTriggers: 0,
    lastActivity: null,
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const updateSystemData = async () => {
      try {
        // WebSocketサーバー状態取得
        const wsState = await invoke('get_websocket_server_status') as any;
        
        // モックデータ（実際の実装時はhedgeSystemCoreから取得）
        setSystemData({
          wsServerRunning: wsState.is_running,
          connectedEAs: wsState.connected_clients,
          wsUptime: wsState.uptime_seconds,
          wsErrors: wsState.errors,
          actionSyncRunning: false, // TODO: 実装予定
          trailEngineRunning: false, // TODO: 実装予定
          executingActions: Math.floor(Math.random() * 3), // モック
          monitoringPositions: Math.floor(Math.random() * 5) + 1, // モック
          recentTriggers: Math.floor(Math.random() * 10), // モック
          lastActivity: new Date().toISOString(),
        });

      } catch (error) {
        console.error('Failed to update system data:', error);
        setSystemData(prev => ({
          ...prev,
          wsServerRunning: false,
          connectedEAs: 0,
        }));
      }
    };

    const interval = setInterval(updateSystemData, 3000);
    updateSystemData();

    return () => clearInterval(interval);
  }, []);

  const handleToggleWebSocket = async () => {
    setIsLoading(true);
    try {
      if (systemData.wsServerRunning) {
        await invoke('stop_websocket_server');
      } else {
        await invoke('start_websocket_server', {
          port: 8080,
          host: '127.0.0.1',
          authToken: 'hedge-system-default-token'
        });
      }
    } catch (error) {
      console.error('Failed to toggle WebSocket server:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getOverallStatus = () => {
    if (!systemData.wsServerRunning) return { status: 'OFFLINE', color: 'text-red-600' };
    if (systemData.connectedEAs === 0) return { status: 'NO_EAS', color: 'text-yellow-600' };
    if (systemData.executingActions > 0) return { status: 'ACTIVE', color: 'text-green-600' };
    return { status: 'READY', color: 'text-blue-600' };
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="space-y-4">
      {/* システム状態ヘッダー */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {systemData.wsServerRunning ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <div className={`text-lg font-semibold ${overallStatus.color}`}>
                    {overallStatus.status === 'OFFLINE' && 'システム停止中'}
                    {overallStatus.status === 'NO_EAS' && 'EA接続待機中'}
                    {overallStatus.status === 'ACTIVE' && 'アクション実行中'}
                    {overallStatus.status === 'READY' && 'システム準備完了'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {systemData.wsServerRunning && `稼働時間: ${formatUptime(systemData.wsUptime)}`}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-blue-600">{systemData.connectedEAs}</div>
                  <div className="text-xs text-gray-500">EA接続</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-600">{systemData.executingActions}</div>
                  <div className="text-xs text-gray-500">実行中</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">{systemData.monitoringPositions}</div>
                  <div className="text-xs text-gray-500">監視中</div>
                </div>
              </div>
              
              <Button
                variant={systemData.wsServerRunning ? "destructive" : "default"}
                size="sm"
                onClick={handleToggleWebSocket}
                disabled={isLoading}
              >
                {systemData.wsServerRunning ? (
                  <>
                    <Square className="h-4 w-4 mr-1" />
                    停止
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    開始
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* アクティブな状況 */}
      {(systemData.executingActions > 0 || systemData.monitoringPositions > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 実行中アクション */}
          {systemData.executingActions > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-orange-500" />
                    <div>
                      <div className="font-medium">アクション実行中</div>
                      <div className="text-sm text-gray-500">
                        {systemData.executingActions}件のアクションを処理中
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-orange-50 text-orange-600">
                    処理中
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* トレール監視 */}
          {systemData.monitoringPositions > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="font-medium">トレール監視</div>
                      <div className="text-sm text-gray-500">
                        {systemData.monitoringPositions}ポジションを監視中
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-blue-50 text-blue-600">
                    監視中
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* システム異常やエラーがある場合の警告 */}
      {systemData.wsErrors > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="font-medium text-red-700">システム警告</div>
                <div className="text-sm text-red-600">
                  WebSocketエラーが{systemData.wsErrors}件発生しています
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* システム情報（最小限） */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">エンジン状態:</span>
              <div className="mt-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${systemData.actionSyncRunning ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-xs">Action Sync {systemData.actionSyncRunning ? '稼働' : '停止'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${systemData.trailEngineRunning ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-xs">Trail Engine {systemData.trailEngineRunning ? '稼働' : '停止'}</span>
                </div>
              </div>
            </div>
            <div>
              <span className="text-gray-500">最近の活動:</span>
              <div className="mt-1">
                <div className="text-xs">{systemData.recentTriggers}回のトリガー</div>
                <div className="text-xs text-gray-400">過去24時間</div>
              </div>
            </div>
            <div>
              <span className="text-gray-500">最終更新:</span>
              <div className="mt-1">
                <div className="text-xs">
                  {systemData.lastActivity ? new Date(systemData.lastActivity).toLocaleTimeString() : '-'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};