"use client";

import { useState, useEffect } from "react";
import { StatsCards } from "@/features/dashboard/stats-cards";
import { ClientStatusList } from "@/features/dashboard/client-status-list";

interface DashboardStats {
  connectedClients: number;
  totalAccounts: number;
  totalBalance: number;
  totalBonus: number;
  openPositions: number;
  totalProfit: number;
}

interface ClientStatus {
  id: string;
  name: string;
  status: "online" | "offline";
  lastSeen: string;
  accountCount: number;
  totalBalance: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    connectedClients: 0,
    totalAccounts: 0,
    totalBalance: 0,
    totalBonus: 0,
    openPositions: 0,
    totalProfit: 0,
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
          totalBalance: 125000,
          totalBonus: 35000,
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
      } catch (error) {
        console.error("Dashboard data loading failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-gray-600">システム全体の状況を確認できます</p>
      </div>
      
      <StatsCards stats={stats} isLoading={isLoading} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClientStatusList clients={clients} isLoading={isLoading} />
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">最近のアクティビティ</h3>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-gray-200 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="w-3/4 h-4 bg-gray-200 rounded animate-pulse mb-1" />
                    <div className="w-1/2 h-3 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">Client-PC-001 が接続しました</p>
                    <p className="text-xs text-gray-500">2分前</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">EUR/USD 0.1lot でエントリー</p>
                    <p className="text-xs text-gray-500">5分前</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">ポジション決済: +$150</p>
                    <p className="text-xs text-gray-500">10分前</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}