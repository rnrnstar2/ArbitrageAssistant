"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Settings, Plus } from "lucide-react";
import type { TabType } from "../types/types";
import { useClientsData } from "../hooks/useClientsData";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { TabNavigation } from "./TabNavigation";
import { ClientsTab } from "./ClientsTab";
import { AccountsTab } from "./AccountsTab";
import { GroupsTab } from "./GroupsTab";
import { LinkingTab } from "./LinkingTab";

export const ClientsManager = () => {
  const [activeTab, setActiveTab] = useState<TabType>("clients");
  const { clients, accounts, groups, isLoading } = useClientsData();

  const renderTabContent = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }

    switch (activeTab) {
      case "clients":
        return <ClientsTab clients={clients} groups={groups} />;
      case "accounts":
        return <AccountsTab accounts={accounts} clients={clients} groups={groups} />;
      case "groups":
        return <GroupsTab groups={groups} accounts={accounts} clients={clients} />;
      case "linking":
        return <LinkingTab accounts={accounts} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">口座・クライアント管理</h1>
          <p className="text-gray-600">Hedge-Systemクライアントと口座の詳細管理</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-fit sm:w-auto">
            <Settings className="mr-2 h-4 w-4" />
            システム設定
          </Button>
          <Button className="w-fit sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            新規グループ
          </Button>
        </div>
      </div>
      
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      {renderTabContent()}
    </div>
  );
};