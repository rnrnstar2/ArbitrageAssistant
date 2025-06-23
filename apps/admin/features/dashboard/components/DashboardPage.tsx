"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Separator } from "@repo/ui/components/ui/separator";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import {
  Plus,
  Activity,
  CheckCircle2
} from "lucide-react";
import { useDashboardData } from "../hooks/useDashboardData";
import { StatsCards } from "./StatsCards";
import { ClientStatusCard } from "./ClientStatusCard";
import { MonitoringPanel } from "./MonitoringPanel";

export function DashboardPage() {
  const { 
    stats, 
    accounts, 
    positions, 
    actions, 
    clients,
    isLoading, 
    error, 
    refresh 
  } = useDashboardData();

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>
            データの読み込みに失敗しました: {error}
          </AlertDescription>
        </Alert>
        <Button onClick={refresh}>再試行</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">管理ダッシュボード</h1>
          <p className="text-muted-foreground">
            アービトラージ取引の監視と基本操作を行います
          </p>
        </div>
        <Button onClick={refresh} variant="outline" disabled={isLoading}>
          {isLoading ? "更新中..." : "更新"}
        </Button>
      </div>

      <Separator />

      {/* Alert Section */}
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          システムは正常に動作しています。現在 <Badge variant="secondary">{stats?.connectedAccounts || 0}個の口座</Badge> が接続中、
          <Badge variant="secondary">{stats?.openPositions || 0}個のポジション</Badge> を監視中です。
        </AlertDescription>
      </Alert>

      {/* Stats Section */}
      <StatsCards stats={stats || { connectedAccounts: 0, totalAccounts: 0, openPositions: 0, pendingActions: 0, totalVolume: 0, totalPnL: 0 }} isLoading={isLoading} />

      {/* Client Status */}
      <ClientStatusCard clients={clients} isLoading={isLoading} />

      {/* Monitoring Panel */}
      <MonitoringPanel isLoading={isLoading} />
    </div>
  );
}