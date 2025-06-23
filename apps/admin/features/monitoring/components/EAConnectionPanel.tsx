'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Wifi, WifiOff, Activity, AlertCircle } from 'lucide-react';

interface EAConnection {
  connectionId: string;
  status: 'connected' | 'disconnected' | 'error';
  platform: 'MT4' | 'MT5';
  accountNumber: string;
  lastHeartbeat: Date;
  version: string;
  latency: number;
}

interface EAConnectionPanelProps {
  connections: EAConnection[];
}

export function EAConnectionPanel({ connections }: EAConnectionPanelProps) {
  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const disconnectedCount = connections.filter(c => c.status === 'disconnected').length;
  const errorCount = connections.filter(c => c.status === 'error').length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-orange-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">接続中</Badge>;
      case 'disconnected':
        return <Badge className="bg-orange-100 text-orange-800">切断</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">エラー</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">不明</Badge>;
    }
  };

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}秒前`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分前`;
    return `${Math.floor(seconds / 3600)}時間前`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>EA接続状況</span>
          </CardTitle>
          <div className="flex space-x-2">
            <Badge variant="outline">{connectedCount} 接続中</Badge>
            {disconnectedCount > 0 && (
              <Badge variant="secondary">{disconnectedCount} 切断</Badge>
            )}
            {errorCount > 0 && (
              <Badge variant="destructive">{errorCount} エラー</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {connections.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            EA接続がありません
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => (
              <div
                key={connection.connectionId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(connection.status)}
                  <div>
                    <div className="font-medium">
                      {connection.platform} - {connection.accountNumber}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {connection.connectionId.substring(0, 8)}...
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right text-sm">
                    <div>レイテンシ: {connection.latency}ms</div>
                    <div className="text-gray-500">
                      最終: {formatLastSeen(connection.lastHeartbeat)}
                    </div>
                  </div>
                  {getStatusBadge(connection.status)}
                </div>
              </div>
            ))}
          </div>
        )}

        {connections.some(c => c.status === 'error' || c.status === 'disconnected') && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" className="w-full">
              接続問題のトラブルシューティング
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}