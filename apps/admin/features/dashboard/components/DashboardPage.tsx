"use client";

import { Dashboard } from "./Dashboard";
import { useDashboardData } from "../hooks/useDashboardData";

/**
 * DashboardPage - 統合ダッシュボードページ
 * MVPシステム設計書準拠のコンポーネント統合
 */
export function DashboardPage() {
  const { 
    accounts,
    positions,
    actions,
    isLoading,
    error,
    refresh
  } = useDashboardData();

  return (
    <Dashboard
      accounts={accounts}
      positions={positions}
      actions={actions}
      loading={isLoading}
      error={error}
      onRefresh={refresh}
    />
  );
}