"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useDashboardData } from "../hooks/useDashboardData";

export function DashboardPage() {
  const { 
    stats, 
    isLoading, 
    error, 
    refresh 
  } = useDashboardData();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          データの読み込みに失敗しました: {error}
          <Button onClick={refresh} variant="outline" size="sm" className="ml-4">
            再試行
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const systemHealthy = (stats?.connectedAccounts || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">管理ダッシュボード</h1>
        <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading}>
          {isLoading ? "更新中..." : "更新"}
        </Button>
      </div>

      {/* System Status */}
      <Alert variant={systemHealthy ? "default" : "destructive"}>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          {systemHealthy ? (
            <>システム正常動作中 - <Badge variant="secondary">{stats?.connectedAccounts || 0}口座接続</Badge> / <Badge variant="secondary">{stats?.openPositions || 0}ポジション監視</Badge></>
          ) : (
            "口座が接続されていません"
          )}
        </AlertDescription>
      </Alert>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">接続口座</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.connectedAccounts || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">実行中ポジション</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.openPositions || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">待機アクション</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.pendingActions || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">システム状態</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-semibold ${systemHealthy ? 'text-green-600' : 'text-red-600'}`}>
              {systemHealthy ? '正常' : '異常'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}