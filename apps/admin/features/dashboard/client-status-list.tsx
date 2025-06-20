"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Monitor, Wifi, WifiOff } from "lucide-react";

interface ClientStatus {
  id: string;
  name: string;
  status: "online" | "offline";
  lastSeen: string;
  accountCount: number;
  totalBalance: number;
}

interface ClientStatusListProps {
  clients: ClientStatus[];
  isLoading?: boolean;
}

export function ClientStatusList({ clients, isLoading = false }: ClientStatusListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            クライアント接続状況
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-200 rounded-full animate-pulse" />
                  <div>
                    <div className="w-24 h-4 bg-gray-200 rounded animate-pulse mb-1" />
                    <div className="w-32 h-3 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-16 h-4 bg-gray-200 rounded animate-pulse mb-1" />
                  <div className="w-20 h-3 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (clients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            クライアント接続状況
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">
            接続中のクライアントがありません
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          クライアント接続状況
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {clients.map((client) => (
            <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex items-center">
                  {client.status === "online" ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{client.name}</div>
                  <div className="text-sm text-gray-500">
                    最終接続: {client.lastSeen}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={client.status === "online" ? "default" : "secondary"}>
                  {client.status === "online" ? "オンライン" : "オフライン"}
                </Badge>
                <div className="text-sm text-gray-500 mt-1">
                  {client.accountCount}口座 • {formatCurrency(client.totalBalance)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}