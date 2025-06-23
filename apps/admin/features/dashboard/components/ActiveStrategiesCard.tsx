import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Target, Play, Pause } from "lucide-react";
import { StrategyInfo } from "../types";
import { formatCurrency, getStrategyStatusColor } from "../utils";

interface ActiveStrategiesCardProps {
  strategies: StrategyInfo[];
  isLoading: boolean;
}

export function ActiveStrategiesCard({ strategies, isLoading }: ActiveStrategiesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>アクティブ戦略</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 border rounded">
                <div className="flex justify-between items-start mb-2">
                  <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="w-16 h-5 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="w-24 h-3 bg-gray-200 rounded animate-pulse" />
                  <div className="w-20 h-3 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            ))
          ) : (
            strategies.map((strategy) => (
              <div key={strategy.id} className="p-3 border rounded">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-sm">{strategy.name}</div>
                  <Badge className={getStrategyStatusColor(strategy.status)}>
                    {strategy.status === "active" && <Play className="mr-1 h-3 w-3" />}
                    {strategy.status === "paused" && <Pause className="mr-1 h-3 w-3" />}
                    {strategy.status}
                  </Badge>
                </div>
                <div className="space-y-1 text-xs text-gray-500">
                  <div>口座: {strategy.accounts.join(", ")}</div>
                  <div className="flex justify-between">
                    <span>{strategy.positions}ポジション</span>
                    <span className={strategy.profit >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(strategy.profit)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}