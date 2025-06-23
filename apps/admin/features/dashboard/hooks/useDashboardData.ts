import { useState, useEffect } from "react";
import { DashboardStats, ClientStatus } from "../types";

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats>({
    connectedClients: 0,
    totalAccounts: 0,
    openPositions: 0,
  });
  
  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setStats({
          connectedClients: 3,
          totalAccounts: 12,
          openPositions: 8,
        });
        
        setClients([
          {
            id: "1",
            name: "Client-PC-001",
            status: "online",
            lastSeen: "2分前",
            accountCount: 4,
          },
          {
            id: "2", 
            name: "Client-PC-002",
            status: "online",
            lastSeen: "5分前",
            accountCount: 3,
          },
          {
            id: "3",
            name: "Client-PC-003",
            status: "offline",
            lastSeen: "1時間前",
            accountCount: 5,
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
    isLoading
  };
}