import { Card, CardContent } from "@repo/ui/components/ui/card";
import { 
  Monitor, 
  Target, 
  Activity, 
  TrendingUp,
  TrendingDown,
  Clock
} from "lucide-react";
import { DashboardStats } from "../types";
import { formatCurrency } from "../utils";

interface StatsCardsProps {
  stats: DashboardStats;
  isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {isLoading ? (
        Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
                <div className="w-16 h-6 bg-gray-200 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Monitor className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-600">接続中</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{stats.connectedClients}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-600">口座数</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.totalAccounts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-gray-600">アクティブ戦略</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">{stats.activeStrategies}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-gray-600">残高</span>
              </div>
              <div className="text-lg font-bold text-orange-600">{formatCurrency(stats.totalBalance)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-indigo-600" />
                <span className="text-sm text-gray-600">ポジション</span>
              </div>
              <div className="text-2xl font-bold text-indigo-600">{stats.openPositions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                {stats.totalProfit >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm text-gray-600">損益</span>
              </div>
              <div className={`text-lg font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(stats.totalProfit)}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}