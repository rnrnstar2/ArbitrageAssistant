'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Progress } from '@repo/ui/components/ui/progress';
import { Server, Database, Wifi, Shield } from 'lucide-react';

interface SystemStatus {
  isHealthy: boolean;
  hedgeSystemStatus: 'online' | 'offline' | 'error';
  amplifyStatus: 'connected' | 'disconnected' | 'error';
  webSocketStatus: 'active' | 'inactive' | 'error';
  authStatus: 'authenticated' | 'unauthenticated' | 'error';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
}

interface SystemStatusCardProps {
  status: SystemStatus;
}

export function SystemStatusCard({ status }: SystemStatusCardProps) {
  const getStatusColor = (statusValue: string) => {
    switch (statusValue) {
      case 'online':
      case 'connected':
      case 'active':
      case 'authenticated':
        return 'text-green-600 bg-green-100';
      case 'offline':
      case 'disconnected':
      case 'inactive':
      case 'unauthenticated':
        return 'text-orange-600 bg-orange-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Server className="h-5 w-5" />
          <span>システム状態</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 各システムの状態 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <Server className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium">Hedge System</p>
              <Badge className={getStatusColor(status.hedgeSystemStatus)}>
                {status.hedgeSystemStatus}
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Database className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium">AWS Amplify</p>
              <Badge className={getStatusColor(status.amplifyStatus)}>
                {status.amplifyStatus}
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Wifi className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium">WebSocket</p>
              <Badge className={getStatusColor(status.webSocketStatus)}>
                {status.webSocketStatus}
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium">認証</p>
              <Badge className={getStatusColor(status.authStatus)}>
                {status.authStatus}
              </Badge>
            </div>
          </div>
        </div>

        {/* リソース使用状況 */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>メモリ使用量</span>
              <span>{status.memoryUsage.toFixed(1)}%</span>
            </div>
            <Progress value={status.memoryUsage} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>CPU使用量</span>
              <span>{status.cpuUsage.toFixed(1)}%</span>
            </div>
            <Progress value={status.cpuUsage} className="h-2" />
          </div>
        </div>

        {/* 稼働時間 */}
        <div className="flex justify-between items-center pt-4 border-t">
          <span className="text-sm text-gray-600">稼働時間</span>
          <span className="text-sm font-semibold">{formatUptime(status.uptime)}</span>
        </div>
      </CardContent>
    </Card>
  );
}