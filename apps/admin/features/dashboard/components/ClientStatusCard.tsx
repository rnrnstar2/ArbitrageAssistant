import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Monitor } from "lucide-react";
import { ClientStatus } from "../types";
import { formatCurrency } from "../utils";

interface ClientStatusCardProps {
  clients: ClientStatus[];
  isLoading: boolean;
}

export function ClientStatusCard({ clients, isLoading }: ClientStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Monitor className="h-5 w-5" />
          <span>接続クライアント状況</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-gray-200 rounded-full animate-pulse" />
                  <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
              </div>
            ))
          ) : (
            clients.map((client) => (
              <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${client.status === "online" ? "bg-green-500" : "bg-gray-400"}`} />
                  <div>
                    <div className="font-medium text-sm">{client.name}</div>
                    <div className="text-xs text-gray-500">{client.accountCount}口座 • {client.lastSeen}</div>
                  </div>
                </div>
                <div className="text-sm font-medium">{formatCurrency(client.totalBalance)}</div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}