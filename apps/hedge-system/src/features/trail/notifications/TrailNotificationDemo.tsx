/**
 * トレール通知システム - デモコンポーネント
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Badge } from '@repo/ui/components/ui/badge';
import { TestTube, Play, Settings, RotateCcw } from 'lucide-react';
import { 
  useTrailNotifications,
  TrailNotificationType,
  createTrailNotificationData
} from './useTrailNotifications';
import { TrailNotificationPanel } from './TrailNotificationPanel';
import { TrailNotificationBadge, TrailNotificationToast } from './TrailNotificationBadge';

interface DemoScenario {
  id: string;
  name: string;
  description: string;
  notifications: Array<{
    type: TrailNotificationType;
    delay: number;
    customData?: any;
  }>;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'basic_trail',
    name: '基本的なトレール',
    description: 'トレール開始から損切りライン更新まで',
    notifications: [
      { type: 'trail_started', delay: 0 },
      { type: 'trail_updated', delay: 2000 },
      { type: 'trail_updated', delay: 4000 },
      { type: 'max_profit_updated', delay: 6000 }
    ]
  },
  {
    id: 'trail_execution',
    name: 'トレール実行シナリオ',
    description: 'トレール開始から決済実行まで',
    notifications: [
      { type: 'trail_started', delay: 0 },
      { type: 'trail_updated', delay: 1500 },
      { type: 'price_threshold', delay: 3000 },
      { type: 'trail_executed', delay: 4500 }
    ]
  },
  {
    id: 'error_scenario',
    name: 'エラーシナリオ',
    description: 'トレール中のエラーと警告',
    notifications: [
      { type: 'trail_started', delay: 0 },
      { type: 'trail_warning', delay: 2000, customData: { error: 'ネットワーク遅延が検出されました' } },
      { type: 'connection_lost', delay: 4000 },
      { type: 'trail_error', delay: 6000, customData: { error: 'EA接続が切断されました' } }
    ]
  },
  {
    id: 'high_volume',
    name: '高頻度通知テスト',
    description: '短時間での多数の通知',
    notifications: [
      { type: 'trail_started', delay: 0 },
      { type: 'trail_updated', delay: 500 },
      { type: 'trail_updated', delay: 1000 },
      { type: 'trail_updated', delay: 1500 },
      { type: 'trail_updated', delay: 2000 },
      { type: 'trail_updated', delay: 2500 },
      { type: 'max_profit_updated', delay: 3000 }
    ]
  }
];

export function TrailNotificationDemo() {
  const [isRunning, setIsRunning] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [customSymbol, setCustomSymbol] = useState('USDJPY');
  const [customPrice, setCustomPrice] = useState('110.50');
  const [customProfit, setCustomProfit] = useState('250.00');
  
  const {
    notifications,
    unacknowledgedCount,
    settings,
    updateSettings,
    clearNotifications,
    testNotification
  } = useTrailNotifications();

  const createDemoData = (customData?: any) => {
    return createTrailNotificationData(
      `DEMO_${Date.now()}`,
      customSymbol,
      'DEMO_ACCOUNT',
      `demo_trail_${Date.now()}`,
      {
        currentPrice: parseFloat(customPrice),
        stopLossPrice: parseFloat(customPrice) - 0.50,
        profit: parseFloat(customProfit),
        trailType: 'fixed' as const,
        trailAmount: 50,
        ...customData
      }
    );
  };

  const runScenario = async (scenario: DemoScenario) => {
    setIsRunning(true);
    
    try {
      for (const notification of scenario.notifications) {
        await new Promise(resolve => setTimeout(resolve, notification.delay));
        
        const data = createDemoData(notification.customData);
        
        switch (notification.type) {
          case 'trail_started':
            await testNotification('trail_started');
            break;
          case 'trail_updated':
            await testNotification('trail_updated');
            break;
          case 'trail_executed':
            await testNotification('trail_executed');
            break;
          case 'trail_error':
            await testNotification('trail_error');
            break;
          case 'trail_warning':
            await testNotification('trail_warning');
            break;
          case 'price_threshold':
            await testNotification('price_threshold');
            break;
          case 'connection_lost':
            await testNotification('connection_lost');
            break;
          case 'max_profit_updated':
            await testNotification('max_profit_updated');
            break;
          default:
            await testNotification();
        }
      }
    } catch (error) {
      console.error('Demo scenario error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const quickTestNotification = async (type: TrailNotificationType) => {
    try {
      await testNotification(type);
    } catch (error) {
      console.error('Quick test error:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">トレール通知システム デモ</h1>
          <p className="text-gray-600">通知システムのテストとデモンストレーション</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <TrailNotificationBadge size="lg" />
          <Badge variant={settings.enabled ? 'default' : 'secondary'}>
            {settings.enabled ? '通知有効' : '通知無効'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* コントロールパネル */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TestTube className="h-5 w-5" />
              <span>テストコントロール</span>
            </CardTitle>
            <CardDescription>
              様々な通知をテストできます
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* シナリオテスト */}
            <div>
              <Label className="text-sm font-medium">シナリオテスト</Label>
              <div className="flex space-x-2 mt-1">
                <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="シナリオを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_SCENARIOS.map(scenario => (
                      <SelectItem key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    const scenario = DEMO_SCENARIOS.find(s => s.id === selectedScenario);
                    if (scenario) runScenario(scenario);
                  }}
                  disabled={!selectedScenario || isRunning}
                  className="flex items-center space-x-1"
                >
                  <Play className="h-4 w-4" />
                  <span>{isRunning ? '実行中...' : '実行'}</span>
                </Button>
              </div>
              {selectedScenario && (
                <p className="text-xs text-gray-500 mt-1">
                  {DEMO_SCENARIOS.find(s => s.id === selectedScenario)?.description}
                </p>
              )}
            </div>

            {/* カスタムデータ */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">シンボル</Label>
                <Input
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">価格</Label>
                <Input
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">利益</Label>
                <Input
                  value={customProfit}
                  onChange={(e) => setCustomProfit(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* 個別通知テスト */}
            <div>
              <Label className="text-sm font-medium">個別通知テスト</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickTestNotification('trail_started')}
                  className="text-xs"
                >
                  開始
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickTestNotification('trail_updated')}
                  className="text-xs"
                >
                  更新
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickTestNotification('trail_executed')}
                  className="text-xs"
                >
                  実行
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickTestNotification('trail_error')}
                  className="text-xs"
                >
                  エラー
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickTestNotification('trail_warning')}
                  className="text-xs"
                >
                  警告
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickTestNotification('connection_lost')}
                  className="text-xs"
                >
                  接続断
                </Button>
              </div>
            </div>

            {/* 設定コントロール */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">通知設定</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateSettings({ enabled: !settings.enabled })}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  {settings.enabled ? '無効化' : '有効化'}
                </Button>
              </div>
            </div>

            {/* クリアボタン */}
            <Button
              variant="outline"
              size="sm"
              onClick={clearNotifications}
              disabled={notifications.length === 0}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              通知履歴をクリア
            </Button>
          </CardContent>
        </Card>

        {/* 通知パネル */}
        <TrailNotificationPanel className="h-fit" />
      </div>

      {/* トーストとステータス */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">システム状態</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>通知総数:</span>
              <Badge variant="outline">{notifications.length}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>未確認:</span>
              <Badge variant={unacknowledgedCount > 0 ? 'destructive' : 'secondary'}>
                {unacknowledgedCount}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>デスクトップ通知:</span>
              <Badge variant={settings.showDesktopNotifications ? 'default' : 'secondary'}>
                {settings.showDesktopNotifications ? 'ON' : 'OFF'}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>音声通知:</span>
              <Badge variant={settings.enableSounds ? 'default' : 'secondary'}>
                {settings.enableSounds ? 'ON' : 'OFF'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">シナリオ一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {DEMO_SCENARIOS.map(scenario => (
                <div
                  key={scenario.id}
                  className={`text-xs p-2 rounded border cursor-pointer hover:bg-gray-50 ${
                    selectedScenario === scenario.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => setSelectedScenario(scenario.id)}
                >
                  <div className="font-medium">{scenario.name}</div>
                  <div className="text-gray-500">{scenario.notifications.length}ステップ</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">最新の通知</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.slice(0, 3).map(notification => (
                  <div key={notification.id} className="text-xs p-2 bg-gray-50 rounded">
                    <div className="font-medium">{notification.title}</div>
                    <div className="text-gray-500 truncate">{notification.message}</div>
                    <div className="text-gray-400">
                      {new Date(notification.timestamp).toLocaleTimeString('ja-JP')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 text-center py-4">
                まだ通知がありません
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* トースト通知 */}
      <TrailNotificationToast position="top-right" maxVisible={3} />
    </div>
  );
}