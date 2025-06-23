"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { EntryForm } from "./entry-form";
import { EntryHistoryTable } from "./entry-history-table";
import { AccountList } from "./account-list";
import { useAccounts } from "../hooks/useAccounts";

export function TradingDashboard() {
  const { accounts, loading, loadAccounts } = useAccounts();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEntrySubmitted = () => {
    setRefreshTrigger(prev => prev + 1);
    loadAccounts();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">トレード管理</h1>
        <p className="text-gray-600">手動エントリーとトレード履歴の管理</p>
      </div>

      <Tabs defaultValue="entry" className="space-y-6">
        <TabsList>
          <TabsTrigger value="entry">新規エントリー</TabsTrigger>
          <TabsTrigger value="history">エントリー履歴</TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="space-y-6">
          {accounts.length === 0 ? (
            <AccountList accounts={accounts} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <EntryForm accounts={accounts} onEntrySubmitted={handleEntrySubmitted} />
              </div>
              <div>
                <AccountList accounts={accounts} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <EntryHistoryTable 
            accounts={accounts} 
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}