"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  isPermissionGranted, 
  requestPermission, 
  sendNotification 
} from '@tauri-apps/plugin-notification';
import { save, open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert';
import { 
  Monitor, 
  Bell, 
  FolderOpen, 
  Download, 
  Upload,
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Settings as SettingsIcon,
  Shield,
  HardDrive,
  Wifi
} from 'lucide-react';

interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  totalMemory: number;
  availableMemory: number;
  cpuCount: number;
  diskSpace: {
    total: number;
    available: number;
  };
}

interface TauriServiceStatus {
  webSocketServer: {
    running: boolean;
    port?: number;
    connections: number;
    errors: number;
  };
  fileSystem: {
    configPath: string;
    logsPath: string;
    dataPath: string;
    diskUsage: number;
  };
  notifications: {
    permission: boolean;
    lastSent?: string;
    queue: number;
  };
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    uptime: number;
  };
}

interface TauriIntegrationProps {
  onStatusChange?: (status: TauriServiceStatus) => void;
}

/**
 * TauriIntegration - MVPシステム設計書準拠
 * Rust バックエンド連携、システム通知、ファイル操作
 */
export const TauriIntegration: React.FC<TauriIntegrationProps> = ({ onStatusChange }) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [serviceStatus, setServiceStatus] = useState<TauriServiceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOperation, setLastOperation] = useState<string | null>(null);

  // システム情報を取得
  const loadSystemInfo = useCallback(async () => {
    try {
      const info = await invoke('get_system_info') as SystemInfo;
      setSystemInfo(info);
    } catch (err) {
      console.error('Failed to load system info:', err);
      setError('システム情報の取得に失敗しました');
    }
  }, []);

  // サービス状態を取得
  const loadServiceStatus = useCallback(async () => {
    try {
      const status = await invoke('get_service_status') as TauriServiceStatus;
      setServiceStatus(status);
      
      if (onStatusChange) {
        onStatusChange(status);
      }
    } catch (err) {
      console.error('Failed to load service status:', err);
      setError('サービス状態の取得に失敗しました');
    }
  }, [onStatusChange]);

  // 通知権限の確認と要求
  const setupNotifications = useCallback(async () => {
    try {
      let permissionGranted = await isPermissionGranted();
      
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
      
      if (permissionGranted) {
        await invoke('enable_notifications');
        setLastOperation('通知権限が有効になりました');
      } else {
        setError('通知権限が拒否されました');
      }
      
      await loadServiceStatus();
    } catch (err) {
      console.error('Failed to setup notifications:', err);
      setError('通知設定に失敗しました');
    }
  }, [loadServiceStatus]);

  // テスト通知を送信
  const sendTestNotification = useCallback(async () => {
    try {
      await sendNotification({
        title: 'Hedge System テスト',
        body: 'Tauriシステム通知が正常に動作しています',
        icon: 'icon.png'
      });
      
      setLastOperation('テスト通知を送信しました');
      await loadServiceStatus();
    } catch (err) {
      console.error('Failed to send test notification:', err);
      setError('通知送信に失敗しました');
    }
  }, [loadServiceStatus]);

  // 設定ファイルをエクスポート
  const exportConfiguration = useCallback(async () => {
    try {
      const filePath = await save({
        defaultPath: 'hedge-system-config.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });
      
      if (filePath) {
        await invoke('export_configuration', { filePath });
        setLastOperation('設定をエクスポートしました');
      }
    } catch (err) {
      console.error('Failed to export configuration:', err);
      setError('設定エクスポートに失敗しました');
    }
  }, []);

  // 設定ファイルをインポート
  const importConfiguration = useCallback(async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });
      
      if (filePath) {
        await invoke('import_configuration', { filePath });
        setLastOperation('設定をインポートしました');
        await loadServiceStatus();
      }
    } catch (err) {
      console.error('Failed to import configuration:', err);
      setError('設定インポートに失敗しました');
    }
  }, [loadServiceStatus]);

  // ログファイルを開く
  const openLogDirectory = useCallback(async () => {
    try {
      await invoke('open_log_directory');
      setLastOperation('ログディレクトリを開きました');
    } catch (err) {
      console.error('Failed to open log directory:', err);
      setError('ログディレクトリを開けませんでした');
    }
  }, []);

  // データディレクトリをクリア
  const clearDataDirectory = useCallback(async () => {
    if (confirm('データディレクトリをクリアしますか？この操作は元に戻せません。')) {
      try {
        await invoke('clear_data_directory');
        setLastOperation('データディレクトリをクリアしました');
        await loadServiceStatus();
      } catch (err) {
        console.error('Failed to clear data directory:', err);
        setError('データディレクトリのクリアに失敗しました');
      }
    }
  }, [loadServiceStatus]);

  // WebSocketサーバーの制御
  const toggleWebSocketServer = useCallback(async () => {
    setIsLoading(true);
    try {
      if (serviceStatus?.webSocketServer.running) {
        await invoke('stop_websocket_server');
        setLastOperation('WebSocketサーバーを停止しました');
      } else {
        await invoke('start_websocket_server', {
          port: 8080,
          host: '127.0.0.1'
        });
        setLastOperation('WebSocketサーバーを開始しました');
      }
      
      await loadServiceStatus();
    } catch (err) {
      console.error('Failed to toggle WebSocket server:', err);
      setError('WebSocketサーバーの制御に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [serviceStatus, loadServiceStatus]);

  // バックアップの作成
  const createBackup = useCallback(async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = await save({
        defaultPath: `hedge-system-backup-${timestamp}.zip`,
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
      });
      
      if (backupPath) {
        await invoke('create_backup', { backupPath });
        setLastOperation('バックアップを作成しました');
      }
    } catch (err) {
      console.error('Failed to create backup:', err);
      setError('バックアップの作成に失敗しました');
    }
  }, []);

  // 初期化
  useEffect(() => {
    loadSystemInfo();
    loadServiceStatus();
    setupNotifications();

    // 定期的にサービス状態を更新
    const interval = setInterval(loadServiceStatus, 5000);
    return () => clearInterval(interval);
  }, [loadSystemInfo, loadServiceStatus, setupNotifications]);

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-4" 
              onClick={() => setError(null)}
            >
              閉じる
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {lastOperation && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            {lastOperation}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-4" 
              onClick={() => setLastOperation(null)}
            >
              閉じる
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* System Information */}
      {systemInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Monitor className="h-5 w-5" />
              <span>システム情報</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">プラットフォーム:</span>
                <div className="font-medium">{systemInfo.platform} {systemInfo.arch}</div>
              </div>
              <div>
                <span className="text-gray-500">バージョン:</span>
                <div className="font-medium">{systemInfo.version}</div>
              </div>
              <div>
                <span className="text-gray-500">CPU:</span>
                <div className="font-medium">{systemInfo.cpuCount} cores</div>
              </div>
              <div>
                <span className="text-gray-500">メモリ:</span>
                <div className="font-medium">
                  {formatBytes(systemInfo.availableMemory)} / {formatBytes(systemInfo.totalMemory)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Status */}
      {serviceStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* WebSocket Server */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wifi className="h-4 w-4" />
                  <span>WebSocket サーバー</span>
                </div>
                <Badge variant={serviceStatus.webSocketServer.running ? 'default' : 'secondary'}>
                  {serviceStatus.webSocketServer.running ? '稼働中' : '停止中'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>ポート:</span>
                <span>{serviceStatus.webSocketServer.port || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>接続数:</span>
                <span>{serviceStatus.webSocketServer.connections}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>エラー:</span>
                <span className={serviceStatus.webSocketServer.errors > 0 ? 'text-red-600' : ''}>
                  {serviceStatus.webSocketServer.errors}
                </span>
              </div>
              <Button 
                size="sm" 
                className="w-full mt-3"
                variant={serviceStatus.webSocketServer.running ? 'destructive' : 'default'}
                onClick={toggleWebSocketServer}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    処理中...
                  </>
                ) : serviceStatus.webSocketServer.running ? (
                  '停止'
                ) : (
                  '開始'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* File System */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <HardDrive className="h-4 w-4" />
                <span>ファイルシステム</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>ディスク使用量:</span>
                <span>{formatBytes(serviceStatus.fileSystem.diskUsage)}</span>
              </div>
              <div className="space-y-1">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full" 
                  onClick={openLogDirectory}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  ログを開く
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full" 
                  onClick={createBackup}
                >
                  <Download className="h-4 w-4 mr-1" />
                  バックアップ
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  className="w-full" 
                  onClick={clearDataDirectory}
                >
                  データクリア
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="h-4 w-4" />
                  <span>通知システム</span>
                </div>
                <Badge variant={serviceStatus.notifications.permission ? 'default' : 'secondary'}>
                  {serviceStatus.notifications.permission ? '有効' : '無効'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>キュー:</span>
                <span>{serviceStatus.notifications.queue}</span>
              </div>
              {serviceStatus.notifications.lastSent && (
                <div className="flex justify-between text-sm">
                  <span>最終送信:</span>
                  <span className="text-xs">
                    {new Date(serviceStatus.notifications.lastSent).toLocaleTimeString()}
                  </span>
                </div>
              )}
              <div className="space-y-1">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full" 
                  onClick={sendTestNotification}
                >
                  テスト通知
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full" 
                  onClick={setupNotifications}
                >
                  権限設定
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Metrics */}
      {serviceStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>パフォーマンス</span>
              </div>
              <div className="text-sm text-gray-500">
                稼働時間: {formatUptime(serviceStatus.performance.uptime)}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm">CPU使用率</span>
                  <span className="text-sm font-medium">{serviceStatus.performance.cpuUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(serviceStatus.performance.cpuUsage, 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm">メモリ使用率</span>
                  <span className="text-sm font-medium">{serviceStatus.performance.memoryUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(serviceStatus.performance.memoryUsage, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SettingsIcon className="h-5 w-5" />
            <span>クイックアクション</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button variant="outline" size="sm" onClick={exportConfiguration}>
              <Download className="h-4 w-4 mr-1" />
              設定エクスポート
            </Button>
            <Button variant="outline" size="sm" onClick={importConfiguration}>
              <Upload className="h-4 w-4 mr-1" />
              設定インポート
            </Button>
            <Button variant="outline" size="sm" onClick={loadServiceStatus}>
              <RefreshCw className="h-4 w-4 mr-1" />
              状態更新
            </Button>
            <Button variant="outline" size="sm" onClick={openLogDirectory}>
              <FolderOpen className="h-4 w-4 mr-1" />
              ログ表示
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};