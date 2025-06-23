'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Activity, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { SystemStatusCard } from './SystemStatusCard';
import { EAConnectionPanel } from './EAConnectionPanel';
import { RealTimeChart } from './RealTimeChart';
import { AlertPanel } from './AlertPanel';
import { QuickActions } from './QuickActions';
import { useRealtimeData } from '../hooks/useRealtimeData';

export function MonitoringDashboard() {
  const { 
    systemStatus, 
    connections, 
    alerts, 
    metrics,
    loading, 
    error 
  } = useRealtimeData();

  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        // リアルタイムデータの強制更新
        // 通常はWebSocketで自動更新されるが、念のため定期更新も実装
      }, 30000); // 30秒間隔
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center text-red-500">
          エラーが発生しました: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">リアルタイム監視</h1>
        <div className="flex items-center space-x-4">
          <Badge variant={systemStatus.isHealthy ? 'default' : 'destructive'}>
            {systemStatus.isHealthy ? 'システム正常' : 'システム異常'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            自動更新: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>

      {/* アラートパネル */}
      {alerts.length > 0 && (
        <AlertPanel alerts={alerts} />
      )}

      {/* システム概要カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">アクティブポジション</p>
                <p className="text-2xl font-bold">{metrics.activePositions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">EA接続数</p>
                <p className="text-2xl font-bold">{connections.filter(c => c.status === 'connected').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">日次損益</p>
                <p className={`text-2xl font-bold ${metrics.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{metrics.dailyPnL.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">アラート数</p>
                <p className="text-2xl font-bold">{alerts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* システム状態とEA接続 */}
        <div className="lg:col-span-2 space-y-6">
          <SystemStatusCard status={systemStatus} />
          <EAConnectionPanel connections={connections} />
        </div>

        {/* クイックアクション */}
        <div>
          <QuickActions />
        </div>
      </div>

      {/* チャートとタブ */}
      <Tabs defaultValue="charts" className="w-full">
        <TabsList>
          <TabsTrigger value="charts">パフォーマンスチャート</TabsTrigger>
          <TabsTrigger value="logs">システムログ</TabsTrigger>
          <TabsTrigger value="settings">監視設定</TabsTrigger>
        </TabsList>
        
        <TabsContent value="charts" className="space-y-6">
          <RealTimeChart data={metrics.chartData} />
        </TabsContent>
        
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>システムログ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {systemStatus.logs.map((log, index) => (
                  <div key={index} className="text-sm font-mono p-2 bg-gray-50 rounded">
                    <span className="text-gray-500">{log.timestamp}</span>
                    <span className={`ml-2 ${
                      log.level === 'error' ? 'text-red-600' :
                      log.level === 'warn' ? 'text-orange-600' :
                      log.level === 'info' ? 'text-blue-600' : 'text-gray-600'
                    }`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="ml-2">{log.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>監視設定</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 監視設定UI */}
              <div className="text-gray-500">監視設定機能は今後実装予定</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}