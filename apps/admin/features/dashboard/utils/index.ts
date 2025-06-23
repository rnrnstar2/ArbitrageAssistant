import { Target, TrendingUp, Activity } from "lucide-react";

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const getStrategyStatusColor = (status: string) => {
  switch (status) {
    case "active": return "bg-green-100 text-green-800";
    case "paused": return "bg-yellow-100 text-yellow-800";
    case "stopped": return "bg-gray-100 text-gray-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

export const getTypeIcon = (type: string) => {
  switch (type) {
    case "hedge": return Target;
    case "arbitrage": return TrendingUp;
    case "trail": return Activity;
    default: return Target;
  }
};