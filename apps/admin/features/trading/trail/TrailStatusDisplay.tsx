"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Progress } from "@repo/ui/components/ui/progress";
import { Button } from "@repo/ui/components/ui/button";
import { useToast } from "@repo/ui/hooks/use-toast";
import { 
  TrendingUpIcon,
  TrendingDownIcon,
  ActivityIcon,
  PauseIcon,
  PlayIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  BarChart3Icon,
  DollarSignIcon,
  ZapIcon
} from "lucide-react";
import { TrailSettings } from "./types";
import { useRealtimeTrailStatus } from "../../hooks/monitoring/useRealtimeTrailStatus";

export interface TrailStatus {
  id: string;
  positionId: string;
  accountId: string;
  accountName: string;
  symbol: string;
  positionType: 'buy' | 'sell';
  currentPrice: number;
  openPrice: number;
  currentProfit: number;
  trailSettings: TrailSettings;
  status: 'active' | 'paused' | 'stopped' | 'triggered';
  performance: {
    totalMoved: number;
    maxProfit: number;
    trailEfficiency: number; // トレール効率（0-100%）
    timeSinceStart: number; // ミリ秒
  };
  lastUpdate: Date;
  nextUpdate?: Date;
  alerts: {
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: Date;
  }[];
}

interface TrailStatusDisplayProps {
  filters?: {
    accountIds?: string[];
    symbols?: string[];
    positionIds?: string[];
    statuses?: ('active' | 'paused' | 'stopped' | 'triggered')[];
  };
  className?: string;
}

