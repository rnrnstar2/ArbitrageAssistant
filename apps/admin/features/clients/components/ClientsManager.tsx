"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Badge } from "@repo/ui/components/ui/badge";
import { Separator } from "@repo/ui/components/ui/separator";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import {
  Settings,
  Users,
  Building,
  Info,
  Activity
} from "lucide-react";
import type { TabType } from "../types/types";
// import { useClientsData } from "../hooks/useClientsData"; // Temporarily disabled for MVP
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ClientsTab } from "./ClientsTab";
import { AccountsTab } from "./AccountsTab";

export const ClientsManager = () => {
  const [activeTab, setActiveTab] = useState<TabType>("clients");
  // Using mock data for MVP
  const clients: any[] = [];
  const accounts: any[] = [];
  const isLoading = false;

  const renderTabContent = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }

    switch (activeTab) {
      case "clients":
        return <ClientsTab clients={clients} accounts={accounts} />;
      case "accounts":
        return <AccountsTab accounts={accounts} clients={clients} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">口座・クライアント管理</h1>
          <p className="text-muted-foreground">
            Hedge-Systemクライアントと口座の統合管理
          </p>
        </div>
      </div>

      <Separator />

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">接続クライアント</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">オンライン</Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">管理口座</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              アクティブ口座
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          クライアントPCの接続状況や口座の基本情報を監視できます。
        </AlertDescription>
      </Alert>

      {/* Tabs Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            管理機能
          </CardTitle>
          <CardDescription>
            クライアント、口座の基本管理を行います
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="clients" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">クライアント</span>
              </TabsTrigger>
              <TabsTrigger value="accounts" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">口座</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              {renderTabContent()}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};