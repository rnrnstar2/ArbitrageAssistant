import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Monitor, Wifi, WifiOff, Eye } from "lucide-react";
// Temporary types for MVP (until proper models are implemented)
type User = any;
type Account = any;

interface ClientsTabProps {
  clients: User[];
  accounts: Account[];
}

export const ClientsTab = ({ clients, accounts }: ClientsTabProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
      {clients.map((client) => {
        const clientAccounts = accounts.filter(acc => acc.userId === client.id);
        return (
          <Card key={client.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Monitor className="h-5 w-5" />
                  <span>{client.name}</span>
                </CardTitle>
                <Badge variant={client.pcStatus === "ONLINE" ? "default" : "secondary"}>
                  {client.pcStatus === "ONLINE" ? (
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
                  最終接続: {client.lastSeen ? new Date(client.lastSeen).toLocaleString() : '未接続'}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">口座数</span>
                    <div className="font-semibold">{clientAccounts.length}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">ステータス</span>
                    <div className="font-semibold">{client.pcStatus || 'OFFLINE'}</div>
                  </div>
                </div>
                
                <div className="flex space-x-2 pt-3">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Eye className="mr-1 h-3 w-3" />
                    詳細
                  </Button>
                  <Button size="sm" variant="outline" disabled={client.pcStatus === "OFFLINE"}>
                    設定
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};