export function TrailStatusDisplay({
  filters,
  className
}: TrailStatusDisplayProps) {
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const { toast } = useToast();

  // リアルタイムトレール状況の取得
  const {
    trailStatuses,
    loading,
    error,
    lastUpdate,
    reconnect,
    updateFrequency,
    toggleTrail,
    stopTrail
  } = useRealtimeTrailStatus({
    filters,
    throttleMs: 1000,
    enabled: true
  });

  // トレール状態変更ハンドラー
  const handleToggleTrail = async (trailId: string, isActive: boolean) => {
    try {
      await toggleTrail(trailId, isActive);
      toast({
        title: isActive ? "トレール開始" : "トレール一時停止",
        description: `トレール（ID: ${trailId}）を${isActive ? '開始' : '一時停止'}しました`,
      });
    } catch (error) {
      console.error("Error toggling trail:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "トレール操作に失敗しました",
        variant: "destructive",
      });
    }
  };

  // トレール停止ハンドラー
  const handleStopTrail = async (trailId: string) => {
    try {
      await stopTrail(trailId);
      toast({
        title: "トレール停止",
        description: `トレール（ID: ${trailId}）を停止しました`,
      });
    } catch (error) {
      console.error("Error stopping trail:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "トレール停止に失敗しました",
        variant: "destructive",
      });
    }
  };

  // 統計情報の計算
  const statistics = useMemo(() => {
    const activeTrails = trailStatuses.filter(trail => trail.status === 'active');
    const totalProfit = trailStatuses.reduce((sum, trail) => sum + trail.currentProfit, 0);
    const avgEfficiency = trailStatuses.length > 0 
      ? trailStatuses.reduce((sum, trail) => sum + trail.performance.trailEfficiency, 0) / trailStatuses.length
      : 0;

    return {
      totalTrails: trailStatuses.length,
      activeTrails: activeTrails.length,
      totalProfit,
      avgEfficiency,
      alertCount: trailStatuses.reduce((sum, trail) => sum + trail.alerts.length, 0)
    };
  }, [trailStatuses]);

  const getStatusColor = (status: TrailStatus['status']) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'paused': return 'text-yellow-600 bg-yellow-50';
      case 'stopped': return 'text-gray-600 bg-gray-50';
      case 'triggered': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: TrailStatus['status']) => {
    switch (status) {
      case 'active': return <ActivityIcon className="h-4 w-4" />;
      case 'paused': return <PauseIcon className="h-4 w-4" />;
      case 'stopped': return <TrendingDownIcon className="h-4 w-4" />;
      case 'triggered': return <ZapIcon className="h-4 w-4" />;
      default: return <ActivityIcon className="h-4 w-4" />;
    }
  };

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatPrice = (price: number) => {
    return price.toFixed(5);
  };

  const formatProfit = (profit: number) => {
    const sign = profit >= 0 ? '+' : '';
    return `${sign}$${profit.toFixed(2)}`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
            <span className="text-gray-600">トレール状況を読み込み中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="text-center">
            <AlertTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-red-800 mb-2">エラーが発生しました</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={reconnect} variant="outline">
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              再読み込み
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trailStatuses.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">
            <BarChart3Icon className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">アクティブなトレールはありません</h3>
            <p>トレール設定を行うとここに表示されます</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUpIcon className="h-5 w-5" />
            <span>トレール状況監視</span>
            <Badge variant="secondary">
              {statistics.activeTrails}/{statistics.totalTrails} アクティブ
            </Badge>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={reconnect}>
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              更新
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 統計サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <ActivityIcon className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {statistics.activeTrails}
                  </div>
                  <div className="text-sm text-gray-500">アクティブ</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSignIcon className="h-4 w-4 text-blue-600" />
                <div>
                  <div className={`text-2xl font-bold ${statistics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatProfit(statistics.totalProfit)}
                  </div>
                  <div className="text-sm text-gray-500">総損益</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BarChart3Icon className="h-4 w-4 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {statistics.avgEfficiency.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">平均効率</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangleIcon className="h-4 w-4 text-orange-600" />
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {statistics.alertCount}
                  </div>
                  <div className="text-sm text-gray-500">アラート</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* トレール一覧 */}
        <div className="space-y-4">
          {trailStatuses.map((trail) => (
            <Card 
              key={trail.id}
              className={`transition-all cursor-pointer ${
                selectedTrailId === trail.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedTrailId(selectedTrailId === trail.id ? null : trail.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${getStatusColor(trail.status)}`}>
                      {getStatusIcon(trail.status)}
                    </div>
                    <div>
                      <div className="font-medium">
                        {trail.symbol} - {trail.accountName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {trail.positionType.toUpperCase()} ポジション
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={trail.status === 'active' ? 'default' : 'secondary'}
                      className={getStatusColor(trail.status)}
                    >
                      {trail.status.toUpperCase()}
                    </Badge>
                    {trail.alerts.length > 0 && (
                      <Badge variant="destructive">
                        {trail.alerts.length} アラート
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 基本情報 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <div className="text-sm text-gray-500">現在価格</div>
                    <div className="font-medium">{formatPrice(trail.currentPrice)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">損切りライン</div>
                    <div className="font-medium">
                      {trail.trailSettings.currentStopLoss 
                        ? formatPrice(trail.trailSettings.currentStopLoss)
                        : '未設定'
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">現在利益</div>
                    <div className={`font-medium ${trail.currentProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatProfit(trail.currentProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">最大利益</div>
                    <div className="font-medium text-blue-600">
                      {formatProfit(trail.performance.maxProfit)}
                    </div>
                  </div>
                </div>

                {/* トレール効率プログレスバー */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-500">トレール効率</span>
                    <span className="text-sm font-medium">
                      {trail.performance.trailEfficiency.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={trail.performance.trailEfficiency} 
                    className="h-2"
                  />
                </div>

                {/* 詳細情報（選択時のみ表示） */}
                {selectedTrailId === trail.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">トレールタイプ</div>
                        <div className="font-medium">
                          {trail.trailSettings.type === 'fixed' && '固定PIPS'}
                          {trail.trailSettings.type === 'percentage' && 'パーセンテージ'}
                          {trail.trailSettings.type === 'atr' && 'ATRベース'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">トレール幅</div>
                        <div className="font-medium">
                          {trail.trailSettings.type === 'fixed' && `${trail.trailSettings.trailAmount} pips`}
                          {trail.trailSettings.type === 'percentage' && `${trail.trailSettings.trailAmount}%`}
                          {trail.trailSettings.type === 'atr' && `ATR × ${trail.trailSettings.trailAmount}`}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">実行時間</div>
                        <div className="font-medium">
                          {formatDuration(trail.performance.timeSinceStart)}
                        </div>
                      </div>
                    </div>

                    {/* アラート一覧 */}
                    {trail.alerts.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-500 mb-2">アラート</div>
                        <div className="space-y-1">
                          {trail.alerts.map((alert, index) => (
                            <div 
                              key={index}
                              className={`text-xs p-2 rounded flex items-center space-x-2 ${
                                alert.level === 'error' ? 'bg-red-50 text-red-700' :
                                alert.level === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                                'bg-blue-50 text-blue-700'
                              }`}
                            >
                              <AlertTriangleIcon className="h-3 w-3" />
                              <span>{alert.message}</span>
                              <span className="text-gray-500 ml-auto">
                                {alert.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 操作ボタン */}
                    <div className="flex space-x-2 pt-2">
                      <Button
                        size="sm"
                        variant={trail.status === 'active' ? 'outline' : 'default'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTrail(trail.id, trail.status !== 'active');
                        }}
                      >
                        {trail.status === 'active' ? (
                          <>
                            <PauseIcon className="h-4 w-4 mr-2" />
                            一時停止
                          </>
                        ) : (
                          <>
                            <PlayIcon className="h-4 w-4 mr-2" />
                            再開
                          </>
                        )}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStopTrail(trail.id);
                        }}
                      >
                        <TrendingDownIcon className="h-4 w-4 mr-2" />
                        停止
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 最終更新時刻 */}
        <div className="text-center text-sm text-gray-500">
          {lastUpdate ? (
            <>
              最終更新: {lastUpdate.toLocaleTimeString()} 
              {updateFrequency > 0 && ` (${updateFrequency}/秒)`}
              <span className="ml-2 text-green-600">(自動更新中)</span>
            </>
          ) : (
            "データを読み込み中..."
          )}
        </div>
      </CardContent>
    </Card>
  );
}