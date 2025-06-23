"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@repo/ui/components/ui/dialog';
import { Progress } from '@repo/ui/components/ui/progress';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

interface ActionExecution {
  id: string;
  type: 'ENTRY' | 'CLOSE';
  accountId: string;
  brokerName: string;
  positionId: string;
  symbol: string;
  volume: number;
  status: 'PENDING' | 'EXECUTING' | 'EXECUTED' | 'FAILED';
  startTime: string;
  endTime?: string;
  progress: number;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
}

interface ActionStats {
  total: number;
  executing: number;
  completed: number;
  failed: number;
  avgExecutionTime: number;
  successRate: number;
}

interface ActionExecutionPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export const ActionExecutionPanel: React.FC<ActionExecutionPanelProps> = ({ isVisible, onClose }) => {
  const [actions, setActions] = useState<ActionExecution[]>([]);
  const [stats, setStats] = useState<ActionStats>({
    total: 0,
    executing: 0,
    completed: 0,
    failed: 0,
    avgExecutionTime: 0,
    successRate: 0,
  });
  const [selectedAction, setSelectedAction] = useState<ActionExecution | null>(null);

  // モックデータ生成
  const generateMockActions = (): ActionExecution[] => {
    const symbols = ['USDJPY', 'EURUSD', 'GBPUSD', 'AUDUSD'];
    const brokers = ['AXIORY', 'XM', 'TitanFX', 'FXGT'];
    const statuses: ActionExecution['status'][] = ['PENDING', 'EXECUTING', 'EXECUTED', 'FAILED'];
    
    return Array.from({ length: 8 }, (_, i) => {
      const status = i < 2 ? 'EXECUTING' : 
                   i < 5 ? 'EXECUTED' : 
                   i < 7 ? 'FAILED' : 'PENDING';
      const startTime = new Date(Date.now() - Math.random() * 300000).toISOString();
      
      return {
        id: `action-${i + 1}`,
        type: Math.random() > 0.5 ? 'ENTRY' : 'CLOSE',
        accountId: `acc-${Math.floor(Math.random() * 4) + 1}`,
        brokerName: brokers[Math.floor(Math.random() * brokers.length)],
        positionId: `pos-${Math.floor(Math.random() * 100)}`,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        volume: 0.1 + Math.random() * 0.9,
        status,
        startTime,
        endTime: status === 'EXECUTED' || status === 'FAILED' ? 
                new Date(Date.now() - Math.random() * 60000).toISOString() : undefined,
        progress: status === 'EXECUTING' ? 20 + Math.random() * 60 : 
                 status === 'EXECUTED' ? 100 : 
                 status === 'FAILED' ? 100 : 0,
        errorMessage: status === 'FAILED' ? 'Connection timeout' : undefined,
        retryCount: status === 'FAILED' ? Math.floor(Math.random() * 3) : 0,
        maxRetries: 3,
      };
    });
  };

  useEffect(() => {
    if (!isVisible) return;

    const updateActions = () => {
      const mockActions = generateMockActions();
      setActions(mockActions);

      // 統計計算
      const executing = mockActions.filter(a => a.status === 'EXECUTING').length;
      const completed = mockActions.filter(a => a.status === 'EXECUTED').length;
      const failed = mockActions.filter(a => a.status === 'FAILED').length;
      const total = mockActions.length;
      const successRate = total > 0 ? (completed / (completed + failed)) * 100 : 0;

      setStats({
        total,
        executing,
        completed,
        failed,
        avgExecutionTime: 2.3, // seconds
        successRate: isNaN(successRate) ? 0 : successRate,
      });
    };

    const interval = setInterval(updateActions, 1000);
    updateActions();

    return () => clearInterval(interval);
  }, [isVisible]);

  const getStatusIcon = (status: ActionExecution['status']) => {
    switch (status) {
      case 'EXECUTING':
        return <Activity className="h-4 w-4 text-orange-500 animate-pulse" />;
      case 'EXECUTED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: ActionExecution['status']) => {
    switch (status) {
      case 'EXECUTING': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'EXECUTED': return 'bg-green-50 text-green-700 border-green-200';
      case 'FAILED': return 'bg-red-50 text-red-700 border-red-200';
      case 'PENDING': return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    return `${duration}s`;
  };

  const handleRetryAction = (actionId: string) => {
    console.log(`Retrying action: ${actionId}`);
    // TODO: 実際のリトライ処理
  };

  const handleCancelAction = (actionId: string) => {
    console.log(`Cancelling action: ${actionId}`);
    // TODO: 実際のキャンセル処理
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">アクション実行状況</h2>
              <p className="text-sm text-gray-600">リアルタイムアクション監視とコントロール</p>
            </div>
            <Button variant="outline" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* 統計情報 */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-xs text-gray-500">総アクション</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.executing}</div>
                <div className="text-xs text-gray-500">実行中</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-xs text-gray-500">完了</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-xs text-gray-500">失敗</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.avgExecutionTime}s</div>
                <div className="text-xs text-gray-500">平均実行時間</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-indigo-600">{stats.successRate.toFixed(1)}%</div>
                <div className="text-xs text-gray-500">成功率</div>
              </CardContent>
            </Card>
          </div>

          {/* アクション一覧 */}
          <div className="space-y-3">
            {actions.map(action => (
              <Card key={action.id} className={`transition-all hover:shadow-md ${getStatusColor(action.status)}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(action.status)}
                      <div>
                        <div className="font-medium flex items-center space-x-2">
                          <span>{action.type}</span>
                          <Badge variant="outline">{action.symbol}</Badge>
                          <span className="text-sm text-gray-500">Vol: {action.volume.toFixed(2)}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {action.brokerName} ({action.accountId}) | Position: {action.positionId}
                        </div>
                        <div className="text-xs text-gray-500">
                          開始: {new Date(action.startTime).toLocaleTimeString()} | 
                          実行時間: {formatDuration(action.startTime, action.endTime)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {action.status === 'EXECUTING' && (
                        <div className="w-24">
                          <Progress value={action.progress} className="h-2" />
                          <div className="text-xs text-center mt-1">{action.progress.toFixed(0)}%</div>
                        </div>
                      )}
                      
                      {action.status === 'FAILED' && (
                        <div className="flex items-center space-x-2">
                          <div className="text-xs text-red-600">
                            {action.retryCount}/{action.maxRetries} retries
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleRetryAction(action.id)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      {action.status === 'EXECUTING' && (
                        <Button variant="outline" size="sm" onClick={() => handleCancelAction(action.id)}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedAction(action)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>アクション詳細: {action.id}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">タイプ:</span>
                                <div className="font-bold">{action.type}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">ステータス:</span>
                                <Badge className={getStatusColor(action.status)}>{action.status}</Badge>
                              </div>
                              <div>
                                <span className="text-gray-500">銘柄:</span>
                                <div className="font-bold">{action.symbol}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">ボリューム:</span>
                                <div className="font-bold">{action.volume.toFixed(2)}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">証券会社:</span>
                                <div className="font-bold">{action.brokerName}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">口座ID:</span>
                                <div className="font-mono">{action.accountId}</div>
                              </div>
                            </div>
                            {action.errorMessage && (
                              <div className="p-3 bg-red-50 border border-red-200 rounded">
                                <div className="text-sm font-medium text-red-700">エラー詳細:</div>
                                <div className="text-sm text-red-600">{action.errorMessage}</div>
                              </div>
                            )}
                            <div className="text-xs text-gray-500">
                              ID: {action.id} | Position: {action.positionId}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};