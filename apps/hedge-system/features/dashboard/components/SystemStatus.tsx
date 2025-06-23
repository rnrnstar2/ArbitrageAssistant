"use client";

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Wifi, WifiOff, Activity, Clock, Play, Square } from 'lucide-react';

interface SystemStats {
  wsConnections: number;
  trailMonitoring: number;
  pendingActions: number;
  executingActions: number;
  wsMessagesReceived: number;
  wsMessagesSent: number;
  wsErrors: number;
  wsUptime: number;
}

interface EngineStatus {
  actionSyncEngine: boolean;
  trailEngine: boolean;
  wsHandler: boolean;
}

interface WSServerState {
  is_running: boolean;
  port: number;
  host: string;
  connected_clients: number;
  total_messages_received: number;
  total_messages_sent: number;
  errors: number;
  uptime_seconds: number;
  started_at?: string;
}

export const SystemStatus: React.FC = () => {
  const [systemStats, setSystemStats] = useState<SystemStats>({
    wsConnections: 0,
    trailMonitoring: 0,
    pendingActions: 0,
    executingActions: 0,
    wsMessagesReceived: 0,
    wsMessagesSent: 0,
    wsErrors: 0,
    wsUptime: 0,
  });

  const [engineStatus, setEngineStatus] = useState<EngineStatus>({
    actionSyncEngine: false,
    trailEngine: false,
    wsHandler: false
  });

  const [wsServerState, setWsServerState] = useState<WSServerState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const updateStats = async () => {
      try {
        // Tauri WebSocketサーバーから実際の状態を取得
        const wsState = await invoke('get_websocket_server_status') as WSServerState;
        setWsServerState(wsState);

        // システム統計を更新
        setSystemStats({
          wsConnections: wsState.connected_clients,
          wsMessagesReceived: wsState.total_messages_received,
          wsMessagesSent: wsState.total_messages_sent,
          wsErrors: wsState.errors,
          wsUptime: wsState.uptime_seconds,
          // これらは他のサービスからの情報（未実装）
          trailMonitoring: 0, // TODO: TrailEngineから取得
          pendingActions: 0,  // TODO: ActionManagerから取得
          executingActions: 0, // TODO: ActionManagerから取得
        });

        // エンジン状態を更新
        setEngineStatus({
          wsHandler: wsState.is_running,
          actionSyncEngine: false, // TODO: ActionSyncEngineから取得
          trailEngine: false,      // TODO: TrailEngineから取得
        });

      } catch (error) {
        console.error('Failed to update system stats:', error);
        // エラー時はWebSocketサーバーが停止しているとみなす
        setEngineStatus(prev => ({ ...prev, wsHandler: false }));
      }
    };

    const interval = setInterval(updateStats, 2000);
    updateStats();

    return () => clearInterval(interval);
  }, []);

  const handleStartWebSocketServer = async () => {
    setIsLoading(true);
    try {
      await invoke('start_websocket_server', {
        port: 8080,
        host: '127.0.0.1',
        authToken: 'hedge-system-default-token'
      });
      console.log('WebSocket server started');
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopWebSocketServer = async () => {
    setIsLoading(true);
    try {
      await invoke('stop_websocket_server');
      console.log('WebSocket server stopped');
    } catch (error) {
      console.error('Failed to stop WebSocket server:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = () => {
    console.log('Manual sync triggered...');
    // TODO: 手動同期処理の実装
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">システム状態</h3>
        <div className="flex items-center gap-2">
          {wsServerState?.is_running ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-500" />
          )}
          <Badge variant={wsServerState?.is_running ? 'default' : 'secondary'}>
            {wsServerState?.is_running ? 'ONLINE' : 'OFFLINE'}
          </Badge>
        </div>
      </div>
      
      {/* WebSocketサーバー詳細情報 */}
      {wsServerState && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">WebSocket Server</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Address:</span>
              <span className="ml-2 font-mono">{wsServerState.host}:{wsServerState.port}</span>
            </div>
            <div>
              <span className="text-gray-600">Uptime:</span>
              <span className="ml-2 font-mono">{formatUptime(wsServerState.uptime_seconds)}</span>
            </div>
          </div>
        </div>
      )}

      {/* エンジン状態 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
            engineStatus.actionSyncEngine ? 'bg-green-500' : 'bg-gray-400'
          }`} />
          <div className="text-sm">Action Sync</div>
          <div className="text-xs text-gray-500">未実装</div>
        </div>
        <div className="text-center">
          <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
            engineStatus.trailEngine ? 'bg-green-500' : 'bg-gray-400'
          }`} />
          <div className="text-sm">Trail Engine</div>
          <div className="text-xs text-gray-500">未実装</div>
        </div>
        <div className="text-center">
          <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
            engineStatus.wsHandler ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <div className="text-sm">WebSocket</div>
          <div className="text-xs text-gray-500">Tauri統合</div>
        </div>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-50 p-3 rounded">
          <div className="text-xl font-bold text-blue-600">{systemStats.wsConnections}</div>
          <div className="text-xs text-gray-600">EA接続数</div>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <div className="text-xl font-bold text-green-600">{systemStats.wsMessagesReceived}</div>
          <div className="text-xs text-gray-600">受信メッセージ</div>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <div className="text-xl font-bold text-purple-600">{systemStats.wsMessagesSent}</div>
          <div className="text-xs text-gray-600">送信メッセージ</div>
        </div>
        <div className="bg-red-50 p-3 rounded">
          <div className="text-xl font-bold text-red-600">{systemStats.wsErrors}</div>
          <div className="text-xs text-gray-600">エラー数</div>
        </div>
      </div>

      {/* 追加統計（未実装） */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-xl font-bold text-gray-400">{systemStats.trailMonitoring}</div>
          <div className="text-xs text-gray-500">トレール監視中 (未実装)</div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-xl font-bold text-gray-400">{systemStats.pendingActions}</div>
          <div className="text-xs text-gray-500">待機中アクション (未実装)</div>
        </div>
      </div>

      {/* システム制御 */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {wsServerState?.is_running ? (
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={handleStopWebSocketServer}
              disabled={isLoading}
            >
              <Square className="h-4 w-4 mr-1" />
              WebSocket停止
            </Button>
          ) : (
            <Button 
              size="sm" 
              onClick={handleStartWebSocketServer}
              disabled={isLoading}
            >
              <Play className="h-4 w-4 mr-1" />
              WebSocket開始
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleManualSync}>
            <Clock className="h-4 w-4 mr-1" />
            手動同期
          </Button>
        </div>
        <div className="text-xs text-gray-500">
          * Action Sync Engine と Trail Engine は今後のアップデートで実装予定
        </div>
      </div>
    </Card>
  );
};