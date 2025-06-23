'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Progress } from '@repo/ui/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Eye,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { 
  Strategy, 
  EntryStrategy, 
  ExitStrategy, 
  StrategyStatus,
  Action,
  ActionStatus
} from '@repo/shared-types';
import { useStrategies } from '../hooks/useStrategies';
import { useStrategySubscription } from '../hooks/useStrategySubscription';
import { formatDateTime } from '../../../lib/utils';

interface StrategyMonitorProps {
  strategyId?: string;
  showAll?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // seconds
}

interface ExecutionProgress {
  totalActions: number;
  completedActions: number;
  failedActions: number;
  pendingActions: number;
}

export function StrategyMonitor({ 
  strategyId, 
  showAll = true, 
  autoRefresh = true,
  refreshInterval = 5 
}: StrategyMonitorProps) {
  const { strategies, loading, error, refreshStrategies } = useStrategies();
  const { executionUpdates, errors: subscriptionErrors } = useStrategySubscription();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Filter strategies to show
  const displayedStrategies = showAll 
    ? strategies.filter(s => [StrategyStatus.EXECUTING, StrategyStatus.ACTIVE, StrategyStatus.ERROR].includes(s.status))
    : strategies.filter(s => s.strategyId === strategyId);

  const activeStrategies = displayedStrategies.filter(s => s.status === StrategyStatus.EXECUTING);
  const errorStrategies = displayedStrategies.filter(s => s.status === StrategyStatus.ERROR);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshStrategies();
      setLastRefresh(new Date());
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshStrategies]);

  // Handle execution updates from subscription
  useEffect(() => {
    if (executionUpdates.length > 0) {
      setExecutionHistory(prev => [
        ...executionUpdates.map(update => ({
          ...update,
          timestamp: new Date(),
        })),
        ...prev.slice(0, 50) // Keep last 50 updates
      ]);
    }
  }, [executionUpdates]);

  const getStrategyStatusBadge = (status: StrategyStatus) => {
    switch (status) {
      case StrategyStatus.EXECUTING:
        return <Badge className="bg-blue-500"><Activity className="h-3 w-3 mr-1" />実行中</Badge>;
      case StrategyStatus.COMPLETED:
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />完了</Badge>;
      case StrategyStatus.ERROR:
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />エラー</Badge>;
      case StrategyStatus.ACTIVE:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />待機中</Badge>;
      case StrategyStatus.PAUSED:
        return <Badge variant="secondary">一時停止</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionStatusIcon = (status: ActionStatus) => {
    switch (status) {
      case ActionStatus.COMPLETED:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case ActionStatus.FAILED:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case ActionStatus.EXECUTING:
        return <Activity className="h-4 w-4 text-blue-500 animate-spin" />;
      case ActionStatus.PENDING:
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const calculateExecutionProgress = (strategy: Strategy): ExecutionProgress => {
    // This would normally come from the actual actions data
    // For now, we'll simulate based on strategy status
    if (strategy.status === StrategyStatus.COMPLETED) {
      return { totalActions: 1, completedActions: 1, failedActions: 0, pendingActions: 0 };
    } else if (strategy.status === StrategyStatus.EXECUTING) {
      return { totalActions: 3, completedActions: 1, failedActions: 0, pendingActions: 2 };
    } else if (strategy.status === StrategyStatus.ERROR) {
      return { totalActions: 2, completedActions: 1, failedActions: 1, pendingActions: 0 };
    }
    return { totalActions: 0, completedActions: 0, failedActions: 0, pendingActions: 0 };
  };

  const getProgressPercentage = (progress: ExecutionProgress): number => {
    if (progress.totalActions === 0) return 0;
    return Math.round(((progress.completedActions + progress.failedActions) / progress.totalActions) * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            監視データを読み込み中...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              監視データの取得に失敗しました: {error.message}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={refreshStrategies}>再試行</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">実行中の戦略</p>
                <p className="text-2xl font-bold text-blue-600">{activeStrategies.length}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">エラー戦略</p>
                <p className="text-2xl font-bold text-red-600">{errorStrategies.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">監視中戦略</p>
                <p className="text-2xl font-bold text-gray-900">{displayedStrategies.length}</p>
              </div>
              <Eye className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Monitor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              戦略実行監視
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                最終更新: {formatDateTime(lastRefresh)}
              </span>
              <Button size="sm" variant="outline" onClick={refreshStrategies}>
                <RefreshCw className="h-4 w-4 mr-1" />
                更新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">実行中</TabsTrigger>
              <TabsTrigger value="all">全戦略</TabsTrigger>
              <TabsTrigger value="history">実行履歴</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeStrategies.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  現在実行中の戦略はありません
                </div>
              ) : (
                <div className="space-y-4">
                  {activeStrategies.map((strategy) => {
                    const progress = calculateExecutionProgress(strategy);
                    const percentage = getProgressPercentage(progress);
                    
                    return (
                      <Card key={strategy.strategyId} className="border-blue-200">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold">{strategy.name}</h3>
                                <p className="text-sm text-gray-600">
                                  {strategy.type === 'ENTRY' ? 'エントリー戦略' : '決済戦略'}
                                </p>
                              </div>
                              {getStrategyStatusBadge(strategy.status)}
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span>実行進捗</span>
                                <span>{percentage}%</span>
                              </div>
                              <Progress value={percentage} className="h-2" />
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>完了: {progress.completedActions}</span>
                                <span>実行中: {progress.pendingActions}</span>
                                <span>失敗: {progress.failedActions}</span>
                              </div>
                            </div>

                            {strategy.type === 'ENTRY' && (
                              <div className="text-sm text-gray-600">
                                対象口座: {(strategy as EntryStrategy).targetAccounts.length}口座
                                ・ポジション数: {(strategy as EntryStrategy).positions.length}
                              </div>
                            )}

                            {strategy.type === 'EXIT' && (
                              <div className="text-sm text-gray-600">
                                決済対象: {(strategy as ExitStrategy).selectedPositions.length}ポジション
                              </div>
                            )}

                            {strategy.executedAt && (
                              <div className="text-xs text-gray-500">
                                実行開始: {formatDateTime(strategy.executedAt)}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              <div className="space-y-3">
                {displayedStrategies.map((strategy) => (
                  <Card key={strategy.strategyId}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium">{strategy.name}</h3>
                            {getStrategyStatusBadge(strategy.status)}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {strategy.type === 'ENTRY' ? 'エントリー戦略' : '決済戦略'}
                            {strategy.executedAt && ` ・ 実行: ${formatDateTime(strategy.executedAt)}`}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedStrategy(strategy)}
                        >
                          詳細
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {executionHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  実行履歴がありません
                </div>
              ) : (
                <div className="space-y-3">
                  {executionHistory.map((update, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {getActionStatusIcon(update.status)}
                          <div className="flex-1">
                            <p className="font-medium">{update.message}</p>
                            <p className="text-sm text-gray-600">
                              戦略: {update.strategyName || update.strategyId}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(update.timestamp)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Subscription Errors */}
      {subscriptionErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">リアルタイム接続エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subscriptionErrors.map((error, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}