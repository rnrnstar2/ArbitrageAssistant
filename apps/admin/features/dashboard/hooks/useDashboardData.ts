import { useState, useEffect } from "react";
import { DashboardStats, ClientStatus, StrategyInfo, QuickStrategyPreset } from "../types";

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats>({
    connectedClients: 0,
    totalAccounts: 0,
    activeStrategies: 0,
    totalBalance: 0,
    openPositions: 0,
    totalProfit: 0,
  });
  
  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [quickPresets, setQuickPresets] = useState<QuickStrategyPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setStats({
          connectedClients: 3,
          totalAccounts: 12,
          activeStrategies: 5,
          totalBalance: 125000,
          openPositions: 8,
          totalProfit: 2500,
        });
        
        setClients([
          {
            id: "1",
            name: "Client-PC-001",
            status: "online",
            lastSeen: "2分前",
            accountCount: 4,
            totalBalance: 50000,
          },
          {
            id: "2", 
            name: "Client-PC-002",
            status: "online",
            lastSeen: "5分前",
            accountCount: 3,
            totalBalance: 35000,
          },
          {
            id: "3",
            name: "Client-PC-003",
            status: "offline",
            lastSeen: "1時間前",
            accountCount: 5,
            totalBalance: 40000,
          },
        ]);

        setStrategies([
          {
            id: "1",
            name: "EUR/USD アービトラージ",
            status: "active",
            accounts: ["PC-001-A", "PC-002-B"],
            profit: 1250,
            positions: 4,
            created: "2時間前",
          },
          {
            id: "2",
            name: "ヘッジ戦略 USD/JPY",
            status: "active",
            accounts: ["PC-001-B", "PC-003-A"],
            profit: 850,
            positions: 2,
            created: "4時間前",
          },
          {
            id: "3",
            name: "トレール決済戦略",
            status: "paused",
            accounts: ["PC-002-A"],
            profit: 400,
            positions: 1,
            created: "1日前",
          },
        ]);

        setQuickPresets([
          {
            id: "1",
            name: "基本ヘッジ",
            description: "A口座ロング → B口座ショート",
            type: "hedge",
          },
          {
            id: "2",
            name: "アービトラージ",
            description: "複数口座間価格差利用",
            type: "arbitrage",
          },
          {
            id: "3",
            name: "トレール戦略",
            description: "決済 → 逆方向エントリー",
            type: "trail",
          },
        ]);
      } catch (error) {
        console.error("Dashboard data loading failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  return {
    stats,
    clients,
    strategies,
    quickPresets,
    isLoading
  };
}