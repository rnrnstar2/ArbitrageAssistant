import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { 
  Monitor, 
  Target, 
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { DashboardStats } from "../types";

interface StatsCardsProps {
  stats: DashboardStats;
  isLoading: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

function StatCard({ title, value, icon, trend, trendValue, badge, badgeVariant = "secondary" }: StatCardProps) {
  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {badge && <Badge variant={badgeVariant} className="text-xs">{badge}</Badge>}
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{value}</div>
          {trend && trendValue && (
            <div className={`flex items-center text-xs ${
              trend === "up" ? "text-green-600" : 
              trend === "down" ? "text-red-600" : 
              "text-muted-foreground"
            }`}>
              {trend === "up" && <ArrowUpRight className="h-3 w-3 mr-1" />}
              {trend === "down" && <ArrowDownRight className="h-3 w-3 mr-1" />}
              {trendValue}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <LoadingSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="接続中クライアント"
        value={stats.connectedClients}
        icon={<Monitor className="h-4 w-4 text-blue-600" />}
        badge="オンライン"
        badgeVariant="secondary"
      />
      
      <StatCard
        title="管理口座数"
        value={stats.totalAccounts}
        icon={<Target className="h-4 w-4 text-green-600" />}
        trend="neutral"
        trendValue="全口座"
      />
      
      <StatCard
        title="保有ポジション"
        value={stats.openPositions}
        icon={<Clock className="h-4 w-4 text-indigo-600" />}
        trend="neutral"
        trendValue="現在"
      />
      
    </div>
  );
}