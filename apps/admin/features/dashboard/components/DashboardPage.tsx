"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Plus } from "lucide-react";
import { useDashboardData } from "../hooks/useDashboardData";
import { StatsCards } from "./StatsCards";
import { ClientStatusCard } from "./ClientStatusCard";
import { ActiveStrategiesCard } from "./ActiveStrategiesCard";
import { QuickStrategyCard } from "./QuickStrategyCard";
import { MonitoringPanel } from "./MonitoringPanel";

export function DashboardPage() {
  const { stats, clients, strategies, quickPresets, isLoading } = useDashboardData();

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">戦略設定ダッシュボード</h1>
          <p className="text-gray-600">柔軟な取引戦略の設定と監視</p>
        </div>
        <Button className="w-fit sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          新規戦略作成
        </Button>
      </div>
      
      <StatsCards stats={stats} isLoading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <ClientStatusCard clients={clients} isLoading={isLoading} />
        <ActiveStrategiesCard strategies={strategies} isLoading={isLoading} />
        <QuickStrategyCard quickPresets={quickPresets} isLoading={isLoading} />
      </div>

      <MonitoringPanel isLoading={isLoading} />
    </div>
  );
}