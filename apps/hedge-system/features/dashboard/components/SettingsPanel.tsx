"use client";

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Switch } from '@repo/ui/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Badge } from '@repo/ui/components/ui/badge';
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert';
import { 
  Settings, 
  Server, 
  Bell, 
  Shield, 
  Save, 
  Upload, 
  Download,
  AlertTriangle,
  CheckCircle2,
  Monitor,
  Database
} from 'lucide-react';

interface MT5ConnectionSettings {
  serverHost: string;
  serverPort: number;
  accountNumber: string;
  loginPassword: string;
  authToken: string;
  timeoutMs: number;
  enableSsl: boolean;
  maxRetries: number;
}

interface NotificationSettings {
  enableDesktopNotifications: boolean;
  enableSoundAlerts: boolean;
  positionUpdates: boolean;
  connectionLoss: boolean;
  trailTriggers: boolean;
  systemErrors: boolean;
  soundVolume: number;
  soundType: 'default' | 'chime' | 'alert' | 'custom';
}

interface SystemSettings {
  wsServerPort: number;
  wsServerHost: string;
  autoStartWs: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxLogFiles: number;
  dataUpdateInterval: number;
  positionMonitorInterval: number;
  reconnectInterval: number;
}

interface SettingsPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * SettingsPanel - MVPシステム設計書準拠
 * システム設定、MT5接続設定、通知設定
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isVisible, onClose }) => {
  const [mt5Settings, setMt5Settings] = useState<MT5ConnectionSettings>({
    serverHost: '127.0.0.1',
    serverPort: 8080,
    accountNumber: '',
    loginPassword: '',
    authToken: 'hedge-system-default-token',
    timeoutMs: 30000,
    enableSsl: false,
    maxRetries: 3
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enableDesktopNotifications: true,
    enableSoundAlerts: true,
    positionUpdates: true,
    connectionLoss: true,
    trailTriggers: true,
    systemErrors: true,
    soundVolume: 50,
    soundType: 'default'
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    wsServerPort: 8080,
    wsServerHost: '127.0.0.1',
    autoStartWs: true,
    logLevel: 'info',
    maxLogFiles: 10,
    dataUpdateInterval: 1000,
    positionMonitorInterval: 500,
    reconnectInterval: 5000
  });

  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error' | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // 設定を読み込み
  useEffect(() => {
    if (isVisible) {
      loadSettings();
    }
  }, [isVisible]);

  const loadSettings = async () => {
    try {
      const settings = await invoke('get_system_settings') as any;
      
      if (settings.mt5) {
        setMt5Settings(prev => ({ ...prev, ...settings.mt5 }));
      }
      if (settings.notifications) {
        setNotificationSettings(prev => ({ ...prev, ...settings.notifications }));
      }
      if (settings.system) {
        setSystemSettings(prev => ({ ...prev, ...settings.system }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      await invoke('save_system_settings', {
        settings: {
          mt5: mt5Settings,
          notifications: notificationSettings,
          system: systemSettings
        }
      });
      
      setSaveStatus('設定を保存しました');
      
      // 通知設定をテスト
      if (notificationSettings.enableDesktopNotifications) {
        await testNotification();
      }
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const testMT5Connection = async () => {
    setConnectionStatus('testing');
    
    try {
      const result = await invoke('test_mt5_connection', {
        settings: mt5Settings
      }) as any;
      
      if (result.success) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('MT5 connection test failed:', error);
      setConnectionStatus('error');
    }
  };

  const testNotification = async () => {
    try {
      await invoke('send_test_notification', {
        title: 'Hedge System テスト',
        message: '通知設定が正常に動作しています',
        soundEnabled: notificationSettings.enableSoundAlerts
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  };

  const exportSettings = async () => {
    try {
      const filePath = await save({
        defaultPath: 'hedge-system-settings.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });
      
      if (filePath) {
        await invoke('export_settings', { filePath });
        setSaveStatus('設定をエクスポートしました');
      }
    } catch (error) {
      console.error('Failed to export settings:', error);
      setSaveStatus('エクスポートに失敗しました');
    }
  };

  const importSettings = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });
      
      if (filePath) {
        const importedSettings = await invoke('import_settings', { filePath }) as any;
        
        if (importedSettings.mt5) setMt5Settings(importedSettings.mt5);
        if (importedSettings.notifications) setNotificationSettings(importedSettings.notifications);
        if (importedSettings.system) setSystemSettings(importedSettings.system);
        
        setSaveStatus('設定をインポートしました');
      }
    } catch (error) {
      console.error('Failed to import settings:', error);
      setSaveStatus('インポートに失敗しました');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <Settings className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold">システム設定</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={exportSettings}>
              <Download className="h-4 w-4 mr-1" />
              エクスポート
            </Button>
            <Button variant="outline" size="sm" onClick={importSettings}>
              <Upload className="h-4 w-4 mr-1" />
              インポート
            </Button>
            <Button variant="outline" onClick={onClose}>閉じる</Button>
          </div>
        </div>

        {/* Status Alert */}
        {saveStatus && (
          <div className="p-4 border-b">
            <Alert variant={saveStatus.includes('失敗') ? 'destructive' : 'default'}>
              {saveStatus.includes('失敗') ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription>{saveStatus}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="mt5" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mx-6 mt-4">
              <TabsTrigger value="mt5" className="flex items-center space-x-1">
                <Server className="h-4 w-4" />
                <span>MT5接続</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center space-x-1">
                <Bell className="h-4 w-4" />
                <span>通知設定</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center space-x-1">
                <Monitor className="h-4 w-4" />
                <span>システム</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto p-6">
              {/* MT5接続設定 */}
              <TabsContent value="mt5" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>MT4/MT5 接続設定</span>
                      <div className="flex items-center space-x-2">
                        {connectionStatus === 'success' && (
                          <Badge variant="default" className="bg-green-100 text-green-700">
                            接続OK
                          </Badge>
                        )}
                        {connectionStatus === 'error' && (
                          <Badge variant="destructive">接続失敗</Badge>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={testMT5Connection}
                          disabled={connectionStatus === 'testing'}
                        >
                          {connectionStatus === 'testing' ? '接続中...' : '接続テスト'}
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="serverHost">サーバーホスト</Label>
                        <Input
                          id="serverHost"
                          value={mt5Settings.serverHost}
                          onChange={(e) => setMt5Settings(prev => ({ ...prev, serverHost: e.target.value }))}
                          placeholder="127.0.0.1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="serverPort">ポート</Label>
                        <Input
                          id="serverPort"
                          type="number"
                          value={mt5Settings.serverPort}
                          onChange={(e) => setMt5Settings(prev => ({ ...prev, serverPort: parseInt(e.target.value) }))}
                          placeholder="8080"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="accountNumber">口座番号</Label>
                        <Input
                          id="accountNumber"
                          value={mt5Settings.accountNumber}
                          onChange={(e) => setMt5Settings(prev => ({ ...prev, accountNumber: e.target.value }))}
                          placeholder="12345678"
                        />
                      </div>
                      <div>
                        <Label htmlFor="authToken">認証トークン</Label>
                        <Input
                          id="authToken"
                          type="password"
                          value={mt5Settings.authToken}
                          onChange={(e) => setMt5Settings(prev => ({ ...prev, authToken: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="timeoutMs">タイムアウト (ms)</Label>
                        <Input
                          id="timeoutMs"
                          type="number"
                          value={mt5Settings.timeoutMs}
                          onChange={(e) => setMt5Settings(prev => ({ ...prev, timeoutMs: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxRetries">最大リトライ回数</Label>
                        <Input
                          id="maxRetries"
                          type="number"
                          value={mt5Settings.maxRetries}
                          onChange={(e) => setMt5Settings(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-6">
                        <Switch
                          id="enableSsl"
                          checked={mt5Settings.enableSsl}
                          onCheckedChange={(checked) => setMt5Settings(prev => ({ ...prev, enableSsl: checked }))}
                        />
                        <Label htmlFor="enableSsl">SSL有効</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 通知設定 */}
              <TabsContent value="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>通知とアラート設定</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={testNotification}
                      >
                        テスト通知
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="desktopNotifications">デスクトップ通知</Label>
                          <p className="text-sm text-gray-500">システム通知を表示</p>
                        </div>
                        <Switch
                          id="desktopNotifications"
                          checked={notificationSettings.enableDesktopNotifications}
                          onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, enableDesktopNotifications: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="soundAlerts">音声アラート</Label>
                          <p className="text-sm text-gray-500">重要イベント時に音で通知</p>
                        </div>
                        <Switch
                          id="soundAlerts"
                          checked={notificationSettings.enableSoundAlerts}
                          onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, enableSoundAlerts: checked }))}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">通知する項目</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="positionUpdates">ポジション更新</Label>
                          <Switch
                            id="positionUpdates"
                            checked={notificationSettings.positionUpdates}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, positionUpdates: checked }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="connectionLoss">接続断</Label>
                          <Switch
                            id="connectionLoss"
                            checked={notificationSettings.connectionLoss}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, connectionLoss: checked }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="trailTriggers">トレール発動</Label>
                          <Switch
                            id="trailTriggers"
                            checked={notificationSettings.trailTriggers}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, trailTriggers: checked }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="systemErrors">システムエラー</Label>
                          <Switch
                            id="systemErrors"
                            checked={notificationSettings.systemErrors}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, systemErrors: checked }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">音声設定</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="soundVolume">音量: {notificationSettings.soundVolume}%</Label>
                          <input
                            id="soundVolume"
                            type="range"
                            min="0"
                            max="100"
                            value={notificationSettings.soundVolume}
                            onChange={(e) => setNotificationSettings(prev => ({ ...prev, soundVolume: parseInt(e.target.value) }))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label htmlFor="soundType">音声タイプ</Label>
                          <Select 
                            value={notificationSettings.soundType} 
                            onValueChange={(value: any) => setNotificationSettings(prev => ({ ...prev, soundType: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">デフォルト</SelectItem>
                              <SelectItem value="chime">チャイム</SelectItem>
                              <SelectItem value="alert">アラート</SelectItem>
                              <SelectItem value="custom">カスタム</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* システム設定 */}
              <TabsContent value="system" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>WebSocketサーバー設定</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="wsHost">ホスト</Label>
                        <Input
                          id="wsHost"
                          value={systemSettings.wsServerHost}
                          onChange={(e) => setSystemSettings(prev => ({ ...prev, wsServerHost: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="wsPort">ポート</Label>
                        <Input
                          id="wsPort"
                          type="number"
                          value={systemSettings.wsServerPort}
                          onChange={(e) => setSystemSettings(prev => ({ ...prev, wsServerPort: parseInt(e.target.value) }))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="autoStartWs"
                        checked={systemSettings.autoStartWs}
                        onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, autoStartWs: checked }))}
                      />
                      <Label htmlFor="autoStartWs">システム起動時に自動開始</Label>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>監視間隔設定</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="dataUpdate">データ更新間隔 (ms)</Label>
                        <Input
                          id="dataUpdate"
                          type="number"
                          value={systemSettings.dataUpdateInterval}
                          onChange={(e) => setSystemSettings(prev => ({ ...prev, dataUpdateInterval: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="positionMonitor">ポジション監視間隔 (ms)</Label>
                        <Input
                          id="positionMonitor"
                          type="number"
                          value={systemSettings.positionMonitorInterval}
                          onChange={(e) => setSystemSettings(prev => ({ ...prev, positionMonitorInterval: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="reconnect">再接続間隔 (ms)</Label>
                        <Input
                          id="reconnect"
                          type="number"
                          value={systemSettings.reconnectInterval}
                          onChange={(e) => setSystemSettings(prev => ({ ...prev, reconnectInterval: parseInt(e.target.value) }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>ログ設定</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="logLevel">ログレベル</Label>
                        <Select 
                          value={systemSettings.logLevel} 
                          onValueChange={(value: any) => setSystemSettings(prev => ({ ...prev, logLevel: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="debug">Debug</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                            <SelectItem value="warn">Warning</SelectItem>
                            <SelectItem value="error">Error</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="maxLogFiles">最大ログファイル数</Label>
                        <Input
                          id="maxLogFiles"
                          type="number"
                          value={systemSettings.maxLogFiles}
                          onChange={(e) => setSystemSettings(prev => ({ ...prev, maxLogFiles: parseInt(e.target.value) }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            設定は自動的にローカルファイルに保存されます
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button onClick={saveSettings} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? '保存中...' : '設定を保存'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};