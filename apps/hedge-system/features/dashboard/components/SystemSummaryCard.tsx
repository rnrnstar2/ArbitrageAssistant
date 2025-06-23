"use client";

import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { useSystem } from '../context/SystemContext';
import { SystemHealthStatus } from '../types';

export function SystemSummaryCard() {
  const { systemStatus, eaConnections } = useSystem();

  const getSystemHealthStatus = (): SystemHealthStatus => {
    const healthyCount = eaConnections.filter(ea => ea.status === 'connected').length;
    const totalCount = eaConnections.length;
    
    if (healthyCount === totalCount) return { status: 'healthy', color: 'text-a8-primary', icon: CheckCircle2 };
    if (healthyCount > totalCount * 0.5) return { status: 'warning', color: 'text-a8-secondary', icon: AlertTriangle };
    return { status: 'critical', color: 'text-red-600', icon: AlertTriangle };
  };

  const health = getSystemHealthStatus();
  const HealthIcon = health.icon;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HealthIcon className={`h-8 w-8 ${health.color}`} />
            <div>
              <h2 className="text-lg font-semibold">
                {health.status === 'healthy' ? 'システム正常稼働中' :
                 health.status === 'warning' ? 'システム一部警告' : 'システム異常'}
              </h2>
              <p className="text-sm text-gray-600">
                最終更新: {systemStatus.lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-a8-primary">{systemStatus.activeEAs}/{systemStatus.totalEAs}</p>
              <p className="text-xs text-gray-600">接続中EA</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{systemStatus.errorCount}</p>
              <p className="text-xs text-gray-600">エラー</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-a8-secondary">{systemStatus.uptime}</p>
              <p className="text-xs text-gray-600">稼働時間</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}