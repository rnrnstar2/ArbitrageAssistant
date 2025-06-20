"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { 
  Monitor, 
  Wallet, 
  Gift,
  TrendingUp,
  Users,
  Activity
} from "lucide-react";

interface DashboardStats {
  connectedClients: number;
  totalAccounts: number;
  totalBalance: number;
  totalBonus: number;
  openPositions: number;
  totalProfit: number;
}

interface StatsCardsProps {
  stats: DashboardStats;
  isLoading?: boolean;
}

export function StatsCards({ stats, isLoading = false }: StatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const cards = [
    {
      title: "接続中クライアント",
      value: stats.connectedClients,
      icon: Monitor,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "総アカウント数",
      value: stats.totalAccounts,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "総残高",
      value: formatCurrency(stats.totalBalance),
      icon: Wallet,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "ボーナス額",
      value: formatCurrency(stats.totalBonus),
      icon: Gift,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "オープンポジション",
      value: stats.openPositions,
      icon: Activity,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "総損益",
      value: formatCurrency(stats.totalProfit),
      icon: TrendingUp,
      color: stats.totalProfit >= 0 ? "text-green-600" : "text-red-600",
      bgColor: stats.totalProfit >= 0 ? "bg-green-50" : "bg-red-50",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-16 h-8 bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
              <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {card.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}