"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Monitor, Wifi, WifiOff, Eye, Settings } from "lucide-react";

interface ClientPC {
  id: string;
  name: string;
  status: "online" | "offline";
  lastSeen: string;
  accountCount: number;
  totalBalance: number;
  totalBonus: number;
  openPositions: number;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientPC[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadClients = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setClients([
          {
            id: "1",
            name: "Client-PC-001",
            status: "online",
            lastSeen: "2分前",
            accountCount: 4,
            totalBalance: 50000,
            totalBonus: 15000,
            openPositions: 3,
          },
          {
            id: "2",
            name: "Client-PC-002", 
            status: "online",
            lastSeen: "5分前",
            accountCount: 3,
            totalBalance: 35000,
            totalBonus: 10000,
            openPositions: 2,
          },
          {
            id: "3",
            name: "Client-PC-003",
            status: "offline",
            lastSeen: "1時間前",
            accountCount: 5,
            totalBalance: 40000,
            totalBonus: 12000,
            openPositions: 0,
          },
        ]);
      } catch (error) {
        console.error("Clients loading failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadClients();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">クライアントPC管理</h1>
          <p className="text-gray-600">接続中のクライアントPCを管理します</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
                    <div className="w-24 h-5 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="w-16 h-6 bg-gray-200 rounded animate-pulse" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="w-28 h-4 bg-gray-200 rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">クライアントPC管理</h1>
          <p className="text-gray-600">接続中のクライアントPCを管理します</p>
        </div>
        <Button>
          <Settings className="mr-2 h-4 w-4" />
          システム設定
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {clients.map((client) => (
          <Card key={client.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Monitor className="h-5 w-5" />
                  <span>{client.name}</span>
                </CardTitle>
                <Badge variant={client.status === "online" ? "default" : "secondary"}>
                  {client.status === "online" ? (
                    <>
                      <Wifi className="mr-1 h-3 w-3" />
                      オンライン
                    </>
                  ) : (
                    <>
                      <WifiOff className="mr-1 h-3 w-3" />
                      オフライン
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  最終接続: {client.lastSeen}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">アカウント数</span>
                    <div className="font-semibold">{client.accountCount}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">ポジション</span>
                    <div className="font-semibold">{client.openPositions}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">残高</span>
                    <div className="font-semibold">{formatCurrency(client.totalBalance)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">ボーナス</span>
                    <div className="font-semibold text-orange-600">{formatCurrency(client.totalBonus)}</div>
                  </div>
                </div>
                
                <div className="flex space-x-2 pt-3">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Eye className="mr-1 h-3 w-3" />
                    詳細
                  </Button>
                  <Button size="sm" variant="outline" disabled={client.status === "offline"}>
                    操作
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {clients.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Monitor className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">クライアントが見つかりません</h3>
            <p className="text-gray-500">接続中のクライアントPCがありません</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}