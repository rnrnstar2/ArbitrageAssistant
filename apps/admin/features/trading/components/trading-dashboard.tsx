"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { RefreshCw } from "lucide-react";
import { EntryStrategyForm } from "./entry-strategy-form";
import { StrategyExecutionMonitor, createMockExecution } from "./strategy-execution-monitor";
import { EntryHistoryTable } from "./entry-history-table";
import { CloseHistoryTable } from "./close-history-table";
import { useAccounts } from "../hooks/useAccounts";

export function TradingDashboard() {
  const { users, accounts, loading, loadAccounts } = useAccounts();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeStrategies, setActiveStrategies] = useState<any[]>([]);

  const handleEntrySubmitted = () => {
    setRefreshTrigger(prev => prev + 1);
    loadAccounts();
  };

  const handleStrategyExecuted = (strategyId: string) => {
    // モック戦略実行データを追加
    const mockExecution = createMockExecution(
      strategyId, 
      "USDJPY", 
      Math.random() > 0.5 ? "buy" : "sell"
    );
    setActiveStrategies(prev => [mockExecution, ...prev]);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCancelStrategy = (executionId: string) => {
    setActiveStrategies(prev => 
      prev.map(strategy => 
        strategy.id === executionId 
          ? { ...strategy, status: "cancelled" }
          : strategy
      )
    );
  };


  // アカウントに status プロパティを追加（モック）
  const accountsWithStatus = accounts.map(account => ({
    ...account,
    status: 'online' as const
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">トレード管理</h1>
        <Button variant="outline" size="sm" onClick={loadAccounts}>
          <RefreshCw className="mr-2 h-4 w-4" />
          更新
        </Button>
      </div>

      {/* Main Content */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="strategy" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="strategy">エントリー戦略</TabsTrigger>
              <TabsTrigger value="monitor">実行監視</TabsTrigger>
              <TabsTrigger value="entry-history">エントリー履歴</TabsTrigger>
              <TabsTrigger value="close-history">決済履歴</TabsTrigger>
            </TabsList>

            <TabsContent value="strategy" className="space-y-4">
              {accounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  口座が設定されていません
                </div>
              ) : (
                <EntryStrategyForm 
                  users={users}
                  accounts={accountsWithStatus} 
                  onStrategyExecuted={handleStrategyExecuted} 
                />
              )}
            </TabsContent>

            <TabsContent value="monitor" className="space-y-4">
              <StrategyExecutionMonitor 
                executions={activeStrategies}
                onCancelExecution={handleCancelStrategy}
              />
            </TabsContent>

            <TabsContent value="entry-history" className="space-y-4">
              <EntryHistoryTable 
                refreshTrigger={refreshTrigger}
                accounts={accounts}
              />
            </TabsContent>

            <TabsContent value="close-history" className="space-y-4">
              <CloseHistoryTable 
                refreshTrigger={refreshTrigger}
                accounts={accounts}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}