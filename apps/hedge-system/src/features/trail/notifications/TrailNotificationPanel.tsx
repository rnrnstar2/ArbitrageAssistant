/**
 * トレール通知システム - UIコンポーネント
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Switch } from '@repo/ui/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select';
import { 
  Bell, 
  Settings, 
  Volume2, 
  VolumeX, 
  CheckCircle, 
  X, 
  Eye, 
  EyeOff,
  TestTube,
  Trash2
} from 'lucide-react';
import { 
  useTrailNotifications,
  TrailNotification,
  TrailNotificationType,
  TrailSoundType
} from './useTrailNotifications';

interface TrailNotificationPanelProps {
  className?: string;
}

export function TrailNotificationPanel({ className }: TrailNotificationPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const {
    notifications,
    unacknowledgedCount,
    settings,
    updateSettings,
    acknowledge,
    acknowledgeAll,
    clearNotifications,
    testNotification
  } = useTrailNotifications();

  const handleTestNotification = async (type?: TrailNotificationType) => {
    try {
      await testNotification(type);
    } catch (error) {
      console.error('Test notification failed:', error);
    }
  };

  const getSeverityIcon = (severity: TrailNotification['severity']) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  const getSeverityColor = (severity: TrailNotification['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'error': return 'bg-red-100 text-red-700 border-red-200';
      case 'warning': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'success': return 'bg-green-100 text-green-700 border-green-200';
      case 'info': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTypeLabel = (type: TrailNotificationType) => {
    const labels: Record<TrailNotificationType, string> = {
      trail_started: 'トレール開始',
      trail_updated: '損切り更新',
      trail_stopped: 'トレール停止',
      trail_executed: 'トレール実行',
      trail_error: 'エラー',
      trail_warning: '警告',
      price_threshold: '価格閾値',
      connection_lost: '接続断',
      max_profit_updated: '最大利益更新'
    };
    return labels[type] || type;
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bell className="h-5 w-5" />
              {unacknowledgedCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
                </Badge>
              )}
            </div>
            <div>
              <CardTitle className="text-lg">トレール通知</CardTitle>
              <CardDescription>
                {unacknowledgedCount > 0 
                  ? `${unacknowledgedCount}件の未確認通知があります`
                  : '全ての通知を確認済み'
                }
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showHistory ? '最新のみ' : '履歴表示'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 設定パネル */}
        {showSettings && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h4 className="font-medium flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>通知設定</span>
            </h4>
            
            {/* 基本設定 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">通知を有効</label>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => updateSettings({ enabled: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">デスクトップ通知</label>
                <Switch
                  checked={settings.showDesktopNotifications}
                  onCheckedChange={(checked) => updateSettings({ showDesktopNotifications: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">音声通知</label>
                <Switch
                  checked={settings.enableSounds}
                  onCheckedChange={(checked) => updateSettings({ enableSounds: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">macOS通知</label>
                <Switch
                  checked={settings.enableMacOSNotifications}
                  onCheckedChange={(checked) => updateSettings({ enableMacOSNotifications: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">自動クローズ</label>
                <Switch
                  checked={settings.autoClose}
                  onCheckedChange={(checked) => updateSettings({ autoClose: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">自動クローズ時間</label>
                <Select
                  value={settings.autoCloseDelay.toString()}
                  onValueChange={(value) => updateSettings({ autoCloseDelay: parseInt(value) })}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3秒</SelectItem>
                    <SelectItem value="5">5秒</SelectItem>
                    <SelectItem value="10">10秒</SelectItem>
                    <SelectItem value="15">15秒</SelectItem>
                    <SelectItem value="30">30秒</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 通知レベル設定 */}
            <div>
              <h5 className="text-sm font-medium mb-2">通知レベル</h5>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {Object.entries(settings.levels).map(([type, enabled]) => (
                  <div key={type} className="flex items-center justify-between">
                    <label className="truncate">{getTypeLabel(type as TrailNotificationType)}</label>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => 
                        updateSettings({ 
                          levels: { ...settings.levels, [type]: checked }
                        })
                      }
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* テストボタン */}
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestNotification()}
                className="flex items-center space-x-1"
              >
                <TestTube className="h-3 w-3" />
                <span>テスト通知</span>
              </Button>
              
              <Select onValueChange={(value) => handleTestNotification(value as TrailNotificationType)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="種類選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trail_started">開始</SelectItem>
                  <SelectItem value="trail_executed">実行</SelectItem>
                  <SelectItem value="trail_error">エラー</SelectItem>
                  <SelectItem value="trail_warning">警告</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* 通知リスト */}
        <div className="space-y-2">
          {(showHistory ? notifications : recentNotifications).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>通知がありません</p>
            </div>
          ) : (
            (showHistory ? notifications : recentNotifications).map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border ${
                  notification.acknowledged 
                    ? 'bg-gray-50 border-gray-200' 
                    : getSeverityColor(notification.severity)
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{getSeverityIcon(notification.severity)}</span>
                      <Badge variant="outline" className="text-xs">
                        {getTypeLabel(notification.type)}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {formatTime(notification.timestamp)}
                      </span>
                      {notification.acknowledged && (
                        <Badge variant="secondary" className="text-xs">
                          確認済み
                        </Badge>
                      )}
                    </div>
                    
                    <h5 className="font-medium text-sm mb-1">{notification.title}</h5>
                    <p className="text-sm text-gray-700">{notification.message}</p>
                    
                    {/* データ詳細 */}
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      <div>シンボル: {notification.data.symbol} | ポジション: {notification.data.positionId}</div>
                      {notification.data.currentPrice && (
                        <div>現在価格: {notification.data.currentPrice.toFixed(2)}</div>
                      )}
                      {notification.data.profit !== undefined && (
                        <div>損益: {notification.data.profit > 0 ? '+' : ''}{notification.data.profit.toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    {notification.soundType && settings.enableSounds && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {/* プレビュー音再生 */}}
                        className="h-6 w-6 p-0"
                      >
                        {settings.enableSounds ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                      </Button>
                    )}
                    
                    {!notification.acknowledged && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => acknowledge(notification.id)}
                        className="h-6 w-6 p-0"
                      >
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* フッター */}
      {notifications.length > 0 && (
        <CardFooter className="flex justify-between">
          <div className="text-sm text-gray-500">
            全{notifications.length}件 {unacknowledgedCount > 0 && `(未確認: ${unacknowledgedCount}件)`}
          </div>
          
          <div className="flex items-center space-x-2">
            {unacknowledgedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={acknowledgeAll}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                全て確認
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={clearNotifications}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              クリア
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}