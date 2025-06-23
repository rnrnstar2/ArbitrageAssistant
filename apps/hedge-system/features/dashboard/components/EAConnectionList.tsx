"use client";

import { Wifi, WifiOff, RefreshCw, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { useSystem } from '../context/SystemContext';
import { EAConnection } from '../types';

export function EAConnectionList() {
  const { eaConnections } = useSystem();

  const getStatusIcon = (ea: EAConnection) => {
    switch (ea.status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-a8-primary" />;
      case 'reconnecting':
        return <RefreshCw className="h-4 w-4 text-a8-secondary animate-spin" />;
      case 'error':
        return <WifiOff className="h-4 w-4 text-red-600" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return '正常';
      case 'reconnecting': return '再接続中';
      case 'error': return 'エラー';
      case 'disconnected': return '切断';
      default: return '不明';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-a8-primary" />
          EA接続状況
        </CardTitle>
        <CardDescription>
          各証券会社のExpert Advisor接続状態
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {eaConnections.map((ea) => (
            <div key={ea.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(ea)}
                <div>
                  <p className="font-medium">{ea.broker}</p>
                  <p className="text-sm text-gray-600">口座: {ea.accountNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <p className="font-medium">{getStatusText(ea.status)}</p>
                  <p className="text-gray-600">
                    {ea.status === 'connected' ? 
                      `残高: ¥${ea.balance.toLocaleString()}` : 
                      '---'}
                  </p>
                </div>
                <Badge 
                  variant={ea.status === 'connected' ? 'default' : 
                           ea.status === 'reconnecting' ? 'secondary' : 'destructive'}
                >
                  {ea.responseTime > 0 ? `${ea.responseTime}ms` : '---'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}